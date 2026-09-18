import crypto from 'node:crypto';
import {listEvents} from './lib/core-store.mjs';

const digest=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');

export default async function(){
  try{
    const events=await listEvents('audit-events',{limit:250}),invalid=[],ids=new Set();
    for(const event of events){
      const stored=event.item,{hash,...unsigned}=stored;
      if(!hash||digest(unsigned)!==hash)invalid.push({key:event.key,reason:'HASH_MISMATCH'});
      if(ids.has(stored.id))invalid.push({key:event.key,reason:'DUPLICATE_EVENT_ID'});
      ids.add(stored.id);
    }
    return Response.json({
      status:!events.length?'EMPTY':invalid.length?'FAILED':'VERIFIED',
      classification:'APPLICATION_APPEND_ONLY',
      immutable:false,
      externallyAnchored:false,
      verifiedEvents:events.length-invalid.length,
      invalidEvents:invalid.length,
      checkedWindow:events.length,
      limitations:'Events use unique object keys and self-hashes. Storage administrators can still alter or delete objects; external immutable anchoring is not implemented.',
      checkedAt:new Date().toISOString()
    },{headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
  }catch(error){
    return Response.json({status:'UNVERIFIED',classification:'APPLICATION_APPEND_ONLY',immutable:false,error:String(error?.message||error),checkedAt:new Date().toISOString()},{status:503,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
  }
}

export const config={path:'/api/audit-integrity'};
