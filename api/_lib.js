const crypto = require('node:crypto');
const PRODUCT = 'do-interior-ao-home-office';
const FILE = 'Kit_Completo_Do_Interior_ao_Home_Office.zip';
function configured(){return ['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','MERCADO_PAGO_ACCESS_TOKEN','DOWNLOAD_SESSION_SECRET'].every(k=>!!process.env[k]);}
async function db(table, method='GET', query='', body){
 const r=await fetch(`${process.env.SUPABASE_URL}/rest/v1/${table}${query}`,{method,headers:{apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,'Content-Type':'application/json',Prefer:'return=representation'},body:body?JSON.stringify(body):undefined});
 if(!r.ok)throw new Error(`Supabase ${table}: ${r.status}`);return r.json();
}
function sign(value){return crypto.createHmac('sha256',process.env.DOWNLOAD_SESSION_SECRET).update(value).digest('hex');}
function cookie(req){const raw=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('purchase_session='));if(!raw)return null;const v=decodeURIComponent(raw.split('=').slice(1).join('='));const [id,expires,signature]=v.split('.');if(!/^[a-f0-9-]{36}$/.test(id||'')||!/^\d+$/.test(expires||'')||Number(expires)<Date.now())return null;const expected=sign(`${id}.${expires}`);if(!signature||signature.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(signature),Buffer.from(expected)))return null;return id;}
function setCookie(res,id){const exp=Date.now()+7*86400000;res.setHeader('Set-Cookie',`purchase_session=${id}.${exp}.${sign(`${id}.${exp}`)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`);}
async function mpOrder(id){const r=await fetch(`https://api.mercadopago.com/v1/orders/${encodeURIComponent(id)}`,{headers:{Authorization:`Bearer ${process.env.MERCADO_PAGO_ACCESS_TOKEN}`},signal:AbortSignal.timeout(10000)});if(!r.ok)throw new Error(`Mercado Pago ${r.status}`);return r.json();}
function approved(mp,order){const amount=Number(mp.total_amount);return mp.status==='processed'&&mp.status_detail==='accredited'&&mp.external_reference===order.id&&amount===29.9&&(!mp.currency||mp.currency==='BRL')&&String(mp.id)===String(order.provider_preference_id);}
async function sync(order){if(order.status==='approved')return order;if(!order.provider_preference_id)return order;const mp=await mpOrder(order.provider_preference_id);if(!approved(mp,order))return order;const rows=await db('orders','PATCH',`?id=eq.${encodeURIComponent(order.id)}&status=eq.pending`,{status:'approved',paid_at:new Date().toISOString()});return rows[0]||{...order,status:'approved'};}
async function signedDownload(){const r=await fetch(`${process.env.SUPABASE_URL}/storage/v1/object/sign/materiais-exclusivos/${encodeURIComponent(FILE)}`,{method:'POST',headers:{apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({expiresIn:60})});if(!r.ok)throw new Error(`Storage ${r.status}`);const data=await r.json();
 const signed=String(data.signedURL||'');
 // Supabase returns /object/sign/...; it is relative to /storage/v1,
 // not the root of the project domain.
 if(!signed.startsWith('/object/sign/materiais-exclusivos/')||!signed.includes('token='))throw new Error('Storage returned invalid signed URL');
 return new URL('/storage/v1'+signed,process.env.SUPABASE_URL).href;}
module.exports={PRODUCT,configured,db,cookie,setCookie,sync,mpOrder,approved,signedDownload};
