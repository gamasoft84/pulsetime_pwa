import { useAuth } from '@clerk/clerk-react'
import { useEffect } from 'react'
import { setApiAuthTokenGetter } from './api'

/** Enlaza getToken() de Clerk con las peticiones a /api. */
export function AuthApiSync() {
  const { getToken, isSignedIn } = useAuth()

  useEffect(() => {
    setApiAuthTokenGetter(async () => {
      if (!isSignedIn) return null
      return getToken()
    })
  }, [getToken, isSignedIn])

  return null
}
