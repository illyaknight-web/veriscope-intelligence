import crypto from 'node:crypto';

const buckets=new Map();
const env=name=>globalThis.Netlify?.env?.get?.(name)||process.env[name]||'';
const json=(body,status=200)=>Response.json(body,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});

function equalSecret(actual,expected){
  const a=Buffer.from(String(actual||'')),b=Buffer.from(String(expected||''));
  return a.length===b.length&&a.length>0&&crypto.timingSafeEqual(a,b);
}

export function authorize(req,secretName){
  const expected=env(secretName);
  if(!expected)return {ok:false,response:json({error:'SERVICE_NOT_CONFIGURED',requiredSecret:secretName},503)};
  const header=req.headers.get('authorization')||'';
  const supplied=header.startsWith('Bearer ')?header.slice(7):'';
  return equalSecret(supplied,expected)?{ok:true}:{ok:false,response:json({error:'UNAUTHORIZED'},401)};
}

export function rateLimit(req,{limit=30,windowMs=60_000,scope='api'}={}){
  const ip=(req.headers.get('x-nf-client-connection-ip')||req.headers.get('x-forwarded-for')||'unknown').split(',')[0].trim();
  const key=`${scope}:${ip}`,now=Date.now(),prior=buckets.get(key);
  const bucket=!prior||now-prior.startedAt>=windowMs?{startedAt:now,count:0}:prior;
  bucket.count+=1;buckets.set(key,bucket);
  if(bucket.count<=limit)return null;
  return json({error:'RATE_LIMITED',retryAfterSeconds:Math.max(1,Math.ceil((windowMs-(now-bucket.startedAt))/1000))},429);
}

export async function readJSON(req,maxBytes=128_000){
  const type=(req.headers.get('content-type')||'').toLowerCase();
  if(!type.includes('application/json'))throw new Error('CONTENT_TYPE_JSON_REQUIRED');
  const declared=Number(req.headers.get('content-length')||0);
  if(declared>maxBytes)throw new Error('PAYLOAD_TOO_LARGE');
  const text=await req.text();
  if(Buffer.byteLength(text,'utf8')>maxBytes)throw new Error('PAYLOAD_TOO_LARGE');
  const value=JSON.parse(text);
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('JSON_OBJECT_REQUIRED');
  return value;
}

export {env,json};
