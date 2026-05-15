import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Copy, Eye, EyeOff, RefreshCw, Trash2, Check, Loader2, Tag } from 'lucide-react'
import { type Credential, fmtDuration, fmtBytes, copyText, apiFetch } from '../lib/utils'
import { useLang } from '../lib/i18n'
import { ProxyEnvPanel } from './ProxyEnvPanel'

interface Props {
  cred: Credential
  proxyAddr: string
  totpCode: string
  onDelete: () => void
  onRenew: (duration: string) => void
  onTotpError: () => void
  onFlash: (msg: string, type: 'ok' | 'err') => void
  onRefresh: () => void
}

export function CredentialCard({
  cred, proxyAddr, totpCode,
  onDelete, onRenew, onTotpError, onFlash, onRefresh,
}: Props) {
  const { t } = useLang()
  const [copiedUser, setCopiedUser] = useState(false)
  const [copiedPass, setCopiedPass] = useState(false)
  const [remaining, setRemaining] = useState(0)
  const [showRenew, setShowRenew] = useState(false)
  const [renewDur, setRenewDur] = useState('')

  // Password reveal
  const [revealedPass, setRevealedPass] = useState<string | null>(null)
  const [revealing, setRevealing] = useState(false)
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Label editing (permanent credentials only)
  const [editingLabel, setEditingLabel] = useState(false)
  const [labelInput, setLabelInput] = useState(cred.label ?? '')
  const [savingLabel, setSavingLabel] = useState(false)

  // Delete confirmation
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    const calc = () => setRemaining(new Date(cred.expires_at).getTime() - Date.now())
    calc()
    const timer = setInterval(calc, 1000)
    return () => clearInterval(timer)
  }, [cred.expires_at])

  // Keep labelInput in sync when cred.label changes (after refresh)
  useEffect(() => {
    if (!editingLabel) setLabelInput(cred.label ?? '')
  }, [cred.label, editingLabel])

  // Auto-hide revealed password after 30 s
  const scheduleHide = () => {
    if (revealTimer.current) clearTimeout(revealTimer.current)
    revealTimer.current = setTimeout(() => setRevealedPass(null), 30_000)
  }

  const hidePass = () => {
    if (revealTimer.current) clearTimeout(revealTimer.current)
    setRevealedPass(null)
  }

  const revealPassword = async () => {
    if (totpCode.length !== 6) { onFlash(t.needTotp, 'err'); return }
    setRevealing(true)
    try {
      const res = await apiFetch<{ password?: string; error?: string }>(
        'GET', `/api/credentials/${cred.id}/password`, undefined, totpCode
      )
      if (res.error) {
        if (res.error.includes('TOTP')) onTotpError()
        onFlash(res.error, 'err')
      } else if (res.password) {
        setRevealedPass(res.password)
        scheduleHide()
      }
    } finally {
      setRevealing(false)
    }
  }

  const saveLabel = async () => {
    if (totpCode.length !== 6) { onFlash(t.needTotp, 'err'); return }
    setSavingLabel(true)
    try {
      const res = await apiFetch<{ error?: string }>(
        'PUT', `/api/credentials/${cred.id}/label`, { label: labelInput }, totpCode
      )
      if (res.error) {
        if (res.error.includes('TOTP')) onTotpError()
        onFlash(res.error, 'err')
      } else {
        setEditingLabel(false)
        onFlash(t.labelSaved, 'ok')
        onRefresh()
      }
    } finally {
      setSavingLabel(false)
    }
  }

  const copy = async (text: string, which: 'user' | 'pass') => {
    await copyText(text)
    if (which === 'user') { setCopiedUser(true); setTimeout(() => setCopiedUser(false), 1500) }
    else                  { setCopiedPass(true); setTimeout(() => setCopiedPass(false), 1500) }
  }

  const isNever  = cred.expires_at === '0001-01-01T00:00:00Z' || !cred.expires_at
  const isActive = isNever || remaining > 0
  const isWarn   = !isNever && remaining > 0 && remaining < 10 * 60_000

  const statusBadge = !isActive
    ? <span className="badge bg-danger/15 text-danger">{t.badgeExpired}</span>
    : isNever
    ? <span className="badge bg-violet-500/15 text-violet-400">∞ {t.neverBadge}</span>
    : isWarn
    ? <span className="badge bg-warn/15 text-warn">{t.badgeExpiring}</span>
    : <span className="badge bg-success/15 text-success">{t.badgeActive}</span>

  const timeDisplay = isNever
    ? '—'
    : isActive
    ? t.expiresIn(fmtDuration(remaining))
    : t.purgeIn(fmtDuration(new Date(cred.clean_at).getTime() - Date.now()))

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20, scale: 0.96 }}
      transition={{ duration: 0.2 }}
      className={`card relative overflow-hidden transition-colors duration-300 ${!isActive ? 'opacity-60' : ''}`}
    >
      <div className={`absolute left-0 top-0 bottom-0 w-0.5 rounded-l-2xl ${
        !isActive ? 'bg-danger' : isWarn ? 'bg-warn' : 'bg-accent'
      }`} />

      <div className="pl-3 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {statusBadge}
            <span className="font-mono text-xs text-slate-500">{timeDisplay}</span>
          </div>
          <div className="flex items-center gap-1">
            {!confirmDelete ? (
              <>
                <button
                  onClick={() => setShowRenew(v => !v)}
                  className="btn-ghost p-1.5 rounded-lg text-xs"
                  title={t.renewBtn}
                >
                  <RefreshCw size={14} />
                </button>
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="btn-ghost p-1.5 rounded-lg text-xs text-danger/70 hover:text-danger"
                  title={t.deleteBtn}
                >
                  <Trash2 size={14} />
                </button>
              </>
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-danger/80">{t.confirmDeletePrompt}</span>
                <button
                  onClick={() => { onDelete(); setConfirmDelete(false) }}
                  className="text-xs px-2 py-0.5 rounded border border-danger/40 text-danger hover:bg-danger/10 transition-colors"
                >
                  {t.confirmDeleteBtn}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="text-xs px-2 py-0.5 rounded border border-surface-200 text-slate-400 hover:text-white transition-colors"
                >
                  {t.cancelBtn}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Credentials */}
        <div className="grid grid-cols-2 gap-3">
          {/* Username */}
          <div className="space-y-1">
            <p className="label">{t.fieldUser}</p>
            <div className="flex items-center gap-1.5 bg-bg-50/50 rounded-lg px-2.5 py-1.5 border border-surface-200/50">
              <span className="font-mono text-sm text-slate-200 truncate flex-1 select-all">
                {cred.username}
              </span>
              <button onClick={() => copy(cred.username, 'user')} className="text-slate-600 hover:text-accent-light transition-colors flex-shrink-0">
                {copiedUser ? <Check size={13} className="text-success" /> : <Copy size={13} />}
              </button>
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1">
            <p className="label">{t.fieldPass}</p>
            <div className="flex items-center gap-1.5 bg-bg-50/50 rounded-lg px-2.5 py-1.5 border border-surface-200/50">
              <span className="font-mono text-sm text-slate-200 truncate flex-1 select-all">
                {revealedPass ?? '••••••••'}
              </span>
              {revealedPass ? (
                <>
                  <button onClick={() => copy(revealedPass, 'pass')} className="text-slate-600 hover:text-accent-light transition-colors flex-shrink-0">
                    {copiedPass ? <Check size={13} className="text-success" /> : <Copy size={13} />}
                  </button>
                  <button onClick={hidePass} className="text-slate-600 hover:text-slate-300 transition-colors flex-shrink-0">
                    <EyeOff size={13} />
                  </button>
                </>
              ) : (
                <button
                  onClick={revealPassword}
                  disabled={revealing}
                  title={t.revealPass}
                  className="text-slate-600 hover:text-accent-light transition-colors flex-shrink-0 disabled:opacity-40"
                >
                  {revealing ? <Loader2 size={13} className="animate-spin" /> : <Eye size={13} />}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Label (permanent credentials only) */}
        {isNever && (
          <div>
            {editingLabel ? (
              <div className="flex items-center gap-1.5">
                <input
                  value={labelInput}
                  onChange={e => setLabelInput(e.target.value)}
                  placeholder={t.labelPlaceholder}
                  spellCheck={false}
                  autoFocus
                  onKeyDown={e => {
                    if (e.key === 'Enter') saveLabel()
                    if (e.key === 'Escape') setEditingLabel(false)
                  }}
                  className="flex-1 text-xs bg-bg-100 border border-surface-200 rounded-lg px-2 py-1
                             font-mono text-slate-200 placeholder-slate-600 focus:outline-none
                             focus:border-accent/50 transition-colors min-w-0"
                />
                <button
                  onClick={saveLabel}
                  disabled={savingLabel}
                  className="btn-success text-xs px-2 py-1 disabled:opacity-50"
                >
                  {savingLabel ? '…' : t.save}
                </button>
                <button
                  onClick={() => { setEditingLabel(false); setLabelInput(cred.label ?? '') }}
                  className="btn-ghost text-xs px-2 py-1"
                >
                  {t.cancelBtn}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setEditingLabel(true)}
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                <Tag size={11} />
                {cred.label
                  ? <span className="text-slate-300 font-medium">{cred.label}</span>
                  : <span className="italic">{t.labelPlaceholder}</span>
                }
              </button>
            )}
          </div>
        )}

        {/* Traffic stats */}
        {(cred.bytes_up > 0 || cred.bytes_down > 0) && (
          <div className="flex items-center gap-3 text-xs text-slate-600 font-mono">
            <span>↑ {fmtBytes(cred.bytes_up)}</span>
            <span>↓ {fmtBytes(cred.bytes_down)}</span>
          </div>
        )}

        {/* Proxy env-var panel */}
        <ProxyEnvPanel
          proxyAddr={proxyAddr}
          username={cred.username}
          password={revealedPass ?? ''}
        />

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
                <span className="text-xs text-slate-500">{t.renewFor}</span>
                {t.durations.map(d => (
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
                  {t.confirmRenew}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
