import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Terminal, Check, Copy, ChevronDown } from 'lucide-react'
import { copyText } from '../lib/utils'
import { useLang } from '../lib/i18n'

interface Props {
  proxyAddr: string   // e.g. ":7070" or "localhost:7070"
  username: string
  password: string
}

type Platform = 'bash' | 'fish' | 'powershell' | 'cmd' | 'python' | 'curl'

interface PlatformDef {
  id: Platform
  label: string
  icon: string
  snippet: (url: string) => string
}

const platforms: PlatformDef[] = [
  {
    id: 'bash',
    label: 'Bash / Zsh',
    icon: '$_',
    snippet: url =>
      `export http_proxy="${url}"\nexport https_proxy="${url}"\nexport HTTP_PROXY="${url}"\nexport HTTPS_PROXY="${url}"`,
  },
  {
    id: 'fish',
    label: 'Fish',
    icon: '><>',
    snippet: url =>
      `set -x http_proxy "${url}"\nset -x https_proxy "${url}"`,
  },
  {
    id: 'powershell',
    label: 'PowerShell',
    icon: 'PS>',
    snippet: url =>
      `$env:http_proxy  = "${url}"\n$env:https_proxy = "${url}"\n$env:HTTP_PROXY  = "${url}"\n$env:HTTPS_PROXY = "${url}"`,
  },
  {
    id: 'cmd',
    label: 'CMD',
    icon: 'C:>',
    snippet: url =>
      `set http_proxy=${url}\nset https_proxy=${url}`,
  },
  {
    id: 'python',
    label: 'Python',
    icon: 'py',
    snippet: url =>
      `import os\nos.environ["http_proxy"]  = "${url}"\nos.environ["https_proxy"] = "${url}"`,
  },
  {
    id: 'curl',
    label: 'curl',
    icon: '~',
    snippet: url =>
      `curl -x "${url}" https://example.com`,
  },
]

function parseAddr(proxyAddr: string): { defaultHost: string; port: string } {
  const colonIdx = proxyAddr.lastIndexOf(':')
  if (colonIdx === -1) return { defaultHost: proxyAddr || 'localhost', port: '' }
  const port = proxyAddr.slice(colonIdx)          // e.g. ":7070"
  const host = proxyAddr.slice(0, colonIdx)       // "" | "localhost" | "1.2.3.4"
  return { defaultHost: host || 'localhost', port }
}

export function ProxyEnvPanel({ proxyAddr, username, password }: Props) {
  const { t } = useLang()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState<Platform>('bash')
  const [copied, setCopied] = useState(false)

  const { defaultHost, port } = parseAddr(proxyAddr)
  const [hostInput, setHostInput] = useState(defaultHost)

  const proxyURL = `http://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${hostInput || defaultHost}${port}`

  const current = platforms.find(p => p.id === active)!
  const snippet = current.snippet(proxyURL)

  const handleCopy = async () => {
    await copyText(snippet)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div className="border-t border-surface-200/60 pt-2 mt-1">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors w-full"
      >
        <Terminal size={12} />
        <span>{t.proxyEnv}</span>
        <ChevronDown
          size={11}
          className={`ml-auto transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pt-2.5 space-y-2">
              {/* Host input */}
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-500 shrink-0">{t.proxyHost}</label>
                <input
                  type="text"
                  value={hostInput}
                  onChange={e => setHostInput(e.target.value)}
                  placeholder={defaultHost}
                  spellCheck={false}
                  className="flex-1 bg-bg-100 border border-surface-200 rounded-lg px-2.5 py-1 text-xs font-mono
                             text-slate-200 placeholder-slate-600 focus:outline-none focus:border-accent/50
                             transition-colors min-w-0"
                />
                <span className="text-xs font-mono text-slate-500 shrink-0">{port}</span>
              </div>

              {/* Platform tabs */}
              <div className="flex flex-wrap gap-1">
                {platforms.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setActive(p.id)}
                    className={`text-xs px-2.5 py-1 rounded-md font-mono transition-all ${
                      active === p.id
                        ? 'bg-accent/20 text-accent-light border border-accent/40'
                        : 'text-slate-500 hover:text-slate-300 border border-transparent hover:border-surface-200'
                    }`}
                  >
                    {p.icon} {p.label}
                  </button>
                ))}
              </div>

              {/* Code block */}
              <div className="relative group">
                <pre className="bg-bg-100 border border-surface-200 rounded-xl px-3.5 py-3 text-xs font-mono text-slate-300 overflow-x-auto whitespace-pre leading-relaxed scrollbar-thin">
                  {snippet}
                </pre>
                <button
                  onClick={handleCopy}
                  className="absolute right-2 top-2 p-1.5 rounded-lg bg-surface-100 border border-surface-200
                             text-slate-500 hover:text-white hover:border-accent/40 transition-all opacity-0
                             group-hover:opacity-100 focus:opacity-100"
                  title={t.copied}
                >
                  {copied
                    ? <Check size={12} className="text-success" />
                    : <Copy size={12} />
                  }
                </button>
              </div>

              {copied && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-xs text-success text-right"
                >
                  {t.copied} ✓
                </motion.p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
