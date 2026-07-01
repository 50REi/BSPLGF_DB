import { useState } from 'react'
import { FinancialDataProvider } from './context/FinancialDataContext'
import { FinancialDashboard } from './components/FinancialDashboard'
import { ApiKeySetup, LS_KEY } from './components/ApiKeySetup'
import './App.css'

function App() {
  const [apiKeyReady, setApiKeyReady] = useState(() => !!localStorage.getItem(LS_KEY))

  if (!apiKeyReady) {
    return <ApiKeySetup onSave={() => setApiKeyReady(true)} />
  }

  return (
    <FinancialDataProvider>
      <FinancialDashboard />
    </FinancialDataProvider>
  )
}

export default App
