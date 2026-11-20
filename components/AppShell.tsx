'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  AlertTriangle,
  Ambulance,
  BarChart3,
  Bell,
  FlaskConical,
  History,
  Hourglass,
  LayoutDashboard,
  LogOut,
  Menu,
  MonitorDot,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  ShieldCheck,
  Siren,
  UserCog,
  UserPlus,
  Users,
} from 'lucide-react'
import { ACCESS, DEMO_PEOPLE, LEVELS, NAV, ROLE_LABEL, type ViewKey } from '@/lib/constants'
import { displayName, displayRm, isActive, isAlert, isBoarding, orderLabel, waitState } from '@/lib/clinical'
import { firebaseProjectId } from '@/lib/firebase'
import type { Role } from '@/lib/types'
import { useAuth, useData, useStore } from './providers'
import { Clock, ConfirmButton, Timer, useNow, useRunner } from './ui'
import { LoginScreen } from './LoginScreen'

/**
 * Menu yang sudah aktif. Tambahkan key menu di sini setiap kali fiturnya selesai,
 * misalnya 'patients' untuk Data Pasien atau 'history' untuk Riwayat Kunjungan.
 */
const MENU_AKTIF: ViewKey[] = ['dashboard', 'board', 'register']

const ICONS: Record<ViewKey, ReactNode> = {
  dashboard: <LayoutDashboard size={19} />,
  board: <MonitorDot size={19} />,
  prearrival: <Ambulance size={19} />,
  register: <UserPlus size={19} />,
  mci: <Siren size={19} />,
  patients: <Users size={19} />,
  history: <History size={19} />,
  quality: <BarChart3 size={19} />,
  staff: <UserCog size={19} />,
  fhir: <ShieldCheck size={19} />,
}

export function viewForPath(path: string): ViewKey {
  if (path === '/' || path.startsWith('/pasien')) return 'board'
  return NAV.find((n) => n.href !== '/' && path.startsWith(n.href))?.key ?? 'board'
}

const initials = (name: string) =>
  name
    .replace(/^(dr|ns|drg)\.?\s+/i, '')
    .replace(/\(.*?\)/g, '')
    .split(/[\s,]+/)
    .map((w) => w.replace(/[^A-Za-z]/g, ''))
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')

/** Tutup popover saat klik di luar elemen atau menekan Escape. */
function useOutside<T extends HTMLElement>(open: boolean, close: () => void) {
  const ref = useRef<T>(null)
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close()
    }
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('mousedown', h)
    document.addEventListener('keydown', k)
    return () => {
      document.removeEventListener('mousedown', h)
      document.removeEventListener('keydown', k)
    }
  }, [open, close])
  return ref
}

function GlobalSearch() {
  const data = useData()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useOutside<HTMLDivElement>(open, () => setOpen(false))
  const t = q.trim().toLowerCase()
  const results = useMemo(() => {
    if (t.length < 2) return []
    return data.visits
      .filter((v) => displayName(v).toLowerCase().includes(t) || displayRm(v).toLowerCase().includes(t) || v.regNo.toLowerCase().includes(t))
      .sort((a, b) => Number(isActive(b)) - Number(isActive(a)) || b.arrivalTime - a.arrivalTime)
      .slice(0, 8)
  }, [t, data.visits])
  return (
    <div className="searchbox" ref={ref}>
      <Search size={17} />
      <input
        type="text"
        aria-label="Cari pasien di seluruh IGD"
        placeholder="Cari pasien, No. RM, atau No. Reg"
        value={q}
        onChange={(e) => {
          setQ(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
      />
      {open && t.length >= 2 && (
        <div className="popover">
          {results.length === 0 ? (
            <div className="empty-row">Tidak ada pasien yang cocok di kunjungan 24 jam terakhir.</div>
          ) : (
            results.map((v) => (
              <Link
                key={v.id}
                href={`/pasien/${v.id}`}
                onClick={() => {
                  setOpen(false)
                  setQ('')
                }}
              >
                <span className={`pi ${isActive(v) ? 'acc' : ''}`}>
                  <Users size={15} />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <b>{displayName(v)}</b>
                  <div className="small muted">
                    {displayRm(v)} &middot; {v.regNo} &middot; {isActive(v) ? 'di IGD' : 'sudah keluar'}
                  </div>
                </span>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  )
}

type Note = { key: string; href: string; tone: string; icon: ReactNode; title: string; sub: string }

function Notifications() {
  const data = useData()
  const now = useNow(30_000)
  const [open, setOpen] = useState(false)
  const ref = useOutside<HTMLDivElement>(open, () => setOpen(false))
  const items = useMemo(() => {
    const out: Note[] = []
    data.visits.filter(isActive).forEach((v) => {
      if (waitState(v, now) === 'over' && v.level)
        out.push({ key: `w${v.id}`, href: `/pasien/${v.id}`, tone: 'crit', icon: <Hourglass size={15} />, title: `${displayName(v)} belum dilihat dokter`, sub: `Level ${v.level} (${LEVELS[v.level].name}), target waktu terlewati` })
      if (isAlert(v)) out.push({ key: `a${v.id}`, href: `/pasien/${v.id}`, tone: 'crit', icon: <AlertTriangle size={15} />, title: `Skor peringatan tinggi: ${displayName(v)}`, sub: 'NEWS2 5 atau lebih, perlu dinilai ulang' })
      Object.entries(v.results ?? {}).forEach(([k, r]) => {
        if (r.critical && r.status === 'selesai')
          out.push({ key: `c${v.id}${k}`, href: `/pasien/${v.id}`, tone: 'crit', icon: <FlaskConical size={15} />, title: `Nilai kritis: ${orderLabel(k)}`, sub: `${displayName(v)}: ${r.result}` })
      })
      if (isBoarding(v, now)) out.push({ key: `b${v.id}`, href: `/pasien/${v.id}`, tone: 'warn', icon: <Hourglass size={15} />, title: `${displayName(v)} tertahan di IGD`, sub: 'Lebih dari 2 jam sejak keputusan disposisi' })
    })
    data.prearrivals.forEach((p) => out.push({ key: `p${p.id}`, href: '/', tone: 'acc', icon: <Ambulance size={15} />, title: `Ambulans menuju IGD (${p.from})`, sub: p.mist.m }))
    return out
  }, [data.visits, data.prearrivals, now])
  return (
    <div className="pop-anchor" ref={ref}>
      <button className="iconbtn" aria-label={`Notifikasi (${items.length})`} aria-expanded={open} onClick={() => setOpen(!open)}>
        <Bell size={19} />
        {items.length > 0 && <span className="dot">{items.length > 9 ? '9+' : items.length}</span>}
      </button>
      {open && (
        <div className="popover">
          <div className="pop-head">Notifikasi ({items.length})</div>
          {items.length === 0 ? (
            <div className="empty-row">Tidak ada yang perlu perhatian saat ini.</div>
          ) : (
            items.map((n) => (
              <Link key={n.key} href={n.href} onClick={() => setOpen(false)}>
                <span className={`pi ${n.tone}`}>{n.icon}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <b>{n.title}</b>
                  <div className="small muted">{n.sub}</div>
                </span>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export function AppShell({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const data = useData()
  const store = useStore()
  const path = usePathname()
  const { busy, run } = useRunner()
  const [navOpen, setNavOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => setNavOpen(false), [path])

  // Ingat pilihan sidebar tertutup/terbuka di browser ini.
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem('simrs-igd:sidebar') === 'tutup')
    } catch {}
  }, [])
  const toggleSidebar = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem('simrs-igd:sidebar', c ? 'buka' : 'tutup')
      } catch {}
      return !c
    })
  }

  if (!auth.ready) return <div className="loading">Memuat SIMRS IGD...</div>
  if (!auth.user) return <LoginScreen />

  const role = auth.user.role
  const view = viewForPath(path)
  const allowed = ACCESS[role].includes(view) && MENU_AKTIF.includes(view)
  const inc = data.meta.activeIncident
  const counts: Partial<Record<ViewKey, number>> = {
    board: data.visits.filter(isActive).length,
    prearrival: data.prearrivals.length,
    fhir: data.fhirLogs.length,
    mci: inc ? data.visits.filter((v) => v.incidentId === inc.id).length : 0,
    patients: data.patients.length,
  }
  const menu = NAV.filter((n) => ACCESS[role].includes(n.key) && MENU_AKTIF.includes(n.key))

  return (
    <div className={`app ${collapsed ? 'collapsed' : ''}`}>
      <div className={`scrim ${navOpen ? 'open' : ''}`} onClick={() => setNavOpen(false)} />
      <aside className={`side ${navOpen ? 'open' : ''}`} aria-label="Menu utama">
        <Link href="/dashboard" className="side-brand">
          <span className="logo">
            <Plus size={22} strokeWidth={3} />
          </span>
          <span>
            SIMRS <b>IGD</b>
          </span>
        </Link>

        <nav className="side-nav">
          {menu.map((n, i) => (
            <div key={n.key} style={{ display: 'contents' }}>
              {(i === 0 || menu[i - 1].group !== n.group) && <div className="navlabel">{n.group}</div>}
              <Link href={n.href} className={view === n.key ? 'on' : ''} aria-current={view === n.key ? 'page' : undefined} title={collapsed ? n.label : undefined}>
                {ICONS[n.key]}
                <span>{n.label}</span>
                {counts[n.key] ? <span className="badge">{counts[n.key]}</span> : null}
              </Link>
            </div>
          ))}
        </nav>

        {role === 'kepala' && (
          <div className="side-admin">
            <div className="small muted">Data demo</div>
            <ConfirmButton className="btn sm" disabled={busy} confirmText="Klik lagi: ganti semua data" onConfirm={() => void run(() => store.loadSampleData(), 'Data contoh dimuat.')}>
              Muat data contoh
            </ConfirmButton>
            <ConfirmButton className="btn sm" disabled={busy} confirmText="Klik lagi: hapus semua" onConfirm={() => void run(() => store.clearAll(), 'Semua data dikosongkan.')}>
              Kosongkan data
            </ConfirmButton>
          </div>
        )}

        <div className="side-foot">
          <div className="side-note">{auth.mode === 'local' ? 'Mode demo lokal: data tersimpan di browser ini.' : `Tersinkron realtime dengan Firebase (${firebaseProjectId}).`}</div>
          <div className="profile">
            <span className="avatar" title={collapsed ? `${auth.user.name} (${ROLE_LABEL[role]})` : undefined}>{initials(auth.user.name) || '?'}</span>
            <div className="who">
              <b>{auth.user.name}</b>
              {auth.mode === 'local' ? (
                <select aria-label="Ganti peran" value={role} onChange={(e) => auth.switchRole(e.target.value as Role)}>
                  {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABEL[r]} ({DEMO_PEOPLE[r]})
                    </option>
                  ))}
                </select>
              ) : (
                <span>{ROLE_LABEL[role]}</span>
              )}
            </div>
            <button className="iconbtn sm" aria-label="Keluar" title="Keluar" onClick={() => void auth.logout()}>
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      <div className="mainwrap">
        <header className="topbar">
          <button className="iconbtn menu-toggle" aria-label="Buka menu" onClick={() => setNavOpen(true)}>
            <Menu size={19} />
          </button>
          <button
            className="iconbtn side-toggle"
            aria-label={collapsed ? 'Buka sidebar' : 'Tutup sidebar'}
            title={collapsed ? 'Buka sidebar' : 'Tutup sidebar'}
            aria-expanded={!collapsed}
            onClick={toggleSidebar}
          >
            {collapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}
          </button>
          <GlobalSearch />
          <span className="spacer" />
          <span className={`modebadge ${auth.mode === 'firebase' ? 'fb' : ''}`}>{auth.mode === 'firebase' ? 'Firebase' : 'Mode demo lokal'}</span>
          <Clock />
          <Notifications />
        </header>

        {inc && (
          <div className="banner">
            <Siren size={18} />
            <b>Mode korban massal aktif</b>
            <span>
              {inc.name} &middot; {inc.location} &middot; aktif <Timer since={inc.activatedAt} />
            </span>
            {ACCESS[role].includes('mci') && MENU_AKTIF.includes('mci') && (
              <Link href="/korban-massal" className="btn sm">
                Buka panel
              </Link>
            )}
          </div>
        )}
        {data.error && <div className="errorbar">{data.error}</div>}

        <main id="main">
          {!data.ready ? (
            <div className="loading">Memuat data...</div>
          ) : allowed ? (
            children
          ) : (
            <div className="panel" style={{ maxWidth: 560 }}>
              <h2>Tidak ada akses</h2>
              <p className="muted" style={{ marginTop: 6 }}>
                Halaman ini belum aktif atau tidak dibuka untuk peran {ROLE_LABEL[role]}.
              </p>
              <div className="formfoot">
                <Link href="/" className="btn primary">
                  Kembali ke Papan IGD
                </Link>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}