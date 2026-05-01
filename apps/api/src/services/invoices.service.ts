import { db, invoices, invoiceItems, invoiceSequences, clients, projects, eq, and, isNull, desc, sql } from '@waariko/db'
import type { InvoiceType, InvoiceCategory, SettlementType } from '@waariko/types'

// ── Numérotation automatique ──────────────────────────────────────────────────

/** Préfixes par type de facture */
const TYPE_PREFIX: Record<InvoiceType, string> = {
  PROFORMA:      'PRO',
  FINAL:         'FAC',
  DELIVERY_NOTE: 'BL',
}

/**
 * Incrémente atomiquement le compteur de l'entreprise pour l'année en cours
 * et retourne la nouvelle valeur (safe contre les accès concurrents).
 */
async function nextInvoiceSeq(companyId: string): Promise<number> {
  const year = new Date().getFullYear()

  const [row] = await db
    .insert(invoiceSequences)
    .values({ companyId, year, lastSeq: 1 })
    .onConflictDoUpdate({
      target:  [invoiceSequences.companyId, invoiceSequences.year],
      set:     { lastSeq: sql`${invoiceSequences.lastSeq} + 1` },
    })
    .returning({ lastSeq: invoiceSequences.lastSeq })

  return row.lastSeq
}

/**
 * Formate un numéro de facture.
 * Ex. : formatInvoiceNumber('PROFORMA', 2026, 3) → "PRO-2026-0003"
 */
function formatInvoiceNumber(type: InvoiceType, year: number, seq: number): string {
  return `${TYPE_PREFIX[type]}-${year}-${seq.toString().padStart(4, '0')}`
}

/**
 * Génère un nouveau numéro si aucun séquence n'est fourni,
 * ou formate un numéro existant (héritage proforma → final/BL).
 */
async function generateInvoiceNumber(
  companyId: string,
  type:      InvoiceType,
  seq?:      number,
): Promise<string> {
  const year       = new Date().getFullYear()
  const sequence   = seq ?? await nextInvoiceSeq(companyId)
  return formatInvoiceNumber(type, year, sequence)
}

/**
 * Extrait la valeur numérique d'un numéro formaté.
 * "PRO-2026-0003" → 3
 */
function extractSeq(number: string | null | undefined): number | undefined {
  if (!number) return undefined
  const parts = number.split('-')
  const n = parseInt(parts[parts.length - 1], 10)
  return isNaN(n) ? undefined : n
}

export async function getInvoices(companyId: string, includeDeleted = false) {
  return db
    .select({
      id:             invoices.id,
      companyId:      invoices.companyId,
      projectId:      invoices.projectId,
      clientId:       invoices.clientId,
      type:           invoices.type,
      category:       invoices.category,
      number:         invoices.number,
      reference:      invoices.reference,
      subtotal:       invoices.subtotal,
      discountAmount: invoices.discountAmount,
      discountRate:   invoices.discountRate,
      taxRate:        invoices.taxRate,
      taxAmount:      invoices.taxAmount,
      total:          invoices.total,
      paymentModality:invoices.paymentModality,
      issuedAt:       invoices.issuedAt,
      dueDate:        invoices.dueDate,
      settlementType: invoices.settlementType,
      notes:          invoices.notes,
      internalNote:   invoices.internalNote,
      deletedAt:      invoices.deletedAt,
      createdAt:      invoices.createdAt,
      updatedAt:      invoices.updatedAt,
      client:  { id: clients.id,  name: clients.name  },
      project: { id: projects.id, name: projects.name },
    })
    .from(invoices)
    .leftJoin(clients,  eq(invoices.clientId,  clients.id))
    .leftJoin(projects, eq(invoices.projectId, projects.id))
    .where(
      includeDeleted
        ? eq(invoices.companyId, companyId)
        : and(eq(invoices.companyId, companyId), isNull(invoices.deletedAt))
    )
    .orderBy(desc(invoices.createdAt))
}

export async function getInvoice(companyId: string, invoiceId: string) {
  const [row] = await db
    .select({
      id:             invoices.id,
      companyId:      invoices.companyId,
      projectId:      invoices.projectId,
      clientId:       invoices.clientId,
      type:           invoices.type,
      category:       invoices.category,
      number:         invoices.number,
      reference:      invoices.reference,
      subtotal:       invoices.subtotal,
      discountAmount: invoices.discountAmount,
      discountRate:   invoices.discountRate,
      taxRate:        invoices.taxRate,
      taxAmount:      invoices.taxAmount,
      total:          invoices.total,
      paymentModality:invoices.paymentModality,
      issuedAt:       invoices.issuedAt,
      dueDate:        invoices.dueDate,
      settlementType: invoices.settlementType,
      notes:          invoices.notes,
      internalNote:   invoices.internalNote,
      deletedAt:      invoices.deletedAt,
      createdAt:      invoices.createdAt,
      updatedAt:      invoices.updatedAt,
      client: {
        id:      clients.id,
        name:    clients.name,
        address: clients.address,
        email:   clients.email,
        phone:   clients.internalContactPhone,
      },
      project: { id: projects.id, name: projects.name },
    })
    .from(invoices)
    .leftJoin(clients,  eq(invoices.clientId,  clients.id))
    .leftJoin(projects, eq(invoices.projectId, projects.id))
    .where(and(eq(invoices.companyId, companyId), eq(invoices.id, invoiceId)))
    .limit(1)

  if (!row) return null

  const items = await db
    .select()
    .from(invoiceItems)
    .where(eq(invoiceItems.invoiceId, invoiceId))

  return { ...row, items }
}

// ── Synchronise le statut du projet selon ses factures ───────────────────────
async function syncProjectStatus(projectId: string) {
  const rows = await db
    .select({ type: invoices.type })
    .from(invoices)
    .where(and(eq(invoices.projectId, projectId), isNull(invoices.deletedAt)))

  const types = rows.map(r => r.type)

  let status: 'DRAFT' | 'IN_PROGRESS' | 'VALIDATED' | 'COMPLETED'
  if (types.length === 0) {
    status = 'DRAFT'
  } else if (types.includes('FINAL')) {
    status = 'VALIDATED'
  } else {
    status = 'IN_PROGRESS'
  }

  await db
    .update(projects)
    .set({ status, updatedAt: new Date() })
    .where(eq(projects.id, projectId))
}

export async function createInvoice(
  companyId: string,
  data: {
    projectId:      string
    clientId:       string
    type:           InvoiceType
    category?:      InvoiceCategory
    reference?:     string
    subtotal?:      string
    discountAmount?: string
    discountRate?:  string
    taxRate?:       string
    taxAmount?:     string
    total?:         string
    paymentModality?: string
    dueDate?:       Date
    settlementType?: SettlementType
    notes?:         string
    internalNote?:  string
    items: { description: string; quantity: string; unitPrice: string; total: string }[]
  },
  /** Séquence à réutiliser (FINAL/DELIVERY_NOTE héritent de la proforma) */
  seq?: number,
) {
  const { items, ...invoiceData } = data
  const number = await generateInvoiceNumber(companyId, data.type, seq)

  const [invoice] = await db
    .insert(invoices)
    .values({ ...invoiceData, companyId, number })
    .returning()

  if (items.length > 0) {
    await db.insert(invoiceItems).values(
      items.map(item => ({ ...item, invoiceId: invoice.id }))
    )
  }

  // Sync statut projet après toute création de facture
  await syncProjectStatus(data.projectId)

  return getInvoice(companyId, invoice.id)
}

export async function updateInvoice(companyId: string, invoiceId: string, data: Partial<{
  category: InvoiceCategory; reference: string; subtotal: string; discountAmount: string
  discountRate: string; taxRate: string; taxAmount: string; total: string
  paymentModality: string; issuedAt: Date; dueDate: Date; settlementType: SettlementType
  notes: string; internalNote: string
}>) {
  const [updated] = await db
    .update(invoices)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(invoices.companyId, companyId), eq(invoices.id, invoiceId)))
    .returning()

  return updated
}

export async function softDeleteInvoice(companyId: string, invoiceId: string, deletedBy?: string) {
  const [updated] = await db
    .update(invoices)
    .set({ deletedAt: new Date(), deletedBy, updatedAt: new Date() })
    .where(and(eq(invoices.companyId, companyId), eq(invoices.id, invoiceId)))
    .returning()

  return updated
}

export async function restoreInvoice(companyId: string, invoiceId: string) {
  const [updated] = await db
    .update(invoices)
    .set({ deletedAt: null, deletedBy: null, updatedAt: new Date() })
    .where(and(eq(invoices.companyId, companyId), eq(invoices.id, invoiceId)))
    .returning()

  return updated
}

export async function validateProforma(companyId: string, invoiceId: string) {
  const proforma = await getInvoice(companyId, invoiceId)
  if (!proforma) throw new Error('Invoice not found')
  if (proforma.type !== 'PROFORMA') throw new Error('Only a proforma can be validated')

  const itemsData = proforma.items.map((it: {
    description: string; quantity: string; unitPrice: string; total: string
  }) => ({
    description: it.description,
    quantity:    it.quantity,
    unitPrice:   it.unitPrice,
    total:       it.total,
  }))

  const base = {
    projectId:      proforma.projectId,
    clientId:       proforma.clientId,
    category:       proforma.category ?? undefined,
    subtotal:       proforma.subtotal  ?? undefined,
    discountAmount: proforma.discountAmount ?? undefined,
    discountRate:   proforma.discountRate   ?? undefined,
    taxRate:        proforma.taxRate   ?? undefined,
    taxAmount:      proforma.taxAmount ?? undefined,
    total:          proforma.total     ?? undefined,
    notes:          proforma.notes     ?? undefined,
    items:          itemsData,
  }

  // FINAL et DELIVERY_NOTE partagent le même numéro de séquence que la proforma
  const proformaSeq = extractSeq(proforma.number)

  const [finalInvoice, deliveryNote] = await Promise.all([
    createInvoice(companyId, { ...base, type: 'FINAL' },         proformaSeq),
    createInvoice(companyId, { ...base, type: 'DELIVERY_NOTE' }, proformaSeq),
  ])

  // createInvoice appelle syncProjectStatus → statut → VALIDATED
  return { finalInvoice, deliveryNote }
}
