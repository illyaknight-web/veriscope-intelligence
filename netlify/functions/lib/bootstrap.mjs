import {getJSON} from './core-store.mjs';
import {ingestSafeplate} from './core-engine.mjs';

const VERIFIED_SAFEPLATE_ACCEPTANCE_RECORD={
  id:'FDA-GREAT-VALUE-TRIPLE-BERRY-2026-09-03',
  title:'Great Value Organic Triple Berry Blend 10 OZ',
  product:'Great Value Organic Triple Berry Blend 10 OZ (Including Strawberries, Blackberries and Blueberries)',
  company:'Frutas y Hortalizas del Sur S.A.',
  hazard:'E. coli',
  severity:'HIGH',
  status:'VERIFIED',
  category:'Food',
  states:['AL','AR','FL','IL','IN','KY','LA','MN','MS','MO','NC','OH','OK','SC','TX','WI'],
  distribution:'Shipped to select Walmart stores in 16 states.',
  firmLocation:{type:'recalling_firm',city:'San Carlos',country:'Chile',label:'San Carlos, Chile'},
  source:'FDA recall announcement / SAFEPLATE normalized record',
  sourceUrl:'https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts/frutas-y-hortalizas-del-sur-sa-expands-recall-include-one-lot-great-value-frozen-organic-triple',
  recallDate:'2026-09-02T00:00:00.000Z',
  verifiedAt:'2026-09-03T00:00:00.000Z',
  upc:'7874211226',
  identifiers:['7874211226','LOT-6040-01-6'],
  evidence:[
    {type:'AGENCY',status:'VERIFIED',source:'U.S. Food and Drug Administration',text:'The recalling firm expanded a recall to one lot because of potential E. coli O145:H28 contamination.',url:'https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts/frutas-y-hortalizas-del-sur-sa-expands-recall-include-one-lot-great-value-frozen-organic-triple'},
    {type:'IDENTIFIER',status:'VERIFIED',source:'U.S. Food and Drug Administration',text:'UPC 7874211226; Lot Code 6040 01-6; Best If Used By February 9, 2028'},
    {type:'DISTRIBUTION',status:'VERIFIED',source:'U.S. Food and Drug Administration',text:'Shipped to select Walmart stores in 16 states.'},
    {type:'LOCATION',status:'VERIFIED',source:'U.S. Food and Drug Administration',text:'Frutas y Hortalizas del Sur S.A., San Carlos, Chile',role:'recalling_firm'}
  ]
};

let inflight;
export async function ensureAcceptanceRecord(){
  if(inflight)return inflight;
  inflight=(async()=>{
    const records=await getJSON('source_records',{});
    if(records[VERIFIED_SAFEPLATE_ACCEPTANCE_RECORD.id])return {seeded:false,id:VERIFIED_SAFEPLATE_ACCEPTANCE_RECORD.id};
    const result=await ingestSafeplate(VERIFIED_SAFEPLATE_ACCEPTANCE_RECORD);
    return {seeded:true,id:VERIFIED_SAFEPLATE_ACCEPTANCE_RECORD.id,graphId:result.graph?.id,findingId:result.finding?.id};
  })();
  try{return await inflight}finally{inflight=null}
}
