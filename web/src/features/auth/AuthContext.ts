import { createContext, useContext } from 'react'
import type { User } from '../../shared/types'
type Auth = {
  user: User | null
  loading: boolean
  failed: boolean
  setUser: (user: User | null) => void
  reload: () => void
}
export const AuthContext = createContext<Auth | null>(null)
export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('Missing AuthProvider')
  return value
}
