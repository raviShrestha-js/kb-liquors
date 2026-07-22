import { useRef } from 'react'
import { queuePhotoForStockItem } from '../db/photos'

interface Props {
  stockItemId: string
  storeId: string
  onQueued?: () => void
}

export function CameraCapture({ stockItemId, storeId, onQueued }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    await queuePhotoForStockItem(stockItemId, storeId, file)
    e.target.value = ''
    onQueued?.()
  }

  return (
    <div className="camera-capture">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleChange}
        style={{ display: 'none' }}
      />
      <button type="button" onClick={() => inputRef.current?.click()}>
        📷 Take / choose photo
      </button>
    </div>
  )
}
