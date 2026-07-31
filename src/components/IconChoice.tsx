export interface IconChoiceOption<T extends string> {
  value: T
  label: string
  icon: string
}

interface IconChoiceProps<T extends string> {
  legend: string
  name: string
  options: IconChoiceOption<T>[]
  value: T
  onChange: (value: T) => void
  disabled?: boolean
}

export function IconChoice<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
  disabled,
}: IconChoiceProps<T>) {
  return (
    <fieldset className="icon-choice" disabled={disabled}>
      <legend>{legend}</legend>
      <div className="icon-choice-options">
        {options.map((option) => (
          <label key={option.value} className="icon-choice-option">
            <input
              type="radio"
              className="visually-hidden"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            <img src={option.icon} alt="" />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
