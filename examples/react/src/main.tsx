import './recorder' // sandbox only: must load before the SDK starts sending
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MixdiveProvider } from '@mixdive/react'
import { API_KEY, SERVER } from './config'
import { App } from './App'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MixdiveProvider apiKey={API_KEY} server={SERVER}>
      <App />
    </MixdiveProvider>
  </StrictMode>,
)
