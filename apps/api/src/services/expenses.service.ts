import { db, expenses, projects, eq, and, isNull, desc, sql } from '@waariko/db'

export async function getExpenses(
  companyId: string,
  filters?: { from?: string; to?: string },
) {
  const rows = await db
    .select({
      id:          expenses.id,
      companyId:   expenses.companyId,
      projectId:   expenses.projectId,
      title:       expenses.title,
      amount:      expenses.amount,
      expenseDate: expenses.expenseDate,
      type:        expenses.type,
      status:      expenses.status,
      isRecurring: expenses.isRecurring,
      taxRate:     expenses.taxRate,
      taxAmount:   expenses.taxAmount,
      notes:       expenses.notes,
      createdAt:   expenses.createdAt,
      project: { id: projects.id, name: projects.name },
    })
    .from(expenses)
    .leftJoin(projects, eq(expenses.projectId, projects.id))
    .where(and(eq(expenses.companyId, companyId), isNull(expenses.deletedAt)))
    .orderBy(desc(expenses.expenseDate))

  if (!filters?.from && !filters?.to) return rows

  return rows.filter(r => {
    const d = new Date(r.expenseDate)
    if (filters?.from && d < new Date(filters.from)) return false
    if (filters?.to   && d > new Date(filters.to + 'T23:59:59')) return false
    return true
  })
}

export async function createExpense(companyId: string, data: {
  title:       string
  amount:      string
  expenseDate: Date
  projectId?:  string | null
  type?:       string
  status?:     'IN_PROGRESS' | 'COMPLETED'
  isRecurring?: boolean
  notes?:      string
  taxRate?:    string
  taxAmount?:  string
}) {
  const [row] = await db
    .insert(expenses)
    .values({ ...data, companyId })
    .returning()
  return row
}

export async function updateExpense(companyId: string, expenseId: string, data: Partial<{
  title: string; amount: string; expenseDate: Date
  projectId: string | null; type: string; status: 'IN_PROGRESS' | 'COMPLETED'
  isRecurring: boolean; notes: string; taxRate: string; taxAmount: string
}>) {
  const [row] = await db
    .update(expenses)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(expenses.companyId, companyId), eq(expenses.id, expenseId)))
    .returning()
  return row
}

export async function deleteExpense(companyId: string, expenseId: string) {
  const [row] = await db
    .update(expenses)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(expenses.companyId, companyId), eq(expenses.id, expenseId)))
    .returning()
  return row
}
