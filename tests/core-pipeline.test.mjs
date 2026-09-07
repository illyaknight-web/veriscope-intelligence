import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {applyReviewDecision,buildSafeplateCorrelation,validateSafeplateRecord} from '../netlify/functions/lib/core-pipeline.mjs';
import {fromSafeplateContract} from '../netlify/functions/lib/safeplate-contract.mjs';

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
  assert.ok(entities.find(e=>e.type==='Hazard'&&e.name==='E. coli'));
  assert.ok(entities.find(e=>e.type==='Recall'));
  assert.ok(edges.find(e=>e.type==='PRODUCT_COMPANY'));
  assert.ok(edges.find(e=>e.type==='COMPANY_FACILITY'));
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
  assert.ok(entities.find(e=>e.type==='State'));
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

test('versioned SAFEPLATE contract maps evidence and distribution into CORE input',()=>{
  const mapped=fromSafeplateContract({
    safeplate_record_id:'sp-123',schema_version:'safeplate.veriscope.record.v1',record_type:'recall',
    source:'FDA',source_record_id:'FDA-123',source_url:'https://www.fda.gov/example',
    product:{name:'Deli salad',brand:'Northside',upc:'012345678901'},organization:{name:'Made Fresh Salads'},
    distribution:{states:['NY','NJ'],description:'Official record lists New York and New Jersey.'},
    hazard:'Listeria monocytogenes',intelligence_class:'OFFICIAL',
    evidence:[{type:'AGENCY',status:'VERIFIED',source:'FDA',source_url:'https://www.fda.gov/example',text:'Official recall announcement'}]
  });
  assert.equal(mapped.id,'sp-123');
  assert.equal(mapped.contractVersion,'safeplate.veriscope.record.v1');
  assert.equal(mapped.product,'Deli salad');
  assert.deepEqual(mapped.states,['NY','NJ']);
  assert.equal(mapped.evidence[0].url,'https://www.fda.gov/example');
});
