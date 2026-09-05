import { getStore } from '@netlify/blobs';

const STORE_NAME='veriscope-core-v1-shadow';
const store=()=>getStore(STORE_NAME);

export async function getJSON(key,fallback=null){
  try{return (await store().get(key,{type:'json',consistency:'strong'}))??fallback}catch{return fallback}
}
export async function setJSON(key,value){await store().setJSON(key,value);return value}
export async function append(key,item,max=5000){
  const list=await getJSON(key,[]);list.push(item);while(list.length>max)list.shift();await setJSON(key,list);return item;
}
export async function list(key){return await getJSON(key,[])}
