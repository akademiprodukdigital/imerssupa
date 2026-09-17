'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../../lib/supabase'
import ThemeSwitcher from '../../../../components/ThemeSwitcher'

type HomepageMode = 'marketplace' | 'custom_html' | 'off'

type HomepageConfig = {
  mode: HomepageMode
  brand_name: string
  brand_tagline: string
  logo_url: string
  icon_url: string
  hero_badge: string
  hero_title: string
  hero_highlight: string
  hero_description: string
  primary_cta_text: string
  primary_cta_url: string
  secondary_cta_text: string
  secondary_cta_url: string
  featured_title: string
  featured_description: string
  latest_title: string
  latest_description: string
  search_placeholder: string
  empty_products_text: string
  product_detail_text: string
  member_product_text: string
  heading_font: string
  body_font: string
  primary_color: string
  secondary_color: string
  accent_color: string
  background_start: string
  background_end: string
  card_radius: string
  login_text: string
  member_area_text: string
  footer_text: string
  custom_html: string
}

type Profile = {
  id: string
  full_name: string | null
  role: string | null
  status: string | null
}

const defaults: HomepageConfig = {
  mode: 'marketplace',
  brand_name: 'iMersSUPA',
  brand_tagline: 'Digital Product Marketplace',
  logo_url: '',
  icon_url: '',
  hero_badge: 'DIGITAL PRODUCT MARKETPLACE',
  hero_title: 'Temukan Produk Digital Pilihan',
  hero_highlight: 'Untuk Membantu Anda Bertumbuh.',
  hero_description: 'Jelajahi koleksi produk digital, materi pembelajaran, resource dan berbagai konten pilihan dalam satu platform.',
  primary_cta_text: 'Jelajahi Produk',
  primary_cta_url: '#products',
  secondary_cta_text: 'Masuk Member',
  secondary_cta_url: '/login',
  featured_title: 'Produk Unggulan',
  featured_description: 'Pilihan produk digital untuk Anda.',
  latest_title: 'Produk Terbaru',
  latest_description: 'Temukan koleksi terbaru kami.',
  search_placeholder: 'Cari produk digital...',
  empty_products_text: 'Belum ada produk yang tersedia.',
  product_detail_text: 'Lihat Detail',
  member_product_text: 'Buka Produk',
  heading_font: 'Poppins',
  body_font: 'Inter',
  primary_color: '#6366f1',
  secondary_color: '#7c3aed',
  accent_color: '#38bdf8',
  background_start: '#030712',
  background_end: '#111827',
  card_radius: '20px',
  login_text: 'Login',
  member_area_text: 'Member Area',
  footer_text: 'Digital Product Marketplace',
  custom_html: '',
}

const fontOptions = ['Poppins', 'Inter', 'Montserrat', 'Plus Jakarta Sans', 'Arial', 'Georgia']

export default function HomepageSettingsPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [config, setConfig] = useState<HomepageConfig>(defaults)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'general'|'copy'|'design'|'html'>('general')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/login'); return }

    const { data: p } = await supabase
      .from('profiles')
      .select('id, full_name, role, status')
      .eq('id', user.id)
      .maybeSingle()

    if (!p || p.status !== 'active') {
      await supabase.auth.signOut()
      router.replace('/login')
      return
    }
    if (p.role !== 'super_admin') {
      router.replace('/admin')
      return
    }
    setProfile(p as Profile)

    const { data, error: settingError } = await supabase
      .from('platform_settings')
      .select('setting_value')
      .eq('setting_group', 'homepage')
      .eq('setting_key', 'config')
      .maybeSingle()

    if (settingError) setError(settingError.message)
    if (data?.setting_value) {
      setConfig({ ...defaults, ...(data.setting_value as Partial<HomepageConfig>) })
    }
    setLoading(false)
  }

  function patch<K extends keyof HomepageConfig>(key: K, value: HomepageConfig[K]) {
    setConfig(prev => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  async function save() {
    setSaving(true)
    setError('')
    setSaved(false)

    const { error } = await supabase
      .from('platform_settings')
      .update({ setting_value: config })
      .eq('setting_group', 'homepage')
      .eq('setting_key', 'config')

    if (error) setError(error.message)
    else setSaved(true)
    setSaving(false)
  }

  const previewStyle = useMemo(() => ({
    '--p': config.primary_color,
    '--s': config.secondary_color,
    '--a': config.accent_color,
    '--b1': config.background_start,
    '--b2': config.background_end,
    '--r': config.card_radius,
  }) as React.CSSProperties, [config])

  if (loading) return (
    <>
      <main className="load"><ThemeSwitcher/><div><b>Homepage Settings</b><span>Memuat konfigurasi white-label...</span></div></main>
      <Styles/>
    </>
  )

  return (
    <>
      <div className="page">
        <ThemeSwitcher/>
        <header className="top">
          <div>
            <button onClick={() => router.push('/admin/settings')}>← System Settings</button>
            <span>SUPER ADMIN / HOMEPAGE</span>
          </div>
          <div className="topActions">
            <button className="ghost" onClick={() => window.open('/', '_blank')}>Preview Live ↗</button>
            <button className="save" onClick={save} disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan Perubahan'}</button>
          </div>
        </header>

        <main className="wrap">
          <section className="hero">
            <div>
              <span>WHITE-LABEL HOMEPAGE</span>
              <h1>Homepage <em>Control Center.</em></h1>
              <p>Atur marketplace bawaan, branding, copywriting, font, warna dan landing page Custom HTML tanpa mengedit source.</p>
            </div>
            <div className="status">
              <small>MODE AKTIF</small>
              <strong>{config.mode === 'marketplace' ? 'Marketplace' : config.mode === 'custom_html' ? 'Custom HTML' : 'Homepage OFF'}</strong>
              <span>● {saved ? 'Perubahan tersimpan' : 'Siap dikonfigurasi'}</span>
            </div>
          </section>

          {error && <div className="alert">⚠ {error}</div>}
          {saved && <div className="success">✓ Homepage settings berhasil disimpan.</div>}

          <section className="modeGrid">
            <ModeCard active={config.mode==='marketplace'} icon="▦" title="Marketplace" desc="Homepage katalog produk digital bawaan." onClick={()=>patch('mode','marketplace')}/>
            <ModeCard active={config.mode==='custom_html'} icon="〈/〉" title="Custom HTML" desc="Gunakan single HTML landing page milik client." onClick={()=>patch('mode','custom_html')}/>
            <ModeCard active={config.mode==='off'} icon="○" title="Homepage OFF" desc="Nonaktifkan homepage publik dan arahkan visitor ke login." onClick={()=>patch('mode','off')}/>
          </section>

          <div className="tabs">
            <button className={activeTab==='general'?'active':''} onClick={()=>setActiveTab('general')}>Brand & Navigation</button>
            <button className={activeTab==='copy'?'active':''} onClick={()=>setActiveTab('copy')}>Copywriting</button>
            <button className={activeTab==='design'?'active':''} onClick={()=>setActiveTab('design')}>Design</button>
            <button className={activeTab==='html'?'active':''} onClick={()=>setActiveTab('html')}>Custom HTML</button>
          </div>

          {activeTab==='general' && (
            <section className="panel">
              <Heading title="Brand Identity" desc="Identitas ini dibaca homepage secara dinamis."/>
              <div className="grid2">
                <Field label="Brand Name"><input value={config.brand_name} onChange={e=>patch('brand_name',e.target.value)}/></Field>
                <Field label="Brand Tagline"><input value={config.brand_tagline} onChange={e=>patch('brand_tagline',e.target.value)}/></Field>
                <Field label="Logo Image URL"><input placeholder="https://..." value={config.logo_url} onChange={e=>patch('logo_url',e.target.value)}/></Field>
                <Field label="Icon / Favicon URL"><input placeholder="https://..." value={config.icon_url} onChange={e=>patch('icon_url',e.target.value)}/></Field>
                <Field label="Login Button Text"><input value={config.login_text} onChange={e=>patch('login_text',e.target.value)}/></Field>
                <Field label="Member Area Text"><input value={config.member_area_text} onChange={e=>patch('member_area_text',e.target.value)}/></Field>
                <Field label="Footer Text" wide><input value={config.footer_text} onChange={e=>patch('footer_text',e.target.value)}/></Field>
              </div>
            </section>
          )}

          {activeTab==='copy' && (
            <section className="panel">
              <Heading title="Homepage Copywriting" desc="Tidak ada copywriting client yang perlu ditanam permanen di source."/>
              <div className="grid2">
                <Field label="Hero Badge"><input value={config.hero_badge} onChange={e=>patch('hero_badge',e.target.value)}/></Field>
                <Field label="Hero Title"><input value={config.hero_title} onChange={e=>patch('hero_title',e.target.value)}/></Field>
                <Field label="Hero Highlight" wide><input value={config.hero_highlight} onChange={e=>patch('hero_highlight',e.target.value)}/></Field>
                <Field label="Hero Description" wide><textarea rows={4} value={config.hero_description} onChange={e=>patch('hero_description',e.target.value)}/></Field>
                <Field label="Primary CTA Text"><input value={config.primary_cta_text} onChange={e=>patch('primary_cta_text',e.target.value)}/></Field>
                <Field label="Primary CTA URL"><input value={config.primary_cta_url} onChange={e=>patch('primary_cta_url',e.target.value)}/></Field>
                <Field label="Secondary CTA Text"><input value={config.secondary_cta_text} onChange={e=>patch('secondary_cta_text',e.target.value)}/></Field>
                <Field label="Secondary CTA URL"><input value={config.secondary_cta_url} onChange={e=>patch('secondary_cta_url',e.target.value)}/></Field>
                <Field label="Featured Section Title"><input value={config.featured_title} onChange={e=>patch('featured_title',e.target.value)}/></Field>
                <Field label="Featured Description"><input value={config.featured_description} onChange={e=>patch('featured_description',e.target.value)}/></Field>
                <Field label="Latest Products Title"><input value={config.latest_title} onChange={e=>patch('latest_title',e.target.value)}/></Field>
                <Field label="Latest Description"><input value={config.latest_description} onChange={e=>patch('latest_description',e.target.value)}/></Field>
                <Field label="Search Placeholder"><input value={config.search_placeholder} onChange={e=>patch('search_placeholder',e.target.value)}/></Field>
                <Field label="Empty Products Text"><input value={config.empty_products_text} onChange={e=>patch('empty_products_text',e.target.value)}/></Field>
                <Field label="Product Detail Button"><input value={config.product_detail_text} onChange={e=>patch('product_detail_text',e.target.value)}/></Field>
                <Field label="Owned Product Button"><input value={config.member_product_text} onChange={e=>patch('member_product_text',e.target.value)}/></Field>
              </div>
            </section>
          )}

          {activeTab==='design' && (
            <section className="designLayout">
              <div className="panel">
                <Heading title="Typography & Colors" desc="Buat setiap instalasi punya identitas visual berbeda."/>
                <div className="grid2">
                  <Field label="Heading Font"><select value={config.heading_font} onChange={e=>patch('heading_font',e.target.value)}>{fontOptions.map(x=><option key={x}>{x}</option>)}</select></Field>
                  <Field label="Body Font"><select value={config.body_font} onChange={e=>patch('body_font',e.target.value)}>{fontOptions.map(x=><option key={x}>{x}</option>)}</select></Field>
                  <ColorField label="Primary Color" value={config.primary_color} onChange={v=>patch('primary_color',v)}/>
                  <ColorField label="Secondary Color" value={config.secondary_color} onChange={v=>patch('secondary_color',v)}/>
                  <ColorField label="Accent Color" value={config.accent_color} onChange={v=>patch('accent_color',v)}/>
                  <Field label="Card Radius"><select value={config.card_radius} onChange={e=>patch('card_radius',e.target.value)}><option>12px</option><option>16px</option><option>20px</option><option>24px</option><option>28px</option><option>32px</option></select></Field>
                  <ColorField label="Background Start" value={config.background_start} onChange={v=>patch('background_start',v)}/>
                  <ColorField label="Background End" value={config.background_end} onChange={v=>patch('background_end',v)}/>
                </div>
              </div>

              <div className="preview" style={previewStyle}>
                <small>LIVE STYLE PREVIEW</small>
                <div className="miniNav"><b>{config.brand_name || 'Brand'}</b><span>{config.login_text}</span></div>
                <div className="miniHero">
                  <label>{config.hero_badge}</label>
                  <h3>{config.hero_title}<em>{config.hero_highlight}</em></h3>
                  <p>{config.hero_description}</p>
                  <button>{config.primary_cta_text}</button>
                </div>
              </div>
            </section>
          )}

          {activeTab==='html' && (
            <section className="panel">
              <Heading title="Custom Single HTML" desc="Paste landing page HTML lengkap. Aktifkan mode Custom HTML untuk menampilkannya."/>
              <div className="htmlNotice">Custom HTML ditampilkan dalam iframe sandbox agar tidak mendapat akses langsung ke session Supabase aplikasi.</div>
              <textarea className="code" spellCheck={false} placeholder={'<!doctype html>\n<html>...\n</html>'} value={config.custom_html} onChange={e=>patch('custom_html',e.target.value)} />
              <div className="htmlBottom">
                <span>{config.custom_html.length.toLocaleString('id-ID')} karakter</span>
                <button onClick={()=>patch('mode','custom_html')}>Aktifkan Custom HTML</button>
              </div>
            </section>
          )}

          <div className="bottomSave">
            <div><strong>Homepage Configuration</strong><span>Perubahan baru aktif setelah disimpan.</span></div>
            <button onClick={save} disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan Homepage Settings'}</button>
          </div>
        </main>
      </div>
      <Styles/>
    </>
  )
}

function ModeCard({active,icon,title,desc,onClick}:{active:boolean,icon:string,title:string,desc:string,onClick:()=>void}) {
  return <button className={`mode ${active?'active':''}`} onClick={onClick}><i>{icon}</i><span><b>{title}</b><small>{desc}</small></span><em>{active?'✓':''}</em></button>
}
function Heading({title,desc}:{title:string,desc:string}) {
  return <div className="heading"><h2>{title}</h2><p>{desc}</p></div>
}
function Field({label,children,wide=false}:{label:string,children:React.ReactNode,wide?:boolean}) {
  return <label className={`field ${wide?'wide':''}`}><span>{label}</span>{children}</label>
}
function ColorField({label,value,onChange}:{label:string,value:string,onChange:(v:string)=>void}) {
  return <label className="field"><span>{label}</span><div className="color"><input type="color" value={value} onChange={e=>onChange(e.target.value)}/><input value={value} onChange={e=>onChange(e.target.value)}/></div></label>
}

function Styles() {
  return <style jsx global>{`
    *{box-sizing:border-box}html,body{margin:0}button,input,textarea,select{font:inherit}
    .page{min-height:100vh;color:var(--text-primary);background:var(--page-gradient);font-family:Inter,Arial,sans-serif}
    .top{position:sticky;top:0;z-index:30;min-height:78px;padding:0 180px 0 32px;display:flex;align-items:center;justify-content:space-between;gap:20px;border-bottom:1px solid var(--border);background:var(--topbar-bg);backdrop-filter:blur(20px)}
    .top>div:first-child{display:flex;align-items:center;gap:18px}.top button{cursor:pointer}
    .top>div:first-child button,.ghost{padding:10px 14px;border:1px solid var(--border);border-radius:12px;color:var(--text-secondary);background:var(--surface-gradient);font-size: 13px;font-weight:800}
    .top>div:first-child span{font-size: 13px;font-weight:900;letter-spacing:1px;color:var(--text-muted)}
    .topActions{display:flex;gap:9px}.save,.bottomSave button{padding:11px 17px;border:0;border-radius:12px;color:white;background:var(--primary-gradient);font-size: 13px;font-weight:900;cursor:pointer}
    .save:disabled,.bottomSave button:disabled{opacity:.6}
    .wrap{width:min(1240px,calc(100% - 40px));margin:auto;padding:34px 0 70px}
    .hero{padding:30px;display:grid;grid-template-columns:1fr auto;align-items:center;gap:30px;border:1px solid var(--border);border-radius:26px;background:linear-gradient(120deg,rgba(59,130,246,.11),rgba(124,58,237,.11),rgba(236,72,153,.06)),var(--card-gradient);box-shadow:var(--shadow)}
    .hero>div:first-child>span,.status small{font-size: 13px;font-weight:950;letter-spacing:1.3px;color:var(--accent)}
    .hero h1{margin:7px 0 10px;font-size: 44px;line-height:1;letter-spacing:-1.8px}.hero h1 em{font-style:normal;color:transparent;background:linear-gradient(90deg,#38bdf8,#6366f1,#a855f7);background-clip:text}
    .hero p{max-width:720px;margin:0;color:var(--text-muted);font-size: 14px;line-height:1.65}
    .status{min-width:230px;padding:19px;border:1px solid var(--border);border-radius:18px;background:var(--surface-gradient);display:grid;gap:7px}.status strong{font-size: 18px}.status span{font-size: 14px;color:#22c55e}
    .alert,.success{margin-top:15px;padding:13px 15px;border-radius:13px;font-size: 13px;font-weight:700}.alert{color:#f59e0b;background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.15)}.success{color:#22c55e;background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.15)}
    .modeGrid{margin-top:18px;display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.mode{padding:17px;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:12px;text-align:left;color:var(--text-primary);border:1px solid var(--border);border-radius:18px;background:var(--card-gradient);cursor:pointer}.mode.active{border-color:rgba(99,102,241,.45);background:linear-gradient(135deg,rgba(59,130,246,.13),rgba(124,58,237,.12)),var(--card-gradient);box-shadow:0 15px 40px rgba(79,70,229,.09)}.mode i{width:44px;height:44px;display:flex;align-items:center;justify-content:center;border-radius:13px;font-style:normal;color:var(--accent-light);background:rgba(99,102,241,.11);font-size: 17px}.mode span{display:grid;gap:4px}.mode b{font-size: 14px}.mode small{font-size: 14px;line-height:1.4;color:var(--text-muted)}.mode em{width:25px;height:25px;display:flex;align-items:center;justify-content:center;border-radius:50%;font-style:normal;color:white;background:var(--primary-gradient)}
    .tabs{margin:28px 0 12px;padding:5px;display:flex;gap:5px;overflow:auto;border:1px solid var(--border);border-radius:15px;background:var(--surface-gradient)}.tabs button{padding:10px 14px;white-space:nowrap;border:0;border-radius:10px;color:var(--text-muted);background:transparent;font-size: 13px;font-weight:800;cursor:pointer}.tabs button.active{color:var(--text-primary);background:var(--card-gradient);box-shadow:0 5px 15px rgba(0,0,0,.05)}
    .panel{padding:25px;border:1px solid var(--border);border-radius:22px;background:var(--card-gradient);box-shadow:0 15px 45px rgba(0,0,0,.04)}.heading{margin-bottom:20px}.heading h2{margin:0 0 5px;font-size: 21px}.heading p{margin:0;color:var(--text-muted);font-size: 13px}
    .grid2{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}.field{display:grid;gap:7px}.field.wide{grid-column:1/-1}.field>span{font-size: 14px;font-weight:850;color:var(--text-secondary)}.field input,.field textarea,.field select{width:100%;padding:12px 13px;border:1px solid var(--border);border-radius:12px;outline:none;color:var(--text-primary);background:var(--surface-soft);font-size: 14px}.field textarea{resize:vertical;line-height:1.55}.field input:focus,.field textarea:focus,.field select:focus{border-color:rgba(99,102,241,.5);box-shadow:0 0 0 3px rgba(99,102,241,.08)}
    .color{display:grid;grid-template-columns:48px 1fr;gap:8px}.color input[type=color]{height:46px;padding:4px;cursor:pointer}
    .designLayout{display:grid;grid-template-columns:1fr 390px;gap:14px}.preview{min-height:480px;padding:21px;overflow:hidden;border:1px solid var(--border);border-radius:22px;color:#fff;background:linear-gradient(145deg,var(--b1),var(--b2));box-shadow:var(--shadow)}.preview>small{font-size: 12px;font-weight:900;letter-spacing:1px;color:#94a3b8}.miniNav{margin-top:16px;padding:12px;display:flex;justify-content:space-between;border:1px solid rgba(255,255,255,.1);border-radius:var(--r);background:rgba(255,255,255,.05)}.miniNav b{font-size: 13px}.miniNav span{font-size: 13px;color:#cbd5e1}.miniHero{padding:45px 8px}.miniHero label{font-size: 12px;font-weight:900;color:var(--a)}.miniHero h3{margin:10px 0;font-family:var(--heading);font-size: 31px;line-height:1.05}.miniHero h3 em{display:block;font-style:normal;color:var(--a)}.miniHero p{font-size: 14px;line-height:1.55;color:#cbd5e1}.miniHero button{margin-top:10px;padding:11px 14px;border:0;border-radius:11px;color:#fff;background:linear-gradient(135deg,var(--p),var(--s));font-size: 14px;font-weight:900}
    .htmlNotice{margin-bottom:13px;padding:12px;border:1px solid rgba(99,102,241,.15);border-radius:12px;color:var(--text-secondary);background:rgba(99,102,241,.06);font-size: 14px;line-height:1.5}.code{width:100%;min-height:470px;padding:17px;border:1px solid var(--border);border-radius:14px;outline:none;resize:vertical;color:#dbeafe;background:#020617;font:13px/1.65 Consolas,Monaco,monospace}.htmlBottom{margin-top:11px;display:flex;align-items:center;justify-content:space-between}.htmlBottom span{font-size: 14px;color:var(--text-muted)}.htmlBottom button{padding:10px 13px;border:1px solid var(--border);border-radius:10px;color:var(--text-primary);background:var(--surface-gradient);font-size: 14px;font-weight:800;cursor:pointer}
    .bottomSave{margin-top:18px;padding:17px 19px;display:flex;align-items:center;justify-content:space-between;gap:15px;border:1px solid var(--border);border-radius:18px;background:var(--surface-gradient);box-shadow:var(--shadow)}.bottomSave>div{display:grid;gap:3px}.bottomSave strong{font-size: 14px}.bottomSave span{font-size: 14px;color:var(--text-muted)}
    .load{min-height:100vh;display:flex;align-items:center;justify-content:center;color:var(--text-primary);background:var(--page-gradient)}.load>div{width:min(400px,calc(100% - 35px));padding:28px;display:grid;gap:6px;border:1px solid var(--border);border-radius:20px;background:var(--card-gradient);box-shadow:var(--shadow)}.load b{font-size: 18px}.load span{font-size: 13px;color:var(--text-muted)}
    @media(max-width:900px){.top{padding:0 110px 0 18px}.top>div:first-child span{display:none}.designLayout{grid-template-columns:1fr}.preview{min-height:400px}.modeGrid{grid-template-columns:1fr}.hero{grid-template-columns:1fr}.status{min-width:0}}
    @media(max-width:650px){.wrap{width:calc(100% - 28px);padding-top:20px}.top{min-height:68px}.ghost{display:none}.hero{padding:22px}.hero h1{font-size: 34px}.grid2{grid-template-columns:1fr}.field.wide{grid-column:auto}.panel{padding:18px}.bottomSave{align-items:stretch;flex-direction:column}.bottomSave button{width:100%}.tabs button{font-size: 14px}.topActions .save{padding:10px 12px;font-size: 14px}}
  `}</style>
}
