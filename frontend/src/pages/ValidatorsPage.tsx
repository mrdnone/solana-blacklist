import { useNavigate } from 'react-router-dom'
import { ValidatorsList } from '../components/ValidatorsList'

export function ValidatorsPage() {
  const navigate = useNavigate()
  return (
    <ValidatorsList
      onBack={() => navigate('/')}
      onValidatorClick={(pubkey) => navigate(`/validators/${pubkey}`)}
    />
  )
}
