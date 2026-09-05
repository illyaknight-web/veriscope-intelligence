import crypto from 'node:crypto';

const now=()=>new Date().toISOString();
const norm=s=>String(s??'').trim().toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export const canonicalId=(type,key)=>`${type.toLowerCase()}_${crypto.createHash('sha256').update(`${type}|${norm(key)}`).digest('hex').slice(0,20)}`;

export function validateSafeplateRecord(r){
  const errors=[];
  if(!r||typeof r!=='object')errors.push('record must be an object');
  if(!r?.id)errors.push('id is required');
  if(!r?.source)errors.push('source is required');
  if(!r?.product&&!r?.title)errors.push('product/title is required');
  if(!Array.isArray(r?.evidence)||!r.evidence.length)errors.push('evidence[] is required');
  return {valid:errors.length===0,errors};
}

export function confidence(method,support=1,contradictions=0){
  const base={exact_identifier:.98,exact_source_name:.92,source_record:.90,normalized_name:.82,heuristic:.65}[method]??.60;
  return Math.max(0,Math.min(.99,Number((base+Math.min(support,3)*.01-contradictions*.12).toFixed(2))));
}

function makeEntity(type,name,sourceRecord,method='source_record',identifiers=[]){
  const key=identifiers.find(Boolean)||name;
  return {id:canonicalId(type,key),type,name:String(name||'').trim(),aliases:[],identifiers:[...new Set(identifiers.filter(Boolean))],match:{method,confidence:confidence(method),supportingEvidence:sourceRecord.evidence||[],contradictingEvidence:[],sourceProvenance:{system:'SAFEPLATE',source:sourceRecord.source,sourceRecordId:sourceRecord.id},timestamp:now(),reviewStatus:'PENDING_HUMAN_REVIEW'}};
}

function edge(from,to,type,record,evidence){
  return {id:canonicalId('edge',`${from}|${type}|${to}|${record.id}`),from,to,type,evidence:(evidence||record.evidence||[]),confidence:confidence('source_record'),provenance:{category:'SAFEPLATE_NORMALIZED_RECORD',source:record.source,sourceRecordId:record.id},createdAt:now(),reviewStatus:'PENDING_HUMAN_REVIEW'};
}

export function buildSafeplateCorrelation(record){
  const check=validateSafeplateRecord(record);if(!check.valid)throw new Error(`SCHEMA_VALIDATION: ${check.errors.join('; ')}`);
  const entities=[];const edges=[];
  const product=makeEntity('Product',record.product||record.title,record,'source_record',[record.upc,record.gtin,...(record.identifiers||[])]);entities.push(product);
  let company=null,facility=null,hazard=null;
  if(record.company){company=makeEntity('Company',record.company,record,'exact_source_name');entities.push(company);edges.push(edge(product.id,company.id,'PRODUCT_COMPANY',record));}
  const facilityName=record.establishment?.name||record.firmLocation?.label||null;
  if(facilityName){facility=makeEntity('Facility',facilityName,record,'exact_source_name');entities.push(facility);if(company)edges.push(edge(company.id,facility.id,'COMPANY_FACILITY',record));else edges.push(edge(product.id,facility.id,'PRODUCT_FACILITY',record));}
  if(record.hazard){hazard=makeEntity('Hazard',record.hazard,record,'source_record');entities.push(hazard);edges.push(edge(product.id,hazard.id,'PRODUCT_HAZARD',record));}
  const recall=makeEntity('Recall',record.id,record,'exact_identifier',[record.id]);entities.push(recall);edges.push(edge(recall.id,product.id,'RECALL_PRODUCT',record));if(company)edges.push(edge(recall.id,company.id,'RECALL_COMPANY',record));
  const graph={id:canonicalId('graph',record.id),sourceRecordId:record.id,mode:'SHADOW',entities,edges,createdAt:now()};
  const finding={id:canonicalId('finding',record.id),sourceRecordId:record.id,what:`VERISCOPE resolved ${entities.length} supported entities and ${edges.length} evidence-backed relationships from SAFEPLATE record ${record.id}.`,why:'Relationships were emitted only where the normalized SAFEPLATE source record directly supported them. No unsupported supplier, distributor, retailer, ownership, lot or outbreak links were created.',supportingEvidence:record.evidence,contradictingEvidence:[],confidence:Number(Math.min(...edges.map(e=>e.confidence),.99).toFixed(2)),risk:{value:record.severity||null,source:'SAFEPLATE_DOMAIN_VALUE',note:'Risk/severity is stored separately from VERISCOPE confidence.'},provenance:{category:'VERISCOPE_CORRELATION',inputCategory:'SAFEPLATE_NORMALIZED_RECORD',source:record.source,sourceRecordId:record.id},timestamp:now(),humanApproved:false,reviewStatus:'PENDING_HUMAN_REVIEW'};
  return {graph,finding,entities,edges};
}

export function applyReviewDecision(finding,decision,reviewer='human-reviewer',notes=''){
  if(!finding)throw new Error('FINDING_NOT_FOUND');
  if(!['APPROVED','REJECTED'].includes(decision))throw new Error('INVALID_DECISION');
  return {...finding,reviewStatus:decision,humanApproved:decision==='APPROVED',review:{reviewer,notes,timestamp:now()}};
}
