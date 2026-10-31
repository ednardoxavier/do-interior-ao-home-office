const crypto=require('node:crypto');
const {db,mpOrder,approved}=require('./_lib');
const {deliver}=require('./_email');
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');if(req.method!=='POST')return res.status(405).end();
 if(process.env.CHECKOUT_TEST_MODE!=='true'||!process.env.MERCADO_PAGO_WEBHOOK_SECRET||!process.env.SUPABASE_SERVICE_ROLE_KEY)return res.status(503).end();
 const id=String(req.query?.['data.id']||req.body?.data?.id||'');const xreq=String(req.headers['x-request-id']||'');const signature=String(req.headers['x-signature']||'');const ts=/ts=([^,]+)/.exec(signature)?.[1];const hash=/v1=([a-f0-9]+)/i.exec(signature)?.[1];
 if(!id||!xreq||!ts||!hash||!/^\d+$/.test(ts)||Math.abs(Date.now()-Number(ts))>300000)return res.status(401).end();
 const manifest=`id:${id.toLowerCase()};request-id:${xreq};ts:${ts};`;
 const expected=crypto.createHmac('sha256',process.env.MERCADO_PAGO_WEBHOOK_SECRET).update(manifest).digest('hex');
 if(hash.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(hash),Buffer.from(expected)))return res.status(401).end();
 try{const mp=await mpOrder(id);const orderId=String(mp.external_reference||'');if(!/^[a-f0-9-]{36}$/.test(orderId))return res.status(200).json({ignored:true});const orders=await db('orders','GET',`?id=eq.${orderId}&select=*`);if(orders.length&&approved(mp,orders[0])&&orders[0].status==='pending')await db('orders','PATCH',`?id=eq.${orderId}&status=eq.pending`,{status:'approved',paid_at:new Date().toISOString()});if(orders.length){const latest=await db('orders','GET',`?id=eq.${orderId}&select=*`);if(latest[0]?.status==='approved')await deliver(latest[0]).catch(e=>console.error('Email delivery:',e.message));}return res.status(200).json({received:true});}catch(e){console.error(e.message);return res.status(503).end();}
};
