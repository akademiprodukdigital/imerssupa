import { NextResponse } from 'next/server'
import { processNotificationOutbox } from '../../../../lib/notification-worker'
export const runtime='nodejs'
export async function POST(){
  try{return NextResponse.json({ok:true,...await processNotificationOutbox(20)})}
  catch(e:unknown){return NextResponse.json({ok:false,error:e instanceof Error?e.message:'Notification worker gagal.'},{status:500})}
}
