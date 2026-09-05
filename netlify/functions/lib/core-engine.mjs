import crypto from 'node:crypto';
import {append,getJSON,setJSON} from './core-store.mjs';
import {buildSafeplateCorrelation,canonicalId,validateSafeplateRecord} from './core-pipeline.mjs';

const now=()=>new Date().toISOString();
const h=o=>crypto.createHash('sha256').update(JSON.stringify(o)).digest('hex');

async function audit(action,payload){
  const prev=(await getJSON('audit',[])).at(-1)?.hash||null;
  const entry={id:canonicalId('audit',`${action}|${Date.now()}|${Math.random()}`),action,timestamp:now(),prevHash:prev,payload};
  entry.hash=h(entry);await append('audit',entry,10000);return entry;
}

export async function ingestSafeplate(record){
  const check=validateSafeplateRecord(record);if(!check.valid)throw new Error(`SCHEMA_VALIDATION: ${check.errors.join('; ')}`);
  const {graph,finding,entities}=buildSafeplateCorrelation(record);
  const entityMap=await getJSON('entities',{});
  for(const e of entities){
    const prior=entityMap[e.id];
    entityMap[e.id]=prior?{...prior,aliases:[...new Set([...(prior.aliases||[]),...(e.aliases||[]),...(prior.name!==e.name?[e.name]:[])])],identifiers:[...new Set([...(prior.identifiers||[]),...(e.identifiers||[])])],lastSeenAt:now()}:({...e,firstSeenAt:now(),lastSeenAt:now()});
  }
  await setJSON('entities',entityMap);
  const graphs=await getJSON('graphs',{});graphs[graph.id]=graph;await setJSON('graphs',graphs);
  const findings=await getJSON('findings',{});findings[finding.id]=finding;await setJSON('findings',findings);
  await audit('SAFEPLATE_INGESTED',{sourceRecordId:record.id,graphId:graph.id,findingId:finding.id,mode:'SHADOW'});
  return {graph,finding};
}

export async function reviewFinding(findingId,decision,reviewer='human-reviewer',notes=''){
  const findings=await getJSON('findings',{});const f=findings[findingId];if(!f)throw new Error('FINDING_NOT_FOUND');
  if(!['APPROVED','REJECTED'].includes(decision))throw new Error('INVALID_DECISION');
  f.reviewStatus=decision;f.humanApproved=decision==='APPROVED';f.review={reviewer,notes,timestamp:now()};findings[findingId]=f;await setJSON('findings',findings);await audit('FINDING_REVIEWED',{findingId,decision,reviewer});return f;
}

export {audit,buildSafeplateCorrelation,validateSafeplateRecord};
