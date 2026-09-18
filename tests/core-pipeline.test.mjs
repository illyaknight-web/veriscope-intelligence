import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {applyReviewDecision,buildSafeplateCorrelation,validateSafeplateRecord} from '../netlify/functions/lib/core-pipeline.mjs';
import {fromSafeplateContract} from '../netlify/functions/lib/safeplate-contract.mjs';
import {buildSafeplateFeedbackPayload} from '../netlify/functions/lib/safeplate-feedback-contract.mjs';
import {resolveReviewerIdentity} from '../netlify/functions/lib/reviewer-identity.mjs';
import {getBoardRegistry,validateBoardRegistry} from '../netlify/functions/lib/board-registry.mjs';
import boardsEndpoint from '../netlify/functions/boards.mjs';
import {RADAR_CAPABILITIES,buildRadarSnapshot} from '../netlify/functions/lib/radar-engine.mjs';

const recall=JSON.parse(fs.readFileSync(new URL('./fixtures/safeplate-great-value-triple-berry-2026.json',import.meta.url),'utf8'));

test('real SAFEPLATE normalized recall validates',()=>{
  const result=validateSafeplateRecord(recall);
  assert.equal(result.valid,true,result.errors.join('; '));
});

test('recall produces source-backed entities, graph and pending human finding',()=>{
  const {graph,finding,entities,edges}=buildSafeplateCorrelation(recall);
  assert.equal(graph.mode,'SHADOW');
  assert.equal(graph.sourceRecordId,recall.id);
  assert.ok(entities.find(e=>e.type==='Product'));
  assert.ok(entities.find(e=>e.type==='Company'&&e.name==='Frutas y Hortalizas del Sur S.A.'));
  assert.ok(entities.find(e=>e.type==='Facility'&&e.name==='San Carlos, Chile'));
  assert.ok(entities.find(e=>e.type==='City'&&e.name==='San Carlos'));
  assert.ok(entities.find(e=>e.type==='Country'&&e.name==='Chile'));
  assert.equal(entities.find(e=>e.type==='Company').geo.city,'San Carlos');
  assert.ok(entities.find(e=>e.type==='Hazard'&&e.name==='E. coli'));
  assert.ok(entities.find(e=>e.type==='Recall'));
  assert.ok(edges.find(e=>e.type==='PRODUCT_COMPANY'));
  assert.ok(edges.find(e=>e.type==='COMPANY_FACILITY'));
  assert.ok(edges.find(e=>e.type==='FACILITY_LOCATED_IN_CITY'));
  assert.ok(edges.find(e=>e.type==='CITY_LOCATED_IN_COUNTRY'));
  assert.ok(edges.find(e=>e.type==='PRODUCT_HAZARD'));
  assert.ok(edges.find(e=>e.type==='RECALL_PRODUCT'));
  assert.ok(edges.find(e=>e.type==='RECALL_COMPANY'));
  assert.equal(finding.reviewStatus,'PENDING_HUMAN_REVIEW');
  assert.equal(finding.humanApproved,false);
  assert.equal(finding.risk.value,'HIGH');
  assert.equal(finding.risk.source,'SAFEPLATE_DOMAIN_VALUE');
  assert.ok(finding.confidence>0&&finding.confidence<=1);
  assert.ok(finding.supportingEvidence.length>=4);
});

test('pipeline does not invent unsupported supplier, distributor, retailer, lot, ownership or outbreak edges',()=>{
  const {edges}=buildSafeplateCorrelation(recall);
  const prohibited=['SUPPLIER','DISTRIBUTOR','RETAILER','OWNERSHIP','OUTBREAK','LOT'];
  for(const e of edges){
    for(const p of prohibited)assert.equal(e.type.includes(p),false,`unsupported edge emitted: ${e.type}`);
  }
});

test('every graph edge carries provenance, evidence, confidence and review state',()=>{
  const {edges}=buildSafeplateCorrelation(recall);
  for(const e of edges){
    assert.ok(e.evidence.length>0);
    assert.equal(e.provenance.category,'SAFEPLATE_NORMALIZED_RECORD');
    assert.equal(e.provenance.sourceRecordId,recall.id);
    assert.equal(typeof e.confidence,'number');
    assert.equal(e.reviewStatus,'PENDING_HUMAN_REVIEW');
  }
});

test('confidence is separate from domain risk',()=>{
  const {finding}=buildSafeplateCorrelation(recall);
  assert.equal(typeof finding.confidence,'number');
  assert.equal(finding.risk.value,'HIGH');
  assert.notEqual(String(finding.confidence),String(finding.risk.value));
});

test('name-only entities are source-scoped and never auto-merged',()=>{
  const first=buildSafeplateCorrelation(recall).entities.find(e=>e.type==='Company');
  const secondRecord={...recall,id:recall.id+'-SECOND'};
  const second=buildSafeplateCorrelation(secondRecord).entities.find(e=>e.type==='Company');
  assert.notEqual(first.id,second.id);
  assert.equal(first.match.autoMergeEligible,false);
  assert.equal(first.match.scoreStatus,'UNVALIDATED_SHADOW_SCORE');
});

test('documented distribution states become evidence-backed graph nodes',()=>{
  const {entities,edges,finding}=buildSafeplateCorrelation(recall);
  const state=entities.find(e=>e.type==='State');
  assert.ok(state);
  assert.notEqual(state.name,'AL');
  assert.equal(state.geo.country,'United States');
  assert.ok(edges.find(e=>e.type==='PRODUCT_DISTRIBUTED_TO'));
  assert.equal(finding.usExposure,'U.S. EXPOSURE CONFIRMED');
});

test('human review is required and can explicitly approve the finding',()=>{
  const {finding}=buildSafeplateCorrelation(recall);
  assert.equal(finding.humanApproved,false);
  const reviewed=applyReviewDecision(finding,'APPROVED','TEST_HUMAN_REVIEWER','Verified against linked FDA evidence for pipeline test.');
  assert.equal(reviewed.reviewStatus,'APPROVED');
  assert.equal(reviewed.humanApproved,true);
  assert.equal(reviewed.review.reviewer,'TEST_HUMAN_REVIEWER');
});

test('only a human-approved finding can cross the SAFEPLATE feedback bridge',()=>{
  const {finding}=buildSafeplateCorrelation(recall);
  assert.throws(()=>buildSafeplateFeedbackPayload(finding),/ONLY_HUMAN_APPROVED/);
  const reviewed=applyReviewDecision(finding,'APPROVED','TEST_HUMAN_REVIEWER','Evidence verified for return to SAFEPLATE.');
  const payload=buildSafeplateFeedbackPayload(reviewed);
  assert.equal(payload.contract_version,'veriscope.safeplate.finding.v1');
  assert.equal(payload.review.human_approved,true);
  assert.equal(payload.review.status,'APPROVED');
  assert.equal(payload.safeplate_record_id,recall.id);
  assert.ok(payload.evidence.length>=4);
});

test('versioned SAFEPLATE contract maps evidence and distribution into CORE input',()=>{
  const mapped=fromSafeplateContract({
    safeplate_record_id:'sp-123',schema_version:'safeplate.veriscope.record.v1',record_type:'recall',
    source:'FDA',source_record_id:'FDA-123',source_url:'https://www.fda.gov/example',
    product:{name:'Deli salad',brand:'Northside',upc:'012345678901'},organization:{name:'Made Fresh Salads'},
    facility:{name:'Made Fresh Salads Inc.',identifier:'FDA-EST-123',location:{city:'Woodbury',state:'NJ',country:'United States',label:'Woodbury, NJ, United States'}},
    distribution:{states:['NY','NJ'],description:'Official record lists New York and New Jersey.'},
    hazard:'Listeria monocytogenes',intelligence_class:'OFFICIAL',
    evidence:[{type:'AGENCY',status:'VERIFIED',source:'FDA',source_url:'https://www.fda.gov/example',text:'Official recall announcement'}]
  });
  assert.equal(mapped.id,'sp-123');
  assert.equal(mapped.contractVersion,'safeplate.veriscope.record.v1');
  assert.equal(mapped.product,'Deli salad');
  assert.deepEqual(mapped.states,['NY','NJ']);
  assert.equal(mapped.firmLocation.city,'Woodbury');
  assert.equal(mapped.establishment.identifier,'FDA-EST-123');
  assert.equal(mapped.evidence[0].url,'https://www.fda.gov/example');
});

test('command center exposes operational controls, labeled tiles and scheduled refresh',()=>{
  const html=fs.readFileSync(new URL('../veriscope-v41-core-live.html',import.meta.url),'utf8');
  assert.match(html,/id="refreshBtn">REFRESH</);
  assert.match(html,/id="demoBtn">RUN GUIDED DEMO</);
  assert.match(html,/id="lastUpdated"/);
  assert.match(html,/setInterval\(\(\)=>\{if\(!document\.hidden\)loadCore\('AUTO'\)\},15\*60\*1000\)/);
  assert.match(html,/dark_only_labels/);
  assert.match(html,/function entityGeo\(/);
  assert.match(html,/function graphPath\(/);
  assert.match(html,/ROLE_CONFIG/);
  assert.match(html,/function roleFindings\(/);
  assert.match(html,/OPEN EXECUTIVE PREVIEW/);
  assert.match(html,/It is not authentication or authorization/);
  assert.match(html,/Production RBAC remains required/);
  assert.match(html,/current populated inventory is derived from the SAFEPLATE reviewed bridge/);
  assert.match(html,/1 ADAPTER CONNECTED/);
  assert.match(html,/PUBLIC DEMO · NO RBAC/);
  assert.match(html,/PUBLIC DEMO · NO RBAC · CHECKING CORE/);
  assert.match(html,/pending\[0\]\.then\(health=>\{state\.health=health;renderSystem\(\)\}\)/);
  assert.match(html,/Unauthenticated preview session/);
  assert.match(html,/Preview Session/);
  assert.doesNotMatch(html,/Illya Knight/);
  assert.doesNotMatch(html,/reviewer:'VERISCOPE_AUTHENTICATED_REVIEWER'/);
  assert.doesNotMatch(html,/entityType\(e\).*San Carlos\.\*Chile/);
});

test('runtime trust contract exposes access-control truth and review identity is server-owned',()=>{
  const health=fs.readFileSync(new URL('../netlify/functions/health.mjs',import.meta.url),'utf8');
  const review=fs.readFileSync(new URL('../netlify/functions/review.mjs',import.meta.url),'utf8');
  const identity=fs.readFileSync(new URL('../netlify/functions/lib/reviewer-identity.mjs',import.meta.url),'utf8');
  assert.match(health,/deploymentAudience:'PUBLIC_DEMONSTRATION'/);
  assert.match(health,/authenticationEnforced:false/);
  assert.match(health,/authorizationEnforced:false/);
  assert.match(health,/roleSelector:'UI_PREVIEW_ONLY'/);
  assert.match(health,/institutionalUse:institutionalBlockers\.length\?'BLOCKED':'READY'/);
  assert.match(health,/EXTERNAL_AUDIT_ANCHOR_NOT_IMPLEMENTED/);
  assert.match(health,/DISTRIBUTED_RATE_LIMITING_NOT_IMPLEMENTED/);
  assert.match(health,/rateLimitMode:'INSTANCE_LOCAL'/);
  assert.match(review,/resolveReviewerIdentity\(env\)/);
  assert.match(identity,/REVIEWER_IDENTITY_NOT_CONFIGURED/);
  assert.doesNotMatch(review,/body\.reviewer/);
});

test('human review identity fails closed and cannot exceed the audit field boundary',()=>{
  assert.deepEqual(resolveReviewerIdentity(()=>''),{ok:false,error:'REVIEWER_IDENTITY_NOT_CONFIGURED'});
  assert.deepEqual(resolveReviewerIdentity(()=> ' analyst-17 '),{ok:true,reviewer:'analyst-17'});
  assert.equal(resolveReviewerIdentity(()=> 'x'.repeat(180)).reviewer.length,120);
});

test('map workspace exposes multiple SAFEPLATE trackings and reversible full-screen controls',()=>{
  const html=fs.readFileSync(new URL('../veriscope-v41-core-live.html',import.meta.url),'utf8');
  assert.match(html,/id="mapExpand"/);
  assert.match(html,/EXPAND MAP/);
  assert.match(html,/CLOSE MAP/);
  assert.match(html,/function setMapExpanded\(/);
  assert.match(html,/function renderMapWorkspace\(/);
  assert.match(html,/function recordDistributionStates\(/);
  assert.match(html,/function focusPublishedRecordGeo\(/);
  assert.match(html,/SELECT A TRACKING TO MOVE THE MAP/);
  assert.match(html,/SOURCE GEOGRAPHY SELECTED/);
  assert.match(html,/CURRENT FOOD TRACKINGS/);
  assert.match(html,/Records without location evidence remain listed but are never placed on the map/);
  assert.match(html,/event\.key==='Escape'/);
});

test('reviewed feedback retries every 15 minutes',()=>{
  const scheduled=fs.readFileSync(new URL('../netlify/functions/safeplate-feedback-sync.mjs',import.meta.url),'utf8');
  assert.match(scheduled,/schedule:'\*\/15 \* \* \* \*'/);
  assert.match(scheduled,/humanApproved===true/);
  assert.match(scheduled,/reviewStatus\)\.toUpperCase\(\)==='APPROVED'/);
});

test('SAFEPLATE batch ingestion performs one bounded store transaction',()=>{
  const endpoint=fs.readFileSync(new URL('../netlify/functions/safeplate-ingest.mjs',import.meta.url),'utf8');
  const engine=fs.readFileSync(new URL('../netlify/functions/lib/core-engine.mjs',import.meta.url),'utf8');
  assert.match(endpoint,/ingestSafeplateBatch\(records\)/);
  assert.doesNotMatch(endpoint,/for\(const record of records\)/);
  assert.match(engine,/export async function ingestSafeplateBatch/);
  assert.match(engine,/Promise\.all\(\[setJSON\('source_records'/);
  assert.match(engine,/SAFEPLATE_BATCH_INGESTED/);
});

test('CORE exposes connected evidence lenses without flattening operating boards into tabs',()=>{
  const html=fs.readFileSync(new URL('../veriscope-v41-core-live.html',import.meta.url),'utf8');
  for(const domain of ['core','safeplate','northline','earth','trade','corporate']){
    assert.match(html,new RegExp(`data-domain="${domain}"`));
  }
  for(const domain of ['maritime','land','aviation','cyber'])assert.doesNotMatch(html,new RegExp(`<button[^>]+data-domain="${domain}"`));
  for(const board of ['core','defense','cyber','juris'])assert.match(html,new RegExp(`data-board="${board}"`));
  assert.match(html,/id="missionNav"/);
  assert.match(html,/id="page-board"/);
  assert.match(html,/CAPABILITY BOUNDARY/);
  assert.match(html,/No live records, alerts, findings or readiness claims are displayed/);
  assert.match(html,/function selectDomain\(/);
  assert.match(html,/function selectBoard\(/);
  assert.match(html,/function renderBoardModule\(/);
  assert.match(html,/function applyBoardRegistry\(/);
  assert.match(html,/\/api\/boards/);
  assert.match(html,/SERVER REGISTRY/);
  assert.match(html,/function readRoute\(/);
  assert.match(html,/function writeRoute\(/);
  assert.match(html,/history\.pushState/);
  assert.match(html,/window\.addEventListener\('popstate'/);
  assert.match(html,/function renderDomainCommand\(/);
  assert.match(html,/\/api\/public-intelligence\?domain=/);
  assert.match(html,/PUBLIC SOURCE DATA · NOT A VERISCOPE FINDING/);
});

test('operating-board registry cannot activate an untested mission UI',async()=>{
  const registry=getBoardRegistry(),validation=validateBoardRegistry(registry);
  assert.deepEqual(registry.boards.map(board=>board.id),['core','defense','cyber','juris']);
  assert.equal(registry.activationPolicy,'SERVER_STATUS_PLUS_TESTED_UI_RELEASE');
  assert.equal(validation.valid,true);
  assert.equal(registry.boards.find(board=>board.id==='core').connected,true);
  for(const id of ['defense','cyber','juris']){
    const board=registry.boards.find(item=>item.id===id);
    assert.equal(board.connected,false);
    assert.equal(board.operationalUiEnabled,false);
    assert.ok(board.gates.some(gate=>gate.blocking&&gate.status!=='CONNECTED'));
  }
  const unsafe=structuredClone(registry);
  unsafe.boards.find(board=>board.id==='defense').connected=true;
  assert.deepEqual(validateBoardRegistry(unsafe),{valid:false,complete:true,unsafeBoardIds:['defense']});
  const response=await boardsEndpoint(new Request('https://example.test/api/boards'));
  assert.equal(response.status,200);
  assert.equal((await response.json()).validation.valid,true);
  const rejected=await boardsEndpoint(new Request('https://example.test/api/boards',{method:'POST'}));
  assert.equal(rejected.status,405);
});

test('intelligence radar derives contacts from evidence and labels every invention honestly',()=>{
  const now=Date.parse('2026-09-17T12:00:00.000Z');
  const snapshot=buildRadarSnapshot({
    now,
    entities:{e1:{id:'e1',match:{contradictingEvidence:[{source:'B'}]}}},
    graphs:{g1:{id:'g1',version:2,edges:[{id:'edge-1',confidence:.9}]}},
    findings:{f1:{id:'f1',sourceRecordId:'record-1',confidence:.6,timestamp:'2026-07-01T00:00:00.000Z',reviewStatus:'PENDING_HUMAN_REVIEW',humanApproved:false,supportingEvidence:[],contradictingEvidence:[{source:'A'}],review:{timestamp:'2026-09-15T00:00:00.000Z'}}},
    sourceRecords:{r1:{record:{id:'record-1'},lastSeenAt:'2026-09-16T00:00:00.000Z',change:{type:'UPDATED'}}},
    auditEvents:[{id:'audit-1'}],
    circuit:{lastSuccess:'2026-09-17T10:00:00.000Z'}
  });
  assert.equal(snapshot.classification,'EVIDENCE_DERIVED_RADAR');
  for(const type of ['REVIEW','MISSING_EVIDENCE','CONTRADICTION','CHANGE','CONFIDENCE','FRESHNESS','BLAST_RADIUS','AUTHORITY','AUDIT'])assert.ok(snapshot.contacts.some(contact=>contact.type===type),type);
  assert.equal(snapshot.summary.pendingReview,1);
  assert.equal(snapshot.summary.auditEvents,1);
  assert.equal(RADAR_CAPABILITIES.length,18);
  for(const name of ['Evidence Relay','Missing Evidence Engine','Contradiction Radar','Decision Replay','Changed Since Last Review','Confidence Decay','Evidence Half-Life','Source DNA','Corroboration Independence Score','Uncertainty Budget','No-Silent-Inference Rule','Alternative Hypothesis Engine','Evidence Blast Radius','Entity Resolution Explanation','Relationship Challenge','Temporal Evidence Twin','Authority-to-Act Check','Mission Capsule'])assert.ok(RADAR_CAPABILITIES.some(item=>item.name===name),name);
  assert.equal(RADAR_CAPABILITIES.find(item=>item.name==='Evidence Relay').status,'LOCKED');
  assert.equal(RADAR_CAPABILITIES.find(item=>item.name==='Missing Evidence Engine').status,'ACTIVE');
});

test('CORE exposes an accessible radar station backed by the radar API',()=>{
  const html=fs.readFileSync(new URL('../veriscope-v41-core-live.html',import.meta.url),'utf8');
  const endpoint=fs.readFileSync(new URL('../netlify/functions/radar.mjs',import.meta.url),'utf8');
  assert.match(html,/data-page="radar"/);
  assert.match(html,/id="page-radar"/);
  assert.match(html,/id="radarScope" role="region" aria-label="Evidence-derived intelligence radar"/);
  assert.match(html,/function renderRadar\(/);
  assert.match(html,/\/api\/radar/);
  assert.match(html,/prefers-reduced-motion:reduce/);
  assert.match(endpoint,/buildRadarSnapshot/);
  assert.match(endpoint,/listEvents\('audit-events'/);
  assert.match(endpoint,/classification:'EVIDENCE_DERIVED_RADAR'/);
});

test('public metadata contains valid VERISCOPE URLs and production security headers',()=>{
  const files=['../index.html','../veriscope-v41-core-live.html','../image-library.html','../knowledge-center/feed.xml','../knowledge-center/the-decision-layer-most-institutions-are-missing/index.html','../knowledge-center/the-next-command-center-may-not-look-like-a-command-center/index.html','../knowledge-center/when-more-data-does-not-mean-more-understanding/index.html'];
  for(const file of files){
    const text=fs.readFileSync(new URL(file,import.meta.url),'utf8');
    assert.doesNotMatch(text,/https:\/\/veriscope intelligence/);
    assert.doesNotMatch(text,/https:\/\/veriscope-intelligence\.netlify\.app\/[^"'<\s]*\s[^"'<]*/);
  }
  const config=fs.readFileSync(new URL('../netlify.toml',import.meta.url),'utf8');
  for(const header of ['Content-Security-Policy','Permissions-Policy','Referrer-Policy','X-Frame-Options','X-Content-Type-Options'])assert.match(config,new RegExp(header));
  assert.match(config,/frame-ancestors 'none'/);
  assert.match(config,/for = "\/api\/\*"/);
});

test('audit events are dual-written to unique objects and truthfully classified',()=>{
  const store=fs.readFileSync(new URL('../netlify/functions/lib/core-store.mjs',import.meta.url),'utf8');
  const engine=fs.readFileSync(new URL('../netlify/functions/lib/core-engine.mjs',import.meta.url),'utf8');
  const integrity=fs.readFileSync(new URL('../netlify/functions/audit-integrity.mjs',import.meta.url),'utf8');
  const html=fs.readFileSync(new URL('../veriscope-v41-core-live.html',import.meta.url),'utf8');
  assert.match(store,/export async function appendEvent/);
  assert.match(store,/`\$\{stream\}\/\$\{item\.timestamp\}\/\$\{item\.id\}`/);
  assert.match(engine,/await appendEvent\('audit-events',entry\)/);
  assert.match(integrity,/classification:'APPLICATION_APPEND_ONLY'/);
  assert.match(integrity,/immutable:false/);
  assert.match(integrity,/externallyAnchored:false/);
  assert.match(integrity,/HASH_MISMATCH/);
  assert.match(integrity,/!events\.length\?'EMPTY'/);
  assert.match(integrity,/path:'\/api\/audit-integrity'/);
  assert.match(html,/External immutable anchoring and administrator tamper resistance are not yet implemented/);
});

test('public source adapter registers the approved cross-domain catalog without inventing findings',()=>{
  const source=fs.readFileSync(new URL('../netlify/functions/public-intelligence.mjs',import.meta.url),'utf8');
  for(const provider of ['NASA GIBS','NASA EONET','NASA FIRMS','NOAA / National Weather Service','USGS Earthquakes','USACE CWMS','MarineCadastre AIS','AviationWeather.gov','FDA openFDA','USDA FoodData Central','CDC NORS','Open Food Facts','U.S. Census International Trade','UN Comtrade','GLEIF','SEC EDGAR','OFAC Sanctions List Service','CISA KEV','NIST NVD']){
    assert.match(source,new RegExp(provider.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  }
  assert.match(source,/classification:'PUBLIC_SOURCE_RECORD'/);
  assert.match(source,/reviewStatus:'SOURCE_ONLY'/);
  assert.match(source,/They are not VERISCOPE findings until normalized, correlated and reviewed/);
  assert.match(source,/config=\{path:'\/api\/public-intelligence'\}/);
});

test('live public intelligence sources are refreshed on the 15-minute surveillance cycle',()=>{
  const scheduled=fs.readFileSync(new URL('../netlify/functions/public-intelligence-sync.mjs',import.meta.url),'utf8');
  assert.match(scheduled,/\['earth','weather','safeplate','aviation','cyber'\]/);
  assert.match(scheduled,/config=\{schedule:'\*\/15 \* \* \* \*'\}/);
  assert.match(scheduled,/VERISCOPE_PUBLIC_SURVEILLANCE/);
});
