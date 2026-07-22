import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
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

  const localPreview = pendingUpload ? URL.createObjectURL(pendingUpload.blob) : null
  const src = localPreview ?? remoteUrl

  if (!src) return <div className="stock-photo stock-photo--empty">No photo</div>

  return (
    <div className="stock-photo">
      <img src={src} alt={alt} loading="lazy" />
      {pendingUpload && <span className="stock-photo__badge">Uploading…</span>}
    </div>
  )
}
