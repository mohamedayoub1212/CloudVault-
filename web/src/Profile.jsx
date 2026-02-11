import { useState, useEffect } from 'react'
import { getProfile } from './api'
import './Profile.css'

export default function Profile({ user, onBack }) {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    getProfile()
      .then(setProfile)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const data = profile || user
  const displayName = data?.display_name || data?.displayName || data?.name || ''
  const email = data?.email || ''
  const initials = (displayName?.[0] || email?.[0] || '?').toUpperCase()

  return (
    <div className="profile-page">
      <div className="profile-header">
        <button className="profile-back" onClick={onBack} title="Voltar">
          ← Voltar
        </button>
      </div>

      <div className="profile-card">
        {loading ? (
          <div className="profile-loading">
            <div className="loading-spinner"></div>
            <p>Carregando perfil...</p>
          </div>
        ) : error && !user ? (
          <div className="profile-error">
            <span className="profile-error-icon">⚠️</span>
            <p>{error}</p>
          </div>
        ) : (
          <>
            <div className="profile-avatar">
              {initials}
            </div>
            <h1 className="profile-name">
              {displayName || 'Usuário'}
            </h1>
            <p className="profile-email">{email}</p>

            <div className="profile-details">
              <div className="profile-field">
                <span className="profile-label">Email</span>
                <span className="profile-value">{email || '-'}</span>
              </div>
              <div className="profile-field">
                <span className="profile-label">Nome</span>
                <span className="profile-value">{displayName || '-'}</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
