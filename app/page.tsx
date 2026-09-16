'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import ThemeSwitcher from '../components/ThemeSwitcher'

type HomepageMode = 'marketplace' | 'custom_html' | 'off'

type HomepageConfig = {
  mode?: HomepageMode

  brand_name?: string
  brand_tagline?: string
  logo_url?: string
  icon_url?: string

  hero_badge?: string
  hero_title?: string
  hero_highlight?: string
  hero_description?: string

  primary_cta_text?: string
  primary_cta_url?: string
  secondary_cta_text?: string
  secondary_cta_url?: string

  featured_title?: string
  featured_description?: string

  latest_title?: string
  latest_description?: string

  search_placeholder?: string
  empty_products_text?: string

  product_detail_text?: string
  member_product_text?: string

  heading_font?: string
  body_font?: string

  primary_color?: string
  secondary_color?: string
  accent_color?: string

  background_start?: string
  background_end?: string

  card_radius?: string

  login_text?: string
  member_area_text?: string

  footer_text?: string

  custom_html?: string
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

  [key: string]: unknown
}

const fallbackConfig: HomepageConfig = {
  mode: 'marketplace',

  brand_name: 'Digital Marketplace',
  brand_tagline: 'Digital Product Marketplace',

  logo_url: '',
  icon_url: '',

  hero_badge: 'DIGITAL PRODUCT MARKETPLACE',
  hero_title: 'Temukan Produk Digital Pilihan',
  hero_highlight: 'Untuk Membantu Anda Bertumbuh.',
  hero_description:
    'Jelajahi koleksi produk digital, materi pembelajaran, resource dan berbagai konten pilihan dalam satu platform.',

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

export default function MarketplaceHomepage() {
  const router = useRouter()

  const [config, setConfig] =
    useState<HomepageConfig>(fallbackConfig)

  const [products, setProducts] =
    useState<Product[]>([])

  const [loading, setLoading] =
    useState(true)

  const [error, setError] =
    useState('')

  const [search, setSearch] =
    useState('')

  const [userLoggedIn, setUserLoggedIn] =
    useState(false)

  const [mobileMenu, setMobileMenu] =
    useState(false)

  useEffect(() => {
    loadHomepage()
  }, [])

  async function loadHomepage() {
    setLoading(true)
    setError('')

    const settingsResult = await supabase
      .from('platform_settings')
      .select('setting_value')
      .eq('setting_group', 'homepage')
      .eq('setting_key', 'config')
      .maybeSingle()

    let loadedConfig: HomepageConfig =
      fallbackConfig

    if (
      !settingsResult.error &&
      settingsResult.data?.setting_value
    ) {
      loadedConfig = {
        ...fallbackConfig,
        ...(settingsResult.data
          .setting_value as HomepageConfig),
      }

      setConfig(loadedConfig)
    } else if (settingsResult.error) {
      setError(
        'Pengaturan homepage belum dapat dimuat.'
      )
    }

    if (loadedConfig.mode === 'off') {
      router.replace('/login')
      return
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    setUserLoggedIn(Boolean(user))

    if (loadedConfig.mode === 'marketplace') {
      const productsResult = await supabase
        .from('products')
        .select('*')
        .eq('status', 'published')

      if (productsResult.error) {
        setError(
          `Produk belum dapat dimuat: ${productsResult.error.message}`
        )
      } else {
        setProducts(
          (productsResult.data ?? []) as Product[]
        )
      }
    }

    setLoading(false)
  }

  const filteredProducts = useMemo(() => {
    const keyword = search
      .trim()
      .toLowerCase()

    const sorted = [...products].sort(
      (a, b) => {
        const aTime = a.created_at
          ? new Date(a.created_at).getTime()
          : 0

        const bTime = b.created_at
          ? new Date(b.created_at).getTime()
          : 0

        return bTime - aTime
      }
    )

    if (!keyword) {
      return sorted
    }

    return sorted.filter((product) => {
      const haystack = [
        product.name,
        product.description ?? '',
        product.type ?? '',
      ]
        .join(' ')
        .toLowerCase()

      return haystack.includes(keyword)
    })
  }, [products, search])

  const featuredProducts = useMemo(() => {
    const explicitlyFeatured =
      products.filter(
        (product) =>
          product.is_featured === true ||
          product.featured === true
      )

    if (explicitlyFeatured.length > 0) {
      return explicitlyFeatured.slice(0, 4)
    }

    return [...products]
      .sort((a, b) => {
        const aTime = a.created_at
          ? new Date(a.created_at).getTime()
          : 0

        const bTime = b.created_at
          ? new Date(b.created_at).getTime()
          : 0

        return bTime - aTime
      })
      .slice(0, 4)
  }, [products])

  function go(url?: string) {
    if (!url) return

    if (url.startsWith('#')) {
      const target =
        document.querySelector(url)

      target?.scrollIntoView({
        behavior: 'smooth',
      })

      return
    }

    if (
      url.startsWith('http://') ||
      url.startsWith('https://')
    ) {
      window.location.href = url
      return
    }

    router.push(url)
  }

  function openProduct(product: Product) {
    /*
      Untuk sekarang detail publik diarahkan
      berdasarkan slug.

      Route detail marketplace publik akan kita
      buat sesudah homepage ini hidup.
    */

    router.push(`/product/${product.slug}`)
  }

  function formatPrice(
    value?: number | string | null
  ) {
    if (
      value === null ||
      value === undefined ||
      value === ''
    ) {
      return 'Lihat Produk'
    }

    const numberValue =
      typeof value === 'number'
        ? value
        : Number(value)

    if (
      Number.isNaN(numberValue)
    ) {
      return String(value)
    }

    if (numberValue === 0) {
      return 'GRATIS'
    }

    return new Intl.NumberFormat(
      'id-ID',
      {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0,
      }
    ).format(numberValue)
  }

  function productImage(
    product: Product
  ) {
    return (
      product.cover_url ||
      product.thumbnail_url ||
      product.image_url ||
      ''
    )
  }

  if (loading) {
    return (
      <>
        <main className="market-loading">
          <ThemeSwitcher />

          <div className="market-loader-card">
            <div className="loader-brand">
              <div className="loader-logo">
                D
              </div>

              <strong>
                {config.brand_name}
              </strong>
            </div>

            <p>
              Menyiapkan marketplace...
            </p>

            <div className="loading-line">
              <span />
            </div>
          </div>
        </main>

        <MarketplaceStyles />
      </>
    )
  }

  if (
    config.mode === 'custom_html'
  ) {
    return (
      <CustomHtmlHomepage
        html={config.custom_html ?? ''}
      />
    )
  }

  return (
    <>
      <div
        className="marketplace-page"
        style={
          {
            '--market-primary':
              config.primary_color ||
              '#6366f1',

            '--market-secondary':
              config.secondary_color ||
              '#7c3aed',

            '--market-accent':
              config.accent_color ||
              '#38bdf8',

            '--market-bg-start':
              config.background_start ||
              '#030712',

            '--market-bg-end':
              config.background_end ||
              '#111827',

            '--market-radius':
              config.card_radius ||
              '20px',

            '--market-heading-font':
              `"${config.heading_font || 'Poppins'}", sans-serif`,

            '--market-body-font':
              `"${config.body_font || 'Inter'}", sans-serif`,
          } as React.CSSProperties
        }
      >
        <ThemeSwitcher />

        <div className="market-glow market-glow-one" />
        <div className="market-glow market-glow-two" />
        <div className="market-glow market-glow-three" />

        {/* ==============================
            NAVBAR
        ============================== */}

        <header className="market-navbar">
          <div className="market-container navbar-inner">

            <button
              className="market-brand"
              onClick={() =>
                window.scrollTo({
                  top: 0,
                  behavior: 'smooth',
                })
              }
            >
              {config.logo_url ? (
                <img
                  src={config.logo_url}
                  alt={
                    config.brand_name ||
                    'Brand'
                  }
                  className="brand-image"
                />
              ) : (
                <div className="brand-mark">
                  {(
                    config.brand_name ||
                    'D'
                  )
                    .charAt(0)
                    .toUpperCase()}
                </div>
              )}

              <div className="brand-copy">
                <strong>
                  {config.brand_name}
                </strong>

                <span>
                  {config.brand_tagline}
                </span>
              </div>
            </button>

            <nav className="desktop-nav">
              <button
                onClick={() =>
                  go('#products')
                }
              >
                Produk
              </button>

              <button
                onClick={() =>
                  go('#featured')
                }
              >
                Unggulan
              </button>

              <button
                onClick={() =>
                  go('#about')
                }
              >
                Tentang
              </button>
            </nav>

            <div className="navbar-actions">
              {userLoggedIn ? (
                <button
                  className="member-button"
                  onClick={() =>
                    router.push('/member')
                  }
                >
                  {config.member_area_text}
                  <span>→</span>
                </button>
              ) : (
                <button
                  className="login-button"
                  onClick={() =>
                    router.push('/login')
                  }
                >
                  {config.login_text}
                </button>
              )}

              <button
                className="mobile-menu-button"
                onClick={() =>
                  setMobileMenu(
                    !mobileMenu
                  )
                }
              >
                {mobileMenu ? '×' : '☰'}
              </button>
            </div>

          </div>

          {mobileMenu && (
            <div className="mobile-market-menu">
              <button
                onClick={() => {
                  go('#products')
                  setMobileMenu(false)
                }}
              >
                Produk
              </button>

              <button
                onClick={() => {
                  go('#featured')
                  setMobileMenu(false)
                }}
              >
                Produk Unggulan
              </button>

              <button
                onClick={() => {
                  go('#about')
                  setMobileMenu(false)
                }}
              >
                Tentang
              </button>

              <button
                onClick={() => {
                  router.push(
                    userLoggedIn
                      ? '/member'
                      : '/login'
                  )
                }}
              >
                {userLoggedIn
                  ? config.member_area_text
                  : config.login_text}
              </button>
            </div>
          )}
        </header>

        {/* ==============================
            HERO
        ============================== */}

        <main>
          <section className="market-hero">
            <div className="market-container hero-grid">

              <div className="hero-copy">
                <div className="hero-badge">
                  <span />
                  {config.hero_badge}
                </div>

                <h1>
                  {config.hero_title}
                  <span>
                    {' '}
                    {config.hero_highlight}
                  </span>
                </h1>

                <p>
                  {config.hero_description}
                </p>

                <div className="hero-actions">
                  <button
                    className="primary-button"
                    onClick={() =>
                      go(
                        config.primary_cta_url
                      )
                    }
                  >
                    {
                      config.primary_cta_text
                    }
                    <span>→</span>
                  </button>

                  <button
                    className="secondary-button"
                    onClick={() =>
                      go(
                        config.secondary_cta_url
                      )
                    }
                  >
                    {
                      config.secondary_cta_text
                    }
                  </button>
                </div>

                <div className="hero-trust">
                  <div className="trust-item">
                    <span>✓</span>
                    Produk Digital
                  </div>

                  <div className="trust-item">
                    <span>✓</span>
                    Member Access
                  </div>

                  <div className="trust-item">
                    <span>✓</span>
                    Learning Progress
                  </div>
                </div>
              </div>

              <div className="hero-visual">
                <div className="visual-main-card">
                  <div className="visual-top">
                    <div className="visual-icon">
                      ✦
                    </div>

                    <span>
                      DIGITAL PRODUCTS
                    </span>
                  </div>

                  <h3>
                    Explore.
                    <br />
                    Learn.
                    <br />
                    <span>
                      Grow.
                    </span>
                  </h3>

                  <div className="visual-progress">
                    <div>
                      <span>
                        Marketplace
                      </span>

                      <strong>
                        READY
                      </strong>
                    </div>

                    <div className="visual-progress-track">
                      <span />
                    </div>
                  </div>
                </div>

                <div className="floating-card floating-one">
                  <div>▶</div>

                  <span>
                    <strong>
                      Digital Course
                    </strong>

                    <small>
                      Learn anywhere
                    </small>
                  </span>
                </div>

                <div className="floating-card floating-two">
                  <div>◆</div>

                  <span>
                    <strong>
                      Resources
                    </strong>

                    <small>
                      Ready to access
                    </small>
                  </span>
                </div>

                <div className="floating-card floating-three">
                  <div>✓</div>

                  <span>
                    <strong>
                      Secure Access
                    </strong>

                    <small>
                      Member protected
                    </small>
                  </span>
                </div>
              </div>

            </div>
          </section>

          {/* ==============================
              SEARCH
          ============================== */}

          <section className="search-section">
            <div className="market-container">

              <div className="market-search">
                <div className="search-icon">
                  ⌕
                </div>

                <input
                  value={search}
                  onChange={(event) =>
                    setSearch(
                      event.target.value
                    )
                  }
                  placeholder={
                    config.search_placeholder
                  }
                />

                {search && (
                  <button
                    onClick={() =>
                      setSearch('')
                    }
                  >
                    ×
                  </button>
                )}
              </div>

              <div className="search-meta">
                <span>
                  {filteredProducts.length}{' '}
                  produk ditemukan
                </span>

                {search && (
                  <span>
                    Hasil pencarian untuk
                    “{search}”
                  </span>
                )}
              </div>

            </div>
          </section>

          {/* ==============================
              FEATURED
          ============================== */}

          {!search &&
            featuredProducts.length > 0 && (
              <section
                className="product-section"
                id="featured"
              >
                <div className="market-container">

                  <SectionHeading
                    badge="FEATURED"
                    title={
                      config.featured_title ||
                      ''
                    }
                    description={
                      config.featured_description ||
                      ''
                    }
                  />

                  <div className="featured-grid">
                    {featuredProducts.map(
                      (
                        product,
                        index
                      ) => (
                        <ProductCard
                          key={
                            product.id
                          }
                          product={
                            product
                          }
                          image={
                            productImage(
                              product
                            )
                          }
                          price={formatPrice(
                            product.price
                          )}
                          buttonText={
                            config.product_detail_text ||
                            'Lihat Detail'
                          }
                          index={
                            index
                          }
                          featured
                          onOpen={() =>
                            openProduct(
                              product
                            )
                          }
                        />
                      )
                    )}
                  </div>

                </div>
              </section>
            )}

          {/* ==============================
              ALL PRODUCTS
          ============================== */}

          <section
            className="product-section latest-section"
            id="products"
          >
            <div className="market-container">

              <SectionHeading
                badge={
                  search
                    ? 'SEARCH RESULTS'
                    : 'MARKETPLACE'
                }
                title={
                  search
                    ? 'Hasil Pencarian'
                    : config.latest_title ||
                      ''
                }
                description={
                  search
                    ? `Menampilkan produk yang sesuai dengan “${search}”.`
                    : config.latest_description ||
                      ''
                }
              />

              {error && (
                <div className="market-error">
                  <span>!</span>

                  <div>
                    <strong>
                      Informasi
                    </strong>

                    <p>
                      {error}
                    </p>
                  </div>
                </div>
              )}

              {filteredProducts.length >
              0 ? (
                <div className="product-grid">
                  {filteredProducts.map(
                    (
                      product,
                      index
                    ) => (
                      <ProductCard
                        key={
                          product.id
                        }
                        product={
                          product
                        }
                        image={
                          productImage(
                            product
                          )
                        }
                        price={formatPrice(
                          product.price
                        )}
                        buttonText={
                          config.product_detail_text ||
                          'Lihat Detail'
                        }
                        index={
                          index
                        }
                        onOpen={() =>
                          openProduct(
                            product
                          )
                        }
                      />
                    )
                  )}
                </div>
              ) : (
                <div className="empty-products">
                  <div className="empty-icon">
                    ◇
                  </div>

                  <h3>
                    {config.empty_products_text}
                  </h3>

                  {search && (
                    <>
                      <p>
                        Coba gunakan kata
                        pencarian yang berbeda.
                      </p>

                      <button
                        onClick={() =>
                          setSearch('')
                        }
                      >
                        Tampilkan Semua Produk
                      </button>
                    </>
                  )}
                </div>
              )}

            </div>
          </section>

          {/* ==============================
              WHY / ABOUT
          ============================== */}

          <section
            className="about-section"
            id="about"
          >
            <div className="market-container">

              <div className="about-card">

                <div className="about-copy">
                  <div className="hero-badge">
                    <span />
                    DIGITAL EXPERIENCE
                  </div>

                  <h2>
                    Satu tempat untuk
                    produk digital dan
                    pengalaman belajar.
                  </h2>

                  <p>
                    Temukan produk,
                    akses materi, lanjutkan
                    pembelajaran dan kelola
                    seluruh konten digital
                    melalui satu akun.
                  </p>

                  <button
                    className="primary-button"
                    onClick={() =>
                      router.push(
                        userLoggedIn
                          ? '/member'
                          : '/login'
                      )
                    }
                  >
                    {userLoggedIn
                      ? config.member_area_text
                      : config.secondary_cta_text}

                    <span>→</span>
                  </button>
                </div>

                <div className="benefit-grid">

                  <Benefit
                    icon="◇"
                    title="Digital Products"
                    description="Akses koleksi produk digital dalam satu tempat."
                  />

                  <Benefit
                    icon="▶"
                    title="Learning Content"
                    description="Materi tersusun dalam module dan lesson."
                  />

                  <Benefit
                    icon="✓"
                    title="Progress"
                    description="Pantau perkembangan belajar secara otomatis."
                  />

                  <Benefit
                    icon="◆"
                    title="Resources"
                    description="Resource dan bonus tetap mudah ditemukan."
                  />

                </div>

              </div>

            </div>
          </section>
        </main>

        {/* ==============================
            FOOTER
        ============================== */}

        <footer className="market-footer">
          <div className="market-container footer-inner">

            <div className="footer-brand">
              {config.logo_url ? (
                <img
                  src={config.logo_url}
                  alt={
                    config.brand_name ||
                    'Brand'
                  }
                />
              ) : (
                <div className="footer-mark">
                  {(
                    config.brand_name ||
                    'D'
                  )
                    .charAt(0)
                    .toUpperCase()}
                </div>
              )}

              <div>
                <strong>
                  {config.brand_name}
                </strong>

                <span>
                  {config.footer_text}
                </span>
              </div>
            </div>

            <div className="footer-copy">
              © {new Date().getFullYear()}{' '}
              {config.brand_name}
            </div>

          </div>
        </footer>
      </div>

      <MarketplaceStyles />
    </>
  )
}

/* ============================================================
   CUSTOM SINGLE HTML
============================================================ */

function CustomHtmlHomepage({
  html,
}: {
  html: string
}) {
  if (!html.trim()) {
    return (
      <>
        <main className="custom-empty">
          <ThemeSwitcher />

          <div>
            <span>◇</span>

            <h1>
              Custom Homepage
            </h1>

            <p>
              HTML homepage belum
              tersedia.
            </p>

            <a href="/login">
              Masuk
            </a>
          </div>
        </main>

        <MarketplaceStyles />
      </>
    )
  }

  /*
    Custom HTML dirender dalam iframe srcDoc.

    Sandbox sengaja TIDAK memberikan
    allow-same-origin agar custom HTML
    terisolasi dari session/auth aplikasi.

    allow-scripts dipakai supaya single HTML
    dengan animasi/interaksi JS tetap dapat
    bekerja di dalam sandbox.
  */

  return (
    <iframe
      title="Custom Homepage"
      srcDoc={html}
      sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        border: 0,
        background: '#ffffff',
      }}
    />
  )
}

/* ============================================================
   SMALL COMPONENTS
============================================================ */

function SectionHeading({
  badge,
  title,
  description,
}: {
  badge: string
  title: string
  description: string
}) {
  return (
    <div className="section-heading">
      <div>
        <span>
          {badge}
        </span>

        <h2>
          {title}
        </h2>

        <p>
          {description}
        </p>
      </div>
    </div>
  )
}

function ProductCard({
  product,
  image,
  price,
  buttonText,
  index,
  featured = false,
  onOpen,
}: {
  product: Product
  image: string
  price: string
  buttonText: string
  index: number
  featured?: boolean
  onOpen: () => void
}) {
  const classNumber =
    (index % 6) + 1

  return (
    <article
      className={`market-product-card ${
        featured
          ? 'featured-product'
          : ''
      }`}
    >
      <button
        className={`product-cover cover-${classNumber}`}
        onClick={onOpen}
      >
        {image ? (
          <img
            src={image}
            alt={product.name}
          />
        ) : (
          <>
            <div className="cover-shape cover-shape-one" />
            <div className="cover-shape cover-shape-two" />

            <div className="cover-placeholder">
              <span>
                DIGITAL PRODUCT
              </span>

              <strong>
                {product.name}
              </strong>

              <small>
                {product.type ||
                  'Digital'}
              </small>
            </div>
          </>
        )}

        {featured && (
          <div className="featured-label">
            ✦ UNGGULAN
          </div>
        )}
      </button>

      <div className="product-content">

        <div className="product-type">
          {product.type ||
            'DIGITAL PRODUCT'}
        </div>

        <h3>
          {product.name}
        </h3>

        <p>
          {product.description ||
            'Produk digital tersedia untuk Anda.'}
        </p>

        <div className="product-bottom">
          <div className="product-price">
            <small>
              Harga
            </small>

            <strong>
              {price}
            </strong>
          </div>

          <button
            className="product-open"
            onClick={onOpen}
          >
            {buttonText}
            <span>→</span>
          </button>
        </div>

      </div>
    </article>
  )
}

function Benefit({
  icon,
  title,
  description,
}: {
  icon: string
  title: string
  description: string
}) {
  return (
    <article className="benefit">
      <div>
        {icon}
      </div>

      <strong>
        {title}
      </strong>

      <p>
        {description}
      </p>
    </article>
  )
}

/* ============================================================
   STYLES
============================================================ */

function MarketplaceStyles() {
  return (
    <style jsx global>{`
      .marketplace-page {
        --market-primary: #6366f1;
        --market-secondary: #7c3aed;
        --market-accent: #38bdf8;
        --market-bg-start: #030712;
        --market-bg-end: #111827;
        --market-radius: 20px;
        --market-heading-font:
          "Poppins", sans-serif;
        --market-body-font:
          "Inter", sans-serif;

        position: relative;
        min-height: 100vh;
        overflow: hidden;
        color:
          var(--text-primary);
        font-family:
          var(--market-body-font);
        background:
          var(--page-gradient);
      }

      .marketplace-page button,
      .marketplace-page input {
        font-family:
          var(--market-body-font);
      }

      .marketplace-page h1,
      .marketplace-page h2,
      .marketplace-page h3,
      .marketplace-page strong {
        font-family:
          var(--market-heading-font);
      }

      .market-container {
        position: relative;
        z-index: 2;
        width:
          min(1180px, calc(100% - 40px));
        margin: 0 auto;
      }

      .market-glow {
        position: fixed;
        z-index: 0;
        border-radius: 50%;
        pointer-events: none;
        filter: blur(20px);
      }

      .market-glow-one {
        top: -250px;
        left: -180px;
        width: 600px;
        height: 600px;
        opacity: .2;
        background:
          var(--market-primary);
      }

      .market-glow-two {
        right: -230px;
        bottom: -260px;
        width: 650px;
        height: 650px;
        opacity: .16;
        background:
          var(--market-secondary);
      }

      .market-glow-three {
        top: 35%;
        left: 45%;
        width: 380px;
        height: 380px;
        opacity: .08;
        background:
          var(--market-accent);
      }

      /* NAV */

      .market-navbar {
        position: sticky;
        top: 0;
        z-index: 100;
        border-bottom:
          1px solid var(--border);
        background:
          var(--topbar-bg);
        backdrop-filter:
          blur(22px);
        -webkit-backdrop-filter:
          blur(22px);
      }

      .navbar-inner {
        min-height: 76px;
        display: flex;
        align-items: center;
        justify-content:
          space-between;
        gap: 25px;
      }

      .market-brand {
        min-width: 0;
        display: flex;
        align-items: center;
        gap: 11px;
        padding: 0;
        border: 0;
        cursor: pointer;
        color:
          var(--text-primary);
        text-align: left;
        background: transparent;
      }

      .brand-mark,
      .footer-mark {
        width: 43px;
        height: 43px;
        flex: 0 0 auto;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 14px;
        color: #fff;
        font-size: 18px;
        font-weight: 950;
        background:
          linear-gradient(
            135deg,
            var(--market-primary),
            var(--market-secondary)
          );
        box-shadow:
          0 12px 28px
          color-mix(
            in srgb,
            var(--market-primary) 25%,
            transparent
          );
      }

      .brand-image {
        max-width: 165px;
        max-height: 46px;
        object-fit: contain;
      }

      .brand-copy {
        min-width: 0;
        display: grid;
        gap: 2px;
      }

      .brand-copy strong {
        font-size: 15px;
        line-height: 1;
      }

      .brand-copy span {
        max-width: 180px;
        overflow: hidden;
        color:
          var(--text-muted);
        font-size: 6px;
        font-weight: 800;
        letter-spacing: 1.1px;
        text-transform: uppercase;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .desktop-nav {
        display: flex;
        align-items: center;
        gap: 5px;
      }

      .desktop-nav button {
        padding: 9px 13px;
        border: 0;
        border-radius: 10px;
        cursor: pointer;
        color:
          var(--text-muted);
        font-size: 8px;
        font-weight: 800;
        background: transparent;
        transition: .2s ease;
      }

      .desktop-nav button:hover {
        color:
          var(--text-primary);
        background:
          var(--card-gradient);
      }

      .navbar-actions {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .login-button {
        padding: 10px 17px;
        border:
          1px solid var(--border);
        border-radius: 11px;
        cursor: pointer;
        color:
          var(--text-primary);
        font-size: 8px;
        font-weight: 850;
        background:
          var(--surface-gradient);
      }

      .member-button {
        padding: 10px 15px;
        display: flex;
        align-items: center;
        gap: 8px;
        border: 0;
        border-radius: 11px;
        cursor: pointer;
        color: #fff;
        font-size: 8px;
        font-weight: 850;
        background:
          linear-gradient(
            135deg,
            var(--market-primary),
            var(--market-secondary)
          );
      }

      .mobile-menu-button {
        display: none;
      }

      .mobile-market-menu {
        display: none;
      }

      /* HERO */

      .market-hero {
        position: relative;
        padding:
          105px 0 85px;
      }

      .hero-grid {
        display: grid;
        grid-template-columns:
          minmax(0, 1.08fr)
          minmax(360px, .92fr);
        align-items: center;
        gap: 80px;
      }

      .hero-copy {
        max-width: 680px;
      }

      .hero-badge {
        width: fit-content;
        padding: 7px 10px;
        display: flex;
        align-items: center;
        gap: 7px;
        border:
          1px solid
          color-mix(
            in srgb,
            var(--market-primary) 28%,
            var(--border)
          );
        border-radius: 999px;
        color:
          var(--accent-light);
        font-size: 6px;
        font-weight: 950;
        letter-spacing: 1.4px;
        background:
          color-mix(
            in srgb,
            var(--market-primary) 8%,
            transparent
          );
      }

      .hero-badge > span {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background:
          var(--market-accent);
        box-shadow:
          0 0 13px
          var(--market-accent);
      }

      .hero-copy h1 {
        max-width: 760px;
        margin: 18px 0 17px;
        font-size:
          clamp(42px, 5.4vw, 72px);
        line-height: .99;
        letter-spacing: -3px;
      }

      .hero-copy h1 span {
        display: block;
        color: transparent;
        background:
          linear-gradient(
            90deg,
            var(--market-accent),
            var(--market-primary),
            #c084fc
          );
        -webkit-background-clip: text;
        background-clip: text;
      }

      .hero-copy > p {
        max-width: 610px;
        margin: 0;
        color:
          var(--text-muted);
        font-size: 11px;
        line-height: 1.8;
      }

      .hero-actions {
        margin-top: 27px;
        display: flex;
        flex-wrap: wrap;
        gap: 9px;
      }

      .primary-button,
      .secondary-button {
        min-height: 43px;
        padding: 0 17px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        border-radius: 12px;
        cursor: pointer;
        font-size: 8px;
        font-weight: 900;
      }

      .primary-button {
        border: 0;
        color: #fff;
        background:
          linear-gradient(
            135deg,
            var(--market-primary),
            var(--market-secondary)
          );
        box-shadow:
          0 13px 35px
          color-mix(
            in srgb,
            var(--market-primary) 25%,
            transparent
          );
      }

      .secondary-button {
        border:
          1px solid var(--border);
        color:
          var(--text-primary);
        background:
          var(--surface-gradient);
      }

      .hero-trust {
        margin-top: 23px;
        display: flex;
        flex-wrap: wrap;
        gap: 17px;
      }

      .trust-item {
        display: flex;
        align-items: center;
        gap: 6px;
        color:
          var(--text-muted);
        font-size: 7px;
        font-weight: 700;
      }

      .trust-item span {
        width: 18px;
        height: 18px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 6px;
        color:
          var(--success);
        font-size: 7px;
        background:
          rgba(34,197,94,.09);
      }

      /* HERO VISUAL */

      .hero-visual {
        position: relative;
        min-height: 440px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .visual-main-card {
        position: relative;
        width: min(370px, 90%);
        min-height: 390px;
        padding: 28px;
        overflow: hidden;
        border:
          1px solid var(--border);
        border-radius: 32px;
        background:
          linear-gradient(
            145deg,
            color-mix(
              in srgb,
              var(--market-primary) 20%,
              var(--surface)
            ),
            color-mix(
              in srgb,
              var(--market-secondary) 14%,
              var(--surface)
            )
          );
        box-shadow:
          var(--shadow);
        transform:
          rotate(3deg);
      }

      .visual-main-card::after {
        content: "";
        position: absolute;
        width: 280px;
        height: 280px;
        right: -100px;
        bottom: -100px;
        border-radius: 50%;
        background:
          var(--market-secondary);
        opacity: .13;
        filter: blur(20px);
      }

      .visual-top {
        display: flex;
        align-items: center;
        gap: 9px;
      }

      .visual-icon {
        width: 39px;
        height: 39px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 13px;
        color: #fff;
        background:
          linear-gradient(
            135deg,
            var(--market-primary),
            var(--market-secondary)
          );
      }

      .visual-top span {
        color:
          var(--text-muted);
        font-size: 6px;
        font-weight: 950;
        letter-spacing: 1.4px;
      }

      .visual-main-card h3 {
        margin: 52px 0;
        font-size: 48px;
        line-height: .95;
        letter-spacing: -2px;
      }

      .visual-main-card h3 span {
        color:
          var(--market-accent);
      }

      .visual-progress {
        position: relative;
        z-index: 2;
        padding: 14px;
        border:
          1px solid var(--border);
        border-radius: 15px;
        background:
          var(--surface-soft);
      }

      .visual-progress > div:first-child {
        display: flex;
        justify-content:
          space-between;
        color:
          var(--text-muted);
        font-size: 7px;
      }

      .visual-progress strong {
        color:
          var(--success);
        font-size: 6px;
      }

      .visual-progress-track {
        height: 5px;
        margin-top: 9px;
        overflow: hidden;
        border-radius: 999px;
        background:
          rgba(99,102,241,.08);
      }

      .visual-progress-track span {
        display: block;
        width: 84%;
        height: 100%;
        border-radius: inherit;
        background:
          linear-gradient(
            90deg,
            var(--market-accent),
            var(--market-secondary)
          );
      }

      .floating-card {
        position: absolute;
        z-index: 5;
        min-width: 175px;
        padding: 11px;
        display: flex;
        align-items: center;
        gap: 9px;
        border:
          1px solid var(--border);
        border-radius: 14px;
        background:
          var(--surface-gradient);
        box-shadow:
          var(--shadow);
        backdrop-filter:
          blur(18px);
        animation:
          floating 5s
          ease-in-out infinite;
      }

      .floating-card > div {
        width: 34px;
        height: 34px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 10px;
        color:
          var(--accent-light);
        background:
          rgba(99,102,241,.11);
      }

      .floating-card > span {
        display: grid;
        gap: 2px;
      }

      .floating-card strong {
        font-size: 8px;
      }

      .floating-card small {
        color:
          var(--text-muted);
        font-size: 6px;
      }

      .floating-one {
        top: 45px;
        left: -25px;
      }

      .floating-two {
        right: -25px;
        top: 180px;
        animation-delay: -1.7s;
      }

      .floating-three {
        left: 20px;
        bottom: 22px;
        animation-delay: -3s;
      }

      @keyframes floating {
        0%,
        100% {
          transform:
            translateY(0);
        }

        50% {
          transform:
            translateY(-9px);
        }
      }

      /* SEARCH */

      .search-section {
        position: relative;
        z-index: 5;
        padding-bottom: 40px;
      }

      .market-search {
        max-width: 760px;
        margin: 0 auto;
        display: flex;
        align-items: center;
        border:
          1px solid var(--border);
        border-radius: 18px;
        background:
          var(--surface-gradient);
        box-shadow:
          var(--shadow);
        backdrop-filter:
          blur(20px);
      }

      .search-icon {
        padding-left: 18px;
        color:
          var(--market-accent);
        font-size: 22px;
      }

      .market-search input {
        width: 100%;
        padding: 16px;
        border: 0;
        outline: 0;
        color:
          var(--text-primary);
        font-size: 10px;
        background: transparent;
      }

      .market-search input::placeholder {
        color:
          var(--text-muted);
      }

      .market-search button {
        width: 43px;
        height: 43px;
        margin-right: 7px;
        border: 0;
        border-radius: 12px;
        cursor: pointer;
        color:
          var(--text-muted);
        background:
          var(--card-gradient);
      }

      .search-meta {
        max-width: 760px;
        margin: 8px auto 0;
        display: flex;
        justify-content:
          space-between;
        color:
          var(--text-soft);
        font-size: 6px;
      }

      /* PRODUCT SECTIONS */

      .product-section {
        position: relative;
        z-index: 3;
        padding: 55px 0;
      }

      .latest-section {
        padding-top: 75px;
      }

      .section-heading {
        margin-bottom: 22px;
        display: flex;
        align-items: flex-end;
        justify-content:
          space-between;
      }

      .section-heading span {
        color:
          var(--market-accent);
        font-size: 6px;
        font-weight: 950;
        letter-spacing: 1.5px;
      }

      .section-heading h2 {
        margin: 5px 0 4px;
        font-size:
          clamp(25px,3vw,34px);
        letter-spacing: -1px;
      }

      .section-heading p {
        margin: 0;
        color:
          var(--text-muted);
        font-size: 8px;
      }

      .featured-grid,
      .product-grid {
        display: grid;
        grid-template-columns:
          repeat(4,minmax(0,1fr));
        gap: 14px;
      }

      .market-product-card {
        min-width: 0;
        overflow: hidden;
        border:
          1px solid var(--border);
        border-radius:
          var(--market-radius);
        background:
          var(--surface-gradient);
        box-shadow:
          0 18px 50px
          rgba(0,0,0,.06);
        transition:
          transform .25s ease,
          border-color .25s ease,
          box-shadow .25s ease;
      }

      .market-product-card:hover {
        transform:
          translateY(-5px);
        border-color:
          color-mix(
            in srgb,
            var(--market-primary) 30%,
            var(--border)
          );
        box-shadow:
          var(--shadow);
      }

      .product-cover {
        position: relative;
        width: 100%;
        aspect-ratio: 16 / 10;
        overflow: hidden;
        display: block;
        padding: 0;
        border: 0;
        cursor: pointer;
        color: #fff;
        text-align: left;
      }

      .product-cover img {
        width: 100%;
        height: 100%;
        display: block;
        object-fit: cover;
        transition:
          transform .4s ease;
      }

      .market-product-card:hover
      .product-cover img {
        transform: scale(1.04);
      }

      .cover-1 {
        background:
          linear-gradient(
            135deg,#2563eb,#7c3aed
          );
      }

      .cover-2 {
        background:
          linear-gradient(
            135deg,#059669,#2563eb
          );
      }

      .cover-3 {
        background:
          linear-gradient(
            135deg,#db2777,#7c3aed
          );
      }

      .cover-4 {
        background:
          linear-gradient(
            135deg,#ea580c,#db2777
          );
      }

      .cover-5 {
        background:
          linear-gradient(
            135deg,#0891b2,#4f46e5
          );
      }

      .cover-6 {
        background:
          linear-gradient(
            135deg,#4f46e5,#9333ea
          );
      }

      .cover-shape {
        position: absolute;
        border-radius: 50%;
        background:
          rgba(255,255,255,.12);
      }

      .cover-shape-one {
        width: 150px;
        height: 150px;
        right: -55px;
        top: -60px;
      }

      .cover-shape-two {
        width: 100px;
        height: 100px;
        left: -35px;
        bottom: -40px;
      }

      .cover-placeholder {
        position: absolute;
        inset: 0;
        padding: 20px;
        display: flex;
        flex-direction: column;
        justify-content:
          flex-end;
      }

      .cover-placeholder span {
        margin-bottom: auto;
        font-size: 5px;
        font-weight: 950;
        letter-spacing: 1.4px;
        opacity: .8;
      }

      .cover-placeholder strong {
        display: -webkit-box;
        overflow: hidden;
        font-size: 17px;
        line-height: 1.05;
        letter-spacing: -.5px;
        -webkit-line-clamp: 2;
        -webkit-box-orient:
          vertical;
      }

      .cover-placeholder small {
        margin-top: 5px;
        font-size: 6px;
        opacity: .75;
      }

      .featured-label {
        position: absolute;
        top: 10px;
        right: 10px;
        padding: 6px 8px;
        border:
          1px solid
          rgba(255,255,255,.15);
        border-radius: 999px;
        color: #fff;
        font-size: 5px;
        font-weight: 950;
        letter-spacing: .7px;
        background:
          rgba(3,7,18,.35);
        backdrop-filter:
          blur(12px);
      }

      .product-content {
        padding: 15px;
      }

      .product-type {
        color:
          var(--market-accent);
        font-size: 5px;
        font-weight: 950;
        letter-spacing: 1px;
        text-transform: uppercase;
      }

      .product-content h3 {
        margin: 6px 0;
        display: -webkit-box;
        overflow: hidden;
        font-size: 12px;
        line-height: 1.3;
        -webkit-line-clamp: 2;
        -webkit-box-orient:
          vertical;
      }

      .product-content > p {
        min-height: 32px;
        margin: 0;
        display: -webkit-box;
        overflow: hidden;
        color:
          var(--text-muted);
        font-size: 7px;
        line-height: 1.55;
        -webkit-line-clamp: 3;
        -webkit-box-orient:
          vertical;
      }

      .product-bottom {
        margin-top: 14px;
        padding-top: 12px;
        display: flex;
        align-items: flex-end;
        justify-content:
          space-between;
        gap: 8px;
        border-top:
          1px solid var(--border);
      }

      .product-price {
        min-width: 0;
        display: grid;
        gap: 2px;
      }

      .product-price small {
        color:
          var(--text-muted);
        font-size: 5px;
      }

      .product-price strong {
        overflow: hidden;
        font-size: 10px;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .product-open {
        padding: 8px 9px;
        display: flex;
        align-items: center;
        gap: 6px;
        border: 0;
        border-radius: 9px;
        cursor: pointer;
        color: #fff;
        font-size: 6px;
        font-weight: 900;
        white-space: nowrap;
        background:
          linear-gradient(
            135deg,
            var(--market-primary),
            var(--market-secondary)
          );
      }

      .market-error {
        margin-bottom: 15px;
        padding: 12px;
        display: flex;
        align-items: center;
        gap: 10px;
        border:
          1px solid
          rgba(245,158,11,.15);
        border-radius: 14px;
        color: #f59e0b;
        background:
          rgba(120,53,15,.08);
      }

      .market-error > span {
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 9px;
        background:
          rgba(245,158,11,.1);
      }

      .market-error strong {
        font-size: 8px;
      }

      .market-error p {
        margin: 2px 0 0;
        font-size: 7px;
      }

      .empty-products {
        min-height: 300px;
        padding: 30px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        border:
          1px solid var(--border);
        border-radius: 22px;
        text-align: center;
        background:
          var(--surface-gradient);
      }

      .empty-icon {
        width: 55px;
        height: 55px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 17px;
        color:
          var(--market-accent);
        font-size: 20px;
        background:
          var(--card-gradient);
      }

      .empty-products h3 {
        margin: 14px 0 5px;
        font-size: 15px;
      }

      .empty-products p {
        margin: 0;
        color:
          var(--text-muted);
        font-size: 8px;
      }

      .empty-products button {
        margin-top: 14px;
        padding: 10px 13px;
        border: 0;
        border-radius: 10px;
        cursor: pointer;
        color: #fff;
        font-size: 7px;
        font-weight: 850;
        background:
          linear-gradient(
            135deg,
            var(--market-primary),
            var(--market-secondary)
          );
      }

      /* ABOUT */

      .about-section {
        position: relative;
        z-index: 3;
        padding: 70px 0 90px;
      }

      .about-card {
        padding: 35px;
        display: grid;
        grid-template-columns:
          minmax(0,.85fr)
          minmax(0,1.15fr);
        gap: 45px;
        align-items: center;
        border:
          1px solid var(--border);
        border-radius: 28px;
        background:
          linear-gradient(
            135deg,
            color-mix(
              in srgb,
              var(--market-primary) 12%,
              var(--surface)
            ),
            color-mix(
              in srgb,
              var(--market-secondary) 8%,
              var(--surface)
            )
          );
        box-shadow:
          var(--shadow);
      }

      .about-copy h2 {
        margin: 14px 0 10px;
        font-size:
          clamp(27px,3vw,39px);
        line-height: 1.05;
        letter-spacing: -1.3px;
      }

      .about-copy p {
        max-width: 500px;
        margin: 0 0 20px;
        color:
          var(--text-muted);
        font-size: 9px;
        line-height: 1.7;
      }

      .benefit-grid {
        display: grid;
        grid-template-columns:
          repeat(2,minmax(0,1fr));
        gap: 10px;
      }

      .benefit {
        min-height: 145px;
        padding: 17px;
        border:
          1px solid var(--border);
        border-radius: 17px;
        background:
          var(--card-gradient);
      }

      .benefit > div {
        width: 36px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 11px;
        color:
          var(--accent-light);
        background:
          rgba(99,102,241,.1);
      }

      .benefit strong {
        margin-top: 13px;
        display: block;
        font-size: 9px;
      }

      .benefit p {
        margin: 5px 0 0;
        color:
          var(--text-muted);
        font-size: 7px;
        line-height: 1.55;
      }

      /* FOOTER */

      .market-footer {
        position: relative;
        z-index: 3;
        border-top:
          1px solid var(--border);
        background:
          var(--topbar-bg);
      }

      .footer-inner {
        min-height: 105px;
        display: flex;
        align-items: center;
        justify-content:
          space-between;
        gap: 20px;
      }

      .footer-brand {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .footer-brand img {
        max-width: 145px;
        max-height: 40px;
        object-fit: contain;
      }

      .footer-mark {
        width: 36px;
        height: 36px;
        border-radius: 11px;
        font-size: 13px;
      }

      .footer-brand > div:last-child {
        display: grid;
        gap: 2px;
      }

      .footer-brand strong {
        font-size: 10px;
      }

      .footer-brand span,
      .footer-copy {
        color:
          var(--text-muted);
        font-size: 6px;
      }

      /* CUSTOM EMPTY */

      .custom-empty {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        color:
          var(--text-primary);
        background:
          var(--page-gradient);
      }

      .custom-empty > div {
        width:
          min(400px, calc(100% - 35px));
        padding: 35px;
        border:
          1px solid var(--border);
        border-radius: 22px;
        text-align: center;
        background:
          var(--surface-gradient);
      }

      .custom-empty > div > span {
        font-size: 28px;
      }

      .custom-empty h1 {
        margin: 12px 0 5px;
      }

      .custom-empty p {
        color:
          var(--text-muted);
        font-size: 9px;
      }

      .custom-empty a {
        margin-top: 12px;
        padding: 10px 15px;
        display: inline-block;
        border-radius: 10px;
        color: #fff;
        font-size: 8px;
        font-weight: 850;
        text-decoration: none;
        background:
          var(--primary-gradient);
      }

      /* LOADING */

      .market-loading {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background:
          var(--page-gradient);
      }

      .market-loader-card {
        width:
          min(340px, calc(100% - 35px));
        padding: 28px;
        border:
          1px solid var(--border);
        border-radius: 22px;
        background:
          var(--surface-gradient);
        box-shadow:
          var(--shadow);
      }

      .loader-brand {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .loader-logo {
        width: 42px;
        height: 42px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 13px;
        color: #fff;
        font-weight: 950;
        background:
          var(--primary-gradient);
      }

      .loader-brand strong {
        font-size: 13px;
      }

      .market-loader-card p {
        margin: 14px 0 9px;
        color:
          var(--text-muted);
        font-size: 8px;
      }

      .loading-line {
        height: 4px;
        overflow: hidden;
        border-radius: 999px;
        background:
          rgba(99,102,241,.08);
      }

      .loading-line span {
        width: 40%;
        height: 100%;
        display: block;
        border-radius: inherit;
        background:
          var(--primary-gradient);
        animation:
          marketLoad 1s
          ease-in-out infinite;
      }

      @keyframes marketLoad {
        from {
          transform:
            translateX(-100%);
        }

        to {
          transform:
            translateX(250%);
        }
      }

      /* LIGHT */

      html[data-theme='light']
      .marketplace-page {
        background:
          var(--page-gradient);
      }

      html[data-theme='light']
      .visual-main-card {
        background:
          linear-gradient(
            145deg,
            rgba(219,234,254,.95),
            rgba(237,233,254,.92),
            rgba(255,255,255,.9)
          );
      }

      html[data-theme='light']
      .market-product-card,
      html[data-theme='light']
      .market-search,
      html[data-theme='light']
      .floating-card {
        background:
          var(--surface-gradient);
      }

      /* RESPONSIVE */

      @media(max-width:1050px) {
        .featured-grid,
        .product-grid {
          grid-template-columns:
            repeat(3,minmax(0,1fr));
        }

        .hero-grid {
          gap: 35px;
        }
      }

      @media(max-width:850px) {
        .marketplace-page
        .theme-switcher {
          top: auto;
          right: 13px;
          bottom: 13px;
        }

        .desktop-nav {
          display: none;
        }

        .mobile-menu-button {
          width: 38px;
          height: 38px;
          display: block;
          border:
            1px solid var(--border);
          border-radius: 11px;
          cursor: pointer;
          color:
            var(--text-primary);
          background:
            var(--surface-gradient);
        }

        .mobile-market-menu {
          padding: 9px 20px 14px;
          display: grid;
          gap: 4px;
          border-top:
            1px solid var(--border);
        }

        .mobile-market-menu button {
          padding: 11px;
          border: 0;
          border-radius: 10px;
          color:
            var(--text-secondary);
          text-align: left;
          background:
            var(--card-gradient);
        }

        .hero-grid {
          grid-template-columns:
            1fr;
        }

        .hero-copy {
          max-width: 720px;
        }

        .hero-visual {
          max-width: 600px;
          width: 100%;
          margin: 0 auto;
        }

        .featured-grid,
        .product-grid {
          grid-template-columns:
            repeat(2,minmax(0,1fr));
        }

        .about-card {
          grid-template-columns:
            1fr;
        }
      }

      @media(max-width:600px) {
        .market-container {
          width:
            min(100% - 28px,1180px);
        }

        .navbar-inner {
          min-height: 67px;
        }

        .brand-copy span {
          display: none;
        }

        .brand-mark {
          width: 37px;
          height: 37px;
          border-radius: 11px;
        }

        .brand-image {
          max-width: 120px;
          max-height: 38px;
        }

        .login-button,
        .member-button {
          display: none;
        }

        .market-hero {
          padding:
            70px 0 50px;
        }

        .hero-copy h1 {
          font-size:
            clamp(39px,13vw,58px);
          letter-spacing: -2px;
        }

        .hero-copy > p {
          font-size: 10px;
        }

        .hero-visual {
          min-height: 390px;
        }

        .visual-main-card {
          width: 82%;
          min-height: 340px;
        }

        .visual-main-card h3 {
          margin: 45px 0;
          font-size: 41px;
        }

        .floating-card {
          min-width: 150px;
        }

        .floating-one {
          left: 0;
        }

        .floating-two {
          right: 0;
        }

        .featured-grid,
        .product-grid {
          grid-template-columns:
            1fr;
        }

        .product-cover {
          aspect-ratio: 16 / 8.5;
        }

        .product-content h3 {
          font-size: 14px;
        }

        .product-content > p {
          font-size: 8px;
        }

        .benefit-grid {
          grid-template-columns:
            1fr;
        }

        .about-card {
          padding: 23px;
        }

        .footer-inner {
          padding: 25px 0;
          flex-direction: column;
          align-items: flex-start;
        }
      }

      @media(
        prefers-reduced-motion:
        reduce
      ) {
        .floating-card,
        .loading-line span {
          animation: none;
        }

        * {
          scroll-behavior: auto
          !important;
        }
      }


      /* =====================================================
         READABILITY UPGRADE — DESKTOP + MOBILE
         ===================================================== */
      .market-brand .brand-copy strong { font-size: 17px !important; line-height: 1.15 !important; }
      .market-brand .brand-copy span { font-size: 10.5px !important; line-height: 1.35 !important; letter-spacing: .16em !important; }
      .desktop-nav button { font-size: 13px !important; font-weight: 800 !important; }
      .member-button, .login-button { font-size: 13px !important; font-weight: 850 !important; min-height: 42px !important; padding: 0 18px !important; }
      .hero-badge { font-size: 10.5px !important; font-weight: 900 !important; letter-spacing: .16em !important; }
      .hero-copy > p { font-size: 15px !important; line-height: 1.8 !important; max-width: 720px !important; }
      .primary-button, .secondary-button { font-size: 13.5px !important; font-weight: 850 !important; min-height: 48px !important; padding: 0 20px !important; }
      .hero-trust { gap: 18px !important; }
      .trust-item { font-size: 12px !important; font-weight: 750 !important; }
      .trust-item > span { width: 23px !important; height: 23px !important; font-size: 12px !important; }
      .visual-top > span { font-size: 10.5px !important; }
      .visual-progress span, .visual-progress strong { font-size: 11px !important; }
      .floating-card strong { font-size: 12px !important; }
      .floating-card small { font-size: 10.5px !important; line-height: 1.4 !important; }
      .market-search input { font-size: 14px !important; }
      .search-meta { font-size: 11.5px !important; }
      .section-badge { font-size: 10.5px !important; }
      .section-heading p { font-size: 14px !important; line-height: 1.7 !important; }
      .product-card h3 { font-size: 17px !important; line-height: 1.35 !important; }
      .product-card p { font-size: 13px !important; line-height: 1.65 !important; }
      .product-type, .product-status, .product-price { font-size: 11.5px !important; }
      .product-action, .product-card button { font-size: 12.5px !important; }
      .market-footer { font-size: 12px !important; }

      @media (min-width: 1200px) {
        .market-container { width: min(1320px, calc(100% - 72px)) !important; }
        .hero-copy h1 { font-size: clamp(58px, 5vw, 82px) !important; line-height: 1.02 !important; }
      }

      @media (max-width: 760px) {
        .market-brand .brand-copy strong { font-size: 15px !important; }
        .market-brand .brand-copy span { font-size: 9.5px !important; }
        .mobile-market-menu button { font-size: 14px !important; }
        .hero-copy > p { font-size: 14px !important; }
        .trust-item { font-size: 11.5px !important; }
        .market-search input { font-size: 14px !important; }
      }



      /* =====================================================
         PROFESSIONAL LANDING PAGE TYPOGRAPHY — FINAL
         Balanced desktop scale: controlled hero + readable UI
         ===================================================== */

      /* Header */
      .market-brand .brand-copy strong {
        font-size: 18px !important;
        line-height: 1.1 !important;
      }
      .market-brand .brand-copy span {
        font-size: 11px !important;
        line-height: 1.35 !important;
        letter-spacing: .13em !important;
      }
      .desktop-nav button {
        font-size: 14px !important;
        padding: 10px 15px !important;
      }
      .login-button,
      .member-button {
        font-size: 14px !important;
        min-height: 44px !important;
        padding: 0 19px !important;
      }

      /* Hero: intentionally smaller than previous version */
      .market-hero {
        padding: 82px 0 68px !important;
      }
      .hero-grid {
        gap: 58px !important;
      }
      .hero-copy {
        max-width: 650px !important;
      }
      .hero-badge {
        padding: 8px 12px !important;
        font-size: 11px !important;
        line-height: 1.2 !important;
        letter-spacing: .12em !important;
      }
      .hero-copy h1 {
        max-width: 650px !important;
        margin: 20px 0 18px !important;
        font-size: clamp(46px, 4.25vw, 62px) !important;
        line-height: 1.02 !important;
        letter-spacing: -2.4px !important;
      }
      .hero-copy > p {
        max-width: 620px !important;
        font-size: 16px !important;
        line-height: 1.7 !important;
      }
      .primary-button,
      .secondary-button {
        min-height: 48px !important;
        padding: 0 21px !important;
        font-size: 14px !important;
      }
      .trust-item {
        font-size: 12.5px !important;
      }
      .trust-item span {
        width: 24px !important;
        height: 24px !important;
        font-size: 12px !important;
      }

      /* Hero visual */
      .visual-top span {
        font-size: 11px !important;
      }
      .visual-main-card h3 {
        font-size: 44px !important;
      }
      .visual-progress > div:first-child,
      .visual-progress strong {
        font-size: 11.5px !important;
      }
      .floating-card {
        min-width: 195px !important;
        padding: 13px !important;
      }
      .floating-card strong {
        font-size: 13px !important;
      }
      .floating-card small {
        font-size: 11px !important;
        line-height: 1.4 !important;
      }

      /* Search */
      .market-search input {
        font-size: 14px !important;
      }
      .search-meta {
        font-size: 12px !important;
      }

      /* Product sections */
      .section-heading span {
        font-size: 11px !important;
      }
      .section-heading h2 {
        font-size: clamp(28px, 2.5vw, 36px) !important;
      }
      .section-heading p {
        font-size: 14px !important;
        line-height: 1.6 !important;
      }
      .cover-placeholder span,
      .featured-label,
      .product-type {
        font-size: 10.5px !important;
      }
      .cover-placeholder strong {
        font-size: 19px !important;
      }
      .cover-placeholder small {
        font-size: 11px !important;
      }
      .product-content {
        padding: 18px !important;
      }
      .product-content h3 {
        margin: 8px 0 !important;
        font-size: 17px !important;
        line-height: 1.35 !important;
      }
      .product-content > p {
        min-height: 58px !important;
        font-size: 13px !important;
        line-height: 1.55 !important;
      }
      .product-price small {
        font-size: 11px !important;
      }
      .product-price strong {
        font-size: 15px !important;
      }
      .product-open {
        padding: 10px 12px !important;
        font-size: 12px !important;
      }

      /* About / benefits — fixes the tiny text in screenshot */
      .about-copy h2 {
        font-size: clamp(30px, 2.7vw, 40px) !important;
      }
      .about-copy p {
        font-size: 15px !important;
        line-height: 1.7 !important;
      }
      .benefit {
        min-height: 155px !important;
        padding: 20px !important;
      }
      .benefit > div {
        width: 42px !important;
        height: 42px !important;
        font-size: 16px !important;
      }
      .benefit strong {
        margin-top: 15px !important;
        font-size: 15px !important;
        line-height: 1.3 !important;
      }
      .benefit p {
        margin-top: 7px !important;
        font-size: 12.5px !important;
        line-height: 1.55 !important;
      }

      @media (min-width: 1200px) {
        .market-container {
          width: min(1240px, calc(100% - 72px)) !important;
        }
        .hero-copy h1 {
          font-size: clamp(50px, 4vw, 62px) !important;
        }
      }

      @media (max-width: 850px) {
        .market-hero {
          padding: 62px 0 48px !important;
        }
        .hero-copy h1 {
          max-width: 680px !important;
          font-size: clamp(42px, 8vw, 58px) !important;
        }
        .hero-copy > p {
          font-size: 15px !important;
        }
        .mobile-market-menu button {
          font-size: 14px !important;
        }
      }

      @media (max-width: 600px) {
        .hero-copy h1 {
          font-size: clamp(38px, 11vw, 48px) !important;
          line-height: 1.04 !important;
          letter-spacing: -1.8px !important;
        }
        .hero-copy > p {
          font-size: 14px !important;
        }
        .hero-badge {
          font-size: 10px !important;
        }
        .primary-button,
        .secondary-button {
          font-size: 13px !important;
        }
        .benefit strong {
          font-size: 15px !important;
        }
        .benefit p {
          font-size: 13px !important;
        }
      }
    `}</style>
  )
}
