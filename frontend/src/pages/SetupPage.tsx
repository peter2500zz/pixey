import { useState } from 'react'
import { motion } from 'framer-motion'
import { ShieldCheck, Smartphone } from 'lucide-react'
import { TOTPInput } from '../components/TOTPInput'
import { FairyLogo, PixeyWordmark } from '../components/Logo'
import { apiFetch } from '../lib/utils'

interface Props {
  qrCode: string
  secret: string
  onComplete: () => void
}

export function SetupPage({ qrCode, secret, onComplete }: Props) {
  const [code, setCode] = useState('')
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<'qr' | 'verify'>('qr')

  const confirm = async () => {
    if (code.length !== 6) return
    setLoading(true)
    setError(false)
    try {
      const res = await apiFetch<{ error?: string }>('POST', '/api/setup', { code })
      if (res.error) { setError(true); setCode('') }
      else onComplete()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center p-6 min-h-screen relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-soft/5 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="card w-full max-w-md relative z-10"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <motion.div
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            className="inline-block mb-3"
          >
            <FairyLogo size={64} />
          </motion.div>
          <div className="flex items-center justify-center gap-2 mb-1">
            <PixeyWordmark className="text-2xl" />
          </div>
          <p className="text-slate-500 text-sm">Authenticator Setup</p>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center gap-3 mb-6">
          <StepDot n={1} active={step === 'qr'} done={step === 'verify'} label="Scan QR" />
          <div className="flex-1 h-px bg-surface-200" />
          <StepDot n={2} active={step === 'verify'} done={false} label="Verify" />
        </div>

        {step === 'qr' ? (
          <motion.div
            key="qr"
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            className="space-y-5"
          >
            <div className="flex items-start gap-3 bg-accent/8 border border-accent/20 rounded-xl p-4 text-sm text-slate-300">
              <Smartphone size={18} className="text-accent-light flex-shrink-0 mt-0.5" />
              <p>Open your authenticator app (e.g., Google Authenticator, Authy) and scan the QR code below.</p>
            </div>

            {qrCode && (
              <div className="flex justify-center">
                <div className="p-3 bg-white rounded-2xl shadow-glow">
                  <img
                    src={`data:image/png;base64,${qrCode}`}
                    alt="TOTP QR code"
                    className="w-52 h-52"
                    style={{ imageRendering: 'pixelated' }}
                  />
                </div>
              </div>
            )}

            <div className="bg-bg-50 rounded-xl px-4 py-3 border border-surface-200">
              <p className="label text-center mb-1">Manual entry</p>
              <p className="font-mono text-sm text-slate-200 tracking-widest text-center select-all break-all">
                {secret}
              </p>
            </div>

            <button
              onClick={() => setStep('verify')}
              className="btn-primary w-full justify-center"
            >
              I've scanned it →
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="verify"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <div className="flex items-start gap-3 bg-success/8 border border-success/20 rounded-xl p-4 text-sm text-slate-300">
              <ShieldCheck size={18} className="text-success flex-shrink-0 mt-0.5" />
              <p>Enter the 6-digit code from your authenticator app to confirm setup.</p>
            </div>

            <TOTPInput
              value={code}
              onChange={setCode}
              error={error}
              disabled={loading}
              label="Enter current code"
            />

            <div className="flex gap-2">
              <button onClick={() => setStep('qr')} className="btn-ghost flex-1 border border-surface-200">
                ← Back
              </button>
              <button
                onClick={confirm}
                disabled={code.length !== 6 || loading}
                className="btn-primary flex-1 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? 'Verifying…' : 'Activate'}
              </button>
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  )
}

function StepDot({ n, active, done, label }: { n: number; active: boolean; done: boolean; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
        done ? 'bg-success text-white' :
        active ? 'bg-accent text-white shadow-glow-sm' :
        'bg-surface-100 text-slate-500'
      }`}>
        {done ? '✓' : n}
      </div>
      <span className={`text-xs ${active ? 'text-white' : 'text-slate-600'}`}>{label}</span>
    </div>
  )
}
