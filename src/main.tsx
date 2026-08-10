import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/queryClient.ts'
import { PassphraseGateProvider } from './features/passphrase/PassphraseGateProvider.tsx'
import { SportProvider } from './features/sport/SportProvider.tsx'
import './i18n'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <SportProvider>
          <PassphraseGateProvider>
            <App />
          </PassphraseGateProvider>
        </SportProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
