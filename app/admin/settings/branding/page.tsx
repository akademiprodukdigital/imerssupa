'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../../lib/supabase'
import ThemeSwitcher from '../../../../components/ThemeSwitcher'

type BrandingConfig = {
  app_name: string
  short_name: string
  company_name: string
  developer_name: string
  copyright_text: string
  logo_url: string
  icon_url: string
  favicon_url: string
  app_url: string
  heading_font: string
  body_font: string
  button_font: string
  primary_color: string
  secondary_color: string
  accent_color: string
  sidebar_style: 'solid' | 'gradient' | 'glass'
  card_radius: '12px' | '16px' | '20px' | '24px' | '28px'
  login_badge: string
  login_title: string
  login_description: string
  login_feature_1_icon: string
  login_feature_1_title: string
  login_feature_1_text: string
  login_feature_2_icon: string
  login_feature_2_title: string
  login_feature_2_text: string
  login_feature_3_icon: string
  login_feature_3_title: string
  login_feature_3_text: string
  login_feature_4_icon: string
  login_feature_4_title: string
  login_feature_4_text: string
  login_welcome_badge: string
  login_form_title: string
  login_form_description: string
  login_role_note: string
  show_developer_credit: boolean
}

type Profile = {
  id: string
  full_name: string | null
  role: string | null
  status: string | null
}

const defaults: BrandingConfig = {
  app_name: 'iMersSUPA',
  short_name: 'SUPA',
  company_name: '',
  developer_name: '',
  copyright_text: '',
  logo_url: '',
  icon_url: '',
  favicon_url: '',
  app_url: '',
  heading_font: 'Poppins',
  body_font: 'Inter',
  button_font: 'Inter',
  primary_color: '#4f46e5',
  secondary_color: '#7c3aed',
  accent_color: '#38bdf8',
  sidebar_style: 'gradient',
  card_radius: '20px',
  login_badge: 'DIGITAL MEMBER EXPERIENCE',
  login_title: 'Semua produk digital. Satu member area.',
  login_description: 'Akses produk, materi pembelajaran, resource, progress belajar dan semua konten digital Anda dalam satu platform.',
  login_feature_1_icon: '◇',
  login_feature_1_title: 'Secure Access',
  login_feature_1_text: 'Akses berdasarkan akun dan entitlement.',
  login_feature_2_icon: '✓',
  login_feature_2_title: 'Learning Progress',
  login_feature_2_text: 'Progress belajar tersimpan otomatis.',
  login_feature_3_icon: '▶',
  login_feature_3_title: 'Continue Learning',
  login_feature_3_text: 'Lanjut langsung ke materi berikutnya.',
  login_feature_4_icon: '◆',
  login_feature_4_title: 'Digital Resources',
  login_feature_4_text: 'Bonus dan resource dalam satu tempat.',
  login_welcome_badge: 'WELCOME BACK',
  login_form_title: 'Masuk ke akun Anda',
  login_form_description: 'Masukkan email dan password untuk melanjutkan ke dashboard.',
  login_role_note: 'Satu halaman login untuk Member, Agency, Admin dan Super Admin.',
  show_developer_credit: false,
}

const fonts = ['Inter', 'Poppins', 'Montserrat', 'Plus Jakarta Sans', 'Arial', 'Georgia']

export default function BrandingSettingsPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [config, setConfig] = useState<BrandingConfig>(defaults)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'identity' | 'appearance' | 'deployment' | 'login'>('identity')

  useEffect(() => { void load() }, [])

  async function load() {
    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.replace('/login')
      return
    }

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

    const { data, error: readError } = await supabase
      .from('platform_settings')
      .select('setting_value')
      .eq('setting_group', 'platform')
      .eq('setting_key', 'branding')
      .maybeSingle()

    if (readError) setError(readError.message)
    else if (data?.setting_value) {
      setConfig({ ...defaults, ...(data.setting_value as Partial<BrandingConfig>) })
    }

    setLoading(false)
  }

  function patch<K extends keyof BrandingConfig>(key: K, value: BrandingConfig[K]) {
    setConfig(prev => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  async function save() {
    setSaving(true)
    setSaved(false)
    setError('')

    const { error: saveError } = await supabase
      .from('platform_settings')
      .update({
        setting_value: config,
        updated_at: new Date().toISOString(),
      })
      .eq('setting_group', 'platform')
      .eq('setting_key', 'branding')

    if (saveError) setError(saveError.message)
    else setSaved(true)

    setSaving(false)
  }

  const baseUrl = useMemo(() => {
    const typed = config.app_url.trim().replace(/\/+$/, '')
    if (typed) return typed
    if (typeof window !== 'undefined') return window.location.origin
    return ''
  }, [config.app_url])

  const routes = [
    ['Homepage', '/'],
    ['Login', '/login'],
    ['Member Dashboard', '/member'],
    ['Admin Dashboard', '/admin'],
    ['Forgot Password', '/forgot-password'],
    ['Reset Password', '/reset-password'],
  ]

  if (loading) {
    return (
      <>
        <main className="loading">
          <ThemeSwitcher />
          <div className="loadingCard">
            <b>Platform Branding</b>
            <span>Memuat konfigurasi global...</span>
          </div>
        </main>
        <Styles />
      </>
    )
  }

  return (
    <>
      <div className="page">
        <ThemeSwitcher />

        <header className="topbar">
          <div className="crumb">
            <button onClick={() => router.push('/admin/settings')}>← System Settings</button>
            <span>SUPER ADMIN / BRANDING</span>
          </div>
          <div className="topActions">
            <button className="outline" onClick={() => window.open('/', '_blank')}>Open App ↗</button>
            <button className="primary" onClick={save} disabled={saving}>
              {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
          </div>
        </header>

        <main className="container">
          <section className="hero">
            <div>
              <span className="eyebrow">GLOBAL WHITE-LABEL</span>
              <h1>Platform Branding <em>& Appearance.</em></h1>
              <p>Atur identitas global untuk Login, Admin, Member dan halaman sistem tanpa mengikat aplikasi ke domain atau provider deployment tertentu.</p>
            </div>
            <div className="adminCard">
              <small>CONFIGURED BY</small>
              <strong>{profile?.full_name || 'Super Admin'}</strong>
              <span>● Super Admin Access</span>
            </div>
          </section>

          {error && <div className="alert">⚠ {error}</div>}
          {saved && <div className="success">✓ Platform branding berhasil disimpan.</div>}

          <section className="summaryGrid">
            <Summary icon="◆" title={config.app_name || 'Application'} text="Application Identity" />
            <Summary icon="Aa" title={config.heading_font} text="Heading Typography" />
            <Summary icon="◐" title={config.sidebar_style} text="Sidebar Style" />
            <Summary icon="↗" title={config.app_url ? 'Custom URL' : 'Auto Detect'} text="Deployment URL" />
          </section>

          <nav className="tabs">
            <button className={tab === 'identity' ? 'active' : ''} onClick={() => setTab('identity')}>Application Identity</button>
            <button className={tab === 'appearance' ? 'active' : ''} onClick={() => setTab('appearance')}>Global Appearance</button>
            <button className={tab === 'deployment' ? 'active' : ''} onClick={() => setTab('deployment')}>Deployment URL</button>
            <button className={tab === 'login' ? 'active' : ''} onClick={() => setTab('login')}>Login Branding</button>
          </nav>

          {tab === 'identity' && (
            <section className="panel">
              <SectionTitle title="Application Identity" desc="Identitas utama aplikasi untuk instalasi white-label milik client." />
              <div className="grid2">
                <Field label="Application Name"><input value={config.app_name} onChange={e => patch('app_name', e.target.value)} /></Field>
                <Field label="Short Name"><input value={config.short_name} onChange={e => patch('short_name', e.target.value)} /></Field>
                <Field label="Company / Business Name"><input placeholder="Nama perusahaan / brand client" value={config.company_name} onChange={e => patch('company_name', e.target.value)} /></Field>
                <Field label="Developer / Agency Name"><input placeholder="Opsional" value={config.developer_name} onChange={e => patch('developer_name', e.target.value)} /></Field>
                <Field label="Global Logo URL"><input placeholder="https://..." value={config.logo_url} onChange={e => patch('logo_url', e.target.value)} /></Field>
                <Field label="App Icon URL"><input placeholder="https://..." value={config.icon_url} onChange={e => patch('icon_url', e.target.value)} /></Field>
                <Field label="Browser Favicon URL"><input placeholder="https://domain.com/favicon.png" value={config.favicon_url} onChange={e => patch('favicon_url', e.target.value)} /></Field>
                <Field label="Copyright / Footer Text" wide><input placeholder="© 2026 Nama Brand. All rights reserved." value={config.copyright_text} onChange={e => patch('copyright_text', e.target.value)} /></Field>
              </div>

              <label className="toggleRow">
                <div>
                  <b>Show Developer Credit</b>
                  <span>Tampilkan developer/agency credit di footer aplikasi.</span>
                </div>
                <button className={`switch ${config.show_developer_credit ? 'on' : ''}`} onClick={() => patch('show_developer_credit', !config.show_developer_credit)} type="button">
                  <i />
                </button>
              </label>
            </section>
          )}

          {tab === 'appearance' && (
            <div className="appearanceLayout">
              <section className="panel">
                <SectionTitle title="Global Appearance" desc="Fondasi visual untuk Login, Admin, Member dan halaman akun." />
                <div className="grid2">
                  <Field label="Heading Font"><select value={config.heading_font} onChange={e => patch('heading_font', e.target.value)}>{fonts.map(f => <option key={f}>{f}</option>)}</select></Field>
                  <Field label="Body Font"><select value={config.body_font} onChange={e => patch('body_font', e.target.value)}>{fonts.map(f => <option key={f}>{f}</option>)}</select></Field>
                  <Field label="Button Font"><select value={config.button_font} onChange={e => patch('button_font', e.target.value)}>{fonts.map(f => <option key={f}>{f}</option>)}</select></Field>
                  <Field label="Card Radius">
                    <select value={config.card_radius} onChange={e => patch('card_radius', e.target.value as BrandingConfig['card_radius'])}>
                      <option value="12px">12px — Compact</option><option value="16px">16px — Soft</option><option value="20px">20px — Modern</option><option value="24px">24px — Premium</option><option value="28px">28px — Extra Rounded</option>
                    </select>
                  </Field>
                  <ColorField label="Primary Color" value={config.primary_color} onChange={v => patch('primary_color', v)} />
                  <ColorField label="Secondary Color" value={config.secondary_color} onChange={v => patch('secondary_color', v)} />
                  <ColorField label="Accent Color" value={config.accent_color} onChange={v => patch('accent_color', v)} />
                  <Field label="Sidebar Style">
                    <select value={config.sidebar_style} onChange={e => patch('sidebar_style', e.target.value as BrandingConfig['sidebar_style'])}>
                      <option value="solid">Solid</option><option value="gradient">Gradient</option><option value="glass">Glass</option>
                    </select>
                  </Field>
                </div>
              </section>
              <Preview config={config} />
            </div>
          )}

          {tab === 'deployment' && (
            <section className="panel">
              <SectionTitle title="Deployment Identity" desc="Provider-neutral: Vercel, Cloudflare, Netlify atau custom domain client." />
              <div className="deploymentBox">
                <Field label="Application / Base URL">
                  <input placeholder="https://member.domainclient.com" value={config.app_url} onChange={e => patch('app_url', e.target.value)} />
                </Field>
                <div className="tip">
                  <b>Auto Detect tersedia.</b>
                  <span>Jika kosong, aplikasi mengikuti domain deployment saat ini. Isi URL bila callback atau integrasi membutuhkan URL absolut.</span>
                </div>
              </div>

              <div className="routeList">
                <div className="routeHead"><b>Generated Application URLs</b><span>Preview URL aplikasi.</span></div>
                {routes.map(([name, path]) => (
                  <div className="route" key={name}><span>{name}</span><code>{baseUrl}{path}</code></div>
                ))}
              </div>

              <div className="providerNote">
                <strong>✓ Deployment Independent</strong>
                <p>Source frontend tidak dikunci ke Vercel. Client dapat memakai provider Next.js yang sesuai dan menghubungkan domain miliknya sendiri.</p>
              </div>
            </section>
          )}

          {tab === 'login' && (
            <div className="appearanceLayout">
              <section className="panel">
                <SectionTitle title="Login Branding & Copywriting" desc="Semua copy halaman login dapat diganti untuk instalasi white-label." />
                <div className="formStack">
                  <Field label="Login Badge"><input value={config.login_badge} onChange={e => patch('login_badge', e.target.value)} /></Field>
                  <Field label="Login Headline"><textarea rows={3} value={config.login_title} onChange={e => patch('login_title', e.target.value)} /></Field>
                  <Field label="Login Description"><textarea rows={4} value={config.login_description} onChange={e => patch('login_description', e.target.value)} /></Field>

                  <SectionTitle title="Feature Cards" desc="Empat benefit/card di sisi kiri halaman login." />
                  <div className="grid2">
                    <Field label="Feature 1 Icon"><input value={config.login_feature_1_icon} onChange={e => patch('login_feature_1_icon', e.target.value)} /></Field>
                    <Field label="Feature 1 Title"><input value={config.login_feature_1_title} onChange={e => patch('login_feature_1_title', e.target.value)} /></Field>
                    <Field label="Feature 1 Description" wide><input value={config.login_feature_1_text} onChange={e => patch('login_feature_1_text', e.target.value)} /></Field>
                    <Field label="Feature 2 Icon"><input value={config.login_feature_2_icon} onChange={e => patch('login_feature_2_icon', e.target.value)} /></Field>
                    <Field label="Feature 2 Title"><input value={config.login_feature_2_title} onChange={e => patch('login_feature_2_title', e.target.value)} /></Field>
                    <Field label="Feature 2 Description" wide><input value={config.login_feature_2_text} onChange={e => patch('login_feature_2_text', e.target.value)} /></Field>
                    <Field label="Feature 3 Icon"><input value={config.login_feature_3_icon} onChange={e => patch('login_feature_3_icon', e.target.value)} /></Field>
                    <Field label="Feature 3 Title"><input value={config.login_feature_3_title} onChange={e => patch('login_feature_3_title', e.target.value)} /></Field>
                    <Field label="Feature 3 Description" wide><input value={config.login_feature_3_text} onChange={e => patch('login_feature_3_text', e.target.value)} /></Field>
                    <Field label="Feature 4 Icon"><input value={config.login_feature_4_icon} onChange={e => patch('login_feature_4_icon', e.target.value)} /></Field>
                    <Field label="Feature 4 Title"><input value={config.login_feature_4_title} onChange={e => patch('login_feature_4_title', e.target.value)} /></Field>
                    <Field label="Feature 4 Description" wide><input value={config.login_feature_4_text} onChange={e => patch('login_feature_4_text', e.target.value)} /></Field>
                  </div>

                  <SectionTitle title="Login Form Copy" desc="Copy di kartu form login dan catatan role." />
                  <Field label="Welcome Badge"><input value={config.login_welcome_badge} onChange={e => patch('login_welcome_badge', e.target.value)} /></Field>
                  <Field label="Form Title"><input value={config.login_form_title} onChange={e => patch('login_form_title', e.target.value)} /></Field>
                  <Field label="Form Description"><textarea rows={3} value={config.login_form_description} onChange={e => patch('login_form_description', e.target.value)} /></Field>
                  <Field label="Role Note"><input value={config.login_role_note} onChange={e => patch('login_role_note', e.target.value)} /></Field>
                </div>
              </section>

              <div className="loginPreview">
                <span>LOGIN PREVIEW</span>
                <div className="loginBrand">
                  {config.logo_url ? <img src={config.logo_url} alt="" /> : <div className="logoFallback">{(config.short_name || 'S').slice(0, 2).toUpperCase()}</div>}
                  <b>{config.app_name || 'Application'}</b>
                </div>
                <label>{config.login_badge}</label>
                <h3>{config.login_title}</h3>
                <p>{config.login_description}</p>
                <div className="fakeInput">{config.login_welcome_badge}</div>
                <div className="fakeInput">{config.login_form_title}</div>
                <button>Masuk ke Dashboard</button>
              </div>
            </div>
          )}

          <section className="bottomSave">
            <div><strong>Global Platform Configuration</strong><span>Simpan setelah selesai mengubah identitas atau appearance.</span></div>
            <button onClick={save} disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan Platform Branding'}</button>
          </section>
        </main>
      </div>
      <Styles />
    </>
  )
}

function Summary({ icon, title, text }: { icon: string; title: string; text: string }) {
  return <div className="summary"><i>{icon}</i><div><strong>{title}</strong><span>{text}</span></div></div>
}
function SectionTitle({ title, desc }: { title: string; desc: string }) {
  return <div className="sectionTitle"><h2>{title}</h2><p>{desc}</p></div>
}
function Field({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return <label className={`field ${wide ? 'wide' : ''}`}><span>{label}</span>{children}</label>
}
function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return <label className="field"><span>{label}</span><div className="colorField"><input type="color" value={value} onChange={e => onChange(e.target.value)} /><input value={value} onChange={e => onChange(e.target.value)} /></div></label>
}

function Preview({ config }: { config: BrandingConfig }) {
  const style = {
    '--preview-primary': config.primary_color,
    '--preview-secondary': config.secondary_color,
    '--preview-accent': config.accent_color,
    '--preview-radius': config.card_radius,
  } as React.CSSProperties

  return (
    <aside className="preview" style={style}>
      <span>GLOBAL UI PREVIEW</span>
      <div className={`previewShell ${config.sidebar_style}`}>
        <div className="previewSide">
          <div className="previewLogo">
            {config.logo_url ? <img src={config.logo_url} alt="" /> : <i>{(config.short_name || 'S').slice(0, 2).toUpperCase()}</i>}
            <b>{config.app_name || 'Application'}</b>
          </div>
          <small>Dashboard</small><small>Products</small><small>Members</small><small>Settings</small>
        </div>
        <div className="previewMain">
          <label>WELCOME BACK</label>
          <h3>Platform Dashboard</h3>
          <p>Contoh tampilan global aplikasi setelah branding diterapkan.</p>
          <div className="previewCards"><div><b>128</b><span>Members</span></div><div><b>24</b><span>Products</span></div></div>
          <button>Primary Action</button>
        </div>
      </div>
    </aside>
  )
}

function Styles() {
  return <style jsx global>{`
    *{box-sizing:border-box}html,body{margin:0}button,input,textarea,select{font:inherit}button{cursor:pointer}
    .page{min-height:100vh;color:var(--text-primary);background:var(--page-gradient);font-family:Inter,Arial,sans-serif}
    .topbar{position:sticky;top:0;z-index:30;min-height:78px;padding:0 180px 0 32px;display:flex;align-items:center;justify-content:space-between;gap:20px;border-bottom:1px solid var(--border);background:var(--topbar-bg);backdrop-filter:blur(20px)}
    .crumb,.topActions{display:flex;align-items:center;gap:10px}.crumb{gap:18px}
    .crumb button,.outline{padding:10px 14px;border:1px solid var(--border);border-radius:12px;color:var(--text-secondary);background:var(--surface-gradient);font-size: 13px;font-weight:800}.crumb span{font-size: 13px;font-weight:900;letter-spacing:1px;color:var(--text-muted)}
    .primary,.bottomSave button{padding:11px 17px;border:0;border-radius:12px;color:#fff;background:var(--primary-gradient);font-size: 13px;font-weight:900}.primary:disabled,.bottomSave button:disabled{opacity:.6}
    .container{width:min(1240px,calc(100% - 40px));margin:auto;padding:34px 0 70px}
    .hero{padding:30px;display:grid;grid-template-columns:1fr auto;align-items:center;gap:30px;border:1px solid var(--border);border-radius:26px;background:linear-gradient(120deg,rgba(59,130,246,.11),rgba(124,58,237,.11),rgba(236,72,153,.06)),var(--card-gradient);box-shadow:var(--shadow)}
    .eyebrow,.adminCard small{font-size: 13px;font-weight:950;letter-spacing:1.3px;color:var(--accent)}.hero h1{margin:7px 0 10px;font-size: 44px;line-height:1;letter-spacing:-1.8px}.hero h1 em{font-style:normal;color:transparent;background:linear-gradient(90deg,#38bdf8,#6366f1,#a855f7);background-clip:text}.hero p{max-width:720px;margin:0;color:var(--text-muted);font-size: 14px;line-height:1.65}
    .adminCard{min-width:230px;padding:19px;border:1px solid var(--border);border-radius:18px;background:var(--surface-gradient);display:grid;gap:7px}.adminCard strong{font-size: 17px}.adminCard span{font-size: 14px;color:#22c55e}
    .alert,.success{margin-top:15px;padding:13px 15px;border-radius:13px;font-size: 13px;font-weight:700}.alert{color:#f59e0b;background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.15)}.success{color:#22c55e;background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.15)}
    .summaryGrid{margin-top:18px;display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.summary{padding:16px;display:flex;align-items:center;gap:12px;border:1px solid var(--border);border-radius:17px;background:var(--card-gradient)}.summary i{width:42px;height:42px;display:flex;align-items:center;justify-content:center;border-radius:12px;font-style:normal;font-weight:900;color:var(--accent-light);background:rgba(99,102,241,.11)}.summary div{display:grid;gap:3px;min-width:0}.summary strong{font-size: 14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.summary span{font-size: 13px;color:var(--text-muted)}
    .tabs{margin:28px 0 12px;padding:5px;display:flex;gap:5px;overflow:auto;border:1px solid var(--border);border-radius:15px;background:var(--surface-gradient)}.tabs button{padding:10px 14px;white-space:nowrap;border:0;border-radius:10px;color:var(--text-muted);background:transparent;font-size: 13px;font-weight:800}.tabs button.active{color:var(--text-primary);background:var(--card-gradient);box-shadow:0 5px 15px rgba(0,0,0,.05)}
    .panel{padding:25px;border:1px solid var(--border);border-radius:22px;background:var(--card-gradient);box-shadow:0 15px 45px rgba(0,0,0,.04)}.sectionTitle{margin-bottom:21px}.sectionTitle h2{margin:0 0 6px;font-size: 21px}.sectionTitle p{margin:0;color:var(--text-muted);font-size: 13px;line-height:1.55}
    .grid2{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}.field{display:grid;gap:7px}.field.wide{grid-column:1/-1}.field>span{font-size: 14px;font-weight:850;color:var(--text-secondary)}.field input,.field textarea,.field select{width:100%;padding:12px 13px;border:1px solid var(--border);border-radius:12px;outline:none;color:var(--text-primary);background:var(--surface-soft);font-size: 14px}.field textarea{resize:vertical;line-height:1.55}.field input:focus,.field textarea:focus,.field select:focus{border-color:rgba(99,102,241,.5);box-shadow:0 0 0 3px rgba(99,102,241,.08)}
    .colorField{display:grid;grid-template-columns:48px 1fr;gap:8px}.colorField input[type=color]{height:46px;padding:4px;cursor:pointer}
    .toggleRow{margin-top:18px;padding:15px 16px;display:flex;align-items:center;justify-content:space-between;gap:20px;border:1px solid var(--border);border-radius:15px;background:var(--surface-soft)}.toggleRow>div{display:grid;gap:4px}.toggleRow b{font-size: 13.5px}.toggleRow span{font-size: 14px;color:var(--text-muted)}.switch{width:48px;height:27px;padding:3px;border:0;border-radius:20px;background:rgba(148,163,184,.35)}.switch i{display:block;width:21px;height:21px;border-radius:50%;background:white;transition:.2s}.switch.on{background:linear-gradient(135deg,#4f46e5,#7c3aed)}.switch.on i{transform:translateX(21px)}
    .appearanceLayout{display:grid;grid-template-columns:1fr 410px;gap:14px}.preview,.loginPreview{padding:21px;border:1px solid var(--border);border-radius:22px;background:var(--card-gradient);box-shadow:var(--shadow)}.preview>span,.loginPreview>span{font-size: 12px;font-weight:900;letter-spacing:1px;color:var(--text-muted)}
    .previewShell{margin-top:16px;min-height:430px;display:grid;grid-template-columns:125px 1fr;overflow:hidden;border:1px solid var(--border);border-radius:var(--preview-radius);background:var(--surface-soft)}.previewSide{padding:14px 10px;display:flex;flex-direction:column;gap:10px;color:#e2e8f0;background:#0f172a}.previewShell.gradient .previewSide{background:linear-gradient(160deg,var(--preview-primary),var(--preview-secondary))}.previewShell.glass .previewSide{background:linear-gradient(160deg,rgba(79,70,229,.75),rgba(15,23,42,.88));backdrop-filter:blur(16px)}
    .previewLogo{margin-bottom:10px;display:flex;align-items:center;gap:7px}.previewLogo img{width:27px;height:27px;object-fit:contain}.previewLogo i{width:27px;height:27px;display:flex;align-items:center;justify-content:center;border-radius:8px;background:rgba(255,255,255,.15);font-size: 12px;font-style:normal}.previewLogo b{font-size: 12px;overflow:hidden;text-overflow:ellipsis}.previewSide small{padding:7px;border-radius:7px;font-size: 12px}.previewSide small:first-of-type{background:rgba(255,255,255,.12)}
    .previewMain{padding:28px 17px}.previewMain label{font-size: 12px;font-weight:900;color:var(--preview-accent)}.previewMain h3{margin:6px 0;font-size: 22px}.previewMain p{margin:0;color:var(--text-muted);font-size: 12px;line-height:1.5}.previewCards{margin:20px 0 15px;display:grid;grid-template-columns:1fr 1fr;gap:8px}.previewCards div{padding:13px;border:1px solid var(--border);border-radius:14px;background:var(--card-gradient);display:grid;gap:3px}.previewCards b{font-size: 18px}.previewCards span{font-size: 12px;color:var(--text-muted)}.previewMain button,.loginPreview button{padding:10px 13px;border:0;border-radius:10px;color:white;background:linear-gradient(135deg,var(--preview-primary,#4f46e5),var(--preview-secondary,#7c3aed));font-size: 12px;font-weight:900}
    .deploymentBox{display:grid;grid-template-columns:1fr 1fr;gap:15px}.tip{padding:13px 14px;display:grid;gap:4px;border:1px solid rgba(56,189,248,.18);border-radius:13px;background:rgba(56,189,248,.06)}.tip b{font-size: 14px;color:var(--accent)}.tip span{font-size: 13px;line-height:1.5;color:var(--text-muted)}
    .routeList{margin-top:20px;border:1px solid var(--border);border-radius:16px;overflow:hidden}.routeHead{padding:14px 15px;display:flex;align-items:center;justify-content:space-between;background:var(--surface-soft)}.routeHead b{font-size: 13px}.routeHead span{font-size: 13px;color:var(--text-muted)}.route{padding:12px 15px;display:grid;grid-template-columns:170px 1fr;align-items:center;border-top:1px solid var(--border)}.route span{font-size: 14px;font-weight:750;color:var(--text-secondary)}.route code{overflow:auto;font-size: 14px;color:var(--accent)}
    .providerNote{margin-top:17px;padding:16px;border:1px solid rgba(34,197,94,.18);border-radius:15px;background:rgba(34,197,94,.06)}.providerNote strong{font-size: 13px;color:#22c55e}.providerNote p{margin:5px 0 0;font-size: 14px;line-height:1.55;color:var(--text-muted)}
    .formStack{display:grid;gap:16px}.loginPreview{min-height:500px;background:linear-gradient(145deg,rgba(59,130,246,.08),rgba(124,58,237,.08)),var(--card-gradient)}.loginBrand{margin:25px 0 35px;display:flex;align-items:center;gap:10px}.loginBrand img{width:42px;height:42px;object-fit:contain}.logoFallback{width:42px;height:42px;display:flex;align-items:center;justify-content:center;border-radius:12px;color:#fff;background:var(--primary-gradient);font-size: 13px;font-weight:900}.loginBrand b{font-size: 16px}.loginPreview>label{font-size: 12px;font-weight:900;letter-spacing:1px;color:var(--accent)}.loginPreview h3{margin:8px 0;font-size: 27px;line-height:1.08}.loginPreview p{margin:0 0 24px;font-size: 14px;line-height:1.6;color:var(--text-muted)}.fakeInput{margin-bottom:9px;padding:12px;border:1px solid var(--border);border-radius:11px;color:var(--text-muted);background:var(--surface-soft);font-size: 13px}.loginPreview button{width:100%;margin-top:5px;padding:12px;background:var(--primary-gradient);font-size: 14px}
    .bottomSave{margin-top:18px;padding:17px 19px;display:flex;align-items:center;justify-content:space-between;gap:15px;border:1px solid var(--border);border-radius:18px;background:var(--surface-gradient);box-shadow:var(--shadow)}.bottomSave>div{display:grid;gap:3px}.bottomSave strong{font-size: 14px}.bottomSave span{font-size: 14px;color:var(--text-muted)}
    .loading{min-height:100vh;display:flex;align-items:center;justify-content:center;color:var(--text-primary);background:var(--page-gradient)}.loadingCard{width:min(410px,calc(100% - 35px));padding:28px;display:grid;gap:6px;border:1px solid var(--border);border-radius:20px;background:var(--card-gradient);box-shadow:var(--shadow)}.loadingCard b{font-size: 18px}.loadingCard span{font-size: 13px;color:var(--text-muted)}
    @media(max-width:1000px){.summaryGrid{grid-template-columns:repeat(2,1fr)}.appearanceLayout{grid-template-columns:1fr}.previewShell{min-height:380px}}
    @media(max-width:900px){.topbar{padding:0 110px 0 18px}.crumb span{display:none}.hero{grid-template-columns:1fr}.adminCard{min-width:0}.deploymentBox{grid-template-columns:1fr}}
    @media(max-width:650px){.container{width:calc(100% - 28px);padding-top:20px}.topbar{min-height:68px}.outline{display:none}.hero{padding:22px}.hero h1{font-size: 34px}.grid2{grid-template-columns:1fr}.field.wide{grid-column:auto}.panel{padding:18px}.summaryGrid{grid-template-columns:1fr}.route{grid-template-columns:1fr;gap:5px}.routeHead{align-items:flex-start;flex-direction:column;gap:3px}.bottomSave{align-items:stretch;flex-direction:column}.bottomSave button{width:100%}.tabs button{font-size: 14px}.topActions .primary{padding:10px 12px;font-size: 14px}.previewShell{grid-template-columns:100px 1fr}}
  `}</style>
}
