import { useState, useEffect, useRef } from 'react'
import { AuthProvider, useAuth } from './AuthContext'
import { getFiles, getFolders, uploadFile, downloadFile, deleteFile, logout, getFilePreviewUrl } from './api'
import Login from './Login'
import Signup from './Signup'
import './App.css'

function formatSize(bytes) {
  if (!bytes) return '-'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function getFileIcon(file) {
  const type = file.mime_type || file.type || file.content_type || ''
  if (type.startsWith('image/')) return '🖼️'
  if (type.startsWith('video/')) return '🎬'
  if (type.startsWith('audio/')) return '🎵'
  if (type.includes('pdf')) return '📄'
  return '📁'
}

function FilePreview({ file, onClick }) {
  const [previewUrl, setPreviewUrl] = useState(null)
  const [loading, setLoading] = useState(true)
  const urlRef = useRef(null)
  const type = file.mime_type || file.type || file.content_type || ''

  useEffect(() => {
    if (!type.startsWith('image/')) {
      setLoading(false)
      return
    }

    // Se o file já tem URL de preview (API Supabase storage)
    const directUrl = file.preview_url || file.public_url || file.signed_url
    if (directUrl) {
      setPreviewUrl(directUrl)
      setLoading(false)
      return
    }

    let isMounted = true
    setLoading(true)
    getFilePreviewUrl(file)
      .then((url) => {
        urlRef.current = url
        if (isMounted) setPreviewUrl(url)
        else if (url && !url.startsWith('http')) URL.revokeObjectURL(url)
      })
      .catch(() => { if (isMounted) setPreviewUrl(null) })
      .finally(() => { if (isMounted) setLoading(false) })

    return () => {
      isMounted = false
      if (urlRef.current && !urlRef.current.startsWith('http')) {
        URL.revokeObjectURL(urlRef.current)
        urlRef.current = null
      }
    }
  }, [file.id])

  if (!type.startsWith('image/')) {
    return <span className="item-icon">{getFileIcon(file)}</span>
  }

  if (loading || !previewUrl) {
    return <span className="item-icon item-icon-placeholder">{getFileIcon(file)}</span>
  }

  return (
    <div
      className="item-preview item-preview-clickable"
      onClick={(e) => { e.stopPropagation(); onClick?.(file); }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.(file)}
      title="Clique para ampliar"
    >
      <img src={previewUrl} alt="" />
    </div>
  )
}

function ImageViewer({ file, onClose, onDownload }) {
  const [imageUrl, setImageUrl] = useState(null)
  const [loading, setLoading] = useState(true)
  const urlRef = useRef(null)
  const type = file?.mime_type || file?.type || file?.content_type || ''

  useEffect(() => {
    if (!file || !type.startsWith('image/')) return
    const directUrl = file.preview_url || file.public_url || file.signed_url
    if (directUrl) {
      setImageUrl(directUrl)
      setLoading(false)
      return
    }
    getFilePreviewUrl(file)
      .then((url) => {
        urlRef.current = url
        setImageUrl(url)
      })
      .finally(() => setLoading(false))
    return () => {
      if (urlRef.current && !urlRef.current.startsWith('http')) {
        URL.revokeObjectURL(urlRef.current)
      }
    }
  }, [file?.id])

  useEffect(() => {
    const handleKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  if (!file) return null

  return (
    <div className="image-viewer-overlay" onClick={onClose}>
      <div className="image-viewer" onClick={(e) => e.stopPropagation()}>
        <div className="image-viewer-header">
          <span className="image-viewer-title">{file.name || file.file_name || file.filename}</span>
          <div className="image-viewer-actions">
            <button onClick={() => onDownload(file)} title="Baixar">⬇️ Baixar</button>
            <button onClick={onClose} title="Fechar">✕ Fechar</button>
          </div>
        </div>
        <div className="image-viewer-content">
          {loading ? (
            <div className="image-viewer-loading">Carregando...</div>
          ) : imageUrl ? (
            <img src={imageUrl} alt="" />
          ) : (
            <div className="image-viewer-error">Erro ao carregar imagem</div>
          )}
        </div>
      </div>
    </div>
  )
}

function Sidebar({ currentFolderId, viewOptions, onNavigate, onLogout, user, recentFolders = [] }) {
  const [rootFolders, setRootFolders] = useState([])

  useEffect(() => {
    getFolders(null).then(setRootFolders).catch(() => setRootFolders([]))
  }, [])

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="logo">☁️</span>
        <span className="brand-name">CloudVault</span>
      </div>

      <nav className="sidebar-nav">
        <button
          className={`nav-item ${!currentFolderId && !viewOptions.trashed && !viewOptions.favorites && !viewOptions.recent ? 'active' : ''}`}
          onClick={() => onNavigate(null, [])}
        >
          <span className="nav-icon">📁</span>
          <span>Meus arquivos</span>
        </button>
          <button
            className={`nav-item ${viewOptions.recent ? 'active' : ''}`}
            onClick={() => onNavigate(null, [], { recent: true, trashed: false, favorites: false })}
        >
          <span className="nav-icon">🕐</span>
          <span>Recentes</span>
        </button>
        <button
          className={`nav-item ${viewOptions.trashed ? 'active' : ''}`}
          onClick={() => onNavigate(null, [], { trashed: true })}
        >
          <span className="nav-icon">🗑️</span>
          <span>Lixeira</span>
        </button>
        <button
          className={`nav-item ${viewOptions.favorites ? 'active' : ''}`}
          onClick={() => onNavigate(null, [], { favorites: true })}
        >
          <span className="nav-icon">⭐</span>
          <span>Favoritos</span>
        </button>
      </nav>

      {recentFolders.length > 0 && (
        <div className="sidebar-folders">
          <div className="sidebar-title">Recentes</div>
          {recentFolders.map((folder) => (
            <button
              key={folder.id}
              className={`folder-item ${currentFolderId === folder.id && !viewOptions.trashed && !viewOptions.favorites ? 'active' : ''}`}
              onClick={() => onNavigate(folder.id, folder.breadcrumb || [{ id: folder.id, name: folder.name || folder.folder_name }])}
            >
              <span className="folder-icon">🕐</span>
              <span className="folder-name">{folder.name || folder.folder_name}</span>
            </button>
          ))}
        </div>
      )}

      <div className="sidebar-folders">
        <div className="sidebar-title">Pastas</div>
        {rootFolders.map((folder) => (
          <button
            key={folder.id}
            className={`folder-item ${currentFolderId === folder.id && !viewOptions.trashed && !viewOptions.favorites ? 'active' : ''}`}
            onClick={() => onNavigate(folder.id, [{ id: folder.id, name: folder.name || folder.folder_name }])}
          >
            <span className="folder-icon">📁</span>
            <span className="folder-name">{folder.name || folder.folder_name}</span>
          </button>
        ))}
        {rootFolders.length === 0 && (
          <span className="sidebar-empty">Nenhuma pasta</span>
        )}
      </div>

      <div className="sidebar-footer">
        <div className="user-info">
          <span className="user-avatar">{user?.email?.[0]?.toUpperCase() || '?'}</span>
          <span className="user-email">{user?.email || 'Usuário'}</span>
        </div>
        <button className="logout-btn" onClick={onLogout}>
          Sair
        </button>
      </div>
    </aside>
  )
}

function FileManager() {
  const { user, setUser } = useAuth()
  const [files, setFiles] = useState([])
  const [folders, setFolders] = useState([])
  const [currentFolderId, setCurrentFolderId] = useState(null)
  const [breadcrumb, setBreadcrumb] = useState([])
  const [viewOptions, setViewOptions] = useState({ trashed: false, favorites: false, recent: false })
  const [recentFolders, setRecentFolders] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const [viewingImage, setViewingImage] = useState(null)

  const loadContent = async () => {
    try {
      setLoading(true)
      setError(null)
      const [filesData, foldersData] = await Promise.all([
        getFiles(currentFolderId, viewOptions),
        (viewOptions.trashed || viewOptions.favorites || viewOptions.recent) ? [] : getFolders(currentFolderId).catch(() => [])
      ])
      setFiles(Array.isArray(filesData) ? filesData : [])
      setFolders(Array.isArray(foldersData) ? foldersData : [])
    } catch (err) {
      setError(err.message)
      setFiles([])
      setFolders([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadContent()
  }, [currentFolderId, viewOptions.trashed, viewOptions.favorites])

  const navigateTo = (folderId, newBreadcrumb, options) => {
    setCurrentFolderId(folderId)
    setBreadcrumb(newBreadcrumb || [])
    setViewOptions(options || { trashed: false, favorites: false, recent: false })
  }

  const addToRecent = (folder, newBreadcrumb) => {
    const item = {
      id: folder.id,
      name: folder.name || folder.folder_name,
      breadcrumb: newBreadcrumb
    }
    setRecentFolders((prev) => {
      const filtered = prev.filter((f) => f.id !== folder.id)
      return [item, ...filtered].slice(0, 8)
    })
  }

  const enterFolder = (folder) => {
    const newCrumb = [...breadcrumb, { id: folder.id, name: folder.name || folder.folder_name }]
    setBreadcrumb(newCrumb)
    setCurrentFolderId(folder.id)
    setViewOptions({ trashed: false, favorites: false, recent: false })
    addToRecent(folder, newCrumb)
  }

  const goBack = (index) => {
    if (index === -1) {
      setBreadcrumb([])
      setCurrentFolderId(null)
      setViewOptions({ trashed: false, favorites: false, recent: false })
    } else {
      const target = breadcrumb[index]
      setBreadcrumb((prev) => prev.slice(0, index + 1))
      setCurrentFolderId(target.id)
    }
  }

  const handleUpload = async (e) => {
    const selected = e.target.files
    if (!selected?.length) return

    setUploading(true)
    try {
      for (let i = 0; i < selected.length; i++) {
        await uploadFile(selected[i], currentFolderId)
      }
      await loadContent()
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleDownload = async (file) => {
    try {
      await downloadFile(file)
    } catch (err) {
      setError(err.message)
    }
  }

  const handleDelete = async (file) => {
    if (!confirm(`Excluir "${file.name || file.file_name || file.filename}"?`)) return
    try {
      await deleteFile(file.id)
      await loadContent()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleLogout = async () => {
    await logout()
    setUser(null)
  }

  const canUpload = !viewOptions.trashed && !viewOptions.favorites && !viewOptions.recent

  return (
    <div className="app">
      <Sidebar
        currentFolderId={currentFolderId}
        viewOptions={viewOptions}
        onNavigate={navigateTo}
        onLogout={handleLogout}
        user={user}
        recentFolders={recentFolders}
      />

      <div className="main-wrapper">
        <header className="header">
          <div className="breadcrumb">
            <button className="breadcrumb-item" onClick={() => goBack(-1)}>
              <span className="breadcrumb-icon">📁</span>
              Raiz
            </button>
            {breadcrumb.map((item, i) => (
              <span key={item.id} className="breadcrumb-chunk">
                <span className="breadcrumb-sep">/</span>
                <button className="breadcrumb-item" onClick={() => goBack(i)}>
                  {item.name}
                </button>
              </span>
            ))}
          </div>
          <div className="header-actions">
            {canUpload && (
              <label className="upload-btn">
                <input
                  type="file"
                  multiple
                  onChange={handleUpload}
                  disabled={uploading}
                />
                <span className="btn-icon">+</span>
                {uploading ? 'Enviando...' : 'Enviar arquivos'}
              </label>
            )}
          </div>
        </header>

        <main className="main">
          {error && (
            <div className="error-banner">
              <span>{error}</span>
              <button onClick={() => setError(null)} className="error-close">×</button>
            </div>
          )}

          {loading ? (
            <div className="loading">
              <div className="loading-spinner"></div>
              <p>Carregando...</p>
            </div>
          ) : viewOptions.recent && recentFolders.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">🕐</div>
            <h3>Nenhuma pasta recente</h3>
            <p>As pastas que você acessar aparecerão aqui</p>
          </div>
        ) : !viewOptions.recent && files.length === 0 && folders.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">📂</div>
              <h3>Nenhum arquivo</h3>
              <p>Arraste arquivos aqui ou use o botão acima para enviar</p>
              {canUpload && (
                <label className="empty-upload-btn">
                  <input type="file" multiple onChange={handleUpload} />
                  Enviar arquivos
                </label>
              )}
              <button className="reload-btn" onClick={loadContent}>
                Recarregar
              </button>
            </div>
          ) : (
            <div className="content-grid">
              {viewOptions.recent && recentFolders.map((folder) => (
                <div
                  key={folder.id}
                  className="item-card folder-card"
                  onClick={() => navigateTo(folder.id, folder.breadcrumb)}
                >
                  <span className="item-icon">🕐</span>
                  <span className="item-name">{folder.name || folder.folder_name}</span>
                  <span className="item-meta">Acessado recentemente</span>
                </div>
              ))}
              {!viewOptions.recent && folders.map((folder) => (
                <div
                  key={folder.id}
                  className="item-card folder-card"
                  onClick={() => enterFolder(folder)}
                >
                  <span className="item-icon">📁</span>
                  <span className="item-name">{folder.name || folder.folder_name}</span>
                  <span className="item-meta">Pasta</span>
                </div>
              ))}
              {!viewOptions.recent && files.map((file) => {
                const isImage = (file.mime_type || file.type || '').startsWith('image/')
                return (
                  <div
                    key={file.id}
                    className={`item-card file-card ${isImage ? 'file-card-image' : ''}`}
                    onClick={isImage ? () => setViewingImage(file) : undefined}
                  >
                    <FilePreview file={file} onClick={(f) => setViewingImage(f)} />
                    <span className="item-name">{file.name || file.file_name || file.filename}</span>
                    <span className="item-meta">
                      {formatSize(file.size)} • {file.created_at ? new Date(file.created_at).toLocaleDateString('pt-BR') : '-'}
                    </span>
                    <div className="item-actions" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => handleDownload(file)} title="Baixar">⬇️</button>
                      <button onClick={() => handleDelete(file)} title="Excluir">🗑️</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </main>

        {viewingImage && (
          <ImageViewer
            file={viewingImage}
            onClose={() => setViewingImage(null)}
            onDownload={handleDownload}
          />
        )}
      </div>
    </div>
  )
}

function UpdateStatus() {
  const [status, setStatus] = useState(null)

  useEffect(() => {
    if (!window.electronAPI) return
    const check = () => setStatus('checking')
    const available = () => setStatus('available')
    const done = () => setStatus(null)
    const err = () => setStatus(null)

    window.electronAPI.onUpdateChecking(check)
    window.electronAPI.onUpdateAvailable(available)
    window.electronAPI.onUpdateNotAvailable(done)
    window.electronAPI.onUpdateError(err)

    return () => {
      setStatus(null)
    }
  }, [])

  if (!status) return null

  return (
    <div className={`update-status ${status}`}>
      {status === 'checking' && (
        <span>Buscando atualização...</span>
      )}
      {status === 'available' && (
        <span>Atualização disponível - baixando...</span>
      )}
    </div>
  )
}

function AppContent() {
  const { user, loading, setUser } = useAuth()
  const [showSignup, setShowSignup] = useState(false)
  const [signupEmail, setSignupEmail] = useState('')

  if (loading) {
    return (
      <>
        <UpdateStatus />
        <div className="loading-screen">Carregando...</div>
      </>
    )
  }

  if (!user) {
    return (
      <>
        <UpdateStatus />
        {showSignup ? (
      <Signup
        onLogin={(email) => {
          setSignupEmail(email || '')
          setShowSignup(false)
        }}
      />
    ) : (
      <Login
        onSignup={() => setShowSignup(true)}
        onSuccess={(u) => setUser(u)}
        initialEmail={signupEmail}
      />
        )}
      </>
    )
  }

  return (
    <>
      <UpdateStatus />
      <FileManager />
    </>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
