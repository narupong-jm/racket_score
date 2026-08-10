import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useSport } from '../features/sport/useSport'
import { SPORTS, type Sport } from '../features/sport/sportTypes'
import { SPORT_ICONS } from '../features/sport/sportIcons'

export function HomePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { setSport } = useSport()

  function handleChoose(sport: Sport) {
    setSport(sport)
    navigate('/create', { replace: true })
  }

  return (
    <section className="home-page">
      <h1>{t('home.heading')}</h1>
      <p className="page-subtitle">{t('home.instruction')}</p>
      <div className="sport-picker-options">
        {SPORTS.map((sport) => (
          <button
            key={sport}
            type="button"
            className="sport-picker-option"
            onClick={() => handleChoose(sport)}
          >
            <img src={SPORT_ICONS[sport]} alt="" />
            <span>{t(`sport.${sport}`)}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
