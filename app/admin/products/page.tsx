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


type Product = {
  id: string
  name: string
  slug: string
  description?: string | null
  type?: string | null
  price?: number | string | null
  status?: string | null
  created_at?: string | null
  cover_url?: string | null
  thumbnail_url?: string | null
  image_url?: string | null
  is_featured?: boolean | null
  featured?: boolean | null
}

type ProductForm = {
  name: string
  slug: string
  price: string
  status: string
  category_id: string
  video_url: string
  agency_enabled: boolean
  agency_default_slots: string
}

type ProductCategory = {
  id: string
  name: string
  slug: string
  description: string | null
  is_active: boolean
  sort_order: number
}

type ProductAgencySetting = {
  product_id: string
  agency_enabled: boolean
  default_slot_limit: number
}

type ProductMedia = {
  id: string
  product_id: string
  media_type: 'image' | 'video'
  media_url: string
  sort_order: number
  is_primary: boolean
}

type AccessRow = {
  id: string
  user_id: string
  product_id: string
  access_status: string | null
  expires_at: string | null
}


type EditForm = {
  full_name: string
  phone: string
  status: string
}

const PAGE_SIZES = [10, 25, 50, 100]

export default function AdminProductsPage() {
  const router = useRouter()
  const [me, setMe] = useState<Profile | null>(null)
  const [email, setEmail] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [accessRows, setAccessRows] = useState<AccessRow[]>([])
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [mediaRows, setMediaRows] = useState<ProductMedia[]>([])
  const [agencySettings, setAgencySettings] = useState<ProductAgencySetting[]>([])
  const [categoryManager, setCategoryManager] = useState(false)
  const [categoryName, setCategoryName] = useState('')
  const [imageUrls, setImageUrls] = useState<string[]>([''])
  const [uploadingImageIndex, setUploadingImageIndex] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [pageSize, setPageSize] = useState(25)
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Product | null>(null)
  const [createMode, setCreateMode] = useState(false)
  const [form, setForm] = useState<ProductForm>({ name: '', slug: '', price: '0', status: 'draft', category_id: '', video_url: '', agency_enabled: false, agency_default_slots: '20' })

  const load = async () => {
    setLoading(true)
    setError('')

    const { data: authData, error: authError } = await supabase.auth.getUser()
    const user = authData.user
    if (authError || !user) {
      router.replace('/login')
      return
    }
    setEmail(user.email ?? '')

    const { data: profileData, error: profileError } = await supabase
      .from('profiles').select('*').eq('id', user.id).maybeSingle()

    if (profileError || !profileData) {
      await supabase.auth.signOut()
      router.replace('/login')
      return
    }

    const profile = profileData as Profile
    if (profile.status !== 'active') {
      await supabase.auth.signOut()
      router.replace('/login')
      return
    }
    if (profile.role !== 'admin' && profile.role !== 'super_admin') {
      router.replace('/member')
      return
    }
    setMe(profile)

    const [productsResult, accessResult, categoriesResult, mediaResult, agencyResult] = await Promise.all([
      supabase.from('products').select('*').order('created_at', { ascending: false }),
      supabase.from('member_access').select('id,user_id,product_id,access_status,expires_at'),
      supabase.from('product_categories').select('*').order('sort_order', { ascending: true }).order('name', { ascending: true }),
      supabase.from('product_media').select('*').order('sort_order', { ascending: true }),
      supabase.rpc('admin_list_product_agency_settings'),
    ])

    const errors: string[] = []
    if (productsResult.error) errors.push(`Products: ${productsResult.error.message}`)
    else setProducts((productsResult.data ?? []) as Product[])

    if (accessResult.error) errors.push(`Access: ${accessResult.error.message}`)
    else setAccessRows((accessResult.data ?? []) as AccessRow[])

    if (categoriesResult.error) errors.push(`Categories: ${categoriesResult.error.message}`)
    else setCategories((categoriesResult.data ?? []) as ProductCategory[])

    if (mediaResult.error) errors.push(`Media: ${mediaResult.error.message}`)
    else setMediaRows((mediaResult.data ?? []) as ProductMedia[])
    if (agencyResult.error) errors.push(`Agency: ${agencyResult.error.message}`)
    else setAgencySettings((agencyResult.data ?? []) as ProductAgencySetting[])

    if (errors.length) setError(errors.join(' • '))
    setLoading(false)
  }

  useEffect(() => { void load() }, [])
  useEffect(() => { setPage(1) }, [search, statusFilter, pageSize])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return products.filter((product) => {
      const matchesSearch = !q ||
        product.name.toLowerCase().includes(q) ||
        product.slug.toLowerCase().includes(q) ||
        (product.type ?? '').toLowerCase().includes(q)
      const matchesStatus = statusFilter === 'all' || product.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [products, search, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const visible = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)
  const publishedCount = products.filter((p) => p.status === 'published').length
  const draftCount = products.filter((p) => p.status === 'draft').length
  const featuredCount = products.filter((p) => p.is_featured === true || p.featured === true).length
  const activeAccessCount = accessRows.filter((a) => a.access_status === 'active').length

  const memberCount = (productId: string) =>
    new Set(accessRows.filter((a) => a.product_id === productId && a.access_status === 'active').map((a) => a.user_id)).size

  const openCreate = () => {
    setSelected(null)
    setCreateMode(true)
    setError('')
    setNotice('')
    setForm({ name: '', slug: '', price: '0', status: 'draft', category_id: '', video_url: '', agency_enabled: false, agency_default_slots: '20' })
    setImageUrls([''])
  }

  const openEdit = (product: Product) => {
    setSelected(product)
    setCreateMode(false)
    setError('')
    setNotice('')
    const productMedia = mediaRows.filter((m) => m.product_id === product.id)
    const images = productMedia.filter((m) => m.media_type === 'image').sort((a,b) => a.sort_order - b.sort_order)
    const video = productMedia.find((m) => m.media_type === 'video')
    setForm({
      name: product.name,
      slug: product.slug,
      price: String(product.price ?? 0),
      status: product.status ?? 'draft',
      category_id: (product as any).category_id ?? '',
      video_url: video?.media_url ?? '',
      agency_enabled: agencySettings.find((a) => a.product_id === product.id)?.agency_enabled ?? false,
      agency_default_slots: String(agencySettings.find((a) => a.product_id === product.id)?.default_slot_limit ?? 20),
    })
    setImageUrls(images.length ? images.map((m) => m.media_url) : [''])
  }

  const saveProduct = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')

    const payload = {
      p_name: form.name.trim(),
      p_slug: form.slug.trim(),
      p_price: Number(form.price || 0),
      p_status: form.status,
      p_category_id: form.category_id || null,
      p_video_url: form.video_url.trim() || null,
      p_image_urls: imageUrls.map((x) => x.trim()).filter(Boolean),
    }

    if (!payload.p_name || !payload.p_slug) {
      setError('Nama produk dan slug wajib diisi.')
      setSaving(false)
      return
    }

    const result = createMode
      ? await supabase.rpc('admin_create_product_with_media', payload)
      : await supabase.rpc('admin_update_product_with_media', { p_product_id: selected?.id, ...payload })

    if (result.error) {
      setError(`Gagal menyimpan produk: ${result.error.message}`)
      setSaving(false)
      return
    }

    const savedProductId = selected?.id || (result.data as { id?: string } | null)?.id
    if (!savedProductId) {
      setError('Produk tersimpan tetapi Product ID tidak dapat dibaca untuk Agency Settings.')
      setSaving(false)
      return
    }

    const { error: agencyError } = await supabase.rpc('admin_set_product_agency_settings', {
      p_product_id: savedProductId,
      p_agency_enabled: form.agency_enabled,
      p_default_slot_limit: Math.max(1, Number(form.agency_default_slots || 20)),
    })
    if (agencyError) {
      setError(`Produk tersimpan, tetapi Agency Settings gagal: ${agencyError.message}`)
      setSaving(false)
      return
    }

    setCreateMode(false)
    setSelected(null)
    setNotice(createMode ? 'Produk berhasil dibuat.' : 'Produk berhasil diperbarui.')
    setSaving(false)
    await load()
  }

  const deleteProduct = async (product: Product) => {
    if (!window.confirm(`Hapus produk "${product.name}"? Produk yang sudah memiliki relasi transaksi/akses dapat ditolak database demi keamanan data.`)) return
    setSaving(true)
    setError('')
    setNotice('')
    const { error: deleteError } = await supabase.rpc('admin_delete_product_safe', { p_product_id: product.id })
    if (deleteError) setError(`Produk tidak dapat dihapus: ${deleteError.message}`)
    else {
      setNotice('Produk berhasil dihapus.')
      setSelected(null)
      await load()
    }
    setSaving(false)
  }

  const saveCategory = async () => {
    const name = categoryName.trim()
    if (!name) return
    setSaving(true)
    setError('')
    const { error: categoryError } = await supabase.rpc('admin_upsert_product_category', {
      p_category_id: null,
      p_name: name,
      p_slug: slugify(name),
      p_description: null,
      p_is_active: true,
      p_sort_order: categories.length,
    })
    if (categoryError) setError(`Gagal menambah kategori: ${categoryError.message}`)
    else {
      setCategoryName('')
      setNotice('Kategori berhasil ditambahkan.')
      await load()
    }
    setSaving(false)
  }

  const toggleCategory = async (category: ProductCategory) => {
    setSaving(true)
    setError('')
    const { error: categoryError } = await supabase.rpc('admin_upsert_product_category', {
      p_category_id: category.id,
      p_name: category.name,
      p_slug: category.slug,
      p_description: category.description,
      p_is_active: !category.is_active,
      p_sort_order: category.sort_order,
    })
    if (categoryError) setError(`Gagal mengubah kategori: ${categoryError.message}`)
    else await load()
    setSaving(false)
  }

  const deleteCategory = async (category: ProductCategory) => {
    if (!window.confirm(`Hapus kategori "${category.name}"? Kategori yang masih dipakai produk akan ditolak demi keamanan.`)) return
    setSaving(true)
    setError('')
    const { error: categoryError } = await supabase.rpc('admin_delete_product_category_safe', { p_category_id: category.id })
    if (categoryError) setError(`Kategori tidak dapat dihapus: ${categoryError.message}`)
    else {
      setNotice('Kategori berhasil dihapus.')
      await load()
    }
    setSaving(false)
  }

  const addImageField = () => {
    if (imageUrls.length < 9) setImageUrls((rows) => [...rows, ''])
  }

  const updateImage = (index: number, value: string) =>
    setImageUrls((rows) => rows.map((row, i) => i === index ? value : row))

  const removeImage = (index: number) =>
    setImageUrls((rows) => rows.length === 1 ? [''] : rows.filter((_, i) => i !== index))

  const uploadProductImage = async (index: number, file?: File | null) => {
    if (!file) return

    const allowedTypes = ['image/webp', 'image/jpeg', 'image/png']
    const maxBytes = 2 * 1024 * 1024

    if (!allowedTypes.includes(file.type)) {
      setError('Format gambar harus WebP, JPG/JPEG, atau PNG.')
      return
    }
    if (file.size > maxBytes) {
      setError('Ukuran file maksimal 2 MB. Untuk hemat Supabase Storage, rekomendasi ideal 150–500 KB.')
      return
    }

    setError('')
    setNotice('')
    setUploadingImageIndex(index)

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser()
      if (authError || !authData.user) throw new Error('Sesi login tidak ditemukan.')

      const ext = (file.name.split('.').pop() || 'webp').toLowerCase().replace(/[^a-z0-9]/g, '')
      const safeExt = ['webp', 'jpg', 'jpeg', 'png'].includes(ext) ? ext : 'webp'
      const objectPath = `${authData.user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${safeExt}`

      const { error: uploadError } = await supabase.storage
        .from('product-media')
        .upload(objectPath, file, { cacheControl: '3600', upsert: false, contentType: file.type })

      if (uploadError) throw uploadError

      const { data: publicData } = supabase.storage.from('product-media').getPublicUrl(objectPath)
      if (!publicData.publicUrl) throw new Error('URL hasil upload tidak dapat dibuat.')

      updateImage(index, publicData.publicUrl)
      setNotice(`Gambar ${index === 0 ? 'cover' : index + 1} berhasil diupload.`)
    } catch (e: any) {
      setError(`Upload gambar gagal: ${e?.message || 'Unknown error'}`)
    } finally {
      setUploadingImageIndex(null)
    }
  }

  const categoryNameById = (id?: string | null) =>
    categories.find((c) => c.id === id)?.name ?? 'Tanpa kategori'

  const logout = async () => {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  const initials = (me?.full_name || email || 'A').split(' ').map((x) => x[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className="admin-page">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">S</div><div><strong>iMersSUPA</strong><small>ADMIN CONTROL</small></div></div>
        <div className="role-card"><div className="role-icon">★</div><div><small>LOGGED IN AS</small><strong>{me?.role === 'super_admin' ? 'Super Admin' : 'Admin'}</strong></div></div>

        <nav>
          <p>MAIN MENU</p>
          <button onClick={() => router.push('/admin')}>⌂ <span>Dashboard</span></button>
          <button onClick={() => router.push('/admin/members')}>◎ <span>Members</span></button>
          <button className="active">▣ <span>Products</span></button>
          <button onClick={() => router.push('/admin/content')}>▶ <span>Content</span></button>
          <button onClick={() => router.push('/admin/access')}>◇ <span>Member Access</span></button>
          <button onClick={() => router.push('/admin/progress')}>↗ <span>Progress</span></button>
          <button onClick={() => router.push('/admin/resources')}>◆ <span>Resources</span></button>
          <p>COMMERCE</p>
          <button onClick={() => router.push('/admin/orders')}>▤ <span>Orders & Transactions</span></button>
          <button onClick={() => router.push('/admin/payments')}>◫ <span>Payments</span></button>
          <button onClick={() => router.push('/admin/affiliates')}>⌘ <span>Affiliate & Coupons</span></button>
          <button onClick={() => router.push('/admin/notifications')}>◌ <span>Notifications</span></button>
          {me?.role === 'super_admin' && <>
            <p>SUPER ADMIN</p>
            <button onClick={() => router.push('/admin/agencies')}>♜ <span>Agency Management</span></button><button onClick={() => router.push('/admin/administrators')}>♛ <span>Administrators</span></button>
            <button onClick={() => router.push('/admin/settings')}>⚙ <span>System Settings</span></button>
            <button onClick={() => router.push('/admin/settings/commerce')}>◈ <span>Commerce Settings</span></button>
            <button onClick={() => router.push('/admin/security')}>◇ <span>Security / Audit</span></button>
          </>}
          <p>ACCOUNT</p>
          <button onClick={() => router.push('/admin/profile')}>◉ <span>Profile</span></button>
        </nav>

        <div className="sidebar-bottom">
          <button className="profile-card" onClick={() => router.push('/admin/profile')}>
            <span className="avatar">{initials}</span><span className="profile-copy"><strong>{me?.full_name || email.split('@')[0] || 'Administrator'}</strong><small>{email}</small></span>
          </button>
          <button className="logout" onClick={logout}>↗ Keluar</button>
        </div>
      </aside>

      <main>
        <div className="topbar">
          <div className="search-top">⌕ <span>Cari member, produk atau materi...</span></div>
          <div className="top-actions">
            <button className="mini-profile" onClick={() => router.push('/admin/profile')}><span className="avatar small">{initials}</span><span><strong>{me?.full_name || email.split('@')[0]}</strong><small>{me?.role === 'super_admin' ? 'Super Admin' : 'Admin'}</small></span></button>
            <ThemeSwitcher />
          </div>
        </div>

        <div className="content">
          <header>
            <div><div className="eyebrow">PRODUCT MANAGEMENT</div><h1>Products</h1><p>Kelola katalog produk digital, harga, status publikasi, dan jumlah member yang memiliki akses.</p></div>
            <div style={{display:'flex',gap:8}}>
              <button className="refresh" onClick={() => setCategoryManager(true)}>▦ Kategori</button>
              <button className="refresh" onClick={() => void load()} disabled={loading}>↻ Refresh</button>
              <button className="primary" onClick={openCreate}>＋ Tambah Produk</button>
            </div>
          </header>

          {error && <div className="alert error">{error}</div>}
          {notice && <div className="alert success">{notice}</div>}

          <section className="stats">
            <article className="stat blue"><div className="stat-icon">▣</div><div><span>TOTAL PRODUCT</span><strong>{products.length}</strong><small>Seluruh produk</small></div></article>
            <article className="stat purple"><div className="stat-icon">✓</div><div><span>PUBLISHED</span><strong>{publishedCount}</strong><small>Produk tampil di katalog</small></div></article>
            <article className="stat green"><div className="stat-icon">◇</div><div><span>ACTIVE ACCESS</span><strong>{activeAccessCount}</strong><small>Total akses produk aktif</small></div></article>
            <article className="stat pink"><div className="stat-icon">★</div><div><span>DRAFT / FEATURED</span><strong>{draftCount} / {featuredCount}</strong><small>Draft dan produk unggulan</small></div></article>
          </section>

          <section className="panel">
            <div className="panel-head">
              <div><div className="eyebrow">PRODUCT CATALOG</div><h2>Daftar Produk</h2><p>Search, filter, pagination, dan page size aktif sejak awal.</p></div>
              <div className="summary-chip">{filtered.length} produk ditemukan</div>
            </div>

            <div className="filters">
              <div className="searchbox">⌕<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama, slug, atau tipe produk..." /></div>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">Semua Status</option><option value="published">Published</option><option value="draft">Draft</option><option value="archived">Archived</option>
              </select>
              <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>{PAGE_SIZES.map((size) => <option key={size} value={size}>{size} / halaman</option>)}</select>
            </div>

            <div className="table-wrap">
              <table>
                <thead><tr><th>PRODUCT</th><th>CATEGORY</th><th>MEDIA</th><th>PRICE</th><th>STATUS</th><th>MEMBER ACCESS</th><th>CREATED</th><th>ACTION</th></tr></thead>
                <tbody>
                  {loading ? <tr><td colSpan={8} className="empty">Loading products...</td></tr> :
                   visible.length === 0 ? <tr><td colSpan={8} className="empty">Belum ada produk yang sesuai filter.</td></tr> :
                   visible.map((product) => (
                    <tr key={product.id}>
                      <td><div className="member-cell"><span className="member-avatar">P</span><div><strong>{product.name}</strong><small>/{product.slug}</small></div></div></td>
                      <td>{categoryNameById((product as any).category_id)}</td>
                      <td><div className="access-list"><strong>{mediaRows.filter((m) => m.product_id === product.id && m.media_type === 'image').length} gambar</strong><small>{mediaRows.some((m) => m.product_id === product.id && m.media_type === 'video') ? 'Video tersedia' : 'Tanpa video'}</small></div></td>
                      <td><strong style={{color:'#26344d'}}>{rupiah(product.price)}</strong></td>
                      <td><span className={`badge ${product.status || 'draft'}`}>{pretty(product.status || 'draft')}</span></td>
                      <td><div className="access-list"><strong>{memberCount(product.id)} member</strong><small>memiliki akses aktif</small></div></td>
                      <td>{date(product.created_at)}</td>
                      <td><div style={{display:'flex',gap:6}}><button className="action" onClick={() => openEdit(product)}>Kelola</button><button className="action" onClick={() => router.push(`/admin/content?product=${product.id}`)}>Content</button></div></td>
                    </tr>
                   ))}
                </tbody>
              </table>
            </div>

            <div className="pagination">
              <span>Menampilkan {filtered.length ? (safePage - 1) * pageSize + 1 : 0}–{Math.min(safePage * pageSize, filtered.length)} dari {filtered.length} data</span>
              <div><button disabled={safePage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>← Previous</button><strong>Page {safePage} / {totalPages}</strong><button disabled={safePage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next →</button></div>
            </div>
          </section>
        </div>
      </main>

      {categoryManager && (
        <div className="modal-backdrop" onMouseDown={() => !saving && setCategoryManager(false)}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div><div className="eyebrow">PRODUCT CATEGORIES</div><h2>Kategori Produk</h2><p>Kategori dinamis untuk katalog produk. Bisa ditambah, aktif/nonaktif, dan dihapus aman.</p></div>
              <button className="close" onClick={() => setCategoryManager(false)} disabled={saving}>×</button>
            </div>
            <div style={{padding:'20px 22px'}}>
              <div style={{display:'flex',gap:8,marginBottom:14}}>
                <input style={{height:42,flex:1,border:'1px solid #dce1ec',borderRadius:10,padding:'0 11px',fontSize:12}} value={categoryName} onChange={(e) => setCategoryName(e.target.value)} placeholder="Nama kategori baru..." />
                <button className="primary" type="button" onClick={() => void saveCategory()} disabled={saving || !categoryName.trim()}>＋ Tambah</button>
              </div>
              <div className="member-info">
                <span>DAFTAR KATEGORI</span>
                {categories.length === 0 ? <p>Belum ada kategori.</p> : categories.map((category) => (
                  <div key={category.id} style={{alignItems:'center'}}>
                    <span><strong>{category.name}</strong><small style={{display:'block'}}>/{category.slug}</small></span>
                    <span style={{display:'flex',gap:6,alignItems:'center'}}>
                      <span className={`badge ${category.is_active ? 'published' : 'draft'}`}>{category.is_active ? 'Active' : 'Inactive'}</span>
                      <button className="action" type="button" onClick={() => void toggleCategory(category)}>{category.is_active ? 'Nonaktifkan' : 'Aktifkan'}</button>
                      <button className="action" type="button" onClick={() => void deleteCategory(category)}>Hapus</button>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {(selected || createMode) && (
        <div className="modal-backdrop" onMouseDown={() => !saving && (setSelected(null), setCreateMode(false))}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div><div className="eyebrow">{createMode ? 'NEW PRODUCT' : 'PRODUCT SETTINGS'}</div><h2>{createMode ? 'Tambah Produk' : 'Kelola Produk'}</h2><p>Pengaturan inti produk. Materi dikelola terpisah melalui menu Content.</p></div>
              <button className="close" onClick={() => {setSelected(null);setCreateMode(false)}} disabled={saving}>×</button>
            </div>
            <form onSubmit={saveProduct}>
              <label>Nama Produk<input value={form.name} onChange={(e) => setForm({...form,name:e.target.value,slug:createMode?slugify(e.target.value):form.slug})} placeholder="Nama produk" /></label>
              <label>Slug<input value={form.slug} onChange={(e) => setForm({...form,slug:slugify(e.target.value)})} placeholder="slug-produk" /></label>
              <label>Harga<input type="number" min="0" value={form.price} onChange={(e) => setForm({...form,price:e.target.value})} /></label>
              <label>Kategori
                <select value={form.category_id} onChange={(e) => setForm({...form,category_id:e.target.value})}>
                  <option value="">Tanpa kategori</option>
                  {categories.filter((c) => c.is_active || c.id === form.category_id).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
              </label>
              <div className="member-info">
                <span>GALLERY PRODUK — MAKSIMAL 9 GAMBAR</span>
                <p>Gambar pertama otomatis menjadi <b>Product Image / Cover</b>. Pilih upload ke Supabase Storage atau gunakan URL gambar eksternal.</p>
                <div style={{margin:'9px 0 12px',padding:'10px 12px',borderRadius:10,background:'rgba(59,130,246,.08)',border:'1px solid rgba(59,130,246,.16)',color:'#66738a',fontSize:11,lineHeight:1.55}}>
                  <b style={{color:'#334155'}}>Rekomendasi Product Image:</b> 1200 × 1200 px (1:1), WebP ideal 150–400 KB.<br/>
                  <b style={{color:'#334155'}}>Rekomendasi Banner:</b> 1600 × 900 px (16:9), WebP ideal 200–500 KB.<br/>
                  Upload menerima WebP/JPG/PNG maksimal <b>2 MB/file</b>. Gunakan <b>Image URL</b> bila ingin menghemat Supabase Storage.
                </div>
                {imageUrls.map((url, index) => (
                  <div key={index} style={{display:'grid',gridTemplateColumns:'74px minmax(0,1fr) auto auto',gap:8,alignItems:'center',marginTop:8}}>
                    <strong>{index === 0 ? 'Cover' : `Gambar ${index + 1}`}</strong>
                    <input style={{margin:0,height:38,minWidth:0}} value={url} onChange={(e) => updateImage(index,e.target.value)} placeholder="Image URL https://..." />
                    <label className="action" style={{margin:0,cursor:uploadingImageIndex === index ? 'wait' : 'pointer',whiteSpace:'nowrap'}}>
                      {uploadingImageIndex === index ? 'Uploading...' : '↑ Upload'}
                      <input
                        type="file"
                        accept="image/webp,image/jpeg,image/png"
                        disabled={uploadingImageIndex !== null}
                        onChange={(e) => { void uploadProductImage(index, e.target.files?.[0]); e.currentTarget.value = '' }}
                        style={{display:'none'}}
                      />
                    </label>
                    <button type="button" className="action" onClick={() => removeImage(index)} disabled={uploadingImageIndex !== null}>×</button>
                  </div>
                ))}
                <small style={{display:'block',marginTop:9,color:'#8994a8',fontWeight:500}}>Jika upload berhasil, URL hasil upload akan terisi otomatis pada field Image URL. URL eksternal tetap boleh dipaste langsung.</small>
                <button type="button" className="action" onClick={addImageField} disabled={imageUrls.length >= 9 || uploadingImageIndex !== null} style={{marginTop:10}}>＋ Tambah Gambar ({imageUrls.length}/9)</button>
              </div>
              <label style={{marginTop:13}}>Video Produk (Opsional)
                <input value={form.video_url} onChange={(e) => setForm({...form,video_url:e.target.value})} placeholder="YouTube, Vimeo, .mp4 atau .webm" />
                <small style={{display:'block',marginTop:5,color:'#8994a8',fontWeight:500}}>Kosongkan jika produk tidak memiliki video. Video hanya tampil di frontend bila URL diisi.</small>
              </label>
              <div className="member-info" style={{marginTop:13}}>
                <span>AGENCY PROGRAM — OPTIONAL PER PRODUCT</span>
                <p>Aktifkan hanya jika produk ini boleh digunakan oleh Agency untuk membuat member dan membagikan akses.</p>
                <label style={{display:'flex',alignItems:'center',gap:9,flexDirection:'row',marginTop:10}}>
                  <input type="checkbox" checked={form.agency_enabled} onChange={(e) => setForm({...form,agency_enabled:e.target.checked})} style={{width:16,height:16}} />
                  Agency Program aktif untuk produk ini
                </label>
                {form.agency_enabled && <label style={{marginTop:10}}>Default Slot Agency
                  <input type="number" min="1" value={form.agency_default_slots} onChange={(e) => setForm({...form,agency_default_slots:e.target.value})} />
                  <small style={{display:'block',marginTop:5,color:'#8994a8',fontWeight:500}}>Contoh 20 = satu entitlement Agency default dapat membuat/memberi akses maksimal 20 member untuk produk ini. Slot per Agency tetap bisa dioverride.</small>
                </label>}
              </div>
              <label>Status<select value={form.status} onChange={(e) => setForm({...form,status:e.target.value})}><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></label>
              {!createMode && selected && <div className="member-info"><span>PRODUCT SUMMARY</span><div><strong>Active Member Access</strong><small>{memberCount(selected.id)} member</small></div><div><strong>Product ID</strong><small>{selected.id}</small></div></div>}
              <div className="modal-actions">
                {!createMode && selected && <button type="button" className="secondary" onClick={() => void deleteProduct(selected)} disabled={saving}>Hapus</button>}
                <button type="button" className="secondary" onClick={() => {setSelected(null);setCreateMode(false)}} disabled={saving}>Batal</button>
                <button type="submit" className="primary" disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan Produk'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
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
        .table-wrap{overflow:auto;min-height:330px}table{width:100%;border-collapse:collapse;font-size:12px}th{font-size:9.5px;letter-spacing:.09em;color:#7f8ba2;text-align:left;background:#fafbfe;padding:11px 14px;white-space:nowrap}td{padding:13px 14px;border-top:1px solid #edf0f5;color:#526078;vertical-align:middle}tbody tr:hover{background:#fbfcff}.member-cell{display:flex;align-items:center;gap:10px;min-width:180px}.member-avatar{width:35px;height:35px;border-radius:10px;background:linear-gradient(135deg,#4f5bf6,#7956f4);color:white;display:grid;place-items:center;font-weight:900}.member-cell strong{display:block;font-size:12.5px;color:#18253d}.member-cell small{display:block;font-size:9.5px;color:#929bad;margin-top:2px}.badge{display:inline-flex;padding:5px 8px;border-radius:999px;font-size:9.5px;font-weight:900;text-transform:uppercase}.badge.active,.badge.published{background:#e8f9ef;color:#16864b}.badge.inactive,.badge.draft{background:#f0f2f6;color:#707c91}.badge.suspended,.badge.archived{background:#fff0f1;color:#d44952}.access-list strong{display:block;color:#26344d;font-size:11.5px}.access-list small{display:block;max-width:220px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:9.5px;color:#8994a8;margin-top:2px}.muted{color:#9aa3b4;font-size:11px}.action{height:32px;padding:0 11px;border:1px solid #d7d9ff;background:linear-gradient(110deg,#f1f3ff,#f8f4ff);color:#5149d9;border-radius:9px;font-size:11px;font-weight:800;cursor:pointer}.empty{text-align:center;height:230px;color:#929caf}
        .pagination{display:flex;align-items:center;justify-content:space-between;gap:15px;padding:13px 20px;border-top:1px solid #e7eaf2;color:#8a95a8;font-size:10.5px}.pagination div{display:flex;align-items:center;gap:9px}.pagination button{height:32px;padding:0 10px;border:1px solid #e0e4ed;background:white;border-radius:9px;font-size:10px;color:#66738a}.pagination button:disabled{opacity:.4}.pagination strong{font-size:10.5px;color:#59667e}
        .modal-backdrop{position:fixed;inset:0;background:rgba(20,28,48,.38);backdrop-filter:blur(5px);z-index:80;display:grid;place-items:center;padding:20px}.modal{width:min(560px,100%);max-height:90vh;overflow:auto;background:#fbfcff;border:1px solid #e1e5ef;border-radius:20px;box-shadow:0 30px 80px rgba(29,36,64,.24)}.modal-head{padding:20px 22px 15px;border-bottom:1px solid #e8ebf2;display:flex;justify-content:space-between;gap:15px}.modal-head h2{font-size:22px;margin:4px 0}.modal-head p{font-size:12px;color:#7d899f;margin:0}.close{width:34px;height:34px;border:1px solid #dfe3ec;background:white;border-radius:10px;font-size:20px;cursor:pointer}.modal form{padding:20px 22px}.modal label{display:block;font-size:11px;font-weight:800;color:#45536c;margin-bottom:13px}.modal input,.modal select{display:block;width:100%;height:42px;border:1px solid #dce1ec;border-radius:10px;background:white;padding:0 11px;margin-top:6px;font-size:12px;outline:0}.member-info{border:1px solid #e0e4ed;background:linear-gradient(135deg,#f7f9ff,#fbf8ff);border-radius:13px;padding:13px;margin-top:5px}.member-info>span{font-size:9px;letter-spacing:.12em;color:#7269e8;font-weight:900}.member-info div{display:flex;justify-content:space-between;gap:10px;padding:9px 0;border-bottom:1px solid #e8eaf2}.member-info div:last-child{border-bottom:0}.member-info strong{font-size:11.5px}.member-info small{font-size:10px;color:#8590a5}.member-info p{font-size:11px;color:#8994a8;margin:9px 0 2px}.modal-actions{display:flex;justify-content:flex-end;gap:9px;margin-top:18px}.modal-actions button{height:40px;padding:0 14px;border-radius:10px;font-size:11.5px;font-weight:850;cursor:pointer}.secondary{border:1px solid #dfe3ec;background:white;color:#56637a}.primary{border:0;background:linear-gradient(135deg,#5b59f6,#7650ef);color:white}
        @media(max-width:1100px){.stats{grid-template-columns:repeat(2,1fr)}.filters{grid-template-columns:1fr 150px}.filters select:last-child{grid-column:2}.sidebar{width:235px}main{margin-left:235px}}
        @media(max-width:820px){.sidebar{display:none}main{margin-left:0}.topbar{padding:0 16px}.search-top{display:none}.content{padding:22px 15px 40px}.stats{grid-template-columns:1fr 1fr}.filters{grid-template-columns:1fr}.filters select:last-child{grid-column:auto}.pagination{align-items:flex-start;flex-direction:column}header h1{font-size:27px}}
        @media(max-width:520px){.stats{grid-template-columns:1fr}.mini-profile span:last-child{display:none}.panel-head{align-items:flex-start;flex-direction:column}.modal-backdrop{padding:10px}}
      
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
  )
}

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function rupiah(value?: number | string | null) {
  const amount = Number(value ?? 0)
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number.isFinite(amount) ? amount : 0)
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
