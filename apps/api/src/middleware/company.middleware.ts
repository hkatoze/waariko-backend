import { createMiddleware } from 'hono/factory'
import { db, companyMembers, eq, and } from '@waariko/db'
import type { AppEnv } from '../lib/types'

export const companyMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const user = c.get('user')
  const companyId = c.req.header('x-company-id')

  if (!companyId) return c.json({ error: 'x-company-id header is required' }, 400)

  const member = await db.query.companyMembers.findFirst({
    where: and(
      eq(companyMembers.companyId, companyId),
      eq(companyMembers.userId, user.id)
    ),
  })

  if (!member) return c.json({ error: 'Forbidden' }, 403)

  c.set('companyId', companyId)
  await next()
})
