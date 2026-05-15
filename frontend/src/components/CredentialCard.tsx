import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Copy, Eye, EyeOff, RefreshCw, Trash2, Check } from 'lucide-react'
import { type Credential, fmtDuration, copyText } from '../lib/utils'

interface Props {
  cred: Credential
  onDelete: () => void
  onRenew: (duration: string) => void
}

const DURATIONS = [
  { label: '30m', value: '30m' },
  { label: '1h',  value: '1h'  },
  { label: '6h',  value: '6h'  },
  { label: '12h', value: '12h' },
  { label: '1d',  value: '1d'  },
  { label: '3d',  value: '3d'  },
  { label: '7d',  value: '7d'  },
]

export function CredentialCard({ cred, onDelete, onRenew }: Props) {
  const [showPass, setShowPass] = useState(false)
  const [copiedUser, setCopiedUser] = useState(false)
  const [copiedPass, setCopiedPass] = useState(false)
  const [remaining, setRemaining] = useState(0)
  const [showRenew, setShowRenew] = useState(false)
  const [renewDur, setRenewDur] = useState('')

  useEffect(() => {
    const calc = () => setRemaining(new Date(cred.expires_at).getTime() - Date.now())
    calc()
    const t = setInterval(calc, 1000)
    return () => clearInterval(t)
  }, [cred.expires_at])

  const isActive = remaining > 0
  const isWarn = remaining > 0 && remaining < 10 * 60_000

  const copy = async (text: string, which: 'user' | 'pass') => {
    await copyText(text)
    if (which === 'user') { setCopiedUser(true); setTimeout(() => setCopiedUser(false), 1500) }
    else { setCopiedPass(true); setTimeout(() => setCopiedPass(false), 1500) }
  }

  const statusBadge = !isActive
    ? <span className="badge bg-danger/15 text-danger">Expired</span>
    : isWarn
    ? <span className="badge bg-warn/15 text-warn">Expiring</span>
    : <span className="badge bg-success/15 text-success">Active</span>

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20, scale: 0.96 }}
      transition={{ duration: 0.2 }}
      className={`card relative overflow-hidden transition-colors duration-300 ${
        !isActive ? 'opacity-60' : ''
      }`}
    >
      {/* Accent stripe */}
      <div className={`absolute left-0 top-0 bottom-0 w-0.5 rounded-l-2xl ${
        !isActive ? 'bg-danger' : isWarn ? 'bg-warn' : 'bg-accent'
      }`} />

      <div className="pl-3 space-y-3">
        {/* Header row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {statusBadge}
            <span className="font-mono text-xs text-slate-500">
              {isActive ? fmtDuration(remaining) : 'Purge in ' + fmtDuration(new Date(cred.clean_at).getTime() - Date.now())}
            </span>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => setShowRenew(v => !v)}
              className="btn-ghost p-1.5 rounded-lg text-xs"
              title="Renew"
            >
              <RefreshCw size={14} />
            </button>
            <button
              onClick={onDelete}
              className="btn-ghost p-1.5 rounded-lg text-xs text-danger/70 hover:text-danger"
              title="Delete"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        {/* Credentials */}
        <div className="grid grid-cols-2 gap-3">
          <CredField
            label="Username"
            value={cred.username}
            copied={copiedUser}
            onCopy={() => copy(cred.username, 'user')}
          />
          <CredField
            label="Password"
            value={cred.password}
            hidden={!showPass}
            copied={copiedPass}
            onCopy={() => copy(cred.password, 'pass')}
            onToggleShow={() => setShowPass(v => !v)}
            showToggle
          />
        </div>

        {/* Renew panel */}
        <AnimatePresence>
          {showRenew && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="pt-2 border-t border-surface-200 flex items-center gap-2 flex-wrap">
                <span className="text-xs text-slate-500">Renew for:</span>
                {DURATIONS.map(d => (
                  <button
                    key={d.value}
                    onClick={() => setRenewDur(d.value)}
                    className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${
                      renewDur === d.value
                        ? 'bg-accent/20 border-accent/50 text-accent-light'
                        : 'border-surface-200 text-slate-400 hover:border-accent/30 hover:text-slate-200'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
                <button
                  onClick={() => { onRenew(renewDur); setShowRenew(false) }}
                  className="btn-success py-1 px-3 text-xs ml-auto"
                >
                  Confirm
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

function CredField({
  label, value, hidden, copied, onCopy, onToggleShow, showToggle,
}: {
  label: string; value: string; hidden?: boolean; copied: boolean;
  onCopy: () => void; onToggleShow?: () => void; showToggle?: boolean;
}) {
  return (
    <div className="space-y-1">
      <p className="label">{label}</p>
      <div className="flex items-center gap-1.5 bg-bg-50/50 rounded-lg px-2.5 py-1.5 border border-surface-200/50">
        <span className="font-mono text-sm text-slate-200 truncate flex-1 select-all">
          {hidden ? '•'.repeat(value.length) : value}
        </span>
        {showToggle && (
          <button onClick={onToggleShow} className="text-slate-600 hover:text-slate-300 transition-colors flex-shrink-0">
            {hidden ? <Eye size={13} /> : <EyeOff size={13} />}
          </button>
        )}
        <button onClick={onCopy} className="text-slate-600 hover:text-accent-light transition-colors flex-shrink-0">
          {copied ? <Check size={13} className="text-success" /> : <Copy size={13} />}
        </button>
      </div>
    </div>
  )
}
