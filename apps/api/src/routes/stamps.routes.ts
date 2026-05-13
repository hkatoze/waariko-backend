import { Hono } from 'hono'
import crypto from 'node:crypto'
import { authMiddleware } from '../middleware/auth.middleware'
import { companyMiddleware } from '../middleware/company.middleware'
import { supabase } from '../lib/supabase'
import { db, companyStamps, stampSessions, eq, and, sql } from '@waariko/db'
import type { AppEnv } from '../lib/types'

const app = new Hono<AppEnv>()

// ── Ensure Supabase Storage bucket exists ──────────────────────────────────────
async function ensureBucket() {
  await supabase.storage.createBucket('stamps', { public: true }).catch(() => {})
}
ensureBucket()

// Nettoyage des sessions expirées toutes les 5 minutes
setInterval(async () => {
  await db.delete(stampSessions)
    .where(sql`${stampSessions.expiresAt} < now()`)
    .catch(() => {})
}, 5 * 60_000)

// ── POST /stamps/sessions  — créer une session (auth requis) ───────────────────
app.post('/sessions', authMiddleware, companyMiddleware, async (c) => {
  const companyId = c.get('companyId')
  const { invoiceId } = await c.req.json<{ invoiceId: string }>()
  if (!invoiceId) return c.json({ error: 'invoiceId required' }, 400)

  const expiresAt = new Date(Date.now() + 10 * 60_000) // 10 min

  const [session] = await db
    .insert(stampSessions)
    .values({ companyId, invoiceId, status: 'waiting', expiresAt })
    .returning()

  return c.json({ sessionId: session.id })
})

// ── GET /stamps/sessions/:id/status  — polling (pas d'auth, UUID = secret) ────
app.get('/sessions/:id/status', async (c) => {
  const sessionId = c.req.param('id')

  const [session] = await db
    .select()
    .from(stampSessions)
    .where(eq(stampSessions.id, sessionId))
    .limit(1)

  if (!session) return c.json({ error: 'Session introuvable' }, 404)
  if (session.expiresAt < new Date()) return c.json({ error: 'Session expirée' }, 410)

  return c.json({
    status:   session.status,
    stampUrl: session.stampUrl ?? null,
  })
})

// ── POST /stamps/sessions/:id/upload  — reçoit la photo (pas d'auth) ──────────
app.post('/sessions/:id/upload', async (c) => {
  const sessionId = c.req.param('id')

  const [session] = await db
    .select()
    .from(stampSessions)
    .where(eq(stampSessions.id, sessionId))
    .limit(1)

  if (!session) return c.json({ error: 'Session introuvable' }, 404)
  if (session.expiresAt < new Date()) return c.json({ error: 'Session expirée' }, 410)

  const body = await c.req.formData()
  const file = body.get('file') as File | null
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

  // Mettre à jour la session en DB
  await db
    .update(stampSessions)
    .set({ status: 'received', stampUrl: publicUrl })
    .where(eq(stampSessions.id, sessionId))

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

  const path = deleted.url.split('/stamps/')[1]
  if (path) await supabase.storage.from('stamps').remove([path]).catch(() => {})

  return c.json({ success: true })
})

export default app
