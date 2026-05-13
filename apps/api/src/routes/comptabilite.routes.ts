import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth.middleware'
import { companyMiddleware } from '../middleware/company.middleware'
import * as comptabiliteService from '../services/comptabilite.service'
import type { PeriodType } from '../services/comptabilite.service'
import type { AppEnv } from '../lib/types'

const app = new Hono<AppEnv>()

app.use(authMiddleware)
app.use(companyMiddleware)

app.get('/', async (c) => {
  const companyId = c.get('companyId')
  const year   = parseInt(c.req.query('year')   ?? String(new Date().getFullYear()), 10)
  const period = (c.req.query('period') ?? 'year') as PeriodType
  const offset = parseInt(c.req.query('offset') ?? '0', 10)

  if (isNaN(year) || year < 2000 || year > 2100) return c.json({ error: 'Invalid year' }, 400)
  if (!['month', 'quarter', 'semester', 'year'].includes(period)) return c.json({ error: 'Invalid period' }, 400)
  if (isNaN(offset) || offset < 0 || offset > 11) return c.json({ error: 'Invalid offset' }, 400)

  const data = await comptabiliteService.getRapportComptable(companyId, year, period, offset)
  return c.json({ data })
})

export default app
