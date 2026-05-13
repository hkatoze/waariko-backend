import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { authMiddleware } from '../middleware/auth.middleware'
import { companyMiddleware } from '../middleware/company.middleware'
import * as svc from '../services/expenses.service'
import type { AppEnv } from '../lib/types'

const app = new Hono<AppEnv>()

app.use('*', authMiddleware)
app.use('*', companyMiddleware)

const amountField = z.string().regex(/^\d+(\.\d{1,2})?$/).optional()

const createSchema = z.object({
  title:       z.string().min(1),
  amount:      z.string().regex(/^\d+(\.\d{1,2})?$/),
  expenseDate: z.string(),
  projectId:   z.string().uuid().optional().nullable(),
  type:        z.string().optional(),
  status:      z.enum(['IN_PROGRESS', 'COMPLETED']).optional(),
  isRecurring: z.boolean().optional(),
  notes:       z.string().optional(),
  taxRate:     amountField,
  taxAmount:   amountField,
})

// GET /expenses
app.get('/', async (c) => {
  const companyId = c.get('companyId')
  const { from, to } = c.req.query()
  const data = await svc.getExpenses(companyId, { from, to })
  return c.json({ data })
})

const updateSchema = z.object({
  title:       z.string().min(1).optional(),
  amount:      z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  expenseDate: z.string().optional(),
  projectId:   z.string().uuid().optional().nullable(),
  type:        z.string().optional(),
  status:      z.enum(['IN_PROGRESS', 'COMPLETED']).optional(),
  isRecurring: z.boolean().optional(),
  notes:       z.string().optional(),
  taxRate:     amountField,
  taxAmount:   amountField,
})

// POST /expenses
app.post('/', zValidator('json', createSchema), async (c) => {
  const companyId = c.get('companyId')
  const body = c.req.valid('json')
  const expense = await svc.createExpense(companyId, {
    ...body,
    expenseDate: new Date(body.expenseDate),
  })
  return c.json({ data: expense }, 201)
})

// PATCH /expenses/:id
app.patch('/:id', zValidator('json', updateSchema), async (c) => {
  const companyId = c.get('companyId')
  const expenseId = c.req.param('id')
  const { expenseDate, ...rest } = c.req.valid('json')
  const data = {
    ...rest,
    ...(expenseDate ? { expenseDate: new Date(expenseDate) } : {}),
  }
  const expense = await svc.updateExpense(companyId, expenseId, data)
  return c.json({ data: expense })
})

// DELETE /expenses/:id
app.delete('/:id', async (c) => {
  const companyId = c.get('companyId')
  const expenseId = c.req.param('id')
  await svc.deleteExpense(companyId, expenseId)
  return c.json({ success: true })
})

export default app
