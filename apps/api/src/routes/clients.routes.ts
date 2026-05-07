import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { authMiddleware } from '../middleware/auth.middleware'
import { companyMiddleware } from '../middleware/company.middleware'
import * as clientsService from '../services/clients.service'
import type { AppEnv } from '../lib/types'

const app = new Hono<AppEnv>()

const createClientSchema = z.object({
  type: z.enum(['COMPANY', 'INDIVIDUAL']),
  name: z.string().min(1),
  countryCode: z.string().min(1),
  sector: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  legalInfo:        z.string().optional(),
  rccm:             z.string().optional(),
  ifu:              z.string().optional(),
  divisionFiscale:  z.string().optional(),
  regimeImposition: z.string().optional(),
  internalContactName: z.string().optional(),
  internalContactEmail: z.string().email().optional(),
  internalContactPhone: z.string().optional(),
  internalContactJobTitle: z.string().optional(),
})

app.use(authMiddleware)
app.use(companyMiddleware)

app.get('/', async (c) => {
  const companyId = c.get('companyId')
  const includeDeleted = c.req.query('includeDeleted') === 'true'
  const data = await clientsService.getClients(companyId, includeDeleted)
  return c.json({ data })
})

app.post('/', zValidator('json', createClientSchema), async (c) => {
  const companyId = c.get('companyId')
  const client = await clientsService.createClient(companyId, c.req.valid('json'))
  return c.json({ data: client }, 201)
})

app.get('/:id', async (c) => {
  const companyId = c.get('companyId')
  const client = await clientsService.getClient(companyId, c.req.param('id'))
  if (!client) return c.json({ error: 'Not found' }, 404)
  return c.json({ data: client })
})

const updateClientSchema = createClientSchema.partial().extend({
  rccm:             z.string().nullable().optional(),
  ifu:              z.string().nullable().optional(),
  divisionFiscale:  z.string().nullable().optional(),
  regimeImposition: z.string().nullable().optional(),
})

app.patch('/:id', zValidator('json', updateClientSchema), async (c) => {
  const companyId = c.get('companyId')
  const client = await clientsService.updateClient(companyId, c.req.param('id'), c.req.valid('json'))
  if (!client) return c.json({ error: 'Not found' }, 404)
  return c.json({ data: client })
})

app.delete('/:id', async (c) => {
  const companyId = c.get('companyId')
  const user = c.get('user')
  const client = await clientsService.softDeleteClient(companyId, c.req.param('id'), user.id)
  if (!client) return c.json({ error: 'Not found' }, 404)
  return c.json({ data: client })
})

app.post('/:id/restore', async (c) => {
  const companyId = c.get('companyId')
  const client = await clientsService.restoreClient(companyId, c.req.param('id'))
  if (!client) return c.json({ error: 'Not found' }, 404)
  return c.json({ data: client })
})

export default app
