import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { api, sessionExpiredEvent } from '../../shared/api'
import type { User } from '../../shared/types'
import { AuthContext } from './AuthContext'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    api
      .get<User | null>('/auth/me', controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setUser(value ?? null)
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [revision])
  // Any API 401 means the cookie expired or was revoked; protected pages then offer a fresh login.
  useEffect(() => {
    const expire = () => setUser(null)
    window.addEventListener(sessionExpiredEvent, expire)
    return () => window.removeEventListener(sessionExpiredEvent, expire)
  }, [])
  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        failed,
        setUser,
        reload: () => {
          setLoading(true)
          setFailed(false)
          setRevision((v) => v + 1)
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
