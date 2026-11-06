const crypto=require('node:crypto');
const {db,sync}=require('./_lib');
const ADMIN='dointerioraohomeoffice@gmail.com';
module.exports=async(req,res)=>{
res.setHeader('Cache-Control','no-store');
try{
const token=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
if(!token)return res.status(401).end();
const a=await fetch(process.env.SUPABASE_URL+'/auth/v1/user',{headers:{apikey:'sb_publishable_PR0aqNmVkU9aMwz6CITmqw_dlz4fr4d',Authorization:'Bearer '+token}});
if(!a.ok)return res.status(401).end();
const u=await a.json();
if(u.email?.toLowerCase()!==ADMIN||!u.email_confirmed_at)return res.status(403).end();
if(req.method==='GET'){const orders=await db('orders','GET','?status=eq.approved&select=id,buyer_email,amount_cents,paid_at,created_at&order=created_at.desc&limit=500');return res.json({orders});}
if(req.method==='POST'){
const id=String(req.body?.id||'');
if(!/^[a-f0-9-]{36}$/.test(id))return res.status(400).end();
const rows=await db('orders','GET','?id=eq.'+id+'&select=*');
if(!rows.length)return res.status(404).end();
const order=await sync(rows[0]);
if(order.status!=='approved')return res.status(403).end();
const exp=Date.now()+7*86400000;
const sig=crypto.createHmac('sha256',process.env.DOWNLOAD_SESSION_SECRET).update('recovery:'+id+'.'+exp).digest('hex');
return res.json({url:(process.env.PUBLIC_SITE_URL||'https://do-interior-ao-home-office.vercel.app')+'/api/recover-kit?id='+id+'&exp='+exp+'&sig='+sig});
}
return res.status(405).end();
}catch(e){console.error('Admin:',e.message);return res.status(503).json({error:'Serviço indisponível'});}
};