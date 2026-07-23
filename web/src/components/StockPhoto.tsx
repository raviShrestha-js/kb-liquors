import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Wine } from 'lucide-react'
import { db } from '../db/db'
import { resolvePhotoUrl } from '../sync/photos'

interface Props {
  stockItemId: string
  photoPath: string | null
  alt: string
}

export function StockPhoto({ stockItemId, photoPath, alt }: Props) {
  const pendingUpload = useLiveQuery(
    () => db.photoUploads.where('stockItemId').equals(stockItemId).first(),
    [stockItemId],
  )
  const [remoteUrl, setRemoteUrl] = useState<string | null>(null)
  const [localPreview, setLocalPreview] = useState<string | null>(null)

  // Create the local blob preview in an effect and revoke it on cleanup —
  // doing this inline on every render leaks an object URL each time.
  useEffect(() => {
    if (!pendingUpload) {
      setLocalPreview(null)
      return
    }
    const url = URL.createObjectURL(pendingUpload.blob)
    setLocalPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [pendingUpload])

  useEffect(() => {
    if (pendingUpload || !photoPath) {
      setRemoteUrl(null)
      return
    }
    let cancelled = false
    resolvePhotoUrl(photoPath).then((url) => {
      if (!cancelled) setRemoteUrl(url)
    })
    return () => {
      cancelled = true
    }
  }, [photoPath, pendingUpload])

  const src = localPreview ?? remoteUrl

  if (!src)
    return (
      <div className="stock-photo stock-photo--empty">
        <Wine size={26} strokeWidth={1.5} />
      </div>
    )

  return (
    <div className="stock-photo">
      <img src={src} alt={alt} loading="lazy" />
      {pendingUpload && <span className="stock-photo__badge">Uploading…</span>}
    </div>
  )
}
