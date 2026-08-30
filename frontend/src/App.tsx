import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Overview from './pages/Overview'
import Transactions from './pages/Transactions'
import Accounts from './pages/Accounts'
import Import from './pages/Import'
import Analytics from './pages/Analytics'
import Budget from './pages/Budget'
import Chat from './pages/Chat'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Overview />} />
        <Route path="transactions" element={<Transactions />} />
        <Route path="accounts" element={<Accounts />} />
        <Route path="import" element={<Import />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="budget" element={<Budget />} />
        <Route path="chat" element={<Chat />} />
      </Route>
    </Routes>
  )
}
