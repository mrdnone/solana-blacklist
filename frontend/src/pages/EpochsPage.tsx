import { useNavigate } from 'react-router-dom'
import { EpochList } from '../components/EpochList'
import { useEpochs } from '../hooks/useEpochs'

export function EpochsPage() {
  const navigate = useNavigate()
  const { data, isLoading, error } = useEpochs()

  return (
    <main className="max-w-[1200px] mx-auto px-6 sm:px-12 py-10">
      <EpochList
        data={data}
        isLoading={isLoading}
        error={error}
        onBack={() => navigate('/')}
        onEpochClick={(epoch) => navigate(`/epochs/${epoch}`)}
      />
    </main>
  )
}
