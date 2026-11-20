'use client'

import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { BEDS, complaintLabel, MODES, type TabKey } from '@/lib/constants'
import { ageSex, areaOf, displayName, displayRm, freeBeds, hm, toNum } from '@/lib/clinical'
import { deleteRegistration, findOldPatient, markTrauma, mergeIdentity, moveBed } from '@/lib/actions'
import type { Visit } from '@/lib/types'
import { useAuth, useCtx, useData } from '../providers'
import { Chip, ConfirmButton, useRunner } from '../ui'

export function TabRingkasan({ v, goTab }: { v: Visit; goTab: (t: TabKey) => void }) {
  const ctx = useCtx()!
  const { user } = useAuth()
  const data = useData()
  const { busy, run } = useRunner()
  const [bed, setBed] = useState(v.bed ?? '')
  const [nik, setNik] = useState('')
  const free = freeBeds(data.visits)
  const router = useRouter()
  const old = findOldPatient(data.patients, nik)
  const master = v.patientId ? data.patients.find((p) => p.id === v.patientId) : null
  const canDelete = (user?.role === 'kepala' || user?.role === 'pendaftaran') && v.status === 'terdaftar' && !v.triage.length && !v.vitals.length
  const closed = v.status === 'keluar'

  const onMerge = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    void run(() => mergeIdentity(ctx, v, { name: String(f.get('name') ?? ''), nik, age: toNum(f.get('age')) }, data.patients), (nv) => `Identitas digabung ke No. RM ${nv.rm}.`)
  }

  return (
    <div className="grid2">
      <div className="stack">
        <section className="panel">
          <h3>Identitas</h3>
          <dl className="kv">
            <dt>Nama</dt>
            <dd>
              {displayName(v)} {v.anonymous && <Chip kind="warn">sementara</Chip>}
            </dd>
            <dt>No. RM</dt>
            <dd className="mono">{displayRm(v)}</dd>
            <dt>NIK</dt>
            <dd className="mono">{v.patient.nik || '-'}</dd>
            <dt>Jenis kelamin, umur</dt>
            <dd>{ageSex(v)}</dd>
            <dt>Penjamin</dt>
            <dd>{v.insurance}</dd>
            {master && (
              <>
                <dt>Alamat</dt>
                <dd>{master.address || '-'}</dd>
                <dt>Telepon</dt>
                <dd>{master.phone || '-'}</dd>
                <dt>Golongan darah</dt>
                <dd>{master.bloodType || '-'}</dd>
                <dt>Alergi (rekam medis)</dt>
                <dd>{master.allergies ? <Chip kind="crit">{master.allergies}</Chip> : 'Tidak ada'}</dd>
              </>
            )}
          </dl>
          {v.anonymous && !closed && (
            <form onSubmit={onMerge} style={{ marginTop: 14 }}>
              <div className="callout warn" style={{ marginBottom: 10 }}>
                Pasien belum teridentifikasi. Isi identitas begitu diketahui. Semua riwayat IGD dengan nomor sementara akan digabung ke data pasien.
              </div>
              <div className="fields">
                <div className="f">
                  <label htmlFor="mg-name">Nama lengkap</label>
                  <input type="text" id="mg-name" name="name" required={!old} defaultValue="" />
                </div>
                <div className="f">
                  <label htmlFor="mg-nik">NIK</label>
                  <input type="text" id="mg-nik" inputMode="numeric" maxLength={16} value={nik} onChange={(e) => setNik(e.target.value.replace(/\D/g, ''))} />
                </div>
                <div className="f">
                  <label htmlFor="mg-age">Umur (tahun)</label>
                  <input type="number" id="mg-age" name="age" min={0} max={120} />
                </div>
              </div>
              {old && (
                <div className="callout info" style={{ marginTop: 10 }}>
                  NIK cocok dengan pasien lama <b>{old.name}</b> (No. RM <span className="mono">{old.rm}</span>). Data lama akan dipakai.
                </div>
              )}
              <div className="formfoot">
                <button className="btn primary" disabled={busy}>
                  Gabungkan identitas
                </button>
              </div>
            </form>
          )}
        </section>

        <section className="panel">
          <h3>Kunjungan</h3>
          <dl className="kv">
            <dt>No. registrasi</dt>
            <dd className="mono">{v.regNo}</dd>
            <dt>Cara datang</dt>
            <dd>
              {MODES[v.arrivalMode]}
              {v.referral ? ' · dengan rujukan' : ''}
            </dd>
            <dt>Keluhan utama</dt>
            <dd>
              {complaintLabel(v.complaint)}
              {v.complaintNote ? `: ${v.complaintNote}` : ''}
            </dd>
            <dt>Lokasi</dt>
            <dd>{v.bed ? `Bed ${v.bed} (${areaOf(v)})` : areaOf(v)}</dd>
          </dl>
          {!closed && (
            <form
              className="row"
              style={{ marginTop: 12 }}
              onSubmit={(e) => {
                e.preventDefault()
                void run(() => moveBed(ctx, v, bed || null), bed ? `Pasien dipindah ke bed ${bed}.` : 'Pasien dipindah ke ruang tunggu.')
              }}
            >
              <label htmlFor="bed-sel" className="small muted">
                Pindah bed
              </label>
              <select id="bed-sel" style={{ width: 'auto' }} value={bed} onChange={(e) => setBed(e.target.value)}>
                <option value="">Ruang tunggu</option>
                {BEDS.map((b) => {
                  const taken = !free.includes(b) && v.bed !== b.id
                  return (
                    <option key={b.id} value={b.id} disabled={taken}>
                      {b.id} &middot; {b.area}
                      {taken ? ' (terisi)' : ''}
                    </option>
                  )
                })}
              </select>
              <button className="btn sm" disabled={busy || bed === (v.bed ?? '')}>
                Simpan
              </button>
            </form>
          )}
          {!v.isTrauma && !closed && user?.role !== 'pendaftaran' && (
            <div className="formfoot">
              <button
                className="btn sm"
                disabled={busy}
                onClick={async () => {
                  const r = await run(() => markTrauma(ctx, v), 'Pasien ditandai trauma.')
                  if (r) goTab('trauma')
                }}
              >
                Tandai sebagai pasien trauma
              </button>
              <span className="small muted">Membuka tab Trauma</span>
            </div>
          )}
          {canDelete && (
            <div className="formfoot">
              <ConfirmButton
                className="btn sm"
                disabled={busy}
                confirmText="Klik lagi untuk menghapus"
                onConfirm={async () => {
                  const ok = await run(() => deleteRegistration(ctx, v), 'Pendaftaran dihapus.')
                  if (ok !== undefined) router.push('/')
                }}
              >
                Hapus pendaftaran (salah input)
              </ConfirmButton>
              <span className="small muted">Hanya bisa sebelum pasien ditriase.</span>
            </div>
          )}
        </section>
      </div>

      <section className="panel">
        <h3>Linimasa</h3>
        <ol className="timeline">
          {[...v.events].reverse().map((e, i) => (
            <li key={`${e.at}-${i}`}>
              <span className="mono">{hm(e.at)}</span>
              <span>{e.text}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}