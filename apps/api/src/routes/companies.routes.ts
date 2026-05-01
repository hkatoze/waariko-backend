import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { authMiddleware } from '../middleware/auth.middleware'
import { companyMiddleware } from '../middleware/company.middleware'
import * as companiesService from '../services/companies.service'
import type { AppEnv } from '../lib/types'

const app = new Hono<AppEnv>()

const createCompanySchema = z.object({
  name: z.string().min(1),
  profile: z.enum(['SERVICE_PROVIDER', 'MERCHANT']),
  sector: z.string().min(1),
  invoiceTemplateId: z.string().min(1),
  primaryColor: z.string().min(1),
  secondaryColor: z.string().optional(),
  tertiaryColor: z.string().optional(),
  logoUrl: z.string().url().optional(),
  signatureUrl: z.string().url().optional(),
  headOffice: z.string().min(1),
  email: z.string().email().optional(),
  phonePrimary: z.string().min(1),
  phoneSecondary: z.string().optional(),
  website: z.string().url().optional(),
  rccm: z.string().optional(),
  ifu: z.string().optional(),
  ifu2: z.string().optional(),
  legalStatus: z.string().min(1),
  bankAccountNumber: z.string().optional(),
})

const updateCompanySchema = z.object({
  name:              z.string().min(1).optional(),
  sector:            z.string().optional(),
  invoiceTemplateId: z.string().optional(),
  primaryColor:      z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  secondaryColor:    z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  tertiaryColor:     z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  logoUrl:           z.string().url().nullable().optional(),
  signatureUrl:      z.string().url().nullable().optional(),
  headOffice:        z.string().optional(),
  email:             z.string().email().nullable().optional(),
  phonePrimary:      z.string().optional(),
  phoneSecondary:    z.string().nullable().optional(),
  website:           z.string().url().nullable().optional(),
  rccm:              z.string().nullable().optional(),
  ifu:               z.string().nullable().optional(),
  ifu2:              z.string().nullable().optional(),
  legalStatus:       z.string().optional(),
  bankAccountNumber: z.string().nullable().optional(),
})

app.use(authMiddleware)

// ── Routes /me (utilisent companyMiddleware → x-company-id header) ────────────
app.get('/me', companyMiddleware, async (c) => {
  const companyId = c.get('companyId')
  const company   = await companiesService.getCompany(companyId)
  if (!company) return c.json({ error: 'Not found' }, 404)
  return c.json({ data: company })
})

app.patch('/me', companyMiddleware, zValidator('json', updateCompanySchema), async (c) => {
  const companyId = c.get('companyId')
  const company   = await companiesService.updateCompany(companyId, c.req.valid('json'))
  return c.json({ data: company })
})

app.get('/', async (c) => {
  const user = c.get('user')
  const memberships = await companiesService.getUserCompanies(user.id)
  return c.json({ data: memberships })
})

app.post('/', zValidator('json', createCompanySchema), async (c) => {
  const user = c.get('user')
  const company = await companiesService.createCompany(user.id, c.req.valid('json'))
  return c.json({ data: company }, 201)
})

app.get('/:id', async (c) => {
  const user = c.get('user')
  const companyId = c.req.param('id')

  const role = await companiesService.getMemberRole(companyId, user.id)
  if (!role) return c.json({ error: 'Forbidden' }, 403)

  const company = await companiesService.getCompany(companyId)
  if (!company) return c.json({ error: 'Not found' }, 404)

  return c.json({ data: company })
})

app.patch('/:id', zValidator('json', createCompanySchema.partial()), async (c) => {
  const user = c.get('user')
  const companyId = c.req.param('id')

  const role = await companiesService.getMemberRole(companyId, user.id)
  if (!role || role === 'MEMBER') return c.json({ error: 'Forbidden' }, 403)

  const company = await companiesService.updateCompany(companyId, c.req.valid('json'))
  return c.json({ data: company })
})

app.delete('/:id', async (c) => {
  const user = c.get('user')
  const companyId = c.req.param('id')

  const role = await companiesService.getMemberRole(companyId, user.id)
  if (role !== 'OWNER') return c.json({ error: 'Forbidden' }, 403)

  await companiesService.deleteCompany(companyId)
  return c.json({ data: null })
})

app.get('/:id/members', async (c) => {
  const user = c.get('user')
  const companyId = c.req.param('id')

  const role = await companiesService.getMemberRole(companyId, user.id)
  if (!role) return c.json({ error: 'Forbidden' }, 403)

  const members = await companiesService.getMembers(companyId)
  return c.json({ data: members })
})

app.post('/:id/members', zValidator('json', z.object({
  userId: z.string().uuid(),
  role: z.enum(['ADMIN', 'MEMBER']).optional(),
})), async (c) => {
  const user = c.get('user')
  const companyId = c.req.param('id')
  const { userId, role } = c.req.valid('json')

  const requesterRole = await companiesService.getMemberRole(companyId, user.id)
  if (!requesterRole || requesterRole === 'MEMBER') return c.json({ error: 'Forbidden' }, 403)

  try {
    const member = await companiesService.addMember(companyId, userId, role)
    return c.json({ data: member }, 201)
  } catch (e: any) {
    return c.json({ error: e.message }, 409)
  }
})

app.patch('/:id/members/:userId', zValidator('json', z.object({ role: z.enum(['ADMIN', 'MEMBER']) })), async (c) => {
  const user = c.get('user')
  const { id: companyId, userId } = c.req.param()

  const requesterRole = await companiesService.getMemberRole(companyId, user.id)
  if (!requesterRole || requesterRole === 'MEMBER') return c.json({ error: 'Forbidden' }, 403)

  const member = await companiesService.updateMemberRole(companyId, userId, c.req.valid('json').role)
  return c.json({ data: member })
})

app.delete('/:id/members/:userId', async (c) => {
  const user = c.get('user')
  const { id: companyId, userId } = c.req.param()

  const requesterRole = await companiesService.getMemberRole(companyId, user.id)
  if (!requesterRole || requesterRole === 'MEMBER') return c.json({ error: 'Forbidden' }, 403)

  await companiesService.removeMember(companyId, userId)
  return c.json({ data: null })
})

export default app
