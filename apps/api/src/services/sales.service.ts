import { db, sales, saleItems, stockProducts, eq, and, isNull, desc, sql } from '@waariko/db'

// ── Types ─────────────────────────────────────────────────────────────────────

interface CreateSaleItemInput {
  productId:   string | null
  designation: string
  quantity:    number
  unitPrice:   number
}

interface CreateSaleInput {
  clientName:     string
  items:          CreateSaleItemInput[]
  discountAmount: number
  taxRate:        number
  saleType:       'NORMAL' | 'CREDIT'
  depositAmount:  number
}

// ── List ──────────────────────────────────────────────────────────────────────

export async function getSales(companyId: string, opts?: { dateFrom?: string; dateTo?: string }) {
  const rows = await db
    .select()
    .from(sales)
    .where(and(eq(sales.companyId, companyId), isNull(sales.deletedAt)))
    .orderBy(desc(sales.createdAt))

  // Date filters (post-query for simplicity)
  if (opts?.dateFrom || opts?.dateTo) {
    return rows.filter(s => {
      const d = new Date(s.saleDate).getTime()
      if (opts.dateFrom && d < new Date(opts.dateFrom).getTime()) return false
      if (opts.dateTo   && d > new Date(opts.dateTo).getTime())   return false
      return true
    })
  }
  return rows
}

export async function getSaleWithItems(companyId: string, saleId: string) {
  const [sale] = await db
    .select()
    .from(sales)
    .where(and(eq(sales.companyId, companyId), eq(sales.id, saleId), isNull(sales.deletedAt)))

  if (!sale) return null

  const items = await db
    .select()
    .from(saleItems)
    .where(eq(saleItems.saleId, saleId))

  return { ...sale, items }
}

// ── Create ────────────────────────────────────────────────────────────────────

export async function createSale(companyId: string, input: CreateSaleInput) {
  const subtotal       = input.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
  const discounted     = subtotal - input.discountAmount
  const taxAmount      = Math.round(discounted * input.taxRate / 100)
  const total          = discounted + taxAmount
  const status         = input.depositAmount >= total ? 'SETTLED' : 'PENDING'

  // Generate reference: VTE-YYYYMM-XXXX (based on count)
  const [{ cnt }] = await db.select({ cnt: sql<number>`count(*)::int` }).from(sales).where(eq(sales.companyId, companyId))
  const now = new Date()
  const ref = `VTE-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${String(cnt + 1).padStart(4, '0')}`

  const [sale] = await db
    .insert(sales)
    .values({
      companyId,
      clientName:     input.clientName,
      reference:      ref,
      discountAmount: String(input.discountAmount),
      taxRate:        String(input.taxRate),
      taxAmount:      String(taxAmount),
      subtotal:       String(subtotal),
      total:          String(total),
      saleType:       input.saleType,
      depositAmount:  String(input.depositAmount),
      status:         status as 'PENDING' | 'SETTLED',
    })
    .returning()

  // Insert items
  if (input.items.length > 0) {
    await db.insert(saleItems).values(
      input.items.map(item => ({
        saleId:      sale.id,
        productId:   item.productId ?? null,
        designation: item.designation,
        quantity:    item.quantity,
        unitPrice:   String(item.unitPrice),
        total:       String(Math.round(item.quantity * item.unitPrice)),
      }))
    )
  }

  // Decrement stock quantities for products sold
  for (const item of input.items) {
    if (item.productId) {
      const [product] = await db
        .select({ quantity: stockProducts.quantity })
        .from(stockProducts)
        .where(eq(stockProducts.id, item.productId))

      if (product) {
        const newQty = Math.max(0, product.quantity - item.quantity)
        await db
          .update(stockProducts)
          .set({ quantity: newQty, updatedAt: new Date() })
          .where(eq(stockProducts.id, item.productId))
      }
    }
  }

  return sale
}

// ── Update client name ────────────────────────────────────────────────────────

export async function updateSaleClientName(companyId: string, saleId: string, clientName: string) {
  const [row] = await db
    .update(sales)
    .set({ clientName, updatedAt: new Date() })
    .where(and(eq(sales.companyId, companyId), eq(sales.id, saleId), isNull(sales.deletedAt)))
    .returning()
  return row
}

// ── Update status ─────────────────────────────────────────────────────────────

export async function updateSaleStatus(companyId: string, saleId: string, status: 'PENDING' | 'SETTLED') {
  const [row] = await db
    .update(sales)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(sales.companyId, companyId), eq(sales.id, saleId)))
    .returning()
  return row
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteSale(companyId: string, saleId: string) {
  await db
    .update(sales)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(sales.companyId, companyId), eq(sales.id, saleId)))
}
