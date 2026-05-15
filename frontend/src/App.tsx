import { useState, useEffect, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { SetupPage } from './pages/SetupPage'
import { Dashboard } from './pages/Dashboard'
import { apiFetch, type ApiStatus } from './lib/utils'
import { FairyLogo } from './components/Logo'

export default function App() {
  const [status, setStatus] = useState<ApiStatus | null>(null)
  const [totpCode, setTotpCode] = useState('')
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const data = await apiFetch<ApiStatus>('GET', '/api/status')
      setStatus(data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    const t = setInterval(refresh, 30_000)
    return () => clearInterval(t)
  }, [refresh])

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <motion.div
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <FairyLogo size={48} className="opacity-60" />
        </motion.div>
      </div>
    )
  }

  if (!status) return null

  return (
    <AnimatePresence mode="wait">
      {status.totp_status !== 'active' ? (
        <motion.div
          key="setup"
          className="flex-1 flex flex-col"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <SetupPage
            qrCode={status.qr_code || ''}
            secret={status.totp_secret || ''}
            onComplete={refresh}
          />
        </motion.div>
      ) : (
        <motion.div
          key="dashboard"
          className="flex-1 flex flex-col"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <Dashboard
            credentials={status.credentials || []}
            proxyAddr={status.proxy_addr}
            onRefresh={refresh}
            totpCode={totpCode}
            onTotpChange={setTotpCode}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
