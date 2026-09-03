import { useNavigate } from 'react-router-dom'
import { EpochList } from '../components/EpochList'
import { useEpochs } from '../hooks/useEpochs'
import { useFromHere } from '../hooks/useGoBack'
import { BLACKLIST_ROUTE } from '../lib/routes'

export function EpochsPage() {
  const navigate = useNavigate()
  const { data, isLoading, error } = useEpochs()
  const from = useFromHere()

  return (
    <main className="max-w-[1280px] mx-auto px-6 sm:px-12 py-10">
      <EpochList
        data={data}
        isLoading={isLoading}
        error={error}
        onBack={() => navigate(BLACKLIST_ROUTE)}
        onEpochClick={(epoch) => navigate(`/epochs/${epoch}`, { state: from })}
      />
    </main>
  )
}
