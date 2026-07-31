import { NavLink, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LanguageToggle } from './LanguageToggle'
import createIcon from '../assets/icons/create_tournament.png'
import activeIcon from '../assets/icons/active.png'
import scoreboardIcon from '../assets/icons/overall_scoreboard.png'
import historyIcon from '../assets/icons/history_by_person.png'
import memberIcon from '../assets/icons/member.png'

const TABS = [
  { to: '/create', labelKey: 'nav.create', icon: createIcon },
  { to: '/active', labelKey: 'nav.active', icon: activeIcon },
  { to: '/scoreboard', labelKey: 'nav.scoreboard', icon: scoreboardIcon },
  { to: '/history', labelKey: 'nav.history', icon: historyIcon },
  { to: '/member', labelKey: 'nav.member', icon: memberIcon },
] as const

export function AppLayout() {
  const { t } = useTranslation()

  return (
    <div className="app-layout">
      <header className="app-header">
        <LanguageToggle />
      </header>

      <main className="app-content">
        <Outlet />
      </main>

      <nav className="tab-bar">
        {TABS.map((tab) => (
          <NavLink key={tab.to} to={tab.to} className="tab-bar-link">
            <img src={tab.icon} alt="" />
            <span>{t(tab.labelKey)}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
