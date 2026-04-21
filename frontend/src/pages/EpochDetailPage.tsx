import { useNavigate, useParams } from 'react-router-dom'
import { EpochDetail } from '../components/EpochDetail'

export function EpochDetailPage() {
  const { epoch } = useParams<{ epoch: string }>()
  const navigate = useNavigate()

  const epochNum = epoch !== undefined ? parseInt(epoch, 10) : NaN

  if (isNaN(epochNum)) {
    return (
      <main className="max-w-[1200px] mx-auto px-6 sm:px-12 py-10">
        <p className="text-red-400 text-[0.9rem]">Invalid epoch number.</p>
      </main>
    )
  }

  return (
    <main className="max-w-[1200px] mx-auto px-6 sm:px-12 py-10">
      <EpochDetail
        epoch={epochNum}
        onBack={() => navigate('/epochs')}
        onValidatorClick={(pubkey) => navigate(`/validators/${pubkey}`)}
      />
    </main>
  )
}
