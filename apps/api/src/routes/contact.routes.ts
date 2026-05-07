import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { authMiddleware } from '../middleware/auth.middleware'
import type { AppEnv } from '../lib/types'

const app = new Hono<AppEnv>()

const contactSchema = z.object({
  subject: z.string().min(1, 'Objet requis').max(200),
  message: z.string().min(1, 'Message requis').max(2000),
})

app.use(authMiddleware)

app.post('/', zValidator('json', contactSchema), async (c) => {
  const user                 = c.get('user')
  const { subject, message } = c.req.valid('json')

  const apiKey = process.env.CALLMEBOT_API_KEY
  const phone  = process.env.CALLMEBOT_PHONE

  if (!apiKey || !phone) {
    console.error('[contact] CALLMEBOT_API_KEY ou CALLMEBOT_PHONE manquant')
    return c.json({ error: 'Service de messagerie non configuré' }, 503)
  }

  const text = `📩 *Nouveau message Waariko*\n\n*De :* ${user.email ?? 'inconnu'}\n*Objet :* ${subject}\n\n${message}`

  const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(text)}&apikey=${apiKey}`

  const res = await fetch(url)

  if (!res.ok) {
    const err = await res.text()
    console.error('[contact] CallMeBot error:', err)
    return c.json({ error: "Échec de l'envoi, réessayez plus tard" }, 502)
  }

  return c.json({ data: { sent: true } })
})

export default app
