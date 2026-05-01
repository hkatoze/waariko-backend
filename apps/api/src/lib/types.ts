import type { AuthUser } from '@waariko/types'

export type AppEnv = {
  Variables: {
    user: AuthUser
    companyId: string
  }
}
