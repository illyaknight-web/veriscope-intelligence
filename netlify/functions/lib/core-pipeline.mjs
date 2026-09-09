import crypto from 'node:crypto';

const now=()=>new Date().toISOString();
const norm=s=>String(s??'').trim().toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export const canonicalId=(type,key)=>`${type.toLowerCase()}_${crypto.createHash('sha256').update(`${type}|${norm(key)}`).digest('hex').slice(0,20)}`;
const STATE_CODES={alabama:'AL',alaska:'AK',arizona:'AZ',arkansas:'AR',california:'CA',colorado:'CO',connecticut:'CT',delaware:'DE',florida:'FL',georgia:'GA',hawaii:'HI',idaho:'ID',illinois:'IL',indiana:'IN',iowa:'IA',kansas:'KS',kentucky:'KY',louisiana:'LA',maine:'ME',maryland:'MD',massachusetts:'MA',michigan:'MI',minnesota:'MN',mississippi:'MS',missouri:'MO',montana:'MT',nebraska:'NE',nevada:'NV','new hampshire':'NH','new jersey':'NJ','new mexico':'NM','new york':'NY','north carolina':'NC','north dakota':'ND',ohio:'OH',oklahoma:'OK',oregon:'OR',pennsylvania:'PA','rhode island':'RI','south carolina':'SC','south dakota':'SD',tennessee:'TN',texas:'TX',utah:'UT',vermont:'VT',virginia:'VA',washington:'WA','west virginia':'WV',wisconsin:'WI',wyoming:'WY','district of columbia':'DC'};
const STATE_NAMES=Object.fromEntries(Object.entries(STATE_CODES).map(([name,code])=>[code,name.replace(/\b\w/g,c=>c.toUpperCase())]));
const stateCode=value=>{const raw=String(value||'').trim();const upper=raw.toUpperCase();return /^[A-Z]{2}$/.test(upper)?upper:STATE_CODES[norm(raw)]||null};

function normalizedGeo(record){
  const raw=record.firmLocation||record.location||record.establishment?.location||null;
  if(!raw)return null;
  if(typeof raw==='string')return {label:raw,source:'SOURCE_RECORD_LOCATION'};
  const latitude=Number(raw.latitude??raw.lat),longitude=Number(raw.longitude??raw.lng??raw.lon);
  const geo={
    label:String(raw.label||[raw.city,raw.state,raw.country].filter(Boolean).join(', ')||'').trim(),
    city:String(raw.city||raw.town||raw.locality||'').trim()||null,
    state:String(raw.state||raw.region||'').trim()||null,
    country:String(raw.country||'').trim()||null,
    role:String(raw.role||raw.type||'location').trim(),
    source:'SOURCE_RECORD_LOCATION'
  };
  if(Number.isFinite(latitude)&&Number.isFinite(longitude)&&Math.abs(latitude)<=90&&Math.abs(longitude)<=180){
    geo.latitude=latitude;geo.longitude=longitude;geo.precision=raw.precision||'SOURCE_PROVIDED';
  }else geo.precision='NAMED_LOCATION';
  return geo.label||geo.city||geo.state||geo.country?geo:null;
}

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

function makeEntity(type,name,sourceRecord,method='source_record',identifiers=[],metadata={}){
  const strongIdentifier=identifiers.find(Boolean);
  const resolvedMethod=strongIdentifier?'exact_identifier':'source_record_only';
  // Name-only records remain scoped to the source record. They are candidates for
  // later resolution, never automatic cross-record merges.
  const key=strongIdentifier||`${sourceRecord.source}|${sourceRecord.id}|${type}|${name}`;
  return {id:canonicalId(type,key),type,name:String(name||'').trim(),aliases:[],identifiers:[...new Set(identifiers.filter(Boolean))],...metadata,match:{method:resolvedMethod,confidence:strongIdentifier?confidence('exact_identifier'):confidence('source_record'),scoreStatus:'UNVALIDATED_SHADOW_SCORE',autoMergeEligible:false,supportingEvidence:sourceRecord.evidence||[],contradictingEvidence:[],sourceProvenance:{system:'SAFEPLATE',source:sourceRecord.source,sourceRecordId:sourceRecord.id},timestamp:now(),reviewStatus:'PENDING_HUMAN_REVIEW'}};
}

function edge(from,to,type,record,evidence){
  return {id:canonicalId('edge',`${from}|${type}|${to}|${record.id}`),from,to,type,evidence:(evidence||record.evidence||[]),confidence:confidence('source_record'),scoreStatus:'UNVALIDATED_SHADOW_SCORE',provenance:{category:'SAFEPLATE_NORMALIZED_RECORD',source:record.source,sourceRecordId:record.id},createdAt:now(),reviewStatus:'PENDING_HUMAN_REVIEW'};
}

export function buildSafeplateCorrelation(record){
  const check=validateSafeplateRecord(record);if(!check.valid)throw new Error(`SCHEMA_VALIDATION: ${check.errors.join('; ')}`);
  const entities=[];const edges=[];
  const product=makeEntity('Product',record.product||record.title,record,'source_record',[record.upc,record.gtin,...(record.identifiers||[])]);entities.push(product);
  let company=null,facility=null,hazard=null,city=null,country=null;
  const geo=normalizedGeo(record);
  const locationMatches=(record.evidence||[]).filter(e=>/location|facility|establishment/i.test(`${e.type||''} ${e.role||''}`)),locationEvidence=locationMatches.length?locationMatches:(record.evidence||[]);
  if(record.company){company=makeEntity('Company',record.company,record,'exact_source_name',[],geo?{geo}:{});entities.push(company);edges.push(edge(product.id,company.id,'PRODUCT_COMPANY',record));}
  const facilityName=record.establishment?.name||record.firmLocation?.label||null;
  if(facilityName){facility=makeEntity('Facility',facilityName,record,'exact_source_name',record.establishment?.identifier?[record.establishment.identifier]:[],geo?{geo}:{});entities.push(facility);if(company)edges.push(edge(company.id,facility.id,'COMPANY_FACILITY',record,locationEvidence));else edges.push(edge(product.id,facility.id,'PRODUCT_FACILITY',record,locationEvidence));}
  if(geo?.city){city=makeEntity('City',geo.city,record,'source_record',[],{geo:{...geo,label:[geo.city,geo.state,geo.country].filter(Boolean).join(', ')}});entities.push(city);if(facility)edges.push(edge(facility.id,city.id,'FACILITY_LOCATED_IN_CITY',record,locationEvidence));else if(company)edges.push(edge(company.id,city.id,'COMPANY_LOCATED_IN_CITY',record,locationEvidence));}
  if(geo?.country){country=makeEntity('Country',geo.country,record,'source_record',[geo.country],{geo:{country:geo.country,label:geo.country,precision:'COUNTRY_NAME',source:'SOURCE_RECORD_LOCATION'}});entities.push(country);if(city)edges.push(edge(city.id,country.id,'CITY_LOCATED_IN_COUNTRY',record,locationEvidence));else if(facility)edges.push(edge(facility.id,country.id,'FACILITY_LOCATED_IN_COUNTRY',record,locationEvidence));else if(company)edges.push(edge(company.id,country.id,'COMPANY_LOCATED_IN_COUNTRY',record,locationEvidence));}
  if(record.hazard){hazard=makeEntity('Hazard',record.hazard,record,'source_record');entities.push(hazard);edges.push(edge(product.id,hazard.id,'PRODUCT_HAZARD',record));}
  const recall=makeEntity('Recall',record.id,record,'exact_identifier',[record.id]);entities.push(recall);edges.push(edge(recall.id,product.id,'RECALL_PRODUCT',record));if(company)edges.push(edge(recall.id,company.id,'RECALL_COMPANY',record));
  for(const code of [...new Set((record.states||[]).map(stateCode).filter(Boolean))]){const name=STATE_NAMES[code]||code;const state=makeEntity('State',name,record,'exact_identifier',[`US-${code}`],{geo:{country:'United States',state:name,stateCode:code,label:`${name}, United States`,precision:'STATE_CENTROID',source:'CARTOGRAPHIC_REFERENCE'}});entities.push(state);edges.push(edge(product.id,state.id,'PRODUCT_DISTRIBUTED_TO',record,(record.evidence||[]).filter(e=>/distribution|agency/i.test(`${e.type||''} ${e.source||''}`))))}
  const officialUS=/\b(FDA|USDA|FSIS|CDC|United States)\b/i.test(`${record.source||''} ${record.sourceUrl||''}`),hasUSStates=(record.states||[]).length>0,usExposure=officialUS?'U.S. EXPOSURE CONFIRMED':hasUSStates?'U.S. EXPOSURE POSSIBLE':'U.S. NEXUS UNRESOLVED';
  const graph={id:canonicalId('graph',record.id),sourceRecordId:record.id,mode:'SHADOW',analysisVersion:'core-pipeline.v1.3',entities,edges,createdAt:now()};
  const subject=String(record.product||record.title||'SAFEPLATE record').trim(),hazardName=String(record.hazard||'').trim();
  const finding={id:canonicalId('finding',record.id),sourceRecordId:record.id,title:hazardName?`${subject} · ${hazardName}`:subject,what:hazardName?`${subject} has source-backed ${hazardName} evidence requiring human review.`:`${subject} has source-backed evidence requiring human review.`,why:`SAFEPLATE record ${record.id} produced ${entities.length} source-scoped entity candidates and ${edges.length} evidence-backed relationships. Relationships were emitted only where the normalized source record directly supported them. Name-only entities were not merged across records, and no unsupported supplier, distributor, retailer, ownership, lot or outbreak links were created.`,supportingEvidence:record.evidence,contradictingEvidence:[],confidence:Number(Math.min(...edges.map(e=>e.confidence),.99).toFixed(2)),scoreStatus:'UNVALIDATED_SHADOW_SCORE',usExposure,risk:{value:record.severity||null,source:'SAFEPLATE_DOMAIN_VALUE',note:'Risk/severity is stored separately from VERISCOPE confidence.'},provenance:{category:'VERISCOPE_CORRELATION',inputCategory:'SAFEPLATE_NORMALIZED_RECORD',source:record.source,sourceRecordId:record.id,sourceAuthority:/\b(FDA|USDA|FSIS|CDC)\b/i.test(record.source||'')?'TIER_A_PRIMARY':'SOURCE_PRESERVED_UNRANKED'},timestamp:now(),humanApproved:false,reviewStatus:'PENDING_HUMAN_REVIEW'};
  return {graph,finding,entities,edges};
}

export function applyReviewDecision(finding,decision,reviewer='human-reviewer',notes=''){
  if(!finding)throw new Error('FINDING_NOT_FOUND');
  if(!['APPROVED','REJECTED'].includes(decision))throw new Error('INVALID_DECISION');
  return {...finding,reviewStatus:decision,humanApproved:decision==='APPROVED',review:{reviewer,notes,timestamp:now()}};
}
