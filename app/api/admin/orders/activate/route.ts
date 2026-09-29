import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ensureMemberAccount } from '../../../_ensure-member'

export const runtime = 'nodejs'

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
    if(profileError||!profile||profile.status!=='active'||!['super_admin','admin'].includes(profile.role||'')) {
      return NextResponse.json({error:'Admin access required.'},{status:403})
    }

    const body=await request.json()
    const orderId=String(body.order_id||'')
    if(!orderId) return NextResponse.json({error:'Order ID wajib diisi.'},{status:400})

    const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}})
    const {data:order,error:orderError}=await admin.from('orders')
      .select('id,buyer_user_id,buyer_name,buyer_email,buyer_phone,status,payment_status')
      .eq('id',orderId).maybeSingle()
    if(orderError||!order) return NextResponse.json({error:'Order tidak ditemukan.'},{status:404})

    let buyerUserId=order.buyer_user_id
    if(!buyerUserId){
      const member=await ensureMemberAccount(admin,{
        email:String(order.buyer_email||''),
        fullName:String(order.buyer_name||'Member'),
        phone:order.buyer_phone ? String(order.buyer_phone) : null,
      })
      buyerUserId=member.userId
      const {error:bindError}=await admin.from('orders').update({buyer_user_id:buyerUserId}).eq('id',orderId)
      if(bindError) throw bindError
    }

    const {data,error}=await caller.rpc('admin_activate_order_simple',{p_order_id:orderId})
    if(error) throw error
    return NextResponse.json({ok:true,detail:data,buyer_user_id:buyerUserId})
  } catch(e:unknown){
    return NextResponse.json({error:e instanceof Error?e.message:'Gagal mengaktifkan order.'},{status:400})
  }
}
