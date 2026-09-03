import { useNavigate } from 'react-router-dom'
import { ValidatorsList } from '../components/ValidatorsList'
import { useFromHere } from '../hooks/useGoBack'
import { BLACKLIST_ROUTE } from '../lib/routes'

export function ValidatorsPage() {
  const navigate = useNavigate()
  const from = useFromHere()

  return (
    <ValidatorsList
      onBack={() => navigate(BLACKLIST_ROUTE)}
      onValidatorClick={(pubkey) => navigate(`/validators/${pubkey}`, { state: from })}
    />
  )
}
