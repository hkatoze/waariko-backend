import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { authMiddleware } from '../middleware/auth.middleware'
import { companyMiddleware } from '../middleware/company.middleware'
import * as svc from '../services/stock.service'
import type { AppEnv } from '../lib/types'

const app = new Hono<AppEnv>()
app.use('*', authMiddleware)
app.use('*', companyMiddleware)

// ── Catégories ────────────────────────────────────────────────────────────────

app.get('/categories', async (c) => {
  const data = await svc.getCategories(c.get('companyId'))
  return c.json({ data })
})

app.post('/categories', zValidator('json', z.object({ name: z.string().min(1) })), async (c) => {
  const { name } = c.req.valid('json')
  const data = await svc.createCategory(c.get('companyId'), name)
  return c.json({ data }, 201)
})

app.patch('/categories/:id', zValidator('json', z.object({ name: z.string().min(1) })), async (c) => {
  const { name } = c.req.valid('json')
  const data = await svc.updateCategory(c.get('companyId'), c.req.param('id'), name)
  return c.json({ data })
})

app.delete('/categories/:id', async (c) => {
  await svc.deleteCategory(c.get('companyId'), c.req.param('id'))
  return c.json({ success: true })
})

// ── Produits ──────────────────────────────────────────────────────────────────

app.get('/products', async (c) => {
  const { categoryId } = c.req.query()
  const data = await svc.getProducts(c.get('companyId'), categoryId)
  return c.json({ data })
})

app.post('/products', zValidator('json', z.object({
  categoryId: z.string().uuid().nullable().optional(),
  items: z.array(z.object({
    name:          z.string().min(1),
    purchasePrice: z.string().regex(/^\d+(\.\d{1,2})?$/),
    salePrice:     z.string().regex(/^\d+(\.\d{1,2})?$/),
    quantity:      z.number().int().min(0),
  })).min(1),
})), async (c) => {
  const { categoryId = null, items } = c.req.valid('json')
  const data = await svc.createProducts(c.get('companyId'), categoryId, items)
  return c.json({ data }, 201)
})

app.patch('/products/:id', async (c) => {
  const body = await c.req.json()
  const data = await svc.updateProduct(c.get('companyId'), c.req.param('id'), body)
  return c.json({ data })
})

app.delete('/products/:id', async (c) => {
  await svc.deleteProduct(c.get('companyId'), c.req.param('id'))
  return c.json({ success: true })
})

export default app
