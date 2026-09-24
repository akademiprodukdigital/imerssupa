'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '../../../lib/supabase'

type Product = {
  id: string
  name: string
  slug: string
  description: string | null
  price: number | string | null
  status: string
  cover_url?: string | null
  thumbnail_url?: string | null
  image_url?: string | null
  type?: string | null
}

type Media = {
  url?: string | null
  media_url?: string | null
  is_primary?: boolean
  media_type?: string
}

const money = (v: any) =>
  Number(v || 0) === 0
    ? 'GRATIS'
    : new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0,
      }).format(Number(v || 0))

export default function PublicProductPage() {
  const params = useParams()
  const router = useRouter()
  const qs = useSearchParams()
  const slug = String(params.slug || '')

  const [product, setProduct] = useState<Product | null>(null)
  const [image, setImage] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    void load()
  }, [slug])

  async function load() {
    setLoading(true)
    setError('')

    const r = await supabase
      .from('products')
      .select('*')
      .eq('slug', slug)
      .eq('status', 'published')
      .maybeSingle()

    if (r.error || !r.data) {
      setError(r.error?.message || 'Produk tidak ditemukan.')
      setLoading(false)
      return
    }

    const p = r.data as Product
    setProduct(p)
    setImage(p.cover_url || p.thumbnail_url || p.image_url || '')

    const m = await supabase
      .from('product_media')
      .select('*')
      .eq('product_id', p.id)
      .eq('media_type', 'image')
      .order('is_primary', { ascending: false })
      .limit(1)

    if (m.data?.[0]) {
      const x = m.data[0] as Media
      setImage(x.url || x.media_url || '')
    }

    setLoading(false)
  }

  function buy() {
    if (!product) return
    const q = new URLSearchParams()
    const coupon = qs.get('coupon')
    if (coupon) q.set('coupon', coupon)
    router.push(`/checkout/${product.slug}${q.size ? `?${q.toString()}` : ''}`)
  }

  if (loading) {
    return (
      <div className="page">
        <div className="container">
          <div className="loading-card">
            <div className="spinner" />
            <strong>Memuat produk...</strong>
            <span>Menyiapkan detail produk.</span>
          </div>
        </div>
        <style jsx global>{styles}</style>
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="page">
        <div className="container">
          <header className="top">
            <button className="brand" onClick={() => router.push('/')}>
              <span className="brandmark">S</span>
              <span>iMersSUPA</span>
            </button>
          </header>
          <div className="error-card">
            <span className="eyebrow">PRODUCT</span>
            <h1>Produk tidak dapat dibuka</h1>
            <p>{error || 'Produk tidak ditemukan.'}</p>
            <button className="btn secondary" onClick={() => router.push('/')}>
              ← Kembali ke Marketplace
            </button>
          </div>
        </div>
        <style jsx global>{styles}</style>
      </div>
    )
  }

  return (
    <div className="page">
      <header className="top">
        <button className="brand" onClick={() => router.push('/')}>
          <span className="brandmark">S</span>
          <span>iMersSUPA</span>
        </button>

        <button className="back" onClick={() => router.push('/')}>
          ← Marketplace
        </button>
      </header>

      <main className="container">
        <div className="breadcrumb">Marketplace <span>/</span> Produk</div>

        <div className="grid">
          <section className="card product-card">
            <div className="cover">
              {image ? (
                <img src={image} alt={product.name} />
              ) : (
                <div className="cover-placeholder">
                  <span>DIGITAL PRODUCT</span>
                  <strong>{product.name}</strong>
                </div>
              )}
            </div>

            <div className="content">
              <span className="badge">{product.type || 'Digital Product'}</span>
              <h1>{product.name}</h1>
              <div className="description">
                {product.description || 'Produk digital iMersSUPA.'}
              </div>
            </div>
          </section>

          <aside className="card purchase-card">
            <div className="eyebrow">PRODUK DIGITAL</div>
            <h2>Harga Produk</h2>

            <div className="price">{money(product.price)}</div>

            <div className="trust-list">
              <div><span>✓</span> Akses produk digital</div>
              <div><span>✓</span> Checkout aman</div>
              <div><span>✓</span> Total dihitung ulang oleh server</div>
            </div>

            <button className="btn primary" onClick={buy}>
              Beli Sekarang <span>→</span>
            </button>

            <p className="secure">
              🔒 Transaksi diproses melalui sistem checkout iMersSUPA.
            </p>
          </aside>
        </div>
      </main>

      <style jsx global>{styles}</style>
    </div>
  )
}

const styles = `
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;color:#17213b;background:#f6f8fc}
button{font:inherit}
button{cursor:pointer}
.page{min-height:100vh;background:
radial-gradient(circle at 8% 0,rgba(99,102,241,.11),transparent 28%),
radial-gradient(circle at 94% 5%,rgba(14,165,233,.10),transparent 28%),
linear-gradient(180deg,#f9fbff 0%,#f4f7fb 55%,#fff 100%)}
.container{width:min(1120px,calc(100% - 40px));margin:0 auto}
.top{height:76px;width:min(1120px,calc(100% - 40px));margin:auto;display:flex;align-items:center;justify-content:space-between}
.brand{border:0;background:transparent;display:flex;align-items:center;gap:10px;color:#18243d;font-weight:950;font-size:18px;padding:0}
.brandmark{width:38px;height:38px;border-radius:11px;display:grid;place-items:center;color:#fff;background:linear-gradient(135deg,#14b8a6,#3b82f6 52%,#7c3aed);box-shadow:0 9px 24px rgba(59,130,246,.20);font-weight:950}
.back{border:1px solid #dce3ee;background:#fff;color:#4c5a72;border-radius:11px;padding:10px 14px;font-weight:800;box-shadow:0 5px 18px rgba(30,45,80,.05)}
.breadcrumb{font-size:12px;color:#8995a9;margin:8px 0 18px}.breadcrumb span{margin:0 8px;color:#c1c8d4}
.grid{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(310px,.65fr);gap:20px;align-items:start;padding-bottom:75px}
.card{background:rgba(255,255,255,.94);border:1px solid #e1e7f0;border-radius:24px;box-shadow:0 20px 60px rgba(34,49,80,.08)}
.product-card{overflow:hidden}
.cover{margin:20px 20px 0;aspect-ratio:16/9;border-radius:18px;overflow:hidden;background:linear-gradient(135deg,#eef2ff,#eaf7ff);border:1px solid #e0e7f1}
.cover img{display:block;width:100%;height:100%;object-fit:cover}
.cover-placeholder{width:100%;height:100%;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;padding:30px;background:radial-gradient(circle at 30% 20%,rgba(99,102,241,.16),transparent 35%),linear-gradient(135deg,#eef2ff,#edf8ff)}
.cover-placeholder span{font-size:10px;letter-spacing:.16em;font-weight:950;color:#6672df}.cover-placeholder strong{max-width:80%;margin-top:10px;font-size:25px;color:#263453}
.content{padding:25px 26px 30px}.badge{display:inline-flex;padding:7px 10px;border-radius:999px;background:#eef2ff;border:1px solid #dce3ff;color:#5867e8;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.04em}
.content h1{font-size:36px;line-height:1.12;letter-spacing:-.04em;margin:13px 0 14px;color:#18243d}.description{white-space:pre-wrap;color:#68758c;font-size:15px;line-height:1.75}
.purchase-card{padding:26px;position:sticky;top:94px}.eyebrow{font-size:10px;letter-spacing:.15em;font-weight:950;color:#5867e8}.purchase-card h2{font-size:17px;margin:9px 0 0;color:#34425b}.price{font-size:34px;font-weight:950;letter-spacing:-.04em;color:#18243d;margin:7px 0 20px}
.trust-list{border-top:1px solid #edf0f5;border-bottom:1px solid #edf0f5;padding:6px 0 8px;margin-bottom:20px}.trust-list div{padding:10px 0;color:#5e6b81;font-size:12px}.trust-list span{display:inline-grid;place-items:center;width:20px;height:20px;border-radius:50%;background:#e9faf3;color:#20966a;font-weight:950;margin-right:7px}
.btn{border:0;border-radius:13px;padding:14px 18px;font-weight:900}.primary{width:100%;color:#fff;background:linear-gradient(135deg,#5268ff,#7548ec 55%,#168eea);box-shadow:0 12px 28px rgba(84,99,235,.22)}.primary span{margin-left:7px}.secondary{background:#fff;border:1px solid #dce3ee;color:#4d5b72}
.secure{text-align:center;color:#99a3b3;font-size:10px;line-height:1.5;margin:13px 0 0}
.loading-card,.error-card{width:min(620px,100%);margin:110px auto;padding:32px;background:#fff;border:1px solid #e1e7f0;border-radius:22px;box-shadow:0 20px 60px rgba(34,49,80,.08);text-align:center}.loading-card strong{display:block;margin-top:13px}.loading-card span{display:block;margin-top:6px;color:#8a95a8;font-size:12px}.spinner{width:32px;height:32px;border-radius:50%;border:3px solid #e3e8f2;border-top-color:#5867e8;margin:auto;animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}.error-card{text-align:left}.error-card h1{font-size:28px;margin:8px 0}.error-card p{color:#718098;line-height:1.6;margin:0 0 20px}
@media(max-width:800px){.container,.top{width:min(100% - 28px,1120px)}.grid{grid-template-columns:1fr}.purchase-card{position:static}.content h1{font-size:29px}.cover{margin:14px 14px 0}.content{padding:21px}.purchase-card{padding:21px}.breadcrumb{margin-top:3px}}
@media(max-width:520px){.top{height:68px}.brand{font-size:16px}.brandmark{width:34px;height:34px}.back{padding:9px 11px;font-size:12px}.content h1{font-size:26px}.price{font-size:31px}}
`
