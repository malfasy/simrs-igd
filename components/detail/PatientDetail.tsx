'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { DISPO, ROLE_LABEL, STATUS_LABEL, TAB_ACCESS, TAB_LABEL, targetMinutes, type TabKey } from '@/lib/constants'
import { ageSex, areaOf, displayName, displayRm, dur, hm, isAlert } from '@/lib/clinical'
import { startCare } from '@/lib/actions'
import type { Visit } from '@/lib/types'
import { useAuth, useCtx, useVisit } from '../providers'
import { Chip, Empty, Timer, TriageChip, useRunner } from '../ui'
import { TabDisposisi } from './TabDisposisi'
import { TabTriase } from './TabTriase'
import { TabRingkasan } from './TabRingkasan'

export function tabsFor(role: keyof typeof TAB_ACCESS, v: Visit): TabKey[] {
  // Tab yang sudah aktif. Tambahkan tab lain di sini setiap kali fiturnya selesai.
  const aktif: TabKey[] = ['ringkasan', 'triase', 'disposisi']
  return TAB_ACCESS[role].filter((t) => aktif.includes(t))
}

export function PatientDetail({ id, initialTab }: { id: string; initialTab?: string }) {
  const { user } = useAuth()
  const ctx = useCtx()
  const { busy, run } = useRunner()
  const { v, loading } = useVisit(id)
  const [tab, setTab] = useState<TabKey>((initialTab as TabKey) || 'ringkasan')

  const tabs = v && user ? tabsFor(user.role, v) : []
  const current: TabKey = tabs.includes(tab) ? tab : 'ringkasan'

  useEffect(() => {
    const url = new URL(window.location.href)
    if (current === 'ringkasan') url.searchParams.delete('tab')
    else url.searchParams.set('tab', current)
    window.history.replaceState(null, '', url.toString())
  }, [current])

  if (loading) return <div className="loading">Memuat data kunjungan...</div>
  if (!v || !user || !ctx)
    return (
      <>
        <div className="row" style={{ marginBottom: 10 }}>
          <Link className="btn sm" href="/">
            &larr; Papan IGD
          </Link>
        </div>
        <Empty>Kunjungan tidak ditemukan. Mungkin sudah dihapus karena salah input.</Empty>
      </>
    )

  const canStart = (user.role === 'dokter' || user.role === 'kepala') && !v.doctorSeenAt && v.status !== 'keluar'
  const panes: Partial<Record<TabKey, JSX.Element>> = {
    ringkasan: <TabRingkasan v={v} goTab={setTab} />,
    triase: <TabTriase v={v} />,
    disposisi: <TabDisposisi v={v} />,
  }

  return (
    <>
      <div className="row" style={{ marginBottom: 10 }}>
        <Link className="btn sm" href="/">
          &larr; Papan IGD
        </Link>
        {v.incidentId && (
          <Link className="btn sm" href="/korban-massal">
            Panel korban massal
          </Link>
        )}
      </div>
      <section className={`dh ${v.color ?? ''}`}>
        <div className="who">
          <div className="row">
            <TriageChip v={v} long />
            <Chip>{STATUS_LABEL[v.status]}</Chip>
            <Chip>{v.bed ? `Bed ${v.bed} · ${areaOf(v)}` : areaOf(v)}</Chip>
            {v.isTrauma && <Chip kind="crit">Trauma</Chip>}
            {isAlert(v) && <Chip kind="crit">Skor peringatan tinggi</Chip>}
          </div>
          <h1>{displayName(v)}</h1>
          <div className="muted">
            {ageSex(v)} &middot; <span className="mono">{displayRm(v)}</span> &middot; Reg <span className="mono">{v.regNo}</span> &middot; {v.insurance}
          </div>
        </div>
        <div className="times">
          <span className="k">Datang</span>
          <span className="k">Triase</span>
          <span className="k">Dilihat dokter</span>
          <span className="v">{hm(v.arrivalTime)}</span>
          <span className="v">{v.triagedAt ? hm(v.triagedAt) : '-'}</span>
          <span className="v">
            {v.doctorSeenAt ? `${hm(v.doctorSeenAt)} (${dur(v.doctorSeenAt - v.arrivalTime)})` : v.status === 'keluar' ? '-' : <Timer since={v.arrivalTime} target={v.level ? targetMinutes(v.level) : undefined} />}
          </span>
          <span className="k">Lama di IGD</span>
          <span className="k">Dokter</span>
          <span className="k">Disposisi</span>
          <span className="v">{v.leftAt ? dur(v.leftAt - v.arrivalTime) : <Timer since={v.arrivalTime} />}</span>
          <span className="v">{v.doctor ?? '-'}</span>
          <span className="v">{v.disposition ? DISPO[v.disposition.type] : '-'}</span>
        </div>
        {canStart && (
          <button
            className="btn primary"
            disabled={busy}
            onClick={async () => {
              const r = await run(() => startCare(ctx, v), (nv) => `Penanganan dimulai. Waktu tanggap ${dur((nv.doctorSeenAt ?? 0) - nv.arrivalTime)}.`)
              if (r) setTab('disposisi')
            }}
          >
            Mulai penanganan
          </button>
        )}
      </section>

      <nav className="tabs" role="tablist" aria-label="Bagian rekam IGD">
        {tabs.map((t) => (
          <button key={t} role="tab" aria-selected={current === t} className={current === t ? 'on' : ''} onClick={() => setTab(t)}>
            {TAB_LABEL[t]}
          </button>
        ))}
      </nav>
      <div key={current}>{panes[current]}</div>
      {user.role === 'pendaftaran' && <p className="note">Peran {ROLE_LABEL[user.role]} hanya melihat ringkasan. Tab klinis dibuka untuk perawat dan dokter.</p>}
    </>
  )
}