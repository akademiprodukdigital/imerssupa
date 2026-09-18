'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import ThemeSwitcher from '../../../components/ThemeSwitcher'

type Profile = { id:string; full_name:string|null; avatar_url:string|null; role:string|null; status:string|null }
type AuditCheck = { check_key:string; status:string; detail:string }
type AuditEvent = {
  id:string; actor_user_id:string|null; event_key:string; target_type:string|null;
  target_id:string|null; severity:string; metadata:Record<string,unknown>|null; created_at:string
}
const PAGE_SIZES=[25,50,100]
const date=(v:string|null)=>v?new Intl.DateTimeFormat('id-ID',{dateStyle:'medium',timeStyle:'short'}).format(new Date(v)):'—'
const pretty=(v:string)=>v.replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase())

export default function AdminSecurityPage() {
  const router=useRouter()
  const [me,setMe]=useState<Profile|null>(null)
  const [email,setEmail]=useState('')
  const [checks,setChecks]=useState<AuditCheck[]>([])
  const [events,setEvents]=useState<AuditEvent[]>([])
  const [search,setSearch]=useState('')
  const [severity,setSeverity]=useState('all')
  const [pageSize,setPageSize]=useState(25)
  const [page,setPage]=useState(1)
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')

  const load=async()=>{
    setLoading(true);setError('')
    const {data:auth}=await supabase.auth.getUser()
    const user=auth.user
    if(!user){router.replace('/login');return}
    setEmail(user.email??'')
    const {data:p}=await supabase.from('profiles').select('id,full_name,avatar_url,role,status').eq('id',user.id).maybeSingle()
    if(!p){router.replace('/login');return}
    const profile=p as Profile
    if(profile.status!=='active'){await supabase.auth.signOut();router.replace('/login');return}
    if(profile.role!=='super_admin'){router.replace('/admin');return}
    setMe(profile)
    const [auditResult,eventResult]=await Promise.all([
      supabase.rpc('admin_backend_security_audit'),
      supabase.from('security_audit_log').select('id,actor_user_id,event_key,target_type,target_id,severity,metadata,created_at').order('created_at',{ascending:false}).limit(500)
    ])
    const errors:string[]=[]
    if(auditResult.error)errors.push(`Security checks: ${auditResult.error.message}`);else setChecks((auditResult.data??[]) as AuditCheck[])
    if(eventResult.error)errors.push(`Audit log: ${eventResult.error.message}`);else setEvents((eventResult.data??[]) as AuditEvent[])
    if(errors.length)setError(errors.join(' • '))
    setLoading(false)
  }
  useEffect(()=>{void load()},[])
  useEffect(()=>setPage(1),[search,severity,pageSize])

  const filtered=useMemo(()=>{
    const q=search.trim().toLowerCase()
    return events.filter(e=>(severity==='all'||e.severity===severity)&&(!q||e.event_key.toLowerCase().includes(q)||(e.target_type??'').toLowerCase().includes(q)||(e.target_id??'').toLowerCase().includes(q)))
  },[events,search,severity])
  const pages=Math.max(1,Math.ceil(filtered.length/pageSize)),safePage=Math.min(page,pages)
  const visible=filtered.slice((safePage-1)*pageSize,safePage*pageSize)
  const pass=checks.filter(c=>c.status==='PASS').length, warn=checks.filter(c=>c.status==='WARN').length, fail=checks.filter(c=>c.status==='FAIL').length
  const initials=(me?.full_name||email||'S').split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase()
  const logout=async()=>{await supabase.auth.signOut();router.replace('/login')}

  return <div className="admin-page">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">S</div><div><strong>iMersSUPA</strong><small>ADMIN CONTROL</small></div></div>
      <div className="role-card"><div className="role-icon">★</div><div><small>LOGGED IN AS</small><strong>Super Admin</strong></div></div>
      <nav>
        <p>MAIN MENU</p><button onClick={()=>router.push('/admin')}>⌂ <span>Dashboard</span></button><button onClick={()=>router.push('/admin/members')}>◎ <span>Members</span></button><button onClick={()=>router.push('/admin/products')}>▣ <span>Products</span></button><button onClick={()=>router.push('/admin/content')}>▶ <span>Content</span></button><button onClick={()=>router.push('/admin/access')}>◇ <span>Member Access</span></button><button onClick={()=>router.push('/admin/progress')}>↗ <span>Progress</span></button><button onClick={()=>router.push('/admin/resources')}>◆ <span>Resources</span></button>
        <p>COMMERCE</p><button onClick={()=>router.push('/admin/orders')}>▤ <span>Orders & Transactions</span></button><button onClick={()=>router.push('/admin/payments')}>◫ <span>Payments</span></button><button onClick={()=>router.push('/admin/affiliates')}>⌘ <span>Affiliate & Coupons</span></button><button onClick={()=>router.push('/admin/notifications')}>◌ <span>Notifications</span></button>
        <p>SUPER ADMIN</p><button onClick={()=>router.push('/admin/agencies')}>♟ <span>Agency Management</span></button><button onClick={()=>router.push('/admin/administrators')}>♛ <span>Administrators</span></button><button onClick={()=>router.push('/admin/settings')}>⚙ <span>System Settings</span></button><button onClick={()=>router.push('/admin/settings/commerce')}>◈ <span>Commerce Settings</span></button><button className="active">◇ <span>Security / Audit</span></button>
        <p>ACCOUNT</p><button onClick={()=>router.push('/admin/profile')}>◉ <span>Profile</span></button>
      </nav>
      <div className="sidebar-bottom"><button className="profile-card" onClick={()=>router.push('/admin/profile')}><span className="avatar">{initials}</span><span className="profile-copy"><strong>{me?.full_name||email.split('@')[0]}</strong><small>{email}</small></span></button><button className="logout" onClick={logout}>↗ Keluar</button></div>
    </aside>
    <main>
      <div className="topbar"><div className="search-top">⌕ <span>Cari event security...</span></div><div className="top-actions"><button className="mini-profile"><span className="avatar small">{initials}</span><span><strong>{me?.full_name||email.split('@')[0]}</strong><small>Super Admin</small></span></button><ThemeSwitcher/></div></div>
      <div className="content">
        <header><div><div className="eyebrow">SECURITY CONTROL</div><h1>Security / Audit</h1><p>Validasi keamanan backend, isolasi role, dan aktivitas sensitif platform.</p></div><button className="refresh" onClick={()=>void load()}>↻ Refresh Audit</button></header>
        {error&&<div className="alert error">{error}</div>}
        <section className="stats">
          <article className="stat blue"><div className="stat-icon">✓</div><div><span>PASS</span><strong>{pass}</strong><small>Security checks aman</small></div></article>
          <article className="stat purple"><div className="stat-icon">!</div><div><span>WARNING</span><strong>{warn}</strong><small>Perlu ditinjau</small></div></article>
          <article className="stat green"><div className="stat-icon">◇</div><div><span>AUDIT EVENTS</span><strong>{events.length}</strong><small>500 event terbaru</small></div></article>
          <article className="stat pink"><div className="stat-icon">×</div><div><span>FAILED CHECKS</span><strong>{fail}</strong><small>{fail?'Perlu tindakan':'Tidak ada kegagalan'}</small></div></article>
        </section>

        <section className="panel" style={{marginBottom:16}}>
          <div className="panel-head"><div><div className="eyebrow">PERMISSION MATRIX</div><h2>4 Role Isolation</h2><p>Hak akses inti yang kita kunci untuk iMersSUPA.</p></div><span className="summary-chip">Super Admin Only</span></div>
          <div className="table-wrap"><table><thead><tr><th>ROLE</th><th>AREA</th><th>PRODUCT / MEMBER SCOPE</th><th>SENSITIVE SETTINGS</th></tr></thead><tbody>
            <tr><td><strong>Super Admin</strong></td><td>Full Admin Control</td><td>Seluruh data operasional</td><td><span className="badge active">FULL</span></td></tr>
            <tr><td><strong>Admin</strong></td><td>Admin operasional</td><td>Operasional platform sesuai RPC Admin</td><td><span className="badge inactive">NO SUPER ADMIN</span></td></tr>
            <tr><td><strong>Agency</strong></td><td>/agency</td><td>Hanya produk entitlement + member miliknya</td><td><span className="badge inactive">NO ADMIN</span></td></tr>
            <tr><td><strong>Member</strong></td><td>/member</td><td>Hanya akses produk miliknya</td><td><span className="badge inactive">NO ADMIN</span></td></tr>
          </tbody></table></div>
        </section>

        <section className="panel" style={{marginBottom:16}}>
          <div className="panel-head"><div><div className="eyebrow">BACKEND CHECKS</div><h2>Security Validation</h2><p>Hasil pemeriksaan hak browser dan jalur RPC sensitif.</p></div><span className="summary-chip">{checks.length} checks</span></div>
          <div className="table-wrap"><table><thead><tr><th>CHECK</th><th>STATUS</th><th>DETAIL</th></tr></thead><tbody>
            {loading?<tr><td colSpan={3} className="empty">Running security audit...</td></tr>:checks.length===0?<tr><td colSpan={3} className="empty">Belum ada hasil audit.</td></tr>:checks.map(c=><tr key={c.check_key}><td><strong>{pretty(c.check_key)}</strong><small style={{display:'block',color:'#8994a8'}}>{c.check_key}</small></td><td><span className={`badge ${c.status==='PASS'?'active':c.status==='WARN'?'suspended':'inactive'}`}>{c.status}</span></td><td>{c.detail}</td></tr>)}
          </tbody></table></div>
        </section>

        <section className="panel">
          <div className="panel-head"><div><div className="eyebrow">SECURITY EVENTS</div><h2>Audit Log</h2><p>Aktivitas sensitif yang sudah dicatat backend.</p></div><span className="summary-chip">{filtered.length} events</span></div>
          <div className="filters"><div className="searchbox">⌕<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari event, target atau ID..."/></div><select value={severity} onChange={e=>setSeverity(e.target.value)}><option value="all">Semua Severity</option><option value="info">Info</option><option value="warning">Warning</option><option value="critical">Critical</option></select><select value={pageSize} onChange={e=>setPageSize(Number(e.target.value))}>{PAGE_SIZES.map(n=><option key={n} value={n}>{n} / halaman</option>)}</select></div>
          <div className="table-wrap"><table><thead><tr><th>EVENT</th><th>SEVERITY</th><th>TARGET</th><th>ACTOR</th><th>TIME</th></tr></thead><tbody>
            {loading?<tr><td colSpan={5} className="empty">Loading audit log...</td></tr>:visible.length===0?<tr><td colSpan={5} className="empty">Belum ada event yang sesuai filter.</td></tr>:visible.map(e=><tr key={e.id}><td><strong>{pretty(e.event_key)}</strong><small style={{display:'block',color:'#8994a8'}}>{e.event_key}</small></td><td><span className={`badge ${e.severity==='info'?'active':e.severity==='warning'?'suspended':'inactive'}`}>{pretty(e.severity)}</span></td><td>{e.target_type||'—'}{e.target_id?<small style={{display:'block',color:'#8994a8'}}>{e.target_id}</small>:null}</td><td>{e.actor_user_id?e.actor_user_id.slice(0,12)+'...':'System'}</td><td>{date(e.created_at)}</td></tr>)}
          </tbody></table></div>
          <div className="pagination"><span>Menampilkan {filtered.length?(safePage-1)*pageSize+1:0}–{Math.min(safePage*pageSize,filtered.length)} dari {filtered.length} data</span><div><button disabled={safePage<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}>← Previous</button><strong>Page {safePage} / {pages}</strong><button disabled={safePage>=pages} onClick={()=>setPage(p=>Math.min(pages,p+1))}>Next →</button></div></div>
        </section>
      </div>
    </main>
      <style jsx>{`
        *{box-sizing:border-box}
        .admin-page{min-height:100vh;background:radial-gradient(circle at 20% 8%,rgba(209,230,255,.95),transparent 28%),radial-gradient(circle at 92% 78%,rgba(249,218,255,.82),transparent 32%),#f7f8ff;color:#12213a;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
        .sidebar{position:fixed;inset:0 auto 0 0;width:270px;padding:24px 18px 18px;background:rgba(249,251,255,.92);border-right:1px solid #e4e8f3;display:flex;flex-direction:column;z-index:30;overflow-y:auto}
        .brand{display:flex;align-items:center;gap:11px;margin-bottom:22px}.brand-mark{width:42px;height:42px;border-radius:13px;display:grid;place-items:center;color:white;font-weight:900;font-size:18px;background:linear-gradient(135deg,#4d59f7,#724cf4);box-shadow:0 12px 24px rgba(92,78,238,.24)}
        .brand strong{display:block;font-size:17px;line-height:1.1}.brand small{display:block;font-size:10px;letter-spacing:.12em;color:#66738e;font-weight:800;margin-top:3px}
        .role-card{display:flex;align-items:center;gap:10px;padding:13px;border:1px solid #dfe3ef;border-radius:15px;background:linear-gradient(110deg,rgba(226,234,255,.85),rgba(249,246,255,.9));margin-bottom:13px}.role-icon{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;background:#e2e5ff;color:#7165f5}.role-card small{display:block;font-size:10px;letter-spacing:.12em;color:#7b849a;font-weight:800}.role-card strong{display:block;font-size:13px;margin-top:2px}
        nav p{font-size:9px;letter-spacing:.16em;color:#8994aa;font-weight:900;margin:16px 9px 6px}nav button{width:100%;min-height:43px;border:1px solid transparent;background:transparent;border-radius:12px;padding:0 11px;text-align:left;color:#617089;font-size:13px;font-weight:750;cursor:pointer;margin:1px 0}nav button:hover{background:#f0f3ff;color:#26334b}nav button.active{color:#15213a;border-color:#cfd2ff;background:linear-gradient(110deg,#e7ecff,#f8f5ff)}
        nav button span{margin-left:9px}.sidebar-bottom{margin-top:auto;padding-top:18px}.profile-card{width:100%;border:1px solid #dfe3ef;background:linear-gradient(110deg,#edf2ff,#faf7ff);border-radius:14px;padding:9px;display:flex;align-items:center;gap:9px;cursor:pointer}.avatar{width:34px;height:34px;border-radius:10px;background:linear-gradient(135deg,#4f5bf6,#724cf4);color:white;display:grid;place-items:center;font-weight:900;font-size:12px;flex:0 0 auto}.avatar.small{width:31px;height:31px}.profile-copy{min-width:0;text-align:left}.profile-copy strong,.mini-profile strong{display:block;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.profile-copy small,.mini-profile small{display:block;font-size:9.5px;color:#8791a6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.logout{width:100%;margin-top:8px;border:1px solid #ffd4d4;background:#fff2f2;color:#e24848;border-radius:12px;height:38px;font-size:12px;font-weight:800;cursor:pointer}
        main{margin-left:270px;min-height:100vh}.topbar{height:72px;border-bottom:1px solid rgba(220,225,238,.9);background:rgba(255,255,255,.64);backdrop-filter:blur(18px);display:flex;align-items:center;justify-content:space-between;padding:0 30px;position:sticky;top:0;z-index:20}.search-top{width:min(390px,40vw);height:42px;border:1px solid #dfe4ef;border-radius:13px;display:flex;align-items:center;gap:9px;padding:0 13px;color:#8a95aa;font-size:12.5px;background:rgba(255,255,255,.7)}.top-actions{display:flex;align-items:center;gap:10px}.mini-profile{border:1px solid #dfe4ef;background:rgba(255,255,255,.72);border-radius:13px;padding:5px 9px;display:flex;align-items:center;gap:8px;max-width:220px;cursor:pointer}.mini-profile span:last-child{text-align:left;min-width:0}
        .content{max-width:1450px;margin:0 auto;padding:31px 28px 50px}header{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;margin-bottom:20px}.eyebrow{font-size:10.5px;letter-spacing:.15em;color:#554cf2;font-weight:900}header h1{font-size:32px;line-height:1.1;letter-spacing:-.8px;margin:5px 0 7px}header p{font-size:13.5px;line-height:1.6;color:#728099;margin:0}.refresh{height:40px;padding:0 16px;border:1px solid #dfe3ee;background:rgba(255,255,255,.82);border-radius:12px;font-size:12px;font-weight:800;cursor:pointer}
        .alert{padding:11px 14px;border-radius:11px;font-size:12px;margin-bottom:14px;border:1px solid}.alert.error{background:#fff0f1;border-color:#ffcdd2;color:#c53d48}.alert.success{background:#effdf5;border-color:#c8f0d8;color:#18844a}
        .stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-bottom:16px}.stat{min-height:118px;border:1px solid #dfe4ef;border-radius:16px;padding:17px;display:flex;align-items:flex-start;gap:13px;box-shadow:0 14px 35px rgba(72,79,117,.06)}.stat.blue{background:linear-gradient(135deg,#f5f8ff,#eaf0ff)}.stat.purple{background:linear-gradient(135deg,#faf7ff,#f0eaff)}.stat.green{background:linear-gradient(135deg,#f3fff9,#e5faf2)}.stat.pink{background:linear-gradient(135deg,#fff7fb,#fdebf7)}.stat-icon{width:38px;height:38px;border-radius:11px;background:rgba(255,255,255,.72);display:grid;place-items:center;color:#6258f3;font-weight:900}.stat span{display:block;font-size:10px;color:#78839a;margin:2px 0 6px}.stat strong{display:block;font-size:26px;line-height:1}.stat small{display:block;font-size:10.5px;color:#8993a7;margin-top:7px}
        .panel{border:1px solid #dfe4ef;border-radius:18px;background:rgba(255,255,255,.82);overflow:hidden;box-shadow:0 18px 45px rgba(73,80,119,.07)}.panel-head{padding:18px 20px;border-bottom:1px solid #e7eaf2;display:flex;align-items:center;justify-content:space-between;gap:16px}.panel-head h2{font-size:20px;margin:4px 0 3px}.panel-head p{font-size:12px;color:#8490a6;margin:0}.summary-chip{font-size:11px;color:#5f6d85;background:#f3f5fb;border:1px solid #e3e7f0;border-radius:999px;padding:7px 10px;white-space:nowrap}
        .filters{padding:12px 20px;display:grid;grid-template-columns:minmax(260px,1fr) 160px 135px;gap:9px;border-bottom:1px solid #e7eaf2}.searchbox{height:42px;border:1px solid #dfe4ef;border-radius:11px;display:flex;align-items:center;padding-left:12px;color:#8995aa;background:#fbfcff}.searchbox input{border:0;outline:0;background:transparent;width:100%;height:100%;padding:0 10px;font-size:12.5px;color:#22304a}.filters select{height:42px;border:1px solid #dfe4ef;border-radius:11px;background:white;padding:0 10px;font-size:12px;color:#34415a;outline:0}
        .table-wrap{overflow:auto;min-height:330px}table{width:100%;border-collapse:collapse;font-size:12px}th{font-size:9.5px;letter-spacing:.09em;color:#7f8ba2;text-align:left;background:#fafbfe;padding:11px 14px;white-space:nowrap}td{padding:13px 14px;border-top:1px solid #edf0f5;color:#526078;vertical-align:middle}tbody tr:hover{background:#fbfcff}.member-cell{display:flex;align-items:center;gap:10px;min-width:180px}.member-avatar{width:35px;height:35px;border-radius:10px;background:linear-gradient(135deg,#4f5bf6,#7956f4);color:white;display:grid;place-items:center;font-weight:900}.member-cell strong{display:block;font-size:12.5px;color:#18253d}.member-cell small{display:block;font-size:9.5px;color:#929bad;margin-top:2px}.badge{display:inline-flex;padding:5px 8px;border-radius:999px;font-size:9.5px;font-weight:900;text-transform:uppercase}.badge.active{background:#e8f9ef;color:#16864b}.badge.inactive,.badge.revoked,.badge.expired{background:#f0f2f6;color:#707c91}.badge.suspended{background:#fff0f1;color:#d44952}.access-list strong{display:block;color:#26344d;font-size:11.5px}.access-list small{display:block;max-width:220px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:9.5px;color:#8994a8;margin-top:2px}.muted{color:#9aa3b4;font-size:11px}.action{height:32px;padding:0 11px;border:1px solid #d7d9ff;background:linear-gradient(110deg,#f1f3ff,#f8f4ff);color:#5149d9;border-radius:9px;font-size:11px;font-weight:800;cursor:pointer}.empty{text-align:center;height:230px;color:#929caf}
        .pagination{display:flex;align-items:center;justify-content:space-between;gap:15px;padding:13px 20px;border-top:1px solid #e7eaf2;color:#8a95a8;font-size:10.5px}.pagination div{display:flex;align-items:center;gap:9px}.pagination button{height:32px;padding:0 10px;border:1px solid #e0e4ed;background:white;border-radius:9px;font-size:10px;color:#66738a}.pagination button:disabled{opacity:.4}.pagination strong{font-size:10.5px;color:#59667e}
        .modal-backdrop{position:fixed;inset:0;background:rgba(20,28,48,.38);backdrop-filter:blur(5px);z-index:80;display:grid;place-items:center;padding:20px}.modal{width:min(560px,100%);max-height:90vh;overflow:auto;background:#fbfcff;border:1px solid #e1e5ef;border-radius:20px;box-shadow:0 30px 80px rgba(29,36,64,.24)}.modal-head{padding:20px 22px 15px;border-bottom:1px solid #e8ebf2;display:flex;justify-content:space-between;gap:15px}.modal-head h2{font-size:22px;margin:4px 0}.modal-head p{font-size:12px;color:#7d899f;margin:0}.close{width:34px;height:34px;border:1px solid #dfe3ec;background:white;border-radius:10px;font-size:20px;cursor:pointer}.modal form{padding:20px 22px}.modal label{display:block;font-size:11px;font-weight:800;color:#45536c;margin-bottom:13px}.modal input,.modal select{display:block;width:100%;height:42px;border:1px solid #dce1ec;border-radius:10px;background:white;padding:0 11px;margin-top:6px;font-size:12px;outline:0}.member-info{border:1px solid #e0e4ed;background:linear-gradient(135deg,#f7f9ff,#fbf8ff);border-radius:13px;padding:13px;margin-top:5px}.member-info>span{font-size:9px;letter-spacing:.12em;color:#7269e8;font-weight:900}.member-info div{display:flex;justify-content:space-between;gap:10px;padding:9px 0;border-bottom:1px solid #e8eaf2}.member-info div:last-child{border-bottom:0}.member-info strong{font-size:11.5px}.member-info small{font-size:10px;color:#8590a5}.member-info p{font-size:11px;color:#8994a8;margin:9px 0 2px}.modal-actions{display:flex;justify-content:flex-end;gap:9px;margin-top:18px}.modal-actions button{height:40px;padding:0 14px;border-radius:10px;font-size:11.5px;font-weight:850;cursor:pointer}.secondary{border:1px solid #dfe3ec;background:white;color:#56637a}.primary{border:0;background:linear-gradient(135deg,#5b59f6,#7650ef);color:white}
        @media(max-width:1100px){.stats{grid-template-columns:repeat(2,1fr)}.filters{grid-template-columns:1fr 150px}.filters select:last-child{grid-column:2}.sidebar{width:235px}main{margin-left:235px}}
        @media(max-width:820px){.sidebar{display:none}main{margin-left:0}.topbar{padding:0 16px}.search-top{display:none}.content{padding:22px 15px 40px}.stats{grid-template-columns:1fr 1fr}.filters{grid-template-columns:1fr}.filters select:last-child{grid-column:auto}.pagination{align-items:flex-start;flex-direction:column}header h1{font-size:27px}}
        @media(max-width:520px){.stats{grid-template-columns:1fr}.mini-profile span:last-child{display:none}.panel-head{align-items:flex-start;flex-direction:column}.modal-backdrop{padding:10px}}
      `}</style>

    </div>
}
