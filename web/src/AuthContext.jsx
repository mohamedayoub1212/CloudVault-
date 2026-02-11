import { createContext, useContext, useState, useEffect } from 'react'
import { isAuthenticated, getProfile, getStoredUser } from './api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isAuthenticated()) {
      setUser(getStoredUser())
      getProfile()
        .then(setUser)
        .catch(() => setUser(getStoredUser()))
        .finally(() => setLoading(false))
    } else {
      setUser(null)
      setLoading(false)
    }
  }, [])

  const setUserFromLogin = (u) => {
    setUser(u)
  }

  return (
    <AuthContext.Provider value={{ user, loading, setUser: setUserFromLogin }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return ctx
}
