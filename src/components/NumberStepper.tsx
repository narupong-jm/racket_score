import type { ChangeEvent } from 'react'

interface NumberStepperProps {
  id?: string
  value: number | ''
  onChange: (value: number | '') => void
  min?: number
  max?: number
  disabled?: boolean
}

export function NumberStepper({
  id,
  value,
  onChange,
  min = 1,
  max,
  disabled = false,
}: NumberStepperProps) {
  const canDecrement = value !== '' && value > min

  function decrement() {
    if (value === '') return
    const next = value - 1
    if (next < min) return
    onChange(next)
  }

  const canIncrement = max === undefined || value === '' || value < max

  function increment() {
    if (value === '') {
      onChange(min)
      return
    }
    if (max !== undefined && value >= max) return
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
    onChange(max !== undefined && parsed > max ? max : parsed)
  }

  return (
    <div className={disabled ? 'number-stepper is-disabled' : 'number-stepper'}>
      <button
        type="button"
        className="number-stepper-btn"
        onClick={decrement}
        disabled={disabled || !canDecrement}
        aria-label="decrease"
      >
        −
      </button>
      <input
        id={id}
        type="number"
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        onChange={handleInputChange}
      />
      <button
        type="button"
        className="number-stepper-btn"
        onClick={increment}
        disabled={disabled || !canIncrement}
        aria-label="increase"
      >
        +
      </button>
    </div>
  )
}
