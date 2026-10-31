const {configured,db,cookie,sync}=require('./_lib');
const {deliver}=require('./_email');
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');if(req.method!=='GET')return res.status(405).end();
 if(process.env.CHECKOUT_TEST_MODE!=='true'||!configured())return res.status(503).json({error:'Entrega ainda não ativada.'});
 const id=cookie(req);if(!id)return res.status(401).json({error:'Sessão da compra não encontrada. Abra o site no mesmo navegador usado na compra.'});
 try{const orders=await db('orders','GET',`?id=eq.${id}&select=*`);if(!orders.length)return res.status(404).end();const order=await sync(orders[0]);if(order.status==='approved')await deliver(order).catch(e=>console.error('Email delivery:',e.message));return res.status(200).json({status:order.status,download_ready:order.status==='approved'});}catch(e){console.error(e.message);return res.status(503).json({error:'Não foi possível consultar o pagamento. Tente novamente.'});}
};
