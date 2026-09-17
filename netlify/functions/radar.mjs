import {getJSON,listEvents} from './lib/core-store.mjs';
import {buildRadarSnapshot} from './lib/radar-engine.mjs';

export default async function(req){
  if(req.method!=='GET')return Response.json({error:'METHOD_NOT_ALLOWED'},{status:405,headers:{allow:'GET','cache-control':'no-store','x-content-type-options':'nosniff'}});
  try{
    const [entities,graphs,findings,sourceRecords,circuit,auditEvents]=await Promise.all([
      getJSON('entities',{}),getJSON('graphs',{}),getJSON('findings',{}),getJSON('source_records',{}),getJSON('safeplate_circuit',{}),listEvents('audit-events',{limit:250})
    ]);
    return Response.json({...buildRadarSnapshot({entities,graphs,findings,sourceRecords,circuit,auditEvents:auditEvents.map(event=>event.item)}),generatedAt:new Date().toISOString()},{headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
  }catch(error){
    return Response.json({status:'UNAVAILABLE',classification:'EVIDENCE_DERIVED_RADAR',error:String(error?.message||error),generatedAt:new Date().toISOString()},{status:503,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
  }
}

export const config={path:'/api/radar'};
