import { useParams } from 'react-router-dom'
import { MeridianVoting } from '../components/MeridianVoting'
import { useGoBack } from '../hooks/useGoBack'
import { BLACKLIST_ROUTE } from '../lib/routes'

export function MeridianVotingPage() {
  const { pubkey } = useParams<{ pubkey?: string }>()
  const goBack = useGoBack(BLACKLIST_ROUTE)
  return (
    <MeridianVoting
      initialTarget={pubkey}
      onBack={goBack}
    />
  )
}
