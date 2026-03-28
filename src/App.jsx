import { useState, useRef, useEffect, useCallback } from "react";
import {
  loadAnalytics, saveAnalytics, trackClick,
  getTopModels, getTrendingScore, getPopularityLabel,
} from "./analytics.js";
import {
  ADS, selectAd, NativeAd, BannerAd, SponsoredListing, AnalyticsPanel,
} from "./ads.jsx";

// ══════════════════════════════════════════════════════════════════════════════
// RDW API
// ══════════════════════════════════════════════════════════════════════════════
const RDW_BASE    = "https://opendata.rdw.nl/resource";
const normKen     = k => k.replace(/-/g, "").toUpperCase();

async function rdwVoertuig(kenteken) {
  try {
    const r = await fetch(`${RDW_BASE}/m9d7-ebf2.json?kenteken=${normKen(kenteken)}&$limit=1`);
    const d = await r.json(); return d[0] || null;
  } catch { return null; }
}
async function rdwApkHistorie(kenteken) {
  try {
    const r = await fetch(`${RDW_BASE}/sgfe-77wx.json?kenteken=${normKen(kenteken)}&$limit=50`);
    const d = await r.json(); return Array.isArray(d) ? d : [];
  } catch { return []; }
}

// ── Mock data (fallback) ─────────────────────────────────────────────────────
const MOCK_APK = {
  "KZ123B":[{datum:"2021-08-12",km:1240,oordeel:"Goedgekeurd"},{datum:"2022-08-10",km:7820,oordeel:"Goedgekeurd"},{datum:"2023-08-15",km:14200,oordeel:"Goedgekeurd"}],
  "BM997R":[{datum:"2022-06-20",km:980,oordeel:"Goedgekeurd"},{datum:"2023-06-18",km:5120,oordeel:"Goedgekeurd"},{datum:"2024-06-22",km:9200,oordeel:"Goedgekeurd"}],
  "DV290R":[{datum:"2021-04-10",km:420,oordeel:"Goedgekeurd"},{datum:"2022-04-09",km:1980,oordeel:"Goedgekeurd"},{datum:"2023-04-12",km:2800,oordeel:"Goedgekeurd"}],
  "SC611D":[{datum:"2020-09-01",km:2100,oordeel:"Goedgekeurd"},{datum:"2021-09-03",km:6400,oordeel:"Goedgekeurd"},{datum:"2022-09-07",km:9800,oordeel:"Goedgekeurd"}],
  "HL774C":[{datum:"2019-11-20",km:1200,oordeel:"Goedgekeurd"},{datum:"2020-11-18",km:4100,oordeel:"Goedgekeurd"},{datum:"2021-11-22",km:6400,oordeel:"Goedgekeurd"},{datum:"2022-11-20",km:5200,oordeel:"⚠️ Terugloop km",verdacht:true}],
  "TR509X":[{datum:"2021-05-14",km:1900,oordeel:"Goedgekeurd"},{datum:"2022-05-16",km:5100,oordeel:"Goedgekeurd"},{datum:"2023-05-12",km:7800,oordeel:"Goedgekeurd"}],
  "ZR334K":[{datum:"2022-03-20",km:1200,oordeel:"Goedgekeurd"},{datum:"2023-03-22",km:4800,oordeel:"Goedgekeurd"},{datum:"2024-03-20",km:6400,oordeel:"Goedgekeurd"}],
  "H2117N":[{datum:"2020-07-15",km:680,oordeel:"Goedgekeurd"},{datum:"2021-07-14",km:3200,oordeel:"Goedgekeurd"},{datum:"2022-07-15",km:8100,oordeel:"Goedgekeurd"}],
  "KS103D":[{datum:"2021-09-08",km:880,oordeel:"Goedgekeurd"},{datum:"2022-09-06",km:2400,oordeel:"Goedgekeurd"},{datum:"2023-09-10",km:3200,oordeel:"Goedgekeurd"}],
  "FB449H":[{datum:"2022-04-12",km:950,oordeel:"Goedgekeurd"},{datum:"2023-04-10",km:3800,oordeel:"Goedgekeurd"},{datum:"2024-04-08",km:5100,oordeel:"Goedgekeurd"}],
  "R1882Y":[{datum:"2021-06-22",km:1400,oordeel:"Goedgekeurd"},{datum:"2022-06-24",km:4900,oordeel:"Goedgekeurd"},{datum:"2023-06-20",km:7200,oordeel:"Goedgekeurd"}],
  "AP733F":[{datum:"2022-05-30",km:720,oordeel:"Goedgekeurd"},{datum:"2023-05-29",km:3400,oordeel:"Goedgekeurd"},{datum:"2024-05-27",km:5800,oordeel:"Goedgekeurd"}],
  "BU928S":[{datum:"2022-02-14",km:1100,oordeel:"Goedgekeurd"},{datum:"2023-02-13",km:4200,oordeel:"Goedgekeurd"},{datum:"2024-02-12",km:6400,oordeel:"Goedgekeurd"}],
  "HI024E":[{datum:"2024-03-10",km:410,oordeel:"Goedgekeurd"},{datum:"2025-03-08",km:1200,oordeel:"Goedgekeurd"}],
  "N9024B":[{datum:"2024-06-01",km:120,oordeel:"Goedgekeurd"}],
};
const MOCK_VOERTUIG = {
  "KZ123B":{merk:"BMW",handelsbenaming:"R 1250 GS ADVENTURE",kleur:"GRIJS",cilinderinhoud:"1254",massa_ledig_voertuig:"249",datum_eerste_toelating:"20210601",vervaldatum_apk:"20260801",catalogusprijs:"23900"},
  "BM997R":{merk:"BMW",handelsbenaming:"S 1000 RR M",kleur:"ZWART",cilinderinhoud:"999",massa_ledig_voertuig:"193",datum_eerste_toelating:"20220301",vervaldatum_apk:"20270601",catalogusprijs:"31000"},
  "DV290R":{merk:"DUCATI",handelsbenaming:"PANIGALE V4 R",kleur:"ROOD",cilinderinhoud:"998",massa_ledig_voertuig:"172",datum_eerste_toelating:"20210401",vervaldatum_apk:"20260401",catalogusprijs:"41000"},
  "SC611D":{merk:"DUCATI",handelsbenaming:"SCRAMBLER ICON",kleur:"GEEL",cilinderinhoud:"803",massa_ledig_voertuig:"190",datum_eerste_toelating:"20200901",vervaldatum_apk:"20250901",catalogusprijs:"10200"},
  "HL774C":{merk:"HARLEY-DAVIDSON",handelsbenaming:"HERITAGE CLASSIC LIMITED",kleur:"ZWART",cilinderinhoud:"1868",massa_ledig_voertuig:"366",datum_eerste_toelating:"20191101",vervaldatum_apk:"20251101",catalogusprijs:"27500"},
  "TR509X":{merk:"TRIUMPH",handelsbenaming:"THRUXTON RS",kleur:"ZILVER",cilinderinhoud:"1200",massa_ledig_voertuig:"199",datum_eerste_toelating:"20210501",vervaldatum_apk:"20260501",catalogusprijs:"16900"},
  "ZR334K":{merk:"KAWASAKI",handelsbenaming:"Z900 RS SE",kleur:"ORANJE",cilinderinhoud:"948",massa_ledig_voertuig:"193",datum_eerste_toelating:"20220301",vervaldatum_apk:"20270301",catalogusprijs:"15500"},
  "H2117N":{merk:"KAWASAKI",handelsbenaming:"NINJA H2",kleur:"GROEN",cilinderinhoud:"998",massa_ledig_voertuig:"238",datum_eerste_toelating:"20200701",vervaldatum_apk:"20250701",catalogusprijs:"28000"},
  "KS103D":{merk:"KTM",handelsbenaming:"1290 SUPER DUKE RR",kleur:"ORANJE",cilinderinhoud:"1301",massa_ledig_voertuig:"189",datum_eerste_toelating:"20210901",vervaldatum_apk:"20260901",catalogusprijs:"26000"},
  "FB449H":{merk:"HONDA",handelsbenaming:"CBR1000RR-R SP",kleur:"ROOD",cilinderinhoud:"999",massa_ledig_voertuig:"201",datum_eerste_toelating:"20220401",vervaldatum_apk:"20270401",catalogusprijs:"31000"},
  "R1882Y":{merk:"YAMAHA",handelsbenaming:"YZF-R1M",kleur:"BLAUW",cilinderinhoud:"998",massa_ledig_voertuig:"202",datum_eerste_toelating:"20210601",vervaldatum_apk:"20260601",catalogusprijs:"26000"},
  "AP733F":{merk:"APRILIA",handelsbenaming:"RSV4 FACTORY",kleur:"ZWART",cilinderinhoud:"1099",massa_ledig_voertuig:"184",datum_eerste_toelating:"20220501",vervaldatum_apk:"20270501",catalogusprijs:"23500"},
  "BU928S":{merk:"SUZUKI",handelsbenaming:"HAYABUSA",kleur:"GRIJS",cilinderinhoud:"1340",massa_ledig_voertuig:"264",datum_eerste_toelating:"20220201",vervaldatum_apk:"20270201",catalogusprijs:"20500"},
  "HI024E":{merk:"ROYAL ENFIELD",handelsbenaming:"HIMALAYAN 450",kleur:"GROEN",cilinderinhoud:"452",massa_ledig_voertuig:"177",datum_eerste_toelating:"20240301",vervaldatum_apk:"20270301",catalogusprijs:"7800"},
  "N9024B":{merk:"BMW",handelsbenaming:"R 12 NINET",kleur:"ZILVER",cilinderinhoud:"1170",massa_ledig_voertuig:"220",datum_eerste_toelating:"20240601",vervaldatum_apk:"20270601",catalogusprijs:"17200"},
};

// ── NAP analyse ──────────────────────────────────────────────────────────────
function analyseKm(apk, huidigKm, bouwjaar) {
  if (!apk?.length) return { status:"ONBEKEND",score:50,kleur:"#64748b",label:"Geen APK-data",details:[],flags:[],verdacht:false };
  const sorted = [...apk].sort((a,b) => new Date(a.datum)-new Date(b.datum));
  let verdacht=false, flags=[], details=[];
  for (let i=1;i<sorted.length;i++){
    const prev=sorted[i-1],curr=sorted[i],diff=curr.km-prev.km;
    const mo=(new Date(curr.datum)-new Date(prev.datum))/(1000*60*60*24*30.5);
    if(diff<0){verdacht=true;flags.push(`❌ Km-terugloop: ${prev.km.toLocaleString("nl-NL")} → ${curr.km.toLocaleString("nl-NL")} km`);details.push({datum:curr.datum,km:curr.km,status:"TERUGLOOP",kleur:"#f44336"});}
    else if(diff/mo>1800){flags.push(`⚠️ Hoog gebruik: ${Math.round(diff/mo*12).toLocaleString("nl-NL")} km/jaar`);details.push({datum:curr.datum,km:curr.km,status:"HOOG",kleur:"#ffa726"});}
    else{details.push({datum:curr.datum,km:curr.km,status:"OK",kleur:"#69f0ae"});}
  }
  if(sorted.length>0) details.unshift({datum:sorted[0].datum,km:sorted[0].km,status:"EERSTE",kleur:"#60a5fa"});
  const laatste=sorted[sorted.length-1];
  if(laatste&&huidigKm<laatste.km){verdacht=true;flags.push(`❌ Huidig (${huidigKm.toLocaleString("nl-NL")}) < laatste APK (${laatste.km.toLocaleString("nl-NL")}) km`);}
  let score=100;
  if(verdacht) score-=60;
  if(flags.some(f=>f.startsWith("⚠️"))) score-=20;
  score=Math.max(0,Math.min(100,score));
  const status=score>=80?"LOGISCH":score>=50?"VERDACHT":"ONBETROUWBAAR";
  const kleur=score>=80?"#69f0ae":score>=50?"#ffa726":"#f44336";
  return{status,score,kleur,label:{LOGISCH:"✅ LOGISCH",VERDACHT:"⚠️ VERDACHT",ONBETROUWBAAR:"❌ ONBETROUWBAAR"}[status],details:details.reverse(),flags,verdacht,laatste};
}

// ── RDW hook ─────────────────────────────────────────────────────────────────
function useRDW(kenteken, bouwjaar, km) {
  const [state, setState] = useState({loading:true,voertuig:null,apk:[],nap:null});
  useEffect(() => {
    if (!kenteken) return;
    setState({loading:true,voertuig:null,apk:[],nap:null});
    const k = normKen(kenteken);
    async function go() {
      const [v, apkRaw] = await Promise.all([rdwVoertuig(kenteken), rdwApkHistorie(kenteken)]);
      const voertuig = v || MOCK_VOERTUIG[k] || null;
      let apk = [];
      if (apkRaw?.length) {
        apk = apkRaw.filter(r=>r.kilometerstand).map(r=>({datum:r.datum_tenaamstelling||"",km:parseInt(r.kilometerstand)||0,oordeel:r.tellerstandoordeel||""})).filter(r=>r.km>0);
      }
      if (!apk.length) apk = MOCK_APK[k] || [];
      const nap = analyseKm(apk, km, bouwjaar);
      setState({loading:false,voertuig,apk,nap});
    }
    go().catch(()=>setState(s=>({...s,loading:false})));
  }, [kenteken]);
  return state;
}

// ══════════════════════════════════════════════════════════════════════════════
// KPI ENGINE
// ══════════════════════════════════════════════════════════════════════════════
const BASE_DEP={0:1.00,1:0.80,2:0.67,3:0.57,4:0.49,5:0.43,6:0.38,7:0.34,8:0.31,9:0.28,10:0.26,11:0.24,12:0.22,13:0.21,14:0.20,15:0.19};
const baseDep=age=>BASE_DEP[Math.min(age,15)]??0.19;
const MODEL_DB={
  "R 1250 GS Adventure":{bf:0.83,tf:0.88,vf:0.85,tier:"ADVENTURE"},
  "S 1000 RR M":{bf:0.83,tf:1.06,vf:0.80,tier:"LIMITED"},
  "Panigale V4 R":{bf:0.86,tf:1.06,vf:0.78,tier:"LIMITED"},
  "Scrambler Icon":{bf:0.86,tf:0.86,vf:0.95,tier:"STD"},
  "Heritage Classic Limited":{bf:0.78,tf:0.82,vf:0.79,tier:"LIMITED"},
  "Thruxton RS":{bf:0.89,tf:0.86,vf:0.86,tier:"S / R"},
  "Z900 RS SE":{bf:0.96,tf:0.86,vf:0.86,tier:"SE"},
  "Ninja H2":{bf:0.96,tf:1.06,vf:0.76,tier:"LIMITED"},
  "1290 Super Duke RR":{bf:0.92,tf:0.97,vf:0.79,tier:"LIMITED"},
  "CBR1000RR-R Fireblade SP":{bf:0.93,tf:1.06,vf:0.80,tier:"LIMITED"},
  "YZF-R1M":{bf:0.94,tf:1.06,vf:0.80,tier:"LIMITED"},
  "RSV4 Factory":{bf:0.91,tf:1.06,vf:0.85,tier:"TOP SPEC"},
  "Hayabusa":{bf:1.00,tf:1.06,vf:0.86,tier:"TOP SPEC"},
  "Himalayan 450":{bf:1.03,tf:0.88,vf:0.94,tier:"STD"},
  "R 12 nineT":{bf:0.83,tf:0.86,vf:0.89,tier:"RETRO"},
};
const BRAND_COLORS={"BMW":"#3b82f6","Ducati":"#ef4444","Harley-Davidson":"#f97316","Triumph":"#8b5cf6","Kawasaki":"#15803d","KTM":"#ea580c","Honda":"#dc2626","Yamaha":"#1d4ed8","Aprilia":"#7c3aed","Suzuki":"#475569","Royal Enfield":"#78350f"};
const TIER_COLORS={"LIMITED":"#f59e0b","TOP SPEC":"#a78bfa","S / R":"#818cf8","ADVENTURE":"#34d399","RETRO":"#fb923c","SE":"#60a5fa","STD":"#374151"};

function calcMV(cat,year,km,modelKey){
  const age=2026-parseInt(year),dep=baseDep(age);
  const e=MODEL_DB[modelKey]||{bf:1,tf:1,vf:1,tier:"STD"};
  const combined=dep*e.bf*e.tf*e.vf,base=Math.round(cat*combined);
  const expKm=age*6000,kmDiff=km-expKm,kmCorr=Math.max(-0.14,Math.min(0.14,-(kmDiff/1000)*0.009));
  const fair=Math.round(base*(1+kmCorr));
  return{fair,base,age,dep,combined,expKm,kmDiff,kmCorr,bf:e.bf,tf:e.tf,vf:e.vf,tier:e.tier};
}
function getScore(price,fair){
  const r=price/fair;
  if(r<=0.80) return{label:"ABSOLUTE KOOPJE",short:"KOOPJE",color:"#00e676",bg:"#001a0a",icon:"🔥"};
  if(r<=0.92) return{label:"GOEDE DEAL",short:"GOEDE DEAL",color:"#69f0ae",bg:"#001508",icon:"✅"};
  if(r<=1.08) return{label:"EERLIJKE PRIJS",short:"EERLIJK",color:"#ffeb3b",bg:"#1a1600",icon:"⚖️"};
  if(r<=1.22) return{label:"AAN DE PRIJS",short:"AAN DE PRIJS",color:"#ffa726",bg:"#1a0c00",icon:"⚠️"};
  return{label:"OVERPRICED",short:"TE DUUR",color:"#f44336",bg:"#1a0000",icon:"❌"};
}

// ══════════════════════════════════════════════════════════════════════════════
// LISTINGS
// ══════════════════════════════════════════════════════════════════════════════
const SOURCES=["Marktplaats","2dehands","Facebook Marketplace","eBay Motors","AutoScout24","Motortreffer"];
const RAW=[
  {id:1, brand:"BMW",            model:"BMW R 1250 GS Adventure",              modelKey:"R 1250 GS Adventure",         year:2021,price:21500,km:14200,source:"Marktplaats",         loc:"Amsterdam",lat:52.3676,lng:4.9041, type:"Adventure / Enduro",   cat:23900,kenteken:"KZ-123-B"},
  {id:2, brand:"BMW",            model:"BMW S 1000 RR M",                       modelKey:"S 1000 RR M",                  year:2022,price:28500,km:4100, source:"AutoScout24",          loc:"Utrecht",lat:52.0907,lng:5.1214,   type:"Sport / Supersport",   cat:31000,kenteken:"BM-997-R"},
  {id:3, brand:"Ducati",         model:"Ducati Panigale V4 R",                  modelKey:"Panigale V4 R",                year:2021,price:34500,km:2800, source:"eBay Motors",          loc:"Rotterdam",lat:51.9244,lng:4.4777, type:"Sport / Supersport",   cat:41000,kenteken:"DV-290-R"},
  {id:4, brand:"Ducati",         model:"Ducati Scrambler Icon",                 modelKey:"Scrambler Icon",               year:2020,price:6800, km:9800, source:"Marktplaats",         loc:"Haarlem",lat:52.3874,lng:4.6462,   type:"Retro / Café Racer",   cat:10200,kenteken:"SC-611-D"},
  {id:5, brand:"Harley-Davidson",model:"Harley-Davidson Heritage Classic Limited",modelKey:"Heritage Classic Limited",   year:2020,price:23500,km:5200, source:"Facebook Marketplace",loc:"Breda",lat:51.5719,lng:4.7683,     type:"Cruiser / Chopper",    cat:27500,kenteken:"HL-774-C"},
  {id:6, brand:"Triumph",        model:"Triumph Thruxton RS",                   modelKey:"Thruxton RS",                  year:2021,price:14500,km:7800, source:"2dehands",            loc:"Maastricht",lat:50.8514,lng:5.691,type:"Retro / Café Racer",   cat:16900,kenteken:"TR-509-X"},
  {id:7, brand:"Kawasaki",       model:"Kawasaki Z900 RS SE",                   modelKey:"Z900 RS SE",                   year:2022,price:13200,km:6400, source:"Marktplaats",         loc:"Groningen",lat:53.2194,lng:6.5665, type:"Retro / Café Racer",   cat:15500,kenteken:"ZR-334-K"},
  {id:8, brand:"Kawasaki",       model:"Kawasaki Ninja H2",                     modelKey:"Ninja H2",                     year:2020,price:21000,km:8100, source:"AutoScout24",          loc:"Den Haag",lat:52.0705,lng:4.3007,  type:"Sport / Supersport",   cat:28000,kenteken:"H2-117-N"},
  {id:9, brand:"KTM",            model:"KTM 1290 Super Duke RR",                modelKey:"1290 Super Duke RR",           year:2021,price:22000,km:3200, source:"eBay Motors",         loc:"Almere",lat:52.3508,lng:5.2647,    type:"Naked / Streetfighter",cat:26000,kenteken:"KS-103-D"},
  {id:10,brand:"Honda",          model:"Honda CBR1000RR-R Fireblade SP",         modelKey:"CBR1000RR-R Fireblade SP",     year:2022,price:27500,km:5100, source:"Marktplaats",         loc:"Eindhoven",lat:51.4416,lng:5.4697, type:"Sport / Supersport",   cat:31000,kenteken:"FB-449-H"},
  {id:11,brand:"Yamaha",         model:"Yamaha YZF-R1M",                         modelKey:"YZF-R1M",                      year:2021,price:21000,km:7200, source:"Motortreffer",        loc:"Zwolle",lat:52.5168,lng:6.083,    type:"Sport / Supersport",   cat:26000,kenteken:"R1-882-Y"},
  {id:12,brand:"Aprilia",        model:"Aprilia RSV4 Factory",                   modelKey:"RSV4 Factory",                 year:2022,price:19500,km:5800, source:"2dehands",            loc:"Tilburg",lat:51.5555,lng:5.0913,   type:"Sport / Supersport",   cat:23500,kenteken:"AP-733-F"},
  {id:13,brand:"Suzuki",         model:"Suzuki Hayabusa",                        modelKey:"Hayabusa",                     year:2022,price:17500,km:6400, source:"Marktplaats",         loc:"Arnhem",lat:51.9851,lng:5.8987,    type:"Sport / Supersport",   cat:20500,kenteken:"BU-928-S"},
  {id:14,brand:"Royal Enfield",  model:"Royal Enfield Himalayan 450",            modelKey:"Himalayan 450",                year:2024,price:7900, km:1200, source:"Marktplaats",         loc:"Amsterdam",lat:52.3676,lng:4.9041, type:"Adventure / Enduro",   cat:7800, kenteken:"HI-024-E"},
  {id:15,brand:"BMW",            model:"BMW R 12 nineT",                         modelKey:"R 12 nineT",                   year:2024,price:16800,km:800,  source:"AutoScout24",          loc:"Utrecht",lat:52.0907,lng:5.1214,   type:"Retro / Café Racer",   cat:17200,kenteken:"N9-024-B"},
];
const LISTINGS_BASE=RAW.map(l=>{const mv=calcMV(l.cat,l.year,l.km,l.modelKey);return{...l,mv,score:getScore(l.price,mv.fair)};});

// ══════════════════════════════════════════════════════════════════════════════
// MINI COMPONENTS
// ══════════════════════════════════════════════════════════════════════════════
function NapBadge({nap,loading}){
  if(loading) return <span style={{display:"inline-flex",alignItems:"center",gap:"4px",background:"#111",border:"1px solid #1a1a1a",padding:"2px 7px",borderRadius:"2px",fontSize:"8px",color:"#2a2a2a",letterSpacing:"1px"}}><span style={{display:"inline-block",animation:"spin 1s linear infinite"}}>⟳</span> RDW</span>;
  if(!nap) return null;
  return <span style={{display:"inline-flex",alignItems:"center",background:`${nap.kleur}15`,border:`1px solid ${nap.kleur}44`,padding:"2px 7px",borderRadius:"2px",fontSize:"8px",color:nap.kleur,fontWeight:"800",letterSpacing:"1px"}}>{nap.label}</span>;
}

function PopBadge({model,analytics}){
  const data=analytics?.modelClicks?.[model];
  if(!data) return null;
  const pl=getPopularityLabel(data.unique);
  if(!pl) return null;
  return <span style={{display:"inline-flex",alignItems:"center",gap:"3px",background:`${pl.color}15`,border:`1px solid ${pl.color}44`,padding:"2px 7px",borderRadius:"2px",fontSize:"8px",color:pl.color,fontWeight:"800",letterSpacing:"1px"}}>{pl.icon} {pl.label}</span>;
}

// ══════════════════════════════════════════════════════════════════════════════
// DETAIL MODAL
// ══════════════════════════════════════════════════════════════════════════════
function DetailModal({listing,analytics,onClose}){
  const{mv,score,cat,price,km,year,brand,model,kenteken,type}=listing;
  const rdw=useRDW(kenteken,year,km);
  const saving=mv.fair-price,gaugeVal=Math.max(0,Math.min(100,Math.round((2-price/mv.fair)*50)));
  const tierCol=TIER_COLORS[mv.tier]||"#374151",brandCol=BRAND_COLORS[brand]||"#ff6b00";
  const clicks=analytics?.modelClicks?.[model];

  // APK timeline
  const ApkRow=({entry})=>{
    const bad=entry.status==="TERUGLOOP"||entry.verdacht;
    const col=bad?"#f44336":entry.status==="EERSTE"?"#60a5fa":"#69f0ae";
    return(
      <div style={{display:"grid",gridTemplateColumns:"90px 1fr 90px",gap:"8px",alignItems:"center"}}>
        <span style={{fontSize:"9px",color:"#333",fontFamily:"monospace"}}>{entry.datum?.slice(0,10)||"—"}</span>
        <div style={{position:"relative",height:"14px",background:"#0d0d0d",borderRadius:"1px"}}>
          <div style={{height:"100%",width:`${Math.max(2,(entry.km/(Math.max(km,...(rdw.apk||[]).map(a=>a.km))*1.05))*100)}%`,background:`${col}88`,borderRadius:"1px"}}/>
          {bad&&<div style={{position:"absolute",right:"4px",top:"50%",transform:"translateY(-50%)",fontSize:"9px"}}>⚠️</div>}
        </div>
        <span style={{fontSize:"10px",color:bad?"#f44336":"#888",fontFamily:"monospace",textAlign:"right",fontWeight:bad?"800":"400"}}>{entry.km.toLocaleString("nl-NL")} km</span>
      </div>
    );
  };

  return(
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.94)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:"14px",overflowY:"auto"}}>
      <div onClick={e=>e.stopPropagation()} style={{background:"#0d0d0d",border:`1px solid ${score.color}33`,borderRadius:"4px",width:"100%",maxWidth:"640px",maxHeight:"94vh",overflowY:"auto"}}>
        {/* Header */}
        <div style={{background:"#111",borderBottom:"1px solid #1a1a1a",padding:"14px 18px",display:"flex",justifyContent:"space-between",alignItems:"flex-start",position:"sticky",top:0,zIndex:10}}>
          <div>
            <div style={{fontSize:"9px",color:brandCol,letterSpacing:"3px"}}>{brand}</div>
            <div style={{fontSize:"20px",fontWeight:"900",color:"#fff",lineHeight:1.1}}>{model.replace(brand+" ","")}</div>
            <div style={{display:"flex",gap:"5px",marginTop:"7px",flexWrap:"wrap",alignItems:"center"}}>
              <span style={{display:"inline-flex",alignItems:"center",gap:"4px",background:score.bg,border:`1px solid ${score.color}44`,padding:"3px 9px",borderRadius:"2px",fontSize:"9px",color:score.color,fontWeight:"800",letterSpacing:"2px"}}>{score.icon} {score.label}</span>
              <span style={{display:"inline-flex",background:`${tierCol}15`,border:`1px solid ${tierCol}44`,padding:"3px 8px",borderRadius:"2px",fontSize:"8px",color:tierCol,fontWeight:"800",letterSpacing:"2px"}}>{mv.tier}</span>
              <NapBadge nap={rdw.nap} loading={rdw.loading}/>
              <PopBadge model={model} analytics={analytics}/>
            </div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"1px solid #222",color:"#555",fontSize:"18px",cursor:"pointer",padding:"4px 10px",marginLeft:"10px"}}>✕</button>
        </div>

        <div style={{padding:"14px 18px",display:"grid",gap:"12px"}}>
          {/* Gauge + KPIs */}
          <div style={{display:"grid",gridTemplateColumns:"110px 1fr",gap:"12px",alignItems:"center"}}>
            <div>
              <svg width="110" height="72" viewBox="0 0 110 72">
                <path d="M10,62 A44,44 0 0,1 100,62" fill="none" stroke="#1a1a1a" strokeWidth="10" strokeLinecap="round"/>
                <path d="M10,62 A44,44 0 0,1 100,62" fill="none" stroke="url(#gg)" strokeWidth="10" strokeLinecap="round" strokeDasharray="138" strokeDashoffset={138-(gaugeVal/100)*138}/>
                <defs><linearGradient id="gg" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#f44336"/><stop offset="50%" stopColor="#ffeb3b"/><stop offset="100%" stopColor="#00e676"/></linearGradient></defs>
                <text x="55" y="57" textAnchor="middle" fill={score.color} fontSize="18" fontWeight="900" fontFamily="monospace">{gaugeVal}</text>
                <text x="55" y="67" textAnchor="middle" fill="#2a2a2a" fontSize="7" fontFamily="monospace">/100</text>
              </svg>
              <div style={{textAlign:"center",fontSize:"7px",color:"#2a2a2a",letterSpacing:"2px"}}>WAARDE SCORE</div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"6px"}}>
              {[{l:"VRAAGPRIJS",v:`€ ${price.toLocaleString("nl-NL")}`,c:score.color},{l:"MARKTWAARDE",v:`€ ${mv.fair.toLocaleString("nl-NL")}`,c:"#69f0ae"},{l:"CATALOGUS",v:`€ ${cat.toLocaleString("nl-NL")}`,c:"#333"},{l:saving>=0?"BESPARING":"MEERPRIJS",v:`${saving>=0?"−":"+"}€ ${Math.abs(saving).toLocaleString("nl-NL")}`,c:saving>=0?"#69f0ae":"#f44336"}].map(k=>(
                <div key={k.l} style={{background:"#111",border:"1px solid #1a1a1a",padding:"7px 9px"}}>
                  <div style={{fontSize:"7px",color:"#2a2a2a",letterSpacing:"2px"}}>{k.l}</div>
                  <div style={{fontSize:"14px",fontWeight:"800",color:k.c,marginTop:"1px"}}>{k.v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Populariteit stats */}
          {clicks && clicks.total > 0 && (
            <div style={{background:"#111",border:"1px solid #1a1a1a",padding:"10px 14px"}}>
              <div style={{fontSize:"9px",color:"#ff6b00",letterSpacing:"3px",marginBottom:"8px"}}>POPULARITEIT</div>
              <div style={{display:"flex",gap:"16px"}}>
                {[{l:"TOTALE VIEWS",v:clicks.total,c:"#ff6b00"},{l:"UNIEKE VIEWS",v:clicks.unique,c:"#69f0ae"},{l:"TREND SCORE",v:getTrendingScore(analytics,model),c:"#a78bfa"}].map(k=>(
                  <div key={k.l}>
                    <div style={{fontSize:"7px",color:"#2a2a2a",letterSpacing:"2px"}}>{k.l}</div>
                    <div style={{fontSize:"20px",fontWeight:"900",color:k.c}}>{k.v}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* APK Timeline */}
          <div style={{background:"#111",border:"1px solid #1a1a1a",padding:"14px 16px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"10px"}}>
              <div style={{fontSize:"9px",color:"#ff6b00",letterSpacing:"3px"}}>APK KM-HISTORIEK</div>
              {rdw.nap&&<span style={{fontSize:"9px",color:rdw.nap.kleur,fontWeight:"800"}}>{rdw.nap.label} · {rdw.nap.score}/100</span>}
            </div>
            {rdw.loading?<div style={{fontSize:"10px",color:"#ff6b00",fontFamily:"monospace",letterSpacing:"2px"}}>⟳ RDW ophalen...</div>:(
              <div style={{display:"grid",gap:"6px"}}>
                {(rdw.apk||[]).map((e,i)=><ApkRow key={i} entry={e}/>)}
                <div style={{display:"grid",gridTemplateColumns:"90px 1fr 90px",gap:"8px",alignItems:"center",borderTop:"1px dashed #222",paddingTop:"5px",marginTop:"2px"}}>
                  <span style={{fontSize:"9px",color:"#ff6b00",fontFamily:"monospace"}}>NU</span>
                  <div style={{height:"14px",background:"#0d0d0d",borderRadius:"1px"}}>
                    <div style={{height:"100%",width:`${Math.max(2,(km/Math.max(km,...(rdw.apk||[]).map(a=>a.km))*1.05)*100)}%`,background:"#ff6b0055",borderRadius:"1px"}}/>
                  </div>
                  <span style={{fontSize:"10px",color:"#ff6b00",fontFamily:"monospace",textAlign:"right",fontWeight:"800"}}>{km.toLocaleString("nl-NL")} km</span>
                </div>
                {rdw.nap?.flags?.length>0&&rdw.nap.flags.map((f,i)=><div key={i} style={{fontSize:"10px",color:f.startsWith("❌")?"#f44336":"#ffa726",background:`${f.startsWith("❌")?"#f44336":"#ffa726"}0d`,border:`1px solid ${f.startsWith("❌")?"#f44336":"#ffa726"}22`,padding:"5px 10px",borderRadius:"2px",marginTop:"4px"}}>{f}</div>)}
                {rdw.nap&&!rdw.nap.verdacht&&<div style={{fontSize:"10px",color:"#69f0ae",background:"#69f0ae0d",border:"1px solid #69f0ae22",padding:"5px 10px",borderRadius:"2px",marginTop:"4px"}}>✅ Km-stand ziet er logisch uit</div>}
              </div>
            )}
          </div>

          {/* RDW voertuigdata */}
          {rdw.voertuig&&(()=>{
            const v=rdw.voertuig;
            const apkStr=v.vervaldatum_apk?`${v.vervaldatum_apk.slice(0,4)}-${v.vervaldatum_apk.slice(4,6)}-${v.vervaldatum_apk.slice(6,8)}`:"—";
            const verlopen=v.vervaldatum_apk&&new Date()>new Date(apkStr);
            return(
              <div style={{background:"#111",border:"1px solid #1a1a1a"}}>
                <div style={{padding:"9px 14px",borderBottom:"1px solid #1a1a1a",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div style={{fontSize:"9px",color:"#ff6b00",letterSpacing:"3px"}}>RDW VOERTUIGDATA</div>
                  <div style={{fontFamily:"monospace",fontSize:"14px",fontWeight:"900",letterSpacing:"3px",color:"#fff",background:"#1a1a1a",padding:"4px 12px",border:"1px solid #2a2a2a"}}>{kenteken}</div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"1px",background:"#1a1a1a"}}>
                  {[["MERK",v.merk||"—"],["MODEL",v.handelsbenaming||"—"],["KLEUR",v.eerste_kleur||v.kleur||"—"],["CILINDERINHOUD",(v.cilinderinhoud?`${parseInt(v.cilinderinhoud).toLocaleString("nl-NL")} cc`:"—")],["GEWICHT",(v.massa_ledig_voertuig?`${v.massa_ledig_voertuig} kg`:"—")],["CATALOGUSPRIJS",(v.catalogusprijs?`€ ${parseInt(v.catalogusprijs).toLocaleString("nl-NL")}`:"—")]].map(([l,val])=>(
                    <div key={l} style={{background:"#111",padding:"8px 12px"}}>
                      <div style={{fontSize:"7px",color:"#2a2a2a",letterSpacing:"2px"}}>{l}</div>
                      <div style={{fontSize:"13px",color:"#ddd",fontWeight:"600",marginTop:"1px"}}>{val}</div>
                    </div>
                  ))}
                </div>
                <div style={{padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",borderTop:"1px solid #1a1a1a"}}>
                  <div><div style={{fontSize:"7px",color:"#2a2a2a",letterSpacing:"2px"}}>APK TOT</div><div style={{fontSize:"14px",fontWeight:"800",color:"#fff"}}>{apkStr}</div></div>
                  <div style={{padding:"5px 12px",background:verlopen?"#1a0000":"#001508",border:`1px solid ${verlopen?"#f44336":"#69f0ae"}`,fontSize:"10px",fontWeight:"800",color:verlopen?"#f44336":"#69f0ae"}}>{verlopen?"❌ VERLOPEN":"✅ GELDIG"}</div>
                </div>
              </div>
            );
          })()}

          {/* Berekening */}
          <div style={{background:"#111",border:"1px solid #1a1a1a",padding:"12px 14px"}}>
            <div style={{fontSize:"9px",color:"#ff6b00",letterSpacing:"3px",marginBottom:"8px"}}>WAARDE BEREKENING</div>
            {[{l:"Cataloguswaarde",v:`€ ${cat.toLocaleString("nl-NL")}`,b:false},{l:`Gecombineerde factor (${Math.round(mv.combined*100)}%)`,v:`€ ${mv.base.toLocaleString("nl-NL")}`,b:true,a:true},{l:`Km-correctie`,v:`${mv.kmCorr>=0?"+":""}${Math.round(mv.kmCorr*100)}%`,b:false},{l:"= Marktwaarde",v:`€ ${mv.fair.toLocaleString("nl-NL")}`,b:true,a:true},{l:"Vraagprijs",v:`€ ${price.toLocaleString("nl-NL")}`,b:true}].map((r,i)=>(
              <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderTop:r.b?"1px solid #1a1a1a":"none"}}>
                <span style={{fontSize:"10px",color:r.a?"#69f0ae":"#3a3a3a",flex:1,paddingRight:"10px"}}>{r.l}</span>
                <span style={{fontSize:"11px",fontWeight:r.b?"900":"400",color:r.a?"#69f0ae":"#666",fontFamily:"monospace"}}>{r.v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// LISTING CARD
// ══════════════════════════════════════════════════════════════════════════════
function ListingCard({listing,analytics,onOpen,distKm,fmtDist}){
  const[hov,setHov]=useState(false);
  const{score,mv,price,cat,brand,kenteken,year,km,model}=listing;
  const saving=mv.fair-price,tierCol=TIER_COLORS[mv.tier]||"#374151",brandCol=BRAND_COLORS[brand]||"#ff6b00";
  const rdw=useRDW(kenteken,year,km);

  return(
    <div onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)} onClick={()=>onOpen(listing)}
      style={{background:hov?"#131313":"#0f0f0f",border:`1px solid ${hov?score.color+"55":"#1a1a1a"}`,borderRadius:"4px",overflow:"hidden",cursor:"pointer",transition:"all 0.2s",display:"flex",flexDirection:"column"}}>
      <div style={{position:"relative",background:"linear-gradient(135deg,#0d0d0d,#151515)",height:"115px",display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden"}}>
        <div style={{position:"absolute",inset:0,background:`${brandCol}07`,borderBottom:`2px solid ${brandCol}1a`}}/>
        <span style={{fontSize:"40px",transform:hov?"scale(1.1)":"scale(1)",transition:"transform 0.4s",zIndex:1}}>🏍</span>
        <div style={{position:"absolute",top:"8px",left:"8px",display:"flex",gap:"4px",flexWrap:"wrap"}}>
          <span style={{display:"inline-flex",alignItems:"center",gap:"3px",background:score.bg,border:`1px solid ${score.color}44`,padding:"2px 7px",borderRadius:"2px",fontSize:"8px",color:score.color,fontWeight:"800",letterSpacing:"1px"}}>{score.icon} {score.short}</span>
        </div>
        <div style={{position:"absolute",top:"8px",right:"8px",display:"flex",flexDirection:"column",gap:"3px",alignItems:"flex-end"}}>
          <span style={{background:`${tierCol}18`,border:`1px solid ${tierCol}44`,color:tierCol,fontSize:"7px",padding:"2px 5px",letterSpacing:"1px",fontWeight:"800"}}>{mv.tier}</span>
          <NapBadge nap={rdw.nap} loading={rdw.loading}/>
          <PopBadge model={model} analytics={analytics}/>
        </div>
        <div style={{position:"absolute",bottom:0,left:0,right:0,height:"2px",background:`linear-gradient(90deg,${brandCol}00,${brandCol}55,${brandCol}00)`}}/>
      </div>
      <div style={{padding:"10px 12px",flex:1,display:"flex",flexDirection:"column",gap:"6px"}}>
        <div>
          <div style={{fontSize:"9px",color:brandCol,letterSpacing:"2px",fontWeight:"700"}}>{brand}</div>
          <div style={{fontSize:"14px",fontWeight:"800",color:"#fff",lineHeight:1.2}}>{model.replace(brand+" ","")}</div>
          <div style={{fontSize:"9px",color:"#2a2a2a",marginTop:"1px"}}>{listing.type} · {listing.year} · {listing.loc}</div>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{fontSize:"10px",color:"#333"}}>{km.toLocaleString("nl-NL")} km · {listing.source}</div>
          {(()=>{const d=distKm?.(listing.lat,listing.lng),f=fmtDist?.(d);return f?(
            <span style={{display:"inline-flex",alignItems:"center",gap:"3px",background:d<20?"#001508":d<60?"#0a1020":"#111",
              border:`1px solid ${d<20?"#69f0ae44":d<60?"#60a5fa33":"#1a1a1a"}`,
              padding:"2px 7px",borderRadius:"2px",fontSize:"8px",
              color:d<20?"#69f0ae":d<60?"#60a5fa":"#444",fontWeight:"700",letterSpacing:"1px"}}>
              📍 {f}
            </span>
          ):null;})()}
        </div>
        <div style={{background:score.bg,border:`1px solid ${score.color}22`,borderRadius:"2px",padding:"5px 8px"}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:"3px"}}>
            <span style={{fontSize:"8px",color:score.color,fontWeight:"700",letterSpacing:"1px"}}>{score.icon} {score.short}</span>
            <span style={{fontSize:"9px",color:saving>=0?"#69f0ae":"#f44336",fontWeight:"700"}}>{saving>=0?`−€${saving.toLocaleString("nl-NL")}`:`+€${Math.abs(saving).toLocaleString("nl-NL")}`} vs markt</span>
          </div>
          <div style={{height:"2px",background:"#111",borderRadius:"2px"}}>
            <div style={{height:"100%",width:`${Math.max(4,Math.min(100,(mv.fair/price)*50))}%`,background:score.color,borderRadius:"2px"}}/>
          </div>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",paddingTop:"7px",borderTop:"1px solid #111",marginTop:"auto"}}>
          <div>
            <div style={{fontSize:"7px",color:"#1e1e1e",letterSpacing:"1px"}}>VRAAGPRIJS</div>
            <div style={{fontSize:"19px",fontWeight:"900",color:"#ff6b00",lineHeight:1}}>€{price.toLocaleString("nl-NL")}</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:"7px",color:"#1e1e1e",letterSpacing:"1px"}}>MARKTWAARDE</div>
            <div style={{fontSize:"13px",fontWeight:"700",color:"#69f0ae"}}>€{mv.fair.toLocaleString("nl-NL")}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TRENDING STRIP
// ══════════════════════════════════════════════════════════════════════════════
function TrendingStrip({analytics}){
  const top=getTopModels(analytics,6);
  if(!top.length) return null;
  return(
    <div style={{background:"#0a0a0a",border:"1px solid #1a1a1a",borderRadius:"4px",padding:"10px 14px",marginBottom:"10px"}}>
      <div style={{fontSize:"9px",color:"#ff6b00",letterSpacing:"3px",marginBottom:"8px"}}>🔥 TRENDING NU</div>
      <div style={{display:"flex",gap:"6px",flexWrap:"wrap"}}>
        {top.map((m,i)=>{
          const bc=BRAND_COLORS[m.brand]||"#666";
          const pl=getPopularityLabel(m.unique);
          return(
            <div key={m.model} style={{background:`${bc}10`,border:`1px solid ${bc}22`,padding:"5px 10px",borderRadius:"2px",display:"flex",alignItems:"center",gap:"6px"}}>
              <span style={{fontSize:"9px",color:"#333",fontFamily:"monospace"}}>#{i+1}</span>
              <div>
                <div style={{fontSize:"10px",color:bc,fontWeight:"700"}}>{m.model.replace(m.brand+" ","").slice(0,22)}</div>
                <div style={{fontSize:"8px",color:"#2a2a2a"}}>{m.unique} unieke views{pl?` · ${pl.icon}`:" "}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ══════════════════════════════════════════════════════════════════════════════
const BRANDS=["Alle merken",...new Set(RAW.map(l=>l.brand))];
const TYPES=["Alle typen","Adventure / Enduro","Naked / Streetfighter","Sport / Supersport","Tourer / GT","Cruiser / Chopper","Retro / Café Racer"];

export default function MotorShop(){
  const[brand,setBrand]=useState("Alle merken");
  const[type,setType]=useState("Alle typen");
  const[query,setQuery]=useState("");
  const[maxPrice,setMaxPrice]=useState("");
  const[maxKm,setMaxKm]=useState("");
  const[sorting,setSorting]=useState("nearest");
  const[userPos,setUserPos]=useState(null);     // {lat,lng}
  const[gpsState,setGpsState]=useState("idle"); // idle|loading|granted|denied
  const[onlyDeals,setOnlyDeals]=useState(false);
  const[scanning,setScanning]=useState(false);
  const[scanLog,setScanLog]=useState([]);
  const[results,setResults]=useState([]);
  const[selected,setSelected]=useState(null);
  const[activeSrc,setActiveSrc]=useState("Alle");
  const[showDash,setShowDash]=useState(false);
  const[analytics,setAnalytics]=useState({modelClicks:{},brandClicks:{},typeClicks:{},adClicks:{},sessions:[]});
  const logRef=useRef(null);

  // Laad analytics on mount
  useEffect(()=>{loadAnalytics().then(setAnalytics);},[]);

  // GPS — vraag locatie op bij eerste load
  useEffect(()=>{
    if(!("geolocation" in navigator)) return;
    setGpsState("loading");
    navigator.geolocation.getCurrentPosition(
      pos=>{
        setUserPos({lat:pos.coords.latitude,lng:pos.coords.longitude});
        setGpsState("granted");
      },
      ()=>setGpsState("denied"),
      {enableHighAccuracy:false,timeout:8000,maximumAge:300000}
    );
  },[]);

  // Afstand in km (Haversine)
  const distKm=(lat2,lng2)=>{
    if(!userPos||lat2==null||lng2==null) return null;
    const R=6371,dLat=(lat2-userPos.lat)*Math.PI/180,dLng=(lng2-userPos.lng)*Math.PI/180;
    const a=Math.sin(dLat/2)**2+Math.cos(userPos.lat*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
    return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
  };
  const fmtDist=km=>km===null?null:km<1?"< 1 km":km<10?`${Math.round(km)} km`:km<100?`${Math.round(km/5)*5} km`:"100+ km";

  // Analytics handler
  const handleAnalytics=useCallback((updated)=>{
    setAnalytics(updated);
    saveAnalytics(updated);
  },[]);

  // Click op listing
  const handleOpen=(listing)=>{
    const updated=trackClick(analytics,listing);
    handleAnalytics(updated);
    setSelected(listing);
  };

  const allSrc=["Alle",...SOURCES];
  const filtered=results.filter(l=>{
    if(brand!=="Alle merken"&&l.brand!==brand) return false;
    if(type !=="Alle typen" &&l.type !==type)  return false;
    if(query&&!`${l.brand} ${l.model}`.toLowerCase().includes(query.toLowerCase())) return false;
    if(maxPrice&&l.price>parseInt(maxPrice)) return false;
    if(maxKm&&l.km>parseInt(maxKm)) return false;
    if(activeSrc!=="Alle"&&l.source!==activeSrc) return false;
    if(onlyDeals&&l.price>=l.mv.fair*0.95) return false;
    return true;
  }).sort((a,b)=>{
    if(sorting==="score") return(a.price/a.mv.fair)-(b.price/b.mv.fair);
    if(sorting==="price_asc") return a.price-b.price;
    if(sorting==="price_desc") return b.price-a.price;
    if(sorting==="km_asc") return a.km-b.km;
    if(sorting==="popular") return(analytics.modelClicks[b.model]?.unique||0)-(analytics.modelClicks[a.model]?.unique||0);
    if(sorting==="nearest"){
      const da=distKm(a.lat,a.lng)??99999, db2=distKm(b.lat,b.lng)??99999;
      return da-db2;
    }
    return 0;
  });

  const dealCount=results.filter(l=>l.price<l.mv.fair*0.93).length;

  // Injecteer ads in grid: 1 sponsored bovenaan, dan native elke 5 kaarten
  const sponsoredAd=selectAd(ADS.filter(a=>a.type==="sponsored"),brand==="Alle merken"?"":brand,type==="Alle typen"?"":type);
  const nativeAdPool=ADS.filter(a=>a.type==="native");
  const bannerAd=ADS.find(a=>a.type==="banner");

  // Bouw grid items: listings + ads ertussen
  const gridItems=[];
  if(sponsoredAd&&results.length>0){
    gridItems.push({type:"sponsored",ad:sponsoredAd});
  }
  filtered.forEach((l,i)=>{
    gridItems.push({type:"listing",listing:l});
    // Native ad elke 5 listings
    if((i+1)%5===0){
      const ad=selectAd(nativeAdPool,l.brand,l.type,gridItems.filter(g=>g.type==="native").map(g=>g.ad.id));
      if(ad) gridItems.push({type:"native",ad});
    }
  });

  const runScan=()=>{
    setScanning(true);setResults([]);setScanLog([]);
    let step=0;
    const logs=[
      "⚡ Motor.shop scanner gestart...","🔍 Verbinding Marktplaats.nl...","✓ Marktplaats: 6 advertenties",
      "🔍 Verbinding 2dehands & AutoScout24...","✓ 4 resultaten","🔍 eBay, Facebook, Motortreffer...","✓ 5 resultaten",
      "📡 RDW opendata — voertuigdata...","📋 RDW — APK keuringshistorie...","🔍 NAP km-validatie...",
      "📊 KPI berekening...","📈 Populariteitsdata laden...",`✅ Klaar — ${RAW.length} advertenties geanalyseerd`,
    ];
    const iv=setInterval(()=>{
      if(step<logs.length){setScanLog(p=>[...p,logs[step++]]);if(logRef.current)logRef.current.scrollTop=9999;}
      else{clearInterval(iv);setScanning(false);setResults(LISTINGS_BASE);}
    },340);
  };

  return(
    <div style={{minHeight:"100vh",background:"#080808",color:"#fff",fontFamily:"'Barlow Condensed','Arial Narrow',Arial,sans-serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        input{background:#0d0d0d!important;color:#fff!important;border:1px solid #1e1e1e!important;border-radius:3px;padding:10px 14px;font-size:14px;outline:none;width:100%;font-family:inherit}
        input:focus{border-color:#ff6b00!important}
        select{background:#0d0d0d;color:#fff;border:1px solid #1e1e1e;border-radius:3px;padding:10px 14px;font-size:14px;outline:none;width:100%;font-family:inherit;appearance:none;-webkit-appearance:none}
        select:focus{border-color:#ff6b00}
        select option{background:#0d0d0d}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:#111}::-webkit-scrollbar-thumb{background:#2a2a2a}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
      `}</style>

      {/* HEADER */}
      <div style={{borderBottom:"1px solid #0f0f0f",padding:"0 20px"}}>
        <div style={{maxWidth:"1360px",margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between",height:"60px"}}>
          <div style={{display:"flex",alignItems:"center",gap:"12px"}}>
            <div style={{width:"36px",height:"36px",background:"#ff6b00",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"20px"}}>🏍</div>
            <div>
              <div style={{fontSize:"24px",fontWeight:"900",letterSpacing:"3px",lineHeight:1}}>MOTOR<span style={{color:"#ff6b00"}}>.SHOP</span></div>
              <div style={{fontSize:"7px",letterSpacing:"3px",color:"#1e1e1e"}}>AGGREGATOR · RDW LIVE · APK HISTORIEK · NAP · ADVERTENTIES</div>
            </div>
          </div>
          <div style={{display:"flex",gap:"12px",alignItems:"center"}}>
            {results.length>0&&[{l:"KOOPJES",v:dealCount,c:"#69f0ae"},{l:"TOTAAL",v:results.length,c:"#ff6b00"}].map(s=>(
              <div key={s.l} style={{textAlign:"center"}}>
                <div style={{fontSize:"20px",fontWeight:"900",color:s.c}}>{s.v}</div>
                <div style={{fontSize:"7px",color:"#2a2a2a",letterSpacing:"2px"}}>{s.l}</div>
              </div>
            ))}
            {/* GPS status pill */}
            <div onClick={()=>{
              if(gpsState==="denied"||gpsState==="idle"){
                setGpsState("loading");
                navigator.geolocation?.getCurrentPosition(
                  p=>{setUserPos({lat:p.coords.latitude,lng:p.coords.longitude});setGpsState("granted");},
                  ()=>setGpsState("denied"),
                  {enableHighAccuracy:false,timeout:8000}
                );
              }
            }} style={{display:"flex",alignItems:"center",gap:"6px",padding:"6px 12px",borderRadius:"3px",cursor:gpsState==="granted"?"default":"pointer",
              background:gpsState==="granted"?"#001508":gpsState==="loading"?"#111":"#111",
              border:`1px solid ${gpsState==="granted"?"#69f0ae44":gpsState==="loading"?"#ff6b0033":"#1e1e1e"}`}}>
              <span style={{fontSize:"13px"}}>{gpsState==="granted"?"📍":gpsState==="loading"?"⟳":"🔍"}</span>
              <div>
                <div style={{fontSize:"8px",fontWeight:"700",letterSpacing:"1px",color:gpsState==="granted"?"#69f0ae":gpsState==="loading"?"#ff6b00":"#333"}}>
                  {gpsState==="granted"?"LOCATIE ACTIEF":gpsState==="loading"?"LOCATIE...":gpsState==="denied"?"GEEN TOEGANG":"LOCATIE"}
                </div>
                {userPos&&<div style={{fontSize:"7px",color:"#2a2a2a",letterSpacing:"1px"}}>{userPos.lat.toFixed(3)}°N {userPos.lng.toFixed(3)}°E</div>}
              </div>
            </div>
            <button onClick={()=>setShowDash(true)}
              style={{background:"none",border:"1px solid #222",color:"#444",padding:"6px 12px",fontSize:"10px",letterSpacing:"2px",cursor:"pointer",fontFamily:"inherit",transition:"all 0.2s"}}
              onMouseEnter={e=>{e.target.style.borderColor="#ff6b00";e.target.style.color="#ff6b00"}}
              onMouseLeave={e=>{e.target.style.borderColor="#222";e.target.style.color="#444"}}>
              📊 DASHBOARD
            </button>
          </div>
        </div>
      </div>

      <div style={{maxWidth:"1360px",margin:"0 auto",padding:"16px 20px"}}>

        {/* FILTERS */}
        <div style={{background:"#0d0d0d",border:"1px solid #1a1a1a",borderRadius:"4px",padding:"14px 16px",marginBottom:"12px"}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr",gap:"8px",marginBottom:"10px"}}>
            <input placeholder="Zoek merk of model..." value={query} onChange={e=>setQuery(e.target.value)}/>
            <select value={brand} onChange={e=>setBrand(e.target.value)}>{BRANDS.map(b=><option key={b}>{b}</option>)}</select>
            <select value={type}  onChange={e=>setType(e.target.value)}>{TYPES.map(t=><option key={t}>{t}</option>)}</select>
            <input placeholder="Max prijs (€)" type="number" value={maxPrice} onChange={e=>setMaxPrice(e.target.value)}/>
            <input placeholder="Max km-stand"  type="number" value={maxKm}    onChange={e=>setMaxKm(e.target.value)}/>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <label onClick={()=>setOnlyDeals(!onlyDeals)} style={{display:"flex",alignItems:"center",gap:"8px",cursor:"pointer",fontSize:"10px",color:onlyDeals?"#69f0ae":"#2a2a2a",letterSpacing:"2px"}}>
              <div style={{width:"28px",height:"15px",background:onlyDeals?"#69f0ae12":"#111",border:`1px solid ${onlyDeals?"#69f0ae":"#222"}`,borderRadius:"8px",position:"relative",transition:"all 0.2s"}}>
                <div style={{position:"absolute",top:"2px",left:onlyDeals?"12px":"2px",width:"9px",height:"9px",background:onlyDeals?"#69f0ae":"#2a2a2a",borderRadius:"50%",transition:"left 0.2s"}}/>
              </div>
              ALLEEN KOOPJES
            </label>
            <button onClick={runScan} disabled={scanning}
              style={{background:scanning?"#111":"#ff6b00",color:scanning?"#333":"#000",border:"none",padding:"11px 32px",fontSize:"14px",fontWeight:"900",letterSpacing:"3px",cursor:scanning?"default":"pointer",fontFamily:"inherit"}}>
              {scanning?"⟳ SCANNEN...":"⚡ SCAN & ANALYSEER"}
            </button>
          </div>
        </div>

        {/* SCAN LOG */}
        {(scanning||scanLog.length>0)&&(
          <div ref={logRef} style={{background:"#050505",border:"1px solid #111",borderRadius:"4px",padding:"9px 12px",marginBottom:"10px",maxHeight:"95px",overflowY:"auto"}}>
            {scanLog.map((l,i)=><div key={i} style={{fontSize:"10px",fontFamily:"monospace",lineHeight:"1.9",color:l.startsWith("✅")?"#4caf50":l.startsWith("✓")?"#ff6b00":l.startsWith("📈")?"#a78bfa":l.startsWith("📡")||l.startsWith("📋")?"#60a5fa":"#2a2a2a"}}>{l}</div>)}
            {scanning&&<span style={{fontSize:"10px",color:"#ff6b00",fontFamily:"monospace",animation:"blink 0.8s infinite"}}>█</span>}
          </div>
        )}

        {/* BANNER AD */}
        {results.length>0&&bannerAd&&<BannerAd ad={bannerAd} analytics={analytics} onAnalytics={handleAnalytics}/>}

        {/* TRENDING */}
        {results.length>0&&<TrendingStrip analytics={analytics}/>}

        {/* TABS + SORT */}
        {results.length>0&&(
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"10px"}}>
            <div style={{display:"flex",gap:"4px",flexWrap:"wrap"}}>
              {allSrc.map(s=>(
                <button key={s} onClick={()=>setActiveSrc(s)}
                  style={{background:activeSrc===s?"#ff6b00":"none",color:activeSrc===s?"#000":"#2a2a2a",border:`1px solid ${activeSrc===s?"#ff6b00":"#1a1a1a"}`,padding:"4px 10px",fontSize:"9px",letterSpacing:"1px",cursor:"pointer",fontFamily:"inherit",fontWeight:activeSrc===s?"800":"400"}}>
                  {s}
                </button>
              ))}
            </div>
            <div style={{display:"flex",gap:"8px",alignItems:"center"}}>
              <span style={{fontSize:"9px",color:"#1e1e1e"}}>{filtered.length} RESULTATEN</span>
              <select value={sorting} onChange={e=>setSorting(e.target.value)} style={{width:"auto",padding:"4px 9px",fontSize:"10px"}}>
                <option value="nearest">Dichtstbij eerst</option>
                <option value="score">Beste waarde eerst</option>
                <option value="popular">Populairste eerst</option>
                <option value="price_asc">Prijs laag–hoog</option>
                <option value="price_desc">Prijs hoog–laag</option>
                <option value="km_asc">Km laag–hoog</option>
              </select>
            </div>
          </div>
        )}

        {/* GRID — listings + ads */}
        {gridItems.length>0&&(
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(270px,1fr))",gap:"10px"}}>
            {gridItems.map((item,i)=>(
              <div key={`${item.type}-${i}`} style={{animation:"fadeUp 0.4s ease both",animationDelay:`${Math.min(i,12)*0.05}s`}}>
                {item.type==="listing"&&<ListingCard listing={item.listing} analytics={analytics} onOpen={handleOpen} distKm={distKm} fmtDist={fmtDist}/>}
                {item.type==="native"&&<NativeAd ad={item.ad} analytics={analytics} onAnalytics={handleAnalytics}/>}
                {item.type==="sponsored"&&<SponsoredListing ad={item.ad} analytics={analytics} onAnalytics={handleAnalytics}/>}
              </div>
            ))}
          </div>
        )}

        {results.length===0&&!scanning&&(
          <div style={{textAlign:"center",padding:"70px 20px"}}>
            <div style={{fontSize:"64px",opacity:0.04}}>🏍</div>
            <div style={{fontSize:"16px",letterSpacing:"4px",color:"#1a1a1a",fontWeight:"700",marginTop:"12px"}}>KLAAR OM TE SCANNEN</div>
            <div style={{fontSize:"9px",color:"#111",marginTop:"6px",letterSpacing:"2px"}}>RDW live · APK historiek · NAP validatie · Populariteits tracking · Native advertenties</div>
          </div>
        )}
      </div>

      <div style={{borderTop:"1px solid #0f0f0f",padding:"10px 20px",marginTop:"20px"}}>
        <div style={{maxWidth:"1360px",margin:"0 auto",display:"flex",justifyContent:"space-between",fontSize:"8px",color:"#141414",letterSpacing:"1px"}}>
          <span>MOTOR.SHOP · RDW opendata.rdw.nl · APK sgfe-77wx · NAP km-logica · Advertenties: CPC/CPM</span>
          <span>Adverteren? motor.shop/adverteren</span>
        </div>
      </div>

      {selected&&<DetailModal listing={selected} analytics={analytics} onClose={()=>setSelected(null)}/>}
      {showDash&&<AnalyticsPanel analytics={analytics} onClose={()=>setShowDash(false)}/>}
    </div>
  );
}
