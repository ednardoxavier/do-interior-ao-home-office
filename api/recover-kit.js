const crypto=require('node:crypto');
const {db,sync,signedDownload}=require('./_lib');
module.exports=async(req,res)=>{
res.setHeader('Cache-Control','no-store');
if(req.method!=='GET')return res.status(405).end();
const id=String(req.query.id||''),exp=String(req.query.exp||''),sig=String(req.query.sig||'');
if(!/^[a-f0-9-]{36}$/.test(id)||!/^\d{13}$/.test(exp)||Number(exp)<Date.now()||Number(exp)>Date.now()+8*86400000||!/^[a-f0-9]{64}$/.test(sig))return res.status(403).send('Link inválido ou expirado.');
const expected=crypto.createHmac('sha256',process.env.DOWNLOAD_SESSION_SECRET).update('recovery:'+id+'.'+exp).digest('hex');
if(!crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected)))return res.status(403).send('Link inválido.');
try{
const rows=await db('orders','GET','?id=eq.'+id+'&select=*');
if(!rows.length)return res.status(404).end();
const order=await sync(rows[0]);
if(order.status!=='approved')return res.status(403).send('Pagamento não confirmado.');
return res.redirect(302,await signedDownload());
}catch(e){console.error('Recovery:',e.message);return res.status(503).send('Tente novamente em alguns minutos.');}
};