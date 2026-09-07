export function fromSafeplateContract(r={}){
  return {
    id:r.safeplate_record_id,
    source:r.source,
    sourceRecordId:r.source_record_id,
    sourceUrl:r.source_url,
    product:r.product?.name||'',
    brand:r.product?.brand||'',
    upc:r.product?.upc||null,
    gtin:r.product?.gtin||null,
    company:r.organization?.name||'',
    establishment:r.facility?.name?{name:r.facility.name,identifier:r.facility.identifier||null}:null,
    hazard:r.hazard||'',
    severity:r.risk?.value||null,
    status:r.status||r.intelligence_class||'SHADOW',
    category:r.record_type||'food_safety_record',
    states:Array.isArray(r.distribution?.states)?r.distribution.states:[],
    distribution:r.distribution?.description||'',
    lots:Array.isArray(r.lot)?r.lot:[],
    updatedAt:r.updated_at||r.retrieved_at||null,
    evidence:(Array.isArray(r.evidence)?r.evidence:[]).map(e=>({type:e.type,status:e.status,source:e.source,url:e.source_url,text:e.text,publishedAt:e.published_at})),
    lineage:r.lineage||null,
    contractVersion:r.schema_version||'safeplate.veriscope.record.v1'
  };
}
