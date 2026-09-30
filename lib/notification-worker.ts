import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'

function cleanWa(value:string){let n=String(value||'').replace(/\D/g,'');if(n.startsWith('0'))n='62'+n.slice(1);return n}

async function provider(service:any, channel:'whatsapp'|'email'){
  const {data,error}=await service.rpc('get_default_communication_provider',{p_channel:channel})
  if(error) throw new Error(`Provider ${channel}: ${error.message}`)
  if(!data) throw new Error(`Belum ada provider aktif/default untuk ${channel}.`)
  return data as any
}

async function sendRow(service:any,row:any){
  const channel=String(row.channel||'') as 'whatsapp'|'email'
  const p=await provider(service,channel)
  const code=String(p.provider_code||'').toLowerCase()
  const cfg=p.public_config||{}; const secret=p.secret_config||{}
  if(channel==='whatsapp'){
    const to=cleanWa(row.recipient); if(!to) throw new Error('Nomor WhatsApp tidak valid.')
    const token=String(secret.api_token||'').trim(); if(!token) throw new Error('API Token WhatsApp belum tersimpan.')
    let response:Response
    if(code==='fonnte'){
      const form=new URLSearchParams({target:to,message:String(row.body||'')})
      response=await fetch(String(cfg.api_url||'https://api.fonnte.com/send'),{method:'POST',headers:{Authorization:token,'Content-Type':'application/x-www-form-urlencoded'},body:form.toString()})
    }else if(code==='starsender'){
      response=await fetch('https://api.starsender.online/api/send',{method:'POST',headers:{Authorization:token,'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({messageType:'text',to,body:String(row.body||'')}),cache:'no-store'})
    }else throw new Error(`Provider WhatsApp ${code||'-'} belum didukung.`)
    const raw=await response.text(); if(!response.ok) throw new Error(`Gateway HTTP ${response.status}: ${raw.slice(0,500)}`)
    let messageId:string|null=null; try{const j=JSON.parse(raw);messageId=String(j?.id||j?.message_id||j?.data?.id||'')||null}catch{}
    return {provider:code,messageId}
  }
  const to=String(row.recipient||'').trim(); if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) throw new Error('Email tujuan tidak valid.')
  const subject=String(row.subject||'Notifikasi iMersSUPA'); const html=String(row.body||'').replace(/\n/g,'<br>')
  if(code==='mailketing'){
    const apiToken=String(secret.api_token||'').trim(); if(!apiToken) throw new Error('API Token Mailketing belum tersimpan.')
    const form=new URLSearchParams({from_name:String(p.sender_name||'iMersSUPA'),from_email:String(p.sender_address||''),recipient:to,subject,content:html,api_token:apiToken})
    const response=await fetch(String(cfg.api_url||'https://api.mailketing.co.id/api/v1/send'),{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:form.toString()})
    const raw=await response.text(); if(!response.ok) throw new Error(`Mailketing HTTP ${response.status}: ${raw.slice(0,500)}`)
    return {provider:code,messageId:null}
  }
  if(code==='smtp'){
    const password=String(secret.password||''); if(!cfg.host||!cfg.username||!password) throw new Error('SMTP Host, Username, atau Password belum lengkap.')
    const secureMode=String(cfg.secure||'tls')
    const transporter=nodemailer.createTransport({host:String(cfg.host),port:Number(cfg.port||587),secure:secureMode==='ssl',auth:{user:String(cfg.username),pass:password},...(secureMode==='tls'?{requireTLS:true}:{})})
    const info=await transporter.sendMail({from:{name:String(p.sender_name||'iMersSUPA'),address:String(p.sender_address||cfg.username)},to,subject,html})
    return {provider:code,messageId:String(info.messageId||'')||null}
  }
  throw new Error(`Provider email ${code||'-'} belum didukung.`)
}

export async function processNotificationOutbox(limit=20){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL; const key=process.env.SUPABASE_SERVICE_ROLE_KEY
  if(!url||!key) throw new Error('Konfigurasi server Supabase belum lengkap.')
  const service=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})
  const workerId=`next-${Date.now()}`
  await service.rpc('recover_notification_outbox_locks',{p_older_than_minutes:15})
  const {data,error}=await service.rpc('claim_notification_outbox',{p_worker_id:workerId,p_limit:Math.min(Math.max(limit,1),50)})
  if(error) throw error
  const rows=(data||[]) as any[]; let sent=0,failed=0
  for(const row of rows){
    try{
      const result=await sendRow(service,row)
      const {error:done}=await service.rpc('complete_notification_outbox',{p_outbox_id:row.id,p_success:true,p_provider_name:result.provider,p_provider_message_id:result.messageId,p_error:null,p_retry_after_seconds:300})
      if(done) throw done; sent++
    }catch(e:any){
      failed++
      await service.rpc('complete_notification_outbox',{p_outbox_id:row.id,p_success:false,p_provider_name:null,p_provider_message_id:null,p_error:String(e?.message||e||'Unknown provider error').slice(0,1800),p_retry_after_seconds:300})
    }
  }
  return {claimed:rows.length,sent,failed}
}
