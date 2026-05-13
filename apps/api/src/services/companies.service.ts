import { db, companies, companyMembers, companyInvitations, clients, expenses, sales, stockCategories, stockProducts, invoiceSequences, eq, and, desc, sql } from '@waariko/db'
import type { MemberRole, CompanyProfile } from '@waariko/types'
import { supabase } from '../lib/supabase'
import { sendInvitationEmail } from '../lib/email'

export async function getUserCompanies(userId: string) {
  const rows = await db
    .select({
      id:        companyMembers.id,
      role:      companyMembers.role,
      companyId: companyMembers.companyId,
      company:   companies,
    })
    .from(companyMembers)
    .innerJoin(companies, eq(companyMembers.companyId, companies.id))
    .where(eq(companyMembers.userId, userId))

  return rows
}

export async function getCompany(companyId: string) {
  return db.query.companies.findFirst({
    where: eq(companies.id, companyId),
  })
}

export async function createCompany(userId: string, data: {
  name: string
  profile: CompanyProfile
  sector: string
  invoiceTemplateId: string
  primaryColor: string
  secondaryColor?: string
  tertiaryColor?: string
  logoUrl?: string
  signatureUrl?: string
  headOffice: string
  email?: string
  phonePrimary: string
  phoneSecondary?: string
  website?: string
  rccm?: string
  ifu?: string
  ifu2?: string
  legalStatus: string
  bankAccountNumber?: string
}) {
  const [company] = await db.insert(companies).values(data).returning()

  await db.insert(companyMembers).values({
    companyId: company.id,
    userId,
    role: 'OWNER',
  })

  return company
}

export async function updateCompany(companyId: string, data: Partial<{
  name: string; profile: CompanyProfile; sector: string; invoiceTemplateId: string
  primaryColor: string; secondaryColor: string | null; tertiaryColor: string | null
  logoUrl: string | null; signatureUrl: string | null; invoiceHeaderUrl: string | null; invoiceFooterUrl: string | null; cachetUrl: string | null; headOffice: string
  email: string | null; phonePrimary: string; phoneSecondary: string | null
  website: string | null; rccm: string | null; ifu: string | null; ifu2: string | null
  legalStatus: string; divisionFiscale: string | null; regimeImposition: string | null
  bankAccountNumber: string | null
}>) {
  const [updated] = await db
    .update(companies)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(companies.id, companyId))
    .returning()

  return updated
}

export async function deleteCompany(companyId: string) {
  await db.delete(companies).where(eq(companies.id, companyId))
}

// ── Members ───────────────────────────────────────────────────────────────────

export async function getMembers(companyId: string) {
  return db.query.companyMembers.findMany({
    where: eq(companyMembers.companyId, companyId),
  })
}

export async function addMember(companyId: string, userId: string, role: MemberRole = 'MEMBER') {
  const existing = await db.query.companyMembers.findFirst({
    where: and(eq(companyMembers.companyId, companyId), eq(companyMembers.userId, userId)),
  })

  if (existing) throw new Error('Already a member')

  const [member] = await db.insert(companyMembers).values({ companyId, userId, role }).returning()
  return member
}

export async function updateMemberRole(companyId: string, userId: string, role: MemberRole) {
  const [updated] = await db
    .update(companyMembers)
    .set({ role })
    .where(and(eq(companyMembers.companyId, companyId), eq(companyMembers.userId, userId)))
    .returning()

  return updated
}

export async function removeMember(companyId: string, userId: string) {
  await db
    .delete(companyMembers)
    .where(and(eq(companyMembers.companyId, companyId), eq(companyMembers.userId, userId)))
}

export async function getMemberRole(companyId: string, userId: string) {
  const member = await db.query.companyMembers.findFirst({
    where: and(eq(companyMembers.companyId, companyId), eq(companyMembers.userId, userId)),
  })
  return member?.role ?? null
}

// ── Invitations ───────────────────────────────────────────────────────────────

export async function getInvitations(companyId: string) {
  return db.query.companyInvitations.findMany({
    where: and(
      eq(companyInvitations.companyId, companyId),
      eq(companyInvitations.status, 'PENDING'),
    ),
    orderBy: [desc(companyInvitations.createdAt)],
  })
}

export async function sendInvitation(
  companyId: string,
  email: string,
  role: 'ADMIN' | 'MEMBER',
  invitedBy: string,
  companyName: string,
) {
  const normalizedEmail = email.toLowerCase().trim()

  // Check for existing pending invitation to same email
  const existing = await db.query.companyInvitations.findFirst({
    where: and(
      eq(companyInvitations.companyId, companyId),
      eq(companyInvitations.email, normalizedEmail),
      eq(companyInvitations.status, 'PENDING'),
    ),
  })
  if (existing) throw new Error('Invitation already pending')

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

  const [invitation] = await db
    .insert(companyInvitations)
    .values({ companyId, email: normalizedEmail, role, invitedBy, expiresAt })
    .returning()

  // Send invitation email via Supabase auth admin
  const frontendUrl = (process.env.FRONTEND_URL ?? 'http://localhost:5173').trim().replace(/\/$/, '')
  const redirectTo  = `${frontendUrl}/invitation/accept?token=${invitation.token}`

  const { data: inviteData, error } = await supabase.auth.admin.inviteUserByEmail(normalizedEmail, {
    redirectTo,
    data: { invitation_token: invitation.token, company_name: companyName },
  })

  if (error) {
    console.error('[sendInvitation] Supabase error — status:', error.status, '— message:', error.message)

    // Si l'utilisateur existe déjà dans Supabase (compte confirmé),
    // inviteUserByEmail échoue. On lui envoie un magic link à la place.
    if (
      error.message?.toLowerCase().includes('already registered') ||
      error.message?.toLowerCase().includes('already been invited') ||
      error.message?.toLowerCase().includes('user already exists') ||
      error.status === 422
    ) {
      const { data: linkData, error: mlError } = await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email: normalizedEmail,
        options: {
          redirectTo,
          data: { invitation_token: invitation.token, company_name: companyName },
        },
      })
      if (mlError) {
        await db.delete(companyInvitations).where(eq(companyInvitations.id, invitation.id))
        throw new Error(`Email sending failed: ${mlError.message}`)
      }
      // Magic link généré — on l'envoie via Resend (ou log en dev si pas de clé)
      const magicLink = linkData?.properties?.action_link ?? redirectTo
      await sendInvitationEmail({ to: normalizedEmail, companyName, magicLink })
      return invitation
    }

    // Roll back the invitation record if email sending failed
    await db.delete(companyInvitations).where(eq(companyInvitations.id, invitation.id))
    throw new Error(`Email sending failed: ${error.message}`)
  }

  console.log('[sendInvitation] Invite sent successfully to', normalizedEmail, inviteData?.user?.id)

  return invitation
}

export async function getInvitationByToken(token: string) {
  const invitation = await db.query.companyInvitations.findFirst({
    where: eq(companyInvitations.token, token),
  })
  if (!invitation) return null

  const company = await db.query.companies.findFirst({
    where: eq(companies.id, invitation.companyId),
  })

  return { ...invitation, company }
}

export async function acceptInvitation(token: string, userId: string) {
  const invitation = await db.query.companyInvitations.findFirst({
    where: and(
      eq(companyInvitations.token, token),
      eq(companyInvitations.status, 'PENDING'),
    ),
  })

  if (!invitation)              throw new Error('Invitation not found')
  if (new Date() > invitation.expiresAt) throw new Error('Invitation expired')

  // Add user as member (throws if already a member)
  await addMember(invitation.companyId, userId, invitation.role)

  // Mark invitation as accepted
  await db
    .update(companyInvitations)
    .set({ status: 'ACCEPTED' })
    .where(eq(companyInvitations.token, token))

  return invitation
}

export async function cancelInvitation(companyId: string, invitationId: string) {
  const [updated] = await db
    .update(companyInvitations)
    .set({ status: 'CANCELLED' })
    .where(and(
      eq(companyInvitations.id, invitationId),
      eq(companyInvitations.companyId, companyId),
    ))
    .returning()
  return updated
}

// ── Numérotation des factures ─────────────────────────────────────────────────

/**
 * Retourne le prochain numéro de facture pour l'année en cours.
 * Si aucune séquence n'existe, le premier sera 1.
 */
export async function getInvoiceSequence(companyId: string) {
  const year = new Date().getFullYear()
  const [row] = await db
    .select({ lastSeq: invoiceSequences.lastSeq })
    .from(invoiceSequences)
    .where(and(
      eq(invoiceSequences.companyId, companyId),
      eq(invoiceSequences.year, year),
    ))
  return { year, nextNumber: (row?.lastSeq ?? 0) + 1 }
}

/**
 * Définit le numéro de départ des factures pour l'année en cours.
 * Stocke lastSeq = startNumber - 1 pour que la prochaine facture
 * créée reçoive le numéro startNumber.
 */
export async function setInvoiceStartNumber(companyId: string, startNumber: number) {
  const year = new Date().getFullYear()
  await db
    .insert(invoiceSequences)
    .values({ companyId, year, lastSeq: startNumber - 1 })
    .onConflictDoUpdate({
      target: [invoiceSequences.companyId, invoiceSequences.year],
      set:    { lastSeq: sql`${startNumber - 1}` },
    })
}

export async function resetCompany(companyId: string) {
  // Supprime toutes les données métier dans le bon ordre (FK constraints)
  // clients cascade → projects → invoices automatiquement
  await Promise.all([
    db.delete(clients).where(eq(clients.companyId, companyId)),
    db.delete(expenses).where(eq(expenses.companyId, companyId)),
    db.delete(sales).where(eq(sales.companyId, companyId)),
    db.delete(stockProducts).where(eq(stockProducts.companyId, companyId)),
    db.delete(stockCategories).where(eq(stockCategories.companyId, companyId)),
  ])
}
