import { createMiddleware } from 'hono/factory'
import { supabase } from '../lib/supabase'
import type { AppEnv } from '../lib/types'

export const authMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '')

  if (!token) return c.json({ error: 'Unauthorized' }, 401)

  const { data: { user }, error } = await supabase.auth.getUser(token)

  if (error || !user) return c.json({ error: 'Unauthorized' }, 401)

  c.set('user', { id: user.id, email: user.email! })
  await next()
})
