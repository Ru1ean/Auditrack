import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// import { BrowserRouter } from 'react-router-dom' 
import './index.css'
import App from './App.jsx'
import ModalProvider from './components/UI/ModalProvider'
import { ToastProvider } from './components/UI/Toast'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ToastProvider>
      <ModalProvider>
        <App />
      </ModalProvider>
    </ToastProvider>
  </StrictMode>
)
