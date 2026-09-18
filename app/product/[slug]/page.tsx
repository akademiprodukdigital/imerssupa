'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '../../../lib/supabase'

type Product={id:string;name:string;slug:string;description:string|null;price:number|string|null;status:string;cover_url?:string|null;thumbnail_url?:string|null;image_url?:string|null;type?:string|null}
type Media={url?:string|null;media_url?:string|null;is_primary?:boolean;media_type?:string}

const money=(v:any)=>Number(v||0)===0?'GRATIS':new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(v||0))

export default function PublicProductPage(){
 const params=useParams(); const router=useRouter(); const qs=useSearchParams()
 const slug=String(params.slug||''); const [product,setProduct]=useState<Product|null>(null); const [image,setImage]=useState(''); const [loading,setLoading]=useState(true); const [error,setError]=useState('')
 useEffect(()=>{void load()},[slug])
 async function load(){
  setLoading(true); setError('')
  const r=await supabase.from('products').select('*').eq('slug',slug).eq('status','published').maybeSingle()
  if(r.error||!r.data){setError(r.error?.message||'Produk tidak ditemukan.');setLoading(false);return}
  const p=r.data as Product; setProduct(p)
  setImage(p.cover_url||p.thumbnail_url||p.image_url||'')
  const m=await supabase.from('product_media').select('*').eq('product_id',p.id).eq('media_type','image').order('is_primary',{ascending:false}).limit(1)
  if(m.data?.[0]){const x=m.data[0] as Media; setImage(x.url||x.media_url||image||'')}
  setLoading(false)
 }
 function buy(){if(!product)return; const q=new URLSearchParams(); const coupon=qs.get('coupon'); if(coupon)q.set('coupon',coupon); router.push(`/checkout/${product.slug}${q.size?'?'+q.toString():''}`)}
 if(loading)return <div className="wrap"><div className="main"><div className="card">Memuat produk...</div></div>
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
 if(error||!product)return <div className="wrap"><div className="main"><div className="card"><p className="notice error">{error||'Produk tidak ditemukan.'}</p><button className="btn secondary" onClick={()=>router.push('/')}>Kembali</button></div></div>
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
 return <div className="wrap"><header className="top"><div className="brand">iMersSUPA</div><button className="back" onClick={()=>router.push('/')}>← Marketplace</button></header>
  <main className="main"><div className="grid"><section className="card">{image?<img className="img" src={image} alt={product.name}/>:<div className="img"/>}<span className="badge" style={{marginTop:16}}>{product.type||'Digital Product'}</span><h1 className="title">{product.name}</h1><div className="desc">{product.description||'Produk digital iMersSUPA.'}</div></section>
  <aside className="card" style={{alignSelf:'start'}}><div className="muted">Harga Produk</div><div className="price">{money(product.price)}</div><p className="muted">Checkout aman. Harga, kupon dan total dihitung ulang langsung oleh server.</p><button className="btn" style={{width:'100%'}} onClick={buy}>Beli Sekarang →</button></aside></div></main>
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
