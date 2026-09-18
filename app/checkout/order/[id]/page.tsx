'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '../../../../lib/supabase'

type Method={payment_method_id:string;name:string;code:string;type:string;description:string|null;instructions:string|null;account_name:string|null;account_number:string|null;qris_image_url:string|null;provider_name:string|null;fee_amount:number|string;amount_due:number|string}
type Order={id:string;order_number:string;buyer_name:string;currency:string;subtotal:number|string;discount_amount:number|string;total_amount:number|string;payment_fee:number|string;grand_total:number|string;coupon_code:string|null;status:string;payment_status:string;items:any[]}
type Tx={id:string;order_id:string;order_number:string;payment_method_name:string;payment_method_type:string;base_amount:number|string;fee_amount:number|string;amount_due:number|string;status:string;instructions:string|null;account_name:string|null;account_number:string|null;qris_image_url:string|null;proof_url:string|null;rejection_reason:string|null}
const money=(v:any)=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(v||0))

export default function OrderPaymentPage(){
 const params=useParams();const router=useRouter();const id=String(params.id||'')
 const [order,setOrder]=useState<Order|null>(null);const [methods,setMethods]=useState<Method[]>([]);const [selected,setSelected]=useState('');const [tx,setTx]=useState<Tx|null>(null)
 const [proof,setProof]=useState('');const [payer,setPayer]=useState('');const [account,setAccount]=useState('');const [note,setNote]=useState('');const [loading,setLoading]=useState(true);const [busy,setBusy]=useState(false);const [error,setError]=useState('')
 const token=()=>typeof window==='undefined'?null:sessionStorage.getItem(`imerssupa_checkout_${id}`)
 useEffect(()=>{void load()},[id])
 async function load(){
  setLoading(true);setError('');const t=token()
  const o=await supabase.rpc('get_checkout_order_secure',{p_order_id:id,p_checkout_token:t})
  if(o.error){setError(o.error.message);setLoading(false);return};setOrder(o.data as Order);setPayer((o.data as Order).buyer_name||'')
  const m=await supabase.rpc('get_available_payment_methods_secure',{p_order_id:id,p_checkout_token:t})
  if(!m.error)setMethods((m.data||[]) as Method[]);setLoading(false)
 }
 async function choose(methodId:string){setBusy(true);setError('');setSelected(methodId);const r=await supabase.rpc('select_order_payment_method_secure',{p_order_id:id,p_payment_method_id:methodId,p_checkout_token:token()})
  if(r.error){setError(r.error.message);setBusy(false);return};const d=r.data as any;const detail=await supabase.rpc('get_payment_transaction_secure',{p_payment_transaction_id:d.payment_transaction_id,p_checkout_token:token()})
  if(detail.error)setError(detail.error.message);else setTx(detail.data as Tx);await loadOrderOnly();setBusy(false)
 }
 async function loadOrderOnly(){const o=await supabase.rpc('get_checkout_order_secure',{p_order_id:id,p_checkout_token:token()});if(!o.error)setOrder(o.data as Order)}
 async function submitProof(e:FormEvent){e.preventDefault();if(!tx)return;setBusy(true);setError('');const r=await supabase.rpc('submit_manual_payment_proof_secure',{p_payment_transaction_id:tx.id,p_proof_url:proof.trim(),p_checkout_token:token(),p_payer_name:payer.trim()||null,p_payer_account:account.trim()||null,p_payer_note:note.trim()||null})
  if(r.error){setError(r.error.message);setBusy(false);return};const d=await supabase.rpc('get_payment_transaction_secure',{p_payment_transaction_id:tx.id,p_checkout_token:token()});if(!d.error)setTx(d.data as Tx);await loadOrderOnly();setBusy(false)
 }
 if(loading)return <div className="wrap"><div className="main"><div className="card">Memuat pembayaran...</div></div>
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
 if(error&&!order)return <div className="wrap"><div className="main"><div className="card"><div className="notice error">{error}</div><button className="btn" onClick={()=>router.push('/')}>Marketplace</button></div></div>
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
 const closed=order?.payment_status==='paid'||order?.status==='completed'
 return <div className="wrap"><header className="top"><div className="brand">iMersSUPA Payment</div><button className="back" onClick={()=>router.push('/')}>Marketplace</button></header><main className="main"><div className="grid">
  <section className="card"><span className="badge">{order?.order_number}</span><h1>Payment</h1>{error&&<div className="notice error">{error}</div>}
   {closed?<div className="notice"><strong>Pembayaran selesai.</strong><br/>Akses produk akan mengikuti proses settlement sistem.</div>:<>
    <h3>Pilih Metode Pembayaran</h3>{methods.length===0&&!tx&&<div className="notice">Belum ada metode pembayaran aktif untuk order ini.</div>}
    {methods.map(m=><div key={m.payment_method_id} className={`pay ${selected===m.payment_method_id?'active':''}`} onClick={()=>!busy&&choose(m.payment_method_id)}><div className="row" style={{justifyContent:'space-between'}}><strong>{m.name}</strong><span className="badge">{m.type}</span></div><div className="muted" style={{marginTop:6}}>{m.description||m.provider_name||m.code}</div><div style={{marginTop:8,fontWeight:800}}>Total: {money(m.amount_due)}</div></div>)}
   </>}
   {tx&&<div className="card" style={{marginTop:18}}><h3 style={{marginTop:0}}>{tx.payment_method_name}</h3><div className="summary"><span>Total Bayar</span><strong>{money(tx.amount_due)}</strong></div>
    {tx.account_name&&<div className="summary"><span>Atas Nama</span><strong>{tx.account_name}</strong></div>}{tx.account_number&&<div className="summary"><span>No. Rekening/Akun</span><strong>{tx.account_number}</strong></div>}
    {tx.qris_image_url&&<div style={{textAlign:'center',margin:'16px 0'}}><img className="qr" src={tx.qris_image_url} alt="QRIS"/></div>}{tx.instructions&&<div className="notice">{tx.instructions}</div>}
    {tx.status==='waiting_verification'?<div className="notice"><strong>Bukti sudah dikirim.</strong><br/>Menunggu verifikasi Admin.</div>:tx.status==='paid'?<div className="notice">Pembayaran sudah terverifikasi.</div>:<form onSubmit={submitProof}>
      <div className="field"><label>URL Bukti Pembayaran</label><input type="url" required value={proof} onChange={e=>setProof(e.target.value)} placeholder="https://..."/></div>
      <div className="field"><label>Nama Pembayar</label><input value={payer} onChange={e=>setPayer(e.target.value)}/></div><div className="field"><label>Rekening/Akun Pengirim (opsional)</label><input value={account} onChange={e=>setAccount(e.target.value)}/></div>
      <div className="field"><label>Catatan (opsional)</label><textarea rows={2} value={note} onChange={e=>setNote(e.target.value)}/></div>{tx.rejection_reason&&<div className="notice error">Ditolak: {tx.rejection_reason}</div>}
      <button className="btn" disabled={busy}>{busy?'Mengirim...':'Kirim Bukti Pembayaran'}</button>
    </form>}
   </div>}
  </section>
  <aside className="card" style={{alignSelf:'start'}}><h3 style={{marginTop:0}}>Ringkasan Order</h3>{order?.items?.map(x=><div className="summary" key={x.id}><span>{x.product_name} × {x.quantity}</span><strong>{money(x.line_total)}</strong></div>)}
   <div className="summary"><span>Subtotal</span><strong>{money(order?.subtotal)}</strong></div><div className="summary"><span>Diskon</span><strong>- {money(order?.discount_amount)}</strong></div><div className="summary"><span>Fee Payment</span><strong>{money(order?.payment_fee)}</strong></div>
   <div className="summary total"><span>Grand Total</span><span>{money(order?.grand_total||order?.total_amount)}</span></div><div className="notice">Status: <strong>{order?.payment_status}</strong></div>
  </aside></div></main>
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
