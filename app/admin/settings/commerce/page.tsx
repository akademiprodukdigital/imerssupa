'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
)

type Profile = { full_name?: string | null; avatar_url?: string | null; role?: string | null }
type CommerceSettings = {
  commerce_enabled: boolean
  checkout_enabled: boolean
  currency: string
  order_expiry_minutes: number
  require_buyer_phone: boolean
  allow_guest_checkout: boolean
  checkout_title?: string | null
  checkout_description?: string | null
  checkout_success_message?: string | null
  support_email?: string | null
  support_whatsapp?: string | null
  terms_url?: string | null
  privacy_url?: string | null
}
type Provider = {
  id: string
  channel: string
  provider_code: string
  provider_name: string
  active: boolean
  is_default: boolean
  sender_name?: string | null
  sender_address?: string | null
}

const defaults: CommerceSettings = {
  commerce_enabled: true,
  checkout_enabled: true,
  currency: 'IDR',
  order_expiry_minutes: 1440,
  require_buyer_phone: true,
  allow_guest_checkout: true,
  checkout_title: '',
  checkout_description: '',
  checkout_success_message: '',
  support_email: '',
  support_whatsapp: '',
  terms_url: '',
  privacy_url: '',
}

export default function CommerceSettingsPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [email, setEmail] = useState('')
  const [form, setForm] = useState<CommerceSettings>(defaults)
  const [providers, setProviders] = useState<Provider[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const displayName = profile?.full_name?.trim() || email.split('@')[0] || 'Administrator'
  const initials = displayName.split(' ').filter(Boolean).slice(0, 2).map(v => v[0]?.toUpperCase()).join('') || 'A'

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }
      setEmail(user.email || '')
      const { data: p, error: pe } = await supabase.from('profiles').select('full_name,avatar_url,role').eq('id', user.id).maybeSingle()
      if (pe) throw pe
      const prof = (p || {}) as Profile
      setProfile(prof)
      if (prof.role !== 'super_admin') { router.replace('/admin'); return }

      const { data: settings, error: se } = await supabase.rpc('get_public_commerce_settings')
      if (se) throw se
      const raw: any = Array.isArray(settings) ? settings[0] : settings
      if (raw) setForm(v => ({ ...v, ...raw }))

      const { data: providerRows, error: pre } = await supabase.rpc('admin_list_communication_providers')
      if (pre) throw pre
      setProviders((providerRows || []) as Provider[])
    } catch (e: any) {
      setError(e?.message || 'Gagal memuat Commerce Settings.')
    } finally { setLoading(false) }
  }, [router])

  useEffect(() => { void load() }, [load])

  const save = async () => {
    setSaving(true); setError(''); setMessage('')
    try {
      const payload: Record<string, unknown> = {
        p_commerce_enabled: form.commerce_enabled,
        p_checkout_enabled: form.checkout_enabled,
        p_currency: form.currency.trim().toUpperCase(),
        p_order_expiry_minutes: Number(form.order_expiry_minutes),
        p_require_buyer_phone: form.require_buyer_phone,
        p_allow_guest_checkout: form.allow_guest_checkout,
        p_checkout_title: form.checkout_title || null,
        p_checkout_description: form.checkout_description || null,
        p_checkout_success_message: form.checkout_success_message || null,
        p_support_email: form.support_email || null,
        p_support_whatsapp: form.support_whatsapp || null,
        p_terms_url: form.terms_url || null,
        p_privacy_url: form.privacy_url || null,
      }
      const { error } = await supabase.rpc('admin_update_commerce_settings', payload)
      if (error) throw error
      setMessage('Commerce Settings berhasil disimpan.')
      await load()
    } catch (e: any) { setError(e?.message || 'Gagal menyimpan Commerce Settings.') }
    finally { setSaving(false) }
  }

  const logout = async () => { await supabase.auth.signOut(); router.replace('/login') }
  const field = (key: keyof CommerceSettings, value: any) => setForm(v => ({ ...v, [key]: value }))

  return <div className="shell">
    <aside className="sidebar">
      <div>
        <div className="brand"><div className="logo">S</div><div><strong>iMersSUPA</strong><span>ADMIN CONTROL</span></div></div>
        <div className="role"><i>★</i><div><span>LOGGED IN AS</span><strong>Super Admin</strong></div></div>
        <Nav router={router} />
      </div>
      <div className="bottom">
        <button className="profile" onClick={() => router.push('/admin/profile')}>
          <Avatar url={profile?.avatar_url} initials={initials}/><span><strong>{displayName}</strong><small>Super Admin</small></span>
        </button>
        <button className="logout" onClick={logout}>↗ Keluar</button>
      </div>
    </aside>

    <main className="main">
      <div className="content">
        <header className="head">
          <div><div className="kicker">SUPER ADMIN / COMMERCE SETTINGS</div><h1>Commerce Settings</h1><p>Atur checkout, order, customer requirement, support dan provider komunikasi.</p></div>
          <button className="refresh" onClick={() => void load()} disabled={loading}>↻ Refresh</button>
        </header>

        {error && <div className="alert err">{error}</div>}
        {message && <div className="alert ok">{message}</div>}

        <section className="stats">
          <Stat cls="blue" icon="◈" label="COMMERCE" value={form.commerce_enabled ? 'ACTIVE' : 'OFF'} sub="Status transaksi platform"/>
          <Stat cls="purple" icon="▣" label="CHECKOUT" value={form.checkout_enabled ? 'ACTIVE' : 'OFF'} sub="Status halaman checkout"/>
          <Stat cls="green" icon="Rp" label="CURRENCY" value={form.currency || 'IDR'} sub="Mata uang transaksi"/>
          <Stat cls="pink" icon="⌛" label="ORDER EXPIRED" value={`${form.order_expiry_minutes || 0} min`} sub="Batas pembayaran order"/>
        </section>

        <div className="grid">
          <section className="card blue-card">
            <CardHead kicker="COMMERCE CONTROL" title="Commerce & Checkout" desc="Kontrol utama transaksi dan akses checkout."/>
            <Toggle label="Commerce Enabled" desc="Aktifkan seluruh fitur commerce platform." checked={form.commerce_enabled} onChange={v => field('commerce_enabled', v)}/>
            <Toggle label="Checkout Enabled" desc="Izinkan customer membuat order baru." checked={form.checkout_enabled} onChange={v => field('checkout_enabled', v)}/>
            <Toggle label="Allow Guest Checkout" desc="Customer boleh checkout tanpa login." checked={form.allow_guest_checkout} onChange={v => field('allow_guest_checkout', v)}/>
            <Toggle label="Require Buyer Phone" desc="Nomor WhatsApp/telepon wajib saat checkout." checked={form.require_buyer_phone} onChange={v => field('require_buyer_phone', v)}/>
            <div className="two">
              <Input label="Currency" value={form.currency} onChange={v => field('currency', v.toUpperCase())} placeholder="IDR"/>
              <Input label="Order Expiry (menit)" type="number" value={String(form.order_expiry_minutes)} onChange={v => field('order_expiry_minutes', Math.max(1, Number(v) || 1))}/>
            </div>
          </section>

          <section className="card purple-card">
            <CardHead kicker="CHECKOUT COPYWRITING" title="Checkout Experience" desc="Copywriting white-label yang tampil kepada customer."/>
            <Input label="Checkout Title" value={form.checkout_title || ''} onChange={v => field('checkout_title', v)} placeholder="Selesaikan Pesanan Anda"/>
            <TextArea label="Checkout Description" value={form.checkout_description || ''} onChange={v => field('checkout_description', v)} placeholder="Instruksi singkat untuk customer..."/>
            <TextArea label="Success Message" value={form.checkout_success_message || ''} onChange={v => field('checkout_success_message', v)} placeholder="Pesanan berhasil dibuat..."/>
          </section>

          <section className="card green-card">
            <CardHead kicker="CUSTOMER SUPPORT" title="Support & Legal" desc="Kontak bantuan dan link legal untuk checkout."/>
            <div className="two">
              <Input label="Support Email" value={form.support_email || ''} onChange={v => field('support_email', v)} placeholder="support@domain.com"/>
              <Input label="Support WhatsApp" value={form.support_whatsapp || ''} onChange={v => field('support_whatsapp', v)} placeholder="62812..."/>
            </div>
            <Input label="Terms URL" value={form.terms_url || ''} onChange={v => field('terms_url', v)} placeholder="https://domain.com/terms"/>
            <Input label="Privacy URL" value={form.privacy_url || ''} onChange={v => field('privacy_url', v)} placeholder="https://domain.com/privacy"/>
          </section>

          <section className="card pink-card">
            <CardHead kicker="COMMUNICATION PROVIDERS" title="Provider Overview" desc="Provider BYOK terdaftar. Secret credential tidak ditampilkan di browser."/>
            <div className="providers">
              {providers.map(p => <div className="provider" key={p.id}>
                <div className="provider-icon">{p.channel === 'whatsapp' ? 'WA' : p.channel === 'email' ? '@' : '◌'}</div>
                <div><strong>{p.provider_name || p.provider_code}</strong><small>{p.channel} · {p.provider_code}</small></div>
                <div className="provider-tags">{p.is_default && <b>DEFAULT</b>}<span className={p.active ? 'active' : 'inactive'}>{p.active ? 'ACTIVE' : 'OFF'}</span></div>
              </div>)}
              {!loading && providers.length === 0 && <div className="empty">Belum ada communication provider.</div>}
              {loading && <div className="empty">Loading provider...</div>}
            </div>
            <p className="secure">🔒 API token / secret provider tetap server-side dan tidak dibaca halaman ini.</p>
          </section>
        </div>

        <div className="savebar"><div><strong>White-label Commerce Configuration</strong><span>Perubahan berlaku ke checkout publik setelah disimpan.</span></div><button onClick={() => void save()} disabled={saving || loading}>{saving ? 'Menyimpan...' : 'Simpan Settings'}</button></div>
      </div>
    </main>

    <style jsx global>{`
      *{box-sizing:border-box} body{margin:0}
      .shell{min-height:100vh;display:grid;grid-template-columns:270px minmax(0,1fr);color:#172033;background:radial-gradient(circle at 15% 10%,#e7f2ff 0,transparent 32%),radial-gradient(circle at 90% 85%,#f7e5ff 0,transparent 35%),#f7f8ff}
      .sidebar{position:sticky;top:0;height:100vh;overflow-y:auto;padding:24px 18px 18px;display:flex;flex-direction:column;justify-content:space-between;border-right:1px solid #dce2ef;background:rgba(255,255,255,.78);backdrop-filter:blur(18px)}
      .brand{display:flex;align-items:center;gap:10px}.logo{width:38px;height:38px;border-radius:12px;display:grid;place-items:center;color:#fff;font-weight:900;background:linear-gradient(135deg,#5268ff,#7445ee);box-shadow:0 10px 24px #6658ee35}.brand>div:last-child{display:grid}.brand strong{font-size:17px;line-height:1.15}.brand span,.role span{font-size:10.5px;letter-spacing:1.2px;color:#76829a;font-weight:900}
      .role{margin:20px 0;padding:10px;display:flex;gap:9px;align-items:center;border:1px solid #dce2ef;border-radius:13px;background:linear-gradient(135deg,#edf3ff,#f6efff)}.role i{width:31px;height:31px;border-radius:9px;display:grid;place-items:center;font-style:normal;background:#e3e7ff;color:#7164ef}.role>div{display:grid;gap:2px}.role strong{font-size:13px}
      .menu{display:grid;gap:4px}.menu-title{margin:9px 9px 5px;font-size:10px;letter-spacing:1.4px;font-weight:900;color:#9aa6bb}.menu-title.second{margin-top:14px}.menu-item{border:1px solid transparent;background:transparent;border-radius:10px;padding:8px 9px;display:flex;align-items:center;gap:8px;text-align:left;color:#58667d;font-size:13px;font-weight:750;min-height:44px;cursor:pointer}.menu-item i{width:25px;height:25px;border-radius:8px;display:grid;place-items:center;background:#edf0ff;color:#6c66ef;font-style:normal}.menu-item:hover,.menu-item.active{border-color:#cfd4fa;background:linear-gradient(135deg,#edf3ff,#f7f0ff);color:#172033}
      .bottom{display:grid;gap:7px;margin-top:20px}.profile{width:100%;border:1px solid #dce2ef;border-radius:12px;padding:8px;display:flex;align-items:center;gap:8px;background:linear-gradient(135deg,#edf3ff,#f7f0ff);text-align:left;cursor:pointer}.avatar{width:34px;height:34px;border-radius:10px;overflow:hidden;display:grid;place-items:center;background:linear-gradient(135deg,#5268ff,#7445ee);color:white;font-size:11px;font-weight:900}.avatar img{width:100%;height:100%;object-fit:cover}.profile>span{display:grid;min-width:0}.profile strong{font-size:12.5px;max-width:135px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.profile small{font-size:10.5px;color:#7c879b}.logout{border:1px solid #ffd6d6;border-radius:10px;padding:8px;background:#fff1f1;color:#e54b4b;font-size:12.5px;font-weight:800;cursor:pointer}
      .main{min-width:0}.content{width:100%;max-width:1450px;margin:0 auto;padding:31px 28px 50px}.head{display:flex;justify-content:space-between;align-items:flex-start;gap:20px}.kicker{font-size:10.5px;letter-spacing:1.3px;color:#6255f5;font-weight:900}.head h1{font-size:32px;line-height:1.1;margin:7px 0 7px;letter-spacing:-.8px}.head p,.card-head p{margin:0;color:#748097;font-size:13.5px;line-height:1.65}.refresh{height:42px;padding:0 16px;border:1px solid #dce2ef;border-radius:12px;background:rgba(255,255,255,.75);font-size:13px;font-weight:800;cursor:pointer}
      .alert{margin-top:15px;padding:11px 13px;border-radius:11px;font-size:11px}.err{border:1px solid #ffcaca;background:#fff0f0;color:#d33}.ok{border:1px solid #bcebd4;background:#effcf5;color:#168555}
      .stats{margin-top:20px;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:11px}.stat{min-height:112px;padding:15px;border:1px solid #dde3ef;border-radius:17px;display:flex;gap:12px;align-items:flex-start;box-shadow:0 12px 30px rgba(41,48,73,.05)}.stat.blue,.blue-card{background:linear-gradient(145deg,#edf5ff,#fff)}.stat.purple,.purple-card{background:linear-gradient(145deg,#f3edff,#fff)}.stat.green,.green-card{background:linear-gradient(145deg,#e9fbf3,#fff)}.stat.pink,.pink-card{background:linear-gradient(145deg,#fff0f7,#fff)}.stat>span{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;background:#ffffffaa;color:#6558f3;font-weight:900}.stat>div{display:grid;gap:4px}.stat small{font-size:11.5px;color:#7e89a0}.stat strong{font-size:28px;line-height:1.05}.stat p{margin:0;color:#8a95aa;font-size:11px;line-height:1.45}
      .grid{margin-top:14px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px}.card{border:1px solid #dce2ef;border-radius:18px;padding:18px;box-shadow:0 14px 34px rgba(42,49,75,.045)}.card-head{margin-bottom:16px}.card-head h2{margin:5px 0 4px;font-size:20px}.toggle{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:11px 12px;margin-bottom:8px;border:1px solid #dde3ef;border-radius:12px;background:rgba(255,255,255,.62)}.toggle>div{display:grid;gap:3px}.toggle strong{font-size:13px}.toggle small{font-size:11px;color:#7f8ba0}.switch{position:relative;width:42px;height:24px;border:0;border-radius:20px;background:#cfd5e1;cursor:pointer}.switch.on{background:#6c5cf3}.switch i{position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:white;transition:.18s}.switch.on i{left:21px}
      .field{display:grid;gap:6px;margin-top:11px}.field label{font-size:12px;font-weight:800;color:#4e5a70}.field input,.field textarea{width:100%;border:1px solid #d9e0ec;border-radius:11px;padding:11px 12px;outline:none;background:rgba(255,255,255,.72);color:#1c2536;font-size:13.5px}.field textarea{min-height:88px;resize:vertical;line-height:1.5}.field input:focus,.field textarea:focus{border-color:#8175f5;box-shadow:0 0 0 3px #7568f314}.two{display:grid;grid-template-columns:1fr 1fr;gap:10px}
      .providers{display:grid;gap:8px}.provider{padding:10px;border:1px solid #dce2ef;border-radius:12px;background:rgba(255,255,255,.62);display:grid;grid-template-columns:36px 1fr auto;align-items:center;gap:10px}.provider-icon{width:36px;height:36px;border-radius:10px;display:grid;place-items:center;background:#edf0ff;color:#6558f3;font-size:10px;font-weight:900}.provider>div:nth-child(2){display:grid;gap:3px}.provider strong{font-size:13px}.provider small{font-size:10.5px;color:#7d889d;text-transform:capitalize}.provider-tags{display:flex;gap:5px;align-items:center}.provider-tags b,.provider-tags span{font-size:7px;padding:5px 7px;border-radius:20px}.provider-tags b{background:#eeeaff;color:#6658e9}.provider-tags .active{background:#e3f8ec;color:#128450}.provider-tags .inactive{background:#f3f4f7;color:#7e8797}.empty{padding:25px;text-align:center;color:#8a95a8;font-size:12px}.secure{margin:12px 0 0;font-size:11px;color:#758198;line-height:1.5}
      .savebar{position:sticky;bottom:14px;margin-top:14px;padding:12px 14px;border:1px solid #d8deea;border-radius:15px;background:rgba(255,255,255,.88);backdrop-filter:blur(18px);box-shadow:0 15px 40px rgba(42,48,73,.12);display:flex;justify-content:space-between;align-items:center;gap:15px}.savebar>div{display:grid;gap:3px}.savebar strong{font-size:13px}.savebar span{font-size:11px;color:#7d889d}.savebar button{border:0;border-radius:11px;padding:11px 18px;background:linear-gradient(135deg,#5268ff,#7445ee);color:white;font-size:13px;font-weight:900;cursor:pointer}.savebar button:disabled,.refresh:disabled{opacity:.55;cursor:not-allowed}
      @media(max-width:1000px){.stats{grid-template-columns:repeat(2,1fr)}.grid{grid-template-columns:1fr}}
      @media(max-width:760px){.shell{display:block}.sidebar{position:relative;width:100%;height:auto}.content{padding:20px 14px}.stats{grid-template-columns:1fr 1fr}.two{grid-template-columns:1fr}.savebar{position:static}.head h1{font-size:22px}}
    `}</style>
  </div>
}

function Stat({cls,icon,label,value,sub}:{cls:string;icon:string;label:string;value:string;sub:string}) {
  return <div className={`stat ${cls}`}><span>{icon}</span><div><small>{label}</small><strong>{value}</strong><p>{sub}</p></div></div>
}
function CardHead({kicker,title,desc}:{kicker:string;title:string;desc:string}) {
  return <div className="card-head"><div className="kicker">{kicker}</div><h2>{title}</h2><p>{desc}</p></div>
}
function Toggle({label,desc,checked,onChange}:{label:string;desc:string;checked:boolean;onChange:(v:boolean)=>void}) {
  return <div className="toggle"><div><strong>{label}</strong><small>{desc}</small></div><button type="button" aria-pressed={checked} className={`switch ${checked?'on':''}`} onClick={()=>onChange(!checked)}><i/></button></div>
}
function Input({label,value,onChange,placeholder='',type='text'}:{label:string;value:string;onChange:(v:string)=>void;placeholder?:string;type?:string}) {
  return <div className="field"><label>{label}</label><input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}/></div>
}
function TextArea({label,value,onChange,placeholder=''}:{label:string;value:string;onChange:(v:string)=>void;placeholder?:string}) {
  return <div className="field"><label>{label}</label><textarea value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}/></div>
}
function Avatar({url,initials}:{url?:string|null;initials:string}) {
  return <div className="avatar">{url?<img src={url} alt="Avatar"/>:initials}</div>
}
function Nav({router}:{router:ReturnType<typeof useRouter>}) {
  const go=(p:string)=>router.push(p)
  return <nav className="menu">
    <div className="menu-title">MAIN MENU</div>
    <button className="menu-item" onClick={()=>go('/admin')}><i>⌂</i>Dashboard</button>
    <button className="menu-item" onClick={()=>go('/admin/members')}><i>◎</i>Members</button>
    <button className="menu-item" onClick={()=>go('/admin/products')}><i>▣</i>Products</button>
    <button className="menu-item" onClick={()=>go('/admin/content')}><i>▶</i>Content</button>
    <button className="menu-item" onClick={()=>go('/admin/access')}><i>◇</i>Member Access</button>
    <button className="menu-item" onClick={()=>go('/admin/progress')}><i>↗</i>Progress</button>
    <button className="menu-item" onClick={()=>go('/admin/resources')}><i>◆</i>Resources</button>
    <div className="menu-title second">COMMERCE</div>
    <button className="menu-item" onClick={()=>go('/admin/orders')}><i>▤</i>Orders & Transactions</button>
    <button className="menu-item" onClick={()=>go('/admin/payments')}><i>◫</i>Payments</button>
    <button className="menu-item" onClick={()=>go('/admin/affiliates')}><i>⌘</i>Affiliate & Coupons</button>
    <button className="menu-item" onClick={()=>go('/admin/notifications')}><i>◌</i>Notifications</button>
    <div className="menu-title second">SUPER ADMIN</div>
    <button className="menu-item" onClick={()=>go('/admin/administrators')}><i>♛</i>Administrators</button>
    <button className="menu-item" onClick={()=>go('/admin/settings')}><i>⚙</i>System Settings</button>
    <button className="menu-item active" onClick={()=>go('/admin/settings/commerce')}><i>◈</i>Commerce Settings</button>
    <button className="menu-item" onClick={()=>go('/admin/security')}><i>◇</i>Security / Audit</button>
    <div className="menu-title second">ACCOUNT</div>
    <button className="menu-item" onClick={()=>go('/admin/profile')}><i>◉</i>Profile</button>
  </nav>
}
