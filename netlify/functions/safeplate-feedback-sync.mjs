import {getJSON} from './lib/core-store.mjs';
import {deliverApprovedFinding} from './lib/safeplate-feedback.mjs';

export default async()=>{
  const findings=Object.values(await getJSON('findings',{})),deliveries=await getJSON('safeplate_feedback_deliveries',{});
  const eligible=findings.filter(f=>f.humanApproved===true&&String(f.reviewStatus).toUpperCase()==='APPROVED').filter(f=>deliveries[f.id]?.status!=='DELIVERED'||deliveries[f.id]?.approvedAt!==f.review?.timestamp).slice(0,50);
  for(const finding of eligible)await deliverApprovedFinding(finding);
};

export const config={schedule:'*/15 * * * *'};
