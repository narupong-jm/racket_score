import { useEffect, useRef, type MouseEvent, type ReactNode, type SyntheticEvent } from 'react'
import { useTranslation } from 'react-i18next'

interface ModalProps {
  open: boolean
  onClose: () => void
  children: ReactNode
}

export function Modal({ open, onClose, children }: ModalProps) {
  const { t } = useTranslation()
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (typeof dialog.showModal === 'function') {
      dialog.showModal()
    } else {
      // jsdom has no showModal()/close() -- fall back to the `open` attribute
      // directly so the dialog and its contents are still queryable in tests.
      dialog.open = true
    }
  }, [open])

  if (!open) return null

  function handleCancel(event: SyntheticEvent<HTMLDialogElement>) {
    event.preventDefault()
    onClose()
  }

  function handleBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === dialogRef.current) onClose()
  }

  return (
    <dialog
      ref={dialogRef}
      className="modal"
      onCancel={handleCancel}
      onClose={onClose}
      onClick={handleBackdropClick}
    >
      <button type="button" className="modal-close" onClick={onClose} aria-label={t('common.close')}>
        &times;
      </button>
      {children}
    </dialog>
  )
}
