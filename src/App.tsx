import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { CreateTournamentPage } from './pages/CreateTournamentPage'
import { ActivePage } from './pages/ActivePage'
import { OverallScoreboardPage } from './pages/OverallScoreboardPage'
import { HistoryPage } from './pages/HistoryPage'
import { MemberPage } from './pages/MemberPage'
import { TournamentDetailRoute } from './features/tournaments/TournamentDetailRoute'
import { TournamentScoreboardRoute } from './features/tournaments/TournamentScoreboardRoute'

function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/create" replace />} />
        <Route path="/create" element={<CreateTournamentPage />} />
        <Route path="/active" element={<ActivePage />} />
        <Route path="/tournaments/:id" element={<TournamentDetailRoute />} />
        <Route path="/tournaments/:id/scoreboard" element={<TournamentScoreboardRoute />} />
        <Route path="/scoreboard" element={<OverallScoreboardPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/member" element={<MemberPage />} />
      </Route>
    </Routes>
  )
}

export default App
