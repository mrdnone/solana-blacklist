import { useNavigate, useParams } from 'react-router-dom'
import { ValidatorDetail } from '../components/ValidatorDetail'
import { useValidatorDetail } from '../hooks/useValidatorDetail'
import { useFromHere, useGoBack } from '../hooks/useGoBack'
import { BLACKLIST_ROUTE } from '../lib/routes'

export function ValidatorDetailPage() {
  const { pubkey } = useParams<{ pubkey: string }>()
  const navigate = useNavigate()
  const goBack = useGoBack(BLACKLIST_ROUTE)
  const from = useFromHere()
  const { data, isLoading, error } = useValidatorDetail(pubkey ?? null)

  if (!pubkey) {
    return (
      <main className="max-w-[1280px] mx-auto px-6 sm:px-12 py-10">
        <p className="text-red-400 text-[0.9rem]">Invalid validator address.</p>
      </main>
    )
  }

  return (
    <main className="max-w-[1280px] mx-auto px-6 sm:px-12 py-10">
      <ValidatorDetail
        data={data}
        isLoading={isLoading}
        error={error}
        onBack={goBack}
        onEpochClick={(epoch) => navigate(`/epochs/${epoch}?search=${pubkey}`, { state: from })}
        onVote={(voteIdentity) => navigate(`/vote/${voteIdentity}`, { state: from })}
      />
    </main>
  )
}
