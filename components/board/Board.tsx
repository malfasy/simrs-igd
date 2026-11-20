'use client'

import Link from 'next/link'
import { useState } from 'react'
import { AREAS, BEDS, BOARDING_LIMIT, complaintLabel, DISPO, LEVELS, PATHWAYS, STATUS_LABEL, targetMinutes } from '@/lib/constants'
import { ageSex, areaOf, displayName, displayRm, freeBeds, hm, isActive, isAlert, isBoarding, isChild, lastVital, newsRisk, waitState } from '@/lib/clinical'
import type { PathwayKey, Visit } from '@/lib/types'
import { useAuth, useData, useStore } from '../providers'
import { Chip, Countdown, Empty, Timer, TriageChip, useNow, useRunner } from '../ui'

export function Board() {
  const data = useData()
  const store = useStore()
  const { user } = useAuth()
  const now = useNow(10_000)
  const [sort, setSort] = useState<'prioritas' | 'bed'>('prioritas')
  const [area, setArea] = useState('Semua')
  const { busy, run } = useRunner()

  const act = data.visits.filter(isActive)
  const cnt = (c: string) => act.filter((v) => v.color === c).length
  const over = act.filter((v) => waitState(v, now) === 'over').length
  const untriaged = act.filter((v) => !v.color).length
  const boarding = act.filter((v) => isBoarding(v, now)).length
  const free = freeBeds(data.visits)
  const prio = (v: Visit) => (v.status === 'terdaftar' ? 0.5 : v.level ?? (v.color === 'black' ? 7 : 6)) + (v.status === 'menunggu_disposisi' ? 10 : 0)
  const list = act
    .filter((v) => area === 'Semua' || areaOf(v) === area)
    .sort(sort === 'prioritas' ? (a, b) => prio(a) - prio(b) || a.arrivalTime - b.arrivalTime : (a, b) => (a.bed ?? 'ZZ').localeCompare(b.bed ?? 'ZZ'))

  if (!data.visits.length && !data.prearrivals.length) {
    return (
      <>
        <div className="vh">
          <div>
            <h1>Papan IGD</h1>
            <p className="sub">Belum ada pasien</p>
          </div>
        </div>
        <Empty>
          <p>Belum ada data kunjungan.</p>
          <div className="formfoot" style={{ justifyContent: 'center' }}>
            {user?.role === 'kepala' && (
              <button className="btn primary" disabled={busy} onClick={() => void run(() => store.loadSampleData(), 'Data contoh dimuat.')}>
                Muat data contoh
              </button>
            )}
            {user?.role !== 'dokter' && (
              <Link className="btn" href="/pendaftaran">
                Daftarkan pasien
              </Link>
            )}
          </div>
        </Empty>
      </>
    )
  }

  return (
    <>
      <div className="vh">
        <div>
          <h1>Papan IGD</h1>
          <p className="sub">
            {act.length} pasien aktif &middot; urutan {sort === 'prioritas' ? 'berdasarkan level triase, lalu jam datang' : 'berdasarkan nomor bed'}
          </p>
        </div>
        <div className="row">
          <div className="seg" role="group" aria-label="Urutan">
            <button className={sort === 'prioritas' ? 'on' : ''} onClick={() => setSort('prioritas')}>
              Prioritas
            </button>
            <button className={sort === 'bed' ? 'on' : ''} onClick={() => setSort('bed')}>
              Bed
            </button>
          </div>
          <select id="areaFilter" aria-label="Filter area" value={area} onChange={(e) => setArea(e.target.value)}>
            {AREAS.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </div>
      </div>

      <section className="stats">
        <Stat cls="red" n={cnt('red')} l="Merah (L1-L2)" />
        <Stat cls="yellow" n={cnt('yellow')} l="Kuning (L3)" />
        <Stat cls="green" n={cnt('green')} l="Hijau (L4-L5)" />
        {cnt('black') > 0 && <Stat cls="black" n={cnt('black')} l="Hitam" />}
        <Stat n={untriaged} l="Belum triase" />
        <Stat cls={over ? 'crit' : ''} n={over} l="Lewat target waktu dokter" />
        <Stat cls={boarding ? 'crit' : ''} n={boarding} l={`Menunggu keluar lebih dari ${BOARDING_LIMIT / 60} jam`} />
        <Stat n={`${BEDS.length - free.length}/${BEDS.length}`} l="Bed terisi" />
      </section>

      <div className="bedstrip" aria-label="Status bed">
        <span className="small muted">Bed:</span>
        {BEDS.map((b) => {
          const v = act.find((x) => x.bed === b.id)
          return v ? (
            <Link key={b.id} href={`/pasien/${v.id}`} className={`bed ${v.color ?? 'gray'}`} title={`${b.area}: ${displayName(v)}`} style={{ textDecoration: 'none' }}>
              {b.id}
            </Link>
          ) : (
            <span key={b.id} className="bed" title={`${b.area}: kosong`}>
              {b.id}
            </span>
          )
        })}
      </div>

      {data.prearrivals.length > 0 && (
        <div className="incoming">
          {data.prearrivals.map((p) => (
            <div className="inc" key={p.id}>
              <div>
                <div className="small muted">Akan datang &middot; {p.from}</div>
                <div className="eta">
                  <Countdown to={p.eta} doneText="seharusnya sudah tiba" />
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <b>
                  {p.sex === 'P' ? 'Perempuan' : 'Laki-laki'} &plusmn;{p.age} th
                </b>
                <div className="small">{p.mist.m}</div>
                <div className="small muted">{p.mist.s}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <section className="cards">
        {list.length ? list.map((v) => <PatientCard key={v.id} v={v} now={now} />) : <Empty>Tidak ada pasien di area ini.</Empty>}
      </section>
    </>
  )
}

function Stat({ n, l, cls = '' }: { n: number | string; l: string; cls?: string }) {
  return (
    <div className={`stat ${cls}`}>
      <div className="n">{n}</div>
      <div className="l">{l}</div>
    </div>
  )
}

export function PatientCard({ v, now }: { v: Visit; now: number }) {
  const l = lastVital(v)
  const flags: { k: string; t: string }[] = []
  if (v.isTrauma) flags.push({ k: 'crit', t: 'Trauma' })
  if (v.incidentId) flags.push({ k: 'crit', t: 'Korban massal' })
  if (v.anonymous) flags.push({ k: 'warn', t: 'Tanpa identitas' })
  ;(Object.keys(v.pathways) as PathwayKey[]).forEach((k) => flags.push({ k: 'acc', t: `Jalur ${PATHWAYS[k].name}` }))
  if (l && !isChild(v)) flags.push({ k: newsRisk(l.news, l.newsHasThree).cls, t: `NEWS2 ${l.news}` })
  if (v.assessment?.allergy && !/tidak/i.test(v.assessment.allergy)) flags.push({ k: 'crit', t: 'Alergi' })
  if (v.assessment?.orders.length) {
    const total = v.assessment.orders.length
    const done = v.assessment.orders.filter((k) => v.results[k]?.status === 'selesai').length
    const crit = v.assessment.orders.some((k) => v.results[k]?.critical)
    flags.push({ k: crit ? 'crit' : done === total ? 'ok' : 'soft', t: `Penunjang ${done}/${total}${crit ? ' (kritis)' : ''}` })
  }
  if (v.disposition && !v.billing.payment && v.insurance === 'Umum') flags.push({ k: 'warn', t: 'Tagihan belum lunas' })
  const w = waitState(v, now)

  let foot
  if (v.disposition)
    foot = (
      <>
        <span>
          {DISPO[v.disposition.type]} &middot; diputuskan {hm(v.disposition.decidedAt)}
        </span>
        <Timer since={v.disposition.decidedAt} target={BOARDING_LIMIT} />
      </>
    )
  else if (!v.doctorSeenAt && v.level)
    foot = (
      <>
        <span>
          Datang {hm(v.arrivalTime)} &middot; target dokter {LEVELS[v.level].target ? `≤ ${LEVELS[v.level].target} mnt` : 'segera'}
        </span>
        <Timer since={v.arrivalTime} target={targetMinutes(v.level)} />
      </>
    )
  else
    foot = (
      <>
        <span>
          Datang {hm(v.arrivalTime)}
          {v.doctor ? ` · ${v.doctor}` : ''}
        </span>
        <Timer since={v.arrivalTime} />
      </>
    )

  return (
    <Link href={`/pasien/${v.id}`} className={`pcard ${v.color ?? ''} ${isAlert(v) ? 'alert' : ''} ${w === 'over' ? 'late' : ''}`} aria-label={`Buka ${displayName(v)}`}>
      <div className="pc-top">
        <span className="bedno">{v.bed ?? (v.incidentId ? 'Zona' : 'Tunggu')}</span>
        <TriageChip v={v} />
        <span className="st">{STATUS_LABEL[v.status]}</span>
      </div>
      <h3>
        {displayName(v)}
        <small>{ageSex(v)}</small>
      </h3>
      <div className="small mono muted">{displayRm(v)}</div>
      <p className="cc">
        {complaintLabel(v.complaint)}
        {v.complaintNote ? `: ${v.complaintNote}` : ''}
      </p>
      {flags.length > 0 && (
        <div className="flags">
          {flags.map((f) => (
            <Chip key={f.t} kind={f.k}>
              {f.t}
            </Chip>
          ))}
        </div>
      )}
      <div className="pc-foot">{foot}</div>
    </Link>
  )
}