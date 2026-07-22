import imageCompression from 'browser-image-compression'
import { db } from './db'
import { newId } from '../lib/id'

/** Captures/selects photo stays fully usable offline: the blob is stored locally
 *  immediately, and only uploaded to Supabase Storage once connectivity returns. */
export async function queuePhotoForStockItem(stockItemId: string, storeId: string, file: File) {
  const compressed = await imageCompression(file, {
    maxSizeMB: 0.3,
    maxWidthOrHeight: 1280,
    useWebWorker: true,
  })

  // Replace any earlier not-yet-uploaded photo for this item — only one active photo at a time.
  await db.photoUploads.where('stockItemId').equals(stockItemId).delete()

  await db.photoUploads.add({
    id: newId(),
    stockItemId,
    storeId,
    blob: compressed,
    createdAt: new Date().toISOString(),
    attempts: 0,
    lastError: null,
    status: 'pending',
  })
}
