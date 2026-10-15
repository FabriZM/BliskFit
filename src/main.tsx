import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider, createHashRouter } from 'react-router-dom'
import './i18n'
import './lib/pwaInstall'
import './index.css'
import App from './App'

// A data router (not <HashRouter>) so screens with unsaved drafts can block navigation (useBlocker).
const router = createHashRouter([{ path: '*', element: <App /> }])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
