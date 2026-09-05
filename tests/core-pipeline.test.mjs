import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildSafeplateCorrelation,validateSafeplateRecord} from '../netlify/functions/lib/core-pipeline.mjs';

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
