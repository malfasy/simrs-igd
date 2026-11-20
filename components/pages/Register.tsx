'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { COMPLAINTS, INSURANCES, MODES, TAB_ACCESS } from '@/lib/constants'
import { ageOf, displayName, displayRm, freeBeds, toNum } from '@/lib/clinical'
import { findOldPatient, registerPatient, type RegisterInput } from '@/lib/actions'
import type { ArrivalMode, ComplaintKey, InsuranceType, Patient, Sex } from '@/lib/types'
import { useAuth, useCtx, useData } from '../providers'
import { useRunner } from '../ui'

const EMPTY = {
  anonymous: false,
  name: '',
  nik: '',
  sex: 'L' as Sex,
  age: '',
  ageEstimated: false,
  arrivalMode: 'sendiri' as ArrivalMode,
  referral: false,
  insurance: 'Umum' as InsuranceType,
  complaint: 'ringan' as ComplaintKey,
  complaintNote: '',
  bed: '',
}

export function Register() {
  const data = useData()
  const ctx = useCtx()!
  const { user } = useAuth()
  const router = useRouter()
  const { busy, run } = useRunner()
  const [f, setF] = useState(EMPTY)
  const set = (patch: Partial<typeof EMPTY>) => setF({ ...f, ...patch })
  const free = freeBeds(data.visits)
  const [picked, setPicked] = useState<Patient | null>(null)
  const [q, setQ] = useState('')
  const old = f.anonymous ? null : picked ?? findOldPatient(data.patients, f.nik)
  const inc = data.meta.activeIncident
  const matches = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (t.length < 2) return []
    return data.patients.filter((p) => p.name.toLowerCase().includes(t) || p.rm.includes(t) || p.nik.includes(t)).slice(0, 6)
  }, [q, data.patients])

  // Datang dari profil pasien: /pendaftaran?pasien=<id>
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('pasien')
    if (!id) return
    const p = data.patients.find((x) => x.id === id)
    if (p) {
      setPicked(p)
      setF((cur) => ({ ...cur, insurance: p.insurance }))
    }
  }, [data.patients])

  const submit = () =>
    run(async () => {
      const age = toNum(f.age)
      if (age === null && !old) throw new Error('Umur wajib diisi (boleh perkiraan).')
      const input: RegisterInput = {
        anonymous: f.anonymous,
        name: f.name,
        nik: f.anonymous ? '' : f.nik,
        sex: old ? old.sex : f.sex,
        age: old ? ageOf(old) : age,
        ageEstimated: f.anonymous || f.ageEstimated,
        arrivalMode: f.arrivalMode,
        referral: f.referral,
        insurance: f.insurance,
        complaint: f.complaint,
        complaintNote: f.complaintNote,
        bed: f.bed || null,
      }
      return registerPatient(ctx, input, data.patients, old?.id ?? null)
    }, (v) => `${displayName(v)} terdaftar dengan No. RM ${displayRm(v)}.`).then((v) => {
      if (!v) return
      setF(EMPTY)
      setPicked(null)
      if (user && TAB_ACCESS[user.role].includes('triase')) router.push(`/pasien/${v.id}?tab=triase`)
      else router.push('/')
    })

  return (
    <>
      <div className="vh">
        <div>
          <h1>Pendaftaran Cepat</h1>
          <p className="sub">Isi yang wajib saja. Data lengkap bisa dilengkapi setelah pasien ditangani.</p>
        </div>
      </div>
      {inc && (
        <div className="callout crit" style={{ marginBottom: 14 }}>
          Mode korban massal aktif. Untuk korban kejadian {inc.name}, gunakan registrasi massal di{' '}
          {user?.role === 'kepala' ? <Link href="/korban-massal">panel Korban Massal</Link> : 'panel Korban Massal (Kepala IGD)'}.
        </div>
      )}
      <form
        className="panel"
        style={{ maxWidth: 880 }}
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        {!f.anonymous && (
          <div style={{ marginBottom: 14, position: 'relative' }}>
            {picked ? (
              <div className="callout info row">
                <span>
                  Pasien lama dipilih: <b>{picked.name}</b> &middot; No. RM <span className="mono">{picked.rm}</span> &middot; {picked.sex} &middot; {ageOf(picked) ?? '-'} th
                </span>
                <span style={{ flex: 1 }} />
                <button type="button" className="btn sm" onClick={() => setPicked(null)}>
                  Ganti
                </button>
              </div>
            ) : (
              <div className="f">
                <label htmlFor="rg-q">Cari pasien lama (nama, No. RM, atau NIK)</label>
                <input type="text" id="rg-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ketik minimal 2 huruf. Kosongkan jika pasien baru." autoComplete="off" />
                {matches.length > 0 && (
                  <div className="suggest">
                    {matches.map((p) => (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => {
                          setPicked(p)
                          setQ('')
                          setF({ ...f, insurance: p.insurance })
                        }}
                      >
                        <b>{p.name}</b>
                        <span className="mono small">{p.rm}</span>
                        <span className="small muted">
                          {p.sex} &middot; {ageOf(p) ?? '-'} th &middot; {p.address || 'alamat belum diisi'}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        <label className="row" style={{ marginBottom: 12 }}>
          <input type="checkbox" checked={f.anonymous} onChange={(e) => set({ anonymous: e.target.checked, ageEstimated: e.target.checked || f.ageEstimated })} />
          <b>Pasien tanpa identitas</b> <span className="small muted">(tidak sadar, tanpa keluarga, tanpa KTP)</span>
        </label>
        <div className="fields">
          <div className="f" style={{ gridColumn: 'span 2' }}>
            <label htmlFor="rg-name">Nama</label>
            <input type="text" id="rg-name" disabled={f.anonymous || !!old} required={!f.anonymous && !old} value={old ? old.name : f.name} onChange={(e) => set({ name: e.target.value })} />
          </div>
          <div className="f" style={{ gridColumn: 'span 2' }}>
            <label htmlFor="rg-nik">NIK</label>
            <input
              type="text"
              id="rg-nik"
              inputMode="numeric"
              maxLength={16}
              disabled={f.anonymous || !!picked}
              placeholder="16 digit, untuk cek pasien lama"
              value={picked ? picked.nik : f.nik}
              onChange={(e) => set({ nik: e.target.value.replace(/\D/g, '') })}
            />
          </div>
          <div className="f">
            <label htmlFor="rg-sex">Jenis kelamin</label>
            <select id="rg-sex" value={old ? old.sex : f.sex} disabled={!!old} onChange={(e) => set({ sex: e.target.value as Sex })}>
              <option value="L">Laki-laki</option>
              <option value="P">Perempuan</option>
            </select>
          </div>
          <div className="f">
            <label htmlFor="rg-age">Umur (tahun)</label>
            <input type="number" id="rg-age" min={0} max={120} disabled={!!old} value={old ? ageOf(old) ?? '' : f.age} onChange={(e) => set({ age: e.target.value })} />
          </div>
          <div className="f">
            <label htmlFor="rg-est">Umur</label>
            <select id="rg-est" value={f.ageEstimated ? '1' : '0'} disabled={f.anonymous || !!old} onChange={(e) => set({ ageEstimated: e.target.value === '1' })}>
              <option value="0">Pasti</option>
              <option value="1">Perkiraan</option>
            </select>
          </div>
          <div className="f">
            <label htmlFor="rg-mode">Cara datang</label>
            <select id="rg-mode" value={f.arrivalMode} onChange={(e) => set({ arrivalMode: e.target.value as ArrivalMode })}>
              {(Object.keys(MODES) as ArrivalMode[]).map((k) => (
                <option key={k} value={k}>
                  {MODES[k]}
                </option>
              ))}
            </select>
          </div>
          <div className="f">
            <label htmlFor="rg-ref">Rujukan</label>
            <select id="rg-ref" value={f.referral ? '1' : '0'} onChange={(e) => set({ referral: e.target.value === '1' })}>
              <option value="0">Tidak ada</option>
              <option value="1">Ada surat rujukan</option>
            </select>
          </div>
          <div className="f">
            <label htmlFor="rg-ins">Penjamin</label>
            <select id="rg-ins" value={f.insurance} onChange={(e) => set({ insurance: e.target.value as InsuranceType })}>
              {INSURANCES.map((i) => (
                <option key={i}>{i}</option>
              ))}
            </select>
          </div>
          <div className="f" style={{ gridColumn: 'span 2' }}>
            <label htmlFor="rg-cc">Keluhan utama</label>
            <select id="rg-cc" value={f.complaint} onChange={(e) => set({ complaint: e.target.value as ComplaintKey })}>
              {COMPLAINTS.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="f" style={{ gridColumn: 'span 2' }}>
            <label htmlFor="rg-note">Catatan keluhan</label>
            <input type="text" id="rg-note" value={f.complaintNote} onChange={(e) => set({ complaintNote: e.target.value })} />
          </div>
          <div className="f" style={{ gridColumn: 'span 2' }}>
            <label htmlFor="rg-bed">Tempatkan di</label>
            <select id="rg-bed" value={f.bed} onChange={(e) => set({ bed: e.target.value })}>
              <option value="">Ruang tunggu (belum ada bed)</option>
              {free.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.id} &middot; {b.area}
                </option>
              ))}
            </select>
          </div>
        </div>
        {old && !picked && (
          <div className="callout info" style={{ marginTop: 12 }}>
            NIK cocok dengan pasien lama: <b>{old.name}</b>, No. RM <span className="mono">{old.rm}</span>, {old.sex} &middot; {ageOf(old) ?? '-'} th. Data lama dipakai, tidak dibuat No. RM baru.
          </div>
        )}
        <div className="formfoot">
          <button className="btn primary" disabled={busy}>
            Daftarkan pasien
          </button>
          <span className="small muted">Jam datang dicatat otomatis. Encounter class EMER dikirim ke Satu Sehat.</span>
        </div>
      </form>
      <p className="note">
        Pasien baru otomatis masuk ke Data Pasien dengan No. RM baru. Coba NIK pasien lama <span className="mono">3578014405660002</span> untuk melihat pencegahan data ganda.
      </p>
    </>
  )
}
