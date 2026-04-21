import { useNavigate } from 'react-router-dom'
import { SuggestSource } from '../components/SuggestSource'

export function SuggestSourcePage() {
  const navigate = useNavigate()
  return <SuggestSource onBack={() => navigate('/sources')} />
}
