import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, QrCode, Server } from 'lucide-react'
import { TOTPInput } from '../components/TOTPInput'
import { CredentialCard } from '../components/CredentialCard'
import { QRModal } from '../components/QRModal'
import { FairyLogo, PixeyWordmark } from '../components/Logo'
import { type Credential, apiFetch } from '../lib/utils'

interface Props {
  credentials: Credential[]
  proxyAddr: string
  onRefresh: () => void
  totpCode: string
  onTotpChange: (v: string) => void
}

const DURATION_OPTS = [
  { label: '30 min',  value: '30m',  default: true },
  { label: '1 hour',  value: '1h'   },
  { label: '6 hours', value: '6h'   },
  { label: '12 hours',value: '12h'  },
  { label: '1 day',   value: '1d'   },
  { label: '3 days',  value: '3d'   },
  { label: '7 days',  value: '7d'   },
]

export function Dashboard({ credentials, proxyAddr, onRefresh, totpCode, onTotpChange }: Props) {
  const [totpError, setTotpError] = useState(false)
  const [dur, setDur] = useState('30m')
  const [creating, setCreating] = useState(false)
  const [msg, setMsg] = useState<{ text: string; type: 'ok' | 'err' } | null>(null)
  const [qrModal, setQrModal] = useState<{ qr: string; secret: string } | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const flash = (text: string, type: 'ok' | 'err') => {
    setMsg({ text, type })
    setTimeout(() => setMsg(null), 3500)
  }

  const assertTotp = () => {
    if (totpCode.length !== 6) {
      flash('Enter your 6-digit TOTP code first', 'err')
      return false
    }
    return true
  }

  const createCred = async () => {
    if (!assertTotp()) return
    setCreating(true)
    try {
      const res = await apiFetch<{ error?: string; username?: string; password?: string }>(
        'POST', '/api/credentials', { duration: dur }, totpCode
      )
      if (res.error) {
        if (res.error.includes('TOTP')) setTotpError(true)
        flash(res.error, 'err')
      } else {
        setTotpError(false)
        flash(`Created: ${res.username} / ${res.password}`, 'ok')
        setShowCreate(false)
        onRefresh()
      }
    } finally {
      setCreating(false)
    }
  }

  const deleteCred = async (id: string) => {
    if (!assertTotp()) return
    const res = await apiFetch<{ error?: string }>('DELETE', `/api/credentials/${id}`, null, totpCode)
    if (res.error) { if (res.error.includes('TOTP')) setTotpError(true); flash(res.error, 'err') }
    else { setTotpError(false); flash('Credential deleted', 'ok'); onRefresh() }
  }

  const renewCred = async (id: string, duration: string) => {
    if (!assertTotp()) return
    const res = await apiFetch<{ error?: string }>('PUT', `/api/credentials/${id}/renew`, { duration }, totpCode)
    if (res.error) { if (res.error.includes('TOTP')) setTotpError(true); flash(res.error, 'err') }
    else { setTotpError(false); flash('Credential renewed', 'ok'); onRefresh() }
  }

  const showQR = async () => {
    if (!assertTotp()) return
    const res = await apiFetch<{ error?: string; qr_code?: string; totp_secret?: string }>(
      'GET', `/api/totp/qr?code=${totpCode}`, undefined, totpCode
    )
    if (res.error) { if (res.error.includes('TOTP')) setTotpError(true); flash(res.error, 'err') }
    else if (res.qr_code) {
      setTotpError(false)
      setQrModal({ qr: res.qr_code, secret: res.totp_secret || '' })
    }
  }

  const activeCreds = credentials.filter(c => new Date(c.expires_at).getTime() > Date.now())
  const expiredCreds = credentials.filter(c => new Date(c.expires_at).getTime() <= Date.now())

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      {/* Header */}
      <header className="glass sticky top-0 z-20 px-5 py-3 flex items-center justify-between border-b border-surface-200/50">
        <div className="flex items-center gap-2.5">
          <FairyLogo size={28} />
          <PixeyWordmark className="text-xl" />
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 bg-bg-50 border border-surface-200 rounded-lg px-2.5 py-1.5">
            <Server size={12} />
            <code className="font-mono text-accent-light">{proxyAddr}</code>
          </div>
          <button onClick={showQR} className="btn-ghost p-2 rounded-lg border border-surface-200" title="Show TOTP QR">
            <QrCode size={15} />
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 space-y-5">

        {/* Toast */}
        <AnimatePresence>
          {msg && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`rounded-xl px-4 py-3 text-sm font-medium border ${
                msg.type === 'ok'
                  ? 'bg-success/10 border-success/25 text-success'
                  : 'bg-danger/10 border-danger/25 text-danger'
              }`}
            >
              {msg.text}
            </motion.div>
          )}
        </AnimatePresence>

        {/* TOTP panel */}
        <section className="card">
          <h2 className="label mb-3">TOTP Verification</h2>
          <TOTPInput
            value={totpCode}
            onChange={v => { onTotpChange(v); setTotpError(false) }}
            error={totpError}
          />
        </section>

        {/* Create credential */}
        <section className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="label">New Credential</h2>
            <button
              onClick={() => setShowCreate(v => !v)}
              className="btn-ghost p-1.5 rounded-lg border border-surface-200 text-accent-light"
            >
              <Plus size={15} />
            </button>
          </div>

          <AnimatePresence>
            {showCreate && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="space-y-3 pt-1">
                  <div>
                    <label className="label">Valid for</label>
                    <div className="flex flex-wrap gap-2">
                      {DURATION_OPTS.map(d => (
                        <button
                          key={d.value}
                          onClick={() => setDur(d.value)}
                          className={`text-xs px-3 py-1.5 rounded-lg border transition-all duration-150 ${
                            dur === d.value
                              ? 'bg-accent/20 border-accent/50 text-accent-light'
                              : 'border-surface-200 text-slate-400 hover:border-accent/30 hover:text-white'
                          }`}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={createCred}
                    disabled={creating}
                    className="btn-primary w-full justify-center disabled:opacity-50"
                  >
                    {creating ? 'Creating…' : '+ Create credential'}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {!showCreate && (
            <p className="text-slate-600 text-xs">
              {activeCreds.length} active · {expiredCreds.length} expired
            </p>
          )}
        </section>

        {/* Credential list */}
        {credentials.length > 0 && (
          <section className="space-y-2.5">
            <h2 className="label px-1">
              Credentials ({credentials.length})
            </h2>
            <AnimatePresence mode="popLayout">
              {credentials.map(c => (
                <CredentialCard
                  key={c.id}
                  cred={c}
                  onDelete={() => deleteCred(c.id)}
                  onRenew={dur => renewCred(c.id, dur)}
                />
              ))}
            </AnimatePresence>
          </section>
        )}

        {credentials.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16 text-slate-600 space-y-2"
          >
            <FairyLogo size={40} className="mx-auto opacity-30 animate-float" />
            <p className="text-sm">No credentials yet</p>
            <p className="text-xs text-slate-700">Create one above to get started</p>
          </motion.div>
        )}
      </main>

      {/* QR Modal */}
      {qrModal && (
        <QRModal
          qrBase64={qrModal.qr}
          secret={qrModal.secret}
          onClose={() => setQrModal(null)}
        />
      )}
    </div>
  )
}
