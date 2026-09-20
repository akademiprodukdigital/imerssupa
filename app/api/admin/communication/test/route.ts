import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

function cleanWa(value: string) {
  let n = String(value || '').replace(/\D/g, '')
  if (n.startsWith('0')) n = '62' + n.slice(1)
  return n
}

export async function POST(req: NextRequest) {
  try {
    const bearer = req.headers.get('authorization') || ''
    const token = bearer.startsWith('Bearer ') ? bearer.slice(7) : ''
    if (!token) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

    const authClient = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } })
    const { data: userData, error: userError } = await authClient.auth.getUser(token)
    if (userError || !userData.user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

    const service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: profile } = await service.from('profiles').select('role,status').eq('id', userData.user.id).maybeSingle()
    if (!profile || !['admin','super_admin'].includes(profile.role) || profile.status !== 'active') {
      return NextResponse.json({ ok: false, error: 'Admin access required' }, { status: 403 })
    }

    const body = await req.json()
    const providerCode = String(body?.provider_code || '').toLowerCase().trim()
    const channel = String(body?.channel || '').toLowerCase().trim()
    const target = String(body?.target || '').trim()
    if (!providerCode || !target || !['whatsapp','email'].includes(channel)) {
      return NextResponse.json({ ok: false, error: 'Data tes tidak lengkap.' }, { status: 400 })
    }

    // Resolve the exact requested provider server-side, including its secret.
    const { data: rows, error: rowsError } = await service
      .from('communication_providers')
      .select('channel,provider_code,provider_name,active,public_config,secret_config,sender_name,sender_address')
      .eq('channel', channel)
      .eq('provider_code', providerCode)
      .limit(1)

    if (rowsError) throw rowsError
    const p: any = rows?.[0]
    if (!p) return NextResponse.json({ ok: false, error: 'Provider belum tersimpan. Klik Simpan provider terlebih dahulu.' }, { status: 400 })
    if (!p.active) return NextResponse.json({ ok: false, error: 'Provider belum diaktifkan.' }, { status: 400 })

    const cfg = p.public_config || {}
    const secret = p.secret_config || {}

    if (channel === 'whatsapp') {
      const to = cleanWa(target)
      if (!to) return NextResponse.json({ ok: false, error: 'Nomor WhatsApp tidak valid.' }, { status: 400 })
      const tokenValue = String(secret.api_token || '').trim()
      if (!tokenValue) return NextResponse.json({ ok: false, error: 'API Token belum tersimpan.' }, { status: 400 })
      const message = 'Test WhatsApp iMersSUPA berhasil. Konfigurasi WhatsApp Gateway Anda sudah terhubung.'

      let response: Response
      if (providerCode === 'fonnte') {
        const endpoint = String(cfg.api_url || 'https://api.fonnte.com/send')
        const form = new URLSearchParams({ target: to, message })
        response = await fetch(endpoint, {
          method: 'POST',
          headers: { Authorization: tokenValue, 'Content-Type': 'application/x-www-form-urlencoded' },
          body: form.toString(),
        })
      } else if (providerCode === 'starsender') {
        const endpoint = String(cfg.api_url || 'https://api.starsender.online/api/send')
        response = await fetch(endpoint, {
          method: 'POST',
          headers: { Authorization: tokenValue, 'Content-Type': 'application/json' },
          body: JSON.stringify({ messageType: 'text', to, body: message }),
        })
      } else {
        return NextResponse.json({ ok: false, error: 'Provider WhatsApp belum didukung untuk tes.' }, { status: 400 })
      }

      const raw = await response.text()
      if (!response.ok) return NextResponse.json({ ok: false, error: `Gateway HTTP ${response.status}: ${raw.slice(0, 500)}` }, { status: 502 })
      return NextResponse.json({ ok: true, provider: providerCode })
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target)) {
      return NextResponse.json({ ok: false, error: 'Email tujuan tidak valid.' }, { status: 400 })
    }

    const subject = 'Test Email iMersSUPA'
    const html = '<h2>Test Email iMersSUPA</h2><p>Jika email ini diterima, konfigurasi Email Provider Anda sudah berjalan dengan baik.</p>'

    if (providerCode === 'mailketing') {
      const endpoint = String(cfg.api_url || 'https://api.mailketing.co.id/api/v1/send')
      const apiToken = String(secret.api_token || '').trim()
      if (!apiToken) return NextResponse.json({ ok: false, error: 'API Token Mailketing belum tersimpan.' }, { status: 400 })
      const form = new URLSearchParams({
        from_name: String(p.sender_name || 'iMersSUPA'),
        from_email: String(p.sender_address || ''),
        recipient: target,
        subject,
        content: html,
        api_token: apiToken,
      })
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
      })
      const raw = await response.text()
      if (!response.ok) return NextResponse.json({ ok: false, error: `Mailketing HTTP ${response.status}: ${raw.slice(0, 500)}` }, { status: 502 })
      return NextResponse.json({ ok: true, provider: providerCode })
    }

    if (providerCode === 'smtp') {
      const password = String(secret.password || '')
      if (!cfg.host || !cfg.username || !password) {
        return NextResponse.json({ ok: false, error: 'SMTP Host, Username, atau Password belum lengkap.' }, { status: 400 })
      }
      const secureMode = String(cfg.secure || 'tls')
      const transporter = nodemailer.createTransport({
        host: String(cfg.host),
        port: Number(cfg.port || 587),
        secure: secureMode === 'ssl',
        auth: { user: String(cfg.username), pass: password },
        ...(secureMode === 'tls' ? { requireTLS: true } : {}),
      })
      await transporter.verify()
      await transporter.sendMail({
        from: { name: String(p.sender_name || 'iMersSUPA'), address: String(p.sender_address || cfg.username) },
        to: target,
        subject,
        html,
      })
      return NextResponse.json({ ok: true, provider: providerCode })
    }

    return NextResponse.json({ ok: false, error: 'Provider email belum didukung untuk tes.' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Tes kirim gagal.' }, { status: 500 })
  }
}
