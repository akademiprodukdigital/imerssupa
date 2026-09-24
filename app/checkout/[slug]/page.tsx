'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '../../../lib/supabase'

type Product={id:string;name:string;slug:string;description:string|null;price:number|string|null;status:string}
type Quote={currency:string;subtotal:number|string;discount_amount:number|string;total_amount:number|string;coupon?:{code:string}|null;affiliate?:{name:string}|null;items:any[]}

const money=(v:any)=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(v||0))

function visitorKey(){
  let v=localStorage.getItem('imerssupa_visitor_key')
  if(!v){v=crypto.randomUUID();localStorage.setItem('imerssupa_visitor_key',v)}
  return v
}

export default function CheckoutPage(){
 const params=useParams();const router=useRouter();const qs=useSearchParams();const slug=String(params.slug||'')
 const [product,setProduct]=useState<Product|null>(null);const [quote,setQuote]=useState<Quote|null>(null);const [coupon,setCoupon]=useState(qs.get('coupon')||'')
 const [form,setForm]=useState({name:'',email:'',phone:'',note:''});const [loading,setLoading]=useState(true);const [busy,setBusy]=useState(false);const [error,setError]=useState('')

 useEffect(()=>{void load()},[slug])

 async function load(){
  setLoading(true);setError('')
  const p=await supabase.from('products').select('id,name,slug,description,price,status').eq('slug',slug).eq('status','published').maybeSingle()
  if(p.error||!p.data){setError(p.error?.message||'Produk tidak ditemukan.');setLoading(false);return}
  setProduct(p.data as Product)
  const u=await supabase.auth.getUser()
  if(u.data.user){const pr=await supabase.from('profiles').select('full_name,phone').eq('id',u.data.user.id).maybeSingle();setForm(x=>({...x,name:pr.data?.full_name||x.name,email:u.data.user?.email||x.email,phone:pr.data?.phone||x.phone}))}
  await refreshQuote(p.data.id,coupon);setLoading(false)
 }
 async function refreshQuote(productId=product?.id,code=coupon){
  if(!productId)return
  const r=await supabase.rpc('get_checkout_quote',{p_items:[{product_id:productId,quantity:1}],p_coupon_code:code.trim()||null,p_visitor_key:visitorKey()})
  if(r.error){setError(r.error.message);setQuote(null);return}setError('');setQuote(r.data as Quote)
 }
 async function submit(e:FormEvent){
  e.preventDefault();if(!product||!quote)return;setBusy(true);setError('')
  const r=await supabase.rpc('create_checkout_order_secure',{p_items:[{product_id:product.id,quantity:1}],p_buyer_name:form.name.trim(),p_buyer_email:form.email.trim().toLowerCase(),p_buyer_phone:form.phone.trim()||null,p_coupon_code:coupon.trim()||null,p_visitor_key:visitorKey(),p_customer_note:form.note.trim()||null,p_idempotency_key:crypto.randomUUID()})
  if(r.error){setError(r.error.message);setBusy(false);return}
  const o=r.data as any;if(o.checkout_token)sessionStorage.setItem(`imerssupa_checkout_${o.order_id}`,o.checkout_token)
  router.push(`/checkout/order/${o.order_id}`);setBusy(false)
 }

 if(loading)return <><style dangerouslySetInnerHTML={{__html:styles}} /><div className="wrap"><div className="main"><div className="card loading">Menyiapkan checkout...</div></div></div></>

 return <>
  <style dangerouslySetInnerHTML={{__html:styles}} />
  <div className="wrap">
  <header className="top"><div className="brand"><span className="brandmark">S</span><div><strong>iMersSUPA</strong><small>Checkout</small></div></div><button className="back" onClick={()=>router.push(product?`/product/${product.slug}`:'/')}>← Kembali</button></header>
  <main className="main">
   <div className="intro"><div className="eyebrow">SECURE CHECKOUT</div><h1>Selesaikan Pesanan Anda</h1><p>Lengkapi data di bawah untuk melanjutkan pembelian.</p></div>
   <form className="grid" onSubmit={submit}>
    <section className="card">
     <div className="cardhead"><span className="step">01</span><div><h2>Data Pembeli</h2><p>Informasi ini digunakan untuk proses order dan akses produk.</p></div></div>
     <div className="fields">
      <div className="field"><label>Nama Lengkap</label><input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Nama lengkap Anda"/></div>
      <div className="field"><label>Email</label><input type="email" required value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="nama@email.com"/></div>
      <div className="field"><label>WhatsApp</label><input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="62812..."/></div>
      <div className="field"><label>Catatan <span>(opsional)</span></label><textarea rows={3} value={form.note} onChange={e=>setForm({...form,note:e.target.value})} placeholder="Tambahkan catatan jika diperlukan..."/></div>
     </div>
     <div className="couponbox"><div><b>Kupon / Affiliate Alias</b><span> Punya kode promo?</span></div><div className="couponrow"><input value={coupon} onChange={e=>setCoupon(e.target.value.toUpperCase())} placeholder="Masukkan kode kupon"/><button type="button" className="btn secondary" onClick={()=>refreshQuote()}>Terapkan</button></div></div>
     {error&&<div className="notice error"><span>!</span><div>{error}</div></div>}
    </section>
    <aside className="card summarycard">
     <div className="summaryhead"><span className="badge">ORDER SUMMARY</span><span className="secure">● Secure</span></div>
     <h2>{product?.name}</h2>
     {product?.description&&<p className="productdesc">{product.description}</p>}
     <div className="summaryrows"><div><span>Subtotal</span><strong>{money(quote?.subtotal)}</strong></div><div><span>Diskon</span><strong className="discount">- {money(quote?.discount_amount)}</strong></div></div>
     {quote?.coupon&&<div className="softnotice">✓ Kupon aktif: <strong>{quote.coupon.code}</strong></div>}
     {quote?.affiliate&&<div className="softnotice">✓ Affiliate: <strong>{quote.affiliate.name}</strong></div>}
     <div className="total"><span>Total Pembayaran</span><strong>{money(quote?.total_amount)}</strong></div>
     <button className="btn primary" disabled={busy||!quote}>{busy?'Membuat Order...':'Lanjut Pembayaran →'}</button>
     <div className="trust">🔒 Data checkout diproses secara aman</div>
    </aside>
   </form>
  </main>
 </div>
 </div>
 </>

}

const styles=`
*{box-sizing:border-box}body{margin:0;background:#f5f7fb;color:#17213b;font-family:Inter,Arial,sans-serif}button,input,textarea{font:inherit}button{cursor:pointer}
.wrap{min-height:100vh;background:radial-gradient(circle at 8% 0,rgba(99,102,241,.10),transparent 28%),radial-gradient(circle at 94% 8%,rgba(14,165,233,.10),transparent 27%),linear-gradient(180deg,#f8faff 0%,#f5f7fb 55%,#fff 100%)}
.top{max-width:1120px;margin:auto;padding:22px 20px;display:flex;justify-content:space-between;align-items:center}.brand{display:flex;align-items:center;gap:11px}.brandmark{width:38px;height:38px;border-radius:11px;display:grid;place-items:center;color:#fff;font-weight:950;background:linear-gradient(135deg,#14b8a6,#3b82f6 52%,#7c3aed);box-shadow:0 8px 22px rgba(59,130,246,.22)}.brand strong{display:block;font-size:17px}.brand small{display:block;color:#8a95a8;font-size:10px;margin-top:2px}
.back{border:1px solid #dfe5ef;background:#fff;color:#45536d;border-radius:11px;padding:10px 14px;font-weight:800;box-shadow:0 5px 18px rgba(30,45,80,.05)}
.main{max-width:1120px;margin:auto;padding:28px 20px 75px}.intro{margin-bottom:24px}.eyebrow{font-size:10px;font-weight:950;letter-spacing:.15em;color:#5867e8}.intro h1{font-size:34px;letter-spacing:-.035em;margin:7px 0;color:#17213b}.intro p{margin:0;color:#77839a;font-size:14px}
.grid{display:grid;grid-template-columns:1.35fr .85fr;gap:20px;align-items:start}.card{background:rgba(255,255,255,.94);border:1px solid #e3e8f1;border-radius:22px;padding:24px;box-shadow:0 18px 55px rgba(39,54,86,.08)}
.cardhead{display:flex;gap:13px;align-items:flex-start;border-bottom:1px solid #edf0f5;padding-bottom:19px;margin-bottom:21px}.step{width:35px;height:35px;border-radius:10px;display:grid;place-items:center;background:#eef2ff;color:#5867e8;font-size:11px;font-weight:950}.card h2{font-size:19px;margin:0 0 5px}.cardhead p{margin:0;color:#8993a7;font-size:12px;line-height:1.5}
.fields{display:grid;grid-template-columns:1fr 1fr;gap:0 14px}.field{display:flex;flex-direction:column;gap:7px;margin-bottom:15px}.field label{font-size:12px;font-weight:850;color:#46536b}.field label span{color:#9aa3b3;font-weight:500}.field input,.field textarea,.couponrow input{background:#fff;border:1px solid #dce2ec;color:#17213b;border-radius:11px;padding:12px 13px;outline:none;transition:.18s}.field textarea{resize:vertical;min-height:86px}.field input:focus,.field textarea:focus,.couponrow input:focus{border-color:#7786ef;box-shadow:0 0 0 3px rgba(99,102,241,.09)}
.couponbox{margin-top:5px;padding:16px;border:1px solid #e7eaf2;border-radius:15px;background:#fafbfe}.couponbox b{font-size:12px}.couponbox span{color:#929bad;font-size:11px}.couponrow{display:flex;gap:9px;margin-top:10px}.couponrow input{flex:1}
.btn{border:0;border-radius:12px;padding:12px 16px;font-weight:900}.btn.primary{background:linear-gradient(135deg,#5268ff,#7548ec 58%,#168eea);color:#fff;box-shadow:0 10px 25px rgba(84,99,235,.22)}.btn.secondary{background:#fff;border:1px solid #dce2ec;color:#4e5a72}.btn:disabled{opacity:.55;cursor:not-allowed}
.notice{display:flex;gap:10px;padding:12px 14px;border-radius:12px;margin-top:14px;font-size:12px}.notice.error{background:#fff2f2;border:1px solid #ffd3d3;color:#bd3d48}
.summarycard{position:sticky;top:88px}.summaryhead{display:flex;justify-content:space-between;align-items:center}.badge{display:inline-flex;padding:6px 9px;border-radius:999px;background:#eef2ff;color:#5867e8;font-size:9px;font-weight:950;letter-spacing:.04em}.secure{font-size:10px;color:#39a878;font-weight:800}.summarycard h2{font-size:20px;line-height:1.35;margin:18px 0 5px}.productdesc{color:#8993a7;font-size:12px;line-height:1.55;margin:0 0 17px}.summaryrows{border-top:1px solid #edf0f5}.summaryrows>div{display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid #edf0f5;font-size:13px}.summaryrows span{color:#758198}.summaryrows strong{color:#26334c}.summaryrows .discount{color:#2eaa79}.softnotice{padding:10px 12px;border-radius:10px;background:#f0fbf6;color:#238761;border:1px solid #d2f0e2;font-size:11px;margin-top:10px}.total{display:flex;justify-content:space-between;align-items:end;padding:18px 0 15px;margin-top:5px;border-top:1px solid #e6eaf1}.total span{font-size:12px;color:#718098}.total strong{font-size:25px;letter-spacing:-.03em;color:#18253e}.summarycard>.btn{width:100%;padding:14px}.trust{text-align:center;color:#9aa4b5;font-size:10px;margin-top:12px}.loading{max-width:1120px;margin:auto}
@media(max-width:800px){.grid{grid-template-columns:1fr}.summarycard{position:static}.fields{grid-template-columns:1fr}.main{padding:20px 16px 55px}.top{padding:17px 16px}.intro h1{font-size:28px}}
@media(max-width:520px){.couponrow{flex-direction:column}.couponrow .btn{width:100%}.card{padding:18px}.summarycard h2{font-size:18px}}
`
