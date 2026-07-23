import Dexie, { type EntityTable } from 'dexie'
import type {
  Category,
  StockItem,
  CashSession,
  Sale,
  SaleItem,
  OutboxEntry,
  MetaEntry,
  PhotoUpload,
  PhotoDeletion,
  BankTransaction,
  CashExpense,
} from './types'

export class KbLiquorsDB extends Dexie {
  categories!: EntityTable<Category, 'id'>
  stockItems!: EntityTable<StockItem, 'id'>
  cashSessions!: EntityTable<CashSession, 'id'>
  sales!: EntityTable<Sale, 'id'>
  saleItems!: EntityTable<SaleItem, 'id'>
  syncOutbox!: EntityTable<OutboxEntry, 'id'>
  meta!: EntityTable<MetaEntry, 'key'>
  photoUploads!: EntityTable<PhotoUpload, 'id'>
  bankTransactions!: EntityTable<BankTransaction, 'id'>
  photoDeletions!: EntityTable<PhotoDeletion, 'id'>
  cashExpenses!: EntityTable<CashExpense, 'id'>

  constructor() {
    super('kb-liquors')

    this.version(1).stores({
      categories: 'id, storeId',
      stockItems: 'id, storeId, categoryId, isActive, name',
      cashSessions: 'id, storeId, status, openedAt',
      sales: 'id, storeId, cashSessionId, soldAt',
      saleItems: 'id, saleId, stockItemId',
      syncOutbox: '++id, status, entity, createdAt',
      meta: 'key',
      photoUploads: 'id, stockItemId, status',
    })

    // v2: IndexedDB cannot index boolean values, so `isActive` silently
    // failed to be findable via .where() — drop it from the index and
    // filter it in JS instead (see StockListPage/PosPage).
    this.version(2).stores({
      stockItems: 'id, storeId, categoryId, name',
    })

    this.version(3).stores({
      bankTransactions: 'id, storeId, occurredAt, relatedSaleId',
    })

    this.version(4).stores({
      photoDeletions: 'id, status',
    })

    this.version(5).stores({
      cashExpenses: 'id, storeId, cashSessionId, occurredAt',
    })
  }
}

export const db = new KbLiquorsDB()
