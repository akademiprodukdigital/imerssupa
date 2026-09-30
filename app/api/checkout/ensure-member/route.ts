import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ensureMemberAccount } from '../../_ensure-member'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !serviceKey) return NextResponse.json({error:'Konfigurasi server Supabase belum lengkap.'},{status:500})

    const body = await request.json()
    const productId = String(body.product_id || '')
    const email = String(body.email || '').trim().toLowerCase()
    const fullName = String(body.full_name || '').trim()
    const phone = String(body.phone || '').trim()

    if (!productId || !email || !fullName) {
      return NextResponse.json({error:'Produk, nama, dan email wajib diisi.'},{status:400})
    }

    const admin = createClient(url, serviceKey, {auth:{persistSession:false,autoRefreshToken:false}})
    const {data:product,error:productError} = await admin.from('products').select('id,status').eq('id',productId).maybeSingle()
    if (productError || !product || product.status !== 'published') {
      return NextResponse.json({error:'Produk checkout tidak valid atau belum published.'},{status:400})
    }

    const member = await ensureMemberAccount(admin,{email,fullName,phone})
    if (member.invited || member.createdProfile) {
      const queued = await admin.rpc('queue_account_notification',{
        p_user_id:member.userId,
        p_event_key:'member.registered',
        p_context:{name:fullName,email,phone},
        p_action_url:'/login',
      })
      if (queued.error) console.error('member.registered notification:', queued.error.message)
    }
    return NextResponse.json({ok:true,user_id:member.userId,invited:member.invited,created_profile:member.createdProfile})
  } catch (e:unknown) {
    return NextResponse.json({error:e instanceof Error?e.message:'Gagal menyiapkan akun member.'},{status:400})
  }
}
