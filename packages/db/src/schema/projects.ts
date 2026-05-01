import { pgTable, uuid, text, timestamp, numeric, pgEnum, index } from 'drizzle-orm/pg-core'
import { companies } from './companies'
import { clients } from './clients'

export const projectStatusEnum = pgEnum('project_status', ['DRAFT', 'IN_PROGRESS', 'VALIDATED', 'COMPLETED', 'CANCELLED'])

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  status: projectStatusEnum('status').notNull().default('DRAFT'),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
  deletedAt: timestamp('deleted_at'),
  deletedBy: uuid('deleted_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  index('idx_projects_company').on(t.companyId),
  index('idx_projects_deleted_at').on(t.deletedAt),
  index('idx_projects_company_client').on(t.companyId, t.clientId),
])
