'use client'

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const supabase=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!)

type Profile={full_name?:string|null;avatar_url?:string|null;role?:string|null}
type Settings={enabled:boolean;attribution_mode:'last_click'|'affiliate_lock';cookie_duration_days:number;lock_mode:'cookie_duration'|'lifetime';default_commission_percent:number;minimum_payout:number;auto_approve_affiliate:boolean;coupon_alias_overrides_cookie:boolean;prevent_self_referral:boolean}
type Affiliate={id:string;user_id:string;referral_code:string;status:string;display_name?:string|null;created_at?:string|null}
type Summary={total_affiliates:number;active_affiliates:number;pending_affiliates:number;total_clicks:number;paid_referral_orders:number;pending_commission:number;approved_commission:number;pending_payout:number}

const defaults:Settings={enabled:false,attribution_mode:'last_click',cookie_duration_days:30,lock_mode:'cookie_duration',default_commission_percent:20,minimum_payout:0,auto_approve_affiliate:true,coupon_alias_overrides_cookie:true,prevent_self_referral:true}
const emptySummary:Summary={total_affiliates:0,active_affiliates:0,pending_affiliates:0,total_clicks:0,paid_referral_orders:0,pending_commission:0,approved_commission:0,pending_payout:0}
const money=(v:number)=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(v||0))
const date=(v?:string|null)=>v?new Intl.DateTimeFormat('id-ID',{dateStyle:'medium'}).format(new Date(v)):'—'

export default function AdminAffiliatesPage(){
 const router=useRouter()
 const [profile,setProfile]=useState<Profile|null>(null),[email,setEmail]=useState('')
 const [settings,setSettings]=useState<Settings>(defaults),[summary,setSummary]=useState<Summary>(emptySummary)
 const [rows,setRows]=useState<Affiliate[]>([]),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false)
 const [error,setError]=useState(''),[message,setMessage]=useState('')
 const [searchInput,setSearchInput]=useState(''),[search,setSearch]=useState(''),[status,setStatus]=useState('all')
 const [page,setPage]=useState(1),[pageSize,setPageSize]=useState(25),[total,setTotal]=useState(0)

 const displayName=profile?.full_name?.trim()||email.split('@')[0]||'Administrator'
 const initials=displayName.split(' ').filter(Boolean).slice(0,2).map(x=>x[0]?.toUpperCase()).join('')||'A'
 const isSuperAdmin=profile?.role==='super_admin'
 const pages=Math.max(1,Math.ceil(total/pageSize)),start=total?((page-1)*pageSize)+1:0,end=Math.min(page*pageSize,total)

 const logout=async()=>{await supabase.auth.signOut();router.replace('/login')}

 const loadIdentity=useCallback(async()=>{
  const {data:{user}}=await supabase.auth.getUser()
  if(!user){router.replace('/login');return false}
  setEmail(user.email||'')
  const {data}=await supabase.from('profiles').select('full_name,avatar_url,role').eq('id',user.id).maybeSingle()
  const p=(data||{}) as Profile;setProfile(p)
  if(!['admin','super_admin'].includes(String(p.role||''))){router.replace('/member');return false}
  return true
 },[router])

 const loadData=useCallback(async()=>{
  setLoading(true);setError('')
  try{
   const settingsReq=supabase.from('affiliate_settings').select('*').eq('id',1).single()
   const summaryReq=supabase.from('admin_affiliate_summary').select('*').maybeSingle()
   let list=supabase.from('affiliates').select('id,user_id,referral_code,status,display_name,created_at',{count:'exact'}).order('created_at',{ascending:false}).range((page-1)*pageSize,page*pageSize-1)
   if(status!=='all') list=list.eq('status',status)
   if(search.trim()){const q=search.trim().replaceAll(',',' ');list=list.or(`display_name.ilike.%${q}%,referral_code.ilike.%${q}%`)}
   const [a,b,c]=await Promise.all([settingsReq,summaryReq,list])
   if(a.error) throw a.error;if(b.error) throw b.error;if(c.error) throw c.error
   if(a.data)setSettings(a.data as Settings)
   if(b.data)setSummary(b.data as Summary)
   setRows((c.data||[]) as Affiliate[]);setTotal(c.count||0)
  }catch(e:any){setError(e?.message||'Gagal memuat data affiliate.');setRows([]);setTotal(0)}
  finally{setLoading(false)}
 },[page,pageSize,search,status])

 useEffect(()=>{void (async()=>{if(await loadIdentity())await loadData()})()},[loadIdentity,loadData])
 useEffect(()=>{if(page>pages)setPage(pages)},[page,pages])

 const submitSearch=(e:FormEvent)=>{e.preventDefault();setPage(1);setSearch(searchInput)}
 const save=async()=>{
  setSaving(true);setError('');setMessage('')
  const {error}=await supabase.rpc('admin_update_affiliate_settings',{
   p_enabled:settings.enabled,p_attribution_mode:settings.attribution_mode,p_cookie_duration_days:settings.cookie_duration_days,p_lock_mode:settings.lock_mode,
   p_default_commission_percent:settings.default_commission_percent,p_minimum_payout:settings.minimum_payout,p_auto_approve_affiliate:settings.auto_approve_affiliate,
   p_coupon_alias_overrides_cookie:settings.coupon_alias_overrides_cookie,p_prevent_self_referral:settings.prevent_self_referral
  })
  if(error)setError(error.message);else{setMessage('Affiliate settings berhasil disimpan.');await loadData()}
  setSaving(false)
 }
 const changeStatus=async(id:string,next:string)=>{
  setError('');setMessage('')
  const {error}=await supabase.rpc('admin_set_affiliate_status',{p_affiliate_id:id,p_status:next})
  if(error)setError(error.message);else{setMessage('Status affiliate berhasil diperbarui.');await loadData()}
 }
 const pageApproved=useMemo(()=>rows.filter(x=>x.status==='active').length,[rows])

 return <div className="admin-shell">
<aside className="sidebar">

          <div>
            <Brand />

            <div className="role-card">
              <div className="role-icon">
                {isSuperAdmin
                  ? '★'
                  : '◆'}
              </div>

              <div>
                <span>
                  LOGGED IN AS
                </span>

                <strong>
                  {isSuperAdmin
                    ? 'Super Admin'
                    : 'Administrator'}
                </strong>
              </div>
            </div>

            <Menu
              isSuperAdmin={
                isSuperAdmin
              }
              router={router}
              onProfile={() =>
                router.push('/admin/profile')
              }
            />
          </div>

          <div className="sidebar-bottom">

            <button
              className="sidebar-profile"
              onClick={() =>
                router.push('/admin/profile')
              }
            >
              <Avatar
                url={profile?.avatar_url}
                initials={initials}
              />

              <span>
                <strong>
                  {displayName}
                </strong>

                <small>
                  {isSuperAdmin
                    ? 'Super Admin'
                    : 'Admin'}
                </small>
              </span>
            </button>

            <button
              className="logout"
              onClick={logout}
            >
              ↗ Keluar
            </button>

          </div>
        </aside>

        {/* =========================================
            CONTENT
        ========================================= */}



  
<main className="content">
 <div className="aff-head"><div><div className="aff-kicker">COMMERCE / AFFILIATE & COUPONS</div><h1>Affiliate Management</h1><p>Kelola program affiliate, attribution, komisi, dan status affiliate.</p></div><button className="aff-refresh" onClick={()=>void loadData()} disabled={loading}>↻ Refresh</button></div>
 {error&&<div className="aff-alert error">{error}</div>}{message&&<div className="aff-alert ok">{message}</div>}
 <section className="aff-stats">
  <div className="aff-stat blue"><span>◎</span><div><small>TOTAL AFFILIATE</small><strong>{summary.total_affiliates}</strong><p>Seluruh affiliate</p></div></div>
  <div className="aff-stat purple"><span>✓</span><div><small>ACTIVE AFFILIATE</small><strong>{summary.active_affiliates}</strong><p>{pageApproved} aktif di halaman ini</p></div></div>
  <div className="aff-stat mint"><span>⌛</span><div><small>PENDING AFFILIATE</small><strong>{summary.pending_affiliates}</strong><p>Menunggu approval</p></div></div>
  <div className="aff-stat pink"><span>Rp</span><div><small>PENDING PAYOUT</small><strong>{money(summary.pending_payout)}</strong><p>Belum diselesaikan</p></div></div>
 </section>

 <section className="aff-grid">
  <div className="aff-card"><div className="aff-card-head"><div className="aff-kicker">PROGRAM SETTINGS</div><h2>Affiliate Settings</h2><p>Pengaturan global affiliate dan attribution.</p></div><div className="aff-body"><div className="aff-form">
   <div className="aff-field full"><div className="aff-switch"><div><b>Affiliate Program</b><small>Aktif/nonaktifkan program secara global.</small></div><input type="checkbox" checked={settings.enabled} onChange={e=>setSettings(v=>({...v,enabled:e.target.checked}))}/></div></div>
   <div className="aff-field"><label>Attribution Mode</label><select value={settings.attribution_mode} onChange={e=>setSettings(v=>({...v,attribution_mode:e.target.value as Settings['attribution_mode']}))}><option value="last_click">Last Click Wins</option><option value="affiliate_lock">Affiliate Lock</option></select></div>
   <div className="aff-field"><label>Cookie Duration (hari)</label><input type="number" min={1} max={3650} value={settings.cookie_duration_days} onChange={e=>setSettings(v=>({...v,cookie_duration_days:Number(e.target.value||1)}))}/></div>
   <div className="aff-field"><label>Lock Mode</label><select value={settings.lock_mode} onChange={e=>setSettings(v=>({...v,lock_mode:e.target.value as Settings['lock_mode']}))}><option value="cookie_duration">Cookie Duration</option><option value="lifetime">Lifetime</option></select></div>
   <div className="aff-field"><label>Default Commission (%)</label><input type="number" min={0} max={100} step=".01" value={settings.default_commission_percent} onChange={e=>setSettings(v=>({...v,default_commission_percent:Number(e.target.value||0)}))}/></div>
   <div className="aff-field"><label>Minimum Payout</label><input type="number" min={0} value={settings.minimum_payout} onChange={e=>setSettings(v=>({...v,minimum_payout:Number(e.target.value||0)}))}/></div>
   <div className="aff-field full"><div className="aff-switch"><div><b>Auto Approve Affiliate</b><small>Affiliate baru langsung aktif.</small></div><input type="checkbox" checked={settings.auto_approve_affiliate} onChange={e=>setSettings(v=>({...v,auto_approve_affiliate:e.target.checked}))}/></div></div>
   <div className="aff-field full"><div className="aff-switch"><div><b>Coupon Alias Overrides Cookie</b><small>Alias eksplisit boleh mengganti attribution cookie.</small></div><input type="checkbox" checked={settings.coupon_alias_overrides_cookie} onChange={e=>setSettings(v=>({...v,coupon_alias_overrides_cookie:e.target.checked}))}/></div></div>
   <div className="aff-field full"><div className="aff-switch"><div><b>Prevent Self Referral</b><small>Cegah affiliate mereferensikan dirinya sendiri.</small></div><input type="checkbox" checked={settings.prevent_self_referral} onChange={e=>setSettings(v=>({...v,prevent_self_referral:e.target.checked}))}/></div></div>
  </div><div className="aff-save"><button className="aff-primary" disabled={saving} onClick={()=>void save()}>{saving?'Menyimpan...':'Simpan Settings'}</button></div></div></div>

  <div className="aff-card"><div className="aff-card-head"><div className="aff-kicker">PROGRAM SUMMARY</div><h2>Affiliate Overview</h2><p>Ringkasan aktivitas affiliate dari database.</p></div><div className="aff-body"><div className="aff-summary">
   <div><span>Total Clicks</span><strong>{summary.total_clicks}</strong></div><div><span>Paid Referral Orders</span><strong>{summary.paid_referral_orders}</strong></div><div><span>Pending Commission</span><strong>{money(summary.pending_commission)}</strong></div><div><span>Approved Commission</span><strong>{money(summary.approved_commission)}</strong></div><div><span>Attribution</span><strong>{settings.attribution_mode==='last_click'?'Last Click Wins':'Affiliate Lock'}</strong></div><div><span>Cookie Duration</span><strong>{settings.cookie_duration_days} hari</strong></div>
  </div></div></div>
 </section>

 <section className="aff-table-card"><div className="aff-table-head"><div className="aff-kicker">AFFILIATES</div><h2>Daftar Affiliate</h2><p>Search, filter, pagination, dan page size aktif sejak awal.</p></div>
  <form className="aff-filters" onSubmit={submitSearch}><div className="aff-search"><input value={searchInput} onChange={e=>setSearchInput(e.target.value)} placeholder="Cari nama affiliate atau referral code..."/><button type="submit">Search</button></div>
   <select value={status} onChange={e=>{setStatus(e.target.value);setPage(1)}}><option value="all">All Status</option><option value="pending">Pending</option><option value="active">Active</option><option value="suspended">Suspended</option><option value="rejected">Rejected</option></select>
   <select value={pageSize} onChange={e=>{setPageSize(Number(e.target.value));setPage(1)}}><option value={10}>10 / page</option><option value={25}>25 / page</option><option value={50}>50 / page</option><option value={100}>100 / page</option></select>
  </form>
  <div className="aff-table-wrap"><table className="aff-table"><thead><tr><th>AFFILIATE</th><th>REFERRAL CODE</th><th>STATUS</th><th>JOINED</th><th>ACTION</th></tr></thead><tbody>
   {!loading&&rows.map(r=><tr key={r.id}><td><div className="aff-person"><strong>{r.display_name||'Affiliate'}</strong><small>{r.user_id}</small></div></td><td><strong>{r.referral_code}</strong></td><td><span className={`aff-badge ${r.status}`}>{r.status}</span></td><td>{date(r.created_at)}</td><td><select className="aff-status" value={r.status} onChange={e=>void changeStatus(r.id,e.target.value)}><option value="pending">Pending</option><option value="active">Active</option><option value="suspended">Suspended</option><option value="rejected">Rejected</option></select></td></tr>)}
  </tbody></table>{loading&&<div className="aff-empty">Loading affiliates...</div>}{!loading&&rows.length===0&&<div className="aff-empty">Belum ada affiliate yang sesuai filter.</div>}</div>
  <div className="aff-pagination"><span>Menampilkan {start}–{end} dari {total} data</span><div className="aff-pages"><button disabled={page<=1||loading} onClick={()=>setPage(v=>Math.max(1,v-1))}>← Previous</button><strong>Page {page} / {pages}</strong><button disabled={page>=pages||loading} onClick={()=>setPage(v=>Math.min(pages,v+1))}>Next →</button></div></div>
 </section>
</main>
<style jsx global>{`
      .admin-shell {
        min-height: 100vh;
        display: grid;
        grid-template-columns:
          248px minmax(0, 1fr);
        color:
          var(--text-primary);
        background:
          var(--page-gradient);
      }

      .sidebar {
        position: sticky;
        top: 0;
        height: 100vh;
        padding: 23px 17px 17px;
        display: flex;
        flex-direction: column;
        justify-content:
          space-between;
        border-right:
          1px solid var(--border);
        background:
          var(--sidebar-bg);
        backdrop-filter:
          blur(20px);
        z-index: 30;
      }

      .brand {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .brand-logo {
        width: 42px;
        height: 42px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 14px;
        color: #fff;
        font-size: 18px;
        font-weight: 950;
        background:
          var(--primary-gradient);
        box-shadow:
          0 13px 30px
          rgba(79,70,229,.25);
      }

      .brand > div:last-child {
        display: grid;
        gap: 2px;
      }

      .brand strong {
        font-size: 15px;
        letter-spacing: -.4px;
      }

      .brand span {
        color:
          var(--text-muted);
        font-size: 6px;
        font-weight: 900;
        letter-spacing: 1.5px;
      }

      .role-card {
        margin-top: 25px;
        padding: 11px;
        display: flex;
        align-items: center;
        gap: 9px;
        border:
          1px solid
          var(--border);
        border-radius: 14px;
        background:
          var(--card-gradient);
      }

      .role-icon {
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 10px;
        color: #c4b5fd;
        background:
          rgba(99,102,241,.12);
      }

      .role-card > div:last-child {
        display: grid;
        gap: 2px;
      }

      .role-card span {
        color:
          var(--text-muted);
        font-size: 6px;
        font-weight: 900;
        letter-spacing: 1px;
      }

      .role-card strong {
        font-size: 9px;
      }

      .menu {
        margin-top: 22px;
        display: grid;
        gap: 4px;
      }

      .menu-title {
        margin: 0 10px 7px;
        color:
          var(--text-soft);
        font-size: 7px;
        font-weight: 950;
        letter-spacing: 1.4px;
      }

      .menu-title.second {
        margin-top: 16px;
      }

      .menu-item {
        width: 100%;
        padding: 9px 10px;
        display: flex;
        align-items: center;
        gap: 9px;
        border:
          1px solid transparent;
        border-radius: 11px;
        cursor: pointer;
        color:
          var(--text-muted);
        text-align: left;
        font-size: 9px;
        font-weight: 750;
        background: transparent;
        transition: .2s ease;
      }

      .menu-item i {
        width: 27px;
        height: 27px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 8px;
        color:
          var(--accent-light);
        font-style: normal;
        background:
          rgba(99,102,241,.09);
      }

      .menu-item:hover,
      .menu-item.active {
        color:
          var(--text-primary);
        border-color:
          var(--border-strong);
        background:
          var(--card-gradient);
      }

      .sidebar-bottom {
        display: grid;
        gap: 8px;
      }

      .sidebar-profile {
        width: 100%;
        padding: 9px;
        display: flex;
        align-items: center;
        gap: 8px;
        border:
          1px solid
          var(--border);
        border-radius: 13px;
        cursor: pointer;
        color:
          var(--text-primary);
        text-align: left;
        background:
          var(--card-gradient);
      }

      .avatar {
        width: 35px;
        height: 35px;
        flex: 0 0 auto;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 11px;
        color: #fff;
        font-size: 10px;
        font-weight: 950;
        background:
          var(--primary-gradient);
      }

      .avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .avatar-large {
        width: 75px;
        height: 75px;
        border-radius: 23px;
        font-size: 20px;
      }

      .sidebar-profile > span,
      .profile-button > span {
        min-width: 0;
        display: grid;
        gap: 1px;
      }

      .sidebar-profile strong,
      .profile-button strong {
        max-width: 130px;
        overflow: hidden;
        font-size: 8px;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .sidebar-profile small,
      .profile-button small {
        color:
          var(--text-muted);
        font-size: 6px;
      }

      .logout {
        padding: 9px;
        border:
          1px solid
          rgba(239,68,68,.1);
        border-radius: 11px;
        cursor: pointer;
        color:
          var(--danger);
        font-size: 8px;
        font-weight: 800;
        background:
          rgba(127,29,29,.07);
      }

      .main {
        min-width: 0;
      }

      .topbar {
        position: sticky;
        top: 0;
        z-index: 20;
        height: 72px;
        padding: 0 180px 0 28px;
        display: flex;
        align-items: center;
        justify-content:
          space-between;
        gap: 15px;
        border-bottom:
          1px solid
          var(--border);
        background:
          var(--topbar-bg);
        backdrop-filter:
          blur(20px);
      }

      .mobile-brand {
        display: none;
      }

      .search {
        position: relative;
        width:
          min(420px, 45vw);
        display: flex;
        align-items: center;
        border:
          1px solid
          var(--border);
        border-radius: 13px;
        background:
          var(--input-bg);
      }

      .search > span {
        padding-left: 13px;
        color:
          var(--text-muted);
        font-size: 17px;
      }

      .search input {
        width: 100%;
        min-width: 0;
        padding: 11px;
        border: 0;
        outline: 0;
        color:
          var(--text-primary);
        font-size: 9px;
        background: transparent;
      }

      .search input::placeholder {
        color:
          var(--text-soft);
      }

      .search-clear {
        padding: 0 12px;
        border: 0;
        cursor: pointer;
        color:
          var(--text-muted);
        background: transparent;
      }

      .search-results {
        position: absolute;
        top: calc(100% + 8px);
        left: 0;
        right: 0;
        padding: 6px;
        border:
          1px solid
          var(--border);
        border-radius: 14px;
        background:
          var(--surface-strong);
        box-shadow:
          var(--shadow);
      }

      .search-result {
        padding: 9px;
        display: flex;
        align-items: center;
        gap: 9px;
        border-radius: 9px;
      }

      .result-icon {
        width: 27px;
        height: 27px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 8px;
        color:
          var(--accent);
        background:
          rgba(99,102,241,.1);
      }

      .search-result div {
        min-width: 0;
        display: grid;
        gap: 2px;
      }

      .search-result strong {
        font-size: 8px;
      }

      .search-result small {
        color:
          var(--text-muted);
        font-size: 6px;
      }

      .no-search {
        padding: 14px;
        color:
          var(--text-muted);
        text-align: center;
        font-size: 8px;
      }

      .top-actions {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .notification {
        position: relative;
        width: 37px;
        height: 37px;
        border:
          1px solid
          var(--border);
        border-radius: 11px;
        cursor: pointer;
        color:
          var(--text-secondary);
        background:
          var(--surface-gradient);
      }

      .notification i {
        position: absolute;
        top: 7px;
        right: 7px;
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #818cf8;
      }

      .profile-button {
        padding: 4px 7px 4px 4px;
        display: flex;
        align-items: center;
        gap: 7px;
        border:
          1px solid
          var(--border);
        border-radius: 13px;
        cursor: pointer;
        color:
          var(--text-primary);
        text-align: left;
        background:
          var(--surface-gradient);
      }

      .content {
        width: 100%;
        max-width: 1450px;
        margin: 0 auto;
        padding:
          31px 28px 50px;
      }

      .welcome {
        display: flex;
        align-items: flex-end;
        justify-content:
          space-between;
        gap: 20px;
      }

      .eyebrow {
        color:
          var(--accent);
        font-size: 7px;
        font-weight: 950;
        letter-spacing: 1.5px;
      }

      .welcome h1 {
        margin: 6px 0 7px;
        font-size:
          clamp(27px,4vw,40px);
        line-height: 1.1;
        letter-spacing: -1.2px;
      }

      .welcome h1 span {
        color:
          var(--accent-light);
      }

      .welcome p,
      .heading p {
        margin: 0;
        color:
          var(--text-muted);
        font-size: 9px;
        line-height: 1.6;
      }

      .system-status {
        min-width: 210px;
        padding: 12px 14px;
        display: grid;
        gap: 5px;
        border:
          1px solid
          var(--border);
        border-radius: 14px;
        background:
          var(--card-gradient);
      }

      .system-status strong {
        font-size: 8px;
      }

      .online {
        display: flex;
        align-items: center;
        gap: 6px;
        color:
          var(--success);
        font-size: 6px;
        font-weight: 950;
        letter-spacing: 1px;
      }

      .online i {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #22c55e;
        box-shadow:
          0 0 12px
          rgba(34,197,94,.5);
      }

      .warning {
        margin-top: 18px;
        padding: 12px;
        display: flex;
        gap: 10px;
        border:
          1px solid
          rgba(245,158,11,.15);
        border-radius: 13px;
        color: #f59e0b;
        background:
          rgba(120,53,15,.08);
      }

      .warning > div {
        width: 28px;
        height: 28px;
        flex: 0 0 auto;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 9px;
        background:
          rgba(245,158,11,.1);
      }

      .warning span {
        display: grid;
        gap: 3px;
        font-size: 7px;
      }

      .stats {
        margin-top: 25px;
        display: grid;
        grid-template-columns:
          repeat(4,minmax(0,1fr));
        gap: 11px;
      }

      .stat {
        min-height: 145px;
        padding: 16px;
        border:
          1px solid
          var(--border);
        border-radius: 18px;
        box-shadow:
          0 15px 40px
          rgba(0,0,0,.05);
      }

      .stat.blue {
        background:
          var(--card-gradient-blue);
      }

      .stat.purple {
        background:
          var(--card-gradient-purple);
      }

      .stat.green {
        background:
          var(--card-gradient-green);
      }

      .stat.pink {
        background:
          var(--card-gradient-pink);
      }

      .stat-head {
        display: flex;
        align-items: center;
        justify-content:
          space-between;
        color:
          var(--text-muted);
      }

      .stat-head > div {
        width: 34px;
        height: 34px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 10px;
        color:
          var(--accent-light);
        background:
          rgba(99,102,241,.1);
      }

      .stat-value {
        margin-top: 15px;
        display: block;
        font-size: 27px;
        letter-spacing: -1px;
      }

      .stat h3 {
        margin: 1px 0 4px;
        color:
          var(--text-secondary);
        font-size: 8px;
      }

      .stat p {
        margin: 0;
        color:
          var(--text-muted);
        font-size: 7px;
      }

      .section {
        padding-top: 31px;
      }

      .heading {
        margin-bottom: 13px;
      }

      .heading h2 {
        margin: 4px 0 3px;
        font-size: 17px;
      }

      .quick-grid {
        display: grid;
        grid-template-columns:
          repeat(4,minmax(0,1fr));
        gap: 10px;
      }

      .quick {
        padding: 14px;
        display: flex;
        align-items: center;
        gap: 10px;
        border:
          1px solid
          var(--border);
        border-radius: 16px;
        cursor: pointer;
        color:
          var(--text-primary);
        text-align: left;
        transition:
          transform .2s ease;
      }

      .quick:hover {
        transform:
          translateY(-2px);
      }

      .quick-blue {
        background:
          var(--card-gradient-blue);
      }

      .quick-purple {
        background:
          var(--card-gradient-purple);
      }

      .quick-green {
        background:
          var(--card-gradient-green);
      }

      .quick-orange {
        background:
          linear-gradient(
            145deg,
            rgba(180,83,9,.2),
            var(--surface)
          );
      }

      .quick > div {
        width: 37px;
        height: 37px;
        flex: 0 0 auto;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 11px;
        color:
          var(--accent-light);
        font-size: 15px;
        font-weight: 900;
        background:
          rgba(99,102,241,.1);
      }

      .quick > span {
        min-width: 0;
        flex: 1;
        display: grid;
        gap: 2px;
      }

      .quick strong {
        font-size: 9px;
      }

      .quick small {
        color:
          var(--text-muted);
        font-size: 6px;
        line-height: 1.4;
      }

      .quick b {
        color:
          var(--accent);
        font-size: 10px;
      }

      .dashboard-grid {
        padding-top: 30px;
        display: grid;
        grid-template-columns:
          repeat(2,minmax(0,1fr));
        gap: 12px;
      }

      .panel {
        padding: 17px;
        border:
          1px solid
          var(--border);
        border-radius: 19px;
        background:
          var(--surface-gradient);
        box-shadow:
          0 15px 40px
          rgba(0,0,0,.04);
      }

      .panel-head {
        margin-bottom: 13px;
        display: flex;
        align-items: center;
        justify-content:
          space-between;
        gap: 10px;
      }

      .panel-head h2 {
        margin: 4px 0 0;
        font-size: 15px;
      }

      .panel-head button {
        border: 0;
        cursor: pointer;
        color:
          var(--accent);
        font-size: 7px;
        font-weight: 800;
        background: transparent;
      }

      .member-list,
      .product-list {
        display: grid;
        gap: 6px;
      }

      .member-row,
      .product-row {
        padding: 9px;
        display: flex;
        align-items: center;
        gap: 9px;
        border:
          1px solid
          var(--border);
        border-radius: 11px;
        background:
          var(--card-gradient);
      }

      .member-info,
      .product-info {
        min-width: 0;
        flex: 1;
        display: grid;
        gap: 2px;
      }

      .member-info strong,
      .product-info strong {
        overflow: hidden;
        font-size: 8px;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .member-info span,
      .product-info span {
        color:
          var(--text-muted);
        font-size: 6px;
      }

      .status {
        padding: 5px 7px;
        border-radius: 999px;
        color:
          var(--text-muted);
        font-size: 5px;
        font-weight: 950;
        background:
          rgba(100,116,139,.1);
      }

      .status.good {
        color:
          var(--success);
        background:
          rgba(34,197,94,.1);
      }

      .product-icon {
        width: 35px;
        height: 35px;
        flex: 0 0 auto;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 11px;
        color: #fff;
        font-size: 11px;
        font-weight: 950;
      }

      .product-1 {
        background:
          linear-gradient(
            135deg,#2563eb,#7c3aed
          );
      }

      .product-2 {
        background:
          linear-gradient(
            135deg,#059669,#2563eb
          );
      }

      .product-3 {
        background:
          linear-gradient(
            135deg,#db2777,#7c3aed
          );
      }

      .product-4 {
        background:
          linear-gradient(
            135deg,#d97706,#dc2626
          );
      }

      .empty {
        min-height: 180px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        color:
          var(--text-muted);
        text-align: center;
      }

      .empty > div {
        margin-bottom: 8px;
        font-size: 25px;
      }

      .empty strong {
        color:
          var(--text-secondary);
        font-size: 9px;
      }

      .empty p {
        margin: 4px 0 0;
        font-size: 7px;
      }

      .overview-grid {
        padding-top: 12px;
        display: grid;
        grid-template-columns:
          repeat(3,minmax(0,1fr));
        gap: 11px;
      }

      .overview-card {
        min-height: 135px;
        padding: 15px;
        display: flex;
        align-items: center;
        gap: 11px;
        border:
          1px solid
          var(--border);
        border-radius: 17px;
        background:
          var(--surface-gradient);
      }

      .overview-icon {
        width: 38px;
        height: 38px;
        flex: 0 0 auto;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 12px;
        color: #93c5fd;
        background:
          rgba(37,99,235,.11);
      }

      .overview-icon.purple {
        color: #c4b5fd;
        background:
          rgba(124,58,237,.1);
      }

      .overview-icon.green {
        color:
          var(--success);
        background:
          rgba(34,197,94,.1);
      }

      .overview-card > div:nth-child(2) {
        flex: 1;
        display: grid;
        gap: 2px;
      }

      .overview-card span {
        color:
          var(--text-muted);
        font-size: 6px;
        font-weight: 900;
        letter-spacing: 1px;
      }

      .overview-card strong {
        font-size: 23px;
      }

      .overview-card p {
        margin: 0;
        color:
          var(--text-muted);
        font-size: 7px;
      }

      .mini-chart {
        height: 50px;
        display: flex;
        align-items: flex-end;
        gap: 3px;
      }

      .mini-chart i {
        width: 4px;
        border-radius: 4px;
        background:
          linear-gradient(
            180deg,#60a5fa,#7c3aed
          );
      }

      .mini-chart i:nth-child(1) {
        height: 18px;
      }

      .mini-chart i:nth-child(2) {
        height: 28px;
      }

      .mini-chart i:nth-child(3) {
        height: 23px;
      }

      .mini-chart i:nth-child(4) {
        height: 38px;
      }

      .mini-chart i:nth-child(5) {
        height: 31px;
      }

      .mini-chart i:nth-child(6) {
        height: 44px;
      }

      .mini-chart i:nth-child(7) {
        height: 36px;
      }

      .ring {
        width: 53px;
        height: 53px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        background:
          conic-gradient(
            #7c3aed 0 72%,
            rgba(99,102,241,.1)
            72% 100%
          );
      }

      .ring div {
        width: 41px;
        height: 41px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        color:
          var(--text-primary);
        font-size: 8px;
        font-weight: 900;
        background:
          var(--surface-strong);
      }

      .access-bars {
        display: grid;
        gap: 5px;
      }

      .access-bars span {
        display: block;
        height: 6px;
        border-radius: 999px;
        background:
          linear-gradient(
            90deg,#22c55e,#2563eb
          );
      }

      .access-bars span:nth-child(1) {
        width: 55px;
      }

      .access-bars span:nth-child(2) {
        width: 40px;
      }

      .access-bars span:nth-child(3) {
        width: 48px;
      }

      .super-grid {
        display: grid;
        grid-template-columns:
          repeat(3,minmax(0,1fr));
        gap: 11px;
      }

      .super-card {
        min-height: 175px;
        padding: 18px;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        border:
          1px solid
          rgba(124,58,237,.16);
        border-radius: 18px;
        cursor: pointer;
        color:
          var(--text-primary);
        text-align: left;
        background:
          linear-gradient(
            145deg,
            rgba(76,29,149,.2),
            rgba(30,64,175,.14),
            var(--surface)
          );
      }

      .super-card > div {
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 12px;
        color: #c4b5fd;
        font-size: 16px;
        background:
          rgba(124,58,237,.11);
      }

      .super-card strong {
        margin-top: 13px;
        font-size: 11px;
      }

      .super-card p {
        flex: 1;
        margin: 5px 0 13px;
        color:
          var(--text-muted);
        font-size: 7px;
        line-height: 1.5;
      }

      .super-card > span {
        color:
          var(--accent);
        font-size: 7px;
        font-weight: 850;
      }

      footer {
        margin-top: 34px;
        padding-top: 16px;
        display: flex;
        justify-content:
          space-between;
        border-top:
          1px solid
          var(--border);
        color:
          var(--text-soft);
        font-size: 6px;
      }

      .profile-overlay,
      .mobile-overlay {
        position: fixed;
        inset: 0;
        z-index: 10000;
        background:
          var(--overlay);
        backdrop-filter:
          blur(7px);
      }

      .profile-drawer {
        position: absolute;
        top: 0;
        right: 0;
        width:
          min(390px,92vw);
        height: 100%;
        overflow-y: auto;
        padding: 24px;
        border-left:
          1px solid
          var(--border);
        color:
          var(--text-primary);
        background:
          var(--page-gradient);
        box-shadow:
          var(--shadow);
      }

      .drawer-header {
        display: flex;
        align-items: center;
        justify-content:
          space-between;
      }

      .drawer-header h2 {
        margin: 4px 0 0;
        font-size: 18px;
      }

      .drawer-header button,
      .mobile-head button {
        width: 35px;
        height: 35px;
        border:
          1px solid
          var(--border);
        border-radius: 10px;
        cursor: pointer;
        color:
          var(--text-primary);
        background:
          var(--surface-gradient);
      }

      .profile-hero {
        margin-top: 24px;
        padding: 23px;
        display: flex;
        flex-direction: column;
        align-items: center;
        border:
          1px solid
          var(--border);
        border-radius: 19px;
        text-align: center;
        background:
          var(--card-gradient);
      }

      .profile-hero h3 {
        margin: 11px 0 3px;
        font-size: 15px;
      }

      .profile-hero p {
        margin: 0;
        color:
          var(--text-muted);
        font-size: 8px;
      }

      .profile-hero > span {
        margin-top: 10px;
        padding: 5px 8px;
        border-radius: 999px;
        color:
          var(--success);
        font-size: 6px;
        font-weight: 950;
        background:
          rgba(34,197,94,.1);
      }

      .profile-info {
        margin-top: 13px;
        padding: 4px 13px;
        border:
          1px solid
          var(--border);
        border-radius: 15px;
        background:
          var(--surface-gradient);
      }

      .info-row {
        padding: 11px 0;
        display: flex;
        justify-content:
          space-between;
        gap: 15px;
        border-bottom:
          1px solid
          var(--border);
      }

      .info-row:last-child {
        border-bottom: 0;
      }

      .info-row span {
        color:
          var(--text-muted);
        font-size: 7px;
      }

      .info-row strong {
        max-width: 210px;
        overflow: hidden;
        font-size: 8px;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .password-button {
        width: 100%;
        margin-top: 11px;
        padding: 12px;
        display: flex;
        justify-content:
          space-between;
        border: 0;
        border-radius: 11px;
        cursor: pointer;
        color: #fff;
        font-size: 8px;
        font-weight: 850;
        background:
          var(--primary-gradient);
      }

      .drawer-logout {
        width: 100%;
        margin-top: 8px;
        padding: 11px;
        border:
          1px solid
          rgba(239,68,68,.1);
        border-radius: 11px;
        cursor: pointer;
        color:
          var(--danger);
        font-size: 8px;
        font-weight: 850;
        background:
          rgba(127,29,29,.07);
      }

      .mobile-sidebar {
        width:
          min(300px,86vw);
        height: 100%;
        overflow-y: auto;
        padding: 19px;
        background:
          var(--surface-strong);
      }

      .mobile-head {
        display: flex;
        align-items: center;
        justify-content:
          space-between;
      }

      .mobile-sidebar .menu {
        margin-top: 30px;
      }

      .mobile-logout {
        width: 100%;
        margin-top: 25px;
        padding: 11px;
        border:
          1px solid
          rgba(239,68,68,.1);
        border-radius: 11px;
        color:
          var(--danger);
        background:
          rgba(127,29,29,.07);
      }

      .admin-loading {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background:
          var(--page-gradient);
      }

      .loading-box {
        width: 320px;
        padding: 30px;
        display: flex;
        flex-direction: column;
        align-items: center;
        border:
          1px solid
          var(--border);
        border-radius: 22px;
        text-align: center;
        background:
          var(--surface-gradient);
      }

      .logo {
        width: 48px;
        height: 48px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 15px;
        color: #fff;
        font-size: 19px;
        font-weight: 950;
        background:
          var(--primary-gradient);
      }

      .loading-box h2 {
        margin: 12px 0 3px;
      }

      .loading-box p {
        margin: 0;
        color:
          var(--text-muted);
        font-size: 8px;
      }

      .loader {
        width: 100%;
        height: 4px;
        margin-top: 18px;
        overflow: hidden;
        border-radius: 999px;
        background:
          rgba(99,102,241,.08);
      }

      .loader span {
        display: block;
        width: 40%;
        height: 100%;
        border-radius: 999px;
        background:
          var(--primary-gradient);
        animation:
          move 1s infinite ease-in-out;
      }

      @keyframes move {
        from {
          transform:
            translateX(-100%);
        }

        to {
          transform:
            translateX(250%);
        }
      }

      @media(max-width:1150px) {
        .stats,
        .quick-grid {
          grid-template-columns:
            repeat(2,minmax(0,1fr));
        }

        .overview-grid {
          grid-template-columns:
            1fr;
        }
      }

      @media(max-width:900px) {
        .admin-shell {
          display: block;
        }

        .sidebar {
          display: none;
        }

        .topbar {
          height: 67px;
          padding:
            0 145px 0 15px;
        }

        .mobile-brand {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .mobile-menu {
          width: 35px;
          height: 35px;
          border:
            1px solid
            var(--border);
          border-radius: 10px;
          color:
            var(--text-primary);
          background:
            var(--surface-gradient);
        }

        .mobile-brand strong {
          font-size: 11px;
        }

        .search {
          flex: 1;
          width: auto;
        }

        .profile-button > span {
          display: none;
        }

        .content {
          padding:
            24px 16px 45px;
        }

        .super-grid {
          grid-template-columns:
            1fr;
        }
      }

      @media(max-width:650px) {
        .topbar {
          padding:
            0 12px;
        }

        .admin-shell
        .theme-switcher {
          position: fixed;
          top: auto;
          right: 12px;
          bottom: 12px;
        }

        .mobile-brand strong {
          display: none;
        }

        .notification {
          display: none;
        }

        .system-status {
          display: none;
        }

        .welcome h1 {
          font-size: 27px;
        }

        .stats,
        .quick-grid,
        .dashboard-grid {
          grid-template-columns:
            1fr;
        }

        .overview-grid {
          grid-template-columns:
            1fr;
        }

        footer {
          flex-direction: column;
          gap: 5px;
        }
      }


      /* =====================================================
         READABILITY UPGRADE — ADMIN / SUPER ADMIN
         ===================================================== */
      .admin-shell { grid-template-columns: 270px minmax(0, 1fr) !important; }
      .sidebar {
        padding: 24px 18px 18px !important;
        overflow-y: auto !important;
        overflow-x: hidden !important;
        overscroll-behavior: contain;
        scrollbar-gutter: stable;
      }
      .sidebar > div:first-child { flex: 0 0 auto; }
      .sidebar-bottom { flex: 0 0 auto; margin-top: 18px; padding-bottom: 4px; }
      .brand strong { font-size: 17px !important; line-height: 1.15 !important; }
      .brand small, .brand span { font-size: 10.5px !important; line-height: 1.35 !important; }
      .role-card span { font-size: 10px !important; letter-spacing: .14em !important; }
      .role-card strong { font-size: 13px !important; }
      .menu-label { font-size: 10px !important; letter-spacing: .15em !important; }
      .menu-item, .nav-item { font-size: 13px !important; font-weight: 750 !important; min-height: 44px !important; }
      .sidebar-profile strong { font-size: 12.5px !important; }
      .sidebar-profile small { font-size: 10.5px !important; }
      .logout, .mobile-logout { font-size: 12.5px !important; }
      .search input { font-size: 13.5px !important; }
      .profile-button strong { font-size: 12px !important; }
      .profile-button small { font-size: 10px !important; }
      .eyebrow { font-size: 10.5px !important; letter-spacing: .16em !important; }
      .welcome h1 { font-size: clamp(34px, 3vw, 48px) !important; line-height: 1.08 !important; }
      .welcome p { font-size: 13.5px !important; line-height: 1.7 !important; }
      .system-status .online { font-size: 10px !important; }
      .system-status strong { font-size: 11.5px !important; }
      .stat-card .label, .stat-label { font-size: 11.5px !important; }
      .stat-card .value, .stat-value { font-size: 30px !important; line-height: 1 !important; }
      .stat-card .note, .stat-note { font-size: 11px !important; line-height: 1.45 !important; }
      .section-heading h2, .heading h2 { font-size: 23px !important; }
      .section-heading p, .heading p { font-size: 12.5px !important; line-height: 1.6 !important; }
      .quick-card strong, .quick strong { font-size: 13px !important; }
      .quick-card small, .quick small { font-size: 11px !important; line-height: 1.45 !important; }
      .panel h3, .card-title { font-size: 18px !important; }
      .panel-header a, .panel-header button { font-size: 11px !important; }
      .list-item strong, .member-row strong, .product-row strong { font-size: 12.5px !important; }
      .list-item small, .member-row small, .product-row small { font-size: 10.5px !important; }
      .status, .badge { font-size: 9.5px !important; }
      .metric-label { font-size: 10px !important; }
      .metric-value { font-size: 25px !important; }
      .metric-note { font-size: 11px !important; }
      .warning { font-size: 12px !important; line-height: 1.55 !important; }

      @media (max-width: 900px) {
        .admin-shell { grid-template-columns: 1fr !important; }
        .welcome h1 { font-size: 32px !important; }
        .search input { font-size: 14px !important; }
      }



      /* ======================================================
         PROFILE MODAL — CENTERED / PROFESSIONAL / READABLE
         ====================================================== */
      .profile-overlay {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        padding: 24px !important;
        background: rgba(2, 6, 23, .56) !important;
        backdrop-filter: blur(12px) !important;
        -webkit-backdrop-filter: blur(12px) !important;
      }

      .profile-drawer {
        position: relative !important;
        top: auto !important;
        right: auto !important;
        width: min(560px, calc(100vw - 48px)) !important;
        height: auto !important;
        max-height: calc(100vh - 48px) !important;
        overflow-y: auto !important;
        padding: 28px !important;
        border: 1px solid var(--border-strong) !important;
        border-radius: 26px !important;
        color: var(--text-primary) !important;
        background: var(--page-gradient) !important;
        box-shadow: 0 35px 100px rgba(2, 6, 23, .30) !important;
        animation: profileModalIn .22s ease-out !important;
      }

      @keyframes profileModalIn {
        from { opacity: 0; transform: translateY(12px) scale(.975); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }

      .drawer-header { gap: 20px !important; }
      .drawer-header .eyebrow { font-size: 11px !important; letter-spacing: 1.4px !important; }
      .drawer-header h2 { margin: 5px 0 0 !important; font-size: 23px !important; line-height: 1.2 !important; }
      .drawer-header button { width: 42px !important; height: 42px !important; flex: 0 0 auto !important; border-radius: 13px !important; font-size: 20px !important; }

      .profile-drawer .profile-hero {
        margin-top: 22px !important;
        padding: 25px 22px !important;
        border-radius: 21px !important;
      }
      .profile-drawer .avatar.avatar-large { width: 72px !important; height: 72px !important; border-radius: 22px !important; font-size: 22px !important; }
      .profile-drawer .profile-hero h3 { margin: 14px 0 5px !important; font-size: 18px !important; line-height: 1.3 !important; }
      .profile-drawer .profile-hero p { font-size: 13px !important; line-height: 1.5 !important; color: var(--text-muted) !important; }
      .profile-drawer .profile-hero > span { margin-top: 12px !important; padding: 7px 11px !important; font-size: 10px !important; letter-spacing: .8px !important; }

      .profile-drawer .profile-info { margin-top: 16px !important; padding: 5px 17px !important; border-radius: 18px !important; }
      .profile-drawer .info-row { min-height: 50px !important; padding: 13px 0 !important; align-items: center !important; }
      .profile-drawer .info-row span { font-size: 13px !important; }
      .profile-drawer .info-row strong { max-width: 330px !important; font-size: 13px !important; line-height: 1.4 !important; }

      .profile-drawer .password-button,
      .profile-drawer .drawer-logout {
        min-height: 48px !important;
        padding: 13px 16px !important;
        border-radius: 13px !important;
        font-size: 13.5px !important;
      }
      .profile-drawer .password-button { margin-top: 16px !important; }
      .profile-drawer .drawer-logout { margin-top: 9px !important; }

      @media (max-width: 620px) {
        .profile-overlay { padding: 14px !important; align-items: center !important; }
        .profile-drawer {
          width: 100% !important;
          max-height: calc(100vh - 28px) !important;
          padding: 21px !important;
          border-radius: 22px !important;
        }
        .drawer-header h2 { font-size: 21px !important; }
        .profile-drawer .profile-hero { padding: 21px 16px !important; }
        .profile-drawer .profile-hero p { max-width: 100% !important; overflow-wrap: anywhere !important; }
        .profile-drawer .info-row { align-items: flex-start !important; flex-direction: column !important; gap: 5px !important; }
        .profile-drawer .info-row strong { max-width: 100% !important; white-space: normal !important; overflow-wrap: anywhere !important; }
      }
    

.content{margin-left:0;min-height:100vh;padding:28px 24px 70px;min-width:0}
@media(max-width:1100px){.content{padding:24px 24px 60px}}
@media(max-width:760px){.content{margin-left:0;padding:24px 14px 45px}}

*{box-sizing:border-box}.brand,.account{border:0;background:transparent;color:#fff;display:flex;align-items:center;gap:10px;text-align:left;cursor:pointer;width:100%}header{display:flex;justify-content:space-between;gap:20px;margin-bottom:23px}.eyebrow{font-size:10px;font-weight:800;letter-spacing:.12em;color:#7c5cff}h1{font-size:26px;margin:5px 0 7px}header p,.panelHead p{font-size:13px;color:#7b849c;margin:0}.refresh{border:1px solid #e2e5ed;background:#fff;border-radius:10px;padding:10px 13px;font-size:12px;font-weight:700;cursor:pointer}.error{display:flex;justify-content:space-between;background:#fff0f2;border:1px solid #ffd9de;color:#b94755;border-radius:12px;padding:10px 13px;margin-bottom:14px;font-size:11px}.error button{border:0;background:transparent;color:inherit;font-size:18px}.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:13px;margin-bottom:15px}.stat{min-height:112px;border:1px solid rgba(124,92,255,.12);border-radius:16px;padding:17px;display:flex;gap:13px;box-shadow:0 14px 34px rgba(72,77,120,.055)}.statBlue{background:linear-gradient(135deg,#eef5ff 0%,#f8fbff 52%,#f1efff 100%)}.statPurple{background:linear-gradient(135deg,#f5efff 0%,#fbf8ff 55%,#eeeaff 100%)}.statMint{background:linear-gradient(135deg,#eafff5 0%,#f5fffb 52%,#edf5ff 100%)}.stat>span{width:38px;height:38px;border-radius:12px;background:linear-gradient(135deg,#765cff18,#32c6ff22);color:#6b58e8;display:grid;place-items:center;font-weight:900}.stat small{font-size:10px;color:#7d869d}.stat strong{display:block;font-size:19px;margin:4px 0}.stat p{font-size:10px;color:#9aa2b4;margin:0}.panel{background:linear-gradient(145deg,#ffffff 0%,#fbfbff 52%,#f7f3ff 100%);border:1px solid rgba(124,92,255,.12);border-radius:18px;overflow:hidden;box-shadow:0 16px 40px rgba(72,77,120,.05)}.panelHead{padding:19px 20px 14px}.panelHead h2{font-size:17px;margin:4px 0}.filters{padding:13px 20px;border-top:1px solid rgba(124,92,255,.08);border-bottom:1px solid rgba(124,92,255,.08);display:flex;gap:8px;background:rgba(255,255,255,.46)}.search{flex:1;display:flex;border:1px solid #dfe3ed;border-radius:10px;overflow:hidden}.search span{padding:10px;color:#929bad}.search input{flex:1;border:0;outline:0;font-size:12px}.search button{border:0;background:#eef0f7;padding:0 13px;font-size:11px;font-weight:700}.filters select{border:1px solid #dfe3ed;background:#fff;border-radius:10px;padding:0 10px;font-size:11px}.clear{border:0;border-radius:10px;background:#fff1f2;color:#d85a67;padding:8px 10px;font-size:11px}.tableWrap{overflow-x:auto}table{width:100%;border-collapse:collapse;min-width:1050px}th{padding:11px 14px;background:linear-gradient(90deg,#f8f9ff,#fbfbff);color:#9098aa;font-size:9px;letter-spacing:.08em;text-align:left}td{padding:13px 14px;border-top:1px solid #f0f1f5;font-size:11px;vertical-align:middle}td strong,td small{display:block}td small{font-size:9px;color:#8c95a9;margin-top:2px}.order{border:0;background:transparent;color:#6656d9;font-weight:800;font-size:11px;padding:0;cursor:pointer}.badge{display:inline-flex;padding:5px 8px;border-radius:20px;font-size:9px;font-weight:800}.good{background:#e8f8ef;color:#228653}.warn{background:#fff5dc;color:#b17a0a}.bad{background:#ffeaed;color:#c94f5c}.info{background:#eaf1ff;color:#4d70bd}.view{border:0;background:#f1efff;color:#6858d5;border-radius:8px;padding:7px 9px;font-size:9px;font-weight:800;cursor:pointer}.empty{padding:35px;text-align:center;color:#8d96aa;font-size:11px}.pagination{display:flex;justify-content:space-between;align-items:center;padding:13px 20px;color:#8a93a7;font-size:10px}.pagination div{display:flex;gap:9px;align-items:center}.pagination button{border:1px solid #e0e3ec;background:#fff;border-radius:8px;padding:7px 9px;font-size:10px}.pagination button:disabled{opacity:.4}.backdrop{position:fixed;inset:0;background:#10172b88;z-index:100;display:flex;justify-content:flex-end}.drawer{width:min(520px,94vw);height:100%;background:#f8f9fc;overflow-y:auto}.drawerHead{position:sticky;top:0;background:#fff;padding:19px 20px;border-bottom:1px solid #e8eaf0;display:flex;justify-content:space-between}.drawerHead h2{font-size:18px;margin:4px 0}.drawerHead p{font-size:9px;color:#929aac}.drawerHead button{border:0;background:#f1f2f6;width:31px;height:31px;border-radius:9px;font-size:20px}.drawerBody{padding:16px}.total{background:linear-gradient(135deg,#6352d9,#378de9);color:#fff;padding:17px;border-radius:15px;margin-bottom:12px}.total span,.total strong,.total small{display:block}.total span,.total small{font-size:10px;opacity:.75}.total strong{font-size:24px;margin:4px 0}.drawerBody section{background:#fff;border:1px solid #e7e9f0;border-radius:14px;padding:14px;margin-bottom:10px}.drawerBody h3{font-size:12px;margin:0 0 10px}.drawerBody p{font-size:10px;color:#68738a;line-height:1.6}.proof{display:block;text-decoration:none;background:#f1efff;color:#6555d5;border-radius:9px;padding:10px;font-size:11px;font-weight:800}.drawerBody textarea{width:100%;min-height:90px;border:1px solid #dfe3ed;border-radius:10px;padding:10px;font:inherit;font-size:11px;resize:vertical}.actions{display:flex;gap:8px;margin-top:10px}.actions button{flex:1;border:0;border-radius:10px;padding:10px;font-size:11px;font-weight:800}.reject{background:#ffeaed;color:#c94f5c}.approve{background:linear-gradient(135deg,#6d58e8,#398eea);color:#fff}.loading{min-height:100vh;display:grid;place-items:center;background:#f5f7fb}.loading>div{background:#fff;border:1px solid #e5e8f0;border-radius:18px;padding:22px;display:grid;gap:5px}.loading b{width:36px;height:36px;border-radius:11px;display:grid;place-items:center;color:#fff;background:linear-gradient(135deg,#7c5cff,#32c6ff)}.loading span{font-size:9px;color:#725be6;font-weight:800}.loading strong{font-size:14px}@media(max-width:900px){.stats{grid-template-columns:1fr}}@media(max-width:760px){.filters{flex-wrap:wrap}.search{flex-basis:100%}.filters select{height:36px;flex:1}.pagination>span{display:none}header{display:block}.refresh{margin-top:12px}}

.aff-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:20px}
.aff-head h1{font-size:26px;line-height:1.15;margin:6px 0;color:#111827}.aff-head p{margin:0;color:#778198;font-size:13px}
.aff-kicker{font-size:10px;font-weight:900;letter-spacing:1.4px;color:#6657ef}
.aff-refresh{height:44px;padding:0 16px;border:1px solid #e5e7ef;border-radius:12px;background:#fff;font-size:12px;font-weight:800;cursor:pointer}
.aff-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:13px;margin-bottom:15px}
.aff-stat{min-height:112px;border:1px solid rgba(124,92,255,.12);border-radius:16px;padding:17px;display:flex;gap:13px;box-shadow:0 14px 34px rgba(72,77,120,.055)}
.aff-stat.blue{background:linear-gradient(135deg,#eef5ff,#f8fbff 52%,#f1efff)}.aff-stat.purple{background:linear-gradient(135deg,#f5efff,#fbf8ff 55%,#eeeaff)}.aff-stat.mint{background:linear-gradient(135deg,#eafff5,#f5fffb 52%,#edf5ff)}.aff-stat.pink{background:linear-gradient(135deg,#fff0f8,#fff8fc 52%,#f4efff)}
.aff-stat>span{width:38px;height:38px;border-radius:12px;background:rgba(255,255,255,.65);display:grid;place-items:center;color:#6758ea;font-weight:900}.aff-stat small{font-size:10px;color:#7d869d}.aff-stat strong{display:block;font-size:19px;margin:4px 0}.aff-stat p{font-size:10px;color:#9aa2b4;margin:0}
.aff-grid{display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-bottom:15px}.aff-card,.aff-table-card{background:linear-gradient(145deg,#fff,#fbfbff 52%,#f7f3ff);border:1px solid rgba(124,92,255,.12);border-radius:18px;overflow:hidden;box-shadow:0 16px 40px rgba(72,77,120,.05)}
.aff-card-head,.aff-table-head{padding:18px 20px 14px;border-bottom:1px solid rgba(124,92,255,.08)}.aff-card-head h2,.aff-table-head h2{font-size:16px;margin:4px 0 3px}.aff-card-head p,.aff-table-head p{font-size:11px;color:#8a93a8;margin:0}.aff-body{padding:18px 20px}
.aff-form{display:grid;grid-template-columns:1fr 1fr;gap:12px}.aff-field{display:flex;flex-direction:column;gap:6px}.aff-field.full{grid-column:1/-1}.aff-field label{font-size:11px;font-weight:800;color:#59647a}.aff-field input,.aff-field select{height:40px;border:1px solid #e1e5ef;border-radius:10px;background:rgba(255,255,255,.8);padding:0 11px;font-size:12px}
.aff-switch{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:11px 12px;border:1px solid #e7e9f2;border-radius:12px;background:rgba(255,255,255,.56)}.aff-switch b{font-size:12px}.aff-switch small{display:block;font-size:10px;color:#929aab;margin-top:2px}.aff-switch input{width:18px;height:18px;accent-color:#6b5bf1}
.aff-save{margin-top:14px;display:flex;justify-content:flex-end}.aff-primary{height:40px;border:0;border-radius:10px;padding:0 16px;background:linear-gradient(135deg,#6757ef,#7958ff);color:#fff;font-size:12px;font-weight:900;cursor:pointer}.aff-primary:disabled{opacity:.55}
.aff-summary{display:grid;gap:10px}.aff-summary div{display:flex;justify-content:space-between;gap:12px;padding:12px;border:1px solid #e7e9f2;border-radius:12px;background:rgba(255,255,255,.58)}.aff-summary span{font-size:11px;color:#7e879b}.aff-summary strong{font-size:12px;text-align:right}
.aff-filters{padding:12px 20px;border-bottom:1px solid rgba(124,92,255,.08);display:flex;gap:8px;background:rgba(255,255,255,.46)}.aff-search{display:flex;flex:1;height:40px;border:1px solid #dfe4ef;border-radius:10px;overflow:hidden;background:#fff}.aff-search input{border:0;outline:0;flex:1;padding:0 12px;font-size:12px}.aff-search button{border:0;border-left:1px solid #e6e8ef;background:#f7f8fb;padding:0 15px;font-size:11px;font-weight:800}.aff-filters select{height:40px;border:1px solid #dfe4ef;border-radius:10px;background:#fff;padding:0 10px;font-size:11px}
.aff-table-wrap{overflow:auto}.aff-table{width:100%;border-collapse:collapse;min-width:900px}.aff-table th{padding:11px 14px;background:linear-gradient(90deg,#f8f9ff,#fbfbff);text-align:left;font-size:9px;letter-spacing:.7px;color:#7e879a}.aff-table td{padding:12px 14px;border-top:1px solid #f0f1f5;font-size:11px;color:#4f596d}.aff-person strong{display:block;font-size:12px;color:#20283a}.aff-person small{display:block;font-size:10px;color:#929aac;margin-top:2px}
.aff-badge{display:inline-flex;border-radius:999px;padding:5px 8px;font-size:9px;font-weight:900;text-transform:uppercase}.aff-badge.active{background:#e7faef;color:#15834b}.aff-badge.pending{background:#fff6d9;color:#a06c00}.aff-badge.suspended,.aff-badge.rejected{background:#ffe8ec;color:#c73a52}.aff-status{height:32px;border:1px solid #e1e4ed;border-radius:8px;background:#fff;font-size:10px;padding:0 7px}
.aff-empty{padding:55px 20px;text-align:center;color:#9aa2b4;font-size:11px}.aff-pagination{display:flex;justify-content:space-between;align-items:center;padding:13px 20px;border-top:1px solid #f0f1f5;font-size:10px;color:#8992a5}.aff-pages{display:flex;align-items:center;gap:8px}.aff-pages button{height:32px;padding:0 10px;border:1px solid #e5e8f0;border-radius:8px;background:#fff;font-size:10px}.aff-pages button:disabled{opacity:.4}
.aff-alert{margin-bottom:14px;padding:11px 13px;border-radius:11px;font-size:11px}.aff-alert.error{border:1px solid #ffd7de;background:#fff1f4;color:#b6344c}.aff-alert.ok{border:1px solid #ccefdc;background:#effcf5;color:#24764d}
@media(max-width:1180px){.aff-stats{grid-template-columns:repeat(2,1fr)}.aff-grid{grid-template-columns:1fr}}@media(max-width:760px){.aff-head{flex-direction:column}.aff-stats{grid-template-columns:1fr}.aff-form{grid-template-columns:1fr}.aff-field.full{grid-column:auto}.aff-filters{flex-direction:column}}

      /* ADMIN SIDEBAR MENU STANDARD — reference: app/admin/page.tsx */
      .sidebar nav p,
      .sidebar .menu-title{
        font-size:9px !important;
        line-height:1.2 !important;
        font-weight:900 !important;
        letter-spacing:.14em !important;
      }
      .sidebar nav button,
      .sidebar .menu-item{
        font-size:13px !important;
        line-height:1.2 !important;
        font-weight:700 !important;
      }
      .sidebar .menu-item i{
        font-size:12px !important;
      }
`}</style>
</div>
}

function Brand() {
  return (
    <div className="brand">
      <div className="brand-logo">
        S
      </div>

      <div>
        <strong>
          iMersSUPA
        </strong>

        <span>
          ADMIN CONTROL
        </span>
      </div>
    </div>
  )
}


function Menu({
  isSuperAdmin,
  router,
  onNavigate,
  onProfile,
}: {
  isSuperAdmin: boolean
  router: ReturnType<typeof useRouter>
  onNavigate?: () => void
  onProfile?: () => void
}) {
  function go(path: string) {
    onNavigate?.()
    router.push(path)
  }

  return (
    <nav className="menu">

      <div className="menu-title">
        MAIN MENU
      </div>

      <button
        className="menu-item"
        onClick={() =>
          go('/admin')
        }
      >
        <i>⌂</i>
        Dashboard
      </button>

      <button
        className="menu-item"
        onClick={() =>
          go('/admin/members')
        }
      >
        <i>◎</i>
        Members
      </button>

      <button
        className="menu-item"
        onClick={() =>
          go('/admin/products')
        }
      >
        <i>▣</i>
        Products
      </button>

      <button
        className="menu-item"
        onClick={() =>
          go('/admin/content')
        }
      >
        <i>▶</i>
        Content
      </button>

      <button
        className="menu-item"
        onClick={() =>
          go('/admin/access')
        }
      >
        <i>◇</i>
        Member Access
      </button>

      <button
        className="menu-item"
        onClick={() =>
          go('/admin/progress')
        }
      >
        <i>↗</i>
        Progress
      </button>

      <button
        className="menu-item"
        onClick={() =>
          go('/admin/resources')
        }
      >
        <i>◆</i>
        Resources
      </button>

      <div className="menu-title second">
        COMMERCE
      </div>

      <button
        className="menu-item"
        onClick={() =>
          go('/admin/orders')
        }
      >
        <i>▤</i>
        Orders & Transactions
      </button>

      <button
        className="menu-item"
        onClick={() =>
          go('/admin/payments')
        }
      >
        <i>◫</i>
        Payments
      </button>

      <button
        className="menu-item active"
        onClick={() =>
          go('/admin/affiliates')
        }
      >
        <i>⌘</i>
        Affiliate & Coupons
      </button>

      <button
        className="menu-item"
        onClick={() =>
          go('/admin/notifications')
        }
      >
        <i>◌</i>
        Notifications
      </button>

      {isSuperAdmin && (
        <>
          <div className="menu-title second">
            SUPER ADMIN
          </div>

          <button
            className="menu-item"
            onClick={() =>
              go(
                '/admin/administrators'
              )
            }
          >
            <i>♛</i>
            Administrators
          </button>

          <button
            className="menu-item"
            onClick={() =>
              go('/admin/settings')
            }
          >
            <i>⚙</i>
            System Settings
          </button>

          <button
            className="menu-item"
            onClick={() =>
              go('/admin/settings/commerce')
            }
          >
            <i>◈</i>
            Commerce Settings
          </button>

          <button
            className="menu-item"
            onClick={() =>
              go('/admin/security')
            }
          >
            <i>◇</i>
            Security / Audit
          </button>
        </>
      )}

      <div className="menu-title second">
        ACCOUNT
      </div>

      <button
        className="menu-item"
        onClick={() => {
          onNavigate?.()
          onProfile?.()
        }}
      >
        <i>◉</i>
        Profile
      </button>

    </nav>
  )
}

function Avatar({
  url,
  initials,
  large = false,
}: {
  url?: string | null
  initials: string
  large?: boolean
}) {
  return (
    <div
      className={
        large
          ? 'avatar avatar-large'
          : 'avatar'
      }
    >
      {url ? (
        <img
          src={url}
          alt="Avatar"
        />
      ) : (
        initials
      )}
    </div>
  )
}


function Info({k,v}:{k:string;v:string}){return <div style={{display:'flex',justifyContent:'space-between',gap:15,padding:'7px 0',borderBottom:'1px dashed #edf0f4',fontSize:10}}><span style={{color:'#8b94a8'}}>{k}</span><strong style={{textAlign:'right',color:'#4b566c',maxWidth:'65%',wordBreak:'break-word'}}>{v}</strong></div>}
