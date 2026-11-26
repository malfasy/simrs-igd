'use client'

import { useMemo, useState } from 'react'
import { DRUGS, ICD10, ICD9, MIN, ORDERS, ORDER_STATUS_LABEL, PATHWAYS } from '@/lib/constants'
import { dur, hm, icd10Label, icd9Label, lastVital, orderLabel, tanggalJam } from '@/lib/clinical'
import { activatePathway, addCppt, completePathwayStep, saveAssessment } from '@/lib/actions'
import type { PathwayKey, Visit } from '@/lib/types'
import { useAuth, useCtx, useData } from '../providers'
import { Chip, Empty, useRunner } from '../ui'

/** Kata kunci alergi sederhana untuk peringatan resep (bukan pengganti cek farmasi). */
const ALLERGY_KEYS: Record<string, string[]> = {
  'Parasetamol 1 g IV': ['parasetamol', 'paracetamol', 'acetaminophen'],
  'Ketorolak 30 mg IV': ['ketorolak', 'ketorolac', 'nsaid', 'ains'],
  'Ondansetron 4 mg IV': ['ondansetron'],
  'Aspirin 160 mg oral (dikunyah)': ['aspirin', 'asetosal', 'nsaid', 'ains'],
  'Clopidogrel 300 mg oral': ['clopidogrel'],
  'Diazepam 5 mg IV': ['diazepam', 'benzodiazepin'],
  'Salbutamol nebulisasi': ['salbutamol'],
  'Ceftriaxone 2 g IV': ['ceftriaxone', 'sefalosporin', 'cephalosporin'],
  'Asam traneksamat 1 g IV': ['traneksamat', 'tranexamic'],
}

const drugAllergy = (drug: string, allergy: string) => {
  const a = allergy.toLowerCase()
  if (!a.trim() || /^(tidak|tdk|-|disangkal)/.test(a.trim())) return false
  return (ALLERGY_KEYS[drug] ?? []).some((k) => a.includes(k))
}

const toggle = (list: string[], x: string) => (list.includes(x) ? list.filter((i) => i !== x) : [...list, x])

export function TabAsesmen({ v }: { v: Visit }) {
  const ctx = useCtx()!
  const { user } = useAuth()
  const data = useData()
  const { busy, run } = useRunner()
  const a = v.assessment
  const master = v.patientId ? data.patients.find((p) => p.id === v.patientId) : null
  const closed = v.status === 'keluar'
  const canEdit = !closed && (user?.role === 'dokter' || user?.role === 'kepala')

  const [anamnesis, setAnamnesis] = useState(a?.anamnesis ?? (v.complaintNote ? `Keluhan: ${v.complaintNote}. ` : ''))
  const [allergy, setAllergy] = useState(a?.allergy ?? master?.allergies ?? '')
  const [exam, setExam] = useState(a?.exam ?? '')
  const [dx, setDx] = useState<string[]>(a?.diagnoses ?? [])
  const [procs, setProcs] = useState<string[]>(a?.procedures ?? [])
  const [orders, setOrders] = useState<string[]>(a?.orders ?? [])
  const [cito, setCito] = useState(a?.cito ?? false)
  const [drugs, setDrugs] = useState<string[]>(a?.drugs ?? [])
  const [q, setQ] = useState('')

  const dxOptions = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return []
    return ICD10.filter(([c, n]) => !dx.includes(c) && (c.toLowerCase().includes(t) || n.toLowerCase().includes(t))).slice(0, 8)
  }, [q, dx])

  // Order yang sudah diproses laboratorium/radiologi tidak boleh dibatalkan dari sini.
  const locked = (k: string) => !!v.results[k] && v.results[k].status !== 'diminta'
  const dirty =
    JSON.stringify([anamnesis, allergy, exam, dx, procs, orders, cito, drugs]) !==
    JSON.stringify([a?.anamnesis ?? '', a?.allergy ?? '', a?.exam ?? '', a?.diagnoses ?? [], a?.procedures ?? [], a?.orders ?? [], a?.cito ?? false, a?.drugs ?? []])
  const risky = drugs.filter((d) => drugAllergy(d, allergy))

  const submit = () =>
    run(
      () => saveAssessment(ctx, v, { anamnesis: anamnesis.trim(), allergy: allergy.trim(), exam: exam.trim(), diagnoses: dx, procedures: procs, orders, cito, drugs }),
      (n) => `Asesmen tersimpan${n ? `, ${n} order penunjang dikirim` : ''}.`,
    )

  const lv = lastVital(v)
  const vitalText = lv ? `TD ${lv.sys}/${lv.dia} mmHg, N ${lv.hr}x/mnt, RR ${lv.rr}x/mnt, S ${lv.temp} °C, SpO₂ ${lv.spo2}%${lv.o2 ? ' (O₂)' : ''}, GCS ${lv.gcs}` : ''

  return (
    <>
      {!canEdit && (
        <div className="callout info" style={{ marginBottom: 12 }}>
          {closed ? 'Kunjungan sudah selesai. Asesmen hanya bisa dilihat.' : 'Asesmen dokter hanya bisa diubah oleh dokter atau Kepala IGD.'}
        </div>
      )}
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <fieldset disabled={!canEdit || busy} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }} className="stack">
          {/* ---------- Anamnesis dan pemeriksaan ---------- */}
          <section className="panel">
            <div className="ph">
              <h3 style={{ margin: 0 }}>Anamnesis &amp; pemeriksaan fisik</h3>
              {a && (
                <span className="small muted">
                  Terakhir disimpan {tanggalJam(a.updatedAt)} oleh {a.by}
                </span>
              )}
            </div>
            <div className="fields" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: '10px 12px' }}>
              <div className="f wide">
                <label htmlFor="as-anam">Anamnesis (keluhan utama, riwayat penyakit sekarang, riwayat dahulu)</label>
                <textarea id="as-anam" value={anamnesis} onChange={(e) => setAnamnesis(e.target.value)} rows={4} />
              </div>
              <div className="f">
                <label htmlFor="as-alg">Riwayat alergi</label>
                <input type="text" id="as-alg" placeholder="Tulis 'tidak ada' bila disangkal" value={allergy} onChange={(e) => setAllergy(e.target.value)} />
                {master?.allergies && allergy !== master.allergies && <span className="small muted">Rekam medis: {master.allergies}</span>}
              </div>
              <div className="f">
                <label htmlFor="as-exam">Pemeriksaan fisik</label>
                <textarea id="as-exam" value={exam} onChange={(e) => setExam(e.target.value)} rows={3} />
                {vitalText && (
                  <button type="button" className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={() => setExam((x) => (x.includes(vitalText) ? x : `${vitalText}. ${x}`.trim()))}>
                    Sisipkan tanda vital terakhir ({hm(lv!.at)})
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* ---------- Diagnosis ICD-10 ---------- */}
          <section className="panel">
            <div className="ph">
              <h3 style={{ margin: 0 }}>Diagnosis (ICD-10)</h3>
              <span className="small muted">Diagnosis pertama dicatat sebagai diagnosis utama.</span>
            </div>
            <div style={{ position: 'relative', maxWidth: 460 }}>
              <input type="text" aria-label="Cari ICD-10" placeholder="Cari kode atau nama diagnosis, misal I21 atau sepsis" value={q} onChange={(e) => setQ(e.target.value)} />
              {dxOptions.length > 0 && (
                <div className="suggest">
                  {dxOptions.map(([c, n]) => (
                    <button
                      type="button"
                      key={c}
                      onClick={() => {
                        setDx((d) => [...d, c])
                        setQ('')
                      }}
                    >
                      <span>{n}</span>
                      <span className="mono">{c}</span>
                    </button>
                  ))}
                </div>
              )}
              {q.trim() && !dxOptions.length && <div className="small muted" style={{ marginTop: 6 }}>Tidak ada diagnosis yang cocok di daftar.</div>}
            </div>
            {dx.length ? (
              <div className="tablewrap" style={{ marginTop: 10 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Jenis</th>
                      <th>Kode</th>
                      <th>Diagnosis</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {dx.map((c, i) => (
                      <tr key={c}>
                        <td>{i === 0 ? <Chip kind="acc">Utama</Chip> : <Chip kind="gray">Sekunder</Chip>}</td>
                        <td className="mono">{c}</td>
                        <td>{icd10Label(c)}</td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {i > 0 && (
                            <button type="button" className="btn sm" onClick={() => setDx((d) => [c, ...d.filter((x) => x !== c)])}>
                              Jadikan utama
                            </button>
                          )}{' '}
                          <button type="button" className="btn sm" onClick={() => setDx((d) => d.filter((x) => x !== c))}>
                            Hapus
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="small muted">Belum ada diagnosis. Diagnosis utama wajib diisi sebelum asesmen disimpan.</p>
            )}
          </section>

          <div className="grid2">
            {/* ---------- Tindakan ICD-9-CM ---------- */}
            <section className="panel">
              <h3>Tindakan (ICD-9-CM)</h3>
              <div className="checks">
                {ICD9.map(([c, n]) => (
                  <label key={c}>
                    <input type="checkbox" checked={procs.includes(c)} onChange={() => setProcs((p) => toggle(p, c))} />
                    <span>
                      {n} <span className="mono">{c}</span>
                    </span>
                  </label>
                ))}
              </div>
            </section>

            {/* ---------- Order penunjang ---------- */}
            <section className="panel">
              <div className="ph">
                <h3 style={{ margin: 0 }}>Order penunjang</h3>
                <label className="small" style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
                  <input type="checkbox" checked={cito} onChange={(e) => setCito(e.target.checked)} /> <b>CITO</b>
                </label>
              </div>
              {(['Lab', 'Radiologi'] as const).map((unit) => (
                <div key={unit} style={{ marginBottom: 8 }}>
                  <div className="small muted" style={{ margin: '4px 0' }}>
                    {unit === 'Lab' ? 'Laboratorium' : 'Radiologi'}
                  </div>
                  <div className="checks">
                    {ORDERS.filter((o) => o.unit === unit).map((o) => (
                      <label key={o.key} title={locked(o.key) ? 'Sudah diproses, tidak bisa dibatalkan' : undefined}>
                        <input type="checkbox" checked={orders.includes(o.key)} disabled={locked(o.key)} onChange={() => setOrders((x) => toggle(x, o.key))} />
                        <span>
                          {o.label}
                          {v.results[o.key] && (
                            <>
                              {' '}
                              <Chip kind={v.results[o.key].status === 'selesai' ? 'ok' : 'warn'}>{ORDER_STATUS_LABEL[v.results[o.key].status]}</Chip>
                            </>
                          )}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          </div>

          {/* ---------- Resep ---------- */}
          <section className="panel">
            <div className="ph">
              <h3 style={{ margin: 0 }}>Resep / terapi IGD</h3>
              <span className="small muted">{drugs.length} item dipilih</span>
            </div>
            {risky.length > 0 && (
              <div className="callout crit" style={{ marginBottom: 10 }}>
                <b>Peringatan alergi:</b> {risky.join(', ')} mungkin bereaksi dengan riwayat alergi &quot;{allergy}&quot;. Periksa ulang sebelum diberikan.
              </div>
            )}
            <div className="checks">
              {DRUGS.map((d) => (
                <label key={d}>
                  <input type="checkbox" checked={drugs.includes(d)} onChange={() => setDrugs((x) => toggle(x, d))} />
                  <span>
                    {d} {drugAllergy(d, allergy) && <Chip kind="crit">alergi?</Chip>}
                  </span>
                </label>
              ))}
            </div>
          </section>
        </fieldset>

        {canEdit && (
          <div className="formfoot">
            <button className="btn primary" disabled={busy || !dirty}>
              {a ? 'Simpan perubahan asesmen' : 'Simpan asesmen'}
            </button>
            <span className="small muted">
              {dirty ? 'Ada perubahan yang belum disimpan. ' : ''}Item baru dikirim sebagai Condition, Procedure, ServiceRequest, dan MedicationRequest ke Satu Sehat.
            </span>
          </div>
        )}
      </form>

      <div className="grid2" style={{ marginTop: 14 }}>
        <Pathways v={v} canEdit={canEdit} />
        <AsesmenSummary v={v} />
      </div>

      <Cppt v={v} canWrite={!closed && user?.role !== 'pendaftaran'} vitalText={vitalText} />
    </>
  )
}

/* ---------- Ringkasan asesmen tersimpan ---------- */
function AsesmenSummary({ v }: { v: Visit }) {
  const a = v.assessment
  return (
    <section className="panel">
      <h3>Asesmen tersimpan</h3>
      {!a ? (
        <Empty>Belum ada asesmen dokter.</Empty>
      ) : (
        <dl className="kv">
          <dt>Diagnosis utama</dt>
          <dd>
            {a.diagnoses[0] ? (
              <>
                <span className="mono">{a.diagnoses[0]}</span> {icd10Label(a.diagnoses[0])}
              </>
            ) : (
              '-'
            )}
          </dd>
          <dt>Diagnosis sekunder</dt>
          <dd>{a.diagnoses.slice(1).map((c) => `${c} ${icd10Label(c)}`).join('; ') || '-'}</dd>
          <dt>Tindakan</dt>
          <dd>{a.procedures.map((c) => icd9Label(c)).join(', ') || '-'}</dd>
          <dt>Penunjang</dt>
          <dd>
            {a.orders.length
              ? a.orders.map((k) => `${orderLabel(k)} (${v.results[k] ? ORDER_STATUS_LABEL[v.results[k].status].toLowerCase() : 'diminta'})`).join(', ')
              : '-'}
            {a.cito && a.orders.length > 0 && (
              <>
                {' '}
                <Chip kind="crit">CITO</Chip>
              </>
            )}
          </dd>
          <dt>Resep</dt>
          <dd>{a.drugs.join(', ') || '-'}</dd>
          <dt>Alergi</dt>
          <dd>{a.allergy || '-'}</dd>
          <dt>Dokter</dt>
          <dd>
            {a.by}, {tanggalJam(a.updatedAt)}
          </dd>
        </dl>
      )}
    </section>
  )
}

/* ---------- Jalur klinis (STEMI, stroke, sepsis) ---------- */
function Pathways({ v, canEdit }: { v: Visit; canEdit: boolean }) {
  const ctx = useCtx()!
  const { busy, run } = useRunner()
  const keys = Object.keys(PATHWAYS) as PathwayKey[]
  return (
    <section className="panel">
      <div className="ph">
        <h3 style={{ margin: 0 }}>Jalur klinis</h3>
        <span className="small muted">Target dihitung sejak pasien datang</span>
      </div>
      {canEdit && (
        <div className="row" style={{ marginBottom: 6 }}>
          {keys
            .filter((k) => !v.pathways[k])
            .map((k) => (
              <button key={k} type="button" className="btn sm" disabled={busy} onClick={() => run(() => activatePathway(ctx, v, k), `Jalur ${PATHWAYS[k].name} diaktifkan.`)}>
                Aktifkan {PATHWAYS[k].name}
              </button>
            ))}
        </div>
      )}
      {keys.filter((k) => v.pathways[k]).length === 0 && <p className="small muted">Tidak ada jalur klinis aktif.</p>}
      {keys
        .filter((k) => v.pathways[k])
        .map((k) => {
          const st = v.pathways[k]!
          return (
            <div className="pw" key={k}>
              <b>{PATHWAYS[k].name}</b> <span className="small muted">aktif {hm(st.activatedAt)}</span>
              {PATHWAYS[k].steps.map(([key, label, target]) => {
                const doneAt = st.done[key]
                const due = v.arrivalTime + target * MIN
                const late = doneAt ? doneAt > due : Date.now() > due
                return (
                  <div className="step" key={key}>
                    <span>{doneAt ? '✓' : '○'}</span>
                    <span>{label}</span>
                    <span className="small muted">≤ {target} mnt</span>
                    {doneAt ? (
                      <Chip kind={late ? 'warn' : 'ok'}>{dur(doneAt - v.arrivalTime)}</Chip>
                    ) : canEdit ? (
                      <button type="button" className={`btn sm ${late ? 'danger' : ''}`} disabled={busy} onClick={() => run(() => completePathwayStep(ctx, v, k, key), `${label} ditandai selesai.`)}>
                        Selesai
                      </button>
                    ) : (
                      <Chip kind={late ? 'crit' : 'gray'}>{late ? 'lewat target' : 'belum'}</Chip>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
    </section>
  )
}

/* ---------- CPPT (Catatan Perkembangan Pasien Terintegrasi) ---------- */
function Cppt({ v, canWrite, vitalText }: { v: Visit; canWrite: boolean; vitalText: string }) {
  const ctx = useCtx()!
  const { busy, run } = useRunner()
  const blank = { s: '', o: '', a: '', p: '' }
  const [n, setN] = useState(blank)
  const [q, setQ] = useState('')
  const set = (k: keyof typeof blank) => (e: { target: { value: string } }) => setN((x) => ({ ...x, [k]: e.target.value }))
  const list = useMemo(() => {
    const t = q.trim().toLowerCase()
    return [...v.cppt].reverse().filter((c) => !t || [c.s, c.o, c.a, c.p, c.by].join(' ').toLowerCase().includes(t))
  }, [v.cppt, q])

  return (
    <section className="panel" style={{ marginTop: 14 }}>
      <div className="ph">
        <h3 style={{ margin: 0 }}>CPPT (SOAP)</h3>
        <span className="small muted">{v.cppt.length} catatan</span>
      </div>
      {canWrite && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void run(async () => {
              await addCppt(ctx, v, n)
              setN(blank)
            }, 'Catatan CPPT tersimpan.')
          }}
        >
          <div className="fields" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: '10px 12px' }}>
            <div className="f">
              <label htmlFor="cp-s">S (subjektif)</label>
              <textarea id="cp-s" value={n.s} onChange={set('s')} />
            </div>
            <div className="f">
              <label htmlFor="cp-o">O (objektif)</label>
              <textarea id="cp-o" value={n.o} onChange={set('o')} />
              {vitalText && (
                <button type="button" className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={() => setN((x) => ({ ...x, o: x.o ? `${x.o}\n${vitalText}` : vitalText }))}>
                  Isi dari tanda vital
                </button>
              )}
            </div>
            <div className="f">
              <label htmlFor="cp-a">A (asesmen)</label>
              <textarea id="cp-a" value={n.a} onChange={set('a')} />
            </div>
            <div className="f">
              <label htmlFor="cp-p">P (rencana)</label>
              <textarea id="cp-p" value={n.p} onChange={set('p')} />
            </div>
          </div>
          <div className="formfoot">
            <button className="btn primary" disabled={busy}>
              Tambah catatan
            </button>
          </div>
        </form>
      )}
      {v.cppt.length > 0 && (
        <>
          <div className="toolbar" style={{ marginTop: 12 }}>
            <div className="searchbox">
              <input type="text" aria-label="Cari CPPT" placeholder="Cari isi catatan atau nama petugas" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </div>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Waktu</th>
                  <th>S</th>
                  <th>O</th>
                  <th>A</th>
                  <th>P</th>
                  <th>Oleh</th>
                </tr>
              </thead>
              <tbody>
                {list.map((c, i) => (
                  <tr key={`${c.at}-${i}`} style={{ verticalAlign: 'top' }}>
                    <td className="mono">{hm(c.at)}</td>
                    {[c.s, c.o, c.a, c.p].map((t, j) => (
                      <td key={j} style={{ whiteSpace: 'pre-wrap' }}>
                        {t || '-'}
                      </td>
                    ))}
                    <td>{c.by}</td>
                  </tr>
                ))}
                {!list.length && (
                  <tr>
                    <td colSpan={6} className="muted">
                      Tidak ada catatan yang cocok.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}
