const {randomUUID}=require('node:crypto');
const {PRODUCT,configured,db,setCookie}=require('./_lib');
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({error:'Método não permitido.'});
 if(process.env.CHECKOUT_TEST_MODE!=='true'||!configured())return res.status(503).json({error:'Checkout bloqueado até a configuração completa do ambiente de testes.'});
 const email=String(req.body?.email||'').trim().toLowerCase();
 if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return res.status(400).json({error:'Informe um e-mail válido.'});
 try{
 const products=await db('products','GET',`?slug=eq.${PRODUCT}&active=eq.true&select=id,price_cents,currency`);
 const product=products[0];if(!product||product.price_cents!==2990||product.currency!=='BRL')throw new Error('Produto indisponível');
 const id=randomUUID();await db('orders','POST','',{id,product_id:product.id,buyer_email:email,status:'pending',amount_cents:2990,currency:'BRL',provider:'mercadopago'});
 const base=process.env.PUBLIC_SITE_URL;if(!base||!/^https:\/\//.test(base))throw new Error('PUBLIC_SITE_URL inválida');
 const payload={type:'online',processing_mode:'manual',total_amount:'29.90',external_reference:id,description:'Do Interior ao Home Office - kit digital',payer:{email},items:[{title:'Do Interior ao Home Office - kit digital',quantity:1,unit_price:'29.90'}],config:{online:{success_url:`${base}/?pagamento=retorno`,failure_url:`${base}/?pagamento=falha`,pending_url:`${base}/?pagamento=pendente`,auto_return:'all'}}};
 const r=await fetch('https://api.mercadopago.com/v1/orders',{method:'POST',headers:{Authorization:`Bearer ${process.env.MERCADO_PAGO_ACCESS_TOKEN}`,'Content-Type':'application/json','X-Idempotency-Key':id},body:JSON.stringify(payload),signal:AbortSignal.timeout(12000)});
 const mp=await r.json().catch(()=>({}));if(!r.ok||!mp.id||!mp.checkout_url)throw new Error(`Falha Mercado Pago ${r.status}`);
 const url=new URL(mp.checkout_url);if(url.protocol!=='https:'||!/(^|\.)mercadopago\.com(\.br)?$/.test(url.hostname))throw new Error('URL inválida');
 await db('orders','PATCH',`?id=eq.${id}`,{provider_preference_id:String(mp.id)});
 setCookie(res,id);return res.status(200).json({checkout_url:url.href,mode:'test'});
 }catch(e){console.error(e.message);return res.status(502).json({error:'Não foi possível iniciar o checkout de teste.'});}
};
