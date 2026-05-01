export type MemberRole = 'OWNER' | 'ADMIN' | 'MEMBER'
export type CompanyProfile = 'SERVICE_PROVIDER' | 'MERCHANT'
export type ClientType = 'COMPANY' | 'INDIVIDUAL'
export type ProjectStatus = 'DRAFT' | 'IN_PROGRESS' | 'VALIDATED' | 'COMPLETED' | 'CANCELLED'
export type InvoiceType = 'PROFORMA' | 'FINAL' | 'DELIVERY_NOTE'
export type InvoiceCategory = 'STANDARD' | 'DEPOSIT' | 'BALANCE'
export type SettlementType = 'BANK_TRANSFER' | 'CASH' | 'CHECK' | 'MOBILE_MONEY'

export interface AuthUser {
  id: string
  email: string
}

export interface ApiResponse<T> {
  data: T
  error?: never
}

export interface ApiError {
  error: string
  data?: never
}

// ── Types PDF / Templates ────────────────────────────────────────────────────

/** Branding de l'entreprise injecté dans chaque template */
export interface CompanyBranding {
  companyName:      string
  logoUrl:          string | null
  signatureUrl:     string | null
  brandColor:       string        // couleur principale  ex: "#c09544"
  accentColor:      string        // couleur secondaire  ex: "#2e4d6c"
  headOffice:       string | null
  email:            string | null
  phonePrimary:     string | null
  phoneSecondary:   string | null
  website:          string | null
  legalStatus:      string | null
  rccm:             string | null
  ifu:              string | null
  bankAccountNumber:string | null
}

/** Une ligne d'article dans la facture */
export interface InvoiceLineItem {
  description: string
  quantity:    number
  unitPrice:   number
  total:       number
}

/** Données complètes d'une facture pour le rendu PDF */
export interface InvoiceData {
  // Identification
  id:       string
  number:   string | null
  type:     InvoiceType
  category: InvoiceCategory
  issuedAt: string   // ISO date string

  // Parties
  clientName:    string
  clientAddress: string | null
  clientEmail:   string | null
  clientPhone:   string | null

  // Lignes
  items: InvoiceLineItem[]

  // Montants
  subtotal:       number
  discountAmount: number
  discountRate:   number | null   // % si remise en %
  taxRate:        number | null   // % TVA
  taxAmount:      number
  total:          number

  // Modalité (acompte / reliquat)
  paymentModality: number | null
  settlementType:  SettlementType | null

  // Texte libre
  notes:        string | null
  internalNote: string | null

  // Lié
  projectName: string | null
  reference:   string | null
}
