import { motion, AnimatePresence } from 'framer-motion'
import { X, Download } from 'lucide-react'
import { useLang } from '../lib/i18n'

interface Props {
  qrBase64: string
  secret: string
  onClose: () => void
}

export function QRModal({ qrBase64, secret, onClose }: Props) {
  const { t } = useLang()

  const download = () => {
    const a = document.createElement('a')
    a.href = `data:image/png;base64,${qrBase64}`
    a.download = 'pixey-totp-qr.png'
    a.click()
  }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        />

        <motion.div
          className="card relative z-10 w-full max-w-sm text-center shadow-2xl"
          initial={{ scale: 0.9, y: 16, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.9, y: 16, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        >
          <button onClick={onClose} className="absolute right-3 top-3 btn-ghost p-1.5 rounded-lg">
            <X size={16} />
          </button>

          <h3 className="text-white font-semibold text-lg mb-1">{t.qrTitle}</h3>
          <p className="text-slate-500 text-xs mb-5">{t.qrSubtitle}</p>

          <div className="flex justify-center mb-4">
            <div className="p-3 bg-white rounded-xl shadow-glow inline-block">
              <img
                src={`data:image/png;base64,${qrBase64}`}
                alt="TOTP QR"
                className="w-48 h-48"
                style={{ imageRendering: 'pixelated' }}
              />
            </div>
          </div>

          <div className="bg-bg-50 rounded-xl px-4 py-3 mb-5 border border-surface-200">
            <p className="label mb-1 text-center">{t.qrManual}</p>
            <p className="font-mono text-sm text-slate-200 tracking-widest select-all break-all">{secret}</p>
          </div>

          <div className="flex gap-2 justify-center">
            <button onClick={download} className="btn-ghost gap-2 border border-surface-200">
              <Download size={14} /> {t.qrDownload}
            </button>
            <button onClick={onClose} className="btn-primary">
              {t.qrDone}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
