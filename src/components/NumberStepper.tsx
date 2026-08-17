import type { ChangeEvent } from 'react'

interface NumberStepperProps {
  id?: string
  value: number | ''
  onChange: (value: number | '') => void
  min?: number
}

export function NumberStepper({
  id,
  value,
  onChange,
  min = 1,
}: NumberStepperProps) {
  const canDecrement = value !== '' && value > min

  function decrement() {
    if (value === '') return
    const next = value - 1
    if (next < min) return
    onChange(next)
  }

  function increment() {
    if (value === '') {
      onChange(min)
      return
    }
    onChange(value + 1)
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    const raw = event.target.value
    if (raw === '') {
      onChange('')
      return
    }
    const parsed = Number(raw)
    if (Number.isNaN(parsed)) return
    onChange(parsed)
  }

  return (
    <div className="number-stepper">
      <button
        type="button"
        className="number-stepper-btn"
        onClick={decrement}
        disabled={!canDecrement}
        aria-label="decrease"
      >
        −
      </button>
      <input
        id={id}
        type="number"
        min={min}
        value={value}
        onChange={handleInputChange}
      />
      <button
        type="button"
        className="number-stepper-btn"
        onClick={increment}
        aria-label="increase"
      >
        +
      </button>
    </div>
  )
}
