import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth.middleware'
import { companyMiddleware } from '../middleware/company.middleware'
import * as trashService from '../services/trash.service'
import type { AppEnv } from '../lib/types'

const app = new Hono<AppEnv>()

app.use(authMiddleware)
app.use(companyMiddleware)

// GET /trash — liste tous les éléments supprimés
app.get('/', async (c) => {
  const companyId = c.get('companyId')
  const items = await trashService.getTrashItems(companyId)
  return c.json({ data: items })
})

// POST /trash/clients/:id/restore
app.post('/clients/:id/restore', async (c) => {
  const companyId = c.get('companyId')
  const item = await trashService.restoreClient(companyId, c.req.param('id'))
  if (!item) return c.json({ error: 'Not found' }, 404)
  return c.json({ data: item })
})

// POST /trash/projects/:id/restore
app.post('/projects/:id/restore', async (c) => {
  const companyId = c.get('companyId')
  const item = await trashService.restoreProject(companyId, c.req.param('id'))
  if (!item) return c.json({ error: 'Not found' }, 404)
  return c.json({ data: item })
})

// DELETE /trash/clients/:id — suppression définitive
app.delete('/clients/:id', async (c) => {
  const companyId = c.get('companyId')
  await trashService.permanentDeleteClient(companyId, c.req.param('id'))
  return c.json({ data: null })
})

// DELETE /trash/projects/:id — suppression définitive
app.delete('/projects/:id', async (c) => {
  const companyId = c.get('companyId')
  await trashService.permanentDeleteProject(companyId, c.req.param('id'))
  return c.json({ data: null })
})

// DELETE /trash — vider toute la corbeille
app.delete('/', async (c) => {
  const companyId = c.get('companyId')
  await trashService.emptyTrash(companyId)
  return c.json({ data: null })
})

export default app
