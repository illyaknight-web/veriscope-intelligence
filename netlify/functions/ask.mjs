import {getJSON} from './lib/core-store.mjs';
import {json,rateLimit} from './lib/security.mjs';

const stop=new Set('a an and are do does explain for how in is me of on show the this to what where which why with'.split(' '));
const terms=value=>String(value||'').toLowerCase().replace(/[^a-z0-9\s-]/g,' ').split(/\s+/).filter(x=>x.length>1&&!stop.has(x));
const text=value=>typeof value==='string'?value:JSON.stringify(value||'');

export default async function(req){
  if(req.method!=='GET')return json({error:'Method not allowed'},405);
  const limited=rateLimit(req,{limit:30,windowMs:60_000,scope:'ask'});if(limited)return limited;
  const q=new URL(req.url).searchParams.get('q')?.trim().slice(0,300)||'';
  const need=terms(q);if(!need.length)return json({error:'A specific evidence question is required'},422);
  const findings=Object.values(await getJSON('findings',{})),graphs=Object.values(await getJSON('graphs',{})),entities=Object.values(await getJSON('entities',{}));
  const candidates=findings.map(f=>{const hay=terms([f.what,f.why,f.sourceRecordId,f.provenance?.source,...(f.supportingEvidence||[]).map(e=>[e.source,e.text,e.url].join(' '))].join(' '));const score=need.reduce((n,t)=>n+(hay.some(h=>h===t)?4:hay.some(h=>h.includes(t))?1:0),0);return{f,score}}).filter(x=>x.score>0).sort((a,b)=>b.score-a.score);
  if(!candidates.length)return json({answer:'No supported VERISCOPE finding matched that question.',status:'NO_SUPPORTED_ANSWER',confidence:null,evidence:[],provenance:[],conflicts:[],lastUpdated:new Date().toISOString(),notice:'No answer is safer than unsupported inference. Try a product, company, source record, hazard, or recall identifier.'});
  const finding=candidates[0].f,graph=graphs.find(g=>g.sourceRecordId===finding.sourceRecordId),relatedEntities=(graph?.entities||[]).map(e=>entities.find(x=>x.id===e.id)||e);
  return json({answer:finding.what,status:finding.reviewStatus||'PENDING_HUMAN_REVIEW',explanation:finding.why||null,confidence:finding.confidence??null,scoreStatus:finding.scoreStatus||'UNVALIDATED_SHADOW_SCORE',evidence:finding.supportingEvidence||[],provenance:[finding.provenance,...(graph?.edges||[]).map(e=>e.provenance)].filter(Boolean),conflicts:finding.contradictingEvidence||[],entities:relatedEntities.slice(0,20),lastUpdated:finding.timestamp||null,notice:'VERISCOPE returns source-grounded shadow intelligence. Pending findings are not official regulatory conclusions.'});
}
export const config={path:'/api/ask'};
