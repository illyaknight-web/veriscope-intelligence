import crypto from 'node:crypto';
import {ingestSafeplate,ingestSafeplateBatch} from './lib/core-engine.mjs';
import {append} from './lib/core-store.mjs';
import {fromSafeplateContract} from './lib/safeplate-contract.mjs';
import {authorize,json,rateLimit,readJSON} from './lib/security.mjs';

export default async function(req){
  if(req.method!=='POST')return json({error:'Method not allowed'},405);
  const limited=rateLimit(req,{limit:20,windowMs:60_000,scope:'safeplate-ingest'});
  if(limited)return limited;
  const auth=authorize(req,'VERISCOPE_SAFEPLATE_INGEST_TOKEN');
  if(!auth.ok)return auth.response;
  if(process.env.VERISCOPE_SAFEPLATE_ENABLED==='false')return json({error:'SAFEPLATE adapter disabled'},503);
  try{
    const body=await readJSON(req,1_500_000);
    if(Array.isArray(body.records)){
      const records=body.records.slice(0,250).map(fromSafeplateContract),results=await ingestSafeplateBatch(records);
      return json({status:'SHADOW_BATCH_ACCEPTED',mode:'SHADOW',contractVersion:body.contract_version||null,cycleId:body.cycle_id||null,accepted:results.length,duplicates:results.filter(x=>x.duplicate).length,results},202);
    }
    const record=body?.record||body;
    const normalized=record?.safeplate_record_id?fromSafeplateContract(record):record;
    const result=await ingestSafeplate(normalized);
    return json({status:'SHADOW_ACCEPTED',mode:'SHADOW',sourceRecordId:normalized.id,...result},202);
  }catch(err){
    await append('dead_letter',{id:crypto.randomUUID(),source:'SAFEPLATE',error:String(err?.message||err),timestamp:new Date().toISOString()},1000);
    return json({error:String(err?.message||err),mode:'SHADOW'},400);
  }
}

export const config={path:'/api/safeplate/ingest'};
