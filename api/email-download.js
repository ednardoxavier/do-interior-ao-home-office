const crypto=require('node:crypto');
const {enabled,configured,db,signedDownload}=require('./_lib');
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 res.setHeader('Referrer-Policy','no-referrer');
 if(req.method!=='GET')return res.status(405).end();
 if(!enabled()||!configured())return res.status(503).end();
 const token=String(req.query?.token||'');
 if(!/^[a-f0-9]{64}$/.test(token))return res.status(400).json({error:'Link inválido.'});
 try{
  const hash=crypto.createHash('sha256').update(token).digest('hex');
  const rows=await db('orders','GET',`?email_delivery_token_hash=eq.${hash}&status=eq.approved&email_delivery_expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=id`);
  if(!rows.length)return res.status(403).json({error:'Link expirado ou inválido. Solicite um novo link ao suporte.'});
  const url=await signedDownload();
  res.setHeader('Location',url);return res.status(302).end();
 }catch(e){console.error('Email download:',e.message);return res.status(503).json({error:'Não foi possível preparar o download.'});}
};