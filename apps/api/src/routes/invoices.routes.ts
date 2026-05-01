import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { authMiddleware } from '../middleware/auth.middleware'
import { companyMiddleware } from '../middleware/company.middleware'
import * as invoicesService from '../services/invoices.service'
import type { AppEnv } from '../lib/types'

const app = new Hono<AppEnv>()

const invoiceItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.string().regex(/^\d+(\.\d{1,2})?$/),
  unitPrice: z.string().regex(/^\d+(\.\d{1,2})?$/),
  total: z.string().regex(/^\d+(\.\d{1,2})?$/),
})

const amountField = z.string().regex(/^\d+(\.\d{1,2})?$/).optional()

const createInvoiceSchema = z.object({
  type: z.enum(['PROFORMA', 'FINAL', 'DELIVERY_NOTE']),
  projectId: z.string().uuid(),
  clientId: z.string().uuid(),
  category: z.enum(['STANDARD', 'DEPOSIT', 'BALANCE']).optional(),
  reference: z.string().optional(),
  subtotal: amountField,
  discountAmount: amountField,
  discountRate: amountField,
  taxRate: amountField,
  taxAmount: amountField,
  total: amountField,
  paymentModality: amountField,
  dueDate: z.string().datetime().optional().transform(v => v ? new Date(v) : undefined),
  settlementType: z.enum(['BANK_TRANSFER', 'CASH', 'CHECK', 'MOBILE_MONEY']).optional(),
  notes: z.string().optional(),
  internalNote: z.string().optional(),
  items: z.array(invoiceItemSchema).min(1),
})

const updateInvoiceSchema = z.object({
  category: z.enum(['STANDARD', 'DEPOSIT', 'BALANCE']).optional(),
  reference: z.string().optional(),
  subtotal: amountField,
  discountAmount: amountField,
  discountRate: amountField,
  taxRate: amountField,
  taxAmount: amountField,
  total: amountField,
  paymentModality: amountField,
  issuedAt: z.string().datetime().optional().transform(v => v ? new Date(v) : undefined),
  dueDate: z.string().datetime().optional().transform(v => v ? new Date(v) : undefined),
  settlementType: z.enum(['BANK_TRANSFER', 'CASH', 'CHECK', 'MOBILE_MONEY']).optional(),
  notes: z.string().optional(),
  internalNote: z.string().optional(),
})

app.use(authMiddleware)
app.use(companyMiddleware)

app.get('/', async (c) => {
  const companyId = c.get('companyId')
  const includeDeleted = c.req.query('includeDeleted') === 'true'
  const data = await invoicesService.getInvoices(companyId, includeDeleted)
  return c.json({ data })
})

app.post('/', zValidator('json', createInvoiceSchema), async (c) => {
  const companyId = c.get('companyId')
  const invoice = await invoicesService.createInvoice(companyId, c.req.valid('json'))
  return c.json({ data: invoice }, 201)
})

app.get('/:id', async (c) => {
  const companyId = c.get('companyId')
  const invoice = await invoicesService.getInvoice(companyId, c.req.param('id'))
  if (!invoice) return c.json({ error: 'Not found' }, 404)
  return c.json({ data: invoice })
})

app.patch('/:id', zValidator('json', updateInvoiceSchema), async (c) => {
  const companyId = c.get('companyId')
  const invoice = await invoicesService.updateInvoice(companyId, c.req.param('id'), c.req.valid('json'))
  if (!invoice) return c.json({ error: 'Not found' }, 404)
  return c.json({ data: invoice })
})

app.delete('/:id', async (c) => {
  const companyId = c.get('companyId')
  const user = c.get('user')
  const invoice = await invoicesService.softDeleteInvoice(companyId, c.req.param('id'), user.id)
  if (!invoice) return c.json({ error: 'Not found' }, 404)
  return c.json({ data: invoice })
})

app.post('/:id/restore', async (c) => {
  const companyId = c.get('companyId')
  const invoice = await invoicesService.restoreInvoice(companyId, c.req.param('id'))
  if (!invoice) return c.json({ error: 'Not found' }, 404)
  return c.json({ data: invoice })
})

app.post('/:id/validate', async (c) => {
  const companyId = c.get('companyId')
  try {
    const result = await invoicesService.validateProforma(companyId, c.req.param('id'))
    return c.json({ data: result })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Validation failed'
    return c.json({ error: msg }, 400)
  }
})

export default app
