import { getStore } from '@netlify/blobs';

const DOMAINS=['earth','weather','safeplate','aviation','cyber','maritime','land','trade','corporate','northline'];

export default async function(_req,context){
  const base=context?.site?.url;
  if(!base)throw new Error('SITE_URL_UNAVAILABLE');
  const startedAt=new Date().toISOString();
  const results=await Promise.allSettled(DOMAINS.map(domain=>fetch(`${base}/api/public-intelligence?domain=${domain}&surveillance=1&t=${Date.now()}`,{headers:{accept:'application/json','user-agent':'VERISCOPE-SURVEILLANCE/1.5','cache-control':'no-cache'},signal:AbortSignal.timeout(20000)}).then(async response=>{
    if(!response.ok)throw new Error(`${domain}:${response.status}`);
    const payload=await response.json();
    return {domain,status:payload.status,records:payload.counts?.records??payload.records?.length??0,mappable:payload.counts?.mappable??0,newestObservationAt:payload.freshness?.newestObservationAt||null,retrievedAt:payload.freshness?.retrievedAt||payload.retrievedAt||null};
  })));
  const domains=results.map((result,index)=>result.status==='fulfilled'?result.value:{domain:DOMAINS[index],status:'FAILED',error:String(result.reason?.message||'FAILED'),records:0,mappable:0});
  const failures=domains.filter(x=>x.status==='FAILED'||x.status==='DEGRADED').map(x=>x.domain);
  const snapshot={event:'VERISCOPE_PUBLIC_SURVEILLANCE',targetMinutes:15,startedAt,completedAt:new Date().toISOString(),domains,failures,complete:failures.length===0};
  if(process.env.CONTEXT==='production'){
    const store=getStore('veriscope-surveillance',{consistency:'strong'});
    await store.setJSON('latest',snapshot);
  }
  console.log(JSON.stringify(snapshot));
  if(failures.length===DOMAINS.length)throw new Error('ALL_PUBLIC_INTELLIGENCE_SOURCES_FAILED');
  return Response.json(snapshot);
}

export const config={schedule:'*/15 * * * *'};
