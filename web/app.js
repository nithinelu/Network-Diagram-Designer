/* Collab Room Planner: catalog, room layout, coverage analysis, 2D plan, BOQ and app glue.
   The 3D view lives in view3d.js and registers itself as window.View3D. */
const CATALOG = [
  // vendor, id, name, hfov, pan(± deg), reach(m), mic(m), cap, board(0=bar), addon, src
  {v:"Cisco",id:"cisco-bar",name:"Room Bar",hfov:120,pan:0,reach:4.5,mic:4,cap:6,board:0,
   kit:["Cisco Room Bar","Cisco Room Navigator (table or wall)"],addon:{name:"Cisco Table Microphone Pro",r:2.5,max:2,incl:0},
   src:{hfov:0,reach:0,mic:0}},
  {v:"Cisco",id:"cisco-barpro",name:"Room Bar Pro",hfov:112,pan:0,reach:6,mic:4,cap:12,board:0,
   kit:["Cisco Room Bar Pro (CS-BARPRO-K9), incl. Room Navigator for Table"],addon:{name:"Cisco Table Microphone Pro",r:2.5,max:8,incl:0},
   src:{hfov:1,reach:0,mic:1}},
  {v:"Cisco",id:"cisco-board55",name:"Board Pro 55 G2",hfov:120,pan:0,reach:4,mic:4,cap:6,board:55,
   kit:["Cisco Board Pro 55 G2","Cisco Room Navigator (table or wall)"],addon:{name:"Cisco Table Microphone Pro",r:2.5,max:2,incl:0},
   src:{hfov:0,reach:0,mic:0}},
  {v:"Cisco",id:"cisco-board75",name:"Board Pro 75 G2",hfov:120,pan:0,reach:5.5,mic:4,cap:10,board:75,
   kit:["Cisco Board Pro 75 G2","Cisco Room Navigator (table or wall)"],addon:{name:"Cisco Table Microphone Pro",r:2.5,max:4,incl:0},
   src:{hfov:0,reach:0,mic:0}},
  {v:"Cisco",id:"cisco-eq",name:"Room Kit EQ + Quad Camera",hfov:83,pan:0,reach:8,mic:0,cap:22,board:0,addonRows:{name:"Cisco Ceiling Microphone Pro",r:4,max:8,incl:0,ceil:1},codec:1,
   kit:["Cisco Room Kit EQ with Quad Camera","Cisco Room Navigator (table or wall)"],addon:{name:"Cisco Table Microphone Pro",r:2.5,max:8,incl:0},
   src:{hfov:0,reach:0,mic:0}},
  {v:"Cisco",id:"cisco-eqx",name:"Room Kit EQX (dual 75\")",hfov:83,pan:0,reach:8,mic:4,cap:18,board:75,dualBoard:1,addonRows:{name:"Cisco Ceiling Microphone Pro",r:4,max:8,incl:0,ceil:1},
   kit:["Cisco Room Kit EQX (dual 75\" floor stand, Quad Camera, Codec EQ)","Cisco Room Navigator (table or wall)"],addon:{name:"Cisco Table Microphone Pro",r:2.5,max:8,incl:0},
   src:{hfov:0,reach:0,mic:0}},
  {v:"Cisco",id:"cisco-pro",name:"Room Kit Pro G2 (Codec Pro G2 + Quad Camera)",hfov:83,pan:0,reach:8,mic:0,cap:40,board:0,addonRows:{name:"Cisco Ceiling Microphone Pro",r:4,max:8,incl:0,ceil:1},codec:1,
   kit:["Cisco Room Kit Pro G2 (Codec Pro G2 + Quad Camera)","Cisco Room Navigator (table or wall)"],addon:{name:"Cisco Table Microphone Pro",r:2.5,max:8,incl:0},
   src:{hfov:0,reach:0,mic:0}},
  {v:"Cisco",id:"cisco-deskpro",name:"Desk Pro",hfov:71,pan:0,reach:1.8,mic:1.5,cap:2,board:27,
   kit:["Cisco Desk Pro"],addon:{name:"—",r:0,max:0,incl:0},src:{hfov:0,reach:0,mic:0}},

  {v:"Logitech",id:"logi-meetup2",name:"MeetUp 2",hfov:113,pan:0,reach:4,mic:4,cap:6,board:0,
   kit:["Logitech MeetUp 2","Logitech Tap IP (or BYOD laptop)"],addon:{name:"Logitech Expansion Mic for MeetUp",r:2,max:1,incl:0},
   src:{hfov:0,reach:0,mic:0}},
  {v:"Logitech",id:"logi-huddle",name:"Rally Bar Huddle",hfov:113,pan:0,reach:4,mic:4,cap:6,board:0,
   kit:["Logitech Rally Bar Huddle","Logitech Tap IP"],addon:{name:"Logitech Rally Mic Pod",r:2.5,max:1,incl:0},
   src:{hfov:0,reach:0,mic:0}},
  {v:"Logitech",id:"logi-mini",name:"Rally Bar Mini",hfov:113,pan:25,reach:5,mic:4.5,cap:12,board:0,
   kit:["Logitech Rally Bar Mini","Logitech Tap IP"],addon:{name:"Logitech Rally Mic Pod",r:2.5,max:3,incl:0},
   src:{hfov:1,pan:1,reach:0,mic:1}},
  {v:"Logitech",id:"logi-bar",name:"Rally Bar",hfov:82.1,pan:25,reach:7,mic:4.5,cap:12,board:0,
   kit:["Logitech Rally Bar","Logitech Tap IP"],addon:{name:"Logitech Rally Mic Pod",r:2.5,max:3,incl:0},
   src:{hfov:0,pan:0,reach:0,mic:0}},
  {v:"Logitech",id:"logi-plus",name:"Rally Plus",hfov:82.1,pan:25,reach:8,mic:0,cap:20,board:0,
   kit:["Logitech Rally Plus (camera, 2 speakers, 2 mic pods)","Logitech Tap"],addon:{name:"Logitech Rally Mic Pod",r:2.5,max:7,incl:2},
   src:{hfov:0,pan:0,reach:0,mic:0}},

  {v:"MAXHUB",id:"maxhub-u50",name:"XBar U50",hfov:125,pan:0,reach:6,mic:8,cap:10,board:0,
   kit:["MAXHUB XBar U50 video bar","Room controller or BYOD (confirm platform)"],addon:{name:"MAXHUB expansion mic (confirm model)",r:3,max:2,incl:0},
   src:{hfov:1,reach:0,mic:1}},
  {v:"MAXHUB",id:"maxhub-v50",name:"XBar V50",hfov:125,pan:0,reach:7,mic:8,cap:12,board:0,
   kit:["MAXHUB XBar V50 Kit (MTR on Android, incl. touch console)"],addon:{name:"MAXHUB expansion mic (confirm model)",r:3,max:2,incl:0},
   src:{hfov:1,reach:0,mic:1}},
  {v:"MAXHUB",id:"maxhub-w70",name:"XBar W70",hfov:125,pan:0,reach:9,mic:10,cap:20,board:0,
   kit:["MAXHUB XBar W70 Kit (MTR on Windows, incl. touch console)"],addon:{name:"MAXHUB expansion mic (confirm model)",r:3,max:2,incl:0},
   src:{hfov:1,reach:0,mic:1}},

  {v:"Huawei",id:"huawei-65",name:"IdeaHub Board 2 65\"",hfov:80,pan:0,reach:6,mic:10,cap:10,board:65,
   kit:["HUAWEI IdeaHub Board 2 65\" (camera, mics, speakers built in)"],addon:{name:"Huawei expansion mic (confirm model)",r:3,max:2,incl:0},
   src:{hfov:1,reach:0,mic:1}},
  {v:"Huawei",id:"huawei-86",name:"IdeaHub Board 2 86\"",hfov:80,pan:0,reach:7,mic:12,cap:14,board:86,
   kit:["HUAWEI IdeaHub Board 2 86\" (camera, mics, speakers built in)"],addon:{name:"Huawei expansion mic (confirm model)",r:3,max:2,incl:0},
   src:{hfov:0,reach:0,mic:1}},

  {v:"Neat",id:"neat-bar2",name:"Bar Gen 2",hfov:113,pan:0,reach:5,mic:5,cap:8,board:0,
   kit:["Neat Bar Gen 2","Neat Pad (controller)"],addon:{name:"—",r:0,max:0,incl:0},
   src:{hfov:1,reach:1,mic:1}},
  {v:"Neat",id:"neat-barpro",name:"Bar Pro",hfov:113,pan:0,reach:8,mic:10,cap:16,board:0,
   kit:["Neat Bar Pro","Neat Pad (controller)"],addon:{name:"—",r:0,max:0,incl:0},
   src:{hfov:1,reach:0,mic:1}},
  {v:"Neat",id:"neat-board50",name:"Board 50",hfov:113,pan:0,reach:5,mic:5,cap:8,board:50,
   kit:["Neat Board 50","Neat Pad (controller, optional)"],addon:{name:"—",r:0,max:0,incl:0},
   src:{hfov:1,reach:1,mic:1}},
  {v:"Neat",id:"neat-boardpro",name:"Board Pro 65\"",hfov:113,pan:0,reach:8,mic:10,cap:14,board:65,
   kit:["Neat Board Pro (65\")","Neat Pad (controller, optional)"],addon:{name:"—",r:0,max:0,incl:0},
   src:{hfov:1,reach:0,mic:1}},
];
const VENDORS=["Cisco","Logitech","MAXHUB","Huawei","Neat"];

/* Extension cameras. hfov>=360 = table-centre 360° camera; track = PTZ that re-aims itself
   (seats inside its pan range count as covered); mic = pickup radius when it has its own mics. */
const EXT_CAMS=[
  {id:"cisco-ptz",name:"Cisco Room Vision PTZ",hfov:80,pan:100,track:1,reach:10,mic:0,
   for:["cisco-eq","cisco-eqx","cisco-pro","cisco-barpro","cisco-board55","cisco-board75"],src:{hfov:0,reach:0}},
  {id:"cisco-quad",name:"Cisco Quad Camera",hfov:83,pan:0,reach:8,mic:0,for:["cisco-eq","cisco-pro"],src:{hfov:0,reach:0}},
  {id:"logi-sight",name:"Logitech Sight (table camera)",hfov:360,pan:0,reach:3.5,mic:2.5,for:["logi-bar","logi-mini","logi-plus"],src:{hfov:0,reach:0}},
  {id:"neat-center",name:"Neat Center (360° table camera + mics)",hfov:360,pan:0,reach:5,mic:5,for:["neat-barpro","neat-boardpro"],src:{hfov:1,reach:1}},
  {id:"generic-ptz",name:"Extension PTZ camera (confirm model)",hfov:70,pan:100,track:1,reach:10,mic:0,
   for:["maxhub-u50","maxhub-v50","maxhub-w70","huawei-65","huawei-86"],src:{hfov:0,reach:0}},
];
const XVIEW=["cisco-eq","cisco-eqx","cisco-pro"]; // Cisco cross-view: Room Kit EQ / EQX + two Room Vision PTZ on the side walls
const POSITIONS={custom:"Imported position",above:"Above the screen (front wall)",left:"Left side wall",right:"Right side wall",
  leftf:"Left wall, front half",leftr:"Left wall, rear half",rightf:"Right wall, front half",rightr:"Right wall, rear half",rear:"Rear wall",fl:"Front-left corner",fr:"Front-right corner",table:"Table centre",tablef:"Table, front half",tabler:"Table, rear half"};
const extById=id=>EXT_CAMS.find(e=>e.id===id);
const extFor=devId=>EXT_CAMS.filter(e=>e.for.includes(devId));
const posFor=e=>e.hfov>=360?["table","tablef","tabler"]:["above","left","right","leftf","leftr","rightf","rightr","rear","fl","fr"];
const PRESETS=[
  {k:"huddle",label:"Huddle 3 × 2.5",layout:"board",W:2.5,D:3,seats:4,tw:1,gap:1.2},
  {k:"small",label:"Small 4 × 3.5",layout:"board",W:3.5,D:4,seats:6,tw:1.1,gap:1.3},
  {k:"medium",label:"Medium 6 × 4.5",layout:"board",W:4.5,D:6,seats:10,tw:1.2,gap:1.5},
  {k:"large",label:"Large 8 × 5.5",layout:"board",W:5.5,D:8,seats:16,tw:1.4,gap:1.8},
  {k:"board",label:"Boardroom 10 × 6",layout:"board",W:6,D:10,seats:20,tw:1.6,gap:2},
  {k:"class",label:"Classroom 30 · 9 × 7",layout:"class",W:7,D:9,H:3,seats:30,tw:1.2,gap:2.5},
  {k:"audi",label:"Auditorium 100 · 14 × 12",layout:"audi",W:12,D:14,H:4.5,seats:100,tw:1.2,gap:3.5},
];
const LAYOUTS={board:"Boardroom",class:"Classroom",audi:"Auditorium",vrc:"Imported (VRC)"};
const vdist=(L,s)=>L.main?Math.hypot(s.x-L.main.x,s.y-L.main.y):s.y; // viewing distance from the endpoint
const STD=[43,50,55,65,75,86,98];
const SPEC_KEYS=["hfov","reach","mic"];
const byId=id=>CATALOG.find(d=>d.id===id);
const specs={};
const resetSpecs=id=>{const d=byId(id);specs[id]={hfov:d.hfov,pan:d.pan,reach:d.reach,mic:d.mic};};
CATALOG.forEach(d=>resetSpecs(d.id));

const DEFAULTS={name:"",preset:"medium",layout:"board",W:4.5,D:6,H:2.8,seats:10,tw:1.2,gap:1.5,plan:80,compare:true,dual:false,sync:false,
  dev:["cisco-barpro","maxhub-v50"],view:["3d","3d"],specs:{},ext:[[],[]],
  mount:{bottom:0.9,bar:"above",wallH:1.9,cornerH:2.1,sideY:0},
  cab:{rack:"credenza",route:"ceiling",floorBox:true,uplink:15,slack:10,loop:0.5,show:true},
  audio:[{spk:"none",spkN:0,mic:"device",micN:0,dsp:"auto"},{spk:"none",spkN:0,mic:"device",micN:0,dsp:"auto"}]};
let S=JSON.parse(JSON.stringify(DEFAULTS));

const $=id=>document.getElementById(id);
const fmt=(n,d=1)=>Number(n).toFixed(d);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

/* ---------- host bridge (pywebview when running as the app, browser storage otherwise) ---------- */
const Host={
  api:null,
  ready:new Promise(res=>{
    if(window.pywebview&&window.pywebview.api) return res();
    window.addEventListener("pywebviewready",()=>res(),{once:true});
    setTimeout(res,1500); // plain browser: no bridge
  }).then(()=>{Host.api=(window.pywebview&&window.pywebview.api)||null;}),
};
let saveTimer=null;
function save(){
  clearTimeout(saveTimer);
  saveTimer=setTimeout(()=>{
    if(Host.api) Host.api.save_state(S).catch(()=>{});
    else try{localStorage.setItem("crp-state",JSON.stringify(S))}catch(e){}
  },300);
}
async function loadSaved(){
  try{
    if(Host.api) return await Host.api.load_state();
    return JSON.parse(localStorage.getItem("crp-state")||"null");
  }catch(e){return null;}
}
function applyState(s){
  S=Object.assign(JSON.parse(JSON.stringify(DEFAULTS)),s||{});
  S.dev=S.dev.map((id,i)=>byId(id)?id:DEFAULTS.dev[i]);
  if(!Array.isArray(S.view)||S.view.length<2) S.view=["3d","3d"];
  if(!LAYOUTS[S.layout]||(S.layout==="vrc"&&!(S.vrc&&S.vrc.seats))) S.layout="board";
  S.mount=Object.assign({},DEFAULTS.mount,(s&&s.mount)||{});
  S.cab=Object.assign({},DEFAULTS.cab,(s&&s.cab)||{});
  S.audio=[0,1].map(c=>Object.assign({},DEFAULTS.audio[c],((s&&s.audio)||[])[c]||{}));
  if(!Array.isArray(S.ext)) S.ext=[[],[]];
  S.ext=[0,1].map(c=>(Array.isArray(S.ext[c])?S.ext[c]:[]).filter(x=>x&&extById(x.cam)&&POSITIONS[x.pos]));
  CATALOG.forEach(d=>resetSpecs(d.id));
  Object.entries(S.specs||{}).forEach(([id,o])=>{if(specs[id]) SPEC_KEYS.forEach(k=>{if(typeof o[k]==="number") specs[id][k]=o[k];});});
}
function status(msg){$("appStatus").textContent=msg||"";}

/* ---------- layout ---------- */
function layout(){
  if(S.layout==="vrc"&&S.vrc&&typeof vrcLayout==="function") return vrcLayout();
  return S.layout==="vrc"||S.layout==="board" ? boardLayout() : rowsLayout(S.layout);
}
/* Classroom (desks for two, 1.2 m row pitch) or auditorium (0.95 m row pitch), centre aisle, presenter at the front. */
function rowsLayout(kind){
  const {W,D,seats:n,gap}=S, cx=W/2, cls=kind==="class";
  const px=cls?0.65:0.55, py=cls?1.2:0.95, side=0.6, aisle=cls?1.0:1.2, usable=Math.max(0.6,W-2*side);
  let perRow=Math.floor((usable-aisle)/px), hasAisle=perRow>=4;
  if(!hasAisle) perRow=Math.max(1,Math.floor(usable/px));
  perRow=Math.min(perRow,cls?8:14); // at most 4 / 7 seats either side of the aisle (egress)
  const rows=Math.ceil(n/perRow), list=[], desks=[];
  let left=0;
  for(let r=0;r<rows;r++){
    const y=gap+r*py, inRow=Math.min(perRow,n-r*perRow);
    const xs=[];
    if(hasAisle){
      const l=Math.ceil(inRow/2), rr=inRow-l;
      for(let i=0;i<l;i++) xs.push(cx-aisle/2-px*(i+0.5));
      for(let i=0;i<rr;i++) xs.push(cx+aisle/2+px*(i+0.5));
    } else for(let i=0;i<inRow;i++) xs.push(cx+(i-(inRow-1)/2)*px);
    xs.forEach(x=>list.push({x,y,face:"f"}));
    if(cls){
      const lb=xs.filter(x=>x<cx||!hasAisle), rb=hasAisle?xs.filter(x=>x>=cx):[];
      [lb,rb].forEach(b=>{if(b.length) desks.push({x0:Math.min(...b)-px/2,x1:Math.max(...b)+px/2,y:y-0.42,dep:0.45});});
    }
    left=Math.max(left,...xs.map(x=>Math.abs(x-cx)));
  }
  const pres={x:Math.max(0.7,cx-Math.min(2.2,W*0.3)),y:Math.max(0.7,Math.min(1.2,gap*0.45)),face:"p",presenter:true};
  list.push(pres);
  const len=Math.max(0.6,(rows-1)*py);
  return {kind,cx,y0:gap,len,tw:2*left+px,seats:list,desks,rows,perRow,
    lectern:{x:pres.x,y:pres.y+0.4},fits:gap+len+0.6<=D&&perRow>=1};
}
function boardLayout(){
  const {W,D,seats:n,tw,gap}=S, cx=W/2;
  const far = n>=5 ? (n>=16?2:1) : 0;
  const per = Math.ceil((n-far)/2), right = n-far-per;
  const len = Math.max(1.2, per*0.75+0.3);
  const y0=gap, list=[];
  for(let i=0;i<per;i++) list.push({x:cx-tw/2-0.35,y:y0+len*(i+0.5)/per,face:"r"});
  for(let i=0;i<right;i++) list.push({x:cx+tw/2+0.35,y:y0+len*(i+0.5)/right,face:"l"});
  for(let i=0;i<far;i++) list.push({x:cx+(far===2?(i?0.4:-0.4):0),y:y0+len+0.4,face:"f"});
  const fits = (y0+len+0.9<=D) && (tw+1.4<=W);
  return {kind:"board",cx,y0,len,tw,seats:list,fits,desks:[],lectern:null};
}

/* ---------- analysis ---------- */
const DEG=180/Math.PI;
const angDiff=(a,b)=>Math.abs(((a-b)%360+540)%360-180);
const FACE={r:90,l:-90,f:180,p:0}; // direction a seated person faces when talking across the table
/* Where an extension camera sits and which way it points. Angles: 0 = straight into the room (+y), 90 = toward +x. */
function extPose(pos,L){
  const {W,D}=S, M=S.mount, mid=L.y0+L.len/2, aimAt=(x,y)=>Math.atan2(L.cx-x,mid-y)*DEG;
  const sy=M.sideY>0?Math.min(D-0.2,M.sideY):mid;
  switch(pos){
    case "left":  return {x:0.06,y:sy,aim:90,z:M.wallH};
    case "right": return {x:W-0.06,y:sy,aim:-90,z:M.wallH};
    case "leftf": return {x:0.06,y:L.y0+L.len*0.28,aim:90,z:M.wallH};
    case "leftr": return {x:0.06,y:L.y0+L.len*0.72,aim:90,z:M.wallH};
    case "rightf": return {x:W-0.06,y:L.y0+L.len*0.28,aim:-90,z:M.wallH};
    case "rightr": return {x:W-0.06,y:L.y0+L.len*0.72,aim:-90,z:M.wallH};
    case "above": return L.main?{x:L.main.x,y:L.main.y,aim:L.main.aim,z:2}:{x:L.cx,y:0.12,aim:0,z:2}; // z set in analyse() once the screen size is known
    case "tablef": return {x:L.cx,y:L.y0+L.len*0.28,aim:0,z:TABLE_TOP+0.2};
    case "tabler": return {x:L.cx,y:L.y0+L.len*0.72,aim:0,z:TABLE_TOP+0.2};
    case "rear":  return {x:L.cx,y:D-0.06,aim:180,z:M.wallH};
    case "fl":    return {x:0.12,y:0.12,aim:aimAt(0.12,0.12),z:M.cornerH};
    case "fr":    return {x:W-0.12,y:0.12,aim:aimAt(W-0.12,0.12),z:M.cornerH};
    default:      return {x:L.cx,y:mid,aim:0,z:TABLE_TOP+0.2};
  }
}
const TABLE_TOP=0.74;
function camCover(cam,s){
  const r=Math.hypot(s.x-cam.x,s.y-cam.y), rel=angDiff(Math.atan2(s.x-cam.x,s.y-cam.y)*DEG,cam.aim);
  const h=cam.hfov/2, inF=cam.hfov>=360||rel<=h, inP=rel<=h+cam.pan, inR=r<=cam.reach;
  if((inF&&inR)||(cam.track&&inP&&inR)) return "ok";
  return ((inP&&inR)||(inF&&r<=cam.reach*1.25)) ? "warn" : "bad";
}
function analyse(d,L,c){
  const MP=L.main||{x:L.cx,y:0.08,aim:0}, sp=specs[d.id], cy=MP.y, au=typeof audioPlan==="function"?audioPlan(d,L,c):null;
  let micPlan=sp.mic*S.plan/100, ad=(L.kind!=="board"&&d.addonRows)||d.addon, mics=[];
  if(au&&au.mic){micPlan=0; ad={name:au.mic.name,r:au.mic.r,max:au.mic.pts.length,incl:0,ceil:1,ext:au.mic}; mics=au.mic.pts.slice();}
  const cams=[{main:1,name:d.name,x:MP.x,y:cy,aim:MP.aim,hfov:sp.hfov,pan:sp.pan,track:0,reach:sp.reach}];
  (S.ext[c]||[]).forEach(x=>{const e=extById(x.cam); cams.push({...extPose(x.pos,L),...e,ext:e,pos:x.pos,xv:!!x.xv,esv:!!x.esv,...(x.pose||{}),mic:e.mic*S.plan/100});});
  const extMics=cams.filter(k=>k.mic>0&&!k.main);
  const tableY=t=>Math.min(L.y0+L.len-0.3,Math.max(L.y0+0.3,t));
  const mz=ad.ceil?S.H:TABLE_TOP+0.02;
  for(let i=0;i<ad.incl;i++) mics.push({x:L.cx,y:L.y0+L.len*(i+0.5)/ad.incl,z:mz});
  if(L.fixedMics&&!(au&&au.mic)) mics=L.fixedMics.map(m=>({x:m.x,y:m.y,z:mz}));
  const heard=s=>Math.hypot(s.x-MP.x,s.y-cy)<=micPlan || mics.some(m=>Math.hypot(s.x-m.x,s.y-m.y)<=ad.r)
    || extMics.some(k=>Math.hypot(s.x-k.x,s.y-k.y)<=k.mic);
  let guard=0;
  while(!L.fixedMics && ad.r>0 && mics.length<ad.max && guard++<20){
    const un=L.seats.filter(s=>!heard(s)); if(!un.length) break;
    const yMin=Math.min(...un.map(s=>s.y));
    if(L.kind==="board"&&!L.vrc) mics.push({x:L.cx,y:tableY(yMin+ad.r*0.6),z:mz});
    else{
      const band=un.filter(s=>s.y<=yMin+ad.r), mx=band.reduce((a,s)=>a+s.x,0)/band.length;
      mics.push({x:mx,y:yMin+ad.r*0.6,z:mz});
    }
  }
  const RANK={ok:2,warn:1,bad:0};
  const seats=L.seats.map(s=>{
    const per=cams.map(k=>camCover(k,s));
    const video=per.reduce((a,b)=>RANK[b]>RANK[a]?b:a,"bad");
    // face-on: a camera that covers the seat sits within 60° of where the person looks when talking across the table
    const faceOn=cams.some((k,i)=>per[i]==="ok"&&angDiff(Math.atan2(k.x-s.x,k.y-s.y)*DEG,FACE[s.face]??s.faceDeg)<=60);
    const audio=heard(s);
    const st = (video==="bad"||!audio) ? "bad" : video==="warn" ? "warn" : "ok";
    return {...s,video,audio,st,faceOn,r:Math.hypot(s.x-MP.x,s.y-cy)};
  });
  const farthest=Math.max(...seats.map(s=>vdist(L,s)));
  const H=farthest/6, diag=H/0.4903/0.0254;
  const rec=STD.find(x=>x>=diag)||98;
  const extra=Math.max(0,mics.length-ad.incl);
  const mx=MP.x;
  const scrTop=S.mount.bottom+(d.board||Math.min(rec,98))*0.0254*0.4903+(!d.board&&S.mount.bar==="above"?0.18:0);
  cams.forEach(k=>{if(k.pos==="above") k.z=Math.min(S.H-0.15,scrTop+0.14);});
  const res={sp,cy,mx,micPlan,mics,seats,diag,rec,extra,farthest,cams,ad,
    seen:seats.filter(s=>s.video==="ok").length, heardN:seats.filter(s=>s.audio).length, faceN:seats.filter(s=>s.faceOn).length,
    ok:seats.filter(s=>s.st==="ok").length, warn:seats.filter(s=>s.st==="warn").length, bad:seats.filter(s=>s.st==="bad").length};
  res.au=au;
  if(au&&au.spk) au.spkCov=seats.filter(s=>au.spk.pts.some(p=>Math.hypot(s.x-p.x,s.y-p.y)<=au.spk.r)).length;
  res.I=typeof install==="function"?install(d,L,res,c):null;
  return res;
}

/* ---------- 2D plan ---------- */
function wedge(cx,cy,r,a,aim=0){ // a = half-angle in deg; aim measured from +y toward +x
  if(a>=180) return `M${cx-r},${cy} A${r},${r} 0 1 0 ${cx+r},${cy} A${r},${r} 0 1 0 ${cx-r},${cy} Z`;
  const k=Math.PI/180, p=t=>[cx+r*Math.sin(t*k),cy+r*Math.cos(t*k)];
  const [x1,y1]=p(aim-a), [x2,y2]=p(aim+a);
  return `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${2*a>180?1:0} 0 ${x2},${y2} Z`;
}
function svgPlan(d,L,A,col){
  const {W,D}=S, m=0.7, fs=Math.max(W,D)*0.03, cid="clip"+col;
  const sw='vector-effect="non-scaling-stroke"';
  let g=`<svg viewBox="${-m} ${-m} ${W+2*m} ${D+2*m}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Floor plan for ${esc(d.v+" "+d.name)}">`;
  g+=`<defs><clipPath id="${cid}"><rect x="0" y="0" width="${W}" height="${D}"/></clipPath></defs>`;
  g+=`<rect x="0" y="0" width="${W}" height="${D}" fill="var(--sheet)"/>`;
  for(let x=1;x<W;x++) g+=`<line x1="${x}" y1="0" x2="${x}" y2="${D}" stroke="var(--grid)" stroke-width="1" ${sw}/>`;
  for(let y=1;y<D;y++) g+=`<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="var(--grid)" stroke-width="1" ${sw}/>`;
  g+=`<g clip-path="url(#${cid})">`;
  const sp=A.sp;
  const MC=A.cams[0];
  if(sp.pan>0) g+=`<path d="${wedge(MC.x,A.cy,sp.reach,sp.hfov/2+sp.pan,MC.aim)}" fill="var(--accent)" fill-opacity=".07" stroke="var(--accent)" stroke-opacity=".4" stroke-dasharray="4 4" stroke-width="1" ${sw}/>`;
  g+=`<path d="${wedge(MC.x,A.cy,sp.reach,sp.hfov/2,MC.aim)}" fill="var(--accent)" fill-opacity=".16" stroke="var(--accent)" stroke-width="1.5" ${sw}/>`;
  if(sp.mic>0){
    g+=`<circle cx="${MC.x}" cy="${A.cy}" r="${sp.mic}" fill="none" stroke="var(--mic)" stroke-opacity=".55" stroke-dasharray="2 4" stroke-width="1.2" ${sw}/>`;
    g+=`<circle cx="${MC.x}" cy="${A.cy}" r="${A.micPlan}" fill="var(--mic)" fill-opacity=".09" stroke="var(--mic)" stroke-width="1.4" ${sw}/>`;
  }
  A.mics.forEach(mc=>{g+=`<circle cx="${mc.x}" cy="${mc.y}" r="${A.ad.r}" fill="var(--mic)" fill-opacity=".08" stroke="var(--mic)" stroke-width="1.2" ${sw}/>`});
  A.cams.filter(k=>!k.main).forEach(k=>{
    if(k.pan>0) g+=`<path d="${wedge(k.x,k.y,k.reach,k.hfov/2+k.pan,k.aim)}" fill="var(--cam2)" fill-opacity=".05" stroke="var(--cam2)" stroke-opacity=".4" stroke-dasharray="4 4" stroke-width="1" ${sw}/>`;
    g+=`<path d="${wedge(k.x,k.y,k.reach,k.hfov/2,k.aim)}" fill="var(--cam2)" fill-opacity=".13" stroke="var(--cam2)" stroke-width="1.3" ${sw}/>`;
    if(k.mic>0) g+=`<circle cx="${k.x}" cy="${k.y}" r="${k.mic}" fill="var(--mic)" fill-opacity=".07" stroke="var(--mic)" stroke-width="1.2" ${sw}/>`;
  });
  if(A.au&&A.au.spk) A.au.spk.pts.forEach(p=>{g+=`<circle cx="${p.x}" cy="${p.y}" r="${A.au.spk.r}" fill="var(--spk)" fill-opacity=".05" stroke="var(--spk)" stroke-opacity=".6" stroke-dasharray="1 3" stroke-width="1.2" ${sw}/>`;});
  g+=`</g>`;
  g+=`<rect x="0" y="0" width="${W}" height="${D}" fill="none" stroke="var(--ink)" stroke-width="2" ${sw}/>`;
  const poly=(o,fill,stroke)=>{const r=o.rot*Math.PI/180, u=[Math.cos(r),Math.sin(r)], v=[-Math.sin(r),Math.cos(r)];
    const pts=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,b])=>`${o.cx+a*o.w/2*u[0]+b*o.h/2*v[0]},${o.cy+a*o.w/2*u[1]+b*o.h/2*v[1]}`).join(" ");
    return `<polygon points="${pts}" fill="${fill}" stroke="${stroke}" stroke-width="1" ${sw}/>`;};
  (L.obstacles||[]).forEach(o=>{g+=poly(o,/^door/.test(o.kind)?"none":"var(--grid)","var(--muted)");});
  (L.tables||[]).forEach(t=>{g+=poly(t,"var(--table)","var(--muted)");});
  if(L.kind==="board"&&!L.tables) g+=`<rect x="${L.cx-L.tw/2}" y="${L.y0}" width="${L.tw}" height="${L.len}" rx="0.06" fill="var(--table)" stroke="var(--muted)" stroke-width="1" ${sw}/>`;
  L.desks.forEach(k=>{g+=`<rect x="${k.x0}" y="${k.y-k.dep/2}" width="${k.x1-k.x0}" height="${k.dep}" fill="var(--table)" stroke="var(--muted)" stroke-width="1" ${sw}/>`;});
  if(L.lectern) g+=`<rect x="${L.lectern.x-0.3}" y="${L.lectern.y-0.2}" width="0.6" height="0.4" fill="var(--table)" stroke="var(--ink)" stroke-width="1" ${sw}/>`;
  if(A.I&&S.cab.show) A.I.runs.forEach(r=>{if(!r.pts) return;
    g+=`<polyline points="${r.pts.map(p=>p[0]+","+p[1]).join(" ")}" fill="none" stroke="var(--${r.type==="HDMI"?"hdmi":r.type==="CAT6"?"cat6":r.type==="Speaker"?"spk":"muted"})" stroke-opacity=".7" stroke-dasharray="3 2" stroke-width="1.2" ${sw}/>`;});
  if(A.I){const k=A.I.rack; g+=`<rect x="${k[0]-0.2}" y="${k[1]-0.2}" width="0.4" height="0.4" fill="none" stroke="var(--cat6)" stroke-width="1.5" ${sw}/><text x="${k[0]}" y="${k[1]+fs*0.3}" text-anchor="middle" font-size="${fs*0.7}" font-family="Consolas,monospace" fill="var(--cat6)">RACK</text>`;}
  A.mics.forEach(mc=>{g+=`<circle cx="${mc.x}" cy="${mc.y}" r="${fs*0.35}" fill="var(--mic)"/>`});
  if(A.au&&A.au.spk) A.au.spk.pts.forEach(p=>{g+=`<circle cx="${p.x}" cy="${p.y}" r="0.16" fill="var(--sheet)" stroke="var(--spk)" stroke-width="2" ${sw}/><text x="${p.x}" y="${p.y+fs*0.3}" text-anchor="middle" font-size="${fs*0.75}" font-weight="700" font-family="Consolas,monospace" fill="var(--spk)">S</text>`;});
  const col2={ok:"var(--ok)",warn:"var(--warn)",bad:"var(--bad)"};
  A.seats.forEach((s,i)=>{
    g+=`<circle cx="${s.x}" cy="${s.y}" r="0.22" fill="${col2[s.st]}" fill-opacity=".9" stroke="var(--sheet)" stroke-width="1.5" ${sw}/>`;
    g+=`<text x="${s.x}" y="${s.y+fs*0.35}" text-anchor="middle" font-size="${fs*0.9}" font-family="Consolas,monospace" fill="var(--sheet)">${s.presenter?"P":i+1}</text>`;
  });
  A.cams.filter(k=>!k.main).forEach((k,i)=>{
    g+=`<g transform="translate(${k.x} ${k.y}) rotate(${-k.aim})"><rect x="-0.11" y="-0.07" width="0.22" height="0.14" rx="0.03" fill="var(--cam2)"/><rect x="-0.04" y="0.06" width="0.08" height="0.05" fill="var(--cam2)"/></g>`;
    const lx=k.x+0.36*Math.sin(k.aim/DEG), ly=k.y+0.36*Math.cos(k.aim/DEG)+fs*0.3;
    g+=`<text x="${lx}" y="${ly}" text-anchor="middle" font-size="${fs*0.8}" font-family="Consolas,monospace" font-weight="600" fill="var(--cam2)">C${i+2}</text>`;
  });
  const bw = (d.board ? d.board*0.0254*0.8716 : 0.9)*(d.dualBoard?2:1);
  if(L.main) g+=`<g transform="translate(${L.main.x} ${L.main.y}) rotate(${-L.main.aim})"><rect x="${-bw/2}" y="-0.065" width="${bw}" height="0.13" fill="var(--ink)"/></g>`;
  else g+=`<rect x="${L.cx-bw/2}" y="-0.05" width="${bw}" height="0.13" fill="var(--ink)"/>`;
  g+=`<text x="${W/2}" y="${-m*0.45}" text-anchor="middle" font-size="${fs}" font-family="Consolas,monospace" fill="var(--muted)">${fmt(W)} m${L.main?"":" · display wall"}</text>`;
  g+=`<text transform="translate(${-m*0.45} ${D/2}) rotate(-90)" text-anchor="middle" font-size="${fs}" font-family="Consolas,monospace" fill="var(--muted)">${fmt(D)} m</text>`;
  g+=`<text x="${W}" y="${D+m*0.6}" text-anchor="end" font-size="${fs*0.85}" font-family="Consolas,monospace" fill="var(--muted)">grid 1 m</text>`;
  return g+`</svg>`;
}

/* ---------- UI ---------- */
function deviceOptions(sel){
  let h="";VENDORS.forEach(v=>{
    h+=`<optgroup label="${v}">`+CATALOG.filter(d=>d.v===v).map(d=>`<option value="${d.id}"${d.id===sel?" selected":""}>${esc(d.v+" "+d.name)}</option>`).join("")+`</optgroup>`;
  });return h;
}
function srcTag(d,k){
  if(specs[d.id][k]!==d[k]) return '<span class="src">edited</span>';
  return d.src[k]?'<span class="src ds">datasheet</span>':'<span class="src">est.</span>';
}
function buildPlans(){
  const n=S.compare?2:1, box=$("plans"); box.innerHTML="";
  for(let c=0;c<n;c++){
    const d=byId(S.dev[c]), sp=specs[d.id], v=S.view[c];
    const el=document.createElement("article"); el.className="sheet plan"; el.dataset.col=c;
    el.innerHTML=`
      <div class="plan-head">
        <div><span class="tag">${c?"B":"A"}</span><span class="label">${d.board?"Display with integrated camera":"Video bar"}</span></div>
        <div class="seg" role="group" aria-label="View">
          <button data-v="3d" aria-pressed="${v==="3d"}">3D view</button>
          <button data-v="2d" aria-pressed="${v==="2d"}">2D plan</button>
        </div>
      </div>
      <div class="field"><label class="label" for="dev${c}">Device</label><select id="dev${c}">${deviceOptions(d.id)}</select></div>
      <div class="specs">
        ${SPEC_KEYS.map(k=>`<div class="field"><label class="label" for="${k}${c}">${{hfov:"HFOV °",reach:"Cam reach m",mic:"Mic pickup m"}[k]}</label>
          <input id="${k}${c}" type="number" step="${k==="hfov"?1:0.5}" min="${k==="hfov"?30:k==="mic"?0:1}" max="${k==="hfov"?180:15}" value="${sp[k]}"><span id="src${k}${c}">${srcTag(d,k)}</span></div>`).join("")}
      </div>
      <div class="extcams" id="ext${c}"></div>
      <div class="extcams" id="aud${c}"></div>
      <div class="toolbar3d" id="tb${c}" ${v==="3d"?"":"hidden"}>
        <button class="mini" data-cam="orbit">Perspective</button>
        <button class="mini" data-cam="top">Top</button>
        <button class="mini" data-cam="side">Side</button>
        <button class="mini" data-cam="pov">Camera view</button>
        <span id="povx${c}" style="display:contents"></span>
        <span class="sp"></span>
        <button class="mini" data-act="vrc" title="Save as a Video Room Calculator file (collabexperience.com)">VRC file…</button>
        <button class="mini" data-act="png">Save image…</button>
      </div>
      <div class="box3d" id="g3d${c}" ${v==="3d"?"":"hidden"}><div class="msg">Loading 3D view…</div></div>
      <div class="svgbox" id="svg${c}" ${v==="2d"?"":"hidden"}></div>
      <div class="verdict" id="ver${c}"></div>
      <ul class="notes" id="note${c}"></ul>
      <div class="legend">
        <span><i class="sw" style="background:var(--ok)"></i>Seen and heard</span>
        <span><i class="sw" style="background:var(--warn)"></i>Marginal</span>
        <span><i class="sw" style="background:var(--bad)"></i>Not covered</span>
        <span><i class="sw" style="background:var(--accent);opacity:.5"></i>Camera</span>
        <span><i class="sw" style="background:var(--cam2);opacity:.6"></i>Extra camera</span>
        <span><i class="sw" style="background:var(--mic);opacity:.6"></i>Mic</span>
        <span><i class="sw" style="background:var(--spk);opacity:.7"></i>Speaker</span>
      </div>`;
    box.appendChild(el);
    el.querySelector(".seg").addEventListener("click",e=>{
      const b=e.target.closest("button"); if(!b) return;
      S.view[c]=b.dataset.v; save();
      el.querySelectorAll(".seg button").forEach(x=>x.setAttribute("aria-pressed",x===b));
      $("g3d"+c).hidden=$("tb"+c).hidden=S.view[c]!=="3d"; $("svg"+c).hidden=S.view[c]!=="2d";
      if(window.View3D) window.View3D.resize(c);
    });
    $("tb"+c).addEventListener("click",e=>{
      const b=e.target.closest("button"); if(!b||!window.View3D) return;
      if(b.dataset.cam){window.View3D.setView(c,b.dataset.cam);markCam(c);}
      if(b.dataset.act==="png") savePng(c);
      if(b.dataset.act==="vrc") exportVrc(c);
    });
    $("dev"+c).addEventListener("change",e=>{
      S.dev[c]=e.target.value;
      const ok=extFor(S.dev[c]).map(x=>x.id);
      S.ext[c]=S.ext[c].filter(x=>ok.includes(x.cam)&&(!(x.xv||x.esv)||XVIEW.includes(S.dev[c])));
      save();buildPlans();render();
    });
    fillExt(c);
    fillAudio(c);
    $("aud"+c).addEventListener("change",e=>{
      const t=e.target, k=t.dataset.k; if(!k) return;
      if(k==="spk"||k==="spkN") delete S.audio[c].spkPts;
      if(k==="mic"||k==="micN") delete S.audio[c].micPts;
      S.audio[c][k]=t.type==="number"?Math.max(0,Math.min(60,Math.round(+t.value||0))):t.value;
      save(); fillAudio(c); render();
    });
    $("ext"+c).addEventListener("change",e=>{
      const t=e.target, i=+t.dataset.i;
      if(t.dataset.k==="xv") setCrossView(c,t.value);
      else if(t.dataset.k==="esv") setSpeakerView(c,t.checked);
      else if(t.dataset.k==="cam"){const x=S.ext[c][i]; x.cam=t.value; x.xv=x.esv=false; if(x.pos!=="custom"&&!posFor(extById(x.cam)).includes(x.pos)) x.pos=posFor(extById(x.cam))[0];}
      else if(t.dataset.k==="pos"){S.ext[c][i].pos=t.value; S.ext[c][i].xv=S.ext[c][i].esv=false; if(t.value!=="custom") delete S.ext[c][i].pose;}
      save(); fillExt(c); render();
    });
    $("ext"+c).addEventListener("click",e=>{
      const b=e.target.closest("button"); if(!b) return;
      if(b.dataset.k==="add"){
        const e0=extFor(S.dev[c])[0], used=S.ext[c].map(x=>x.pos), pos=posFor(e0).find(p=>!used.includes(p))||posFor(e0)[0];
        S.ext[c].push({cam:e0.id,pos});
      } else if(b.dataset.k==="del") S.ext[c].splice(+b.dataset.i,1);
      else return;
      save(); fillExt(c); render();
    });
    SPEC_KEYS.forEach(k=>$(k+c).addEventListener("input",e=>{
      const val=parseFloat(e.target.value); if(isNaN(val)) return;
      specs[d.id][k]=val; S.specs[d.id]={...specs[d.id]}; delete S.specs[d.id].pan;
      $("src"+k+c).innerHTML=srcTag(d,k); save(); render();
    }));
  }
  syncToggleState();
}
function fillAudio(c){
  const d=byId(S.dev[c]), a=S.audio[c], sel=(k,list)=>`<select data-k="${k}" aria-label="${k}">${list.map(o=>`<option value="${o.id}"${o.id===a[k]?" selected":""}>${esc(o.name)}</option>`).join("")}</select>`;
  const spk=audioFor(SPEAKERS,d.id), mic=audioFor(CEIL_MICS,d.id);
  if(!spk.some(o=>o.id===a.spk)) a.spk="none";
  if(!mic.some(o=>o.id===a.mic)) a.mic="device";
  $("aud"+c).innerHTML=`<div class="label">Audio system</div>
    <div class="row arow"><span class="hint">Speakers</span>${sel("spk",spk)}<input type="number" data-k="spkN" min="0" max="60" value="${a.spkN}" title="Number of speakers (0 = automatic)" aria-label="Number of speakers" ${a.spk==="none"?"disabled":""}></div>
    <div class="row arow"><span class="hint">Ceiling mics</span>${sel("mic",mic)}<input type="number" data-k="micN" min="0" max="60" value="${a.micN}" title="Number of ceiling mics (0 = automatic)" aria-label="Number of ceiling mics" ${a.mic==="device"?"disabled":""}></div>
    <div class="row arow"><span class="hint">External DSP</span>${sel("dsp",DSPS)}<span></span></div>
    <div class="hint">Count 0 = automatic from coverage. Cisco Ceiling Speaker Pro / Ceiling Mic Pro connect to the Cisco codec directly; Shure and Sennheiser are Dante and go through a DSP.</div>`;
}
const MAX_EXT=6;
const XV_POS={off:[],single:["left","right"],dual:["leftf","rightf","leftr","rightr"]};
function setCrossView(c,mode){
  S.ext[c]=S.ext[c].filter(x=>!x.xv);
  S.ext[c].unshift(...(XV_POS[mode]||[]).map(pos=>({cam:"cisco-ptz",pos,xv:true})));
}
function setSpeakerView(c,on){
  S.ext[c]=S.ext[c].filter(x=>!x.esv);
  if(on) S.ext[c].push({cam:"cisco-ptz",pos:"above",esv:true});
}
const xvMode=c=>{const n=S.ext[c].filter(x=>x.xv).length; return n>=4?"dual":n?"single":"off";};
function fillExt(c){
  const d=byId(S.dev[c]), list=extFor(d.id), box=$("ext"+c), xm=xvMode(c), esvOn=S.ext[c].some(x=>x.esv);
  let h=`<div class="label">Extra cameras</div>`;
  if(d.v==="Cisco"&&d.id!=="cisco-deskpro"){
    const can=XVIEW.includes(d.id);
    const opt=(v,t)=>`<option value="${v}"${xm===v?" selected":""}>${t}</option>`;
    h+=`<div class="row xvrow"><label class="xv${can?"":" off"}" for="xv${c}">Cisco cross-view</label>
      <select id="xv${c}" data-k="xv" ${can?"":"disabled"}>${opt("off","Off")}${opt("single","Cross-view · 2 × PTZ, one per side wall")}${opt("dual","Dual cross-view · 4 × PTZ, two per side wall")}</select></div>
      <label class="xv${can?"":" off"}"><input type="checkbox" data-k="esv" ${esvOn?"checked":""} ${can?"":"disabled"}> Extended Speaker View (PTZ above the screen)</label>
      <div class="hint">${can?"Cross-view: side-wall PTZ give face-on shots when people talk across the table; dual cross-view covers long tables with a front and rear PTZ on each wall. Extended Speaker View: a PTZ above the screen gives close-ups of far seats beyond the Quad Camera."
        :"Cross-view and Extended Speaker View need Cisco Room Kit EQ, EQX or Pro G2 with Room Vision PTZ. Choose one of those to enable them."}</div>`;
  }
  if(!list.length){box.innerHTML=h+`<div class="hint">${esc(d.name)} has no supported extension camera.</div>`;return;}
  S.ext[c].forEach((x,i)=>{
    const e=extById(x.cam);
    h+=`<div class="row"><select data-k="cam" data-i="${i}" aria-label="Extra camera ${i+2}">${list.map(o=>`<option value="${o.id}"${o.id===x.cam?" selected":""}>C${i+2} · ${esc(o.name)}</option>`).join("")}</select>
      <select data-k="pos" data-i="${i}" aria-label="Position of camera ${i+2}">${(x.pos==="custom"?["custom",...posFor(e)]:posFor(e)).map(p=>`<option value="${p}"${p===x.pos?" selected":""}>${POSITIONS[p]}</option>`).join("")}</select>
      <button class="mini" data-k="del" data-i="${i}" title="Remove camera">✕</button></div>`;
  });
  if(S.ext[c].length<MAX_EXT) h+=`<div><button class="mini" data-k="add">+ Add camera</button> <span class="hint">${esc(list.map(o=>o.name).join(", "))}</span></div>`;
  box.innerHTML=h;
}
function markCam(c){
  const mode=window.View3D?window.View3D.mode(c):"orbit";
  document.querySelectorAll(`#tb${c} [data-cam]`).forEach(b=>b.setAttribute("aria-pressed",b.dataset.cam===mode));
}
function syncToggleState(){$("sync").closest("label").classList.toggle("off",!S.compare);}

function render(){
  const L=layout(), n=S.compare?2:1, boq=$("boq"); boq.innerHTML=""; $("inst").innerHTML="";
  $("planv").textContent=S.plan+"%";
  for(let c=0;c<n;c++){
    const d=byId(S.dev[c]), A=analyse(d,L,c);
    $("povx"+c).innerHTML=A.cams.slice(1).map((k,i)=>`<button class="mini" data-cam="pov${i+1}" title="${esc(k.name)} · ${POSITIONS[k.pos]}">C${i+2} view</button>`).join("");
    $("svg"+c).innerHTML=svgPlan(d,L,A,c);
    if(window.View3D) window.View3D.update(c,$("g3d"+c),{d,L,A,S,I:A.I});
    const tot=A.seats.length;
    $("ver"+c).innerHTML=
      `<span class="pill ${A.bad?"bad":A.warn?"warn":"ok"}">${A.ok}/${tot} seats fully covered</span>`+
      `<span class="pill ${A.seen===tot?"ok":"warn"}">camera ${A.seen}/${tot}</span>`+
      (A.au&&A.au.spk?`<span class="pill ${A.au.spkCov===tot?"ok":"warn"}">speakers ${A.au.spk.pts.length} · ${A.au.spkCov}/${tot}</span>`:"")+
      `<span class="pill ${A.heardN===tot?"ok":"bad"}">audio ${A.heardN}/${tot}</span>`+
      `<span class="pill ${A.faceN===tot?"ok":"info"}" title="Seats seen face-on by some camera when people turn to talk across the table">${L.kind==="board"?"face-on across table":"face-on"} ${A.faceN}/${tot}</span>`+
      `<span class="pill info">display ≥ ${A.rec}"</span>`;
    const notes=noteList(d,L,A);
    $("note"+c).innerHTML=notes.map(t=>`<li>${esc(t)}</li>`).join("");
    boq.appendChild(boqBlock(d,A,c));
    if(A.I){const el=document.createElement("div"); el.innerHTML=installHtml(A.I,d,c); $("inst").appendChild(el);}
    markCam(c);
  }
  if(window.View3D) window.View3D.prune(n);
}
function noteList(d,L,A){
  const tot=A.seats.length, notes=[];
  if(!L.fits) notes.push("The table and seats don't fit this room. Reduce seats or enlarge the room.");
  if(L.kind==="board"&&tot>d.cap) notes.push(`${tot} seats exceeds the ${d.cap}-person sizing for ${d.name}.`);
  if(A.extra&&!A.ad.ext) notes.push(`${A.extra} × ${A.ad.name} added to cover the far seats.`);
  if(!A.ad.ext && A.heardN<tot && A.mics.length>=A.ad.max && A.ad.max>0) notes.push(`Maximum ${A.ad.max} add-on mics reached; consider ceiling mics, a DSP-based audio system or a larger device.`);
  if(A.heardN<tot && A.ad.max===0) notes.push(`${d.name} takes no add-on mics; choose a larger device.`);
  if(L.kind!=="board"){
    const pr=A.seats.find(s=>s.presenter);
    if(pr&&!pr.faceOn) notes.push("The presenter is not seen face-on. Add a rear-wall PTZ (presenter tracking) for lecture capture.");
    if(A.seen<tot) notes.push(`${tot-A.seen} positions are outside good camera coverage: add PTZ cameras on the rear or side walls (Extra cameras).`);
    if(pr&&!pr.audio) notes.push("Presenter position is outside mic pickup: add a lectern/wireless presenter mic.");
    if(A.diag>98) notes.push(`The back row needs a ~${fmt(A.diag,0)}" image (6× rule): use an LED wall or projection, or add repeater displays along the side walls.`);
    if(tot-1>d.cap) notes.push(`${LAYOUTS[L.kind]} of ${tot-1} seats: plan a dedicated audio system (ceiling mics + DSP + speakers).`);
  }
  const ext=A.cams.filter(k=>!k.main), nxv=ext.filter(k=>k.xv).length, xv=nxv>0;
  if(nxv>=4) notes.push(`Dual cross-view: two Room Vision PTZ on each side wall give face-on shots of ${A.faceN}/${tot} seats. Confirm the codec's camera count and dual cross-view support on Cisco's current docs, plus PoE+ to each PTZ.`);
  else if(xv) notes.push(`Cisco cross-view: Room Vision PTZ on both side walls give face-on shots of ${A.faceN}/${tot} seats when people talk across the table. Confirm RoomOS version and cabling (PoE to each PTZ).`);
  if(xv&&nxv<4&&L.kind==="board"&&L.len>4.5) notes.push(`The table is ${fmt(L.len)} m long: consider dual cross-view (two PTZ per side wall) so the far ends stay framed face-on.`);
  const esv=ext.find(k=>k.esv);
  if(esv) notes.push(`Extended Speaker View: Room Vision PTZ above the screen at ${fmt(esv.z,2)} m AFF frames close-ups of speakers up to ${fmt(esv.reach)} m away, beyond the main camera's ${fmt(A.sp.reach)} m.`);
  else if(XVIEW.includes(d.id)&&A.farthest>A.sp.reach) notes.push(`Back seats are ${fmt(A.farthest)} m away, beyond the main camera's ${fmt(A.sp.reach)} m reach: add Extended Speaker View (PTZ above the screen).`);
  else if(L.kind==="board"&&XVIEW.includes(d.id)&&A.faceN<tot) notes.push(`${tot-A.faceN} seats are seen only in profile when people talk across the table; turn on Cisco cross-view to fix that.`);
  else if(L.kind==="board"&&d.v==="Cisco"&&A.faceN<tot&&!ext.length&&tot>=6) notes.push(`Seats along the table are seen in profile in across-the-table conversation. Cisco cross-view (Room Kit EQ/EQX + two side PTZ) keeps them face-on.`);
  ext.filter(k=>k.hfov>=360).forEach(k=>notes.push(`${k.name} (${POSITIONS[k.pos].toLowerCase()}) covers ${fmt(k.reach)} m around it${k.mic?` and adds ${fmt(k.mic)} m mic pickup`:""}.`));
  if(ext.some(k=>k.ext.id==="cisco-ptz")&&!XVIEW.includes(d.id)) notes.push(`Confirm ${d.name} supports Room Vision PTZ as an extra camera (camera switching, not cross-view).`);
  if(typeof audioNotes==="function") notes.push(...audioNotes(d,A));
  if(A.sp.pan>0) notes.push(`Faint wedge shows extra coverage from motorized pan (±${A.sp.pan}°); framing those seats needs the camera to move.`);
  if(d.board && d.board<A.rec) notes.push(`The ${d.board}" screen is below the ${A.rec}" recommended for the farthest seat (${fmt(A.farthest)} m).`);
  if(!d.board) notes.push(`Farthest seat ${fmt(A.farthest)} m from the screen → ${A.rec}" display minimum (computed ${fmt(A.diag,0)}").`);
  return notes;
}
function boqRows(d,A){
  const r=[]; d.kit.forEach(k=>r.push([k,1,"Main endpoint"]));
  if(!d.board) r.push([`${A.rec}" 4K commercial display`,S.dual?2:1,S.dual?"Dual screen: people + content":"Single screen"]);
  const au=A.au;
  if(au&&au.spk){
    r.push([au.spk.name,au.spk.pts.length,`${au.spk.note}; ceiling grid over the seating area`]);
    r.push([au.spk.mount,au.spk.pts.length,"One per speaker"]);
  }
  if(au&&au.dsp) r.push([au.dsp.name,1,au.needDsp.length?au.needDsp.join("; "):"Selected"]);
  if(au&&au.spk&&au.spk.amp&&!(au.dsp&&au.dsp.amp)) r.push(["Power amplifier (size to speaker count, confirm model)",1,"For passive ceiling speakers"]);
  if(A.extra) r.push([A.ad.name,A.extra,A.ad.ext?"Ceiling array, replaces device/table mics":A.ad.ceil?"Ceiling mounted, covers the seating area":A.micPlan>0?`Coverage beyond ${fmt(A.micPlan)} m planning radius`:"Codec has no built-in mics"]);
  const grp={};
  A.cams.filter(k=>!k.main).forEach(k=>{const g=grp[k.ext.id]||(grp[k.ext.id]={name:k.name,n:0,pos:[],tags:new Set()}); g.n++; g.pos.push(POSITIONS[k.pos]);
    g.tags.add(k.xv?(A.cams.filter(q=>q.xv).length>=4?"Dual cross-view":"Cisco cross-view"):k.esv?"Extended Speaker View":"Extra camera");});
  Object.values(grp).forEach(g=>r.push([g.name,g.n,[...g.tags].join(" + ")+" · "+g.pos.join(", ")]));
  if(grp["cisco-ptz"]) r.push(["Wall mount for Room Vision PTZ",grp["cisco-ptz"].n,"Plus PoE+ switch port / CAT6 per camera"]);
  r.push([d.board?"Floor stand or wall mount":"Video bar display/wall mount",1,"Confirm with site survey"]);
  if(A.I) A.I.boq.forEach(x=>r.push(x));
  else r.push(["Cabling kit (HDMI/USB-C, CAT6 to LAN point)",1,"Per room"]);
  r.push(["Platform licence (Webex / Teams Rooms / Zoom Rooms)",1,"As per customer platform"]);
  return r;
}
function boqBlock(d,A,c){
  const rows=boqRows(d,A), el=document.createElement("div");
  el.innerHTML=`<div class="label">${c?"B":"A"} · ${esc(d.v+" "+d.name)} · ${S.W}×${S.D} m, ${S.seats} seats</div>
  <div class="tbl"><table><thead><tr><th>Item</th><th style="text-align:right">Qty</th><th>Note</th></tr></thead><tbody>
  ${rows.map(x=>`<tr><td>${esc(x[0])}</td><td class="q">${x[1]}</td><td class="n">${esc(x[2])}</td></tr>`).join("")}</tbody></table></div>
  <div class="btnrow"><button class="btn ghost" id="cp${c}">Copy for Excel</button><button class="btn ghost" id="vrc${c}" title="Save this option as a Video Room Calculator file">Export to Video Room Calculator</button><span class="status" id="cs${c}" role="status"></span></div>`;
  const tsv=["Vendor\tItem\tQty\tNote",...rows.map(x=>`${d.v}\t${x[0]}\t${x[1]}\t${x[2]}`)].join("\n");
  el.querySelector("#vrc"+c).addEventListener("click",()=>exportVrc(c));
  el.querySelector("#cp"+c).addEventListener("click",()=>{
    const done=()=>{el.querySelector("#cs"+c).textContent="Copied. Paste into your costing sheet."};
    const fail=()=>{let t=el.querySelector("textarea");if(!t){t=document.createElement("textarea");t.className="fallback";t.readOnly=true;el.appendChild(t);}
      t.value=tsv;t.select();el.querySelector("#cs"+c).textContent="Copy blocked here. The text is selected below; copy it manually.";};
    try{navigator.clipboard.writeText(tsv).then(done,fail)}catch(e){fail()}
  });
  return el;
}

/* ---------- files ---------- */
function slug(){return (S.name||"Room").replace(/[\\/:*?"<>|]+/g,"").trim()||"Room";}
async function savePng(c){
  if(!window.View3D) return;
  const url=window.View3D.snapshot(c,1600,900); if(!url) return;
  const d=byId(S.dev[c]), fname=`${slug()} - ${c?"B":"A"} ${d.v} ${d.name}.png`.replace(/"/g,"in");
  if(Host.api){
    try{const p=await Host.api.save_png(url,fname); if(p) status("Saved "+p);}catch(e){status("Could not save image: "+e);}
  }else{const a=document.createElement("a");a.href=url;a.download=fname;a.click();}
}
async function exportXlsx(){
  if(!Host.api){status("Excel export needs the desktop app (run planner_app.py).");return;}
  const L=layout(), n=S.compare?2:1, options=[];
  for(let c=0;c<n;c++){
    const d=byId(S.dev[c]), A=analyse(d,L,c);
    options.push({tag:c?"B":"A",vendor:d.v,device:d.name,rows:boqRows(d,A),notes:noteList(d,L,A),
      summary:{total:A.seats.length,ok:A.ok,warn:A.warn,bad:A.bad,camera:A.seen,audio:A.heardN,face:A.faceN,display:A.rec,
        extra_cams:A.cams.slice(1).map(k=>`${k.name} (${POSITIONS[k.pos]})`).join("; ")||"None",
        hfov:A.sp.hfov,reach:A.sp.reach,mic:A.sp.mic,addon_mics:A.extra},
      mount:A.I?A.I.mount.map(m=>[m.item,m.value,m.check,m.note]):[],
      runs:A.I?A.I.runs.map((r,i)=>[i+1,r.from,r.to,r.type==="HDMI"?`HDMI ${r.std} m`:r.type,r.purpose,r.len]):[],
      cabling:A.I?{route:ROUTES[S.cab.route],rack:RACKS[S.cab.rack],slack:S.cab.slack,loop:S.cab.loop,power:A.I.power.join(", ")}:null,
      image:window.View3D?window.View3D.snapshot(c,1280,720):null});
  }
  status("Exporting…");
  try{
    const p=await Host.api.export_boq({name:S.name,room:{layout:LAYOUTS[S.layout],W:S.W,D:S.D,H:S.H,seats:S.seats,tw:S.tw,gap:S.gap,plan:S.plan,dual:S.dual},options});
    status(p?"Exported "+p:"");
  }catch(e){status("Export failed: "+e);}
}
async function saveProject(){
  if(!Host.api){
    const a=document.createElement("a");a.href="data:application/json,"+encodeURIComponent(JSON.stringify(S,null,1));a.download=slug()+".room.json";a.click();return;
  }
  try{const p=await Host.api.save_project(S,slug()+".room.json"); if(p) status("Saved "+p);}catch(e){status("Save failed: "+e);}
}
async function openProject(){
  if(!Host.api){status("Open needs the desktop app.");return;}
  try{
    const s=await Host.api.open_project(); if(!s) return;
    if(s.error){status(s.error);return;}
    applyState(s.state); syncInputs(); buildPlans(); render(); save(); status("Opened "+s.path);
  }catch(e){status("Open failed: "+e);}
}

/* ---------- inputs ---------- */
const NUM_KEYS=["W","D","H","seats","tw","gap","plan"];
function syncInputs(){
  NUM_KEYS.forEach(k=>$(k).value=S[k]);
  document.querySelectorAll("[data-grp]").forEach(el=>{
    const v=S[el.dataset.grp][el.dataset.key];
    if(el.type==="checkbox") el.checked=!!v; else el.value=v;
  });
  document.querySelectorAll("#layoutSeg button").forEach(b=>b.setAttribute("aria-pressed",b.dataset.l===S.layout));
  document.querySelector('#layoutSeg [data-l="vrc"]').hidden=!S.vrc;
  $("tw").disabled=S.layout!=="board";
  ["seats","gap"].forEach(k=>$(k).disabled=S.layout==="vrc");
  $("gapLbl").textContent=S.layout==="board"?"Display to table (m)":"Display to first row (m)";
  $("pname").value=S.name||"";
  $("compare").checked=S.compare; $("dual").checked=S.dual; $("sync").checked=S.sync;
  $("presets").querySelectorAll(".chip").forEach(b=>b.setAttribute("aria-pressed",b.dataset.k===S.preset));
}
function wire(){
  $("presets").innerHTML=PRESETS.map(p=>`<button class="chip" data-k="${p.k}" aria-pressed="false">${p.label}</button>`).join("");
  $("presets").addEventListener("click",e=>{
    const b=e.target.closest(".chip"); if(!b) return;
    const p=PRESETS.find(x=>x.k===b.dataset.k); Object.assign(S,{preset:p.k,layout:p.layout,W:p.W,D:p.D,seats:p.seats,tw:p.tw,gap:p.gap},p.H?{H:p.H}:{});
    syncInputs();save();render();
  });
  NUM_KEYS.forEach(k=>$(k).addEventListener("input",e=>{
    const v=parseFloat(e.target.value); if(isNaN(v)) return;
    S[k]= k==="seats"?Math.max(1,Math.min(200,Math.round(v))):v; if(k!=="plan"&&k!=="H") S.preset="";
    $("presets").querySelectorAll(".chip").forEach(b=>b.setAttribute("aria-pressed",b.dataset.k===S.preset));
    save();render();
  }));
  $("pname").addEventListener("input",e=>{S.name=e.target.value;save();});
  $("layoutSeg").addEventListener("click",e=>{
    const b=e.target.closest("button"); if(!b) return;
    S.layout=b.dataset.l; S.preset=""; syncInputs(); save(); render();
  });
  document.querySelectorAll("[data-grp]").forEach(el=>el.addEventListener(el.tagName==="SELECT"||el.type==="checkbox"?"change":"input",()=>{
    const g=S[el.dataset.grp], k=el.dataset.key;
    if(el.type==="checkbox") g[k]=el.checked;
    else if(el.type==="number"){const v=parseFloat(el.value); if(isNaN(v)) return; g[k]=v;}
    else g[k]=el.value;
    save(); render();
  }));
  $("compare").addEventListener("change",e=>{S.compare=e.target.checked;save();buildPlans();render();});
  $("dual").addEventListener("change",e=>{S.dual=e.target.checked;save();render();});
  $("sync").addEventListener("change",e=>{S.sync=e.target.checked;save();if(window.View3D) window.View3D.setSync(S.sync);});
  $("exportXlsx").addEventListener("click",exportXlsx);
  $("saveProj").addEventListener("click",saveProject);
  $("openProj").addEventListener("click",openProject);
  $("importVrc").addEventListener("click",()=>importVrc()); // vrc.js loads after app.js
  document.addEventListener("keydown",e=>{
    if(!e.ctrlKey) return;
    const k=e.key.toLowerCase();
    if(k==="s"){e.preventDefault();saveProject();}
    else if(k==="o"){e.preventDefault();openProject();}
    else if(k==="e"){e.preventDefault();exportXlsx();}
    else if(k==="i"){e.preventDefault();importVrc();}
  });
}

/* Called by view3d.js once three.js has loaded. */
window.onView3DReady=()=>{if(window.__started){window.View3D.setSync(S.sync);render();}};

(async function start(){
  wire();
  await Host.ready;
  applyState(await loadSaved());
  syncInputs(); buildPlans(); render();
  window.__started=true;
  if(window.View3D){window.View3D.setSync(S.sync);render();}
})();
