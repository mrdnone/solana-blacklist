import { useNavigate, useParams } from 'react-router-dom'
import { MeridianVoting } from '../components/MeridianVoting'

export function MeridianVotingPage() {
  const { pubkey } = useParams<{ pubkey?: string }>()
  const navigate = useNavigate()
  return (
    <MeridianVoting
      initialTarget={pubkey}
      onBack={() => navigate(-1)}
    />
  )
}
