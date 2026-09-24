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
 const [selected,setSelected]=useState<PaymentRow|null>(null); const [reviewNote,setReviewNote]=useState(''); const [actionLoading,setActionLoading]=useState(false); const [proofLoading,setProofLoading]=useState(false)

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
 const openProof=async(row:PaymentRow)=>{if(!row.proof_url)return; setError(''); if(!row.proof_url.startsWith('storage://payment-proofs/')){window.open(row.proof_url,'_blank','noopener,noreferrer');return} const path=row.proof_url.replace('storage://payment-proofs/',''); if(!path){setError('Path bukti pembayaran tidak valid.');return} setProofLoading(true); const {data,error:e}=await supabase.storage.from('payment-proofs').createSignedUrl(path,300); setProofLoading(false); if(e||!data?.signedUrl){setError(e?.message||'Bukti pembayaran tidak dapat dibuka.');return} window.open(data.signedUrl,'_blank','noopener,noreferrer')}
 const review=async(approve:boolean)=>{if(!selected)return;if(!approve&&!reviewNote.trim()){setError('Alasan penolakan wajib diisi.');return} setActionLoading(true);setError(''); const {error:e}=await supabase.rpc('admin_review_payment_operation',{p_payment_transaction_id:selected.id,p_approve:approve,p_note:reviewNote.trim()||null}); if(e)setError(e.message); else {setSelected(null);setReviewNote('');await loadData()} setActionLoading(false)}
 const logout=async()=>{await supabase.auth.signOut();router.replace('/login')}
 if(loading)return <div className="loading"><div><b>iS</b><span>PAYMENT MANAGEMENT</span><strong>Menyiapkan data pembayaran...</strong></div></div>

 return <div className="shell">
  <aside className="sidebar">
    <div>
      <button className="brand" onClick={()=>router.push('/admin')}>
        <b>iS</b>
        <span><strong>iMersSUPA</strong><small>ADMIN CONTROL</small></span>
      </button>

      <div className="role">
        <span>★</span>
        <div><small>LOGGED IN AS</small><strong>{profile?.role==='super_admin'?'Super Admin':'Administrator'}</strong></div>
      </div>

      <nav>
        <p>MAIN MENU</p>
        <button onClick={()=>router.push('/admin')}>⌂ Dashboard</button>
        <button onClick={()=>router.push('/admin/members')}>◎ Members</button>
        <button onClick={()=>router.push('/admin/products')}>▣ Products</button>
        <button onClick={()=>router.push('/admin/content')}>▶ Content</button>
        <button onClick={()=>router.push('/admin/access')}>◇ Member Access</button>
        <button onClick={()=>router.push('/admin/progress')}>↗ Progress</button>
        <button onClick={()=>router.push('/admin/resources')}>◆ Resources</button>

        <p>COMMERCE</p>
        <button onClick={()=>router.push('/admin/orders')}>▤ Orders & Transactions</button>
        <button className="active">◫ Payments</button>
        <button onClick={()=>router.push('/admin/affiliates')}>⌘ Affiliate & Coupons</button>
        <button onClick={()=>router.push('/admin/notifications')}>◌ Notifications</button>

        {profile?.role==='super_admin'&&<>
          <p>SUPER ADMIN</p>
          <button onClick={()=>router.push('/admin/agencies')}>♟ Agency Management</button>
          <button onClick={()=>router.push('/admin/administrators')}>♛ Administrators</button>
          <button onClick={()=>router.push('/admin/settings')}>⚙ System Settings</button>
          <button onClick={()=>router.push('/admin/settings/commerce')}>◈ Commerce Settings</button>
          <button onClick={()=>router.push('/admin/security')}>◇ Security / Audit</button>
        </>}

        <p>ACCOUNT</p>
        <button onClick={()=>router.push('/admin/profile')}>◉ Profile</button>
      </nav>
    </div>

    <div className="sideBottom">
      <button className="account" onClick={()=>router.push('/admin/profile')}>
        <span>{(profile?.full_name||email||'A').slice(0,2).toUpperCase()}</span>
        <div><strong>{profile?.full_name||'Administrator'}</strong><small>{email}</small></div>
      </button>
      <button className="logout" onClick={logout}>↗ Keluar</button>
    </div>
  </aside>
  <main className="content"><header><div><span className="eyebrow">COMMERCE / PAYMENTS</span><h1>Payment Management</h1><p>Kelola transaksi pembayaran dan verifikasi bukti pembayaran pelanggan.</p></div><div style={{display:'flex',gap:8,alignItems:'flex-start'}}><button className="refresh" onClick={()=>router.push('/admin/payments/methods')}>◈ Payment Methods</button><button className="refresh" onClick={()=>void loadData()} disabled={listLoading}>↻ Refresh</button></div></header>
  {error&&<div className="error"><span>⚠ {error}</span><button onClick={()=>setError('')}>×</button></div>}
  <section className="stats"><div className="stat"><span>◉</span><div><small>DATA DITEMUKAN</small><strong>{total.toLocaleString('id-ID')}</strong><p>Sesuai filter aktif</p></div></div><div className="stat"><span>⌛</span><div><small>WAITING DI HALAMAN INI</small><strong>{waiting}</strong><p>Perlu verifikasi admin</p></div></div><div className="stat"><span>Rp</span><div><small>NOMINAL HALAMAN INI</small><strong>{money(amount)}</strong><p>{start}–{end} dari {total}</p></div></div></section>
  <section className="panel"><div className="panelHead"><div><span className="eyebrow">TRANSACTIONS</span><h2>Payment Transactions</h2><p>Search, filter, dan pagination aktif sejak awal.</p></div></div>
   <div className="filters"><form className="search" onSubmit={submitSearch}><span>⌕</span><input value={searchInput} onChange={e=>setSearchInput(e.target.value)} placeholder="Cari nama pembayar, rekening, metode, reference..."/><button>Search</button></form><select value={status} onChange={e=>{setStatus(e.target.value);setPage(1)}}><option value="">All Status</option><option value="waiting_verification">Waiting Verification</option><option value="pending">Pending</option><option value="paid">Paid</option><option value="rejected">Rejected</option><option value="failed">Failed</option><option value="cancelled">Cancelled</option><option value="expired">Expired</option><option value="refunded">Refunded</option></select><select value={pageSize} onChange={e=>{setPageSize(Number(e.target.value));setPage(1)}}><option value={10}>10 / page</option><option value={25}>25 / page</option><option value={50}>50 / page</option><option value={100}>100 / page</option></select>{(search||status)&&<button className="clear" onClick={()=>{setSearch('');setSearchInput('');setStatus('');setPage(1)}}>Clear</button>}</div>
   <div className="tableWrap"><table><thead><tr><th>ORDER</th><th>CUSTOMER / PAYER</th><th>METHOD</th><th>AMOUNT</th><th>STATUS</th><th>SUBMITTED</th><th>ACTION</th></tr></thead><tbody>{!listLoading&&rows.map(r=><tr key={r.id}><td><button className="order" onClick={()=>router.push(`/admin/orders?order=${r.order_id}`)}>{r.orders?.order_number||r.order_id.slice(0,8)}</button><small>{r.provider_reference||'No reference'}</small></td><td><strong>{r.orders?.buyer_name||r.payer_name||'—'}</strong><small>{r.orders?.buyer_email||r.payer_account||'—'}</small></td><td><strong>{r.payment_method_name_snapshot}</strong><small>{label(r.payment_method_type_snapshot)}</small></td><td><strong>{money(r.amount_due)}</strong><small>Fee {money(r.fee_amount)}</small></td><td><span className={`badge ${badge(r.status)}`}>{label(r.status)}</span></td><td><strong>{dateTime(r.submitted_at||r.created_at)}</strong><small>{r.verified_at?`Verified ${dateTime(r.verified_at)}`:' '}</small></td><td><button className="view" onClick={()=>{setSelected(r);setReviewNote('')}}>{r.status==='waiting_verification'?'Verify':'Detail'}</button></td></tr>)}</tbody></table>{listLoading&&<div className="empty">Loading payment transactions...</div>}{!listLoading&&!rows.length&&<div className="empty">Belum ada transaksi yang sesuai filter.</div>}</div>
   <div className="pagination"><span>Menampilkan <b>{start}–{end}</b> dari <b>{total.toLocaleString('id-ID')}</b> data</span><div><button disabled={page<=1||listLoading} onClick={()=>setPage(p=>p-1)}>← Previous</button><b>Page {page} / {pages}</b><button disabled={page>=pages||listLoading} onClick={()=>setPage(p=>p+1)}>Next →</button></div></div>
  </section></main>
  {selected&&<div className="backdrop" onClick={()=>!actionLoading&&setSelected(null)}><aside className="drawer" onClick={e=>e.stopPropagation()}><div className="drawerHead"><div><span className="eyebrow">PAYMENT DETAIL</span><h2>{selected.orders?.order_number||'Payment'}</h2><p>{selected.id}</p></div><button disabled={actionLoading} onClick={()=>setSelected(null)}>×</button></div><div className="drawerBody"><div className="total"><span>Amount Due</span><strong>{money(selected.amount_due)}</strong><small>{selected.payment_method_name_snapshot}</small></div><section><h3>Payment Information</h3><Info k="Status" v={label(selected.status)}/><Info k="Buyer" v={selected.orders?.buyer_name||'—'}/><Info k="Email" v={selected.orders?.buyer_email||'—'}/><Info k="Payer" v={selected.payer_name||'—'}/><Info k="Account" v={selected.payer_account||'—'}/><Info k="Reference" v={selected.provider_reference||'—'}/><Info k="Submitted" v={dateTime(selected.submitted_at)}/></section>{selected.payer_note&&<section><h3>Payer Note</h3><p>{selected.payer_note}</p></section>}{selected.proof_url&&<section><h3>Payment Proof</h3><button type="button" className="proof" disabled={proofLoading} onClick={()=>void openProof(selected)}>{proofLoading?'Opening proof...':'Open payment proof ↗'}</button></section>}{selected.rejection_reason&&<section><h3>Rejection Reason</h3><p>{selected.rejection_reason}</p></section>}{selected.status==='waiting_verification'&&<section><h3>Admin Verification</h3><textarea value={reviewNote} onChange={e=>setReviewNote(e.target.value)} placeholder="Catatan admin. Wajib diisi jika Reject."/><div className="actions"><button className="reject" disabled={actionLoading} onClick={()=>void review(false)}>Reject</button><button className="approve" disabled={actionLoading} onClick={()=>void review(true)}>{actionLoading?'Processing...':'Approve Payment'}</button></div></section>}</div></aside></div>}
  <style jsx>{`*{box-sizing:border-box}.shell{min-height:100vh;background:radial-gradient(circle at 12% 8%,#dbeafe 0,transparent 30%),radial-gradient(circle at 88% 92%,#f3d8ff 0,transparent 32%),#f7f8ff;color:#182033;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.sidebar{position:fixed;inset:0 auto 0 0;width:268px;padding:24px 18px 18px;background:linear-gradient(180deg,#fbfdff,#f6f9ff);color:#26334d;display:flex;flex-direction:column;justify-content:space-between;overflow-y:auto;overflow-x:hidden;border-right:1px solid #dfe6f2;box-shadow:8px 0 30px rgba(72,91,140,.04)}
.brand,.account{border:0;background:transparent;color:#26334d;display:flex;align-items:center;gap:12px;text-align:left;cursor:pointer;width:100%}
.brand{padding:0 2px 20px}.brand>b{width:42px;height:42px;border-radius:12px;display:grid;place-items:center;background:linear-gradient(135deg,#5968f4,#7c3aed);color:#fff;box-shadow:0 8px 18px #6d5df433}.brand strong,.brand small,.account strong,.account small{display:block}.brand strong{font-size:16px;color:#172033}.brand small{font-size:9px;letter-spacing:.16em;color:#67748e;font-weight:800;margin-top:2px}
.role{display:flex;gap:11px;align-items:center;padding:12px;border:1px solid #dfe3f2;background:linear-gradient(135deg,#eef2ff,#faf7ff);border-radius:14px;margin-bottom:20px}.role>span{width:32px;height:32px;border-radius:9px;display:grid;place-items:center;background:#e5e7ff;color:#7063eb}.role small{font-size:9px;letter-spacing:.12em;color:#74819a;font-weight:800}.role strong{display:block;font-size:12px;color:#27334c;margin-top:2px}
nav p{font-size:9px;letter-spacing:.15em;color:#8a98b0;font-weight:900;margin:18px 9px 7px}nav button{width:100%;border:0;background:transparent;color:#52617b;border-radius:11px;padding:10px 11px;text-align:left;font-size:12px;font-weight:700;cursor:pointer;margin:2px 0;transition:.18s ease}nav button:hover{background:#eef2ff;color:#3d4fd6}nav button.active{background:linear-gradient(90deg,#e8eaff,#edf6ff);color:#3f46cf;box-shadow:inset 0 0 0 1px #cfd4ff}
.sideBottom{border-top:1px solid #e3e8f2;padding-top:14px}.account>span{width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#5a68f5,#7c3aed);color:#fff;display:grid;place-items:center;font-size:11px;font-weight:800}.account div{min-width:0}.account strong,.account small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.account strong{font-size:11px;color:#28344d}.account small{font-size:9px;color:#8b96aa}.logout{width:100%;margin-top:9px;border:1px solid #f0d8dd;background:#fff5f6;color:#dc5b68;border-radius:10px;padding:8px;font-size:10px;font-weight:800;cursor:pointer}
.content{margin-left:268px;padding:30px 32px 50px;min-height:100vh}header{display:flex;justify-content:space-between;gap:20px;margin-bottom:23px}.eyebrow{font-size:10px;font-weight:800;letter-spacing:.12em;color:#7c5cff}h1{font-size:26px;margin:5px 0 7px}header p,.panelHead p{font-size:13px;color:#7b849c;margin:0}.refresh{border:1px solid #e2e5ed;background:#fff;border-radius:10px;padding:10px 13px;font-size:12px;font-weight:700;cursor:pointer}.error{display:flex;justify-content:space-between;background:#fff0f2;border:1px solid #ffd9de;color:#b94755;border-radius:12px;padding:10px 13px;margin-bottom:14px;font-size:11px}.error button{border:0;background:transparent;color:inherit;font-size:18px}.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:13px;margin-bottom:15px}.stat{min-height:112px;border:1px solid #e8eaf2;background:linear-gradient(145deg,#fff,#f8f9ff);border-radius:16px;padding:17px;display:flex;gap:13px}.stat>span{width:38px;height:38px;border-radius:12px;background:linear-gradient(135deg,#765cff18,#32c6ff22);color:#6b58e8;display:grid;place-items:center;font-weight:900}.stat small{font-size:10px;color:#7d869d}.stat strong{display:block;font-size:19px;margin:4px 0}.stat p{font-size:10px;color:#9aa2b4;margin:0}.panel{background:#fff;border:1px solid #e7eaf2;border-radius:18px;overflow:hidden}.panelHead{padding:19px 20px 14px}.panelHead h2{font-size:17px;margin:4px 0}.filters{padding:13px 20px;border-top:1px solid #f0f1f5;border-bottom:1px solid #f0f1f5;display:flex;gap:8px}.search{flex:1;display:flex;border:1px solid #dfe3ed;border-radius:10px;overflow:hidden}.search span{padding:10px;color:#929bad}.search input{flex:1;border:0;outline:0;font-size:12px}.search button{border:0;background:#eef0f7;padding:0 13px;font-size:11px;font-weight:700}.filters select{border:1px solid #dfe3ed;background:#fff;border-radius:10px;padding:0 10px;font-size:11px}.clear{border:0;border-radius:10px;background:#fff1f2;color:#d85a67;padding:8px 10px;font-size:11px}.tableWrap{overflow-x:auto}table{width:100%;border-collapse:collapse;min-width:1050px}th{padding:11px 14px;background:#fafbfc;color:#9098aa;font-size:9px;letter-spacing:.08em;text-align:left}td{padding:13px 14px;border-top:1px solid #f0f1f5;font-size:11px;vertical-align:middle}td strong,td small{display:block}td small{font-size:9px;color:#8c95a9;margin-top:2px}.order{border:0;background:transparent;color:#6656d9;font-weight:800;font-size:11px;padding:0;cursor:pointer}.badge{display:inline-flex;padding:5px 8px;border-radius:20px;font-size:9px;font-weight:800}.good{background:#e8f8ef;color:#228653}.warn{background:#fff5dc;color:#b17a0a}.bad{background:#ffeaed;color:#c94f5c}.info{background:#eaf1ff;color:#4d70bd}.view{border:0;background:#f1efff;color:#6858d5;border-radius:8px;padding:7px 9px;font-size:9px;font-weight:800;cursor:pointer}.empty{padding:35px;text-align:center;color:#8d96aa;font-size:11px}.pagination{display:flex;justify-content:space-between;align-items:center;padding:13px 20px;color:#8a93a7;font-size:10px}.pagination div{display:flex;gap:9px;align-items:center}.pagination button{border:1px solid #e0e3ec;background:#fff;border-radius:8px;padding:7px 9px;font-size:10px}.pagination button:disabled{opacity:.4}.backdrop{position:fixed;inset:0;background:#10172b88;z-index:100;display:flex;justify-content:flex-end}.drawer{width:min(520px,94vw);height:100%;background:#f8f9fc;overflow-y:auto}.drawerHead{position:sticky;top:0;background:#fff;padding:19px 20px;border-bottom:1px solid #e8eaf0;display:flex;justify-content:space-between}.drawerHead h2{font-size:18px;margin:4px 0}.drawerHead p{font-size:9px;color:#929aac}.drawerHead button{border:0;background:#f1f2f6;width:31px;height:31px;border-radius:9px;font-size:20px}.drawerBody{padding:16px}.total{background:linear-gradient(135deg,#6352d9,#378de9);color:#fff;padding:17px;border-radius:15px;margin-bottom:12px}.total span,.total strong,.total small{display:block}.total span,.total small{font-size:10px;opacity:.75}.total strong{font-size:24px;margin:4px 0}.drawerBody section{background:#fff;border:1px solid #e7e9f0;border-radius:14px;padding:14px;margin-bottom:10px}.drawerBody h3{font-size:12px;margin:0 0 10px}.drawerBody p{font-size:10px;color:#68738a;line-height:1.6}.proof{display:block;text-decoration:none;background:#f1efff;color:#6555d5;border-radius:9px;padding:10px;font-size:11px;font-weight:800}.drawerBody textarea{width:100%;min-height:90px;border:1px solid #dfe3ed;border-radius:10px;padding:10px;font:inherit;font-size:11px;resize:vertical}.actions{display:flex;gap:8px;margin-top:10px}.actions button{flex:1;border:0;border-radius:10px;padding:10px;font-size:11px;font-weight:800}.reject{background:#ffeaed;color:#c94f5c}.approve{background:linear-gradient(135deg,#6d58e8,#398eea);color:#fff}.loading{min-height:100vh;display:grid;place-items:center;background:#f5f7fb}.loading>div{background:#fff;border:1px solid #e5e8f0;border-radius:18px;padding:22px;display:grid;gap:5px}.loading b{width:36px;height:36px;border-radius:11px;display:grid;place-items:center;color:#fff;background:linear-gradient(135deg,#7c5cff,#32c6ff)}.loading span{font-size:9px;color:#725be6;font-weight:800}.loading strong{font-size:14px}
.proof{appearance:none;font:inherit;cursor:pointer;text-align:left}
.proof:disabled{opacity:.6;cursor:wait}
@media(max-width:900px){.sidebar{width:230px}.content{margin-left:230px;padding:24px 20px}.stats{grid-template-columns:1fr}}@media(max-width:760px){.sidebar{display:none}.content{margin-left:0;padding:28px 14px}.filters{flex-wrap:wrap}.search{flex-basis:100%}.filters select{height:36px;flex:1}.pagination>span{display:none}header{display:block}.refresh{margin-top:12px}}
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

function Info({k,v}:{k:string;v:string}){return <div style={{display:'flex',justifyContent:'space-between',gap:15,padding:'7px 0',borderBottom:'1px dashed #edf0f4',fontSize:10}}><span style={{color:'#8b94a8'}}>{k}</span><strong style={{textAlign:'right',color:'#4b566c',maxWidth:'65%',wordBreak:'break-word'}}>{v}</strong></div>}
