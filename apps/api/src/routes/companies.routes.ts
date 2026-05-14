import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { authMiddleware } from '../middleware/auth.middleware'
import { companyMiddleware } from '../middleware/company.middleware'
import * as companiesService from '../services/companies.service'
import { supabase } from '../lib/supabase'
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
  invoiceHeaderUrl:  z.string().url().nullable().optional(),
  invoiceFooterUrl:  z.string().url().nullable().optional(),
  cachetUrl:         z.string().url().nullable().optional(),
  headOffice:        z.string().optional(),
  email:             z.string().email().nullable().optional(),
  phonePrimary:      z.string().optional(),
  phoneSecondary:    z.string().nullable().optional(),
  website:           z.string().url().nullable().optional(),
  rccm:              z.string().nullable().optional(),
  ifu:               z.string().nullable().optional(),
  ifu2:              z.string().nullable().optional(),
  legalStatus:       z.string().optional(),
  divisionFiscale:   z.string().nullable().optional(),
  regimeImposition:  z.string().nullable().optional(),
  bankAccountNumber: z.string().nullable().optional(),
  currency:          z.string().min(1).max(10).optional(),
})

// ── Routes publiques (avant authMiddleware) ───────────────────────────────────
// GET /invitations/:token — lecture publique, le token UUID fait office de secret
app.get('/invitations/:token', async (c) => {
  const token = c.req.param('token')
  const invitation = await companiesService.getInvitationByToken(token)
  if (!invitation) return c.json({ error: 'Invitation not found' }, 404)
  return c.json({ data: invitation })
})

app.use(authMiddleware)

// ── /me routes (header x-company-id) ─────────────────────────────────────────

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

// ── Numérotation des factures ─────────────────────────────────────────────────

app.get('/me/invoice-sequence', companyMiddleware, async (c) => {
  const companyId = c.get('companyId')
  const seq = await companiesService.getInvoiceSequence(companyId)
  return c.json({ data: seq })
})

app.patch('/me/invoice-sequence', companyMiddleware, zValidator('json', z.object({
  startNumber: z.number().int().min(1).max(99999),
})), async (c) => {
  const companyId = c.get('companyId')
  const { startNumber } = c.req.valid('json')
  await companiesService.setInvoiceStartNumber(companyId, startNumber)
  return c.json({ data: { startNumber } })
})

app.post('/me/reset', companyMiddleware, async (c) => {
  const companyId = c.get('companyId')
  await companiesService.resetCompany(companyId)
  return c.json({ data: null })
})

app.post('/me/delete-account', async (c) => {
  const user = c.get('user')

  // 1. Supprimer toutes les sociétés dont l'utilisateur est OWNER (cascade tout)
  const memberships = await companiesService.getUserCompanies(user.id)
  const ownedIds = memberships
    .filter((m: { role: string }) => m.role === 'OWNER')
    .map((m: { companyId: string }) => m.companyId)

  for (const companyId of ownedIds) {
    await companiesService.deleteCompany(companyId)
  }

  // 2. Supprimer le compte Supabase (authMiddleware utilise SERVICE_ROLE)
  const { error } = await supabase.auth.admin.deleteUser(user.id)
  if (error) {
    console.error('[delete-account] Supabase error:', error)
    return c.json({ error: 'Erreur lors de la suppression du compte' }, 500)
  }

  return c.json({ data: null })
})

// ── /invitations/:token/accept (auth requis) ─────────────────────────────────

app.post('/invitations/:token/accept', async (c) => {
  const user  = c.get('user')
  const token = c.req.param('token')

  try {
    const invitation = await companiesService.acceptInvitation(token, user.id)
    return c.json({ data: invitation })
  } catch (e: any) {
    const msg = e.message
    if (msg === 'Invitation not found') return c.json({ error: msg }, 404)
    if (msg === 'Invitation expired')   return c.json({ error: msg }, 410)
    if (msg === 'Already a member')     return c.json({ error: msg }, 409)
    return c.json({ error: 'Internal error' }, 500)
  }
})

// ── Company list / create ─────────────────────────────────────────────────────

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

// ── /:id routes ───────────────────────────────────────────────────────────────

app.get('/:id', async (c) => {
  const user      = c.get('user')
  const companyId = c.req.param('id')

  const role = await companiesService.getMemberRole(companyId, user.id)
  if (!role) return c.json({ error: 'Forbidden' }, 403)

  const company = await companiesService.getCompany(companyId)
  if (!company) return c.json({ error: 'Not found' }, 404)

  return c.json({ data: company })
})

app.patch('/:id', zValidator('json', createCompanySchema.partial()), async (c) => {
  const user      = c.get('user')
  const companyId = c.req.param('id')

  const role = await companiesService.getMemberRole(companyId, user.id)
  if (!role || role === 'MEMBER') return c.json({ error: 'Forbidden' }, 403)

  const company = await companiesService.updateCompany(companyId, c.req.valid('json'))
  return c.json({ data: company })
})

app.delete('/:id', async (c) => {
  const user      = c.get('user')
  const companyId = c.req.param('id')

  const role = await companiesService.getMemberRole(companyId, user.id)
  if (role !== 'OWNER') return c.json({ error: 'Forbidden' }, 403)

  await companiesService.deleteCompany(companyId)
  return c.json({ data: null })
})

// ── /:id/members ──────────────────────────────────────────────────────────────

app.get('/:id/members', async (c) => {
  const user      = c.get('user')
  const companyId = c.req.param('id')

  const role = await companiesService.getMemberRole(companyId, user.id)
  if (!role) return c.json({ error: 'Forbidden' }, 403)

  const members = await companiesService.getMembers(companyId)

  // Enrichit chaque membre avec son email depuis Supabase Auth
  const userIds = members.map(m => m.userId)
  const emailMap: Record<string, string> = {}
  await Promise.all(
    userIds.map(async (uid) => {
      const { data } = await supabase.auth.admin.getUserById(uid)
      if (data?.user?.email) emailMap[uid] = data.user.email
    })
  )

  const enriched = members.map(m => ({ ...m, email: emailMap[m.userId] ?? null }))
  return c.json({ data: enriched })
})

app.patch('/:id/members/:userId', zValidator('json', z.object({ role: z.enum(['ADMIN', 'MEMBER']) })), async (c) => {
  const user                    = c.get('user')
  const { id: companyId, userId } = c.req.param()

  const requesterRole = await companiesService.getMemberRole(companyId, user.id)
  if (requesterRole !== 'OWNER') return c.json({ error: 'Forbidden' }, 403)

  const member = await companiesService.updateMemberRole(companyId, userId, c.req.valid('json').role)
  return c.json({ data: member })
})

app.delete('/:id/members/:userId', async (c) => {
  const user                    = c.get('user')
  const { id: companyId, userId } = c.req.param()

  const requesterRole = await companiesService.getMemberRole(companyId, user.id)
  if (requesterRole !== 'OWNER') return c.json({ error: 'Forbidden' }, 403)

  await companiesService.removeMember(companyId, userId)
  return c.json({ data: null })
})

// ── /:id/invitations ──────────────────────────────────────────────────────────

app.get('/:id/invitations', async (c) => {
  const user      = c.get('user')
  const companyId = c.req.param('id')

  const role = await companiesService.getMemberRole(companyId, user.id)
  if (role !== 'OWNER') return c.json({ error: 'Forbidden' }, 403)

  const invitations = await companiesService.getInvitations(companyId)
  return c.json({ data: invitations })
})

app.post('/:id/invitations', zValidator('json', z.object({
  email: z.string().email(),
  role:  z.enum(['ADMIN', 'MEMBER']).default('MEMBER'),
})), async (c) => {
  const user      = c.get('user')
  const companyId = c.req.param('id')

  const role = await companiesService.getMemberRole(companyId, user.id)
  if (role !== 'OWNER') return c.json({ error: 'Forbidden' }, 403)

  const company = await companiesService.getCompany(companyId)
  if (!company) return c.json({ error: 'Not found' }, 404)

  const { email, role: invitedRole } = c.req.valid('json')

  try {
    const invitation = await companiesService.sendInvitation(
      companyId, email, invitedRole, user.id, company.name,
    )
    return c.json({ data: invitation }, 201)
  } catch (e: any) {
    const msg = e.message
    if (msg === 'Invitation already pending') return c.json({ error: msg }, 409)
    return c.json({ error: msg }, 500)
  }
})

app.delete('/:id/invitations/:invitationId', async (c) => {
  const user                              = c.get('user')
  const { id: companyId, invitationId }   = c.req.param()

  const role = await companiesService.getMemberRole(companyId, user.id)
  if (role !== 'OWNER') return c.json({ error: 'Forbidden' }, 403)

  await companiesService.cancelInvitation(companyId, invitationId)
  return c.json({ data: null })
})

export default app
