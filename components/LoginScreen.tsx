'use client'

import { useState, type FormEvent } from 'react'
import { Plus } from 'lucide-react'
import { DEMO_PEOPLE, ROLE_LABEL } from '@/lib/constants'
import type { Role } from '@/lib/types'
import { useAuth } from './providers'

const ROLE_DESC: Record<Role, string> = {
  pendaftaran: 'Pendaftaran Pasien, papan IGD, pra-kedatangan',
  perawat: 'Triase, observasi tanda vital, primary survey trauma',
  dokter: 'Asesmen, order penunjang, resep, disposisi',
  kepala: 'Semua modul, mode korban massal, dashboard mutu',
}

export function LoginScreen() {
  const auth = useAuth()
  const [tab, setTab] = useState<'masuk' | 'daftar'>('masuk')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (auth.mode === 'local') {
    return (
      <div className="center">
        <div className="login">
          <div>
            <div className="brandbig">
              <span className="logo">
                <Plus size={26} strokeWidth={3} />
              </span>
              <span>
                SIMRS <b>IGD</b>
              </span>
            </div>
            <p className="muted">Mode demo lokal. Pilih peran untuk masuk. Data contoh disimpan di browser ini.</p>
          </div>
          <div className="rolecards">
            {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
              <button key={r} className="rolecard" onClick={() => auth.loginLocal(r)}>
                <b>{ROLE_LABEL[r]}</b>
                <span className="small">{DEMO_PEOPLE[r]}</span>
                <span className="small muted">{ROLE_DESC[r]}</span>
              </button>
            ))}
          </div>
          <p className="note">Untuk memakai login dan database sungguhan, isi konfigurasi Firebase di file .env.local (lihat README).</p>
        </div>
      </div>
    )
  }

  if (auth.pending) return <CompleteProfile />

  const google = async () => {
    setErr(null)
    setBusy(true)
    try {
      await auth.loginGoogle()
    } catch (e2) {
      setErr((e2 as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    setErr(null)
    setBusy(true)
    try {
      if (tab === 'masuk') await auth.login(String(f.get('email')), String(f.get('password')))
      else
        await auth.register({
          email: String(f.get('email')),
          password: String(f.get('password')),
          name: String(f.get('name')),
          role: f.get('role') as Role,
        })
    } catch (e2) {
      setErr((e2 as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="center">
      <div className="login" style={{ maxWidth: 440 }}>
        <div>
          <div className="brandbig">
            <span className="logo">
              <Plus size={26} strokeWidth={3} />
            </span>
            <span>
              SIMRS <b>IGD</b>
            </span>
          </div>
          <p className="muted">Masuk dengan akun petugas.</p>
        </div>
        <div className="seg" role="tablist">
          <button className={tab === 'masuk' ? 'on' : ''} onClick={() => setTab('masuk')} role="tab" aria-selected={tab === 'masuk'}>
            Masuk
          </button>
          <button className={tab === 'daftar' ? 'on' : ''} onClick={() => setTab('daftar')} role="tab" aria-selected={tab === 'daftar'}>
            Daftar akun petugas
          </button>
        </div>
        <form className="panel" onSubmit={submit}>
          <div className="fields" style={{ gridTemplateColumns: '1fr' }}>
            {tab === 'daftar' && (
              <>
                <div className="f">
                  <label htmlFor="lg-name">Nama dan gelar</label>
                  <input type="text" id="lg-name" name="name" required placeholder="Contoh: dr. Arif Setiawan" />
                </div>
                <div className="f">
                  <label htmlFor="lg-role">Peran</label>
                  <select id="lg-role" name="role" defaultValue="perawat">
                    {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABEL[r]}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
            <div className="f">
              <label htmlFor="lg-email">Email</label>
              <input type="text" inputMode="email" id="lg-email" name="email" required autoComplete="email" />
            </div>
            <div className="f">
              <label htmlFor="lg-pass">Kata sandi</label>
              <input type="password" id="lg-pass" name="password" required minLength={6} autoComplete={tab === 'masuk' ? 'current-password' : 'new-password'} />
            </div>
          </div>
          {(err || auth.error) && (
            <div className="callout crit" style={{ marginTop: 12 }}>
              {err || auth.error}
            </div>
          )}
          <div className="formfoot">
            <button className="btn primary" disabled={busy}>
              {busy ? 'Memproses...' : tab === 'masuk' ? 'Masuk' : 'Buat akun'}
            </button>
          </div>
          {tab === 'daftar' && <p className="note">Pemilihan peran saat daftar disediakan untuk keperluan demo. Di rumah sakit sungguhan, peran diberikan oleh admin.</p>}
          <div className="divider">
            <span>atau</span>
          </div>
          <button type="button" className="btn google" disabled={busy} onClick={() => void google()}>
            <GoogleIcon />
            Masuk dengan Google
          </button>
        </form>
      </div>
    </div>
  )
}

function CompleteProfile() {
  const auth = useAuth()
  const p = auth.pending!
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    setErr(null)
    setBusy(true)
    try {
      await auth.completeProfile({ name: String(f.get('name')), role: f.get('role') as Role })
    } catch (e2) {
      setErr((e2 as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="center">
      <div className="login" style={{ maxWidth: 440 }}>
        <div>
          <div className="brandbig">
            <span className="logo">
              <Plus size={26} strokeWidth={3} />
            </span>
            <span>
              SIMRS <b>IGD</b>
            </span>
          </div>
          <p className="muted">Lengkapi profil petugas untuk {p.email ?? 'akun ini'}. Langkah ini hanya sekali.</p>
        </div>
        <form className="panel" onSubmit={submit}>
          <div className="fields" style={{ gridTemplateColumns: '1fr' }}>
            <div className="f">
              <label htmlFor="cp-name">Nama dan gelar</label>
              <input type="text" id="cp-name" name="name" required defaultValue={p.displayName ?? ''} />
            </div>
            <div className="f">
              <label htmlFor="cp-role">Peran</label>
              <select id="cp-role" name="role" defaultValue="perawat">
                {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {err && (
            <div className="callout crit" style={{ marginTop: 12 }}>
              {err}
            </div>
          )}
          <div className="formfoot">
            <button className="btn primary" disabled={busy}>
              {busy ? 'Menyimpan...' : 'Simpan dan masuk'}
            </button>
            <button type="button" className="btn" onClick={() => void auth.logout()}>
              Batal
            </button>
          </div>
          <p className="note">Pemilihan peran sendiri disediakan untuk keperluan demo. Setelah tersimpan, peran hanya bisa diubah oleh Kepala IGD.</p>
        </form>
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.7 6c4.5-4.2 6.9-10.3 6.9-17.7z" />
      <path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.7-6c-2.1 1.4-4.9 2.3-8.2 2.3-6.2 0-11.5-4.1-13.4-9.9l-7.9 6.1C6.6 42.6 14.6 48 24 48z" />
    </svg>
  )
}