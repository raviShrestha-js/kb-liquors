import { db } from '../db/db'
import { supabase } from '../lib/supabase'
import { updateStockItem } from '../db/mutations'

const MAX_ATTEMPTS = 5

export async function pushPhotoUploads(): Promise<void> {
  const pending = await db.photoUploads.where('status').equals('pending').toArray()

  for (const upload of pending) {
    const path = `${upload.storeId}/${upload.stockItemId}/${upload.id}.jpg`
    const { error } = await supabase.storage.from('stock-photos').upload(path, upload.blob, {
      contentType: 'image/jpeg',
      upsert: true,
    })

    if (!error) {
      await updateStockItem(upload.stockItemId, { photoPath: path })
      await db.photoUploads.delete(upload.id)
      continue
    }

    const attempts = upload.attempts + 1
    await db.photoUploads.update(upload.id, {
      attempts,
      lastError: error.message,
      status: attempts >= MAX_ATTEMPTS ? 'failed' : 'pending',
    })
  }
}

const signedUrlCache = new Map<string, { url: string; expiresAt: number }>()

export async function resolvePhotoUrl(photoPath: string): Promise<string | null> {
  const cached = signedUrlCache.get(photoPath)
  if (cached && cached.expiresAt > Date.now()) return cached.url

  const { data, error } = await supabase.storage.from('stock-photos').createSignedUrl(photoPath, 60 * 60)
  if (error || !data) return null

  signedUrlCache.set(photoPath, { url: data.signedUrl, expiresAt: Date.now() + 55 * 60 * 1000 })
  return data.signedUrl
}
