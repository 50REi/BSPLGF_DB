import { FinancialDataProvider } from './context/FinancialDataContext'
import { FinancialDashboard } from './components/FinancialDashboard'
import './App.css'

function App() {
  return (
    <FinancialDataProvider>
      <FinancialDashboard />
    </FinancialDataProvider>
  )
}

export default App
