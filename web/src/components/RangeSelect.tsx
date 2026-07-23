import { RANGE_LABELS, type RangeKey } from '../lib/dateRanges'

interface Props {
  value: RangeKey
  onChange: (value: RangeKey) => void
}

export function RangeSelect({ value, onChange }: Props) {
  return (
    <select
      className="range-select"
      value={value}
      onChange={(e) => onChange(e.target.value as RangeKey)}
      aria-label="Date range"
    >
      {(Object.keys(RANGE_LABELS) as RangeKey[]).map((key) => (
        <option key={key} value={key}>
          {RANGE_LABELS[key]}
        </option>
      ))}
    </select>
  )
}
