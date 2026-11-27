'use client'

import { useState } from 'react'
import { ABCDE, FAST_AREAS, GCS_E, GCS_M, GCS_V, INJURY_TYPES, REGIONS, TRAUMA_CRITERIA } from '@/lib/constants'
import { gcsTotal, hm, lastVital, revisedTraumaScore, traumaActivation } from '@/lib/clinical'
import { activateMtp, activateTraumaTeam, addInjury, markTrauma, removeInjury, updateTrauma } from '@/lib/actions'
import { newTrauma } from '@/lib/factory'
import type { AbcdeItem, AbcdeKey, AbcdeStatus, FastKey, FastResult, Mist, RegionKey, TraumaRecord, Visit } from '@/lib/types'
import { useAuth, useCtx } from '../providers'
import { Chip, ConfirmButton, Empty, useRunner } from '../ui'

const ABCDE_STATUS: AbcdeStatus[] = ['Belum dinilai', 'Aman', 'Bermasalah']
const FAST_RESULTS: FastResult[] = ['Belum', 'Negatif', 'Positif', 'Tidak jelas']

/** Kategori cedera kepala berdasarkan GCS. */
const gcsCategory = (g: number) => (g <= 8 ? { label: 'Cedera kepala berat', kind: 'crit' } : g <= 12 ? { label: 'Cedera kepala sedang', kind: 'warn' } : { label: 'Cedera kepala ringan', kind: 'ok' })

export function TabTrauma({ v }: { v: Visit }) {
  const ctx = useCtx()!
  const { busy, run } = useRunner()
  const closed = v.status === 'keluar'

  if (!v.isTrauma || !v.trauma)
    return (
      <Empty>
        Pasien belum ditandai sebagai pasien trauma.{' '}
        {!closed && (
          <button type="button" className="btn sm primary" disabled={busy} onClick={() => run(() => markTrauma(ctx, v), 'Pasien ditandai trauma.')}>
            Tandai trauma
          </button>
        )}
      </Empty>
    )

  const t = { ...newTrauma(), ...v.trauma }
  return (
    <>
      <Activation v={v} t={t} closed={closed} />
      <div className="grid2" style={{ marginTop: 14, alignItems: 'start' }}>
        <MistForm v={v} t={t} closed={closed} />
        <GcsPanel v={v} t={t} closed={closed} />
      </div>
      <AbcdePanel v={v} t={t} closed={closed} />
      <div className="grid2" style={{ marginTop: 14, alignItems: 'start' }}>
        <InjuryMap v={v} t={t} closed={closed} />
        <FastPanel v={v} t={t} closed={closed} />
      </div>
    </>
  )
}

type P = { v: Visit; t: TraumaRecord; closed: boolean }

/* ---------- Kriteria aktivasi tim trauma dan transfusi masif ---------- */
function Activation({ v, t, closed }: P) {
  const ctx = useCtx()!
  const { user } = useAuth()
  const { busy, run } = useRunner()
  const { physio } = traumaActivation(t, v)
  const chosen = TRAUMA_CRITERIA.filter((c) => t.criteria.includes(c.key))
  const tier: 'penuh' | 'parsial' | null = physio.length || chosen.some((c) => c.tier === 1) ? 'penuh' : chosen.length ? 'parsial' : null
  const doctor = user?.role === 'dokter' || user?.role === 'kepala'

  const toggle = (key: string) => {
    const next = t.criteria.includes(key) ? t.criteria.filter((k) => k !== key) : [...t.criteria, key]
    void run(() => updateTrauma(ctx, v, { criteria: next }))
  }

  return (
    <section className="panel">
      <div className="ph">
        <h3 style={{ margin: 0 }}>Aktivasi tim trauma</h3>
        {t.teamActivatedAt ? (
          <Chip kind="crit">
            Tim {t.teamTier} aktif sejak {hm(t.teamActivatedAt)}
          </Chip>
        ) : tier ? (
          <Chip kind={tier === 'penuh' ? 'crit' : 'warn'}>Saran: aktivasi {tier}</Chip>
        ) : (
          <Chip kind="gray">Belum memenuhi kriteria</Chip>
        )}
      </div>
      <div className="grid2" style={{ alignItems: 'start' }}>
        <div>
          <div className="small muted" style={{ marginBottom: 6 }}>
            Kriteria fisiologis (otomatis dari tanda vital terakhir dan GCS)
          </div>
          {physio.length ? (
            <div className="row">
              {physio.map((x) => (
                <Chip key={x} kind="crit">
                  {x}
                </Chip>
              ))}
            </div>
          ) : (
            <p className="small">Tidak ada (TD sistolik ≥ 90, GCS ≥ 14, napas 10-29).</p>
          )}
          <div className="small muted" style={{ margin: '10px 0 6px' }}>
            Kriteria anatomis dan mekanisme
          </div>
          <div className="checks" style={{ gridTemplateColumns: '1fr' }}>
            {TRAUMA_CRITERIA.map((c) => (
              <label key={c.key}>
                <input type="checkbox" checked={t.criteria.includes(c.key)} disabled={closed || busy} onChange={() => toggle(c.key)} />
                <span>
                  {c.label} <Chip kind={c.tier === 1 ? 'crit' : 'warn'}>{c.tier === 1 ? 'penuh' : 'parsial'}</Chip>
                </span>
              </label>
            ))}
          </div>
        </div>
        <div className="stack">
          {!closed && !t.teamActivatedAt && (
            <div className="row">
              <button type="button" className={`btn ${tier === 'penuh' ? 'primary' : ''}`} disabled={busy} onClick={() => run(() => activateTraumaTeam(ctx, v, 'penuh'), 'Tim trauma penuh dipanggil.')}>
                Aktifkan tim penuh
              </button>
              <button type="button" className={`btn ${tier === 'parsial' ? 'primary' : ''}`} disabled={busy} onClick={() => run(() => activateTraumaTeam(ctx, v, 'parsial'), 'Tim trauma parsial dipanggil.')}>
                Aktifkan tim parsial
              </button>
            </div>
          )}
          <div className={`callout ${t.mtpAt ? 'crit' : 'info'}`}>
            <b>Protokol transfusi masif (MTP)</b>
            <div className="small" style={{ margin: '4px 0 8px' }}>
              {t.mtpAt ? `Aktif sejak ${hm(t.mtpAt)}. Permintaan dikirim ke bank darah.` : 'Untuk perdarahan masif dengan syok. Mengirim permintaan darah segera ke bank darah.'}
            </div>
            {!t.mtpAt && !closed && doctor && (
              <ConfirmButton className="btn sm" disabled={busy} confirmText="Klik lagi untuk aktifkan MTP" onConfirm={() => void run(() => activateMtp(ctx, v), 'MTP diaktifkan.')}>
                Aktifkan MTP
              </ConfirmButton>
            )}
            {!t.mtpAt && !doctor && <span className="small muted">Diaktifkan oleh dokter.</span>}
          </div>
        </div>
      </div>
    </section>
  )
}

/* ---------- MIST (serah terima pra-rumah sakit) ---------- */
function MistForm({ v, t, closed }: P) {
  const ctx = useCtx()!
  const { busy, run } = useRunner()
  const [m, setM] = useState<Mist>(t.mist)
  const dirty = JSON.stringify(m) !== JSON.stringify(t.mist)
  const fields: [keyof Mist, string, string][] = [
    ['m', 'M · Mechanism', 'Mekanisme cedera, misal motor vs truk, kecepatan tinggi'],
    ['i', 'I · Injuries', 'Cedera yang ditemukan atau dicurigai'],
    ['s', 'S · Signs', 'Tanda vital dan kesadaran di lokasi / ambulans'],
    ['t', 'T · Treatment', 'Tindakan yang sudah diberikan sebelum tiba'],
  ]
  return (
    <form
      className="panel"
      onSubmit={(e) => {
        e.preventDefault()
        void run(() => updateTrauma(ctx, v, { mist: m }, 'Data MIST diperbarui'), 'MIST tersimpan.')
      }}
    >
      <h3>MIST</h3>
      <fieldset disabled={closed || busy} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }} className="stack">
        {fields.map(([k, l, ph]) => (
          <div className="f" key={k}>
            <label htmlFor={`mist-${k}`}>{l}</label>
            <textarea id={`mist-${k}`} rows={2} placeholder={ph} value={m[k]} onChange={(e) => setM({ ...m, [k]: e.target.value })} />
          </div>
        ))}
      </fieldset>
      {!closed && (
        <div className="formfoot">
          <button className="btn primary" disabled={busy || !dirty}>
            Simpan MIST
          </button>
        </div>
      )}
    </form>
  )
}

/* ---------- GCS dan Revised Trauma Score ---------- */
function GcsPanel({ v, t, closed }: P) {
  const ctx = useCtx()!
  const { busy, run } = useRunner()
  const [g, setG] = useState(t.gcs)
  const total = gcsTotal(g)
  const cat = gcsCategory(total)
  const l = lastVital(v)
  const rts = l ? revisedTraumaScore(total, l.sys, l.rr) : null
  const dirty = JSON.stringify(g) !== JSON.stringify(t.gcs)
  const sel = (k: 'e' | 'v' | 'm', label: string, opts: [number, string][]) => (
    <div className="f">
      <label htmlFor={`gcs-${k}`}>{label}</label>
      <select id={`gcs-${k}`} value={g[k]} onChange={(e) => setG({ ...g, [k]: Number(e.target.value) })}>
        {opts.map(([n, txt]) => (
          <option key={n} value={n}>
            {n} · {txt}
          </option>
        ))}
      </select>
    </div>
  )
  return (
    <form
      className="panel"
      onSubmit={(e) => {
        e.preventDefault()
        void run(() => updateTrauma(ctx, v, { gcs: g }, `GCS dinilai: E${g.e}V${g.v}M${g.m} = ${total}`), `GCS ${total} tersimpan.`)
      }}
    >
      <div className="ph">
        <h3 style={{ margin: 0 }}>Glasgow Coma Scale</h3>
        <Chip kind={cat.kind}>
          GCS {total} · {cat.label}
        </Chip>
      </div>
      <fieldset disabled={closed || busy} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }} className="stack">
        {sel('e', 'Eye (mata)', GCS_E)}
        {sel('v', 'Verbal', GCS_V)}
        {sel('m', 'Motorik', GCS_M)}
      </fieldset>
      <p className="mono" style={{ margin: '10px 0 0' }}>
        E{g.e} V{g.v} M{g.m} = {total}
      </p>
      {rts !== null && (
        <p className="small" style={{ margin: '6px 0 0' }}>
          <b>Revised Trauma Score:</b> {rts.toFixed(2)} dari 7,84 (GCS {total}, TD {l!.sys}, RR {l!.rr} jam {hm(l!.at)}).{' '}
          {rts < 4 ? <Chip kind="crit">sangat berat</Chip> : rts < 7 ? <Chip kind="warn">perlu pusat trauma</Chip> : null}
        </p>
      )}
      {total <= 8 && <div className="callout crit" style={{ marginTop: 10 }}>GCS 8 atau kurang: amankan jalan napas, pertimbangkan intubasi.</div>}
      {!closed && (
        <div className="formfoot">
          <button className="btn primary" disabled={busy || !dirty}>
            Simpan GCS
          </button>
        </div>
      )}
    </form>
  )
}

/* ---------- Primary survey ABCDE ---------- */
function AbcdePanel({ v, t, closed }: P) {
  const ctx = useCtx()!
  const { busy, run } = useRunner()
  const [a, setA] = useState<Record<AbcdeKey, AbcdeItem>>(t.abcde)
  const dirty = JSON.stringify(a) !== JSON.stringify(t.abcde)
  const problems = ABCDE.filter(([k]) => a[k].status === 'Bermasalah')
  const nextKey = ABCDE.find(([k]) => a[k].status === 'Belum dinilai')?.[0]
  const set = (k: AbcdeKey, patch: Partial<AbcdeItem>) => setA({ ...a, [k]: { ...a[k], ...patch } })
  return (
    <form
      className="panel"
      style={{ marginTop: 14 }}
      onSubmit={(e) => {
        e.preventDefault()
        void run(
          () => updateTrauma(ctx, v, { abcde: a }, `Primary survey ABCDE diperbarui${problems.length ? `: masalah di ${problems.map(([k]) => k).join(', ')}` : ''}`),
          'ABCDE tersimpan.',
        )
      }}
    >
      <div className="ph">
        <h3 style={{ margin: 0 }}>Primary survey ABCDE</h3>
        {nextKey ? <span className="small muted">Nilai berurutan. Berikutnya: {nextKey}</span> : <Chip kind={problems.length ? 'warn' : 'ok'}>{problems.length ? `${problems.length} bermasalah` : 'Semua aman'}</Chip>}
      </div>
      <fieldset disabled={closed || busy} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        <div className="tablewrap">
          <table>
            <tbody>
              {ABCDE.map(([k, label]) => (
                <tr key={k}>
                  <td style={{ width: 150 }}>
                    <b>{k}</b> · {label}
                  </td>
                  <td style={{ width: 290 }}>
                    <div className="seg" role="radiogroup" aria-label={label}>
                      {ABCDE_STATUS.map((s) => (
                        <button key={s} type="button" className={a[k].status === s ? 'on' : ''} onClick={() => set(k, { status: s })}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </td>
                  <td>
                    <input type="text" aria-label={`Catatan ${label}`} placeholder="Temuan dan tindakan" value={a[k].note} onChange={(e) => set(k, { note: e.target.value })} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </fieldset>
      {problems.length > 0 && (
        <div className="callout warn" style={{ marginTop: 10 }}>
          Atasi masalah {problems.map(([k, l]) => `${k} (${l})`).join(', ')} sebelum lanjut ke secondary survey.
        </div>
      )}
      {!closed && (
        <div className="formfoot">
          <button className="btn primary" disabled={busy || !dirty}>
            Simpan ABCDE
          </button>
        </div>
      )}
    </form>
  )
}

/* ---------- Peta cedera ---------- */
const SHAPES: { k: RegionKey; el: 'circle' | 'rect'; a: Record<string, number> }[] = [
  { k: 'kepala', el: 'circle', a: { cx: 80, cy: 26, r: 19 } },
  { k: 'leher', el: 'rect', a: { x: 72, y: 45, width: 16, height: 13, rx: 3 } },
  { k: 'dada', el: 'rect', a: { x: 52, y: 60, width: 56, height: 50, rx: 8 } },
  { k: 'perut', el: 'rect', a: { x: 54, y: 112, width: 52, height: 38, rx: 6 } },
  { k: 'pelvis', el: 'rect', a: { x: 54, y: 152, width: 52, height: 24, rx: 6 } },
  { k: 'lengan_ka', el: 'rect', a: { x: 30, y: 62, width: 19, height: 58, rx: 8 } },
  { k: 'tangan_ka', el: 'rect', a: { x: 24, y: 123, width: 19, height: 64, rx: 8 } },
  { k: 'lengan_ki', el: 'rect', a: { x: 111, y: 62, width: 19, height: 58, rx: 8 } },
  { k: 'tangan_ki', el: 'rect', a: { x: 117, y: 123, width: 19, height: 64, rx: 8 } },
  { k: 'paha_ka', el: 'rect', a: { x: 55, y: 178, width: 24, height: 70, rx: 8 } },
  { k: 'tungkai_ka', el: 'rect', a: { x: 57, y: 250, width: 20, height: 80, rx: 8 } },
  { k: 'paha_ki', el: 'rect', a: { x: 81, y: 178, width: 24, height: 70, rx: 8 } },
  { k: 'tungkai_ki', el: 'rect', a: { x: 83, y: 250, width: 20, height: 80, rx: 8 } },
]

function InjuryMap({ v, t, closed }: P) {
  const ctx = useCtx()!
  const { busy, run } = useRunner()
  const [region, setRegion] = useState<RegionKey | null>(null)
  const [type, setType] = useState(INJURY_TYPES[0])
  const injured = new Set(t.injuries.map((i) => i.region))

  return (
    <section className="panel">
      <div className="ph">
        <h3 style={{ margin: 0 }}>Peta cedera</h3>
        <span className="small muted">{t.injuries.length} cedera ditandai</span>
      </div>
      <div className="body-wrap">
        <svg className="body-svg" viewBox="0 0 160 340" width="100%" role="group" aria-label="Peta tubuh tampak depan">
          {SHAPES.map(({ k, el, a }) => {
            const cls = `rg ${injured.has(k) ? 'inj' : ''} ${region === k ? 'sel' : ''}`
            const props = { className: cls, onClick: () => setRegion(k), role: 'button', 'aria-label': REGIONS[k], tabIndex: 0 }
            return el === 'circle' ? (
              <circle key={k} {...props} {...a}>
                <title>{REGIONS[k]}</title>
              </circle>
            ) : (
              <rect key={k} {...props} {...a}>
                <title>{REGIONS[k]}</title>
              </rect>
            )
          })}
          <text x={20} y={338}>
            Kanan
          </text>
          <text x={118} y={338}>
            Kiri
          </text>
        </svg>
        <div className="stack">
          {!closed && (
            <div className="stack" style={{ gap: 8 }}>
              <div className="small muted">{region ? `Area terpilih: ${REGIONS[region]}` : 'Klik area tubuh di gambar untuk memilih.'}</div>
              <div className="f">
                <label htmlFor="inj-type">Jenis cedera</label>
                <select id="inj-type" value={type} onChange={(e) => setType(e.target.value)}>
                  {INJURY_TYPES.map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </div>
              <button type="button" className="btn primary" disabled={!region || busy} onClick={() => region && run(() => addInjury(ctx, v, region, type), `${type} di ${REGIONS[region]} ditandai.`)}>
                Tandai cedera
              </button>
            </div>
          )}
          {t.injuries.length ? (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}>
              {t.injuries.map((i, n) => (
                <li key={`${i.region}-${i.at}-${n}`} className="row" style={{ justifyContent: 'space-between', borderBottom: '1px dashed var(--line)', paddingBottom: 4 }}>
                  <span>
                    <b>{REGIONS[i.region]}</b> · {i.type} <span className="small muted">{hm(i.at)}</span>
                  </span>
                  {!closed && (
                    <button type="button" className="btn sm" disabled={busy} onClick={() => run(() => removeInjury(ctx, v, n), 'Cedera dihapus.')}>
                      Hapus
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="small muted">Belum ada cedera ditandai.</p>
          )}
        </div>
      </div>
    </section>
  )
}

/* ---------- eFAST ---------- */
function FastPanel({ v, t, closed }: P) {
  const ctx = useCtx()!
  const { busy, run } = useRunner()
  const [f, setF] = useState<Record<FastKey, FastResult>>(t.fast)
  const dirty = JSON.stringify(f) !== JSON.stringify(t.fast)
  const positive = FAST_AREAS.filter(([k]) => f[k] === 'Positif')
  const l = lastVital(v)
  return (
    <form
      className="panel"
      onSubmit={(e) => {
        e.preventDefault()
        void run(() => updateTrauma(ctx, v, { fast: f }, `FAST: ${positive.length ? `positif di ${positive.map(([, x]) => x).join(', ')}` : 'tidak ada cairan bebas'}`), 'Hasil FAST tersimpan.')
      }}
    >
      <h3>USG FAST</h3>
      <fieldset disabled={closed || busy} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }} className="stack">
        {FAST_AREAS.map(([k, label]) => (
          <div className="f" key={k}>
            <label htmlFor={`fast-${k}`}>{label}</label>
            <select id={`fast-${k}`} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value as FastResult })}>
              {FAST_RESULTS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </div>
        ))}
      </fieldset>
      {positive.length > 0 && (
        <div className="callout crit" style={{ marginTop: 10 }}>
          FAST positif ({positive.map(([, x]) => x).join(', ')})
          {l && l.sys < 90 ? ` dengan TD ${l.sys} mmHg: pertimbangkan operasi segera dan MTP.` : '. Konsultasi bedah, pertimbangkan CT bila hemodinamik stabil.'}
        </div>
      )}
      {!closed && (
        <div className="formfoot">
          <button className="btn primary" disabled={busy || !dirty}>
            Simpan FAST
          </button>
        </div>
      )}
    </form>
  )
}
