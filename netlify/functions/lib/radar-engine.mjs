const values=value=>Array.isArray(value)?value:Object.values(value||{});
const stamp=value=>{const time=new Date(value||0).getTime();return Number.isFinite(time)?time:0};

export const RADAR_CAPABILITIES=[
  ['evidence-relay','Evidence Relay','LOCKED','Requires identity, authorization, purpose restrictions and recipient acknowledgement.'],
  ['missing-evidence','Missing Evidence Engine','ACTIVE','Finds relationships and findings that lack required support or provenance.'],
  ['contradiction-radar','Contradiction Radar','ACTIVE','Surfaces explicitly recorded contradicting evidence without resolving it silently.'],
  ['decision-replay','Decision Replay','PARTIAL','Can reconstruct stored application audit events; external immutable anchoring is still absent.'],
  ['changed-review','Changed Since Last Review','ACTIVE','Flags updated source records whose findings have not been reviewed after the change.'],
  ['confidence-decay','Confidence Decay','SHADOW','Flags aging evidence for review but does not silently alter confidence scores.'],
  ['evidence-half-life','Evidence Half-Life','POLICY REQUIRED','Needs domain-approved aging rules before scores can change.'],
  ['source-dna','Source DNA','ACTIVE','Preserves source, transformation category, record identity and relationship provenance.'],
  ['corroboration-independence','Corroboration Independence Score','PROPOSED','Needs source-ownership and dependency modeling.'],
  ['uncertainty-budget','Uncertainty Budget','PROPOSED','Would show how much uncertainty enters at each reasoning step.'],
  ['no-silent-inference','No-Silent-Inference Rule','ACTIVE','Unsupported relationships are not promoted to facts.'],
  ['alternative-hypothesis','Alternative Hypothesis Engine','PROPOSED','Needs governed hypothesis comparison and rejection criteria.'],
  ['blast-radius','Evidence Blast Radius','PARTIAL','Counts relationships affected by changed source records; full propagation is not implemented.'],
  ['entity-explanation','Entity Resolution Explanation','ACTIVE','Exposes resolution method, confidence, identifiers and merge eligibility.'],
  ['relationship-challenge','Relationship Challenge','PROPOSED','Needs authenticated analyst challenges and resolution workflow.'],
  ['temporal-twin','Temporal Evidence Twin','PARTIAL','Versions graphs and source hashes; complete point-in-time reconstruction remains incomplete.'],
  ['authority-check','Authority-to-Act Check','BLOCKED','The checker correctly blocks institutional action because RBAC is not enforced.'],
  ['mission-capsule','Mission Capsule','LOCKED','Requires protected saved investigations, membership, deadlines and export restrictions.']
].map(([id,name,status,reason])=>({id,name,status,reason}));

export function buildRadarSnapshot({entities={},graphs={},findings={},sourceRecords={},auditEvents=[],circuit={},now=Date.now()}={}){
  const entityList=values(entities),graphList=values(graphs),findingList=values(findings),recordList=values(sourceRecords),events=values(auditEvents);
  const edges=graphList.flatMap(graph=>Array.isArray(graph.edges)?graph.edges:[]),contacts=[];
  const add=(type,severity,title,detail,count,refs=[])=>{if(count>0)contacts.push({id:`${type.toLowerCase()}-${contacts.length+1}`,type,severity,title,detail,count,refs:refs.filter(Boolean).slice(0,12)})};

  const pending=findingList.filter(item=>item.humanApproved!==true||String(item.reviewStatus||'').toUpperCase()!=='APPROVED');
  add('REVIEW','HIGH','Human decisions pending','Consequential findings remain unavailable for approved operational use.',pending.length,pending.map(item=>item.id));

  const incompleteEdges=edges.filter(edge=>!edge.provenance||!Array.isArray(edge.evidence)||!edge.evidence.length||!Number.isFinite(Number(edge.confidence)));
  const incompleteFindings=findingList.filter(item=>!item.provenance||!Array.isArray(item.supportingEvidence)||!item.supportingEvidence.length);
  add('MISSING_EVIDENCE','CRITICAL','Evidence requirements incomplete','Relationships or findings are missing provenance, supporting evidence, or a confidence value.',incompleteEdges.length+incompleteFindings.length,[...incompleteEdges.map(item=>item.id),...incompleteFindings.map(item=>item.id)]);

  const contradictions=[...findingList.flatMap(item=>item.contradictingEvidence||[]),...entityList.flatMap(item=>item.match?.contradictingEvidence||item.contradictingEvidence||[])];
  add('CONTRADICTION','HIGH','Contradicting evidence recorded','Conflicting evidence requires explicit analyst resolution.',contradictions.length);

  const changed=recordList.filter(item=>item.change?.type==='UPDATED').filter(item=>{
    const finding=findingList.find(candidate=>candidate.sourceRecordId===item.record?.id);
    return !finding?.review?.timestamp||stamp(finding.review.timestamp)<stamp(item.lastSeenAt);
  });
  add('CHANGE','HIGH','Evidence changed since review','Updated source records have no later human-review decision.',changed.length,changed.map(item=>item.record?.id));

  const lowConfidence=findingList.filter(item=>Number.isFinite(Number(item.confidence))&&Number(item.confidence)<.75);
  add('CONFIDENCE','MEDIUM','Low-confidence findings','These findings remain below the radar review threshold; scores were not modified.',lowConfidence.length,lowConfidence.map(item=>item.id));

  const aged=findingList.filter(item=>stamp(item.timestamp)&&now-stamp(item.timestamp)>30*24*60*60*1000);
  add('FRESHNESS','MEDIUM','Evidence-age review due','Evidence is older than the provisional 30-day advisory window. No confidence decay was applied.',aged.length,aged.map(item=>item.id));

  const lastSuccess=stamp(circuit.lastSuccess),surveillanceAge=lastSuccess?Math.floor((now-lastSuccess)/60_000):null;
  if(surveillanceAge===null||surveillanceAge>30)add('FRESHNESS','CRITICAL','Surveillance freshness degraded',surveillanceAge===null?'No successful surveillance cycle is recorded.':`Last successful cycle is ${surveillanceAge} minutes old.`,1);

  const updatedGraphs=graphList.filter(graph=>Number(graph.version||0)>1),affectedEdges=updatedGraphs.reduce((sum,graph)=>sum+(graph.edges?.length||0),0);
  add('BLAST_RADIUS','MEDIUM','Changed evidence has connected impact','Relationships attached to versioned graphs require review when their source changes.',affectedEdges,updatedGraphs.map(item=>item.id));

  add('AUTHORITY','CRITICAL','Institutional action blocked','Authentication and server-enforced RBAC are not implemented in this public demonstration.',1);
  add('AUDIT','HIGH','Audit anchoring incomplete','Application audit events are self-hashed but not externally anchored or administrator-immutable.',1);

  const severityOrder={CRITICAL:0,HIGH:1,MEDIUM:2,LOW:3};
  contacts.sort((a,b)=>(severityOrder[a.severity]??9)-(severityOrder[b.severity]??9)||b.count-a.count||a.title.localeCompare(b.title));
  const bySeverity=contacts.reduce((out,item)=>{out[item.severity]=(out[item.severity]||0)+1;return out},{});
  const capabilities=RADAR_CAPABILITIES.map(item=>item.id==='decision-replay'?{...item,observedEvents:events.length}:item);
  return {classification:'EVIDENCE_DERIVED_RADAR',mode:'SHADOW',contacts,summary:{contacts:contacts.length,critical:bySeverity.CRITICAL||0,high:bySeverity.HIGH||0,pendingReview:pending.length,entities:entityList.length,graphs:graphList.length,relationships:edges.length,auditEvents:events.length},capabilities,limitations:['Radar contacts are derived from stored VERISCOPE records and runtime configuration.','No contact is a prediction, threat declaration, legal conclusion or authorization to act.','Confidence aging remains advisory until domain-specific evidence half-life policies are approved.']};
}
