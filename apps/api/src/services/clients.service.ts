import { db, clients, eq, and, isNull } from '@waariko/db'
import type { ClientType } from '@waariko/types'

export async function getClients(companyId: string, includeDeleted = false) {
  return db.query.clients.findMany({
    where: includeDeleted
      ? eq(clients.companyId, companyId)
      : and(eq(clients.companyId, companyId), isNull(clients.deletedAt)),
    orderBy: (c, { desc }) => desc(c.createdAt),
  })
}

export async function getClient(companyId: string, clientId: string) {
  return db.query.clients.findFirst({
    where: and(eq(clients.companyId, companyId), eq(clients.id, clientId)),
  })
}

export async function createClient(companyId: string, data: {
  type: ClientType
  name: string
  countryCode: string
  sector?: string
  email?: string
  address?: string
  legalInfo?: string
  internalContactName?: string
  internalContactEmail?: string
  internalContactPhone?: string
  internalContactJobTitle?: string
}) {
  const [client] = await db.insert(clients).values({ ...data, companyId }).returning()
  return client
}

export async function updateClient(companyId: string, clientId: string, data: Partial<{
  type: ClientType; name: string; countryCode: string; sector: string; email: string
  address: string; legalInfo: string; internalContactName: string; internalContactEmail: string
  internalContactPhone: string; internalContactJobTitle: string
}>) {
  const [updated] = await db
    .update(clients)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(clients.companyId, companyId), eq(clients.id, clientId)))
    .returning()

  return updated
}

export async function softDeleteClient(companyId: string, clientId: string, deletedBy?: string) {
  const [updated] = await db
    .update(clients)
    .set({ deletedAt: new Date(), deletedBy, updatedAt: new Date() })
    .where(and(eq(clients.companyId, companyId), eq(clients.id, clientId)))
    .returning()

  return updated
}

export async function restoreClient(companyId: string, clientId: string) {
  const [updated] = await db
    .update(clients)
    .set({ deletedAt: null, deletedBy: null, updatedAt: new Date() })
    .where(and(eq(clients.companyId, companyId), eq(clients.id, clientId)))
    .returning()

  return updated
}
