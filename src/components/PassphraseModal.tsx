import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from './Modal'

interface PassphraseModalProps {
  open: boolean
  invalid: boolean
  submitting: boolean
  onSubmit: (passphrase: string) => void
  onCancel: () => void
}

export function PassphraseModal({
  open,
  invalid,
  submitting,
  onSubmit,
  onCancel,
}: PassphraseModalProps) {
  const { t } = useTranslation()
  const [value, setValue] = useState('')

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    onSubmit(value)
  }

  function handleClose() {
    setValue('')
    onCancel()
  }

  return (
    <Modal open={open} onClose={handleClose}>
      <h3>{t('passphrase.title')}</h3>
      <p>{t('passphrase.prompt')}</p>
      <form onSubmit={handleSubmit}>
        <label className="field">
          <span className="field-label">{t('passphrase.label')}</span>
          <input
            type="password"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            disabled={submitting}
            autoFocus
          />
        </label>
        {invalid && <p role="alert">{t('passphrase.invalid')}</p>}
        <div className="modal-actions">
          <button
            type="button"
            className="secondary"
            onClick={handleClose}
            disabled={submitting}
          >
            {t('passphrase.cancel')}
          </button>
          <button type="submit" disabled={submitting || value.length === 0}>
            {t('passphrase.submit')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
