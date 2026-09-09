const DOMAINS=['earth','weather','safeplate','aviation','cyber'];

export default async function(_req,context){
  const base=context?.site?.url;
  if(!base)throw new Error('SITE_URL_UNAVAILABLE');
  const results=await Promise.allSettled(DOMAINS.map(domain=>fetch(`${base}/api/public-intelligence?domain=${domain}`,{headers:{accept:'application/json','user-agent':'VERISCOPE-SURVEILLANCE/1.4'},signal:AbortSignal.timeout(12000)}).then(response=>{
    if(!response.ok)throw new Error(`${domain}:${response.status}`);
    return response.json();
  })));
  const failures=results.map((result,index)=>result.status==='rejected'?`${DOMAINS[index]}:${result.reason?.message||'FAILED'}`:null).filter(Boolean);
  console.log(JSON.stringify({event:'VERISCOPE_PUBLIC_SURVEILLANCE',domains:DOMAINS.length,failures,timestamp:new Date().toISOString()}));
  if(failures.length===DOMAINS.length)throw new Error('ALL_PUBLIC_INTELLIGENCE_SOURCES_FAILED');
}

export const config={schedule:'*/15 * * * *'};
