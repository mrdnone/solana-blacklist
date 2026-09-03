import { useNavigate } from 'react-router-dom'
import { SourcesPage } from '../components/SourcesPage'
import { BLACKLIST_ROUTE } from '../lib/routes'

export function SourcesPageRoute() {
  const navigate = useNavigate()
  return (
    <SourcesPage
      onBack={() => navigate(BLACKLIST_ROUTE)}
      onSuggestSource={() => navigate('/sources/suggest')}
    />
  )
}
