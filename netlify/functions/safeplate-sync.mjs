import {ingestSafeplate,audit} from './lib/core-engine.mjs';
import {append,getJSON,setJSON} from './lib/core-store.mjs';
const SOURCE=process.env.SAFEPLATE_RECALL_URL||'https://safeplate-intelligence.netlify.app/api/recall-service?limit=25';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function fetchWithTimeout(url,ms=8000){const c=new AbortController();const t=setTimeout(()=>c.abort(),ms);try{return await fetch(url,{signal:c.signal,headers:{accept:'application/json'}})}finally{clearTimeout(t)}}
export default async()=>{
  if(process.env.VERISCOPE_SAFEPLATE_ENABLED==='false')return;
  const state=await getJSON('safeplate_circuit',{failures:0,openUntil:null});
  if(state.openUntil&&Date.now()<new Date(state.openUntil).getTime())return;
  try{
    let res;for(let i=0;i<3;i++){try{res=await fetchWithTimeout(SOURCE);if(res.ok)break}catch{}if(i<2)await sleep(500*(i+1));}
    if(!res?.ok)throw new Error(`SAFEPLATE_FETCH_${res?.status||'FAILED'}`);
    const payload=await res.json();const records=Array.isArray(payload.records)?payload.records:[];let processed=0,failed=0;
    for(const record of records){try{await ingestSafeplate(record);processed++;}catch(err){failed++;await append('dead_letter',{source:'SAFEPLATE_SYNC',sourceRecordId:record?.id||null,error:String(err?.message||err),timestamp:new Date().toISOString()},1000)}}
    await setJSON('safeplate_circuit',{failures:0,openUntil:null,lastSuccess:new Date().toISOString(),lastCount:processed});
    await audit('SAFEPLATE_SYNC_COMPLETE',{processed,failed,source:SOURCE,mode:'SHADOW'});
  }catch(err){const failures=(state.failures||0)+1;const openUntil=failures>=3?new Date(Date.now()+15*60_000).toISOString():null;await setJSON('safeplate_circuit',{failures,openUntil,lastFailure:new Date().toISOString(),error:String(err?.message||err)});await append('dead_letter',{source:'SAFEPLATE_SYNC',error:String(err?.message||err),timestamp:new Date().toISOString()},1000);}
};
export const config={schedule:'*/15 * * * *'};
