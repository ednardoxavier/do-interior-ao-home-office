const crypto=require('node:crypto');
const {db}=require('./_lib');
const DAYS=7;
async function deliver(order){
 if(order.status!=='approved'||!process.env.RESEND_API_KEY||!process.env.EMAIL_FROM||!process.env.PUBLIC_SITE_URL)return false;
 const id=encodeURIComponent(order.id);
 const claim=await db('orders','PATCH',`?id=eq.${id}&status=eq.approved&email_delivery_status=in.(pending,failed)`,{email_delivery_status:'sending',email_delivery_claimed_at:new Date().toISOString()});
 if(!claim.length)return false;
 const token=crypto.randomBytes(32).toString('hex');
 const hash=crypto.createHash('sha256').update(token).digest('hex');
 const expires=new Date(Date.now()+DAYS*86400000).toISOString();
 const url=new URL('/api/email-download',process.env.PUBLIC_SITE_URL);
 url.searchParams.set('token',token);
 try{
  await db('orders','PATCH',`?id=eq.${id}&email_delivery_status=eq.sending`,{email_delivery_token_hash:hash,email_delivery_expires_at:expires});
  const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':order.id},body:JSON.stringify({
   from:process.env.EMAIL_FROM,to:[order.buyer_email],
   subject:'Seu kit Do Interior ao Home Office está disponível',
   text:`Pagamento confirmado! Acesse seu kit digital pelo link (válido por 7 dias): ${url.href}\n\nCaso tenha dúvidas, responda ao endereço de suporte informado no site.`,
   html:`<div style="font-family:Arial,sans-serif;background:#faf8f2;padding:32px"><div style="max-width:520px;margin:auto;background:white;border-radius:18px;padding:32px"><p style="font-size:12px;font-weight:bold;color:#1d795c">DO INTERIOR AO HOME OFFICE</p><h1 style="color:#0b1730;font-size:26px">Seu pagamento foi confirmado!</h1><p style="color:#475569">Seu kit digital está pronto. Clique abaixo para baixar os materiais.</p><a href="${url.href.replaceAll('&','&amp;')}" style="display:inline-block;background:#b5f2d4;color:#0b1730;padding:16px 22px;border-radius:12px;text-decoration:none;font-weight:bold">BAIXAR MEU KIT COMPLETO</a><p style="font-size:13px;color:#64748b;margin-top:24px">Este link é pessoal e válido por 7 dias. Não o compartilhe.</p></div></div>`
  }),signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw new Error(`Resend HTTP ${response.status}`);
  await db('orders','PATCH',`?id=eq.${id}&email_delivery_status=eq.sending`,{email_delivery_status:'sent',email_sent_at:new Date().toISOString()});
  return true;
 }catch(e){
  console.error('Delivery email:',e.message);
  await db('orders','PATCH',`?id=eq.${id}&email_delivery_status=eq.sending`,{email_delivery_status:'failed',email_delivery_token_hash:null,email_delivery_expires_at:null}).catch(()=>{});
  return false;
 }
}
module.exports={deliver};
