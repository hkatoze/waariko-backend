import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { authMiddleware } from '../middleware/auth.middleware'
import { companyMiddleware } from '../middleware/company.middleware'
import * as projectsService from '../services/projects.service'
import type { AppEnv } from '../lib/types'

const app = new Hono<AppEnv>()

const createProjectSchema = z.object({
  name: z.string().min(1),
  clientId: z.string().uuid(),
  description: z.string().optional(),
  status: z.enum(['DRAFT', 'IN_PROGRESS', 'VALIDATED', 'COMPLETED', 'CANCELLED']).optional(),
  startedAt: z.string().datetime().optional().transform(v => v ? new Date(v) : undefined),
})

app.use(authMiddleware)
app.use(companyMiddleware)

app.get('/', async (c) => {
  const companyId = c.get('companyId')
  const includeDeleted = c.req.query('includeDeleted') === 'true'
  const data = await projectsService.getProjects(companyId, includeDeleted)
  return c.json({ data })
})

app.post('/', zValidator('json', createProjectSchema), async (c) => {
  const companyId = c.get('companyId')
  const project = await projectsService.createProject(companyId, c.req.valid('json'))
  return c.json({ data: project }, 201)
})

app.get('/:id', async (c) => {
  const companyId = c.get('companyId')
  const project = await projectsService.getProject(companyId, c.req.param('id'))
  if (!project) return c.json({ error: 'Not found' }, 404)
  return c.json({ data: project })
})

app.patch('/:id', zValidator('json', createProjectSchema.partial()), async (c) => {
  const companyId = c.get('companyId')
  const body = c.req.valid('json')
  const project = await projectsService.updateProject(companyId, c.req.param('id'), {
    ...body,
    completedAt: body.status === 'COMPLETED' ? new Date() : undefined,
  })
  if (!project) return c.json({ error: 'Not found' }, 404)
  return c.json({ data: project })
})

app.delete('/:id', async (c) => {
  const companyId = c.get('companyId')
  const user = c.get('user')
  const project = await projectsService.softDeleteProject(companyId, c.req.param('id'), user.id)
  if (!project) return c.json({ error: 'Not found' }, 404)
  return c.json({ data: project })
})

app.post('/:id/restore', async (c) => {
  const companyId = c.get('companyId')
  const project = await projectsService.restoreProject(companyId, c.req.param('id'))
  if (!project) return c.json({ error: 'Not found' }, 404)
  return c.json({ data: project })
})

app.post('/:id/first-payment', zValidator('json', z.object({
  settlementType: z.enum(['BANK_TRANSFER', 'CASH', 'CHECK', 'MOBILE_MONEY']),
})), async (c) => {
  const companyId = c.get('companyId')
  const { settlementType } = c.req.valid('json')
  try {
    const project = await projectsService.recordFirstPayment(companyId, c.req.param('id'), settlementType)
    if (!project) return c.json({ error: 'Not found' }, 404)
    return c.json({ data: project })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erreur'
    return c.json({ error: msg }, 400)
  }
})

app.post('/:id/complete', zValidator('json', z.object({
  settlementType: z.enum(['BANK_TRANSFER', 'CASH', 'CHECK', 'MOBILE_MONEY']),
})), async (c) => {
  const companyId = c.get('companyId')
  const { settlementType } = c.req.valid('json')
  try {
    const project = await projectsService.completeProject(companyId, c.req.param('id'), settlementType)
    if (!project) return c.json({ error: 'Not found' }, 404)
    return c.json({ data: project })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erreur'
    return c.json({ error: msg }, 400)
  }
})

export default app
