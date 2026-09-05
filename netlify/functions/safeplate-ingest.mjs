import {ingestSafeplate} from './lib/core-engine.mjs';
import {append} from './lib/core-store.mjs';
const json=(body,status=200)=>Response.json(body,{status,headers:{'cache-control':'no-store'}});
export default async function(req){
  if(req.method!=='POST')return json({error:'Method not allowed'},405);
  if(process.env.VERISCOPE_SAFEPLATE_ENABLED==='false')return json({error:'SAFEPLATE adapter disabled'},503);
  try{const body=await req.json();const record=body?.record||body;const result=await ingestSafeplate(record);return json({status:'CODED',mode:'SHADOW',sourceRecordId:record.id,...result},202)}
  catch(err){await append('dead_letter',{id:crypto.randomUUID?.()||String(Date.now()),source:'SAFEPLATE',error:String(err?.message||err),timestamp:new Date().toISOString()},1000);return json({error:String(err?.message||err),mode:'SHADOW'},400)}
}
export const config={path:'/api/safeplate/ingest'};
