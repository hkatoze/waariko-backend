import { db, projects, clients, invoices, invoiceItems, eq, and, isNull, desc } from '@waariko/db'
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
      currency:             projects.currency,
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
      currency:             projects.currency,
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
  status: ProjectStatus; startedAt: Date; completedAt: Date; currency: string
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

/**
 * Copie un projet (et ses proformas) vers un client cible.
 * Le nouveau projet est en statut DRAFT, les factures copiées sont de type PROFORMA.
 * Les numéros de facture ne sont pas copiés (ils seront auto-générés à la première sauvegarde).
 */
export async function copyProject(
  companyId: string,
  sourceProjectId: string,
  targetClientId: string,
) {
  // 1. Récupérer le projet source
  const source = await getProject(companyId, sourceProjectId)
  if (!source) throw new Error('Projet source introuvable')

  // 2. Créer le nouveau projet (DRAFT, client cible)
  const [newProject] = await db.insert(projects).values({
    companyId,
    clientId:    targetClientId,
    name:        `${source.name} (Copie)`,
    description: source.description ?? undefined,
    currency:    source.currency    ?? undefined,
    status:      'DRAFT',
  }).returning()

  // 3. Récupérer les proformas du projet source (non supprimées)
  const sourceInvoices = await db
    .select()
    .from(invoices)
    .where(and(
      eq(invoices.projectId, sourceProjectId),
      eq(invoices.type, 'PROFORMA'),
      isNull(invoices.deletedAt),
    ))

  // 4. Pour chaque proforma : copier + copier ses items
  for (const inv of sourceInvoices) {
    const [newInv] = await db.insert(invoices).values({
      companyId,
      projectId:      newProject.id,
      clientId:       targetClientId,
      type:           'PROFORMA',
      category:       inv.category       ?? 'STANDARD',
      subtotal:       inv.subtotal       ?? '0',
      discountAmount: inv.discountAmount ?? '0',
      discountRate:   inv.discountRate   ?? undefined,
      taxRate:        inv.taxRate        ?? undefined,
      taxAmount:      inv.taxAmount      ?? '0',
      total:          inv.total          ?? '0',
      paymentModality:inv.paymentModality?? '0',
      notes:          inv.notes          ?? undefined,
      // number/reference/settlementType non copiés (état frais)
    }).returning()

    // Copier les items de la facture
    const srcItems = await db
      .select()
      .from(invoiceItems)
      .where(eq(invoiceItems.invoiceId, inv.id))

    if (srcItems.length > 0) {
      await db.insert(invoiceItems).values(
        srcItems.map(it => ({
          invoiceId:   newInv.id,
          description: it.description,
          quantity:    it.quantity,
          unitPrice:   it.unitPrice,
          total:       it.total,
        }))
      )
    }
  }

  // 5. Synchroniser le statut du projet selon les factures copiées
  if (sourceInvoices.length > 0) {
    const [updated] = await db
      .update(projects)
      .set({ status: 'IN_PROGRESS', updatedAt: new Date() })
      .where(eq(projects.id, newProject.id))
      .returning()
    return updated
  }

  return newProject
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
