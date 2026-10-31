const {configured,db,cookie,sync,signedDownload}=require('./_lib');
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');if(req.method!=='GET')return res.status(405).end();
 if(process.env.CHECKOUT_TEST_MODE!=='true'||!configured())return res.status(503).json({error:'Entrega ainda não ativada.'});
 const id=cookie(req);if(!id)return res.status(401).json({error:'Sessão de compra inválida.'});
 try{const orders=await db('orders','GET',`?id=eq.${id}&select=*`);if(!orders.length)return res.status(404).end();const order=await sync(orders[0]);if(order.status!=='approved')return res.status(403).json({error:'Pagamento ainda não confirmado.'});const url=await signedDownload();res.setHeader('Location',url);return res.status(302).end();}catch(e){console.error(e.message);return res.status(503).json({error:'Não foi possível preparar o download.'});}
};
