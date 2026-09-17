import {getJSON} from './lib/core-store.mjs';
const env=name=>globalThis.Netlify?.env?.get?.(name)||process.env[name];
export default async()=>{
  const cb=await getJSON('safeplate_circuit',{failures:0,openUntil:null});
  const feedback=await getJSON('safeplate_feedback_latest',null);
  const last=cb.lastSuccess?new Date(cb.lastSuccess).getTime():0;
  const ageMinutes=last?Math.floor((Date.now()-last)/60_000):null;
  const enabled=env('VERISCOPE_SAFEPLATE_ENABLED')!=='false';
  const feedbackEnabled=Boolean(env('SAFEPLATE_FINDINGS_URL')&&env('VERISCOPE_SAFEPLATE_FINDINGS_TOKEN'));
  const reviewTokenConfigured=Boolean(env('VERISCOPE_REVIEW_TOKEN'));
  const reviewerIdentityConfigured=Boolean(env('VERISCOPE_REVIEWER_ID'));
  const operational=enabled&&ageMinutes!=null&&ageMinutes<=30&&!cb.openUntil;
  const status=!enabled?'UNAVAILABLE':operational?'ONLINE':'DEGRADED';
  const accessControl={deploymentAudience:'PUBLIC_DEMONSTRATION',authenticationEnforced:false,authorizationEnforced:false,roleSelector:'UI_PREVIEW_ONLY',reviewEndpoint:{sharedTokenConfigured:reviewTokenConfigured,serverReviewerIdentityConfigured:reviewerIdentityConfigured,ready:reviewTokenConfigured&&reviewerIdentityConfigured}};
  const institutionalBlockers=[
    !accessControl.authenticationEnforced&&'AUTHENTICATION_NOT_ENFORCED',
    !accessControl.authorizationEnforced&&'AUTHORIZATION_NOT_ENFORCED',
    !accessControl.reviewEndpoint.ready&&'REVIEW_IDENTITY_NOT_READY',
    'EXTERNAL_AUDIT_ANCHOR_NOT_IMPLEMENTED',
    'DISTRIBUTED_RATE_LIMITING_NOT_IMPLEMENTED'
  ].filter(Boolean);
  const readiness={runtime:status,publicDemonstration:operational?'READY_WITH_DISCLOSURES':'DEGRADED',institutionalUse:institutionalBlockers.length?'BLOCKED':'READY',institutionalBlockers,auditIntegrity:'APPLICATION_APPEND_ONLY',rateLimitMode:'INSTANCE_LOCAL'};
  return Response.json({service:'VERISCOPE CORE',version:'1.3.3-readiness-gate',mode:'SHADOW',status,operational,readiness,scoreStatus:'UNVALIDATED_SHADOW_SCORE',autoMergeEnabled:false,humanReviewRequired:true,accessControl,surveillance:{targetMinutes:15,lastSuccessfulCycle:cb.lastSuccess||null,ageMinutes,nextExpectedBy:cb.lastSuccess?new Date(last+15*60_000).toISOString():null},safeplateAdapter:{enabled,state:operational?'TESTED':'CONNECTED_NOT_VERIFIED',circuitBreaker:cb},safeplateFeedback:{enabled:feedbackEnabled,state:feedback?.status||'READY',lastDelivery:feedback?.deliveredAt||null,policy:'HUMAN_APPROVED_ONLY',retryMinutes:15},timestamp:new Date().toISOString()},{headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
};
export const config={path:'/api/health'};
