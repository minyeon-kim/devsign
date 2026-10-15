import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { installRedundantTitleGuard } from '@/lib/redundantTooltips'

// (A tooltip that repeats what its control already says isn't shown.)
installRedundantTitleGuard()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
