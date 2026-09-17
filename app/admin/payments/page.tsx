'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'

type Profile={id:string;full_name:string|null;avatar_url:string|null;role:string|null;status:string|null}
type OrderMini={id:string;order_number:string;buyer_name:string|null;buyer_email:string|null;grand_total:number|null}
type PaymentRow={id:string;order_id:string;payment_method_name_snapshot:string;payment_method_code_snapshot:string;payment_method_type_snapshot:string;base_amount:number;fee_amount:number;amount_due:number;status:string;provider_reference:string|null;proof_url:string|null;payer_name:string|null;payer_account:string|null;payer_note:string|null;submitted_at:string|null;verified_at:string|null;rejection_reason:string|null;created_at:string;orders:OrderMini|null}

const money=(v:number|null|undefined)=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(v||0))
const dateTime=(v:string|null)=>v?new Intl.DateTimeFormat('id-ID',{dateStyle:'medium',timeStyle:'short'}).format(new Date(v)):'—'
const label=(v:string)=>v.replaceAll('_',' ').replace(/\b\w/g,m=>m.toUpperCase())
const badge=(v:string)=>['paid'].includes(v)?'good':['waiting_verification','pending'].includes(v)?'warn':['rejected','failed','cancelled','expired','refunded'].includes(v)?'bad':'info'

export default function AdminPaymentsPage(){
 const router=useRouter()
 const [profile,setProfile]=useState<Profile|null>(null); const [email,setEmail]=useState('')
 const [rows,setRows]=useState<PaymentRow[]>([]); const [loading,setLoading]=useState(true); const [listLoading,setListLoading]=useState(false); const [error,setError]=useState('')
 const [searchInput,setSearchInput]=useState(''); const [search,setSearch]=useState(''); const [status,setStatus]=useState(''); const [page,setPage]=useState(1); const [pageSize,setPageSize]=useState(25); const [total,setTotal]=useState(0)
 const [selected,setSelected]=useState<PaymentRow|null>(null); const [reviewNote,setReviewNote]=useState(''); const [actionLoading,setActionLoading]=useState(false)

 useEffect(()=>{(async()=>{const {data:{user}}=await supabase.auth.getUser(); if(!user){router.replace('/login');return} setEmail(user.email||''); const {data,error:e}=await supabase.from('profiles').select('id,full_name,avatar_url,role,status').eq('id',user.id).single(); if(e||!data||!['admin','super_admin'].includes(data.role||'')){router.replace('/member');return} setProfile(data as Profile); setLoading(false)})()},[router])

 const loadData=useCallback(async()=>{if(!profile)return; setListLoading(true);setError(''); const from=(page-1)*pageSize,to=from+pageSize-1
  let q=supabase.from('payment_transactions').select('id,order_id,payment_method_name_snapshot,payment_method_code_snapshot,payment_method_type_snapshot,base_amount,fee_amount,amount_due,status,provider_reference,proof_url,payer_name,payer_account,payer_note,submitted_at,verified_at,rejection_reason,created_at,orders!payment_transactions_order_id_fkey(id,order_number,buyer_name,buyer_email,grand_total)',{count:'exact'}).order('created_at',{ascending:false}).range(from,to)
  if(status)q=q.eq('status',status)
  if(search.trim()){const s=search.trim().replaceAll(',',' ');q=q.or(`payer_name.ilike.%${s}%,payer_account.ilike.%${s}%,payment_method_name_snapshot.ilike.%${s}%,provider_reference.ilike.%${s}%`)}
  const {data,error:e,count}=await q
  if(e)setError(e.message); else {setRows((data||[]) as unknown as PaymentRow[]);setTotal(count||0)} setListLoading(false)
 },[profile,page,pageSize,status,search])
 useEffect(()=>{void loadData()},[loadData])

 const pages=Math.max(1,Math.ceil(total/pageSize)); const start=total?((page-1)*pageSize)+1:0; const end=Math.min(page*pageSize,total)
 const waiting=useMemo(()=>rows.filter(r=>r.status==='waiting_verification').length,[rows])
 const amount=useMemo(()=>rows.reduce((n,r)=>n+Number(r.amount_due||0),0),[rows])
 const submitSearch=(e:React.FormEvent)=>{e.preventDefault();setPage(1);setSearch(searchInput)}
 const review=async(approve:boolean)=>{if(!selected)return;if(!approve&&!reviewNote.trim()){setError('Alasan penolakan wajib diisi.');return} setActionLoading(true);setError(''); const {error:e}=await supabase.rpc('admin_review_payment_operation',{p_payment_transaction_id:selected.id,p_approve:approve,p_note:reviewNote.trim()||null}); if(e)setError(e.message); else {setSelected(null);setReviewNote('');await loadData()} setActionLoading(false)}
 const logout=async()=>{await supabase.auth.signOut();router.replace('/login')}
 if(loading)return <div className="loading"><div><b>iS</b><span>PAYMENT MANAGEMENT</span><strong>Menyiapkan data pembayaran...</strong></div></div>

 const isSuperAdmin=profile?.role==='super_admin'
 const displayName=profile?.full_name?.trim()||email.split('@')[0]||'Administrator'
 const initials=displayName.split(' ').filter(Boolean).slice(0,2).map(x=>x[0]?.toUpperCase()).join('')||'A'

 return <div className="shell">
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
                setProfileOpen(true)
              }
            />
          </div>

          <div className="sidebar-bottom">

            <button
              className="sidebar-profile"
              onClick={() =>
                setProfileOpen(true)
              }
            >
              <Avatar
                url={
                  currentUser
                    ?.avatar_url
                }
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
            MOBILE SIDEBAR
        ========================================= */}

        {sidebarOpen && (
          <div
            className="mobile-overlay"
            onClick={() =>
              setSidebarOpen(false)
            }
          >
            <aside
              className="mobile-sidebar"
              onClick={(event) =>
                event.stopPropagation()
              }
            >
              <div className="mobile-head">
                <Brand />

                <button
                  onClick={() =>
                    setSidebarOpen(
                      false
                    )
                  }
                >
                  ×
                </button>
              </div>

              <Menu
                isSuperAdmin={
                  isSuperAdmin
                }
                router={router}
                onNavigate={() =>
                  setSidebarOpen(
                    false
                  )
                }
              />

              <button
                className="mobile-logout"
                onClick={logout}
              >
                Keluar dari Akun
              </button>
            </aside>
          </div>
        )}

        {/* =========================================
            CONTENT
        ========================================= */}

  <main className="content"><header><div><span className="eyebrow">COMMERCE / PAYMENTS</span><h1>Payment Management</h1><p>Kelola transaksi pembayaran dan verifikasi bukti pembayaran pelanggan.</p></div><button className="refresh" onClick={()=>void loadData()} disabled={listLoading}>↻ Refresh</button></header>
  {error&&<div className="error"><span>⚠ {error}</span><button onClick={()=>setError('')}>×</button></div>}
  <section className="stats"><div className="stat"><span>◉</span><div><small>DATA DITEMUKAN</small><strong>{total.toLocaleString('id-ID')}</strong><p>Sesuai filter aktif</p></div></div><div className="stat"><span>⌛</span><div><small>WAITING DI HALAMAN INI</small><strong>{waiting}</strong><p>Perlu verifikasi admin</p></div></div><div className="stat"><span>Rp</span><div><small>NOMINAL HALAMAN INI</small><strong>{money(amount)}</strong><p>{start}–{end} dari {total}</p></div></div></section>
  <section className="panel"><div className="panelHead"><div><span className="eyebrow">TRANSACTIONS</span><h2>Payment Transactions</h2><p>Search, filter, dan pagination aktif sejak awal.</p></div></div>
   <div className="filters"><form className="search" onSubmit={submitSearch}><span>⌕</span><input value={searchInput} onChange={e=>setSearchInput(e.target.value)} placeholder="Cari nama pembayar, rekening, metode, reference..."/><button>Search</button></form><select value={status} onChange={e=>{setStatus(e.target.value);setPage(1)}}><option value="">All Status</option><option value="waiting_verification">Waiting Verification</option><option value="pending">Pending</option><option value="paid">Paid</option><option value="rejected">Rejected</option><option value="failed">Failed</option><option value="cancelled">Cancelled</option><option value="expired">Expired</option><option value="refunded">Refunded</option></select><select value={pageSize} onChange={e=>{setPageSize(Number(e.target.value));setPage(1)}}><option value={10}>10 / page</option><option value={25}>25 / page</option><option value={50}>50 / page</option><option value={100}>100 / page</option></select>{(search||status)&&<button className="clear" onClick={()=>{setSearch('');setSearchInput('');setStatus('');setPage(1)}}>Clear</button>}</div>
   <div className="tableWrap"><table><thead><tr><th>ORDER</th><th>CUSTOMER / PAYER</th><th>METHOD</th><th>AMOUNT</th><th>STATUS</th><th>SUBMITTED</th><th>ACTION</th></tr></thead><tbody>{!listLoading&&rows.map(r=><tr key={r.id}><td><button className="order" onClick={()=>router.push(`/admin/orders?order=${r.order_id}`)}>{r.orders?.order_number||r.order_id.slice(0,8)}</button><small>{r.provider_reference||'No reference'}</small></td><td><strong>{r.orders?.buyer_name||r.payer_name||'—'}</strong><small>{r.orders?.buyer_email||r.payer_account||'—'}</small></td><td><strong>{r.payment_method_name_snapshot}</strong><small>{label(r.payment_method_type_snapshot)}</small></td><td><strong>{money(r.amount_due)}</strong><small>Fee {money(r.fee_amount)}</small></td><td><span className={`badge ${badge(r.status)}`}>{label(r.status)}</span></td><td><strong>{dateTime(r.submitted_at||r.created_at)}</strong><small>{r.verified_at?`Verified ${dateTime(r.verified_at)}`:' '}</small></td><td><button className="view" onClick={()=>{setSelected(r);setReviewNote('')}}>{r.status==='waiting_verification'?'Verify':'Detail'}</button></td></tr>)}</tbody></table>{listLoading&&<div className="empty">Loading payment transactions...</div>}{!listLoading&&!rows.length&&<div className="empty">Belum ada transaksi yang sesuai filter.</div>}</div>
   <div className="pagination"><span>Menampilkan <b>{start}–{end}</b> dari <b>{total.toLocaleString('id-ID')}</b> data</span><div><button disabled={page<=1||listLoading} onClick={()=>setPage(p=>p-1)}>← Previous</button><b>Page {page} / {pages}</b><button disabled={page>=pages||listLoading} onClick={()=>setPage(p=>p+1)}>Next →</button></div></div>
  </section></main>
  {selected&&<div className="backdrop" onClick={()=>!actionLoading&&setSelected(null)}><aside className="drawer" onClick={e=>e.stopPropagation()}><div className="drawerHead"><div><span className="eyebrow">PAYMENT DETAIL</span><h2>{selected.orders?.order_number||'Payment'}</h2><p>{selected.id}</p></div><button disabled={actionLoading} onClick={()=>setSelected(null)}>×</button></div><div className="drawerBody"><div className="total"><span>Amount Due</span><strong>{money(selected.amount_due)}</strong><small>{selected.payment_method_name_snapshot}</small></div><section><h3>Payment Information</h3><Info k="Status" v={label(selected.status)}/><Info k="Buyer" v={selected.orders?.buyer_name||'—'}/><Info k="Email" v={selected.orders?.buyer_email||'—'}/><Info k="Payer" v={selected.payer_name||'—'}/><Info k="Account" v={selected.payer_account||'—'}/><Info k="Reference" v={selected.provider_reference||'—'}/><Info k="Submitted" v={dateTime(selected.submitted_at)}/></section>{selected.payer_note&&<section><h3>Payer Note</h3><p>{selected.payer_note}</p></section>}{selected.proof_url&&<section><h3>Payment Proof</h3><a className="proof" href={selected.proof_url} target="_blank" rel="noreferrer">Open payment proof ↗</a></section>}{selected.rejection_reason&&<section><h3>Rejection Reason</h3><p>{selected.rejection_reason}</p></section>}{selected.status==='waiting_verification'&&<section><h3>Admin Verification</h3><textarea value={reviewNote} onChange={e=>setReviewNote(e.target.value)} placeholder="Catatan admin. Wajib diisi jika Reject."/><div className="actions"><button className="reject" disabled={actionLoading} onClick={()=>void review(false)}>Reject</button><button className="approve" disabled={actionLoading} onClick={()=>void review(true)}>{actionLoading?'Processing...':'Approve Payment'}</button></div></section>}</div></aside></div>}
  <style jsx>{`
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
    

.content{margin-left:230px;min-height:100vh;padding:28px 34px 70px;min-width:0}
@media(max-width:1100px){.content{padding:24px 24px 60px}}
@media(max-width:760px){.content{margin-left:0;padding:24px 14px 45px}}

*{box-sizing:border-box}.brand,.account{border:0;background:transparent;color:#fff;display:flex;align-items:center;gap:10px;text-align:left;cursor:pointer;width:100%}header{display:flex;justify-content:space-between;gap:20px;margin-bottom:23px}.eyebrow{font-size:10px;font-weight:800;letter-spacing:.12em;color:#7c5cff}h1{font-size:26px;margin:5px 0 7px}header p,.panelHead p{font-size:13px;color:#7b849c;margin:0}.refresh{border:1px solid #e2e5ed;background:#fff;border-radius:10px;padding:10px 13px;font-size:12px;font-weight:700;cursor:pointer}.error{display:flex;justify-content:space-between;background:#fff0f2;border:1px solid #ffd9de;color:#b94755;border-radius:12px;padding:10px 13px;margin-bottom:14px;font-size:11px}.error button{border:0;background:transparent;color:inherit;font-size:18px}.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:13px;margin-bottom:15px}.stat{min-height:112px;border:1px solid #e8eaf2;background:linear-gradient(145deg,#fff,#f8f9ff);border-radius:16px;padding:17px;display:flex;gap:13px}.stat>span{width:38px;height:38px;border-radius:12px;background:linear-gradient(135deg,#765cff18,#32c6ff22);color:#6b58e8;display:grid;place-items:center;font-weight:900}.stat small{font-size:10px;color:#7d869d}.stat strong{display:block;font-size:19px;margin:4px 0}.stat p{font-size:10px;color:#9aa2b4;margin:0}.panel{background:#fff;border:1px solid #e7eaf2;border-radius:18px;overflow:hidden}.panelHead{padding:19px 20px 14px}.panelHead h2{font-size:17px;margin:4px 0}.filters{padding:13px 20px;border-top:1px solid #f0f1f5;border-bottom:1px solid #f0f1f5;display:flex;gap:8px}.search{flex:1;display:flex;border:1px solid #dfe3ed;border-radius:10px;overflow:hidden}.search span{padding:10px;color:#929bad}.search input{flex:1;border:0;outline:0;font-size:12px}.search button{border:0;background:#eef0f7;padding:0 13px;font-size:11px;font-weight:700}.filters select{border:1px solid #dfe3ed;background:#fff;border-radius:10px;padding:0 10px;font-size:11px}.clear{border:0;border-radius:10px;background:#fff1f2;color:#d85a67;padding:8px 10px;font-size:11px}.tableWrap{overflow-x:auto}table{width:100%;border-collapse:collapse;min-width:1050px}th{padding:11px 14px;background:#fafbfc;color:#9098aa;font-size:9px;letter-spacing:.08em;text-align:left}td{padding:13px 14px;border-top:1px solid #f0f1f5;font-size:11px;vertical-align:middle}td strong,td small{display:block}td small{font-size:9px;color:#8c95a9;margin-top:2px}.order{border:0;background:transparent;color:#6656d9;font-weight:800;font-size:11px;padding:0;cursor:pointer}.badge{display:inline-flex;padding:5px 8px;border-radius:20px;font-size:9px;font-weight:800}.good{background:#e8f8ef;color:#228653}.warn{background:#fff5dc;color:#b17a0a}.bad{background:#ffeaed;color:#c94f5c}.info{background:#eaf1ff;color:#4d70bd}.view{border:0;background:#f1efff;color:#6858d5;border-radius:8px;padding:7px 9px;font-size:9px;font-weight:800;cursor:pointer}.empty{padding:35px;text-align:center;color:#8d96aa;font-size:11px}.pagination{display:flex;justify-content:space-between;align-items:center;padding:13px 20px;color:#8a93a7;font-size:10px}.pagination div{display:flex;gap:9px;align-items:center}.pagination button{border:1px solid #e0e3ec;background:#fff;border-radius:8px;padding:7px 9px;font-size:10px}.pagination button:disabled{opacity:.4}.backdrop{position:fixed;inset:0;background:#10172b88;z-index:100;display:flex;justify-content:flex-end}.drawer{width:min(520px,94vw);height:100%;background:#f8f9fc;overflow-y:auto}.drawerHead{position:sticky;top:0;background:#fff;padding:19px 20px;border-bottom:1px solid #e8eaf0;display:flex;justify-content:space-between}.drawerHead h2{font-size:18px;margin:4px 0}.drawerHead p{font-size:9px;color:#929aac}.drawerHead button{border:0;background:#f1f2f6;width:31px;height:31px;border-radius:9px;font-size:20px}.drawerBody{padding:16px}.total{background:linear-gradient(135deg,#6352d9,#378de9);color:#fff;padding:17px;border-radius:15px;margin-bottom:12px}.total span,.total strong,.total small{display:block}.total span,.total small{font-size:10px;opacity:.75}.total strong{font-size:24px;margin:4px 0}.drawerBody section{background:#fff;border:1px solid #e7e9f0;border-radius:14px;padding:14px;margin-bottom:10px}.drawerBody h3{font-size:12px;margin:0 0 10px}.drawerBody p{font-size:10px;color:#68738a;line-height:1.6}.proof{display:block;text-decoration:none;background:#f1efff;color:#6555d5;border-radius:9px;padding:10px;font-size:11px;font-weight:800}.drawerBody textarea{width:100%;min-height:90px;border:1px solid #dfe3ed;border-radius:10px;padding:10px;font:inherit;font-size:11px;resize:vertical}.actions{display:flex;gap:8px;margin-top:10px}.actions button{flex:1;border:0;border-radius:10px;padding:10px;font-size:11px;font-weight:800}.reject{background:#ffeaed;color:#c94f5c}.approve{background:linear-gradient(135deg,#6d58e8,#398eea);color:#fff}.loading{min-height:100vh;display:grid;place-items:center;background:#f5f7fb}.loading>div{background:#fff;border:1px solid #e5e8f0;border-radius:18px;padding:22px;display:grid;gap:5px}.loading b{width:36px;height:36px;border-radius:11px;display:grid;place-items:center;color:#fff;background:linear-gradient(135deg,#7c5cff,#32c6ff)}.loading span{font-size:9px;color:#725be6;font-weight:800}.loading strong{font-size:14px}@media(max-width:900px){.stats{grid-template-columns:1fr}}@media(max-width:760px){.filters{flex-wrap:wrap}.search{flex-basis:100%}.filters select{height:36px;flex:1}.pagination>span{display:none}header{display:block}.refresh{margin-top:12px}}`}</style>
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
        className="menu-item active"
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
        className="menu-item"
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
