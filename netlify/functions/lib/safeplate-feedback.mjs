import crypto from 'node:crypto';
import {getJSON,setJSON} from './core-store.mjs';
import {buildSafeplateFeedbackPayload} from './safeplate-feedback-contract.mjs';

const now=()=>new Date().toISOString();
const env=name=>typeof Netlify!=='undefined'?(Netlify.env.get(name)||''):'';
const clean=(value,max=2000)=>String(value??'').replace(/[\u0000-\u001f<>]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
const digest=value=>crypto.createHash('sha256').update(String(value)).digest('hex');

async function postWithRetry(url,token,payload,idempotencyKey){
  let error='SAFEPLATE feedback failed';
  for(let attempt=1;attempt<=3;attempt++){
    try{
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
      const response=await fetch(url,{method:'POST',signal:controller.signal,headers:{authorization:`Bearer ${token}`,'content-type':'application/json','idempotency-key':idempotencyKey,'user-agent':'VERISCOPE-SAFEPLATE-Feedback/1.0'},body:JSON.stringify(payload)}).finally(()=>clearTimeout(timer));
      if(response.ok)return {ok:true,status:response.status,attempt};
      error=`SAFEPLATE feedback HTTP ${response.status}`;
      if(response.status<500&&response.status!==429)break;
    }catch(err){error=err?.name==='AbortError'?'SAFEPLATE feedback timed out':clean(err?.message,300)}
    if(attempt<3)await new Promise(resolve=>setTimeout(resolve,attempt*500));
  }
  return {ok:false,error};
}

export async function deliverApprovedFinding(finding){
  const payload=buildSafeplateFeedbackPayload(finding),url=env('SAFEPLATE_FINDINGS_URL'),token=env('VERISCOPE_SAFEPLATE_FINDINGS_TOKEN'),checkedAt=now();
  const deliveries=await getJSON('safeplate_feedback_deliveries',{}),prior=deliveries[payload.finding_id];
  if(prior?.status==='DELIVERED'&&prior?.approvedAt===payload.approved_at)return {...prior,duplicate:true};
  if(!url||!token){const status={status:'AWAITING_CONFIGURATION',findingId:payload.finding_id,checkedAt};await setJSON('safeplate_feedback_latest',status);return status}
  let endpoint;try{endpoint=new URL(url);if(endpoint.protocol!=='https:')throw new Error('HTTPS required')}catch{const status={status:'CONFIGURATION_ERROR',findingId:payload.finding_id,checkedAt,error:'SAFEPLATE_FINDINGS_URL must be HTTPS'};await setJSON('safeplate_feedback_latest',status);return status}
  const idempotencyKey=digest(`${payload.finding_id}|${payload.approved_at}`),sent=await postWithRetry(endpoint.toString(),token,payload,idempotencyKey);
  const status=sent.ok?{status:'DELIVERED',findingId:payload.finding_id,safeplateRecordId:payload.safeplate_record_id,approvedAt:payload.approved_at,deliveredAt:now(),httpStatus:sent.status,attempts:sent.attempt,idempotencyKey}:{status:'DELIVERY_FAILED',findingId:payload.finding_id,safeplateRecordId:payload.safeplate_record_id,approvedAt:payload.approved_at,checkedAt,error:sent.error,idempotencyKey};
  deliveries[payload.finding_id]=status;await setJSON('safeplate_feedback_deliveries',deliveries);await setJSON('safeplate_feedback_latest',status);return status;
}

export {buildSafeplateFeedbackPayload};
