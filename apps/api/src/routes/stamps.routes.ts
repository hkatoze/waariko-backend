import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import crypto from 'node:crypto'
import { authMiddleware } from '../middleware/auth.middleware'
import { companyMiddleware } from '../middleware/company.middleware'
import { supabase } from '../lib/supabase'
import { db, companyStamps, eq, and } from '@waariko/db'
import type { AppEnv } from '../lib/types'

const app = new Hono<AppEnv>()

// ── In-memory session store ────────────────────────────────────────────────────
// Sessions expire après 10 minutes.  On n'a pas besoin de persistance.

type SSEController = {
  sendEvent: (data: string) => void
  close:     () => void
}

type StampSession = {
  companyId:  string
  invoiceId:  string
  expiresAt:  number
  controllers: Set<SSEController>
}

const sessions = new Map<string, StampSession>()

// Nettoyage périodique des sessions expirées
setInterval(() => {
  const now = Date.now()
  for (const [id, s] of sessions) {
    if (s.expiresAt < now) {
      s.controllers.forEach(c => c.close())
      sessions.delete(id)
    }
  }
}, 60_000)

// ── Ensure Supabase Storage bucket exists ──────────────────────────────────────
async function ensureBucket() {
  await supabase.storage.createBucket('stamps', { public: true }).catch(() => {/* already exists */})
}
ensureBucket()

// ── POST /stamps/sessions  — créer une session (auth requis) ───────────────────
app.post('/sessions', authMiddleware, companyMiddleware, async (c) => {
  const companyId = c.get('companyId')
  const { invoiceId } = await c.req.json<{ invoiceId: string }>()
  if (!invoiceId) return c.json({ error: 'invoiceId required' }, 400)

  const sessionId = crypto.randomUUID()
  sessions.set(sessionId, {
    companyId,
    invoiceId,
    expiresAt:   Date.now() + 10 * 60_000, // 10 min
    controllers: new Set(),
  })

  return c.json({ sessionId })
})

// ── GET /stamps/sessions/:id/events  — flux SSE (pas d'auth, UUID = secret) ───
app.get('/sessions/:id/events', async (c) => {
  const sessionId = c.req.param('id')
  const session   = sessions.get(sessionId)
  if (!session || session.expiresAt < Date.now()) {
    return c.json({ error: 'Session introuvable ou expirée' }, 404)
  }

  return streamSSE(c, async (stream) => {
    let closed = false

    const controller: SSEController = {
      sendEvent: (data: string) => {
        if (!closed) stream.writeSSE({ data }).catch(() => {})
      },
      close: () => {
        closed = true
      },
    }

    session.controllers.add(controller)

    // Heartbeat toutes les 20s pour garder la connexion vivante
    const hb = setInterval(() => {
      if (closed) { clearInterval(hb); return }
      stream.writeSSE({ data: JSON.stringify({ type: 'ping' }) }).catch(() => {})
    }, 20_000)

    // Écouter la fermeture du stream côté client
    c.req.raw.signal.addEventListener('abort', () => {
      closed = true
      clearInterval(hb)
      session.controllers.delete(controller)
    })

    // Maintenir le stream ouvert jusqu'à fermeture ou expiration
    while (!closed && session.expiresAt > Date.now()) {
      await new Promise(r => setTimeout(r, 500))
    }

    clearInterval(hb)
    session.controllers.delete(controller)
  })
})

// ── POST /stamps/sessions/:id/upload  — reçoit la photo (pas d'auth) ──────────
app.post('/sessions/:id/upload', async (c) => {
  const sessionId = c.req.param('id')
  const session   = sessions.get(sessionId)
  if (!session || session.expiresAt < Date.now()) {
    return c.json({ error: 'Session introuvable ou expirée' }, 404)
  }

  const body      = await c.req.formData()
  const file      = body.get('file') as File | null
  if (!file) return c.json({ error: 'Fichier manquant' }, 400)

  const ext      = file.type === 'image/jpeg' ? 'jpg' : 'png'
  const filename = `${session.companyId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`

  const arrayBuffer = await file.arrayBuffer()
  const { error: uploadError } = await supabase.storage
    .from('stamps')
    .upload(filename, new Uint8Array(arrayBuffer), {
      contentType: file.type || 'image/png',
      upsert: false,
    })

  if (uploadError) {
    console.error('Upload error:', uploadError)
    return c.json({ error: 'Erreur upload' }, 500)
  }

  const { data: { publicUrl } } = supabase.storage.from('stamps').getPublicUrl(filename)

  // Notifier tous les clients SSE de cette session
  const payload = JSON.stringify({ type: 'stamp_received', url: publicUrl })
  session.controllers.forEach(ctrl => ctrl.sendEvent(payload))

  return c.json({ url: publicUrl })
})

// ── Routes authentifiées pour la bibliothèque ──────────────────────────────────
app.use(authMiddleware)
app.use(companyMiddleware)

// GET /stamps  — liste des stickers sauvegardés
app.get('/', async (c) => {
  const companyId = c.get('companyId')
  const stamps = await db
    .select()
    .from(companyStamps)
    .where(eq(companyStamps.companyId, companyId))
    .orderBy(companyStamps.createdAt)
  return c.json({ data: stamps })
})

// POST /stamps  — sauvegarder un sticker dans la bibliothèque
app.post('/', async (c) => {
  const companyId = c.get('companyId')
  const { url, label } = await c.req.json<{ url: string; label?: string }>()
  if (!url) return c.json({ error: 'url required' }, 400)

  const [stamp] = await db
    .insert(companyStamps)
    .values({ companyId, url, label: label ?? '' })
    .returning()

  return c.json({ data: stamp }, 201)
})

// DELETE /stamps/:id
app.delete('/:id', async (c) => {
  const companyId = c.get('companyId')
  const id        = c.req.param('id')

  const [deleted] = await db
    .delete(companyStamps)
    .where(and(eq(companyStamps.id, id), eq(companyStamps.companyId, companyId)))
    .returning()

  if (!deleted) return c.json({ error: 'Non trouvé' }, 404)

  // Supprimer aussi de Supabase Storage si possible
  const path = deleted.url.split('/stamps/')[1]
  if (path) await supabase.storage.from('stamps').remove([path]).catch(() => {})

  return c.json({ success: true })
})

export default app
