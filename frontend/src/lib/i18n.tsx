import { createContext, useContext, useState, type ReactNode } from 'react'

export type Lang = 'zh' | 'en'

export interface T {
  loading: string; langSwitch: string
  setupSubtitle: string; setupStep1: string; setupStep2: string
  setupScanHint: string; setupVerifyHint: string
  setupScanned: string; setupBack: string; setupActivate: string; setupActivating: string; setupManualEntry: string
  proxyAddr: string; newCredential: string; validFor: string; createBtn: string; creating: string
  credentialsTitle: (n: number) => string
  noCredentials: string; noCredentialsHint: string
  activeCount: (a: number, e: number) => string
  refresh: string; showQR: string
  badgeActive: string; badgeExpiring: string; badgeExpired: string
  expiresIn: (s: string) => string; purgeIn: (s: string) => string
  totpTitle: string; totpLabel: string; totpError: string
  fieldUser: string; fieldPass: string; renewBtn: string; deleteBtn: string
  confirmRenew: string; cancelBtn: string; keepDur: string; renewFor: string
  durations: Array<{ label: string; value: string; def?: boolean }>
  qrTitle: string; qrSubtitle: string; qrManual: string; qrDownload: string; qrDone: string
  needTotp: string
  created: (u: string, p: string) => string
  deleted: string; renewed: string; confirmDelete: string
  neverWarn: string
  neverBadge: string
  proxyEnv: string
  proxyHost: string
  copied: string
}

export const translations: Record<Lang, T> = {
  zh: {
    // 通用
    loading: '加载中…',
    langSwitch: 'EN',

    // 初始设置
    setupSubtitle: '验证器设置',
    setupStep1: '扫描二维码',
    setupStep2: '验证',
    setupScanHint: '打开验证器 App（如 Google Authenticator、Authy）扫描以下二维码。',
    setupVerifyHint: '输入验证器中显示的 6 位验证码以完成绑定。',
    setupScanned: '已扫描，继续 →',
    setupBack: '← 返回',
    setupActivate: '激活',
    setupActivating: '验证中…',
    setupManualEntry: '手动输入密钥',

    // 仪表盘
    proxyAddr: '代理地址',
    newCredential: '新建凭证',
    validFor: '有效时长',
    createBtn: '创建凭证',
    creating: '创建中…',
    credentialsTitle: (n: number) => `凭证列表（${n}）`,
    noCredentials: '暂无凭证',
    noCredentialsHint: '在上方创建第一个凭证',
    activeCount: (a: number, e: number) => `${a} 个有效 · ${e} 个已过期`,
    refresh: '刷新',
    showQR: '显示二维码',

    // 状态徽章
    badgeActive: '有效',
    badgeExpiring: '即将到期',
    badgeExpired: '已过期',
    expiresIn: (s: string) => s,
    purgeIn: (s: string) => `将在 ${s} 后清除`,

    // TOTP
    totpTitle: 'TOTP 验证',
    totpLabel: '输入当前验证码',
    totpError: '验证码错误，请重试',

    // 凭证卡
    fieldUser: '用户名',
    fieldPass: '密码',
    renewBtn: '续租',
    deleteBtn: '删除',
    confirmRenew: '确认续租',
    cancelBtn: '取消',
    keepDur: '保持原有效期',
    renewFor: '续租时长：',

    // 时长选项
    durations: [
      { label: '30 分钟',  value: '30m',   def: true },
      { label: '1 小时',   value: '1h'  },
      { label: '6 小时',   value: '6h'  },
      { label: '12 小时',  value: '12h' },
      { label: '1 天',     value: '1d'  },
      { label: '3 天',     value: '3d'  },
      { label: '7 天',     value: '7d'  },
      { label: '永不过期', value: 'never' },
    ],

    // QR 分享弹窗
    qrTitle: 'TOTP 二维码',
    qrSubtitle: '扫描此码将代理绑定到另一台验证器设备。',
    qrManual: '手动输入密钥',
    qrDownload: '下载 PNG',
    qrDone: '完成',

    // 提示消息
    needTotp: '请先输入 6 位 TOTP 验证码',
    created: (u: string, p: string) => `已创建：${u} / ${p}`,
    deleted: '凭证已删除',
    renewed: '续租成功',
    confirmDelete: '确定要删除此凭证吗？',
    neverWarn: '⚠️ 永不过期的凭证存在安全风险，一旦泄露将无法自动失效，请谨慎使用。',
    neverBadge: '永久',
    proxyEnv: '代理环境变量',
    proxyHost: '主机地址',
    copied: '已复制',
  },

  en: {
    loading: 'Loading…',
    langSwitch: '中文',

    setupSubtitle: 'Authenticator Setup',
    setupStep1: 'Scan QR',
    setupStep2: 'Verify',
    setupScanHint: 'Open your authenticator app (e.g. Google Authenticator, Authy) and scan the QR code below.',
    setupVerifyHint: 'Enter the 6-digit code from your authenticator app to confirm setup.',
    setupScanned: "I've scanned it →",
    setupBack: '← Back',
    setupActivate: 'Activate',
    setupActivating: 'Verifying…',
    setupManualEntry: 'Manual entry',

    proxyAddr: 'Proxy address',
    newCredential: 'New Credential',
    validFor: 'Valid for',
    createBtn: '+ Create credential',
    creating: 'Creating…',
    credentialsTitle: (n: number) => `Credentials (${n})`,
    noCredentials: 'No credentials yet',
    noCredentialsHint: 'Create one above to get started',
    activeCount: (a: number, e: number) => `${a} active · ${e} expired`,
    refresh: 'Refresh',
    showQR: 'Show QR',

    badgeActive: 'Active',
    badgeExpiring: 'Expiring',
    badgeExpired: 'Expired',
    expiresIn: (s: string) => s,
    purgeIn: (s: string) => `Purge in ${s}`,

    totpTitle: 'TOTP Verification',
    totpLabel: 'Enter current code',
    totpError: 'Incorrect code — try again',

    fieldUser: 'Username',
    fieldPass: 'Password',
    renewBtn: 'Renew',
    deleteBtn: 'Delete',
    confirmRenew: 'Confirm',
    cancelBtn: 'Cancel',
    keepDur: 'Keep original duration',
    renewFor: 'Renew for:',

    durations: [
      { label: '30 min',    value: '30m',   def: true },
      { label: '1 hour',    value: '1h'  },
      { label: '6 hours',   value: '6h'  },
      { label: '12 hours',  value: '12h' },
      { label: '1 day',     value: '1d'  },
      { label: '3 days',    value: '3d'  },
      { label: '7 days',    value: '7d'  },
      { label: 'Never',     value: 'never' },
    ],

    qrTitle: 'TOTP QR Code',
    qrSubtitle: 'Scan to add this proxy to another authenticator app.',
    qrManual: 'Manual entry',
    qrDownload: 'Download PNG',
    qrDone: 'Done',

    needTotp: 'Enter your 6-digit TOTP code first',
    created: (u: string, p: string) => `Created: ${u} / ${p}`,
    deleted: 'Credential deleted',
    renewed: 'Credential renewed',
    confirmDelete: 'Delete this credential?',
    neverWarn: '⚠️ Never-expiring credentials are a security risk — they stay valid indefinitely if leaked. Use with caution.',
    neverBadge: 'Permanent',
    proxyEnv: 'Proxy env vars',
    proxyHost: 'Host',
    copied: 'Copied',
  },
}

interface LangCtx { lang: Lang; t: T; toggle: () => void }

const Ctx = createContext<LangCtx>({ lang: 'zh', t: translations.zh, toggle: () => {} })

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => {
    try { return (localStorage.getItem('pixey-lang') as Lang) || 'zh' }
    catch { return 'zh' }
  })

  const toggle = () => {
    const next: Lang = lang === 'zh' ? 'en' : 'zh'
    setLang(next)
    try { localStorage.setItem('pixey-lang', next) } catch {}
  }

  return <Ctx.Provider value={{ lang, t: translations[lang], toggle }}>{children}</Ctx.Provider>
}

export const useLang = () => useContext(Ctx)
