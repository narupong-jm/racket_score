const STORAGE_KEY = 'racket-score.writePassphrase'

export function getCachedPassphrase(): string | null {
  return sessionStorage.getItem(STORAGE_KEY)
}

export function setCachedPassphrase(passphrase: string): void {
  sessionStorage.setItem(STORAGE_KEY, passphrase)
}

export function clearCachedPassphrase(): void {
  sessionStorage.removeItem(STORAGE_KEY)
}
