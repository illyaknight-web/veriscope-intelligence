import { getStore } from '@netlify/blobs';

const STORE_NAME='veriscope-core-v1-shadow';
const store=()=>getStore({name:STORE_NAME,consistency:'strong'});

export async function getJSON(key,fallback=null){
  const value=await store().get(key,{type:'json'});
  return value??fallback;
}
export async function setJSON(key,value){await store().setJSON(key,value);return value}
export async function append(key,item,max=5000){
  const list=await getJSON(key,[]);list.push(item);while(list.length>max)list.shift();await setJSON(key,list);return item;
}
export async function appendEvent(stream,item){
  if(!item?.id||!item?.timestamp)throw new Error('APPEND_EVENT_ID_AND_TIMESTAMP_REQUIRED');
  const key=`${stream}/${item.timestamp}/${item.id}`;
  await store().setJSON(key,item);
  return {key,item};
}
export async function listEvents(stream,{limit=250}={}){
  const result=await store().list({prefix:`${stream}/`}),blobs=(result?.blobs||[]).sort((a,b)=>a.key.localeCompare(b.key)).slice(-Math.max(1,Math.min(limit,1000)));
  return (await Promise.all(blobs.map(async blob=>({key:blob.key,etag:blob.etag,item:await getJSON(blob.key,null)})))).filter(event=>event.item);
}
export async function list(key){return await getJSON(key,[])}
