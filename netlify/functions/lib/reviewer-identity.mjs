export function resolveReviewerIdentity(readEnvironment){
  const reviewer=String(readEnvironment('VERISCOPE_REVIEWER_ID')||'').trim();
  if(!reviewer)return {ok:false,error:'REVIEWER_IDENTITY_NOT_CONFIGURED'};
  return {ok:true,reviewer:reviewer.slice(0,120)};
}
