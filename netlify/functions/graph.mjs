import {getJSON} from './lib/core-store.mjs';
export default async function(req){const u=new URL(req.url);const graphs=await getJSON('graphs',{});const id=u.searchParams.get('id');const sourceRecordId=u.searchParams.get('sourceRecordId');if(id)return graphs[id]?Response.json(graphs[id]):Response.json({error:'GRAPH_NOT_FOUND'},{status:404});const items=Object.values(graphs).filter(g=>!sourceRecordId||g.sourceRecordId===sourceRecordId);return Response.json({count:items.length,items,mode:'SHADOW'},{headers:{'cache-control':'no-store'}})};
export const config={path:'/api/graph'};
