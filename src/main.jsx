import React from 'react'
import ReactDOM from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google'
import App from './App.jsx'
import './index.css'

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "326028909255-bf6btaelvj17i8v1f19g0nfiltat1j2j.apps.googleusercontent.com";

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {clientId ? (
      <GoogleOAuthProvider clientId={clientId} locale="en">
        <App />
      </GoogleOAuthProvider>
    ) : (
      <App />
    )}
  </React.StrictMode>,
)
