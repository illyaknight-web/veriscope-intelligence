const board=(id,label,displayStatus,connected,gates)=>({
  id,label,displayStatus,connected,
  operationalUiEnabled:id==='core',
  gates:gates.map(([code,name,status,blocking=true])=>({code,name,status,blocking}))
});

const BOARDS=[
  board('core','VERISCOPE CORE','SHADOW / REVIEW',true,[
    ['core_runtime','CORE evidence runtime','CONNECTED',false],
    ['safeplate_adapter','SAFEPLATE reviewed bridge','CONNECTED',false],
    ['production_rbac','Production RBAC','NOT IMPLEMENTED'],
    ['external_audit_anchor','External audit anchor','NOT IMPLEMENTED'],
    ['institutional_acceptance','Institutional acceptance tests','PARTIAL']
  ]),
  board('defense','VERISCOPE DEFENSE','NOT CONNECTED',false,[
    ['public_catalog','Public-source catalog','AVAILABLE IN CORE',false],
    ['data_contract','Defense data contract','NOT IMPLEMENTED'],
    ['authorization','Authorization boundary','NOT IMPLEMENTED'],
    ['workflow_api','Mission workflow API','NOT IMPLEMENTED'],
    ['acceptance','Board acceptance tests','NOT IMPLEMENTED']
  ]),
  board('cyber','VERISCOPE CYBER','NOT CONNECTED',false,[
    ['public_catalog','CISA / NIST public catalog','AVAILABLE IN CORE',false],
    ['asset_inventory','Cyber asset inventory','NOT CONNECTED'],
    ['data_contract','Control-evidence contract','NOT IMPLEMENTED'],
    ['workflow_api','Incident workflow API','NOT IMPLEMENTED'],
    ['acceptance','Board acceptance tests','NOT IMPLEMENTED']
  ]),
  board('juris','VERISCOPE JURIS','NOT CONNECTED',false,[
    ['data_contract','Matter data contract','NOT IMPLEMENTED'],
    ['authorization','Privilege boundary','NOT IMPLEMENTED'],
    ['custody','Chain-of-custody store','NOT IMPLEMENTED'],
    ['workflow_api','Legal workflow API','NOT IMPLEMENTED'],
    ['acceptance','Board acceptance tests','NOT IMPLEMENTED']
  ])
];

export function getBoardRegistry(){
  return {
    schemaVersion:'veriscope.operating-boards.v1',
    activationPolicy:'SERVER_STATUS_PLUS_TESTED_UI_RELEASE',
    boards:BOARDS.map(item=>({...item,gates:item.gates.map(gate=>({...gate}))}))
  };
}

export function validateBoardRegistry(registry){
  const expected=['core','defense','cyber','juris'];
  const ids=registry?.boards?.map(item=>item.id)||[];
  const complete=expected.every(id=>ids.includes(id))&&ids.length===expected.length;
  const unsafe=registry?.boards?.filter(item=>item.connected&&!item.operationalUiEnabled)||[];
  return {valid:complete&&unsafe.length===0,complete,unsafeBoardIds:unsafe.map(item=>item.id)};
}
