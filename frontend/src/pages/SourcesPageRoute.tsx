import { useNavigate } from 'react-router-dom'
import { SourcesPage } from '../components/SourcesPage'

export function SourcesPageRoute() {
  const navigate = useNavigate()
  return (
    <SourcesPage
      onBack={() => navigate('/')}
      onSuggestSource={() => navigate('/sources/suggest')}
    />
  )
}
