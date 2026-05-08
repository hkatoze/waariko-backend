import { db, projects, clients, invoices, eq, and, isNull, desc } from '@waariko/db'
import type { ProjectStatus } from '@waariko/types'

export async function getProjects(companyId: string, includeDeleted = false) {
  const rows = await db
    .select({
      id:                   projects.id,
      name:                 projects.name,
      status:               projects.status,
      description:          projects.description,
      companyId:            projects.companyId,
      clientId:             projects.clientId,
      startedAt:            projects.startedAt,
      completedAt:          projects.completedAt,
      depositPaidAt:        projects.depositPaidAt,
      depositSettlementType:projects.depositSettlementType,
      deletedAt:            projects.deletedAt,
      createdAt:            projects.createdAt,
      updatedAt:            projects.updatedAt,
      client: {
        id:   clients.id,
        name: clients.name,
        type: clients.type,
      },
    })
    .from(projects)
    .leftJoin(clients, eq(projects.clientId, clients.id))
    .where(
      includeDeleted
        ? eq(projects.companyId, companyId)
        : and(eq(projects.companyId, companyId), isNull(projects.deletedAt))
    )
    .orderBy(desc(projects.createdAt))

  return rows
}

export async function getProject(companyId: string, projectId: string) {
  const [row] = await db
    .select({
      id:                   projects.id,
      name:                 projects.name,
      status:               projects.status,
      description:          projects.description,
      companyId:            projects.companyId,
      clientId:             projects.clientId,
      startedAt:            projects.startedAt,
      completedAt:          projects.completedAt,
      depositPaidAt:        projects.depositPaidAt,
      depositSettlementType:projects.depositSettlementType,
      deletedAt:            projects.deletedAt,
      createdAt:            projects.createdAt,
      updatedAt:            projects.updatedAt,
      client: {
        id:   clients.id,
        name: clients.name,
        type: clients.type,
      },
    })
    .from(projects)
    .leftJoin(clients, eq(projects.clientId, clients.id))
    .where(and(eq(projects.companyId, companyId), eq(projects.id, projectId)))
    .limit(1)

  return row ?? null
}

export async function createProject(companyId: string, data: {
  name: string
  clientId: string
  description?: string
  status?: ProjectStatus
  startedAt?: Date
}) {
  const [project] = await db.insert(projects).values({ ...data, companyId }).returning()
  return project
}

export async function updateProject(companyId: string, projectId: string, data: Partial<{
  name: string; clientId: string; description: string
  status: ProjectStatus; startedAt: Date; completedAt: Date
}>) {
  const [updated] = await db
    .update(projects)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(projects.companyId, companyId), eq(projects.id, projectId)))
    .returning()

  return updated
}

export async function softDeleteProject(companyId: string, projectId: string, deletedBy?: string) {
  const [updated] = await db
    .update(projects)
    .set({ deletedAt: new Date(), deletedBy, updatedAt: new Date() })
    .where(and(eq(projects.companyId, companyId), eq(projects.id, projectId)))
    .returning()

  return updated
}

export async function restoreProject(companyId: string, projectId: string) {
  const [updated] = await db
    .update(projects)
    .set({ deletedAt: null, deletedBy: null, updatedAt: new Date() })
    .where(and(eq(projects.companyId, companyId), eq(projects.id, projectId)))
    .returning()

  return updated
}

export async function recordFirstPayment(
  companyId: string,
  projectId: string,
  settlementType: 'BANK_TRANSFER' | 'CASH' | 'CHECK' | 'MOBILE_MONEY',
) {
  // 1. Enregistrer le premier versement sur le projet
  const [project] = await db
    .update(projects)
    .set({ depositPaidAt: new Date(), depositSettlementType: settlementType, updatedAt: new Date() })
    .where(and(eq(projects.companyId, companyId), eq(projects.id, projectId)))
    .returning()

  // 2. Marquer la facture FINAL comme partiellement encaissée (settlementType = mode de paiement)
  //    → permet à la balance finances de comptabiliser le paymentModality (montant acompte)
  await db
    .update(invoices)
    .set({ settlementType, updatedAt: new Date() })
    .where(
      and(
        eq(invoices.companyId, companyId),
        eq(invoices.projectId, projectId),
        eq(invoices.type, 'FINAL'),
        isNull(invoices.deletedAt),
      )
    )

  return project
}

export async function completeProject(
  companyId: string,
  projectId: string,
  settlementType: 'BANK_TRANSFER' | 'CASH' | 'CHECK' | 'MOBILE_MONEY',
) {
  // 1. Marquer le projet comme terminé
  const [project] = await db
    .update(projects)
    .set({ status: 'COMPLETED', completedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(projects.companyId, companyId), eq(projects.id, projectId)))
    .returning()

  // 2. Mettre à jour le settlementType sur la facture FINAL liée
  await db
    .update(invoices)
    .set({ settlementType, updatedAt: new Date() })
    .where(
      and(
        eq(invoices.companyId, companyId),
        eq(invoices.projectId, projectId),
        eq(invoices.type, 'FINAL'),
        isNull(invoices.deletedAt),
      )
    )

  return project
}
