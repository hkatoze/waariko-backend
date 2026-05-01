import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { authMiddleware }    from '../middleware/auth.middleware'
import { companyMiddleware } from '../middleware/company.middleware'
import * as svc from '../services/sales.service'
import type { AppEnv } from '../lib/types'

const app = new Hono<AppEnv>()
app.use('*', authMiddleware)
app.use('*', companyMiddleware)

// ── List ──────────────────────────────────────────────────────────────────────

app.get('/', async (c) => {
  const { dateFrom, dateTo } = c.req.query()
  const data = await svc.getSales(c.get('companyId'), { dateFrom, dateTo })
  return c.json({ data })
})

// ── Get one ───────────────────────────────────────────────────────────────────

app.get('/:id', async (c) => {
  const data = await svc.getSaleWithItems(c.get('companyId'), c.req.param('id'))
  if (!data) return c.json({ error: 'Not found' }, 404)
  return c.json({ data })
})

// ── Create ────────────────────────────────────────────────────────────────────

app.post('/', zValidator('json', z.object({
  clientName:     z.string().min(1),
  items:          z.array(z.object({
    productId:   z.string().uuid().nullable().optional(),
    designation: z.string().min(1),
    quantity:    z.number().int().min(1),
    unitPrice:   z.number().min(0),
  })).min(1),
  discountAmount: z.number().min(0).default(0),
  taxRate:        z.number().min(0).max(100).default(0),
  saleType:       z.enum(['NORMAL', 'CREDIT']).default('NORMAL'),
  depositAmount:  z.number().min(0).default(0),
})), async (c) => {
  const body = c.req.valid('json')
  const data = await svc.createSale(c.get('companyId'), {
    ...body,
    items: body.items.map(i => ({ ...i, productId: i.productId ?? null })),
  })
  return c.json({ data }, 201)
})

// ── Update client name ────────────────────────────────────────────────────────

app.patch('/:id', zValidator('json', z.object({
  clientName: z.string().min(1),
})), async (c) => {
  const { clientName } = c.req.valid('json')
  const data = await svc.updateSaleClientName(c.get('companyId'), c.req.param('id'), clientName)
  if (!data) return c.json({ error: 'Not found' }, 404)
  return c.json({ data })
})

// ── Update status ─────────────────────────────────────────────────────────────

app.patch('/:id/status', zValidator('json', z.object({
  status: z.enum(['PENDING', 'SETTLED']),
})), async (c) => {
  const { status } = c.req.valid('json')
  const data = await svc.updateSaleStatus(c.get('companyId'), c.req.param('id'), status)
  return c.json({ data })
})

// ── Delete ────────────────────────────────────────────────────────────────────

app.delete('/:id', async (c) => {
  await svc.deleteSale(c.get('companyId'), c.req.param('id'))
  return c.json({ success: true })
})

export default app
