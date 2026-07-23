export interface Category {
  id: string
  storeId: string
  name: string
  createdAt: string
}

export interface StockItem {
  id: string
  storeId: string
  categoryId: string | null
  name: string
  brand: string | null
  sizeMl: number | null
  sku: string | null
  costPrice: number
  salePrice: number
  quantityOnHand: number
  reorderLevel: number
  photoPath: string | null
  isActive: boolean
  updatedAt: string
  updatedBy: string | null
  version: number
}

export type CashSessionStatus = 'open' | 'closed'

export interface CashSession {
  id: string
  storeId: string
  openedAt: string
  openedBy: string | null
  openingAmount: number
  closedAt: string | null
  closingCountedAmount: number | null
  expectedAmount: number | null
  discrepancy: number | null
  status: CashSessionStatus
  notes: string | null
  updatedAt: string
}

export type SaleStatus = 'completed' | 'voided'
export type PaymentMethod = 'cash' | 'bank'

export interface Sale {
  id: string
  storeId: string
  cashSessionId: string
  soldAt: string
  subtotal: number
  discount: number
  total: number
  costTotal: number
  paymentMethod: PaymentMethod
  status: SaleStatus
  createdBy: string | null
  updatedAt: string
}

export interface SaleItem {
  id: string
  saleId: string
  stockItemId: string | null
  itemNameSnapshot: string
  quantity: number
  unitPrice: number
  unitCost: number
  lineTotal: number
}

export type BankTransactionDirection = 'in' | 'out'

export interface BankTransaction {
  id: string
  storeId: string
  occurredAt: string
  direction: BankTransactionDirection
  amount: number
  category: string
  notes: string | null
  relatedSaleId: string | null
  createdBy: string | null
  updatedAt: string
}

export interface CashExpense {
  id: string
  storeId: string
  cashSessionId: string
  occurredAt: string
  amount: number
  category: string
  notes: string | null
  createdBy: string | null
  updatedAt: string
}

export type SyncEntity =
  | 'categories'
  | 'stock_items'
  | 'cash_sessions'
  | 'sales'
  | 'sale_items'
  | 'bank_transactions'
  | 'cash_expenses'
export type SyncOperation = 'insert' | 'update' | 'delete'
export type SyncStatus = 'pending' | 'inflight' | 'done' | 'failed'

export interface OutboxEntry {
  id?: number
  entity: SyncEntity
  entityId: string
  operation: SyncOperation
  payload: Record<string, unknown>
  createdAt: string
  attempts: number
  lastError: string | null
  status: SyncStatus
}

export interface MetaEntry {
  key: string
  lastPulledAt: string | null
}

export type PhotoUploadStatus = 'pending' | 'failed'

export interface PhotoUpload {
  id: string
  stockItemId: string
  storeId: string
  blob: Blob
  createdAt: string
  attempts: number
  lastError: string | null
  status: PhotoUploadStatus
}

export interface PhotoDeletion {
  id: string
  photoPath: string
  createdAt: string
  attempts: number
  lastError: string | null
  status: PhotoUploadStatus
}
