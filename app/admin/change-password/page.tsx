'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'

export default function AdminChangePasswordPage() {
  const router=useRouter()
  const [password,setPassword]=useState('')
  const [confirm,setConfirm]=useState('')
  const [show,setShow]=useState(false)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [message,setMessage]=useState('')

  useEffect(()=>{ void guard() },[])
  async function guard(){
    const {data:{user}}=await supabase.auth.getUser()
    if(!user){router.replace('/login');return}
    const {data}=await supabase.from('profiles').select('role,status').eq('id',user.id).maybeSingle()
    if(!data || !['admin','super_admin'].includes(String(data.role))){router.replace('/login')}
  }

  async function submit(e:React.FormEvent){
    e.preventDefault();setError('');setMessage('')
    if(password.length<8){setError('Password baru minimal 8 karakter.');return}
    if(password!==confirm){setError('Konfirmasi password tidak sama.');return}
    setBusy(true)
    const {error:updateError}=await supabase.auth.updateUser({password})
    if(updateError)setError(updateError.message)
    else{setPassword('');setConfirm('');setMessage('Password berhasil diganti.')}
    setBusy(false)
  }

  return <main className="page">
    <section className="card">
      <button className="back" onClick={()=>router.back()}>← Kembali</button>
      <div className="icon">◇</div>
      <div className="eyebrow">ACCOUNT SECURITY</div>
      <h1>Ganti Password</h1>
      <p>Gunakan password baru yang kuat untuk akun administrator.</p>
      {error&&<div className="alert error">{error}</div>}
      {message&&<div className="alert success">{message}</div>}
      <form onSubmit={submit}>
        <label>Password Baru<input type={show?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} autoComplete="new-password" placeholder="Minimal 8 karakter"/></label>
        <label>Konfirmasi Password<input type={show?'text':'password'} value={confirm} onChange={e=>setConfirm(e.target.value)} autoComplete="new-password" placeholder="Ulangi password baru"/></label>
        <label className="check"><input type="checkbox" checked={show} onChange={e=>setShow(e.target.checked)}/> Tampilkan password</label>
        <button className="save" disabled={busy}>{busy?'Menyimpan...':'Simpan Password Baru'}</button>
      </form>
    </section>
    <style jsx>{`
      *{box-sizing:border-box}.page{min-height:100vh;display:grid;place-items:center;padding:24px;background:linear-gradient(135deg,#edf6ff,#f7f2ff 55%,#fff1f8);font-family:Arial,sans-serif;color:#17213b}.card{width:min(100%,500px);background:rgba(255,255,255,.92);border:1px solid #e1e5ef;border-radius:24px;padding:30px;box-shadow:0 24px 60px rgba(52,57,90,.12)}.back{border:1px solid #dce2ed;background:#fff;border-radius:10px;padding:9px 12px;font-weight:800}.icon{width:54px;height:54px;border-radius:16px;background:linear-gradient(135deg,#5868ff,#854be9);color:#fff;display:grid;place-items:center;font-size:25px;margin:25px 0 15px}.eyebrow{font-size:10px;font-weight:900;letter-spacing:.13em;color:#6557f5}.card h1{font-size:30px;margin:6px 0}.card>p{color:#75829b;margin:0 0 22px}label{display:block;font-size:12px;font-weight:800;color:#56647e;margin:15px 0}label input:not([type=checkbox]){width:100%;margin-top:7px;padding:14px;border:1px solid #dce2ed;border-radius:11px;font-size:14px}.check{display:flex;align-items:center;gap:8px}.check input{width:16px;height:16px}.save{width:100%;border:0;border-radius:12px;padding:14px;background:linear-gradient(135deg,#5268ff,#7548ec);color:#fff;font-weight:900}.alert{padding:11px 13px;border-radius:10px;font-size:13px;margin:14px 0}.error{background:#fff0f0;color:#c93737}.success{background:#ecfbf3;color:#168654}
    `}</style>
  </main>
}
