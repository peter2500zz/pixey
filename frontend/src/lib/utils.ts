import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function fmtDuration(ms: number): string {
  if (ms <= 0) return 'Expired'
  const s = Math.floor(ms / 1000)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m ${sec}s`
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const el = document.createElement('textarea')
    el.value = text
    el.style.position = 'fixed'
    el.style.opacity = '0'
    document.body.appendChild(el)
    el.select()
    document.execCommand('copy')
    el.remove()
    return true
  }
}

export interface Credential {
  id: string
  username: string
  password: string
  duration: number        // nanoseconds
  created_at: string
  expires_at: string
  clean_at: string
}

export interface ApiStatus {
  totp_status: 'none' | 'pending' | 'active'
  proxy_addr: string
  credentials?: Credential[]
  qr_code?: string
  totp_secret?: string
}

export async function apiFetch<T = unknown>(
  method: string,
  path: string,
  body?: unknown,
  totp?: string,
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (totp) headers['X-TOTP-Code'] = totp
  const res = await fetch(path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  return res.json()
}
