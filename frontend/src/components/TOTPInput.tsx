import { useRef, useState, useCallback, type KeyboardEvent, type ClipboardEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface TOTPInputProps {
  value: string
  onChange: (val: string) => void
  error?: boolean
  disabled?: boolean
  label?: string
}

export function TOTPInput({ value, onChange, error, disabled, label }: TOTPInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([])

  const digits = value.padEnd(6, '').split('').slice(0, 6)

  const focus = (i: number) => {
    refs.current[i]?.focus()
    refs.current[i]?.select()
  }

  const update = useCallback((i: number, ch: string) => {
    const d = digits.slice()
    d[i] = ch
    const next = d.join('').replace(/[^0-9]/g, '')
    onChange(next.slice(0, 6))
    if (ch && i < 5) setTimeout(() => focus(i + 1), 0)
  }, [digits, onChange])

  const handleKey = useCallback((i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault()
      if (digits[i]) {
        update(i, '')
      } else if (i > 0) {
        update(i - 1, '')
        setTimeout(() => focus(i - 1), 0)
      }
    } else if (e.key === 'ArrowLeft' && i > 0) {
      e.preventDefault(); focus(i - 1)
    } else if (e.key === 'ArrowRight' && i < 5) {
      e.preventDefault(); focus(i + 1)
    } else if (e.key === 'Delete') {
      e.preventDefault(); update(i, '')
    }
  }, [digits, update])

  const handleInput = useCallback((i: number, e: React.FormEvent<HTMLInputElement>) => {
    const v = (e.currentTarget.value).replace(/[^0-9]/g, '')
    if (v.length > 1) {
      // paste via typing — distribute
      const fill = v.slice(0, 6 - i)
      const newDigits = digits.slice()
      for (let j = 0; j < fill.length; j++) newDigits[i + j] = fill[j]
      onChange(newDigits.join('').slice(0, 6))
      const next = Math.min(i + fill.length, 5)
      setTimeout(() => focus(next), 0)
    } else {
      update(i, v)
    }
  }, [digits, update, onChange])

  const handlePaste = useCallback((e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    onChange(pasted)
    const next = Math.min(pasted.length, 5)
    setTimeout(() => focus(next), 0)
  }, [onChange])

  return (
    <div className="flex flex-col items-center gap-3">
      {label && <p className="label text-center">{label}</p>}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <motion.input
            key={i}
            ref={el => { refs.current[i] = el }}
            type="text"
            inputMode="numeric"
            pattern="[0-9]"
            maxLength={6}
            value={digits[i] || ''}
            onInput={e => handleInput(i, e)}
            onKeyDown={e => handleKey(i, e)}
            onPaste={handlePaste}
            onFocus={() => {}}
            onBlur={() => {}}
            disabled={disabled}
            className={[
              'digit-input',
              digits[i] ? 'filled' : '',
              error ? 'error' : '',
            ].filter(Boolean).join(' ')}
            autoComplete="one-time-code"
            aria-label={`TOTP digit ${i + 1}`}
            whileTap={{ scale: 0.95 }}
          />
        ))}
      </div>
      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="text-danger text-xs font-medium"
          >
            Incorrect code — try again
          </motion.p>
        )}
      </AnimatePresence>
      {/* TOTP period progress */}
      <TOTPPeriodBar />
    </div>
  )
}

function TOTPPeriodBar() {
  const [pct, setPct] = useState(() => {
    const sec = Math.floor(Date.now() / 1000)
    return ((30 - (sec % 30)) / 30) * 100
  })

  const [, forceRender] = useState(0)
  const isMounted = useRef(true)

  // update every 200ms
  const tick = useCallback(() => {
    if (!isMounted.current) return
    const sec = Math.floor(Date.now() / 1000)
    const rem = 30 - (sec % 30)
    setPct((rem / 30) * 100)
    forceRender(n => n + 1)
    setTimeout(tick, 200)
  }, [])

  // Start ticker once
  const started = useRef(false)
  if (!started.current) {
    started.current = true
    setTimeout(tick, 200)
  }

  const isLow = pct < 25
  return (
    <div className="w-44 h-1 bg-surface-200 rounded-full overflow-hidden">
      <motion.div
        className={`h-full rounded-full transition-colors duration-300 ${isLow ? 'bg-warn' : 'bg-accent'}`}
        style={{ width: `${pct}%` }}
        transition={{ duration: 0.2 }}
      />
    </div>
  )
}
