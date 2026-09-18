'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import ThemeSwitcher from '../../../components/ThemeSwitcher'

type Profile = {
  id: string
  full_name: string | null
  phone: string | null
  avatar_url: string | null
  role: string | null
  status: string | null
  created_at: string | null
  updated_at?: string | null
}


type Product = { id:string; name:string; slug:string; status:string|null }
type Section = { id:string; product_id:string; title:string; sort_order:number }
type Content = {
  id:string; product_id:string; section_id:string|null; title:string;
  content_type:'text'|'html'|'video'|'external_url'; content_text:string|null;
  external_url:string|null; sort_order:number; is_published:boolean; is_preview:boolean
}
type LessonForm = {
  id:string|null; product_id:string; section_id:string; title:string;
  content_type:'text'|'html'|'video'|'external_url'; content_text:string;
  external_url:string; sort_order:number; is_published:boolean; is_preview:boolean
}

type AccessRow = {
  id: string
  user_id: string
  product_id: string
  access_status: string | null
  expires_at: string | null
}

type Product = {
  id: string
  name: string
}

type EditForm = {
  full_name: string
  phone: string
  status: string
}

const PAGE_SIZES = [10, 25, 50, 100]

export default function AdminContentPage() {
  const router=useRouter()
  const [me,setMe]=useState<Profile|null>(null)
  const [email,setEmail]=useState('')
  const [products,setProducts]=useState<Product[]>([])
  const [sections,setSections]=useState<Section[]>([])
  const [contents,setContents]=useState<Content[]>([])
  const [productId,setProductId]=useState('')
  const [search,setSearch]=useState('')
  const [typeFilter,setTypeFilter]=useState('all')
  const [publishFilter,setPublishFilter]=useState('all')
  const [pageSize,setPageSize]=useState(25)
  const [page,setPage]=useState(1)
  const [loading,setLoading]=useState(true)
  const [saving,setSaving]=useState(false)
  const [error,setError]=useState('')
  const [notice,setNotice]=useState('')
  const [sectionTitle,setSectionTitle]=useState('')
  const [sectionModal,setSectionModal]=useState(false)
  const [lessonModal,setLessonModal]=useState(false)
  const [form,setForm]=useState<LessonForm>({id:null,product_id:'',section_id:'',title:'',content_type:'text',content_text:'',external_url:'',sort_order:0,is_published:true,is_preview:false})

  const load=async()=>{
    setLoading(true);setError('')
    const {data:auth}=await supabase.auth.getUser()
    const user=auth.user
    if(!user){router.replace('/login');return}
    setEmail(user.email??'')
    const {data:pd}=await supabase.from('profiles').select('*').eq('id',user.id).maybeSingle()
    if(!pd){router.replace('/login');return}
    const profile=pd as Profile
    if(profile.status!=='active'){await supabase.auth.signOut();router.replace('/login');return}
    if(profile.role!=='admin'&&profile.role!=='super_admin'){router.replace('/member');return}
    setMe(profile)
    const [pr,sr,cr]=await Promise.all([
      supabase.from('products').select('id,name,slug,status').order('created_at',{ascending:false}),
      supabase.from('product_sections').select('id,product_id,title,sort_order').order('sort_order',{ascending:true}),
      supabase.from('product_contents').select('id,product_id,section_id,title,content_type,content_text,external_url,sort_order,is_published,is_preview').order('sort_order',{ascending:true})
    ])
    const es:string[]=[]
    if(pr.error)es.push(`Products: ${pr.error.message}`);else{const rows=(pr.data??[]) as Product[];setProducts(rows);setProductId(v=>v||rows[0]?.id||'')}
    if(sr.error)es.push(`Sections: ${sr.error.message}`);else setSections((sr.data??[]) as Section[])
    if(cr.error)es.push(`Contents: ${cr.error.message}`);else setContents((cr.data??[]) as Content[])
    if(es.length)setError(es.join(' • '))
    setLoading(false)
  }
  useEffect(()=>{void load()},[])
  useEffect(()=>{setPage(1)},[productId,search,typeFilter,publishFilter,pageSize])

  const currentProduct=products.find(p=>p.id===productId)
  const currentSections=sections.filter(s=>s.product_id===productId)
  const currentContents=contents.filter(c=>c.product_id===productId)
  const filtered=useMemo(()=>currentContents.filter(c=>{
    const q=search.trim().toLowerCase()
    return (!q||c.title.toLowerCase().includes(q))&&(typeFilter==='all'||c.content_type===typeFilter)&&(publishFilter==='all'||(publishFilter==='published'?c.is_published:!c.is_published))
  }),[contents,productId,search,typeFilter,publishFilter])
  const totalPages=Math.max(1,Math.ceil(filtered.length/pageSize)), safePage=Math.min(page,totalPages)
  const visible=filtered.slice((safePage-1)*pageSize,safePage*pageSize)
  const published=currentContents.filter(c=>c.is_published).length
  const preview=currentContents.filter(c=>c.is_preview).length

  const openNew=()=>{setForm({id:null,product_id:productId,section_id:currentSections[0]?.id||'',title:'',content_type:'text',content_text:'',external_url:'',sort_order:currentContents.length,is_published:true,is_preview:false});setLessonModal(true)}
  const openEdit=(c:Content)=>{setForm({id:c.id,product_id:c.product_id,section_id:c.section_id||'',title:c.title,content_type:c.content_type,content_text:c.content_text||'',external_url:c.external_url||'',sort_order:c.sort_order,is_published:c.is_published,is_preview:c.is_preview});setLessonModal(true)}
  const saveSection=async()=>{if(!productId||!sectionTitle.trim())return;setSaving(true);setError('');const {error:e}=await supabase.rpc('admin_create_product_section',{p_product_id:productId,p_title:sectionTitle.trim(),p_sort_order:currentSections.length});if(e)setError(e.message);else{setSectionTitle('');setSectionModal(false);setNotice('Section berhasil ditambahkan.');await load()}setSaving(false)}
  const deleteSection=async(s:Section)=>{if(!confirm(`Hapus section "${s.title}"? Hanya bisa dihapus jika tidak memiliki materi.`))return;setSaving(true);const {error:e}=await supabase.rpc('admin_delete_product_section_safe',{p_section_id:s.id});if(e)setError(e.message);else{setNotice('Section berhasil dihapus.');await load()}setSaving(false)}
  const saveLesson=async(e:FormEvent)=>{e.preventDefault();setSaving(true);setError('');const payload={p_product_id:form.product_id,p_section_id:form.section_id||null,p_title:form.title.trim(),p_content_type:form.content_type,p_content_text:form.content_text.trim()||null,p_external_url:form.external_url.trim()||null,p_sort_order:Number(form.sort_order),p_is_published:form.is_published,p_is_preview:form.is_preview};const r=form.id?await supabase.rpc('admin_update_product_content',{p_content_id:form.id,...payload}):await supabase.rpc('admin_create_product_content',payload);if(r.error)setError(r.error.message);else{setLessonModal(false);setNotice(form.id?'Materi berhasil diperbarui.':'Materi berhasil ditambahkan.');await load()}setSaving(false)}
  const deleteLesson=async(c:Content)=>{if(!confirm(`Hapus materi "${c.title}"? Progress terkait materi ini juga dapat terpengaruh.`))return;setSaving(true);const {error:e}=await supabase.rpc('admin_delete_product_content_safe',{p_content_id:c.id});if(e)setError(e.message);else{setNotice('Materi berhasil dihapus.');await load()}setSaving(false)}
  const logout=async()=>{await supabase.auth.signOut();router.replace('/login')}
  const initials=(me?.full_name||email||'A').split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase()
  const sectionName=(id:string|null)=>sections.find(s=>s.id===id)?.title??'Tanpa Section'

  return <div className="admin-page">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">S</div><div><strong>iMersSUPA</strong><small>ADMIN CONTROL</small></div></div>
      <div className="role-card"><div className="role-icon">★</div><div><small>LOGGED IN AS</small><strong>{me?.role==='super_admin'?'Super Admin':'Admin'}</strong></div></div>
      <nav><p>MAIN MENU</p>
        <button onClick={()=>router.push('/admin')}>⌂ <span>Dashboard</span></button><button onClick={()=>router.push('/admin/members')}>◎ <span>Members</span></button><button onClick={()=>router.push('/admin/products')}>▣ <span>Products</span></button><button className="active">▶ <span>Content</span></button><button onClick={()=>router.push('/admin/access')}>◇ <span>Member Access</span></button><button onClick={()=>router.push('/admin/progress')}>↗ <span>Progress</span></button><button onClick={()=>router.push('/admin/resources')}>◆ <span>Resources</span></button>
        <p>COMMERCE</p><button onClick={()=>router.push('/admin/orders')}>▤ <span>Orders & Transactions</span></button><button onClick={()=>router.push('/admin/payments')}>◫ <span>Payments</span></button><button onClick={()=>router.push('/admin/affiliates')}>⌘ <span>Affiliate & Coupons</span></button><button onClick={()=>router.push('/admin/notifications')}>◌ <span>Notifications</span></button>
        {me?.role==='super_admin'&&<><p>SUPER ADMIN</p><button onClick={()=>router.push('/admin/administrators')}>♛ <span>Administrators</span></button><button onClick={()=>router.push('/admin/settings')}>⚙ <span>System Settings</span></button><button onClick={()=>router.push('/admin/settings/commerce')}>◈ <span>Commerce Settings</span></button><button onClick={()=>router.push('/admin/security')}>◇ <span>Security / Audit</span></button></>}
        <p>ACCOUNT</p><button onClick={()=>router.push('/admin/profile')}>◉ <span>Profile</span></button>
      </nav>
      <div className="sidebar-bottom"><button className="profile-card" onClick={()=>router.push('/admin/profile')}><span className="avatar">{initials}</span><span className="profile-copy"><strong>{me?.full_name||email.split('@')[0]}</strong><small>{email}</small></span></button><button className="logout" onClick={logout}>↗ Keluar</button></div>
    </aside>
    <main><div className="topbar"><div className="search-top">⌕ <span>Cari member, produk atau materi...</span></div><div className="top-actions"><button className="mini-profile"><span className="avatar small">{initials}</span><span><strong>{me?.full_name||email.split('@')[0]}</strong><small>{me?.role==='super_admin'?'Super Admin':'Admin'}</small></span></button><ThemeSwitcher/></div></div>
      <div className="content">
        <header><div><div className="eyebrow">CONTENT MANAGEMENT</div><h1>Content</h1><p>Susun section dan materi pembelajaran untuk setiap produk digital.</p></div><div style={{display:'flex',gap:8}}><button className="refresh" onClick={()=>setSectionModal(true)} disabled={!productId}>＋ Section</button><button className="primary" onClick={openNew} disabled={!productId}>＋ Tambah Materi</button></div></header>
        {error&&<div className="alert error">{error}</div>}{notice&&<div className="alert success">{notice}</div>}
        <section className="stats"><article className="stat blue"><div className="stat-icon">▣</div><div><span>PRODUCT</span><strong>{products.length}</strong><small>Produk tersedia</small></div></article><article className="stat purple"><div className="stat-icon">☰</div><div><span>SECTION</span><strong>{currentSections.length}</strong><small>Pada produk terpilih</small></div></article><article className="stat green"><div className="stat-icon">▶</div><div><span>PUBLISHED</span><strong>{published}</strong><small>Materi aktif</small></div></article><article className="stat pink"><div className="stat-icon">◉</div><div><span>PREVIEW</span><strong>{preview}</strong><small>Materi preview</small></div></article></section>
        <section className="panel">
          <div className="panel-head"><div><div className="eyebrow">COURSE BUILDER</div><h2>{currentProduct?.name||'Pilih Produk'}</h2><p>Section → materi → tipe konten → publish.</p></div><select value={productId} onChange={e=>setProductId(e.target.value)} style={{height:42,border:'1px solid #dfe4ef',borderRadius:11,padding:'0 12px',background:'white',minWidth:230}}>{products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
          <div style={{padding:'12px 20px',borderBottom:'1px solid #e7eaf2',display:'flex',gap:8,flexWrap:'wrap'}}>{currentSections.length?currentSections.map(s=><span key={s.id} className="summary-chip">{s.title} <button onClick={()=>void deleteSection(s)} style={{border:0,background:'transparent',cursor:'pointer'}}>×</button></span>):<span className="muted">Belum ada section.</span>}</div>
          <div className="filters"><div className="searchbox">⌕<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari judul materi..."/></div><select value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}><option value="all">Semua Tipe</option><option value="text">Text</option><option value="html">HTML</option><option value="video">Video</option><option value="external_url">External URL</option></select><select value={pageSize} onChange={e=>setPageSize(Number(e.target.value))}>{PAGE_SIZES.map(n=><option key={n} value={n}>{n} / halaman</option>)}</select></div>
          <div className="table-wrap"><table><thead><tr><th>MATERI</th><th>SECTION</th><th>TYPE</th><th>STATUS</th><th>PREVIEW</th><th>ORDER</th><th>ACTION</th></tr></thead><tbody>{loading?<tr><td colSpan={7} className="empty">Loading content...</td></tr>:visible.length===0?<tr><td colSpan={7} className="empty">Belum ada materi.</td></tr>:visible.map(c=><tr key={c.id}><td><div className="member-cell"><span className="member-avatar">▶</span><div><strong>{c.title}</strong><small>{c.external_url||'Konten internal'}</small></div></div></td><td>{sectionName(c.section_id)}</td><td>{pretty(c.content_type)}</td><td><span className={`badge ${c.is_published?'published':'draft'}`}>{c.is_published?'Published':'Draft'}</span></td><td>{c.is_preview?'Yes':'—'}</td><td>{c.sort_order}</td><td><div style={{display:'flex',gap:6}}><button className="action" onClick={()=>openEdit(c)}>Kelola</button><button className="action" onClick={()=>void deleteLesson(c)}>Hapus</button></div></td></tr>)}</tbody></table></div>
          <div className="pagination"><span>Menampilkan {filtered.length?(safePage-1)*pageSize+1:0}–{Math.min(safePage*pageSize,filtered.length)} dari {filtered.length} data</span><div><button disabled={safePage<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}>← Previous</button><strong>Page {safePage} / {totalPages}</strong><button disabled={safePage>=totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))}>Next →</button></div></div>
        </section>
      </div>
    </main>
    {sectionModal&&<div className="modal-backdrop" onMouseDown={()=>!saving&&setSectionModal(false)}><div className="modal" onMouseDown={e=>e.stopPropagation()}><div className="modal-head"><div><div className="eyebrow">NEW SECTION</div><h2>Tambah Section</h2><p>Kelompokkan materi agar course lebih terstruktur.</p></div><button className="close" onClick={()=>setSectionModal(false)}>×</button></div><div style={{padding:'20px 22px'}}><label style={{display:'block',fontSize:11,fontWeight:800}}>Nama Section<input style={{display:'block',width:'100%',height:42,border:'1px solid #dce1ec',borderRadius:10,padding:'0 11px',marginTop:6}} value={sectionTitle} onChange={e=>setSectionTitle(e.target.value)} placeholder="Contoh: Mulai Di Sini"/></label><div className="modal-actions"><button className="secondary" onClick={()=>setSectionModal(false)}>Batal</button><button className="primary" onClick={()=>void saveSection()} disabled={saving}>Simpan Section</button></div></div></div></div>}
    {lessonModal&&<div className="modal-backdrop" onMouseDown={()=>!saving&&setLessonModal(false)}><div className="modal" onMouseDown={e=>e.stopPropagation()}><div className="modal-head"><div><div className="eyebrow">{form.id?'EDIT CONTENT':'NEW CONTENT'}</div><h2>{form.id?'Kelola Materi':'Tambah Materi'}</h2><p>Text, HTML, video, dan external resource didukung.</p></div><button className="close" onClick={()=>setLessonModal(false)}>×</button></div><form onSubmit={saveLesson}><label>Judul Materi<input value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label><label>Section<select value={form.section_id} onChange={e=>setForm({...form,section_id:e.target.value})}><option value="">Tanpa Section</option>{currentSections.map(s=><option key={s.id} value={s.id}>{s.title}</option>)}</select></label><label>Tipe Konten<select value={form.content_type} onChange={e=>setForm({...form,content_type:e.target.value as LessonForm['content_type']})}><option value="text">Text</option><option value="html">HTML</option><option value="video">Video</option><option value="external_url">External URL</option></select></label>{(form.content_type==='text'||form.content_type==='html')&&<label>Isi Konten<textarea value={form.content_text} onChange={e=>setForm({...form,content_text:e.target.value})} style={{display:'block',width:'100%',minHeight:150,border:'1px solid #dce1ec',borderRadius:10,padding:11,marginTop:6}}/></label>}{(form.content_type==='video'||form.content_type==='external_url')&&<label>URL<input value={form.external_url} onChange={e=>setForm({...form,external_url:e.target.value})} placeholder="https://..."/></label>}<label>Urutan<input type="number" min="0" value={form.sort_order} onChange={e=>setForm({...form,sort_order:Number(e.target.value)})}/></label><div style={{display:'flex',gap:18,margin:'8px 0 16px'}}><label style={{display:'flex',alignItems:'center',gap:7,margin:0}}><input type="checkbox" checked={form.is_published} onChange={e=>setForm({...form,is_published:e.target.checked})} style={{width:16,height:16,margin:0}}/> Published</label><label style={{display:'flex',alignItems:'center',gap:7,margin:0}}><input type="checkbox" checked={form.is_preview} onChange={e=>setForm({...form,is_preview:e.target.checked})} style={{width:16,height:16,margin:0}}/> Free Preview</label></div><div className="modal-actions"><button type="button" className="secondary" onClick={()=>setLessonModal(false)}>Batal</button><button className="primary" type="submit" disabled={saving}>{saving?'Menyimpan...':'Simpan Materi'}</button></div></form></div></div>}
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
        .table-wrap{overflow:auto;min-height:330px}table{width:100%;border-collapse:collapse;font-size:12px}th{font-size:9.5px;letter-spacing:.09em;color:#7f8ba2;text-align:left;background:#fafbfe;padding:11px 14px;white-space:nowrap}td{padding:13px 14px;border-top:1px solid #edf0f5;color:#526078;vertical-align:middle}tbody tr:hover{background:#fbfcff}.member-cell{display:flex;align-items:center;gap:10px;min-width:180px}.member-avatar{width:35px;height:35px;border-radius:10px;background:linear-gradient(135deg,#4f5bf6,#7956f4);color:white;display:grid;place-items:center;font-weight:900}.member-cell strong{display:block;font-size:12.5px;color:#18253d}.member-cell small{display:block;font-size:9.5px;color:#929bad;margin-top:2px}.badge{display:inline-flex;padding:5px 8px;border-radius:999px;font-size:9.5px;font-weight:900;text-transform:uppercase}.badge.active,.badge.published{background:#e8f9ef;color:#16864b}.badge.inactive,.badge.draft{background:#f0f2f6;color:#707c91}.badge.suspended{background:#fff0f1;color:#d44952}.access-list strong{display:block;color:#26344d;font-size:11.5px}.access-list small{display:block;max-width:220px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:9.5px;color:#8994a8;margin-top:2px}.muted{color:#9aa3b4;font-size:11px}.action{height:32px;padding:0 11px;border:1px solid #d7d9ff;background:linear-gradient(110deg,#f1f3ff,#f8f4ff);color:#5149d9;border-radius:9px;font-size:11px;font-weight:800;cursor:pointer}.empty{text-align:center;height:230px;color:#929caf}
        .pagination{display:flex;align-items:center;justify-content:space-between;gap:15px;padding:13px 20px;border-top:1px solid #e7eaf2;color:#8a95a8;font-size:10.5px}.pagination div{display:flex;align-items:center;gap:9px}.pagination button{height:32px;padding:0 10px;border:1px solid #e0e4ed;background:white;border-radius:9px;font-size:10px;color:#66738a}.pagination button:disabled{opacity:.4}.pagination strong{font-size:10.5px;color:#59667e}
        .modal-backdrop{position:fixed;inset:0;background:rgba(20,28,48,.38);backdrop-filter:blur(5px);z-index:80;display:grid;place-items:center;padding:20px}.modal{width:min(560px,100%);max-height:90vh;overflow:auto;background:#fbfcff;border:1px solid #e1e5ef;border-radius:20px;box-shadow:0 30px 80px rgba(29,36,64,.24)}.modal-head{padding:20px 22px 15px;border-bottom:1px solid #e8ebf2;display:flex;justify-content:space-between;gap:15px}.modal-head h2{font-size:22px;margin:4px 0}.modal-head p{font-size:12px;color:#7d899f;margin:0}.close{width:34px;height:34px;border:1px solid #dfe3ec;background:white;border-radius:10px;font-size:20px;cursor:pointer}.modal form{padding:20px 22px}.modal label{display:block;font-size:11px;font-weight:800;color:#45536c;margin-bottom:13px}.modal input,.modal select{display:block;width:100%;height:42px;border:1px solid #dce1ec;border-radius:10px;background:white;padding:0 11px;margin-top:6px;font-size:12px;outline:0}.member-info{border:1px solid #e0e4ed;background:linear-gradient(135deg,#f7f9ff,#fbf8ff);border-radius:13px;padding:13px;margin-top:5px}.member-info>span{font-size:9px;letter-spacing:.12em;color:#7269e8;font-weight:900}.member-info div{display:flex;justify-content:space-between;gap:10px;padding:9px 0;border-bottom:1px solid #e8eaf2}.member-info div:last-child{border-bottom:0}.member-info strong{font-size:11.5px}.member-info small{font-size:10px;color:#8590a5}.member-info p{font-size:11px;color:#8994a8;margin:9px 0 2px}.modal-actions{display:flex;justify-content:flex-end;gap:9px;margin-top:18px}.modal-actions button{height:40px;padding:0 14px;border-radius:10px;font-size:11.5px;font-weight:850;cursor:pointer}.secondary{border:1px solid #dfe3ec;background:white;color:#56637a}.primary{border:0;background:linear-gradient(135deg,#5b59f6,#7650ef);color:white}
        @media(max-width:1100px){.stats{grid-template-columns:repeat(2,1fr)}.filters{grid-template-columns:1fr 150px}.filters select:last-child{grid-column:2}.sidebar{width:235px}main{margin-left:235px}}
        @media(max-width:820px){.sidebar{display:none}main{margin-left:0}.topbar{padding:0 16px}.search-top{display:none}.content{padding:22px 15px 40px}.stats{grid-template-columns:1fr 1fr}.filters{grid-template-columns:1fr}.filters select:last-child{grid-column:auto}.pagination{align-items:flex-start;flex-direction:column}header h1{font-size:27px}}
        @media(max-width:520px){.stats{grid-template-columns:1fr}.mini-profile span:last-child{display:none}.panel-head{align-items:flex-start;flex-direction:column}.modal-backdrop{padding:10px}}
      `}</style>
    </div>
  )
}

function pretty(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function date(value?: string | null) {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '—'
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(parsed)
}
