import {getJSON} from './lib/core-store.mjs';
import {getStore} from '@netlify/blobs';
const env=name=>globalThis.Netlify?.env?.get?.(name)||process.env[name];
export default async()=>{
 const cb=await getJSON('safeplate_circuit',{failures:0,openUntil:null}),feedback=await getJSON('safeplate_feedback_latest',null);
 let publicSurveillance=null;try{if(process.env.CONTEXT==='production')publicSurveillance=await getStore('veriscope-surveillance',{consistency:'strong'}).get('latest',{type:'json'})}catch{}
 const last=cb.lastSuccess?new Date(cb.lastSuccess).getTime():0,ageMinutes=last?Math.floor((Date.now()-last)/60_000):null,enabled=env('VERISCOPE_SAFEPLATE_ENABLED')!=='false',feedbackEnabled=Boolean(env('SAFEPLATE_FINDINGS_URL')&&env('VERISCOPE_SAFEPLATE_FINDINGS_TOKEN')),safeplateOperational=enabled&&ageMinutes!=null&&ageMinutes<=30&&!cb.openUntil;
 const publicLast=publicSurveillance?.completedAt?new Date(publicSurveillance.completedAt).getTime():0,publicAge=publicLast?Math.floor((Date.now()-publicLast)/60_000):null,publicOperational=publicAge!=null&&publicAge<=30&&publicSurveillance?.complete===true;
 const operational=safeplateOperational&&publicOperational,status=operational?'ONLINE':'DEGRADED';
 return Response.json({service:'VERISCOPE CORE',version:'1.4.0-global-surveillance',mode:'SHADOW',status,operational,scoreStatus:'UNVALIDATED_SHADOW_SCORE',autoMergeEnabled:false,humanReviewRequired:true,surveillance:{targetMinutes:15,lastSuccessfulCycle:publicSurveillance?.completedAt||null,ageMinutes:publicAge,nextExpectedBy:publicLast?new Date(publicLast+15*60_000).toISOString():null,complete:publicSurveillance?.complete===true,failures:publicSurveillance?.failures||[],domains:publicSurveillance?.domains||[]},safeplateAdapter:{enabled,state:safeplateOperational?'TESTED':'CONNECTED_NOT_VERIFIED',circuitBreaker:cb},safeplateFeedback:{enabled:feedbackEnabled,state:feedback?.status||'READY',lastDelivery:feedback?.deliveredAt||null,policy:'HUMAN_APPROVED_ONLY',retryMinutes:15},timestamp:new Date().toISOString()},{headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
};
export const config={path:'/api/health'};
