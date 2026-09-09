const now=()=>new Date().toISOString();
const clean=(value,max=2000)=>String(value??'').replace(/[\u0000-\u001f<>]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);

export function buildSafeplateFeedbackPayload(finding){
  if(!finding||finding.humanApproved!==true||String(finding.reviewStatus).toUpperCase()!=='APPROVED')throw new Error('ONLY_HUMAN_APPROVED_FINDINGS_CAN_RETURN_TO_SAFEPLATE');
  const evidence=Array.isArray(finding.supportingEvidence)?finding.supportingEvidence.slice(0,25).map(item=>({
    type:clean(item?.type,80),status:clean(item?.status,80),source:clean(item?.source,180),
    url:/^https:\/\//i.test(String(item?.url||''))?String(item.url):null,text:clean(item?.text||item?.summary,1600)
  })):[];
  return {
    contract_version:'veriscope.safeplate.finding.v1',producer:'VERISCOPE_CORE',mode:'HUMAN_REVIEWED',
    finding_id:clean(finding.id,180),safeplate_record_id:clean(finding.sourceRecordId,180),
    title:clean(finding.title||finding.what,500),assessment:clean(finding.what,1600),explanation:clean(finding.why,3000),
    confidence:Number.isFinite(Number(finding.confidence))?Number(finding.confidence):null,risk:finding.risk||null,
    review:{status:'APPROVED',human_approved:true,reviewer:clean(finding.review?.reviewer,180),notes:clean(finding.review?.notes,3000),reviewed_at:finding.review?.timestamp||null},
    provenance:finding.provenance||null,evidence,approved_at:finding.review?.timestamp||now()
  };
}

