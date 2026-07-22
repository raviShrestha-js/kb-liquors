import type { SyncEntity } from '../db/types'

export const ENTITY_TABLE: Record<SyncEntity, string> = {
  categories: 'categories',
  stock_items: 'stock_items',
  cash_sessions: 'cash_sessions',
  sales: 'sales',
  sale_items: 'sale_items',
}

// Tables whose rows never change after insert (safe to pull by created_at only).
export const APPEND_ONLY: SyncEntity[] = ['categories', 'sales', 'sale_items']

// Tables that can be edited after creation — pulled by updated_at watermark.
export const MUTABLE: SyncEntity[] = ['stock_items', 'cash_sessions']
