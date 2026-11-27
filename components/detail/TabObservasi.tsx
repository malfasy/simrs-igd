'use client'

import { useMemo, useState } from 'react'
import { MIN, OBS_INTERVAL } from '@/lib/constants'
import { hm, isChild, lastVital, news2, newsRisk, tanggalJam } from '@/lib/clinical'
import { addVitals, simulateMonitorReading } from '@/lib/actions'
import type { Visit, VitalSign } from '@/lib/types'
import { useCtx } from '../providers'
import { Chip, DueIn, Empty, NewsChart, useNow, useRunner } from '../ui'
import { draftFrom, partialVitals, toVitalInput, VitalFields } from './VitalFields'

/**
 * Interval observasi ulang (menit): dasar dari level triase, dipercepat bila NEWS2 tinggi.
 * NEWS2 ≥ 7 → tiap 15 menit (idealnya pemantauan kontinu), 5-6 atau ada nilai 3 → maks. 30 menit.
 */
export function obsInterval(v: Visit): { minutes: number; reason: string } {
  const base = v.level ? OBS_INTERVAL[v.level] : 60
  const l = lastVital(v)
  if (l && !isChild(v)) {
    if (l.news >= 7) return { minutes: 15, reason: `NEWS2 ${l.news} (risiko tinggi)` }
    if ((l.news >= 5 || l.newsHasThree) && base > 30) return { minutes: 30, reason: `NEWS2 ${l.news}${l.newsHasThree ? ', ada parameter bernilai 3' : ''}` }
  }
  return { minutes: base, reason: v.level ? `Triase level ${v.level}` : 'Belum ditriase' }
}

const RISK_KIND = { ok: 'ok', warn: 'warn', crit: 'crit' } as const

/** Panah tren dibanding pengukuran sebelumnya. */
const trend = (now: number, prev: number | undefined) => (prev === undefined || now === prev ? '' : now > prev ? ' ↑' : ' ↓')

export function TabObservasi({ v }: { v: Visit }) {
  const ctx = useCtx()!
  const { busy, run } = useRunner()
  const now = useNow(15_000)
  const closed = v.status === 'keluar'
  const child = isChild(v)
  const last = lastVital(v)
  const [vit, setVit] = useState(() => draftFrom(last))
  const [source, setSource] = useState<'manual' | 'monitor'>('manual')

  // Pratinjau NEWS2 saat perawat mengetik (hanya jika semua parameter terisi).
  const preview = useMemo(() => {
    const p = partialVitals(vit)
    if ([p.sys, p.hr, p.rr, p.temp, p.spo2, p.gcs].some((x) => x === null)) return null
    return news2({ sys: p.sys!, dia: p.dia ?? 0, hr: p.hr!, rr: p.rr!, temp: p.temp!, spo2: p.spo2!, gcs: p.gcs!, o2: vit.o2, pain: null })
  }, [vit])

  const iv = obsInterval(v)
  const dueAt = last ? last.at + iv.minutes * MIN : v.arrivalTime
  const overdue = !closed && now > dueAt
  const risk = last ? newsRisk(last.news, last.newsHasThree) : null

  const submit = () =>
    run(async () => {
      const input = toVitalInput(vit, true)
      const vs = await addVitals(ctx, v, input, source)
      setSource('manual')
      return vs
    }, (vs) => `Tanda vital tersimpan. NEWS2 ${vs.news}.`)

  return (
    <>
      {/* ---------- Ringkasan status ---------- */}
      <div className="stats compact" style={{ marginBottom: 12 }}>
        <div className={`stat ${risk ? { ok: 'green', warn: 'yellow', crit: 'red' }[risk.cls] : ''}`}>
          <div className="n">{last ? last.news : '-'}</div>
          <div className="l">NEWS2 terakhir{child ? ' (tidak untuk anak)' : ''}</div>
        </div>
        <div className="stat">
          <div className="n">{last ? hm(last.at) : '-'}</div>
          <div className="l">Observasi terakhir</div>
        </div>
        <div className="stat">
          <div className="n">tiap {iv.minutes} mnt</div>
          <div className="l">Interval · {iv.reason}</div>
        </div>
        <div className={`stat ${overdue ? 'red' : ''}`}>
          <div className="n" style={{ fontSize: 18 }}>{closed ? '-' : <DueIn at={dueAt} />}</div>
          <div className="l">Observasi berikutnya</div>
        </div>
      </div>

      {overdue && (
        <div className="callout crit" style={{ marginBottom: 12 }}>
          <b>Pengingat:</b> observasi ulang sudah lewat jadwal ({hm(dueAt)}). Ukur tanda vital sekarang.
        </div>
      )}
      {risk && !child && risk.cls !== 'ok' && (
        <div className={`callout ${risk.cls}`} style={{ marginBottom: 12 }}>
          <b>{risk.label}:</b> {risk.advice}
        </div>
      )}
      {child && (
        <div className="callout info" style={{ marginBottom: 12 }}>
          Pasien anak (di bawah 16 tahun). NEWS2 dirancang untuk dewasa, jadi skor hanya sebagai catatan. Gunakan penilaian klinis atau skor peringatan anak.
        </div>
      )}

      <div className="grid2" style={{ alignItems: 'start' }}>
        {/* ---------- Form tanda vital ---------- */}
        <form
          className="panel"
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
        >
          <div className="ph">
            <h3 style={{ margin: 0 }}>Input tanda vital</h3>
            {!closed && (
              <button
                type="button"
                className="btn sm"
                onClick={() => {
                  setVit(draftFrom(simulateMonitorReading(v)))
                  setSource('monitor')
                }}
              >
                Ambil dari monitor bedside
              </button>
            )}
          </div>
          {source === 'monitor' && <div className="callout info" style={{ marginBottom: 10 }}>Data diisi dari monitor (simulasi HL7). Periksa dulu sebelum disimpan.</div>}
          <fieldset disabled={closed || busy} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
            <div className="fields">
              <VitalFields prefix="ob" value={vit} onChange={(d) => setVit(d)} withPain />
            </div>
          </fieldset>
          {preview && (
            <div className="sugg" style={{ marginTop: 12 }}>
              <h4 style={{ margin: 0 }}>
                Pratinjau NEWS2: {preview.score} · {newsRisk(preview.score, preview.hasThree).label}
              </h4>
              <div className="small">{newsRisk(preview.score, preview.hasThree).advice}</div>
            </div>
          )}
          <div className="formfoot">
            <button className="btn primary" disabled={busy || closed}>
              Simpan observasi
            </button>
            <span className="small muted">Dikirim sebagai 7 Observation tanda vital ke Satu Sehat.</span>
          </div>
        </form>

        {/* ---------- Grafik ---------- */}
        <section className="panel">
          <div className="ph">
            <h3 style={{ margin: 0 }}>Tren NEWS2</h3>
            <span className="small muted">{v.vitals.length} pengukuran</span>
          </div>
          {v.vitals.length ? <NewsChart vitals={v.vitals} /> : <Empty>Belum ada tanda vital.</Empty>}
          {v.vitals.length > 1 && <VitalTrend vitals={v.vitals} />}
        </section>
      </div>

      {/* ---------- Riwayat ---------- */}
      {v.vitals.length > 0 && (
        <section className="panel" style={{ marginTop: 14 }}>
          <h3>Riwayat observasi</h3>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Jam</th>
                  <th>TD</th>
                  <th>Nadi</th>
                  <th>RR</th>
                  <th>Suhu</th>
                  <th>SpO₂</th>
                  <th>GCS</th>
                  <th>Nyeri</th>
                  <th>NEWS2</th>
                  <th>Sumber</th>
                  <th>Oleh</th>
                </tr>
              </thead>
              <tbody>
                {[...v.vitals]
                  .map((x, i, arr) => ({ x, p: arr[i - 1] as VitalSign | undefined }))
                  .reverse()
                  .map(({ x, p }) => {
                    const r = newsRisk(x.news, x.newsHasThree)
                    return (
                      <tr key={x.at}>
                        <td className="mono" title={tanggalJam(x.at)}>
                          {hm(x.at)}
                        </td>
                        <td className="mono">
                          {x.sys}/{x.dia}
                          {trend(x.sys, p?.sys)}
                        </td>
                        <td className="mono">
                          {x.hr}
                          {trend(x.hr, p?.hr)}
                        </td>
                        <td className="mono">
                          {x.rr}
                          {trend(x.rr, p?.rr)}
                        </td>
                        <td className="mono">
                          {x.temp}
                          {trend(x.temp, p?.temp)}
                        </td>
                        <td className="mono">
                          {x.spo2}
                          {x.o2 ? ' +O₂' : ''}
                        </td>
                        <td className="mono">{x.gcs}</td>
                        <td className="mono">{x.pain ?? '-'}</td>
                        <td>
                          <Chip kind={RISK_KIND[r.cls]}>{x.news}</Chip>
                        </td>
                        <td>{x.source === 'monitor' ? 'Monitor' : 'Manual'}</td>
                        <td>{x.by}</td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  )
}

/** Perbandingan pengukuran pertama dan terakhir. */
function VitalTrend({ vitals }: { vitals: VitalSign[] }) {
  const a = vitals[0]
  const b = vitals[vitals.length - 1]
  const rows: [string, number, number, string][] = [
    ['NEWS2', a.news, b.news, ''],
    ['TD sistolik', a.sys, b.sys, ' mmHg'],
    ['Nadi', a.hr, b.hr, '/mnt'],
    ['Napas', a.rr, b.rr, '/mnt'],
    ['SpO₂', a.spo2, b.spo2, '%'],
  ]
  const better = b.news < a.news ? 'membaik' : b.news > a.news ? 'memburuk' : 'stabil'
  return (
    <>
      <p className="small" style={{ margin: '10px 0 6px' }}>
        Sejak {hm(a.at)}: kondisi <b>{better}</b> berdasarkan NEWS2.
      </p>
      <dl className="kv">
        {rows.map(([l, x, y, u]) => (
          <div key={l} style={{ display: 'contents' }}>
            <dt>{l}</dt>
            <dd className="mono">
              {x}
              {u} → {y}
              {u}
            </dd>
          </div>
        ))}
      </dl>
    </>
  )
}
