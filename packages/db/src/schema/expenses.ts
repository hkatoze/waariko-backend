import { pgTable, uuid, text, timestamp, numeric, boolean, pgEnum, index } from 'drizzle-orm/pg-core'
import { companies } from './companies'
import { projects } from './projects'

export const expenseStatusEnum = pgEnum('expense_status', ['IN_PROGRESS', 'COMPLETED'])

export const expenses = pgTable('expenses', {
  id:          uuid('id').primaryKey().defaultRandom(),
  companyId:   uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  projectId:   uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
  title:       text('title').notNull(),
  amount:      numeric('amount', { precision: 12, scale: 2 }).notNull().default('0'),
  expenseDate: timestamp('expense_date').notNull().defaultNow(),
  type:        text('type'),
  status:      expenseStatusEnum('status').notNull().default('IN_PROGRESS'),
  isRecurring: boolean('is_recurring').notNull().default(false),
  notes:       text('notes'),
  deletedAt:   timestamp('deleted_at'),
  createdAt:   timestamp('created_at').defaultNow().notNull(),
  updatedAt:   timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  index('idx_expenses_company').on(t.companyId),
  index('idx_expenses_project').on(t.projectId),
])
