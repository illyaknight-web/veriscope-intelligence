import crypto from 'node:crypto';
import {append,getJSON,setJSON} from './core-store.mjs';
import {applyReviewDecision,buildSafeplateCorrelation,canonicalId,validateSafeplateRecord} from './core-pipeline.mjs';

const now=()=>new Date().toISOString();
const h=o=>crypto.createHash('sha256').update(JSON.stringify(o)).digest('hex');
const contentHash=record=>{const stable={...record};for(const key of ['retrievedAt','lastSynced','lastChecked','observedAt'])delete stable[key];return h(stable)};
const changedFields=(before,after)=>[...new Set([...Object.keys(before||{}),...Object.keys(after||{})])].filter(key=>JSON.stringify(before?.[key])!==JSON.stringify(after?.[key]));

async function audit(action,payload){
  const prev=(await getJSON('audit',[])).at(-1)?.hash||null;
  const entry={id:canonicalId('audit',`${action}|${Date.now()}|${Math.random()}`),action,timestamp:now(),prevHash:prev,payload};
  entry.hash=h(entry);await append('audit',entry,10000);return entry;
}

export async function ingestSafeplate(record){
  const check=validateSafeplateRecord(record);if(!check.valid)throw new Error(`SCHEMA_VALIDATION: ${check.errors.join('; ')}`);
  const records=await getJSON('source_records',{}),prior=records[record.id],hash=contentHash(record);
  if(prior?.contentHash===hash){await audit('SAFEPLATE_DUPLICATE_SUPPRESSED',{sourceRecordId:record.id,contentHash:hash});return {duplicate:true,sourceRecordId:record.id,graph:(await getJSON('graphs',{}))[canonicalId('graph',record.id)]||null,finding:(await getJSON('findings',{}))[canonicalId('finding',record.id)]||null}}
  const change=prior?{type:'UPDATED',fields:changedFields(prior.record,record)}:{type:'NEW',fields:Object.keys(record)};
  records[record.id]={record,contentHash:hash,firstSeenAt:prior?.firstSeenAt||now(),lastSeenAt:now(),previousContentHash:prior?.contentHash||null,change};await setJSON('source_records',records);
  const {graph,finding,entities}=buildSafeplateCorrelation(record);
  const entityMap=await getJSON('entities',{});
  for(const e of entities){
    const prior=entityMap[e.id];
    entityMap[e.id]=prior?{...prior,aliases:[...new Set([...(prior.aliases||[]),...(e.aliases||[]),...(prior.name!==e.name?[e.name]:[])])],identifiers:[...new Set([...(prior.identifiers||[]),...(e.identifiers||[])])],lastSeenAt:now()}:({...e,firstSeenAt:now(),lastSeenAt:now()});
  }
  await setJSON('entities',entityMap);
  const graphs=await getJSON('graphs',{}),previousGraph=graphs[graph.id];graph.version=(previousGraph?.version||0)+1;graph.sourceContentHash=hash;graph.supersedesVersion=previousGraph?.version||null;graphs[graph.id]=graph;await setJSON('graphs',graphs);
  const findings=await getJSON('findings',{});findings[finding.id]=finding;await setJSON('findings',findings);
  await audit(prior?'SAFEPLATE_RECORD_UPDATED':'SAFEPLATE_INGESTED',{sourceRecordId:record.id,graphId:graph.id,findingId:finding.id,contentHash:hash,change,mode:'SHADOW'});
  return {graph,finding,change,duplicate:false};
}

export async function reviewFinding(findingId,decision,reviewer='human-reviewer',notes=''){
  const findings=await getJSON('findings',{});const f=findings[findingId];if(!f)throw new Error('FINDING_NOT_FOUND');
  const reviewed=applyReviewDecision(f,decision,reviewer,notes);findings[findingId]=reviewed;await setJSON('findings',findings);await audit('FINDING_REVIEWED',{findingId,decision,reviewer});return reviewed;
}

export {audit,applyReviewDecision,buildSafeplateCorrelation,validateSafeplateRecord};
