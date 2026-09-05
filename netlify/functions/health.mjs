import {getJSON} from './lib/core-store.mjs';
export default async()=>{const cb=await getJSON('safeplate_circuit',{failures:0,openUntil:null});return Response.json({service:'VERISCOPE CORE',version:'1.0.0-shadow',mode:'SHADOW',status:'CODED',safeplateAdapter:{enabled:process.env.VERISCOPE_SAFEPLATE_ENABLED!=='false',circuitBreaker:cb},timestamp:new Date().toISOString()},{headers:{'cache-control':'no-store'}})};
export const config={path:'/api/health'};
