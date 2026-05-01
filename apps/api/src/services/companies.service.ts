import { db, companies, companyMembers, eq, and } from '@waariko/db'
import type { MemberRole, CompanyProfile } from '@waariko/types'

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
  primaryColor: string; secondaryColor: string; tertiaryColor: string; logoUrl: string
  signatureUrl: string; headOffice: string; email: string; phonePrimary: string
  phoneSecondary: string; website: string; rccm: string; ifu: string; ifu2: string
  legalStatus: string; bankAccountNumber: string
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

export async function getMembers(companyId: string) {
  return db.query.companyMembers.findMany({
    where: eq(companyMembers.companyId, companyId),
  })
}

export async function addMember(companyId: string, userId: string, role: MemberRole = 'MEMBER') {
  const existing = await db.query.companyMembers.findFirst({
    where: and(eq(companyMembers.companyId, companyId), eq(companyMembers.userId, userId)),
  })

  if (existing) throw new Error('User is already a member')

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
