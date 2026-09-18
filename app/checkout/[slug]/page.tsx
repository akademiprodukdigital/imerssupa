'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '../../../lib/supabase'

type Product={id:string;name:string;slug:string;description:string|null;price:number|string|null;status:string}
type Quote={currency:string;subtotal:number|string;discount_amount:number|string;total_amount:number|string;coupon?:{code:string}|null;affiliate?:{name:string}|null;items:any[]}
const money=(v:any)=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(v||0))
function visitorKey(){let v=localStorage.getItem('imerssupa_visitor_key');if(!v){v=crypto.randomUUID();localStorage.setItem('imerssupa_visitor_key',v)}return v}

export default function CheckoutPage(){
 const params=useParams(); const router=useRouter(); const qs=useSearchParams(); const slug=String(params.slug||'')
 const [product,setProduct]=useState<Product|null>(null); const [quote,setQuote]=useState<Quote|null>(null); const [coupon,setCoupon]=useState(qs.get('coupon')||'')
 const [form,setForm]=useState({name:'',email:'',phone:'',note:''}); const [loading,setLoading]=useState(true); const [busy,setBusy]=useState(false); const [error,setError]=useState('')
 useEffect(()=>{void load()},[slug])
 async function load(){
  setLoading(true);setError('')
  const p=await supabase.from('products').select('id,name,slug,description,price,status').eq('slug',slug).eq('status','published').maybeSingle()
  if(p.error||!p.data){setError(p.error?.message||'Produk tidak ditemukan.');setLoading(false);return}
  setProduct(p.data as Product)
  const u=await supabase.auth.getUser(); if(u.data.user){const pr=await supabase.from('profiles').select('full_name,phone').eq('id',u.data.user.id).maybeSingle();setForm(x=>({...x,name:pr.data?.full_name||x.name,email:u.data.user?.email||x.email,phone:pr.data?.phone||x.phone}))}
  await refreshQuote(p.data.id,coupon);setLoading(false)
 }
 async function refreshQuote(productId=product?.id, code=coupon){
  if(!productId)return
  const r=await supabase.rpc('get_checkout_quote',{p_items:[{product_id:productId,quantity:1}],p_coupon_code:code.trim()||null,p_visitor_key:visitorKey()})
  if(r.error){setError(r.error.message);setQuote(null);return} setError('');setQuote(r.data as Quote)
 }
 async function submit(e:FormEvent){e.preventDefault();if(!product||!quote)return;setBusy(true);setError('')
  const idem=crypto.randomUUID()
  const r=await supabase.rpc('create_checkout_order_secure',{p_items:[{product_id:product.id,quantity:1}],p_buyer_name:form.name.trim(),p_buyer_email:form.email.trim().toLowerCase(),p_buyer_phone:form.phone.trim()||null,p_coupon_code:coupon.trim()||null,p_visitor_key:visitorKey(),p_customer_note:form.note.trim()||null,p_idempotency_key:idem})
  if(r.error){setError(r.error.message);setBusy(false);return}
  const o=r.data as any; if(o.checkout_token)sessionStorage.setItem(`imerssupa_checkout_${o.order_id}`,o.checkout_token)
  router.push(`/checkout/order/${o.order_id}`); setBusy(false)
 }
 if(loading)return <div className="wrap"><div className="main"><div className="card">Menyiapkan checkout...</div></div>
<style jsx global>{`
  *{box-sizing:border-box} body{margin:0;background:#070b17;color:#e8ecf7;font-family:Inter,Arial,sans-serif}
  button,input,textarea{font:inherit}.wrap{min-height:100vh;background:radial-gradient(circle at 10% 0,#312e8155,transparent 32%),radial-gradient(circle at 90% 10%,#0ea5e955,transparent 30%),#070b17}
  .top{max-width:1120px;margin:auto;padding:24px 20px;display:flex;justify-content:space-between;align-items:center}.brand{font-weight:900;font-size:18px}.muted{color:#94a3b8}
  .main{max-width:1120px;margin:auto;padding:24px 20px 70px}.card{background:linear-gradient(135deg,#11182c,#0c1223);border:1px solid #27324a;border-radius:22px;padding:22px;box-shadow:0 18px 55px #0005}
  .grid{display:grid;grid-template-columns:1.35fr .85fr;gap:22px}.title{font-size:34px;line-height:1.15;margin:8px 0 12px}.price{font-size:27px;font-weight:900;margin:14px 0}.desc{line-height:1.75;color:#cbd5e1;white-space:pre-wrap}
  .img{width:100%;aspect-ratio:16/10;object-fit:cover;border-radius:18px;background:#121a2d;border:1px solid #27324a}.btn{border:0;border-radius:14px;padding:13px 18px;font-weight:800;cursor:pointer;background:linear-gradient(135deg,#6366f1,#0ea5e9);color:white}.btn.secondary{background:#172036;border:1px solid #334155}.btn:disabled{opacity:.55;cursor:not-allowed}
  .field{display:flex;flex-direction:column;gap:7px;margin-bottom:14px}.field label{font-size:13px;font-weight:800}.field input,.field textarea{background:#090f1e;border:1px solid #334155;color:#fff;border-radius:12px;padding:12px 13px;outline:none}.field input:focus,.field textarea:focus{border-color:#818cf8}
  .notice{padding:12px 14px;border-radius:12px;background:#172554;border:1px solid #3730a3;margin:12px 0;font-size:13px}.error{background:#3f1118;border-color:#7f1d1d}.row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
  .summary{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #253047}.summary.total{font-size:18px;font-weight:900;border:0;padding-top:16px}.pay{border:1px solid #334155;border-radius:14px;padding:14px;margin:10px 0;cursor:pointer}.pay.active{border-color:#818cf8;background:#312e8144}
  .badge{display:inline-flex;padding:6px 9px;border-radius:999px;background:#1e293b;font-size:11px;font-weight:800}.qr{max-width:280px;width:100%;border-radius:16px;background:white;padding:8px}.back{background:none;border:0;color:#a5b4fc;cursor:pointer;padding:0}
  @media(max-width:800px){.grid{grid-template-columns:1fr}.title{font-size:28px}.top{padding:18px 16px}.main{padding:16px 16px 50px}.card{padding:17px}}
`}</style>
</div>
 return <div className="wrap"><header className="top"><div className="brand">iMersSUPA Checkout</div><button className="back" onClick={()=>router.push(product?`/product/${product.slug}`:'/')}>← Kembali</button></header>
 <main className="main"><form className="grid" onSubmit={submit}><section className="card"><h1 style={{marginTop:0}}>Data Pembeli</h1>
  <div className="field"><label>Nama Lengkap</label><input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></div>
  <div className="field"><label>Email</label><input type="email" required value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></div>
  <div className="field"><label>WhatsApp</label><input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="62812..."/></div>
  <div className="field"><label>Catatan (opsional)</label><textarea rows={3} value={form.note} onChange={e=>setForm({...form,note:e.target.value})}/></div>
  <div className="field"><label>Kupon / Affiliate Alias</label><div className="row"><input style={{flex:1}} value={coupon} onChange={e=>setCoupon(e.target.value.toUpperCase())} placeholder="Kode kupon"/><button type="button" className="btn secondary" onClick={()=>refreshQuote()}>Terapkan</button></div></div>
  {error&&<div className="notice error">{error}</div>}
 </section>
 <aside className="card" style={{alignSelf:'start'}}><span className="badge">ORDER SUMMARY</span><h2>{product?.name}</h2>
  <div className="summary"><span>Subtotal</span><strong>{money(quote?.subtotal)}</strong></div><div className="summary"><span>Diskon</span><strong>- {money(quote?.discount_amount)}</strong></div>
  {quote?.coupon&&<div className="notice">Kupon aktif: <strong>{quote.coupon.code}</strong></div>}{quote?.affiliate&&<div className="notice">Affiliate: <strong>{quote.affiliate.name}</strong></div>}
  <div className="summary total"><span>Total</span><span>{money(quote?.total_amount)}</span></div>
  <button className="btn" disabled={busy||!quote} style={{width:'100%',marginTop:12}}>{busy?'Membuat Order...':'Lanjut Pembayaran →'}</button>
 </aside></form></main>
<style jsx global>{`
  *{box-sizing:border-box} body{margin:0;background:#070b17;color:#e8ecf7;font-family:Inter,Arial,sans-serif}
  button,input,textarea{font:inherit}.wrap{min-height:100vh;background:radial-gradient(circle at 10% 0,#312e8155,transparent 32%),radial-gradient(circle at 90% 10%,#0ea5e955,transparent 30%),#070b17}
  .top{max-width:1120px;margin:auto;padding:24px 20px;display:flex;justify-content:space-between;align-items:center}.brand{font-weight:900;font-size:18px}.muted{color:#94a3b8}
  .main{max-width:1120px;margin:auto;padding:24px 20px 70px}.card{background:linear-gradient(135deg,#11182c,#0c1223);border:1px solid #27324a;border-radius:22px;padding:22px;box-shadow:0 18px 55px #0005}
  .grid{display:grid;grid-template-columns:1.35fr .85fr;gap:22px}.title{font-size:34px;line-height:1.15;margin:8px 0 12px}.price{font-size:27px;font-weight:900;margin:14px 0}.desc{line-height:1.75;color:#cbd5e1;white-space:pre-wrap}
  .img{width:100%;aspect-ratio:16/10;object-fit:cover;border-radius:18px;background:#121a2d;border:1px solid #27324a}.btn{border:0;border-radius:14px;padding:13px 18px;font-weight:800;cursor:pointer;background:linear-gradient(135deg,#6366f1,#0ea5e9);color:white}.btn.secondary{background:#172036;border:1px solid #334155}.btn:disabled{opacity:.55;cursor:not-allowed}
  .field{display:flex;flex-direction:column;gap:7px;margin-bottom:14px}.field label{font-size:13px;font-weight:800}.field input,.field textarea{background:#090f1e;border:1px solid #334155;color:#fff;border-radius:12px;padding:12px 13px;outline:none}.field input:focus,.field textarea:focus{border-color:#818cf8}
  .notice{padding:12px 14px;border-radius:12px;background:#172554;border:1px solid #3730a3;margin:12px 0;font-size:13px}.error{background:#3f1118;border-color:#7f1d1d}.row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
  .summary{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #253047}.summary.total{font-size:18px;font-weight:900;border:0;padding-top:16px}.pay{border:1px solid #334155;border-radius:14px;padding:14px;margin:10px 0;cursor:pointer}.pay.active{border-color:#818cf8;background:#312e8144}
  .badge{display:inline-flex;padding:6px 9px;border-radius:999px;background:#1e293b;font-size:11px;font-weight:800}.qr{max-width:280px;width:100%;border-radius:16px;background:white;padding:8px}.back{background:none;border:0;color:#a5b4fc;cursor:pointer;padding:0}
  @media(max-width:800px){.grid{grid-template-columns:1fr}.title{font-size:28px}.top{padding:18px 16px}.main{padding:16px 16px 50px}.card{padding:17px}}
`}</style>
</div>
}
