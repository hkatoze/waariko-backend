import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import companies from './routes/companies.routes'
import clients from './routes/clients.routes'
import projects from './routes/projects.routes'
import invoices from './routes/invoices.routes'
import expenses from './routes/expenses.routes'
import stock    from './routes/stock.routes'
import sales    from './routes/sales.routes'

const app = new Hono()

app.use(logger())
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()).filter(Boolean)

app.use(cors({
  origin: allowedOrigins?.length ? allowedOrigins : '*',
  allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'x-company-id'],
  credentials: true,
}))

app.get('/', (c) => c.json({ message: 'Waariko API', version: '2.0.0' }))

app.route('/companies', companies)
app.route('/clients', clients)
app.route('/projects', projects)
app.route('/invoices', invoices)
app.route('/expenses', expenses)
app.route('/stock',    stock)
app.route('/sales',   sales)

app.notFound((c) => c.json({ error: 'Not found' }, 404))
app.onError((err, c) => {
  console.error(err)
  return c.json({ error: 'Internal server error' }, 500)
})

const port = Number(process.env.PORT) || 3000

export default {
  port,
  fetch: app.fetch,
}
