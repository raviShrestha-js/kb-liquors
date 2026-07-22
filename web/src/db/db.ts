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
  }
}

export const db = new KbLiquorsDB()
