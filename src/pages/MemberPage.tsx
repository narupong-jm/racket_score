import { useTranslation } from 'react-i18next'
import { CreatePlayerForm } from '../features/players/CreatePlayerForm'
import { AddExistingMemberForm } from '../features/players/AddExistingMemberForm'
import { PlayerList } from '../features/players/PlayerList'

export function MemberPage() {
  const { t } = useTranslation()

  return (
    <section className="page">
      <h1>{t('member.heading')}</h1>
      <section className="card form-card">
        <h2>{t('member.addHeading')}</h2>
        <CreatePlayerForm />
      </section>
      <section className="card form-card">
        <h2>{t('member.addExistingHeading')}</h2>
        <AddExistingMemberForm />
      </section>
      <PlayerList />
    </section>
  )
}
