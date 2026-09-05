import {reviewFinding} from './lib/core-engine.mjs';
const json=(body,status=200)=>Response.json(body,{status,headers:{'cache-control':'no-store'}});
export default async function(req){if(req.method!=='POST')return json({error:'Method not allowed'},405);try{const body=await req.json();if(!body?.findingId||!body?.decision)return json({error:'findingId and decision are required'},400);const finding=await reviewFinding(body.findingId,String(body.decision).toUpperCase(),body.reviewer||'human-reviewer',body.notes||'');return json({status:'CODED',finding})}catch(err){return json({error:String(err?.message||err)},400)}}
export const config={path:'/api/review'};
