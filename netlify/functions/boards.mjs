import {getBoardRegistry,validateBoardRegistry} from './lib/board-registry.mjs';

export default async function(req){
  if(req.method!=='GET')return Response.json({error:'METHOD_NOT_ALLOWED'},{status:405,headers:{allow:'GET','cache-control':'no-store','x-content-type-options':'nosniff'}});
  const registry=getBoardRegistry(),validation=validateBoardRegistry(registry);
  if(!validation.valid)return Response.json({error:'BOARD_REGISTRY_INVALID',validation},{status:503,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
  return Response.json({...registry,validation,generatedAt:new Date().toISOString()},{headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
}

export const config={path:'/api/boards'};
