'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import ThemeSwitcher from '../../components/ThemeSwitcher'

type Profile={id:string;full_name:string|null;phone:string|null;role:string|null;status:string|null}
type Summary={total_products:number;total_slots:number;used_slots:number;remaining_slots:number;total_members:number}
type Entitlement={entitlement_id:string;product_id:string;product_name:string;slot_limit:number;used_slots:number;remaining_slots:number;status:string;expires_at:string|null}
type AgencyMember={member_user_id:string;full_name:string|null;phone:string|null;status:string;created_at:string;product_count:number}
type Grant={member_user_id:string;member_name:string|null;product_id:string;product_name:string;status:string;created_at:string}
const date=(v:string|null)=>v?new Intl.DateTimeFormat('id-ID',{dateStyle:'medium'}).format(new Date(v)):'Lifetime'

export default function AgencyDashboard(){
 const router=useRouter()
 const [me,setMe]=useState<Profile|null>(null),[email,setEmail]=useState('')
 const [summary,setSummary]=useState<Summary>({total_products:0,total_slots:0,used_slots:0,remaining_slots:0,total_members:0})
 const [products,setProducts]=useState<Entitlement[]>([]),[members,setMembers]=useState<AgencyMember[]>([]),[grants,setGrants]=useState<Grant[]>([])
 const [loading,setLoading]=useState(true),[error,setError]=useState(''),[search,setSearch]=useState('')

 const load=async()=>{
  setLoading(true);setError('')
  const {data:a}=await supabase.auth.getUser();const u=a.user
  if(!u){router.replace('/login');return}
  setEmail(u.email??'')
  const {data:p}=await supabase.from('profiles').select('id,full_name,phone,role,status').eq('id',u.id).maybeSingle()
  if(!p){router.replace('/login');return}
  const profile=p as Profile
  if(profile.status!=='active'){await supabase.auth.signOut();router.replace('/login');return}
  if(profile.role!=='agency'){router.replace(profile.role==='member'?'/member':'/admin');return}
  setMe(profile)
  const [s,e,m,g]=await Promise.all([
   supabase.rpc('agency_dashboard_summary'),
   supabase.rpc('get_my_agency_entitlements'),
   supabase.rpc('agency_list_my_members'),
   supabase.rpc('agency_list_my_grants')
  ])
  const errs:string[]=[]
  if(s.error)errs.push(`Summary: ${s.error.message}`);else if(s.data?.[0])setSummary(s.data[0] as Summary)
  if(e.error)errs.push(`Products: ${e.error.message}`);else setProducts((e.data??[]) as Entitlement[])
  if(m.error)errs.push(`Members: ${m.error.message}`);else setMembers((m.data??[]) as AgencyMember[])
  if(g.error)errs.push(`Grants: ${g.error.message}`);else setGrants((g.data??[]) as Grant[])
  if(errs.length)setError(errs.join(' • '));setLoading(false)
 }
 useEffect(()=>{void load()},[])
 const filtered=useMemo(()=>{const q=search.toLowerCase().trim();return members.filter(m=>!q||(m.full_name??'').toLowerCase().includes(q)||(m.phone??'').toLowerCase().includes(q))},[members,search])
 const initials=(me?.full_name||email||'A').split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase()
 const logout=async()=>{await supabase.auth.signOut();router.replace('/login')}

 return <div className="agency-page">
  <aside>
   <div className="brand"><b>A</b><div><strong>iMersSUPA</strong><small>AGENCY CENTER</small></div></div>
   <div className="role"><span>★</span><div><small>LOGGED IN AS</small><strong>Agency</strong></div></div>
   <nav><p>AGENCY MENU</p><button className="active">⌂ <span>Dashboard</span></button><button onClick={()=>document.getElementById('products')?.scrollIntoView({behavior:'smooth'})}>▣ <span>Produk & Lisensi</span></button><button onClick={()=>document.getElementById('members')?.scrollIntoView({behavior:'smooth'})}>◎ <span>Member Saya</span></button><button onClick={()=>router.push('/agency/members/new')}>＋ <span>Buat Member</span></button><p>ACCOUNT</p><button onClick={()=>router.push('/agency/profile')}>◉ <span>Profile</span></button></nav>
   <div className="bottom"><button onClick={()=>router.push('/agency/profile')}><i>{initials}</i><span><strong>{me?.full_name||'Agency'}</strong><small>{email}</small></span></button><button className="logout" onClick={logout}>↗ Keluar</button></div>
  </aside>
  <main>
   <div className="topbar"><div>⌕ <span>Agency Center</span></div><section><span className="mini">{initials}</span><div><strong>{me?.full_name||'Agency'}</strong><small>Agency</small></div><ThemeSwitcher/></section></div>
   <div className="content">
    <header><div><em>AGENCY CONTROL CENTER</em><h1>Selamat datang, {me?.full_name||'Agency'} 👋</h1><p>Kelola produk Agency, kuota lisensi, dan member Anda dari satu dashboard.</p></div><button onClick={()=>void load()}>↻ Refresh</button></header>
    {error&&<div className="alert">{error}</div>}
    <div className="stats"><article><i>▣</i><span>PRODUK AGENCY</span><b>{summary.total_products}</b><small>Produk aktif</small></article><article><i>▦</i><span>TOTAL SLOT</span><b>{summary.total_slots}</b><small>Kuota seluruh produk</small></article><article><i>◎</i><span>USED SLOT</span><b>{summary.used_slots}</b><small>Akses sedang digunakan</small></article><article><i>✓</i><span>SISA SLOT</span><b>{summary.remaining_slots}</b><small>Slot tersedia</small></article></div>

    <section className="panel" id="products"><div className="panel-head"><div><em>MY LICENSES</em><h2>Produk & Lisensi</h2><p>Agency hanya dapat membagikan produk yang diberikan Super Admin.</p></div><span>{products.length} produk</span></div>
     <div className="cards">{loading?<div className="empty">Loading...</div>:products.length===0?<div className="empty">Belum ada produk Agency yang aktif.</div>:products.map(p=><article className="product" key={p.product_id}><div><strong>{p.product_name}</strong><small>{p.expires_at?`Berlaku s.d. ${date(p.expires_at)}`:'Lifetime'}</small></div><b>{p.used_slots} / {p.slot_limit}</b><div className="bar"><i style={{width:`${Math.min(100,p.slot_limit?p.used_slots/p.slot_limit*100:0)}%`}}/></div><small>{p.remaining_slots} slot tersisa</small></article>)}</div>
    </section>

    <section className="panel" id="members"><div className="panel-head"><div><em>MY MEMBERS</em><h2>Member Saya</h2><p>Hanya member yang berada di bawah Agency Anda.</p></div><button className="primary" onClick={()=>router.push('/agency/members/new')}>＋ Buat Member</button></div>
     <div className="filter">⌕ <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari nama atau WhatsApp..."/></div>
     <div className="table"><div className="tr th"><span>MEMBER</span><span>PHONE</span><span>PRODUCT ACCESS</span><span>STATUS</span></div>{filtered.length===0?<div className="empty">Belum ada member Agency.</div>:filtered.map(m=><div className="tr" key={m.member_user_id}><span><strong>{m.full_name||'Member'}</strong><small>{m.member_user_id.slice(0,10)}...</small></span><span>{m.phone||'—'}</span><span><b>{m.product_count}</b> produk</span><span><i className="badge">{m.status}</i></span></div>)}</div>
    </section>
   </div>
  </main>
  <style jsx>{`
   *{box-sizing:border-box}.agency-page{min-height:100vh;background:linear-gradient(135deg,#eef6ff,#f8f5ff 52%,#fff0fb);color:#14213d;font-family:Arial,sans-serif;font-size:14px}aside{position:fixed;inset:0 auto 0 0;width:232px;background:rgba(255,255,255,.9);border-right:1px solid #dde4ef;padding:18px 12px;display:flex;flex-direction:column;z-index:5}.brand{display:flex;gap:10px;align-items:center;padding:0 5px 18px}.brand>b,.mini{width:40px;height:40px;border-radius:12px;background:linear-gradient(135deg,#5b5cf6,#7547ed);color:white;display:grid;place-items:center;font-size:18px}.brand strong{display:block;font-size:17px}.brand small,.role small,.bottom small{display:block;font-size:10px;letter-spacing:.1em;color:#71809a;font-weight:700}.role{display:flex;gap:10px;align-items:center;padding:13px;border:1px solid #dde3ef;border-radius:15px;background:linear-gradient(110deg,#eaf1ff,#faf5ff);margin-bottom:15px}.role>span{width:32px;height:32px;border-radius:9px;background:#e3e5ff;display:grid;place-items:center;color:#665cf4}nav{flex:1;overflow:auto}nav p{font-size:10px;letter-spacing:.14em;color:#8390a6;font-weight:800;margin:14px 8px 7px}nav button{width:100%;border:0;background:transparent;padding:11px 12px;border-radius:11px;text-align:left;color:#53637d;font-weight:700;font-size:13px;cursor:pointer}nav button.active{background:linear-gradient(100deg,#e8efff,#f6f0ff);border:1px solid #cfd4ff;color:#17213c}.bottom{border-top:1px solid #e5e9f1;padding-top:10px}.bottom button{border:0;background:transparent;width:100%;display:flex;gap:8px;align-items:center;text-align:left;padding:8px;cursor:pointer}.bottom i{width:34px;height:34px;border-radius:10px;background:#6557f4;color:#fff;display:grid;place-items:center;font-style:normal}.bottom .logout{color:#9a5260;font-weight:700}main{margin-left:232px;min-height:100vh}.topbar{height:64px;background:rgba(255,255,255,.68);border-bottom:1px solid #dfe5ef;display:flex;align-items:center;justify-content:space-between;padding:0 28px;color:#7a879d}.topbar section{display:flex;align-items:center;gap:9px}.topbar .mini{width:32px;height:32px;font-size:12px}.topbar strong,.topbar small{display:block;font-size:12px}.content{max-width:1280px;margin:auto;padding:30px}header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px}header em,.panel-head em{font-style:normal;color:#594cf5;font-size:11px;font-weight:900;letter-spacing:.12em}h1{font-size:31px;margin:6px 0 4px}h2{font-size:19px;margin:5px 0}p{color:#71809a;margin:0;line-height:1.55}header button,.primary{border:1px solid #d9deea;background:white;border-radius:11px;padding:10px 14px;font-weight:700;cursor:pointer}.primary{background:#6253ef;color:white;border-color:#6253ef}.alert{padding:12px 14px;border:1px solid #ffc9d0;background:#fff0f2;color:#9b3343;border-radius:12px;margin-bottom:15px}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px}.stats article{min-height:112px;border:1px solid #dce3ef;border-radius:16px;padding:16px;background:linear-gradient(125deg,#edf3ff,#f8f7ff)}.stats article:nth-child(2){background:linear-gradient(125deg,#faf6ff,#f2eaff)}.stats article:nth-child(3){background:linear-gradient(125deg,#effff9,#e7fbf4)}.stats article:nth-child(4){background:linear-gradient(125deg,#fff6fb,#ffeef7)}.stats i{float:left;width:34px;height:34px;background:rgba(255,255,255,.7);border-radius:10px;display:grid;place-items:center;font-style:normal;margin-right:12px}.stats span,.stats small{display:block;font-size:10px;color:#75829a}.stats b{display:block;font-size:25px;margin:5px 0}.panel{background:rgba(255,255,255,.86);border:1px solid #dce3ef;border-radius:17px;margin-top:15px;overflow:hidden}.panel-head{padding:16px 18px;border-bottom:1px solid #e1e6ef;display:flex;align-items:center;justify-content:space-between}.panel-head>span{font-size:11px;background:#f4f6fb;border:1px solid #e1e5ee;padding:7px 10px;border-radius:99px;color:#68758c}.cards{padding:14px;display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.product{border:1px solid #dfe4ee;border-radius:14px;padding:14px;background:linear-gradient(135deg,#f3f7ff,#fbf8ff)}.product strong,.product small{display:block}.product small{color:#7c899e;font-size:11px;margin-top:4px}.product>b{font-size:18px;display:block;margin:14px 0 7px}.bar{height:6px;background:#e5e8f1;border-radius:99px;overflow:hidden}.bar i{display:block;height:100%;background:linear-gradient(90deg,#6254ef,#805cf4);border-radius:99px}.filter{margin:12px 14px;border:1px solid #dfe4ee;border-radius:11px;padding:10px 12px;color:#8793a6}.filter input{border:0;outline:0;background:transparent;width:90%;font-size:13px}.table{border-top:1px solid #edf0f5}.tr{display:grid;grid-template-columns:2fr 1.2fr 1fr .8fr;gap:10px;padding:13px 16px;border-bottom:1px solid #edf0f5;align-items:center}.tr.th{font-size:10px;font-weight:800;letter-spacing:.07em;color:#78859b;background:#fafbfe}.tr strong,.tr small{display:block}.tr small{font-size:10px;color:#8995a7;margin-top:3px}.badge{font-style:normal;font-size:10px;font-weight:800;background:#e4f8eb;color:#138542;padding:5px 8px;border-radius:99px}.empty{padding:35px;text-align:center;color:#8b96a8;grid-column:1/-1}@media(max-width:900px){aside{width:76px}.brand div,.role div,nav span,.bottom span{display:none}.brand>b{width:42px}.role{padding:10px}.role>span{margin:auto}main{margin-left:76px}.stats{grid-template-columns:1fr 1fr}.cards{grid-template-columns:1fr}.content{padding:20px}.tr{grid-template-columns:1.5fr 1fr 1fr}.tr>:nth-child(2){display:none}}@media(max-width:560px){.stats{grid-template-columns:1fr}.content{padding:14px}header{gap:10px}h1{font-size:25px}.tr{grid-template-columns:1.5fr 1fr}.tr>:nth-child(2),.tr>:nth-child(4){display:none}}
  `}</style>
 </div>
}
