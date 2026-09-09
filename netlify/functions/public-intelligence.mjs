const env=name=>globalThis.Netlify?.env?.get?.(name)||process.env[name];

const SOURCE_CATALOG=[
  {id:'nasa-gibs',domain:'earth',name:'NASA GIBS',status:'PUBLIC',kind:'IMAGERY',url:'https://www.earthdata.nasa.gov/engage/open-data-services-software/earthdata-developer-portal/gibs-api'},
  {id:'nasa-eonet',domain:'earth',name:'NASA EONET',status:'LIVE',kind:'EVENTS',url:'https://eonet.gsfc.nasa.gov/docs/v3'},
  {id:'nasa-firms',domain:'earth',name:'NASA FIRMS',status:env('NASA_FIRMS_MAP_KEY')?'CONFIGURED':'KEY_REQUIRED',kind:'FIRE',url:'https://firms.modaps.eosdis.nasa.gov/api/'},
  {id:'usgs-earthquakes',domain:'earth',name:'USGS Earthquakes',status:'LIVE',kind:'SEISMIC',url:'https://earthquake.usgs.gov/fdsnws/event/1/'},
  {id:'noaa-nws',domain:'weather',name:'NOAA / National Weather Service',status:'LIVE',kind:'ALERTS',url:'https://www.weather.gov/documentation/services-web-api'},
  {id:'noaa-climate',domain:'weather',name:'NOAA Climate Data Online',status:env('NOAA_CDO_TOKEN')?'CONFIGURED':'KEY_REQUIRED',kind:'CLIMATE',url:'https://www.ncdc.noaa.gov/cdo-web/webservices/getstarted'},
  {id:'usgs-water',domain:'northline',name:'USGS Water Data',status:'PUBLIC',kind:'WATER',url:'https://api.waterdata.usgs.gov/'},
  {id:'usace-cwms',domain:'land',name:'USACE CWMS',status:'PUBLIC',kind:'INFRASTRUCTURE',url:'https://cwms-data.usace.army.mil/cwms-data/'},
  {id:'openfema',domain:'land',name:'OpenFEMA',status:'PUBLIC',kind:'EMERGENCY',url:'https://www.fema.gov/about/openfema'},
  {id:'marinecadastre',domain:'maritime',name:'MarineCadastre AIS',status:'PUBLIC_DATASET',kind:'VESSEL_TRAFFIC',url:'https://hub.marinecadastre.gov/pages/vesseltraffic'},
  {id:'uscg-navcen',domain:'maritime',name:'USCG NAVCEN',status:'PUBLIC_SERVICE',kind:'NAVIGATION',url:'https://navcen.uscg.gov/'},
  {id:'noaa-erddap',domain:'maritime',name:'NOAA ERDDAP',status:'PUBLIC',kind:'OCEAN',url:'https://coastwatch.pfeg.noaa.gov/erddap/index.html'},
  {id:'aviation-weather',domain:'aviation',name:'AviationWeather.gov',status:'LIVE',kind:'SIGMET',url:'https://aviationweather.gov/data/api/'},
  {id:'openfda',domain:'safeplate',name:'FDA openFDA',status:'LIVE',kind:'RECALLS',url:'https://open.fda.gov/apis/food/enforcement/'},
  {id:'usda-fdc',domain:'safeplate',name:'USDA FoodData Central',status:env('USDA_FDC_API_KEY')?'CONFIGURED':'KEY_REQUIRED',kind:'PRODUCTS',url:'https://fdc.nal.usda.gov/api-guide.html'},
  {id:'usda-fsis',domain:'safeplate',name:'USDA FSIS',status:'PUBLIC_DATASET',kind:'RECALLS',url:'https://www.fsis.usda.gov/science-data/data-sets-visualizations'},
  {id:'cdc-nors',domain:'safeplate',name:'CDC NORS',status:'PUBLIC_DATASET',kind:'OUTBREAKS',url:'https://www.cdc.gov/nors/data/index.html'},
  {id:'open-food-facts',domain:'safeplate',name:'Open Food Facts',status:'PUBLIC',kind:'PRODUCTS',url:'https://openfoodfacts.github.io/'},
  {id:'usda-nass',domain:'trade',name:'USDA NASS Quick Stats',status:env('USDA_NASS_API_KEY')?'CONFIGURED':'KEY_REQUIRED',kind:'AGRICULTURE',url:'https://quickstats.nass.usda.gov/api'},
  {id:'usda-market-news',domain:'trade',name:'USDA Market News',status:env('USDA_MARKET_NEWS_API_KEY')?'CONFIGURED':'KEY_REQUIRED',kind:'COMMODITIES',url:'https://mymarketnews.ams.usda.gov/'},
  {id:'census-trade',domain:'trade',name:'U.S. Census International Trade',status:env('CENSUS_API_KEY')?'CONFIGURED':'KEY_REQUIRED',kind:'TRADE',url:'https://www.census.gov/data/developers/data-sets/international-trade.html'},
  {id:'un-comtrade',domain:'trade',name:'UN Comtrade',status:env('UN_COMTRADE_KEY')?'CONFIGURED':'KEY_REQUIRED',kind:'GLOBAL_TRADE',url:'https://comtradeapi.un.org/'},
  {id:'gleif',domain:'corporate',name:'GLEIF',status:'PUBLIC',kind:'LEGAL_ENTITIES',url:'https://www.gleif.org/en/lei-data/gleif-api'},
  {id:'sec-edgar',domain:'corporate',name:'SEC EDGAR',status:'PUBLIC',kind:'FILINGS',url:'https://www.sec.gov/search-filings/edgar-application-programming-interfaces'},
  {id:'ofac',domain:'corporate',name:'OFAC Sanctions List Service',status:'PUBLIC',kind:'SANCTIONS',url:'https://ofac.treasury.gov/sanctions-list-service'},
  {id:'world-bank',domain:'corporate',name:'World Bank',status:'PUBLIC',kind:'COUNTRY',url:'https://datahelpdesk.worldbank.org/knowledgebase/topics/125589-developer-information'},
  {id:'cisa-kev',domain:'cyber',name:'CISA KEV',status:'LIVE',kind:'EXPLOITED_VULNERABILITIES',url:'https://www.cisa.gov/known-exploited-vulnerabilities-catalog'},
  {id:'nist-nvd',domain:'cyber',name:'NIST NVD',status:env('NVD_API_KEY')?'CONFIGURED':'PUBLIC_RATE_LIMITED',kind:'VULNERABILITIES',url:'https://nvd.nist.gov/developers/vulnerabilities'},
  {id:'usaspending',domain:'land',name:'USAspending.gov',status:'PUBLIC',kind:'DEFENSE_CONTRACTS',url:'https://api.usaspending.gov/'},
  {id:'nces',domain:'northline',name:'NCES / Department of Education',status:'PUBLIC_DATASET',kind:'EDUCATION',url:'https://nces.ed.gov/datatools/'},
];

const safeText=value=>String(value??'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
const center=geometry=>{
  const coords=geometry?.coordinates;if(!Array.isArray(coords))return null;
  const drill=value=>Array.isArray(value)&&typeof value[0]==='number'?value:Array.isArray(value)?drill(value[0]):null;
  const point=drill(coords);return point&&Number.isFinite(point[0])&&Number.isFinite(point[1])?{lng:point[0],lat:point[1]}:null;
};
async function getJSON(url,options={}){
  const response=await fetch(url,{...options,signal:AbortSignal.timeout(6500),headers:{accept:'application/json','user-agent':'VERISCOPE-CORE/1.4 (https://veriscope-intelligence.netlify.app)',...(options.headers||{})}});
  if(!response.ok)throw new Error(`${response.status} ${response.statusText}`);return response.json();
}
const record=(input={})=>({id:String(input.id||crypto.randomUUID()),title:safeText(input.title)||'Untitled public record',detail:safeText(input.detail),source:safeText(input.source),sourceUrl:input.sourceUrl||null,observedAt:input.observedAt||null,severity:safeText(input.severity||'INFORMATIONAL').toUpperCase(),lat:Number.isFinite(Number(input.lat))?Number(input.lat):null,lng:Number.isFinite(Number(input.lng))?Number(input.lng):null,classification:'PUBLIC_SOURCE_RECORD',reviewStatus:'SOURCE_ONLY'});

async function earthRecords(){
  const [eonet,quakes]=await Promise.allSettled([
    getJSON('https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=35'),
    getJSON('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_month.geojson')
  ]),out=[];
  if(eonet.status==='fulfilled')for(const e of eonet.value.events||[]){const g=(e.geometry||[]).at(-1),p=center(g);out.push(record({id:`EONET-${e.id}`,title:e.title,detail:(e.categories||[]).map(x=>x.title).join(', '),source:'NASA EONET',sourceUrl:(e.sources||[])[0]?.url||e.link,observedAt:g?.date,severity:'WATCH',...p}))}
  if(quakes.status==='fulfilled')for(const f of quakes.value.features||[]){const p=center(f.geometry);out.push(record({id:`USGS-${f.id}`,title:f.properties?.title,detail:`Magnitude ${f.properties?.mag??'—'} · ${f.properties?.type||'earthquake'}`,source:'USGS Earthquake Hazards Program',sourceUrl:f.properties?.url,observedAt:f.properties?.time?new Date(f.properties.time).toISOString():null,severity:Number(f.properties?.mag)>=6?'HIGH':'WATCH',...p}))}
  return out;
}
async function weatherRecords(){
  const data=await getJSON('https://api.weather.gov/alerts/active?status=actual&message_type=alert');
  return (data.features||[]).slice(0,80).map(f=>{const p=center(f.geometry);return record({id:`NWS-${f.id}`,title:f.properties?.headline||f.properties?.event,detail:f.properties?.areaDesc,source:'NOAA National Weather Service',sourceUrl:f.properties?.web||f.properties?.uri||f.id,observedAt:f.properties?.sent,severity:f.properties?.severity||'WATCH',...p})});
}
async function foodRecords(){
  const data=await getJSON('https://api.fda.gov/food/enforcement.json?limit=50&sort=report_date:desc');
  return (data.results||[]).map((x,i)=>record({id:`FDA-${x.event_id||x.recall_number||i}`,title:x.product_description,detail:[x.recalling_firm,x.reason_for_recall,x.distribution_pattern].filter(Boolean).join(' · '),source:'FDA openFDA Food Enforcement',sourceUrl:'https://open.fda.gov/apis/food/enforcement/',observedAt:x.report_date,severity:x.classification||'RECALL'}));
}
async function cyberRecords(){
  const data=await getJSON('https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json');
  return (data.vulnerabilities||[]).slice(-80).reverse().map(x=>record({id:`CISA-${x.cveID}`,title:`${x.cveID} · ${x.vulnerabilityName}`,detail:[x.vendorProject,x.product,x.requiredAction].filter(Boolean).join(' · '),source:'CISA Known Exploited Vulnerabilities',sourceUrl:`https://nvd.nist.gov/vuln/detail/${encodeURIComponent(x.cveID)}`,observedAt:x.dateAdded,severity:x.knownRansomwareCampaignUse==='Known'?'HIGH':'ACTION'}));
}
async function aviationRecords(){
  const data=await getJSON('https://aviationweather.gov/api/data/isigmet?format=geojson');
  return (data.features||[]).slice(0,80).map((f,i)=>{const p=center(f.geometry);return record({id:`AWC-${f.id||i}`,title:f.properties?.hazard||f.properties?.rawSigmet||'Active SIGMET',detail:f.properties?.firName||f.properties?.qualifier||'Aviation weather advisory',source:'AviationWeather.gov',sourceUrl:'https://aviationweather.gov/',observedAt:f.properties?.issueTime||f.properties?.validTimeFrom,severity:'WATCH',...p})});
}
const LOADERS={earth:earthRecords,weather:weatherRecords,safeplate:foodRecords,cyber:cyberRecords,aviation:aviationRecords};

export default async req=>{
  if(req.method!=='GET')return Response.json({error:'METHOD_NOT_ALLOWED'},{status:405});
  const domain=(new URL(req.url).searchParams.get('domain')||'earth').toLowerCase();
  const sources=SOURCE_CATALOG.filter(x=>x.domain===domain),loader=LOADERS[domain];let records=[],error=null;
  if(loader)try{records=await loader()}catch(e){error=e instanceof Error?e.message:'SOURCE_UNAVAILABLE'}
  return Response.json({domain,status:error?'DEGRADED':loader?'LIVE':'CATALOG_ONLY',classification:'PUBLIC_SOURCE_DATA',notice:'Source records are displayed as source records. They are not VERISCOPE findings until normalized, correlated and reviewed.',sources,records,counts:{sources:sources.length,liveSources:sources.filter(x=>x.status==='LIVE').length,records:records.length,mappable:records.filter(x=>x.lat!==null&&x.lng!==null).length},error,retrievedAt:new Date().toISOString()},{headers:{'cache-control':'public, max-age=120, s-maxage=840, stale-while-revalidate=900','x-content-type-options':'nosniff'}});
};

export const config={path:'/api/public-intelligence'};
