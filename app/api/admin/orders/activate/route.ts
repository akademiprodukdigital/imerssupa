import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ensureMemberAccount } from '../../../_ensure-member'

export const runtime = 'nodejs'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(request: NextRequest) {
  try {
    const url=process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY
    if(!url||!anonKey||!serviceKey) return NextResponse.json({error:'Konfigurasi server Supabase belum lengkap.'},{status:500})

    const authHeader=request.headers.get('authorization')||''
    const token=authHeader.startsWith('Bearer ')?authHeader.slice(7):''
    if(!token) return NextResponse.json({error:'Unauthorized.'},{status:401})

    const caller=createClient(url,anonKey,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false}})
    const {data:{user},error:authError}=await caller.auth.getUser(token)
    if(authError||!user) return NextResponse.json({error:'Session admin tidak valid.'},{status:401})

    const {data:profile,error:profileError}=await caller.from('profiles').select('role,status').eq('id',user.id).maybeSingle()
    if(profileError||!profile||profile.status!=='active'||!['super_admin','admin'].includes(profile.role||'')) return NextResponse.json({error:'Admin access required.'},{status:403})

    const body=await request.json() as {order_id?:unknown;order_number?:unknown}
    const rawId=String(body.order_id||'').trim()
    const orderNumber=String(body.order_number||'').trim()
    if(!rawId&&!orderNumber) return NextResponse.json({error:'Order ID / nomor order wajib diisi.'},{status:400})

    const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}})
    const fields='id,order_number,buyer_user_id,buyer_name,buyer_email,buyer_phone,status,payment_status'
    let order:any=null
    let orderError:any=null

    if(rawId && UUID_RE.test(rawId)){
      const result=await caller.from('orders').select(fields).eq('id',rawId).maybeSingle()
      order=result.data; orderError=result.error
    }
    if(!order && orderNumber){
      const result=await caller.from('orders').select(fields).eq('order_number',orderNumber).maybeSingle()
      order=result.data; orderError=result.error
    }
    if(!order && rawId && !UUID_RE.test(rawId)){
      const result=await caller.from('orders').select(fields).eq('order_number',rawId).maybeSingle()
      order=result.data; orderError=result.error
    }
    if(orderError) throw orderError
    if(!order) return NextResponse.json({error:`Order ${orderNumber||rawId} tidak ditemukan di database.`},{status:404})

    const canonicalOrderId=String(order.id)
    let buyerUserId=order.buyer_user_id ? String(order.buyer_user_id) : ''
    if(!buyerUserId){
      const email=String(order.buyer_email||'').trim().toLowerCase()
      if(!email) return NextResponse.json({error:'Email pembeli kosong; member tidak dapat dibuat.'},{status:400})
      const member=await ensureMemberAccount(admin,{email,fullName:String(order.buyer_name||'Member'),phone:order.buyer_phone?String(order.buyer_phone):null})
      buyerUserId=member.userId
      const {error:bindError}=await caller.rpc('admin_bind_order_buyer',{p_order_id:canonicalOrderId,p_user_id:buyerUserId})
      if(bindError) throw bindError
    }

    const {data,error}=await caller.rpc('admin_activate_order_simple',{p_order_id:canonicalOrderId})
    if(error) throw error
    return NextResponse.json({ok:true,detail:data,buyer_user_id:buyerUserId,order_id:canonicalOrderId})
  } catch(e:unknown){
    const err = e as { message?: unknown; code?: unknown; details?: unknown; hint?: unknown }
    const message = typeof err?.message === 'string' && err.message.trim()
      ? err.message
      : typeof e === 'string' && e.trim()
        ? e
        : 'Gagal mengaktifkan order.'
    return NextResponse.json({
      error: message,
      code: typeof err?.code === 'string' ? err.code : null,
      details: typeof err?.details === 'string' ? err.details : null,
      hint: typeof err?.hint === 'string' ? err.hint : null,
    },{status:400})
  }
}
