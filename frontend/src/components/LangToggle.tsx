import { motion } from 'framer-motion'
import { useLang } from '../lib/i18n'

export function LangToggle({ className = '' }: { className?: string }) {
  const { t, toggle } = useLang()
  return (
    <motion.button
      onClick={toggle}
      whileTap={{ scale: 0.92 }}
      className={`text-xs font-semibold px-2.5 py-1 rounded-lg border border-surface-200
                  text-slate-400 hover:text-white hover:border-accent/40
                  transition-colors duration-150 font-mono tracking-wide ${className}`}
      title="Switch language"
    >
      {t.langSwitch}
    </motion.button>
  )
}
