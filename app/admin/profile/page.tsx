'use client'

import { ChangeEvent, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'

type Profile = {
  id: string
  full_name: string | null
  avatar_url: string | null
  role: string | null
  status: string | null
}

export default function AdminProfilePage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => { void load() }, [])

  async function load() {
    setError('')
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) { router.replace('/login'); return }

    const { data, error: profileError } = await supabase
      .from('profiles')
      .select('id,full_name,avatar_url,role,status')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError || !data) { setError(profileError?.message || 'Profile tidak ditemukan.'); return }
    if (!['admin','super_admin'].includes(String(data.role))) { router.replace('/member'); return }

    setProfile(data as Profile)
    setEmail(user.email || '')
    setName(data.full_name || '')
  }

  async function saveName() {
    if (!name.trim()) { setError('Nama tidak boleh kosong.'); return }
    setBusy(true); setError(''); setMessage('')
    const { data, error: rpcError } = await supabase.rpc('update_my_profile', { p_full_name: name.trim() })
    if (rpcError) setError(rpcError.message)
    else {
      setProfile(p => p ? { ...p, full_name: data?.full_name ?? name.trim() } : p)
      setMessage('Profile berhasil diperbarui.')
    }
    setBusy(false)
  }

  async function uploadAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file || !profile) return
    if (!['image/jpeg','image/png','image/webp'].includes(file.type)) {
      setError('Foto harus JPG, PNG, atau WEBP.'); return
    }
    if (file.size > 2 * 1024 * 1024) { setError('Ukuran foto maksimal 2 MB.'); return }

    setUploading(true); setError(''); setMessage('')
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const path = `${profile.id}/avatar.${ext}`
      const { error: uploadError } = await supabase.storage.from('profile-avatars').upload(path, file, {
        upsert: true, contentType: file.type, cacheControl: '3600'
      })
      if (uploadError) throw uploadError

      const { data: publicData } = supabase.storage.from('profile-avatars').getPublicUrl(path)
      const url = `${publicData.publicUrl}?v=${Date.now()}`
      const { data, error: rpcError } = await supabase.rpc('update_my_profile', {
        p_full_name: name.trim() || profile.full_name || '',
        p_avatar_url: url
      })
      if (rpcError) throw rpcError
      setProfile(p => p ? { ...p, avatar_url: data?.avatar_url ?? url } : p)
      setMessage('Foto profile berhasil diperbarui.')
    } catch (e: any) {
      setError(e?.message || 'Upload foto gagal.')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function removeAvatar() {
    if (!profile) return
    setUploading(true); setError(''); setMessage('')
    try {
      const { data: files } = await supabase.storage.from('profile-avatars').list(profile.id)
      const paths = (files || []).map(f => `${profile.id}/${f.name}`)
      if (paths.length) await supabase.storage.from('profile-avatars').remove(paths)
      const { error: rpcError } = await supabase.rpc('update_my_profile', {
        p_full_name: name.trim() || profile.full_name || '',
        p_avatar_url: ''
      })
      if (rpcError) throw rpcError
      setProfile(p => p ? { ...p, avatar_url: null } : p)
      setMessage('Foto profile dihapus.')
    } catch (e: any) {
      setError(e?.message || 'Gagal menghapus foto.')
    } finally { setUploading(false) }
  }

  const initials=(profile?.full_name || email.split('@')[0] || 'A').split(' ').filter(Boolean).slice(0,2).map(x=>x[0]?.toUpperCase()).join('')

  return <main className="page">
    <div className="top">
      <button className="back" onClick={()=>router.back()}>← Kembali</button>
      <div><span>ACCOUNT</span><h1>Profile & Account</h1><p>Kelola identitas akun dan keamanan administrator.</p></div>
    </div>

    {error && <div className="alert error">{error}</div>}
    {message && <div className="alert success">{message}</div>}

    <section className="grid">
      <article className="card hero">
        <div className="avatar">
          {profile?.avatar_url ? <img src={profile.avatar_url} alt="Profile" /> : <b>{initials}</b>}
        </div>
        <h2>{profile?.full_name || 'Administrator'}</h2>
        <p>{email}</p>
        <span className="role">{profile?.role === 'super_admin' ? 'SUPER ADMIN' : 'ADMIN'}</span>
        <input ref={fileRef} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadAvatar}/>
        <div className="actions">
          <button className="primary" onClick={()=>fileRef.current?.click()} disabled={uploading}>{uploading?'Memproses...':'Upload / Ganti Foto'}</button>
          {profile?.avatar_url && <button className="danger" onClick={removeAvatar} disabled={uploading}>Hapus Foto</button>}
        </div>
        <small>JPG, PNG atau WEBP • Maksimal 2 MB</small>
      </article>

      <article className="card form">
        <div className="eyebrow">PROFILE INFORMATION</div>
        <h2>Informasi Profile</h2>
        <label>Nama Lengkap<input value={name} onChange={e=>setName(e.target.value)} placeholder="Nama lengkap"/></label>
        <label>Email<input value={email} disabled /></label>
        <div className="two">
          <label>Role<input value={profile?.role === 'super_admin' ? 'Super Admin' : 'Admin'} disabled /></label>
          <label>Status<input value={profile?.status || 'active'} disabled /></label>
        </div>
        <button className="save" onClick={saveName} disabled={busy}>{busy?'Menyimpan...':'Simpan Perubahan'}</button>
      </article>

      <article className="card security">
        <div><div className="eyebrow">SECURITY</div><h2>Account Security</h2><p>Perbarui password akun secara aman melalui Supabase Auth.</p></div>
        <button onClick={()=>router.push('/admin/change-password')}>Ganti Password →</button>
      </article>
    </section>

    <style jsx>{`
      *{box-sizing:border-box}.page{min-height:100vh;padding:38px;background:linear-gradient(135deg,#eef6ff,#f7f4ff 55%,#fff3fb);font-family:Arial,sans-serif;color:#17213b}.top{max-width:1040px;margin:auto;display:flex;gap:24px;align-items:flex-start}.top span,.eyebrow{font-size:11px;font-weight:900;letter-spacing:.12em;color:#6557f5}.top h1{font-size:32px;margin:6px 0}.top p{margin:0;color:#71809d}.back{border:1px solid #dce2ee;background:#fff;border-radius:12px;padding:11px 15px;font-weight:800;cursor:pointer}.grid{max-width:1040px;margin:26px auto;display:grid;grid-template-columns:330px 1fr;gap:18px}.card{background:rgba(255,255,255,.88);border:1px solid #e2e6ef;border-radius:22px;padding:24px;box-shadow:0 18px 45px rgba(49,56,90,.08)}.hero{text-align:center}.avatar{width:112px;height:112px;border-radius:50%;margin:0 auto 15px;background:linear-gradient(135deg,#5868ff,#8d4de8);display:grid;place-items:center;color:#fff;font-size:34px;overflow:hidden;border:5px solid #fff;box-shadow:0 10px 30px rgba(90,83,235,.22)}.avatar img{width:100%;height:100%;object-fit:cover}.hero h2{margin:8px 0 4px}.hero p{color:#73809a;font-size:13px;word-break:break-all}.role{display:inline-block;padding:7px 11px;border-radius:999px;background:#eeebff;color:#6557f5;font-size:10px;font-weight:900}.actions{display:flex;gap:8px;justify-content:center;margin:18px 0 10px;flex-wrap:wrap}button{cursor:pointer}.primary,.danger,.save,.security button{border:0;border-radius:11px;padding:11px 14px;font-weight:900}.primary,.save,.security button{background:linear-gradient(135deg,#5268ff,#7548ec);color:#fff}.danger{background:#fff0f0;color:#d73c3c}.hero small{color:#8a95a9}.form h2,.security h2{margin:7px 0 18px}.form label{display:block;font-size:12px;font-weight:800;color:#56647e;margin:14px 0}.form input{width:100%;margin-top:7px;padding:13px;border:1px solid #dce2ed;border-radius:11px;background:#fff;font-size:14px}.form input:disabled{background:#f4f6fa;color:#7b8698}.two{display:grid;grid-template-columns:1fr 1fr;gap:12px}.save{margin-top:8px}.security{grid-column:1/-1;display:flex;align-items:center;justify-content:space-between;gap:20px}.security p{margin:0;color:#73809a}.alert{max-width:1040px;margin:18px auto -8px;padding:12px 15px;border-radius:12px;font-size:13px}.error{background:#fff0f0;color:#c93737;border:1px solid #ffcaca}.success{background:#ecfbf3;color:#168654;border:1px solid #bdebd2}@media(max-width:760px){.page{padding:20px}.top{display:block}.back{margin-bottom:18px}.grid{grid-template-columns:1fr}.security{grid-column:auto;display:block}.security button{margin-top:16px;width:100%}.two{grid-template-columns:1fr}}
    `}</style>
  </main>
}
