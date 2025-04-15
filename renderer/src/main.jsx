import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './assets/App.css' // Importujeme hlavní CSS

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)