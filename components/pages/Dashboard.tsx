'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { ArrowUpRight, BedDouble, ExternalLink, Hourglass, Plus, Search, Share2, Stethoscope, UserCheck, Users } from 'lucide-react'
import { ACCESS, BEDS, COLOR_LABEL, MIN } from '@/lib/constants'
import { complaintLabel, displayName, displayRm, freeBeds, hm, icd10Label, isActive, tglPendek } from '@/lib/clinical'
import type { TriageColor, Visit } from '@/lib/types'
import { useAuth, useData, useStore } from '../providers'
import { Donut, Empty, StatCard, TriageChip, useNow } from '../ui'

type Period = 'today' | 'week'
type Filter = 'semua' | TriageColor | 'belum' | 'aktif' | 'keluar'
type Sort = 'terbaru' | 'terlama' | 'prioritas'

const startOfToday = () => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}
const PAGE = 8

export function Dashboard() {
  const data = useData()
  const store = useStore()
  const { user } = useAuth()
  const now = useNow(30_000)
  const today0 = startOfToday()

  const today = useMemo(() => data.visits.filter((v) => v.arrivalTime >= today0), [data.visits, today0])
  const active = data.visits.filter(isActive)
  const free = freeBeds(data.visits).length

  // Data 7 hari untuk grafik (diambil sekali dari database saat dipilih).
  const [period, setPeriod] = useState<Period>('today')
  const [week, setWeek] = useState<Visit[] | null>(null)
  useEffect(() => {
    if (period !== 'week' || week) return
    let cancel = false
    store.queryVisits(now - 7 * 24 * 60 * MIN, now).then((r) => {
      if (!cancel) setWeek(r)
    })
    return () => {
      cancel = true
    }
  }, [period, week, store, now])
  const chartSet = period === 'today' ? today : week ?? []

  // Tabel harian
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('semua')
  const [sort, setSort] = useState<Sort>('terbaru')
  const [limit, setLimit] = useState(PAGE)
  const rows = useMemo(() => {
    const t = q.trim().toLowerCase()
    const prio = (v: Visit) => (v.color === null ? 0 : v.level ?? 9)
    return today
      .filter((v) => {
        if (filter === 'semua') return true
        if (filter === 'belum') return !v.color
        if (filter === 'aktif') return isActive(v)
        if (filter === 'keluar') return v.status === 'keluar'
        return v.color === filter
      })
      .filter((v) => !t || displayName(v).toLowerCase().includes(t) || displayRm(v).toLowerCase().includes(t) || (v.doctor ?? '').toLowerCase().includes(t) || complaintLabel(v.complaint).toLowerCase().includes(t))
      .sort(sort === 'terbaru' ? (a, b) => b.arrivalTime - a.arrivalTime : sort === 'terlama' ? (a, b) => a.arrivalTime - b.arrivalTime : (a, b) => prio(a) - prio(b) || a.arrivalTime - b.arrivalTime)
  }, [today, q, filter, sort])

  const colorCount = (set: Visit[], c: TriageColor) => set.filter((v) => v.color === c).length
  const bars: { c: TriageColor; label: string; sub: string; n: number }[] = [
    { c: 'red', label: 'Merah', sub: 'Level 1-2', n: colorCount(chartSet, 'red') },
    { c: 'yellow', label: 'Kuning', sub: 'Level 3', n: colorCount(chartSet, 'yellow') },
    { c: 'green', label: 'Hijau', sub: 'Level 4-5', n: colorCount(chartSet, 'green') },
    { c: 'black', label: 'Hitam', sub: 'DOA / START', n: colorCount(chartSet, 'black') },
  ]
  const maxBar = Math.max(1, ...bars.map((b) => b.n))
  const male = chartSet.filter((v) => v.patient.sex === 'L').length
  const female = chartSet.filter((v) => v.patient.sex === 'P').length
  const pct = (n: number) => (male + female ? Math.round((n / (male + female)) * 100) : 0)
  const canRegister = user ? ACCESS[user.role].includes('register') : false

  return (
    <>
      <div className="vh">
        <div>
          <h1>Dashboard</h1>
          <p className="sub muted">Ringkasan IGD hari ini, {tglPendek(now)}</p>
        </div>
      </div>

      <section className="stats mini">
        <StatCard icon={<Users size={18} />} n={today.length} l="Total pasien hari ini" />
        <StatCard icon={<Stethoscope size={18} />} tone="red" n={active.filter((v) => v.color && !v.doctorSeenAt).length} l="Di IGD, menunggu dokter" />
        <StatCard icon={<Hourglass size={18} />} tone="yellow" n={active.filter((v) => !v.color).length} l="Di IGD, belum ditriase" />
        <StatCard icon={<Share2 size={18} />} n={today.filter((v) => v.disposition?.type === 'rujuk').length} l="Pasien dirujuk hari ini" />
        <StatCard icon={<UserCheck size={18} />} tone="green" n={today.filter((v) => v.status === 'keluar').length} l="Selesai dilayani hari ini" />
        <StatCard icon={<BedDouble size={18} />} n={`${free}/${BEDS.length}`} l="Bed IGD tersedia" />
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Data Harian Pasien</h2>
          <Link className="linkmore" href="/">
            Lihat Papan IGD <ArrowUpRight size={16} />
          </Link>
        </div>
        <div className="toolbar">
          <div className="searchbox">
            <Search size={16} />
            <input type="text" aria-label="Cari di tabel" placeholder="Cari nama, No. RM, dokter" value={q} onChange={(e) => { setQ(e.target.value); setLimit(PAGE) }} />
          </div>
          <select aria-label="Filter" value={filter} onChange={(e) => { setFilter(e.target.value as Filter); setLimit(PAGE) }}>
            <option value="semua">Filter: semua</option>
            <option value="red">Triase merah</option>
            <option value="yellow">Triase kuning</option>
            <option value="green">Triase hijau</option>
            <option value="black">Triase hitam</option>
            <option value="belum">Belum ditriase</option>
            <option value="aktif">Masih di IGD</option>
            <option value="keluar">Sudah keluar</option>
          </select>
          <select aria-label="Urutkan" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="terbaru">Urut: terbaru</option>
            <option value="terlama">Urut: terlama</option>
            <option value="prioritas">Urut: prioritas triase</option>
          </select>
          <span className="grow" />
          {canRegister && (
            <Link className="btn primary" href="/pendaftaran">
              <Plus size={16} /> Tambah Pasien
            </Link>
          )}
        </div>
        {rows.length === 0 ? (
          <Empty>{today.length ? 'Tidak ada pasien yang cocok dengan filter.' : 'Belum ada pasien hari ini.'}</Empty>
        ) : (
          <>
            <div className="tablewrap">
              <table className="datatable">
                <thead>
                  <tr>
                    <th>No. RM</th>
                    <th>Waktu masuk</th>
                    <th>Nama pasien</th>
                    <th>Status triase</th>
                    <th>Dokter</th>
                    <th>Keluhan / diagnosis</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, limit).map((v) => (
                    <tr key={v.id}>
                      <td className="mono small">{displayRm(v)}</td>
                      <td className="small">
                        {tglPendek(v.arrivalTime)} | {hm(v.arrivalTime)}
                      </td>
                      <td>
                        <b>{displayName(v)}</b>
                        {!isActive(v) && <div className="small muted">sudah keluar</div>}
                      </td>
                      <td>
                        <TriageChip v={v} />
                      </td>
                      <td className="small">{v.doctor ?? '-'}</td>
                      <td className="keluhan small">{v.assessment?.diagnoses[0] ? icd10Label(v.assessment.diagnoses[0]) : `${complaintLabel(v.complaint)}${v.complaintNote ? `: ${v.complaintNote}` : ''}`}</td>
                      <td>
                        <Link className="iconbtn sm" href={`/pasien/${v.id}`} aria-label={`Buka ${displayName(v)}`} title="Buka detail">
                          <ExternalLink size={15} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length > limit && (
              <div className="formfoot" style={{ justifyContent: 'center' }}>
                <button className="btn" onClick={() => setLimit(rows.length)}>
                  Tampilkan semua ({rows.length})
                </button>
              </div>
            )}
          </>
        )}
      </section>

      <div className="dash-grid">
        <section className="panel">
          <div className="panel-head">
            <h2>Triase</h2>
            <select aria-label="Periode grafik" value={period} onChange={(e) => setPeriod(e.target.value as Period)} style={{ width: 'auto' }}>
              <option value="today">Hari ini</option>
              <option value="week">7 hari terakhir</option>
            </select>
          </div>
          {period === 'week' && !week ? (
            <p className="muted">Memuat data 7 hari...</p>
          ) : (
            <div className="triage-bars" role="img" aria-label={bars.map((b) => `${b.label} ${b.n}`).join(', ')}>
              {bars.map((b) => (
                <div className="col" key={b.c}>
                  <div className={`blk ${b.c}`} style={{ height: `${Math.max(18, (b.n / maxBar) * 100) * 0.72}%` }}>
                    {b.n}
                  </div>
                  <div className="lbl">
                    {b.label}
                    <div className="sub">{b.sub}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
        <section className="panel">
          <div className="panel-head">
            <h2>Jenis Kelamin</h2>
            <span className="small muted">{period === 'today' ? 'Hari ini' : '7 hari terakhir'}</span>
          </div>
          <div className="donut-wrap">
            <div className="donut-legend">
              <div>
                <div className="pct">{pct(female)}%</div>
                <div className="lg">
                  <i style={{ background: 'var(--donut-b)' }} /> Perempuan ({female})
                </div>
              </div>
              <div>
                <div className="pct">{pct(male)}%</div>
                <div className="lg">
                  <i style={{ background: 'var(--donut-a)' }} /> Laki-laki ({male})
                </div>
              </div>
            </div>
            <Donut
              centerLabel="pasien"
              segments={[
                { label: 'Laki-laki', value: male, color: 'var(--donut-a)' },
                { label: 'Perempuan', value: female, color: 'var(--donut-b)' },
              ]}
            />
          </div>
        </section>
      </div>
      <p className="note">Warna triase: {(Object.keys(COLOR_LABEL) as TriageColor[]).map((c) => COLOR_LABEL[c]).join(', ')}. Pasien tanpa triase tidak masuk grafik.</p>
    </>
  )
}