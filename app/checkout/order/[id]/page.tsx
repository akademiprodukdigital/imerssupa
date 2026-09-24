'use client'

import { ChangeEvent, FormEvent, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '../../../../lib/supabase'

type Method = {
  payment_method_id: string
  name: string
  code: string
  type: string
  description: string | null
  instructions: string | null
  account_name: string | null
  account_number: string | null
  qris_image_url: string | null
  provider_name: string | null
  fee_amount: number | string
  amount_due: number | string
}

type Order = {
  id: string
  order_number: string
  buyer_name: string
  currency: string
  subtotal: number | string
  discount_amount: number | string
  total_amount: number | string
  payment_fee: number | string
  grand_total: number | string
  coupon_code: string | null
  status: string
  payment_status: string
  items: any[]
}

type Tx = {
  id: string
  order_id: string
  order_number: string
  payment_method_name: string
  payment_method_type: string
  base_amount: number | string
  fee_amount: number | string
  amount_due: number | string
  status: string
  instructions: string | null
  account_name: string | null
  account_number: string | null
  qris_image_url: string | null
  proof_url: string | null
  rejection_reason: string | null
}

const money = (v: any) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number(v || 0))

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)

  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function safeExt(file: File) {
  const byMime: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'application/pdf': 'pdf',
  }

  return byMime[file.type] || 'bin'
}

export default function OrderPaymentPage() {
  const params = useParams()
  const router = useRouter()
  const id = String(params.id || '')

  const [order, setOrder] = useState<Order | null>(null)
  const [methods, setMethods] = useState<Method[]>([])
  const [selected, setSelected] = useState('')
  const [tx, setTx] = useState<Tx | null>(null)

  const [proofFile, setProofFile] = useState<File | null>(null)
  const [payer, setPayer] = useState('')
  const [account, setAccount] = useState('')
  const [note, setNote] = useState('')

  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [uploadPercent, setUploadPercent] = useState(0)
  const [error, setError] = useState('')

  function checkoutToken() {
    if (typeof window === 'undefined') return null

    return sessionStorage.getItem(`imerssupa_checkout_${id}`)
  }

  useEffect(() => {
    void load()
  }, [id])

  async function load() {
    setLoading(true)
    setError('')

    const token = checkoutToken()

    const orderResult = await supabase.rpc(
      'get_checkout_order_secure',
      {
        p_order_id: id,
        p_checkout_token: token,
      }
    )

    if (orderResult.error) {
      setError(orderResult.error.message)
      setLoading(false)
      return
    }

    const currentOrder = orderResult.data as Order
    setOrder(currentOrder)
    setPayer(currentOrder.buyer_name || '')

    const methodsResult = await supabase.rpc(
      'get_available_payment_methods_secure',
      {
        p_order_id: id,
        p_checkout_token: token,
      }
    )

    if (methodsResult.error) {
      setError(methodsResult.error.message)
    } else {
      setMethods((methodsResult.data || []) as Method[])
    }

    setLoading(false)
  }

  async function loadOrderOnly() {
    const result = await supabase.rpc(
      'get_checkout_order_secure',
      {
        p_order_id: id,
        p_checkout_token: checkoutToken(),
      }
    )

    if (!result.error) {
      setOrder(result.data as Order)
    }
  }

  async function choose(methodId: string) {
    if (busy) return

    setBusy(true)
    setError('')
    setSelected(methodId)
    setProofFile(null)

    const result = await supabase.rpc(
      'select_order_payment_method_secure',
      {
        p_order_id: id,
        p_payment_method_id: methodId,
        p_checkout_token: checkoutToken(),
      }
    )

    if (result.error) {
      setError(result.error.message)
      setBusy(false)
      return
    }

    const selectedPayment = result.data as any

    const detail = await supabase.rpc(
      'get_payment_transaction_secure',
      {
        p_payment_transaction_id:
          selectedPayment.payment_transaction_id,
        p_checkout_token: checkoutToken(),
      }
    )

    if (detail.error) {
      setError(detail.error.message)
    } else {
      setTx(detail.data as Tx)
    }

    await loadOrderOnly()
    setBusy(false)
  }

  function selectProof(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null

    if (!file) {
      setProofFile(null)
      return
    }

    const allowed = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf',
    ]

    if (!allowed.includes(file.type)) {
      setError(
        'Format bukti harus JPG, PNG, WEBP, atau PDF.'
      )
      e.target.value = ''
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Ukuran bukti maksimal 5 MB.')
      e.target.value = ''
      return
    }

    setError('')
    setProofFile(file)
  }

  async function uploadProof(file: File) {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const token = checkoutToken()

    if (!user && !token) {
      throw new Error(
        'Checkout token tidak ditemukan. Silakan ulangi checkout.'
      )
    }

    /*
      Folder authenticated = auth.uid()
      Folder guest = SHA-256(checkout token)

      Jadi raw checkout token TIDAK pernah dimasukkan
      ke nama/path file.
    */
    const ownerFolder = user
      ? user.id
      : await sha256(token as string)

    const filename =
      `${id}/${crypto.randomUUID()}.${safeExt(file)}`

    const storagePath = `${ownerFolder}/${filename}`

    setUploadPercent(35)

    const upload = await supabase.storage
      .from('payment-proofs')
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type,
      })

    if (upload.error) {
      throw new Error(
        `Upload bukti gagal: ${upload.error.message}`
      )
    }

    setUploadPercent(80)

    /*
      Bucket PRIVATE.
      Yang disimpan ke payment_transactions.proof_url
      adalah canonical storage reference, BUKAN public URL.

      Admin dapat membacanya dengan signed URL ketika
      melakukan verifikasi.
    */
    return `storage://payment-proofs/${upload.data.path}`
  }

  async function submitProof(e: FormEvent) {
    e.preventDefault()

    if (!tx) return

    if (!proofFile) {
      setError('Pilih file bukti pembayaran terlebih dahulu.')
      return
    }

    setBusy(true)
    setError('')
    setUploadPercent(10)

    let uploadedReference = ''

    try {
      uploadedReference = await uploadProof(proofFile)

      const result = await supabase.rpc(
        'submit_manual_payment_proof_secure',
        {
          p_payment_transaction_id: tx.id,
          p_proof_url: uploadedReference,
          p_checkout_token: checkoutToken(),
          p_payer_name: payer.trim() || null,
          p_payer_account: account.trim() || null,
          p_payer_note: note.trim() || null,
        }
      )

      if (result.error) {
        /*
          RPC gagal setelah file ter-upload.
          Bersihkan orphan file sebisa mungkin.
        */
        const path = uploadedReference.replace(
          'storage://payment-proofs/',
          ''
        )

        await supabase.storage
          .from('payment-proofs')
          .remove([path])

        throw new Error(result.error.message)
      }

      setUploadPercent(100)

      const detail = await supabase.rpc(
        'get_payment_transaction_secure',
        {
          p_payment_transaction_id: tx.id,
          p_checkout_token: checkoutToken(),
        }
      )

      if (detail.error) {
        setError(detail.error.message)
      } else {
        setTx(detail.data as Tx)
        setProofFile(null)
      }

      await loadOrderOnly()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Bukti pembayaran gagal dikirim.'
      )
    } finally {
      setBusy(false)
      setTimeout(() => setUploadPercent(0), 900)
    }
  }

  if (loading) {
    return (
      <div className="wrap">
        <div className="main">
          <div className="card">Memuat pembayaran...</div>
        </div>
        <Styles />
      </div>
    )
  }

  if (error && !order) {
    return (
      <div className="wrap">
        <div className="main">
          <div className="card">
            <div className="notice error">{error}</div>
            <button
              className="btn"
              onClick={() => router.push('/')}
            >
              Marketplace
            </button>
          </div>
        </div>
        <Styles />
      </div>
    )
  }

  const closed =
    order?.payment_status === 'paid' ||
    order?.status === 'completed' ||
    order?.status === 'fulfilled'

  return (
    <div className="wrap">
      <header className="top">
        <div className="brand">iMersSUPA Payment</div>

        <button
          className="back"
          onClick={() => router.push('/')}
        >
          Marketplace
        </button>
      </header>

      <main className="main">
        <div className="grid">
          <section className="card">
            <span className="badge">
              {order?.order_number}
            </span>

            <h1>Payment</h1>

            {error && (
              <div className="notice error">
                {error}
              </div>
            )}

            {closed ? (
              <div className="notice success">
                <strong>Pembayaran selesai.</strong>
                <br />
                Akses produk mengikuti proses settlement
                iMersSUPA.
              </div>
            ) : (
              <>
                <h3>Pilih Metode Pembayaran</h3>

                {methods.length === 0 && !tx && (
                  <div className="notice">
                    Belum ada metode pembayaran aktif
                    untuk order ini.
                  </div>
                )}

                {methods.map((method) => (
                  <button
                    type="button"
                    key={method.payment_method_id}
                    className={
                      `pay ${
                        selected ===
                        method.payment_method_id
                          ? 'active'
                          : ''
                      }`
                    }
                    onClick={() =>
                      choose(method.payment_method_id)
                    }
                    disabled={busy}
                  >
                    <div className="row between">
                      <strong>{method.name}</strong>
                      <span className="badge">
                        {method.type}
                      </span>
                    </div>

                    <div className="muted methodDesc">
                      {method.description ||
                        method.provider_name ||
                        method.code}
                    </div>

                    <div className="methodTotal">
                      Total: {money(method.amount_due)}
                    </div>
                  </button>
                ))}
              </>
            )}

            {tx && (
              <div className="paymentBox">
                <h3>{tx.payment_method_name}</h3>

                <div className="summary">
                  <span>Total Bayar</span>
                  <strong>{money(tx.amount_due)}</strong>
                </div>

                {tx.account_name && (
                  <div className="summary">
                    <span>Atas Nama</span>
                    <strong>{tx.account_name}</strong>
                  </div>
                )}

                {tx.account_number && (
                  <div className="summary">
                    <span>No. Rekening/Akun</span>
                    <strong>{tx.account_number}</strong>
                  </div>
                )}

                {tx.qris_image_url && (
                  <div className="qrisWrap">
                    <img
                      className="qr"
                      src={tx.qris_image_url}
                      alt="QRIS"
                    />
                  </div>
                )}

                {tx.instructions && (
                  <div className="notice">
                    {tx.instructions}
                  </div>
                )}

                {tx.status ===
                'waiting_verification' ? (
                  <div className="notice success">
                    <strong>
                      Bukti pembayaran berhasil dikirim.
                    </strong>
                    <br />
                    Sekarang menunggu verifikasi Admin.
                  </div>
                ) : tx.status === 'paid' ? (
                  <div className="notice success">
                    Pembayaran sudah terverifikasi.
                  </div>
                ) : (
                  <form onSubmit={submitProof}>
                    {tx.rejection_reason && (
                      <div className="notice error">
                        Bukti sebelumnya ditolak:
                        {' '}
                        {tx.rejection_reason}
                      </div>
                    )}

                    <div className="field">
                      <label>
                        Bukti Pembayaran
                      </label>

                      <label className="uploadBox">
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,application/pdf"
                          onChange={selectProof}
                          hidden
                        />

                        <span className="uploadIcon">
                          ↑
                        </span>

                        <strong>
                          {proofFile
                            ? proofFile.name
                            : 'Pilih Screenshot / Bukti Transfer'}
                        </strong>

                        <small>
                          JPG, PNG, WEBP atau PDF · Maks.
                          5 MB
                        </small>
                      </label>
                    </div>

                    <div className="field">
                      <label>Nama Pembayar</label>
                      <input
                        value={payer}
                        onChange={(e) =>
                          setPayer(e.target.value)
                        }
                      />
                    </div>

                    <div className="field">
                      <label>
                        Rekening/Akun Pengirim
                        (opsional)
                      </label>

                      <input
                        value={account}
                        onChange={(e) =>
                          setAccount(e.target.value)
                        }
                      />
                    </div>

                    <div className="field">
                      <label>Catatan (opsional)</label>

                      <textarea
                        rows={2}
                        value={note}
                        onChange={(e) =>
                          setNote(e.target.value)
                        }
                      />
                    </div>

                    {busy && uploadPercent > 0 && (
                      <div className="progress">
                        <div
                          style={{
                            width:
                              `${uploadPercent}%`,
                          }}
                        />
                      </div>
                    )}

                    <button
                      className="btn"
                      disabled={busy || !proofFile}
                    >
                      {busy
                        ? 'Mengirim Bukti...'
                        : 'Kirim Bukti Pembayaran'}
                    </button>
                  </form>
                )}
              </div>
            )}
          </section>

          <aside className="card orderCard">
            <h3>Ringkasan Order</h3>

            {order?.items?.map((item) => (
              <div
                className="summary"
                key={item.id}
              >
                <span>
                  {item.product_name} ×
                  {' '}
                  {item.quantity}
                </span>

                <strong>
                  {money(item.line_total)}
                </strong>
              </div>
            ))}

            <div className="summary">
              <span>Subtotal</span>
              <strong>
                {money(order?.subtotal)}
              </strong>
            </div>

            <div className="summary">
              <span>Diskon</span>
              <strong>
                - {money(order?.discount_amount)}
              </strong>
            </div>

            <div className="summary">
              <span>Fee Payment</span>
              <strong>
                {money(order?.payment_fee)}
              </strong>
            </div>

            <div className="summary total">
              <span>Grand Total</span>
              <span>
                {money(
                  order?.grand_total ||
                    order?.total_amount
                )}
              </span>
            </div>

            <div className="notice">
              Status:
              {' '}
              <strong>
                {order?.payment_status}
              </strong>
            </div>
          </aside>
        </div>
      </main>

      <Styles />
    </div>
  )
}

function Styles() {
  return (
    <style jsx global>{`
      *{box-sizing:border-box}
      body{margin:0;background:#f5f7fb;color:#17213b;font-family:Inter,Arial,sans-serif}
      button,input,textarea{font:inherit}
      .wrap{min-height:100vh;background:radial-gradient(circle at 8% 0,rgba(99,102,241,.10),transparent 28%),radial-gradient(circle at 94% 8%,rgba(14,165,233,.10),transparent 27%),linear-gradient(180deg,#f8faff 0%,#f5f7fb 55%,#fff 100%)}
      .top{max-width:1120px;margin:auto;padding:22px 20px;display:flex;justify-content:space-between;align-items:center}
      .brand{font-weight:900;font-size:18px;color:#17213b}
      .back{border:1px solid #dfe5ef;background:#fff;color:#45536d;border-radius:11px;padding:10px 14px;font-weight:800;box-shadow:0 5px 18px rgba(30,45,80,.05);cursor:pointer}
      .main{max-width:1120px;margin:auto;padding:28px 20px 75px}
      .grid{display:grid;grid-template-columns:1.35fr .85fr;gap:20px;align-items:start}
      .card{background:rgba(255,255,255,.94);border:1px solid #e3e8f1;border-radius:22px;padding:24px;box-shadow:0 18px 55px rgba(39,54,86,.08)}
      .orderCard{position:sticky;top:24px;align-self:start}
      .orderCard h3,.paymentBox h3{margin-top:0;color:#1b2740}
      .muted{color:#8993a7}
      .row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.between{justify-content:space-between}
      .badge{display:inline-flex;padding:6px 9px;border-radius:999px;background:#eef2ff;color:#5867e8;font-size:9px;font-weight:950;letter-spacing:.04em}
      .pay{width:100%;text-align:left;color:#24314a;background:#fff;border:1px solid #dfe5ef;border-radius:15px;padding:15px;margin:10px 0;cursor:pointer;transition:.18s;box-shadow:0 6px 18px rgba(39,54,86,.035)}
      .pay:hover{border-color:#bfc9ef;transform:translateY(-1px);box-shadow:0 10px 24px rgba(39,54,86,.07)}
      .pay.active{border-color:#7281ef;background:linear-gradient(135deg,#f4f6ff,#f7fbff);box-shadow:0 0 0 3px rgba(99,102,241,.08)}
      .pay:disabled{opacity:.6;cursor:wait;transform:none}
      .methodDesc{margin-top:6px}.methodTotal{margin-top:9px;font-weight:900;color:#24314a}
      .paymentBox{margin-top:18px;background:#fafbfe;border:1px solid #e3e8f1;border-radius:18px;padding:18px}
      .summary{display:flex;justify-content:space-between;gap:16px;padding:10px 0;border-bottom:1px solid #edf0f5;color:#6f7c92}.summary strong{color:#26334c}.summary.total{border:0;padding-top:16px;font-size:18px;font-weight:900;color:#17213b}.summary.total span:last-child{color:#18253e}
      .notice{padding:12px 14px;border-radius:12px;background:#eef4ff;border:1px solid #d7e2ff;color:#52617c;margin:12px 0;font-size:13px;line-height:1.55}.notice.error{background:#fff2f2;border-color:#ffd3d3;color:#bd3d48}.notice.success{background:#effbf6;border-color:#d0f0e0;color:#238761}
      .qrisWrap{text-align:center;margin:16px 0}.qr{max-width:280px;width:100%;border-radius:16px;background:#fff;padding:8px;border:1px solid #e4e8ef;box-shadow:0 12px 28px rgba(30,45,80,.08)}
      .field{display:flex;flex-direction:column;gap:7px;margin-bottom:14px}.field>label:first-child{font-size:12px;font-weight:850;color:#46536b}.field input,.field textarea{background:#fff;border:1px solid #dce2ec;color:#17213b;border-radius:11px;padding:12px 13px;outline:none;transition:.18s}.field input:focus,.field textarea:focus{border-color:#7786ef;box-shadow:0 0 0 3px rgba(99,102,241,.09)}
      .uploadBox{min-height:132px;border:1px dashed #c8d0df;border-radius:16px;background:#fafbfe;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:7px;padding:18px;cursor:pointer;color:#26334c}.uploadBox:hover{border-color:#7786ef;background:#f7f8ff}.uploadBox small{color:#929bad;font-size:12px}.uploadIcon{width:38px;height:38px;display:grid;place-items:center;border-radius:12px;background:linear-gradient(135deg,#5867e8,#168eea);color:#fff;font-size:20px;font-weight:900}
      .btn{border:0;border-radius:12px;padding:12px 16px;font-weight:900;cursor:pointer;background:linear-gradient(135deg,#5268ff,#7548ec 58%,#168eea);color:#fff;box-shadow:0 10px 25px rgba(84,99,235,.18)}.btn:disabled{opacity:.55;cursor:not-allowed}
      .progress{height:7px;background:#e9edf5;border-radius:999px;overflow:hidden;margin:12px 0}.progress>div{height:100%;background:linear-gradient(90deg,#5268ff,#168eea);transition:width .25s ease}
      .loading{max-width:1120px;margin:auto;text-align:center}
      @media(max-width:800px){.grid{grid-template-columns:1fr}.orderCard{position:static}.top{padding:17px 16px}.main{padding:20px 16px 55px}.card{padding:18px}}
    `}</style>
  )
}
