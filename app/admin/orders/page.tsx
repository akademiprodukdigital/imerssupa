'use client'

import { useCallback, useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import ThemeSwitcher from '../../../components/ThemeSwitcher'

type Profile = { id:string; full_name:string|null; avatar_url:string|null; role:string|null; status:string|null }
type OrderRow = {
  id:string; order_number:string; buyer_name:string; buyer_email:string; buyer_phone:string|null
  subtotal:number; discount_amount:number; payment_fee:number; grand_total:number; currency:string
  status:string; payment_status:string; coupon_code:string|null; affiliate_name:string|null
  created_at:string; paid_at:string|null; completed_at:string|null; total_rows:number
}
type Dashboard = {
  orders:number; paid_orders:number; pending_orders:number; completed_orders:number; cancelled_orders:number
  refunded_orders:number; gross_sales:number; discounts:number; payment_fees:number; waiting_payment_verification:number
}
type OrderDetail = {
  order: Record<string, any>
  items: Array<Record<string, any>>
  payments: Array<Record<string, any>>
  settlement: Record<string, any> | null
  reversals: Array<Record<string, any>>
  events: Array<Record<string, any>>
}

const ORDER_STATUSES = ['', 'pending','awaiting_payment','paid','processing','completed','cancelled','expired','refunded']
const PAYMENT_STATUSES = ['', 'unpaid','pending','paid','failed','cancelled','expired','refunded','partially_refunded']
const PAGE_SIZE = 25

export default function AdminOrdersPage() {
  const router = useRouter()
  const [profile,setProfile] = useState<Profile|null>(null)
  const [email,setEmail] = useState('')
  const [loading,setLoading] = useState(true)
  const [listLoading,setListLoading] = useState(false)
  const [error,setError] = useState('')
  const [orders,setOrders] = useState<OrderRow[]>([])
  const [dashboard,setDashboard] = useState<Dashboard|null>(null)
  const [search,setSearch] = useState('')
  const [searchInput,setSearchInput] = useState('')
  const [status,setStatus] = useState('')
  const [paymentStatus,setPaymentStatus] = useState('')
  const [page,setPage] = useState(1)
  const [detail,setDetail] = useState<OrderDetail|null>(null)
  const [detailLoading,setDetailLoading] = useState(false)

  useEffect(() => { void checkAccess() }, [])

  async function checkAccess() {
    setLoading(true)
    const { data:{user}, error:authError } = await supabase.auth.getUser()
    if (authError || !user) { router.replace('/login'); return }
    setEmail(user.email ?? '')
    const { data, error:profileError } = await supabase.from('profiles').select('id,full_name,avatar_url,role,status').eq('id',user.id).maybeSingle()
    if (profileError || !data) { await supabase.auth.signOut(); router.replace('/login'); return }
    const current = data as Profile
    if (current.status !== 'active') { await supabase.auth.signOut(); router.replace('/login'); return }
    if (!['super_admin','admin'].includes(current.role ?? '')) { router.replace('/member'); return }
    setProfile(current)
    setLoading(false)
  }

  const loadData = useCallback(async () => {
    if (!profile) return
    setListLoading(true); setError('')
    const offset = (page - 1) * PAGE_SIZE
    const [listResult, dashboardResult] = await Promise.all([
      supabase.rpc('admin_list_orders', {
        p_search: search.trim() || null,
        p_status: status || null,
        p_payment_status: paymentStatus || null,
        p_limit: PAGE_SIZE,
        p_offset: offset,
      }),
      supabase.rpc('admin_commerce_dashboard', { p_from:null, p_to:null }),
    ])
    if (listResult.error) setError(listResult.error.message)
    else setOrders((listResult.data ?? []) as OrderRow[])
    if (!dashboardResult.error) setDashboard(dashboardResult.data as Dashboard)
    setListLoading(false)
  }, [profile,page,search,status,paymentStatus])

  useEffect(() => { void loadData() }, [loadData])

  async function openDetail(orderId:string) {
    setDetailLoading(true); setError('')
    const { data,error:detailError } = await supabase.rpc('admin_get_order_detail',{ p_order_id:orderId })
    if (detailError) setError(detailError.message)
    else setDetail(data as OrderDetail)
    setDetailLoading(false)
  }

  async function logout() { await supabase.auth.signOut(); router.replace('/login'); router.refresh() }
  function applySearch(e:FormEvent) { e.preventDefault(); setPage(1); setSearch(searchInput) }
  function clearFilters() { setSearchInput(''); setSearch(''); setStatus(''); setPaymentStatus(''); setPage(1) }

  const totalRows = orders[0]?.total_rows ?? 0
  const totalPages = Math.max(1,Math.ceil(totalRows/PAGE_SIZE))
  const displayName = profile?.full_name?.trim() || email.split('@')[0] || 'Admin'
  const initials = displayName.split(' ').filter(Boolean).slice(0,2).map(x=>x[0]?.toUpperCase()).join('') || 'AD'

  if (loading) return <><main className="loading-page"><ThemeSwitcher/><div className="loading-card"><div className="loading-logo">S</div><div><span>ADMIN COMMERCE</span><h2>Orders & Transactions</h2><p>Menyiapkan data transaksi...</p></div><div className="loader"><i/></div></div></main><Styles/></>

  return <>
    <div className="shell">
      <ThemeSwitcher/>
      <aside className="sidebar">
        <div>
          <button className="brand" onClick={()=>router.push('/admin')}><span className="brand-mark">S</span><span><strong>iMersSUPA</strong><small>Admin Console</small></span></button>
          <div className="role-card"><span className="role-icon">◆</span><span><small>LOGGED IN AS</small><strong>{profile?.role === 'super_admin' ? 'Super Admin' : 'Admin'}</strong></span></div>
          <nav>
            <button onClick={()=>router.push('/admin')}>⌂ <span>Dashboard</span></button>
            <p>COMMERCE</p>
            <button className="active">▣ <span>Orders & Transactions</span></button>
            <button onClick={()=>router.push('/admin/payments')}>◈ <span>Payments</span></button>
            <button onClick={()=>router.push('/admin/affiliates')}>◎ <span>Affiliate & Coupons</span></button>
            <button onClick={()=>router.push('/admin/notifications')}>◇ <span>Notifications</span></button>
            <p>MANAGEMENT</p>
            <button onClick={()=>router.push('/admin')}>◫ <span>Members & Products</span></button>
            {profile?.role === 'super_admin' && <button onClick={()=>router.push('/admin/settings')}>⚙ <span>System Settings</span></button>}
          </nav>
        </div>
        <div className="sidebar-bottom">
          <button className="account" onClick={()=>router.push('/admin/profile')}><span className="avatar">{initials}</span><span><strong>{displayName}</strong><small>{email}</small></span></button>
          <button className="logout" onClick={logout}>↗ Keluar</button>
        </div>
      </aside>

      <main className="content">
        <header><div><span className="eyebrow">COMMERCE CENTER</span><h1>Orders & Transactions</h1><p>Pantau seluruh pesanan, pembayaran, coupon, dan affiliate attribution.</p></div><div className="header-actions"><button className="soft" onClick={()=>void loadData()}>↻ Refresh</button><button className="primary" onClick={()=>router.push('/admin/payments')}>Payment Queue →</button></div></header>

        {error && <div className="error"><strong>Terjadi kendala</strong><span>{error}</span><button onClick={()=>setError('')}>×</button></div>}

        <section className="stats">
          <Stat label="Gross Sales" value={money(dashboard?.gross_sales ?? 0)} hint="Paid & completed orders" icon="↗"/>
          <Stat label="Orders" value={String(dashboard?.orders ?? 0)} hint={`${dashboard?.completed_orders ?? 0} completed`} icon="▣"/>
          <Stat label="Pending Payment" value={String(dashboard?.pending_orders ?? 0)} hint="Needs customer action" icon="◷"/>
          <Stat label="Need Verification" value={String(dashboard?.waiting_payment_verification ?? 0)} hint="Manual payment queue" icon="✓"/>
        </section>

        <section className="panel">
          <div className="panel-head"><div><span className="eyebrow">TRANSACTION LIST</span><h2>Semua Pesanan</h2><p>{totalRows.toLocaleString('id-ID')} transaksi ditemukan</p></div><div className="mini-metrics"><span>Discount <b>{money(dashboard?.discounts ?? 0)}</b></span><span>Fees <b>{money(dashboard?.payment_fees ?? 0)}</b></span></div></div>

          <form className="filters" onSubmit={applySearch}>
            <label className="search"><span>⌕</span><input value={searchInput} onChange={e=>setSearchInput(e.target.value)} placeholder="Cari order, nama, email, WA, coupon, affiliate..."/><button type="submit">Cari</button></label>
            <select value={status} onChange={e=>{setStatus(e.target.value);setPage(1)}}>{ORDER_STATUSES.map(x=><option key={x} value={x}>{x ? `Order: ${pretty(x)}` : 'Semua Status Order'}</option>)}</select>
            <select value={paymentStatus} onChange={e=>{setPaymentStatus(e.target.value);setPage(1)}}>{PAYMENT_STATUSES.map(x=><option key={x} value={x}>{x ? `Payment: ${pretty(x)}` : 'Semua Status Payment'}</option>)}</select>
            {(search || status || paymentStatus) && <button type="button" className="clear" onClick={clearFilters}>Reset</button>}
          </form>

          <div className="table-wrap">
            <table><thead><tr><th>ORDER</th><th>CUSTOMER</th><th>TOTAL</th><th>ORDER STATUS</th><th>PAYMENT</th><th>COUPON / AFFILIATE</th><th>DATE</th><th/></tr></thead>
              <tbody>
                {listLoading ? <tr><td colSpan={8}><Empty text="Memuat transaksi..."/></td></tr> : orders.length===0 ? <tr><td colSpan={8}><Empty text="Belum ada transaksi yang sesuai filter."/></td></tr> : orders.map(order=><tr key={order.id}>
                  <td><button className="order-no" onClick={()=>void openDetail(order.id)}>{order.order_number}</button></td>
                  <td><div className="customer"><strong>{order.buyer_name || 'Customer'}</strong><span>{order.buyer_email}</span>{order.buyer_phone && <small>{order.buyer_phone}</small>}</div></td>
                  <td><strong className="amount">{money(order.grand_total,order.currency)}</strong>{order.discount_amount>0 && <small className="discount">-{money(order.discount_amount,order.currency)}</small>}</td>
                  <td><Badge value={order.status}/></td><td><Badge value={order.payment_status} payment/></td>
                  <td><div className="refs">{order.coupon_code ? <span>🏷 {order.coupon_code}</span> : <small>No coupon</small>}{order.affiliate_name ? <span>◎ {order.affiliate_name}</span> : <small>Direct</small>}</div></td>
                  <td><div className="date"><strong>{dateShort(order.created_at)}</strong><span>{timeShort(order.created_at)}</span></div></td>
                  <td><button className="view" onClick={()=>void openDetail(order.id)}>Detail →</button></td>
                </tr>)}
              </tbody>
            </table>
          </div>

          <div className="pagination"><span>Menampilkan {totalRows===0?0:(page-1)*PAGE_SIZE+1}–{Math.min(page*PAGE_SIZE,totalRows)} dari {totalRows}</span><div><button disabled={page<=1||listLoading} onClick={()=>setPage(p=>Math.max(1,p-1))}>← Previous</button><b>{page} / {totalPages}</b><button disabled={page>=totalPages||listLoading} onClick={()=>setPage(p=>p+1)}>Next →</button></div></div>
        </section>
      </main>
    </div>

    {(detail || detailLoading) && <div className="modal-backdrop" onMouseDown={()=>!detailLoading&&setDetail(null)}><aside className="drawer" onMouseDown={e=>e.stopPropagation()}>{detailLoading ? <Empty text="Memuat detail order..."/> : detail && <OrderDrawer detail={detail} close={()=>setDetail(null)}/>}</aside></div>}
    <Styles/>
  </>
}

function Stat({label,value,hint,icon}:{label:string;value:string;hint:string;icon:string}) { return <article className="stat"><span className="stat-icon">{icon}</span><div><small>{label}</small><strong>{value}</strong><p>{hint}</p></div></article> }
function Empty({text}:{text:string}) { return <div className="empty"><span>◌</span><strong>{text}</strong></div> }
function Badge({value,payment=false}:{value:string;payment?:boolean}) { const tone=['paid','completed'].includes(value)?'good':['cancelled','failed','refunded','expired'].includes(value)?'bad':['pending','unpaid','awaiting_payment'].includes(value)?'warn':'info'; return <span className={`badge ${tone}`}>{payment?'● ':''}{pretty(value)}</span> }
function OrderDrawer({detail,close}:{detail:OrderDetail;close:()=>void}) {
  const o=detail.order
  return <><div className="drawer-head"><div><span className="eyebrow">ORDER DETAIL</span><h2>{o.order_number}</h2><p>{dateLong(o.created_at)}</p></div><button onClick={close}>×</button></div>
    <div className="drawer-body">
      <div className="detail-status"><Badge value={o.status}/><Badge value={o.payment_status} payment/></div>
      <div className="total-card"><span>Grand Total</span><strong>{money(o.grand_total,o.currency)}</strong><small>Subtotal {money(o.subtotal,o.currency)} · Discount {money(o.discount_amount,o.currency)} · Fee {money(o.payment_fee,o.currency)}</small></div>
      <DetailSection title="Customer"><Info label="Nama" value={o.buyer_name}/><Info label="Email" value={o.buyer_email}/><Info label="WhatsApp" value={o.buyer_phone || '-'}/>{o.customer_note&&<Info label="Customer Note" value={o.customer_note}/>}</DetailSection>
      <DetailSection title={`Products (${detail.items.length})`}>{detail.items.map(item=><div className="product-row" key={item.id}><span><strong>{item.product_name}</strong><small>Qty {item.quantity}</small></span><b>{money(item.line_total,o.currency)}</b></div>)}</DetailSection>
      <DetailSection title="Attribution"><Info label="Coupon" value={o.coupon_code || 'Tidak menggunakan coupon'}/><Info label="Affiliate" value={o.affiliate_name || 'Direct / tanpa affiliate'}/><Info label="Referral Code" value={o.affiliate_referral_code || '-'}/></DetailSection>
      <DetailSection title={`Payments (${detail.payments.length})`}>{detail.payments.length===0?<p className="muted">Belum ada payment transaction.</p>:detail.payments.map(p=><div className="payment-card" key={p.id}><span><strong>{p.payment_method_name || p.payment_method_code}</strong><Badge value={p.status} payment/></span><b>{money(p.amount_due,o.currency)}</b>{p.payer_name&&<small>Payer: {p.payer_name}</small>}</div>)}</DetailSection>
      {o.admin_note&&<DetailSection title="Admin Note"><p className="note">{o.admin_note}</p></DetailSection>}
      <DetailSection title={`Timeline (${detail.events.length})`}>{detail.events.length===0?<p className="muted">Belum ada commerce event.</p>:detail.events.slice(0,12).map(e=><div className="timeline" key={e.id}><i/><span><strong>{pretty(e.event_type)}</strong><p>{e.message || e.event_source}</p><small>{dateLong(e.created_at)}</small></span></div>)}</DetailSection>
    </div></>
}
function DetailSection({title,children}:{title:string;children:ReactNode}) { return <section className="detail-section"><h3>{title}</h3>{children}</section> }
function Info({label,value}:{label:string;value:any}) { return <div className="info"><span>{label}</span><strong>{String(value ?? '-')}</strong></div> }
function pretty(v:string){return (v||'-').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase())}
function money(v:number|string,currency='IDR'){return new Intl.NumberFormat('id-ID',{style:'currency',currency:currency||'IDR',maximumFractionDigits:0}).format(Number(v||0))}
function dateShort(v:string){return new Intl.DateTimeFormat('id-ID',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(v))}
function timeShort(v:string){return new Intl.DateTimeFormat('id-ID',{hour:'2-digit',minute:'2-digit'}).format(new Date(v))}
function dateLong(v:string){return new Intl.DateTimeFormat('id-ID',{day:'2-digit',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(v))}

function Styles(){return <style jsx global>{`
*{box-sizing:border-box}.shell{min-height:100vh;background:var(--bg,#f5f7fb);color:var(--text,#182033);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.sidebar{position:fixed;inset:0 auto 0 0;width:245px;padding:22px 16px;background:linear-gradient(180deg,#121a35,#18254b);color:#fff;display:flex;flex-direction:column;justify-content:space-between;z-index:20}.brand{border:0;background:transparent;color:#fff;display:flex;align-items:center;gap:10px;text-align:left;cursor:pointer;padding:0 7px 18px;width:100%}.brand-mark,.loading-logo{width:36px;height:36px;border-radius:11px;display:grid;place-items:center;font-weight:900;background:linear-gradient(135deg,#7c5cff,#32c6ff);box-shadow:0 8px 22px #735cff55}.brand strong{display:block;font-size:17px}.brand small{display:block;font-size:11px;opacity:.65;margin-top:2px}.role-card{display:flex;gap:10px;align-items:center;padding:11px 12px;border:1px solid #ffffff18;background:#ffffff0c;border-radius:13px;margin-bottom:18px}.role-icon{width:28px;height:28px;display:grid;place-items:center;border-radius:9px;background:#ffffff12}.role-card small{display:block;font-size:9px;letter-spacing:.09em;opacity:.55}.role-card strong{display:block;font-size:12px;margin-top:2px}nav p{font-size:9px;letter-spacing:.12em;opacity:.4;margin:17px 10px 7px}nav button{width:100%;border:0;background:transparent;color:#cdd6f6;border-radius:10px;padding:10px 11px;text-align:left;font-size:13px;cursor:pointer;margin:2px 0;display:flex;gap:9px;align-items:center}nav button:hover,nav button.active{background:linear-gradient(90deg,#735cff33,#2dc8ff1c);color:#fff}.sidebar-bottom{border-top:1px solid #ffffff12;padding-top:14px}.account{border:0;background:transparent;color:#fff;width:100%;display:flex;align-items:center;gap:9px;text-align:left;padding:5px;cursor:pointer}.avatar{width:34px;height:34px;border-radius:10px;background:linear-gradient(135deg,#ff7b8b,#ffb05c);display:grid;place-items:center;font-size:11px;font-weight:800}.account strong,.account small{display:block;max-width:155px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.account strong{font-size:12px}.account small{font-size:9px;opacity:.55;margin-top:2px}.logout{width:100%;margin-top:8px;border:1px solid #ffffff12;background:#ffffff08;color:#ffb6be;border-radius:9px;padding:8px;font-size:11px;cursor:pointer}.content{margin-left:245px;padding:30px 32px 50px;min-width:0}header{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;margin-bottom:23px}.eyebrow{font-size:10px;font-weight:800;letter-spacing:.12em;color:#7c5cff}header h1{font-size:26px;line-height:1.1;margin:5px 0 7px}header p,.panel-head p{font-size:13px;color:#7b849c;margin:0}.header-actions{display:flex;gap:8px}.soft,.primary,.clear{border:0;border-radius:10px;padding:10px 13px;font-size:12px;font-weight:700;cursor:pointer}.soft{background:#fff;color:#536078;border:1px solid #e7eaf2}.primary{color:#fff;background:linear-gradient(135deg,#7159ef,#3e8df6)}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:13px;margin-bottom:15px}.stat{min-height:116px;border:1px solid #e8eaf2;background:linear-gradient(145deg,#fff,#f8f9ff);border-radius:16px;padding:17px;display:flex;gap:13px;box-shadow:0 8px 25px #28304a08}.stat-icon{width:38px;height:38px;border-radius:12px;background:linear-gradient(135deg,#765cff18,#32c6ff22);color:#6b58e8;display:grid;place-items:center;font-weight:900}.stat small{font-size:11px;color:#7d869d}.stat strong{display:block;font-size:20px;margin:4px 0 1px}.stat p{font-size:10px;color:#9aa2b4;margin:0}.panel{background:#fff;border:1px solid #e7eaf2;border-radius:18px;box-shadow:0 10px 32px #28304a08;overflow:hidden}.panel-head{padding:19px 20px 14px;display:flex;justify-content:space-between;gap:20px;align-items:flex-end}.panel-head h2{font-size:17px;margin:4px 0}.mini-metrics{display:flex;gap:8px}.mini-metrics span{font-size:10px;color:#8b94a8;padding:7px 9px;border-radius:9px;background:#f6f7fb}.mini-metrics b{color:#4c5870;margin-left:4px}.filters{padding:13px 20px;border-top:1px solid #f0f1f5;border-bottom:1px solid #f0f1f5;display:flex;gap:8px}.search{flex:1;display:flex;align-items:center;border:1px solid #dfe3ed;border-radius:10px;overflow:hidden;background:#fff}.search span{padding-left:11px;color:#929bad}.search input{flex:1;border:0;outline:0;padding:10px 8px;font-size:12px;min-width:120px}.search button{border:0;background:#eef0f7;color:#4d5870;font-size:11px;font-weight:700;padding:10px 13px;cursor:pointer}.filters select{border:1px solid #dfe3ed;background:#fff;border-radius:10px;padding:0 10px;font-size:11px;color:#58637a;outline:0}.clear{padding:8px 10px;background:#fff1f2;color:#d85a67}.table-wrap{overflow-x:auto}table{width:100%;border-collapse:collapse;min-width:1080px}th{padding:11px 14px;background:#fafbfc;color:#9098aa;font-size:9px;letter-spacing:.08em;text-align:left;border-bottom:1px solid #eceef3}td{padding:13px 14px;border-bottom:1px solid #f0f1f5;vertical-align:middle;font-size:11px}tbody tr:hover{background:#fafbff}.order-no{border:0;background:transparent;color:#6656d9;font-weight:800;font-size:11px;cursor:pointer;padding:0}.customer strong,.customer span,.customer small,.date strong,.date span,.refs span,.refs small{display:block}.customer strong{font-size:11px}.customer span,.customer small,.date span,.refs small{font-size:9px;color:#8c95a9;margin-top:2px}.amount{display:block;font-size:11px}.discount{display:block;color:#e16b74;font-size:9px;margin-top:2px}.refs span{font-size:9px;color:#5e6980;margin:2px 0}.badge{display:inline-flex;align-items:center;padding:5px 8px;border-radius:20px;font-size:9px;font-weight:800;white-space:nowrap}.badge.good{background:#e8f8ef;color:#228653}.badge.warn{background:#fff5dc;color:#b17a0a}.badge.bad{background:#ffeaed;color:#c94f5c}.badge.info{background:#eaf1ff;color:#4d70bd}.view{border:0;background:#f1efff;color:#6858d5;border-radius:8px;padding:7px 9px;font-size:9px;font-weight:800;cursor:pointer;white-space:nowrap}.pagination{display:flex;align-items:center;justify-content:space-between;padding:13px 20px;color:#8a93a7;font-size:10px}.pagination div{display:flex;align-items:center;gap:9px}.pagination button{border:1px solid #e0e3ec;background:#fff;border-radius:8px;padding:7px 9px;font-size:10px;cursor:pointer}.pagination button:disabled{opacity:.4;cursor:not-allowed}.pagination b{font-size:10px;color:#58637a}.empty{padding:38px;display:flex;align-items:center;justify-content:center;gap:9px;color:#8d96aa}.empty span{font-size:20px}.empty strong{font-size:12px}.error{display:flex;align-items:center;gap:9px;background:#fff0f2;border:1px solid #ffd9de;color:#b94755;border-radius:12px;padding:10px 13px;margin-bottom:14px;font-size:11px}.error span{flex:1}.error button{border:0;background:transparent;font-size:18px;color:inherit;cursor:pointer}.modal-backdrop{position:fixed;inset:0;background:#10172b88;backdrop-filter:blur(3px);z-index:100;display:flex;justify-content:flex-end}.drawer{width:min(520px,94vw);height:100%;background:#f8f9fc;box-shadow:-20px 0 60px #0f173044;overflow-y:auto}.drawer-head{position:sticky;top:0;background:#fff;z-index:2;padding:19px 20px;border-bottom:1px solid #e8eaf0;display:flex;justify-content:space-between}.drawer-head h2{font-size:18px;margin:4px 0}.drawer-head p{font-size:10px;color:#929aac;margin:0}.drawer-head button{border:0;background:#f1f2f6;width:31px;height:31px;border-radius:9px;font-size:20px;cursor:pointer}.drawer-body{padding:16px}.detail-status{display:flex;gap:7px;margin-bottom:10px}.total-card{background:linear-gradient(135deg,#6352d9,#378de9);color:#fff;padding:17px;border-radius:15px;margin-bottom:12px}.total-card span,.total-card strong,.total-card small{display:block}.total-card span{font-size:10px;opacity:.75}.total-card strong{font-size:24px;margin:4px 0}.total-card small{font-size:9px;opacity:.7}.detail-section{background:#fff;border:1px solid #e7e9f0;border-radius:14px;padding:14px;margin-bottom:10px}.detail-section h3{font-size:12px;margin:0 0 10px}.info{display:flex;justify-content:space-between;gap:15px;padding:7px 0;border-bottom:1px dashed #edf0f4;font-size:10px}.info:last-child{border-bottom:0}.info span{color:#8b94a8}.info strong{text-align:right;color:#4b566c;max-width:65%;word-break:break-word}.product-row,.payment-card{display:flex;justify-content:space-between;gap:10px;padding:9px 0;border-bottom:1px solid #eff1f5}.product-row:last-child,.payment-card:last-child{border-bottom:0}.product-row strong,.product-row small{display:block}.product-row strong{font-size:10px}.product-row small,.payment-card small{font-size:9px;color:#9199ab;margin-top:2px}.product-row b,.payment-card b{font-size:10px}.payment-card{display:grid;grid-template-columns:1fr auto}.payment-card>span{display:flex;align-items:center;gap:7px}.payment-card strong{font-size:10px}.payment-card small{grid-column:1/-1}.note,.muted{font-size:10px;color:#68738a;margin:0;line-height:1.6}.timeline{display:flex;gap:10px;padding:7px 0}.timeline i{width:8px;height:8px;border-radius:50%;background:#725be6;margin-top:4px;box-shadow:0 0 0 4px #725be615}.timeline strong{font-size:10px}.timeline p{font-size:9px;color:#68738a;margin:2px 0}.timeline small{font-size:8px;color:#9ba3b3}.loading-page{min-height:100vh;display:grid;place-items:center;background:#f5f7fb}.loading-card{width:min(390px,90vw);padding:22px;background:#fff;border:1px solid #e5e8f0;border-radius:18px;display:flex;align-items:center;gap:14px;box-shadow:0 15px 50px #28304a14}.loading-card span{font-size:9px;color:#725be6;font-weight:800;letter-spacing:.1em}.loading-card h2{font-size:16px;margin:3px 0}.loading-card p{font-size:10px;color:#8b94a7;margin:0}.loader{margin-left:auto}.loader i{display:block;width:22px;height:22px;border:2px solid #e4e6ef;border-top-color:#725be6;border-radius:50%;animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}
@media(max-width:1050px){.stats{grid-template-columns:repeat(2,1fr)}.sidebar{width:215px}.content{margin-left:215px;padding:25px 22px}.mini-metrics{display:none}}
@media(max-width:760px){.sidebar{display:none}.content{margin-left:0;padding:72px 14px 35px}header{display:block}header h1{font-size:22px}.header-actions{margin-top:14px}.stats{grid-template-columns:1fr 1fr;gap:9px}.stat{min-height:104px;padding:13px}.stat strong{font-size:16px}.panel-head{display:block}.filters{flex-wrap:wrap}.search{flex-basis:100%}.filters select{height:36px;flex:1}.pagination{gap:10px;align-items:flex-start}.pagination>span{display:none}}
@media(prefers-color-scheme:dark){.shell{--bg:#101522;--text:#edf1fb}.content{background:#101522}.panel,.stat,.soft,.filters select,.search,.pagination button,.detail-section{background:#171e2d;border-color:#283246}.panel-head p,header p,.stat small,.stat p{color:#8f9bb2}.filters,.panel-head,th,td{border-color:#283246}th{background:#151c2a}.search input{background:#171e2d;color:#edf1fb}.search button{background:#222b3d;color:#b7c1d5}tbody tr:hover{background:#1b2333}.mini-metrics span{background:#20283a}.drawer{background:#101522}.drawer-head{background:#171e2d;border-color:#283246}.drawer-head button{background:#252e40;color:#fff}.loading-page{background:#101522}.loading-card{background:#171e2d;color:#fff;border-color:#283246}}
`}</style>}
