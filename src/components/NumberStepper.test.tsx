import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { NumberStepper } from './NumberStepper'

describe('NumberStepper max', () => {
  it('disables increase at max', () => {
    render(<NumberStepper value={8} onChange={() => {}} min={1} max={8} />)
    expect(screen.getByRole('button', { name: 'increase' })).toBeDisabled()
  })

  it('keeps increase enabled below max', () => {
    render(<NumberStepper value={7} onChange={() => {}} min={1} max={8} />)
    expect(screen.getByRole('button', { name: 'increase' })).toBeEnabled()
  })

  it('clamps typed values above max down to max', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<NumberStepper value="" onChange={onChange} min={1} max={8} />)
    await user.type(screen.getByRole('spinbutton'), '9')
    expect(onChange).toHaveBeenLastCalledWith(8)
  })

  it('has no upper bound when max is omitted', () => {
    render(<NumberStepper value={50} onChange={() => {}} />)
    expect(screen.getByRole('button', { name: 'increase' })).toBeEnabled()
  })
})
