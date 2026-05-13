import { db, invoices, sales, expenses, clients, eq, and, isNull } from '@waariko/db'

export type PeriodType = 'month' | 'quarter' | 'semester' | 'year'

function buildRange(year: number, period: PeriodType, offset: number): { du: Date; au: Date; duStr: string; auStr: string } {
  let startMonth: number  // 0-indexed
  let endMonth:   number  // 0-indexed inclusive

  if (period === 'month') {
    // offset = 0-11 (month index)
    startMonth = offset
    endMonth   = offset
  } else if (period === 'quarter') {
    // offset = 0-3 (quarter index)
    startMonth = offset * 3
    endMonth   = startMonth + 2
  } else if (period === 'semester') {
    // offset = 0-1 (semester index)
    startMonth = offset * 6
    endMonth   = startMonth + 5
  } else {
    // full year
    startMonth = 0
    endMonth   = 11
  }

  const du = new Date(year, startMonth, 1)
  const au = new Date(year, endMonth + 1, 0, 23, 59, 59) // last day of endMonth

  const pad = (n: number) => String(n).padStart(2, '0')
  const duStr = `${year}-${pad(startMonth + 1)}-01`
  const auStr = `${au.getFullYear()}-${pad(au.getMonth() + 1)}-${pad(au.getDate())}`

  return { du, au, duStr, auStr }
}

export async function getRapportComptable(
  companyId: string,
  year: number,
  period: PeriodType = 'year',
  offset = 0,
) {
  const { du, au, duStr, auStr } = buildRange(year, period, offset)

  // ── Invoices FINAL non-supprimées ─────────────────────────────────────────
  const allInvoices = await db
    .select({
      id:        invoices.id,
      type:      invoices.type,
      number:    invoices.number,
      issuedAt:  invoices.issuedAt,
      total:     invoices.total,
      taxAmount: invoices.taxAmount,
      deletedAt: invoices.deletedAt,
      clientId:  invoices.clientId,
      clientName: clients.name,
    })
    .from(invoices)
    .leftJoin(clients, eq(invoices.clientId, clients.id))
    .where(and(eq(invoices.companyId, companyId), isNull(invoices.deletedAt)))

  const finalInvoices = allInvoices.filter(inv => {
    if (inv.type !== 'FINAL') return false
    const d = new Date(inv.issuedAt)
    return d >= du && d <= au
  })

  // ── Sales non-supprimées ──────────────────────────────────────────────────
  const allSales = await db
    .select({
      id:         sales.id,
      reference:  sales.reference,
      saleDate:   sales.saleDate,
      total:      sales.total,
      taxAmount:  sales.taxAmount,
      clientName: sales.clientName,
      deletedAt:  sales.deletedAt,
    })
    .from(sales)
    .where(and(eq(sales.companyId, companyId), isNull(sales.deletedAt)))

  const yearSales = allSales.filter(s => {
    const d = new Date(s.saleDate)
    return d >= du && d <= au
  })

  // ── Expenses non-supprimées ───────────────────────────────────────────────
  const allExpenses = await db
    .select({
      id:          expenses.id,
      title:       expenses.title,
      amount:      expenses.amount,
      taxAmount:   expenses.taxAmount,
      expenseDate: expenses.expenseDate,
      type:        expenses.type,
      deletedAt:   expenses.deletedAt,
    })
    .from(expenses)
    .where(and(eq(expenses.companyId, companyId), isNull(expenses.deletedAt)))

  const yearExpenses = allExpenses.filter(e => {
    const d = new Date(e.expenseDate)
    return d >= du && d <= au
  })

  // ── Calculs résultat ──────────────────────────────────────────────────────
  const caFactures = finalInvoices.reduce((s, inv) => s + parseFloat(inv.total ?? '0'), 0)
  const caVentes   = yearSales.reduce((s, sale) => s + parseFloat(sale.total ?? '0'), 0)
  const ca         = caFactures + caVentes
  const charges    = yearExpenses.reduce((s, e) => s + parseFloat(e.amount ?? '0'), 0)
  const resultatNet = ca - charges

  // ── TVA ───────────────────────────────────────────────────────────────────
  const collecteeFactures = finalInvoices.reduce((s, inv) => s + parseFloat(inv.taxAmount ?? '0'), 0)
  const collecteeVentes   = yearSales.reduce((s, sale) => s + parseFloat(sale.taxAmount ?? '0'), 0)
  const collecteeTotale   = collecteeFactures + collecteeVentes
  const deductible        = yearExpenses.reduce((s, e) => s + parseFloat(e.taxAmount ?? '0'), 0)
  const aReverser         = collecteeTotale - deductible

  // ── Journal des ventes ────────────────────────────────────────────────────
  const journalFactures = finalInvoices.map(inv => ({
    date:   new Date(inv.issuedAt).toISOString().slice(0, 10),
    numero: inv.number,
    client: inv.clientName ?? '—',
    ht:     parseFloat(inv.total ?? '0') - parseFloat(inv.taxAmount ?? '0'),
    tva:    parseFloat(inv.taxAmount ?? '0'),
    ttc:    parseFloat(inv.total ?? '0'),
    source: 'FACTURE' as const,
    _ts:    new Date(inv.issuedAt).getTime(),
  }))

  const journalSales = yearSales.map(s => ({
    date:   new Date(s.saleDate).toISOString().slice(0, 10),
    numero: s.reference,
    client: s.clientName,
    ht:     parseFloat(s.total ?? '0') - parseFloat(s.taxAmount ?? '0'),
    tva:    parseFloat(s.taxAmount ?? '0'),
    ttc:    parseFloat(s.total ?? '0'),
    source: 'VENTE' as const,
    _ts:    new Date(s.saleDate).getTime(),
  }))

  const journalVentes = [...journalFactures, ...journalSales]
    .sort((a, b) => a._ts - b._ts)
    .map(({ _ts, ...rest }) => rest)

  // ── Journal des charges ───────────────────────────────────────────────────
  const journalCharges = yearExpenses
    .map(e => ({
      date:    new Date(e.expenseDate).toISOString().slice(0, 10),
      libelle: e.title,
      type:    e.type,
      ht:      parseFloat(e.amount ?? '0') - parseFloat(e.taxAmount ?? '0'),
      tva:     parseFloat(e.taxAmount ?? '0'),
      ttc:     parseFloat(e.amount ?? '0'),
      _ts:     new Date(e.expenseDate).getTime(),
    }))
    .sort((a, b) => a._ts - b._ts)
    .map(({ _ts, ...rest }) => rest)

  return {
    periode: { year, period, offset, du: duStr, au: auStr },
    resultat: { ca, caFactures, caVentes, charges, resultatNet },
    tva: { collecteeFactures, collecteeVentes, collecteeTotale, deductible, aReverser },
    journalVentes,
    journalCharges,
  }
}
