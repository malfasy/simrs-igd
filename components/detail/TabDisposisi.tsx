'use client'

import { useState } from 'react'
import { BOARDING_LIMIT, DISPO, WARDS } from '@/lib/constants'
import { dur, hm } from '@/lib/clinical'
import { decideDisposition, dischargeVisit } from '@/lib/actions'
import type { DispositionDetail, DispositionType, Visit } from '@/lib/types'
import { useCtx } from '../providers'
import { ConfirmButton, Timer, useRunner } from '../ui'

export function TabDisposisi({ v }: { v: Visit }) {
  const ctx = useCtx()!
  const { busy, run } = useRunner()
  const d = v.disposition
  const [type, setType] = useState<DispositionType>(d?.type ?? 'pulang')
  const [detail, setDetail] = useState<DispositionDetail>(
    d?.detail ?? { room: WARDS[0], timeOfDeath: hm(Date.now()) },
  )
  const [note, setNote] = useState('')
  const set = (patch: Partial<DispositionDetail>) => setDetail({ ...detail, ...patch })

  if (v.leftAt && d)
    return (
      <section className="panel">
        <h3>Pasien sudah keluar IGD</h3>
        <dl className="kv" style={{ marginTop: 8 }}>
          <dt>Disposisi</dt>
          <dd>{DISPO[d.type]}</dd>
          <dt>Catatan</dt>
          <dd>{d.note || '-'}</dd>
          <dt>Diputuskan</dt>
          <dd className="mono">
            {hm(d.decidedAt)} oleh {d.decidedBy}
          </dd>
          <dt>Keluar IGD</dt>
          <dd className="mono">{hm(v.leftAt)}</dd>
          <dt>Lama di IGD</dt>
          <dd className="mono">{dur(v.leftAt - v.arrivalTime)}</dd>
        </dl>
      </section>
    )

  return (
    <div className="grid2">
      <form
        className="panel"
        onSubmit={(e) => {
          e.preventDefault()
          void run(() => decideDisposition(ctx, v, { type, note, detail }), 'Keputusan disimpan. Klik "Pasien keluar IGD" saat pasien benar-benar meninggalkan IGD.')
        }}
      >
        <h3>{d ? 'Ubah keputusan disposisi' : 'Keputusan disposisi'}</h3>
        <div className="checks" style={{ gridTemplateColumns: '1fr 1fr', margin: '10px 0' }}>
          {(Object.keys(DISPO) as DispositionType[]).map((k) => (
            <label key={k}>
              <input type="radio" name="dispo" checked={type === k} onChange={() => setType(k)} />
              <span>{DISPO[k]}</span>
            </label>
          ))}
        </div>
        <div className="fields" style={{ gridTemplateColumns: '1fr' }}>
          {type === 'pulang' && (
            <div className="f">
              <label htmlFor="d-edu">Edukasi dan rencana kontrol</label>
              <input type="text" id="d-edu" value={detail.education ?? ''} onChange={(e) => set({ education: e.target.value })} placeholder="Contoh: kontrol poli bedah 5 hari" />
            </div>
          )}
          {type === 'rawat_inap' && (
            <div className="f">
              <label htmlFor="d-room">Ruang tujuan</label>
              <select id="d-room" value={detail.room ?? WARDS[0]} onChange={(e) => set({ room: e.target.value })}>
                {WARDS.map((w) => (
                  <option key={w}>{w}</option>
                ))}
              </select>
            </div>
          )}
          {type === 'rujuk' && (
            <div className="f">
              <label htmlFor="d-rs">RS tujuan dan alasan rujukan</label>
              <input type="text" id="d-rs" value={detail.referralTarget ?? ''} onChange={(e) => set({ referralTarget: e.target.value })} placeholder="Contoh: RS rujukan, butuh bedah saraf" />
            </div>
          )}
          {type === 'aps' && (
            <label className="row">
              <input type="checkbox" checked={!!detail.refusalSigned} onChange={(e) => set({ refusalSigned: e.target.checked })} /> Formulir penolakan tindakan sudah ditandatangani
            </label>
          )}
          {type === 'meninggal' && (
            <>
              <div className="f">
                <label htmlFor="d-tod">Jam meninggal</label>
                <input type="text" id="d-tod" value={detail.timeOfDeath ?? ''} onChange={(e) => set({ timeOfDeath: e.target.value })} />
              </div>
              <div className="f">
                <label htmlFor="d-cod">Sebab kematian</label>
                <input type="text" id="d-cod" value={detail.causeOfDeath ?? ''} onChange={(e) => set({ causeOfDeath: e.target.value })} />
              </div>
            </>
          )}
          <div className="f">
            <label htmlFor="d-note">Catatan serah terima</label>
            <textarea id="d-note" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <div className="formfoot">
          <button className="btn primary" disabled={busy}>
            Simpan keputusan
          </button>
        </div>
      </form>

      <section className="panel">
        <h3>Status keluar</h3>
        {d ? (
          <>
            <dl className="kv" style={{ marginTop: 8 }}>
              <dt>Keputusan</dt>
              <dd>{DISPO[d.type]}</dd>
              <dt>Catatan</dt>
              <dd>{d.note || '-'}</dd>
              <dt>Diputuskan</dt>
              <dd className="mono">
                {hm(d.decidedAt)} oleh {d.decidedBy}
              </dd>
              <dt>Menunggu sejak keputusan</dt>
              <dd>
                <Timer since={d.decidedAt} target={BOARDING_LIMIT} />
              </dd>
            </dl>
            <p className="note">
              Jam keputusan dan jam keluar dicatat terpisah karena pasien yang tertahan di IGD (misalnya menunggu bed rawat inap) jadi salah satu penyebab IGD penuh.
            </p>
            <div className="formfoot">
              <ConfirmButton
                className="btn primary"
                disabled={busy}
                confirmText="Klik lagi untuk konfirmasi"
                onConfirm={() => void run(() => dischargeVisit(ctx, v), (bed) => `Pasien keluar IGD.${bed ? ` Bed ${bed} kosong.` : ''}`)}
              >
                Pasien keluar IGD
              </ConfirmButton>
              <span className="small muted">Encounter ditutup dan dikirim ke Satu Sehat.</span>
            </div>
          </>
        ) : (
          <p className="muted" style={{ marginTop: 8 }}>
            Belum ada keputusan. Simpan keputusan di kiri dulu.
          </p>
        )}
      </section>
    </div>
  )
}
