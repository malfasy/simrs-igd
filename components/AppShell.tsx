'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { ACCESS, DEMO_PEOPLE, NAV, ROLE_LABEL, type ViewKey } from '@/lib/constants'
import { isActive } from '@/lib/clinical'
import { firebaseProjectId } from '@/lib/firebase'
import type { Role } from '@/lib/types'
import { useAuth, useData, useStore } from './providers'
import { Clock, ConfirmButton, Timer, useRunner } from './ui'
import { LoginScreen } from './LoginScreen'

export function viewForPath(path: string): ViewKey {
  if (path === '/' || path.startsWith('/pasien')) return 'board'
  return NAV.find((n) => n.href !== '/' && path.startsWith(n.href))?.key ?? 'board'
}

export function AppShell({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const data = useData()
  const store = useStore()
  const path = usePathname()
  const { busy, run } = useRunner()

  if (!auth.ready) return <div className="loading">Memuat SIMRS IGD...</div>
  if (!auth.user) return <LoginScreen />

  const role = auth.user.role
  const view = viewForPath(path)
  const allowed = ACCESS[role].includes(view)
  const inc = data.meta.activeIncident
  const counts: Partial<Record<ViewKey, number>> = {
    board: data.visits.filter(isActive).length,
    prearrival: data.prearrivals.length,
    fhir: data.fhirLogs.length,
    mci: inc ? data.visits.filter((v) => v.incidentId === inc.id).length : 0,
    patients: data.patients.length,
  }

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          SIMRS <b>IGD</b>
          <small>Instalasi Gawat Darurat</small>
        </div>
        <span className={`modebadge ${auth.mode === 'firebase' ? 'fb' : ''}`} title={auth.mode === 'firebase' ? `Project ${firebaseProjectId}` : 'Data tersimpan di browser ini'}>
          {auth.mode === 'firebase' ? 'Firebase' : 'Mode demo lokal'}
        </span>
        <div className="spacer" />
        {auth.mode === 'local' ? (
          <div className="rolebox">
            <label htmlFor="role">Masuk sebagai</label>
            <select id="role" value={role} onChange={(e) => auth.switchRole(e.target.value as Role)}>
              {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]} ({DEMO_PEOPLE[r]})
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="userbox">
            <div className="who">
              <b>{auth.user.name}</b>
              <span>{ROLE_LABEL[role]}</span>
            </div>
            <button className="btn sm" onClick={() => void auth.logout()}>
              Keluar
            </button>
          </div>
        )}
        <Clock />
      </header>

      {inc && (
        <div className="banner">
          <b>Mode korban massal aktif</b>
          <span>
            {inc.name} &middot; {inc.location} &middot; aktif <Timer since={inc.activatedAt} className="banner-t" />
          </span>
          {ACCESS[role].includes('mci') && (
            <Link href="/korban-massal" className="btn sm" style={{ background: 'rgba(255,255,255,.18)', color: '#fff', borderColor: 'rgba(255,255,255,.5)' }}>
              Buka panel
            </Link>
          )}
        </div>
      )}
      {data.error && <div className="errorbar">{data.error}</div>}

      <nav className="nav" aria-label="Menu">
        {NAV.filter((n) => ACCESS[role].includes(n.key) && ['board', 'register'].includes(n.key)).map((n, i, arr) => (
          <div key={n.key} style={{ display: 'contents' }}>
            {(i === 0 || arr[i - 1].group !== n.group) && <div className="navlabel">{n.group}</div>}
            <Link href={n.href} className={view === n.key ? 'on' : ''}>
              <span>{n.label}</span>
              {counts[n.key] ? <span className="badge">{counts[n.key]}</span> : null}
            </Link>
          </div>
        ))}
        {role === 'kepala' && (
          <div className="admin">
            <div className="small muted">Data demo</div>
            <ConfirmButton className="btn sm" disabled={busy} confirmText="Klik lagi: ganti semua data" onConfirm={() => void run(() => store.loadSampleData(), 'Data contoh dimuat.')}>
              Muat data contoh
            </ConfirmButton>
            <ConfirmButton className="btn sm" disabled={busy} confirmText="Klik lagi: hapus semua" onConfirm={() => void run(() => store.clearAll(), 'Semua data dikosongkan.')}>
              Kosongkan data
            </ConfirmButton>
          </div>
        )}
        <div className="note">
          {auth.mode === 'local'
            ? 'Mode demo lokal: data tersimpan di browser ini. Isi konfigurasi Firebase di .env.local untuk data bersama.'
            : 'Data tersinkron realtime lewat Cloud Firestore.'}
          {auth.mode === 'local' && (
            <>
              {' '}
              <button className="btn sm" style={{ marginTop: 8 }} onClick={() => void auth.logout()}>
                Ke halaman masuk
              </button>
            </>
          )}
        </div>
      </nav>

      <main id="main">
        {!data.ready ? (
          <div className="loading">Memuat data...</div>
        ) : allowed ? (
          children
        ) : (
          <div className="panel" style={{ maxWidth: 560 }}>
            <h2>Tidak ada akses</h2>
            <p className="muted" style={{ marginTop: 6 }}>
              Peran {ROLE_LABEL[role]} tidak membuka halaman ini.
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
  )
}