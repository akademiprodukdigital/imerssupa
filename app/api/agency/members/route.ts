import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!url || !anonKey || !serviceKey) {
      return NextResponse.json(
        { error: 'Konfigurasi server Supabase belum lengkap.' },
        { status: 500 }
      )
    }

    const authHeader = request.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : ''

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized.' },
        { status: 401 }
      )
    }

    // Client dengan JWT Agency.
    // Penting karena RPC Agency memakai auth.uid().
    const caller = createClient(url, anonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })

    const {
      data: authData,
      error: authError,
    } = await caller.auth.getUser(token)

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: 'Session tidak valid.' },
        { status: 401 }
      )
    }

    // Service role hanya hidup di server.
    const admin = createClient(url, serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })

    // Pastikan pemanggil benar-benar Agency aktif.
    const {
      data: agencyProfile,
      error: agencyProfileError,
    } = await admin
      .from('profiles')
      .select('role,status')
      .eq('id', authData.user.id)
      .maybeSingle()

    if (
      agencyProfileError ||
      agencyProfile?.role !== 'agency' ||
      agencyProfile?.status !== 'active'
    ) {
      return NextResponse.json(
        { error: 'Active Agency access required.' },
        { status: 403 }
      )
    }

    const body = await request.json()

    const fullName = String(body.full_name || '').trim()
    const email = String(body.email || '')
      .trim()
      .toLowerCase()

    const phone = String(body.phone || '').trim()
    const password = String(body.password || '')
    const productId = String(body.product_id || '').trim()

    if (!fullName) {
      return NextResponse.json(
        { error: 'Nama Member wajib diisi.' },
        { status: 400 }
      )
    }

    if (!email) {
      return NextResponse.json(
        { error: 'Email Member wajib diisi.' },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password minimal 8 karakter.' },
        { status: 400 }
      )
    }

    if (!productId) {
      return NextResponse.json(
        { error: 'Product Access wajib dipilih.' },
        { status: 400 }
      )
    }

    // ======================================================
    // VALIDASI PRODUCT ENTITLEMENT AGENCY
    // ======================================================

    const {
      data: entitlement,
      error: entitlementError,
    } = await admin
      .from('agency_product_entitlements')
      .select('id,slot_limit,status,expires_at')
      .eq('agency_user_id', authData.user.id)
      .eq('product_id', productId)
      .maybeSingle()

    if (entitlementError || !entitlement) {
      return NextResponse.json(
        {
          error:
            'Agency tidak mempunyai Product Access untuk produk ini.',
        },
        { status: 403 }
      )
    }

    if (entitlement.status !== 'active') {
      return NextResponse.json(
        {
          error: 'Product entitlement Agency tidak aktif.',
        },
        { status: 403 }
      )
    }

    if (
      entitlement.expires_at &&
      new Date(entitlement.expires_at).getTime() <= Date.now()
    ) {
      return NextResponse.json(
        {
          error: 'Product entitlement Agency sudah berakhir.',
        },
        { status: 403 }
      )
    }

    // ======================================================
    // CEK SLOT
    // ======================================================

    const {
      count,
      error: countError,
    } = await admin
      .from('agency_member_grants')
      .select('id', {
        count: 'exact',
        head: true,
      })
      .eq('agency_user_id', authData.user.id)
      .eq('product_id', productId)
      .eq('status', 'active')

    if (countError) {
      return NextResponse.json(
        {
          error: `Gagal memeriksa slot Agency: ${countError.message}`,
        },
        { status: 500 }
      )
    }

    if ((count ?? 0) >= entitlement.slot_limit) {
      return NextResponse.json(
        {
          error: 'Slot Agency untuk produk ini sudah habis.',
        },
        { status: 409 }
      )
    }

    // ======================================================
    // CREATE MEMBER DI SUPABASE AUTH
    // ======================================================

    const {
      data: created,
      error: createError,
    } = await admin.auth.admin.createUser({
      email,
      password,

      // Member dapat langsung login.
      email_confirm: true,

      user_metadata: {
        full_name: fullName,
        phone,
      },
    })

    if (createError || !created.user) {
      return NextResponse.json(
        {
          error:
            createError?.message ||
            'Gagal membuat akun Member.',
        },
        { status: 400 }
      )
    }

    const userId = created.user.id

    const rollbackAuth = async () => {
      await admin.auth.admin.deleteUser(userId)
    }

    // ======================================================
    // PROFILE MEMBER
    // ======================================================

    const {
      error: profileError,
    } = await admin
      .from('profiles')
      .upsert(
        {
          id: userId,
          full_name: fullName,
          phone: phone || null,
          role: 'member',
          status: 'active',
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'id',
        }
      )

    if (profileError) {
      await rollbackAuth()

      return NextResponse.json(
        {
          error:
            `Profile Member gagal dibuat: ${profileError.message}`,
        },
        { status: 500 }
      )
    }

    // ======================================================
    // HUBUNGKAN MEMBER DENGAN AGENCY
    // ======================================================

    const {
      error: attachError,
    } = await caller.rpc(
      'agency_attach_existing_member',
      {
        p_member_user_id: userId,
      }
    )

    if (attachError) {
      await rollbackAuth()

      return NextResponse.json(
        {
          error:
            `Member gagal dihubungkan ke Agency: ${attachError.message}`,
        },
        { status: 500 }
      )
    }

    // ======================================================
    // BERI PRODUCT ACCESS
    // RPC INI SEKALIGUS MEMBUAT member_access
    // ======================================================

    const {
      error: grantError,
    } = await caller.rpc(
      'agency_grant_product_access',
      {
        p_member_user_id: userId,
        p_product_id: productId,
      }
    )

    if (grantError) {
      // auth user dihapus.
      // FK cascade membersihkan profile/ownership terkait.
      await rollbackAuth()

      return NextResponse.json(
        {
          error:
            `Product Access gagal diberikan: ${grantError.message}`,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      user_id: userId,
      message:
        'Member berhasil dibuat dan Product Access aktif.',
    })
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : 'Terjadi kesalahan server.'

    return NextResponse.json(
      {
        error: message,
      },
      {
        status: 500,
      }
    )
  }
}
