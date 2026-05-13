import { pgTable, uuid, text, timestamp, pgEnum, uniqueIndex, index } from 'drizzle-orm/pg-core'

export const companyProfileEnum    = pgEnum('company_profile',    ['SERVICE_PROVIDER', 'MERCHANT'])
export const memberRoleEnum        = pgEnum('member_role',        ['OWNER', 'ADMIN', 'MEMBER'])
export const invitationStatusEnum  = pgEnum('invitation_status',  ['PENDING', 'ACCEPTED', 'CANCELLED'])

export const companies = pgTable('companies', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  profile: companyProfileEnum('profile').notNull(),
  sector: text('sector').notNull(),
  invoiceTemplateId: text('invoice_template_id').notNull(),
  primaryColor: text('primary_color').notNull(),
  secondaryColor: text('secondary_color'),
  tertiaryColor: text('tertiary_color'),
  logoUrl: text('logo_url'),
  signatureUrl: text('signature_url'),
  invoiceHeaderUrl: text('invoice_header_url'),
  invoiceFooterUrl: text('invoice_footer_url'),
  cachetUrl:        text('cachet_url'),
  headOffice: text('head_office').notNull(),
  email: text('email'),
  phonePrimary: text('phone_primary').notNull(),
  phoneSecondary: text('phone_secondary'),
  website: text('website'),
  rccm: text('rccm'),
  ifu: text('ifu'),
  ifu2: text('ifu2'),
  legalStatus: text('legal_status').notNull(),
  divisionFiscale: text('division_fiscale'),
  regimeImposition: text('regime_imposition'),
  bankAccountNumber: text('bank_account_number'),
  currency: text('currency').notNull().default('FCFA'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const companyMembers = pgTable('company_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull(),
  role: memberRoleEnum('role').notNull().default('MEMBER'),
  financeCodeAccess: text('finance_code_access'),
  expensesCodeAccess: text('expenses_code_access'),
  stockCodeAccess: text('stock_code_access'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  uniqueIndex('uq_company_members_user_company').on(t.userId, t.companyId),
  index('idx_company_members_company').on(t.companyId),
  index('idx_company_members_user').on(t.userId),
])

export const companyInvitations = pgTable('company_invitations', {
  id:        uuid('id').defaultRandom().primaryKey(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  email:     text('email').notNull(),
  role:      memberRoleEnum('role').notNull().default('MEMBER'),
  token:     uuid('token').defaultRandom().notNull(),
  status:    invitationStatusEnum('status').notNull().default('PENDING'),
  invitedBy: text('invited_by').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  uniqueIndex('uq_company_invitations_token').on(t.token),
  index('idx_company_invitations_company').on(t.companyId),
  index('idx_company_invitations_email').on(t.email),
])
