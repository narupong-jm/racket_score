import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { IconChoice } from './IconChoice'

const OPTIONS = [
  { value: 'male', label: 'Male', icon: 'male.png' },
  { value: 'female', label: 'Female', icon: 'female.png' },
] as const

describe('IconChoice', () => {
  it('renders a group with a radio per option', () => {
    render(
      <IconChoice
        legend="Gender"
        name="gender"
        options={[...OPTIONS]}
        value="male"
        onChange={() => {}}
      />,
    )

    expect(screen.getByRole('group', { name: 'Gender' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Male' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Female' })).toBeInTheDocument()
  })

  it('calls onChange with the clicked option value', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(
      <IconChoice
        legend="Gender"
        name="gender"
        options={[...OPTIONS]}
        value="male"
        onChange={onChange}
      />,
    )

    await user.click(screen.getByRole('radio', { name: 'Female' }))

    expect(onChange).toHaveBeenCalledWith('female')
  })

  it('reflects the selected value via checked state', () => {
    render(
      <IconChoice
        legend="Gender"
        name="gender"
        options={[...OPTIONS]}
        value="female"
        onChange={() => {}}
      />,
    )

    expect(screen.getByRole('radio', { name: 'Male' })).not.toBeChecked()
    expect(screen.getByRole('radio', { name: 'Female' })).toBeChecked()
  })

  it('disables all radios when disabled is true', () => {
    render(
      <IconChoice
        legend="Gender"
        name="gender"
        options={[...OPTIONS]}
        value="male"
        onChange={() => {}}
        disabled
      />,
    )

    expect(screen.getByRole('radio', { name: 'Male' })).toBeDisabled()
    expect(screen.getByRole('radio', { name: 'Female' })).toBeDisabled()
  })
})
