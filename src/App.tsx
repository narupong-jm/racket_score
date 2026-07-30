import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CreatePlayerForm } from './features/players/CreatePlayerForm'
import { PlayerList } from './features/players/PlayerList'
import { CreateTournamentForm } from './features/tournaments/CreateTournamentForm'
import { TournamentList } from './features/tournaments/TournamentList'
import { TournamentDetail } from './features/tournaments/TournamentDetail'
import { LanguageToggle } from './components/LanguageToggle'

function App() {
  const { t } = useTranslation()
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(null)

  return (
    <main>
      <LanguageToggle />

      <h1>{t('app.playersHeading')}</h1>
      <CreatePlayerForm />
      <PlayerList />

      <h1>{t('app.tournamentsHeading')}</h1>
      <CreateTournamentForm />
      <TournamentList selectedId={selectedTournamentId} onSelect={setSelectedTournamentId} />
      {selectedTournamentId && <TournamentDetail tournamentId={selectedTournamentId} />}
    </main>
  )
}

export default App
