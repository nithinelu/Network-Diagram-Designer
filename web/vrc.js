/* Export one option as a Video Room Calculator file (.vrc.json, collabexperience.com by Joe Hughes).
   VRC conventions (from its source, js/roomcalc.js): metres; x across roomWidth, y down roomLength, matching this app.
   Devices, chairs, displays, mics and speakers are stored by their CENTRE; tables by their UPPER-LEFT corner.
   rotation is clockwise degrees with 0 facing +y (into the room), so rotation = -aim. */
const VRC_MAIN={ // our device id -> [VRC data_deviceid, width m, depth m, has colour option]
  "cisco-bar":["roomBar",0.534,0.0644,1],"cisco-barpro":["roomBarPro",0.96,0.09,1],
  "cisco-board55":["brdPro55G2",1.278,0.092,0],"cisco-board75":["brdPro75G2",1.719,0.095,0],
  "cisco-eq":["roomKitEqQuadCam",0.95,0.1025,1],"cisco-pro":["roomKitProG2QuadCam",0.95,0.1025,1],
  "cisco-eqx":["roomKitEqx",3.362,0.152,0],"cisco-deskpro":["webexDeskPro",0.628,0.17,0],
};
const VRC_ROLES={crossview:0,extended_reach:1,presentertrack:2,presentertrack2:3};
const r3=v=>Math.round(v*10000)/10000;
const vrcId=()=>(crypto.randomUUID?crypto.randomUUID():"xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx".replace(/x/g,()=>(Math.random()*16|0).toString(16)));

function buildVrc(c){
  const L=layout(), d=byId(S.dev[c]), A=analyse(d,L,c), I=A.I, G=I.geo, items=[];
  const add=(o)=>items.push(Object.assign({data_vHeight:0},o,{id:vrcId()}));
  const dev=(deviceid,name,w,dep,x,y,rot,z,extra={})=>add({data_deviceid:deviceid,name,width:r3(w),height:r3(dep),
    x:r3(x),y:r3(y),...(z!=null?{data_zPosition:r3(z)}:{}),rotation:r3(rot||0),...extra});
  const light={data_color:{value:"light",index:0}};

  // main endpoint: against the display wall, or where the imported file had it
  const M=L.main||{x:L.cx,y:null,aim:0}, m=VRC_MAIN[d.id];
  if(m){
    const z=d.board?G.bottom:G.barZ-0.06;
    dev(m[0],d.v==="Cisco"?d.name:`${d.v} ${d.name}`,m[1],m[2],M.x,M.y??m[2]/2+0.01,-M.aim,z,m[3]?light:{});
  }else dev("unknownVideoDevice",`${d.v} ${d.name}`,d.board?G.dw:0.9,0.1,M.x,M.y??0.06,-M.aim,d.board?G.bottom:G.barZ-0.05);
  // separate displays (boards and EQX have their own screens)
  if(!d.board){
    const two=G.screens.length>1;
    dev(two?"displayDbl_2":"displaySngl_2",two?"Dual Displays":"Single Display",G.dw*(two?2:1)+(two?0.08:0),0.09,M.x,M.y??0.045,-M.aim,G.bottom,
      {data_diagonalInches:String(G.diag)});
  }
  // imported tables and room objects go back out as they came in (upper-left anchored)
  const ul=t=>{const r=t.rot*Math.PI/180; return {x:r3(t.cx-t.w/2*Math.cos(r)+t.h/2*Math.sin(r)),y:r3(t.cy-t.w/2*Math.sin(r)-t.h/2*Math.cos(r))};};
  (L.tables||[]).forEach(t=>add({data_deviceid:t.kind,name:"Table",width:r3(t.w),height:r3(t.h),...ul(t),rotation:t.rot,...(t.kind==="tblRect"?{tblRectRadius:0.1}:{})}));
  (L.obstacles||[]).forEach(o=>{
    if(VRC_UL.test(o.kind)) add({data_deviceid:o.kind,name:o.kind,width:r3(o.w),height:r3(o.h),...ul(o),rotation:o.rot,data_vHeight:o.hgt<S.H?r3(o.hgt):0});
    else dev(o.kind,o.kind,o.w,o.h,o.cx,o.cy,o.rot,null);
  });
  // seating: tables, desks, lectern, chairs, presenter
  if(L.kind==="board"&&!L.tables) add({data_deviceid:"tblRect",name:"Table Rect (round corners)",width:r3(L.tw),height:r3(L.len),
    x:r3(L.cx-L.tw/2),y:r3(L.y0),rotation:0,tblRectRadius:0.1});
  L.desks.forEach(k=>add({data_deviceid:"tblSchoolDesk",name:"Desk",width:r3(k.x1-k.x0),height:0.59,x:r3(k.x0),y:r3(k.y-0.295),rotation:0}));
  if(L.lectern) add({data_deviceid:"tblPodium",name:"Podium, round",width:0.6,height:0.6,x:r3(L.lectern.x-0.3),y:r3(L.lectern.y-0.3),rotation:0});
  A.seats.forEach(s=>{
    const fd=FACE[s.face]??s.faceDeg;
    if(s.presenter) dev("personStanding","Presenter",0.64,0.64,s.x,s.y,-fd,null);
    else dev("chair","Chair",0.64,0.64,s.x,s.y,-fd,null);
  });
  // touch controller on the table / lectern
  if(d.v==="Cisco"&&d.kit.some(k=>/navigator/i.test(k))){
    const T0=L.tables&&L.tables[0];
    const p=T0?[T0.cx,T0.cy,TABLE_TOP-0.03]:L.kind==="board"?[L.cx+0.4,L.y0+0.35,TABLE_TOP-0.03]:[L.lectern.x+0.3,L.lectern.y,1.0];
    dev("navigatorTable","Table Navigator",0.242,0.163,p[0],p[1],0,p[2],{data_role:{value:"navigator",index:0},...light});
  }
  // microphones
  A.mics.forEach((mc,i)=>{
    const ceil=!!A.ad.ceil, cisco=/cisco/i.test(A.ad.name);
    if(ceil) dev(cisco?"ceilingMicPro":"ceilingMic",A.ad.name,cisco?0.42:0.6,cisco?0.42:0.6,mc.x,mc.y,0,S.H-0.3,
      cisco?{...light,data_mount:{value:"ceilingMount",index:0}}:{});
    else dev(cisco?"tableMicPro":"tableMic",A.ad.name,cisco?0.098:0.064,cisco?0.098:0.064,mc.x,mc.y,0,TABLE_TOP-0.03,cisco?light:{});
  });
  // ceiling speakers
  if(A.au&&A.au.spk) A.au.spk.pts.forEach(p=>{
    const pro=A.au.spk.id==="cisco-csp";
    dev(pro?"loudspeakerPro":"loudspeaker",A.au.spk.name,pro?0.42:0.3,pro?0.42:0.3,p.x,p.y,0,S.H-0.05);
  });
  // extra cameras; wall cameras sit half their depth off the wall
  A.cams.filter(k=>!k.main).forEach(k=>{
    const a=k.aim*Math.PI/180;
    const off=k.pos==="custom"?0:1;
    if(k.ext.id==="cisco-ptz"){
      const role=k.xv?"crossview":k.esv?"extended_reach":k.pos==="rear"?"presentertrack":"presentertrack2";
      dev("ptzVision2","Room Vision PTZ Camera & Bracket",0.165,0.248,k.x+off*Math.sin(a)*0.07,k.y+off*Math.cos(a)*0.07,-k.aim,k.z,
        {data_role:{value:role,index:VRC_ROLES[role]},data_mount:{value:"stdMount",index:0},...light});
    }else if(k.ext.id==="cisco-quad") dev("quadCamExt","Quad Camera",0.95,0.1025,k.x+off*Math.sin(a)*0.05,k.y+off*Math.cos(a)*0.05,-k.aim,k.z,light);
    else dev("unknownCamera",k.name,0.35,0.35,k.x,k.y,-k.aim,k.z);
  });

  return {
    room:{roomWidth:S.W,roomLength:S.D,roomHeight:S.H},
    name:(S.name||"Room")+(S.compare?` (${c?"B":"A"} · ${d.v} ${d.name})`:""),
    date:new Date().toISOString(),roomId:vrcId(),version:"v0.1.672",unit:"meters",
    software:"Collab Room Planner",authorVersion:"",items,
    workspace:{removeDefaultWalls:false,addCeiling:false,theme:"regular"},
    overlaysVisible:{cameraCoverage:true,displayDistanceCoverage:false,microphoneCoverage:false,gridLines:true,speakerCoverage:false,overlayLabels:false},
    multiRoomFloorPlanMode:false,
    layers:[{name:"Default",visible:true,locked:false,layerid:"0"},{name:"Ceiling",visible:true,locked:false,layerid:"1"}],
    groups:[],customItems:[],
    roomSurfaces:Object.fromEntries(["leftwall","videowall","rightwall","backwall"].map(k=>[k,{type:"regular",acousticTreatment:false}])),
  };
}

/* ---------- import ---------- */
const VRC_TO_DEV=[[/^(roomBarPro|rmBarPro)/,"cisco-barpro"],[/^roomBar(Byod)?$/,"cisco-bar"],[/^(brdPro55|boardPro55)/,"cisco-board55"],
  [/^(brdPro75|boardPro75)/,"cisco-board75"],[/^roomKitEqx/,"cisco-eqx"],[/^(roomKitEq|codecEQ$)/,"cisco-eq"],
  [/^(roomKitPro|codecPro)/,"cisco-pro"],[/^webexDesk/,"cisco-deskpro"]];
const vrcDev=id=>{for(const [re,dev] of VRC_TO_DEV) if(re.test(id)) return dev; return null;};
const VRC_UL=/^(tbl|column|box|wall|stage|carpet|cylinder|couch|credenza)/; // stored by upper-left corner, the rest by centre

function parseVrc(json){
  const f=json.unit==="feet"?0.3048:1, R=json.room||{}, out={W:(R.roomWidth||6)*f,D:(R.roomLength||6)*f,H:(R.roomHeight||2.8)*f,
    name:json.name||"",seats:[],tables:[],obstacles:[],ext:[],ceilMics:[],tableMics:[],spk:null,lectern:null,main:null,devId:null,disp:null,skipped:{}};
  (json.items||[]).forEach(it=>{
    const id=it.data_deviceid||"", w=(it.width||0)*f, h=(it.height||0)*f, rot=it.rotation||0, r=rot*Math.PI/180;
    let x=(it.x||0)*f, y=(it.y||0)*f;
    if(VRC_UL.test(id)){x+=w/2*Math.cos(r)-h/2*Math.sin(r); y+=w/2*Math.sin(r)+h/2*Math.cos(r);}
    const z=it.data_zPosition!=null?it.data_zPosition*f:null, aim=-rot, role=it.data_role&&it.data_role.value;
    const dev=vrcDev(id);
    if(dev&&!out.main){out.main={x,y,aim,z}; out.devId=dev; return;}
    if(/^display/.test(id)){
      if(!out.disp) out.disp={diag:parseFloat(it.data_diagonalInches)||55,count:/Dbl|Trpl/.test(id)?2:1,bottom:z??0.9,x,y,aim};
      return;
    }
    if(/^(chair|chairHigh|chairSwivel)$/.test(id)){out.seats.push({x,y,faceDeg:aim}); return;}
    if(/^personStanding/.test(id)){out.seats.push({x,y,faceDeg:aim,presenter:true}); return;}
    if(id==="tblPodium"){out.lectern={x,y}; return;}
    if(/^tbl/.test(id)){out.tables.push({cx:x,cy:y,w,h,rot,kind:id}); return;}
    if(/^(ptzVision|ptz4k|cameraP60)/.test(id)){
      out.ext.push({cam:"cisco-ptz",pos:"custom",pose:{x,y,aim,z:z??1.9},xv:/^crossview/.test(role||""),esv:role==="extended_reach"});
      return;
    }
    if(/^quadCam/.test(id)){out.ext.push({cam:"cisco-quad",pos:"custom",pose:{x,y,aim,z:z??1.9}}); return;}
    if(/^ceilingMic/.test(id)){out.ceilMics.push({x,y}); return;}
    if(/^tableMic/.test(id)){out.tableMics.push({x,y}); return;}
    if(/^(loudspeaker|speaker)/.test(id)){
      const sid=id==="loudspeakerPro"?"cisco-csp":"generic-spk";
      out.spk=out.spk||{id:sid,pts:[]}; out.spk.pts.push({x,y}); return;
    }
    if(/^(column|box|wall|door)/.test(id)){
      out.obstacles.push({cx:x,cy:y,w,h,rot,kind:id,hgt:/^door/.test(id)?0.02:(it.data_vHeight>0?it.data_vHeight*f:out.H)});
      return;
    }
    out.skipped[it.name||id]=(out.skipped[it.name||id]||0)+1;
  });
  return out;
}

/* Imported layout: the file's own seats, tables and endpoint position replace the generated room. */
function vrcLayout(){
  const V=S.vrc, main=V.main||{x:S.W/2,y:0.06,aim:0};
  const seats=V.seats.map(s=>({x:s.x,y:s.y,face:"x",faceDeg:s.faceDeg,presenter:!!s.presenter}));
  const aud=seats.filter(s=>!s.presenter), xs=aud.map(s=>s.x), ys=aud.map(s=>s.y);
  const y0=ys.length?Math.min(...ys):S.D/2, x0=xs.length?Math.min(...xs):S.W/2;
  return {kind:"board",vrc:true,cx:main.x,y0,len:Math.max(0.6,(ys.length?Math.max(...ys):y0)-y0),
    tw:Math.max(0.6,(xs.length?Math.max(...xs):x0)-x0),seats,desks:[],lectern:V.lectern,tables:V.tables,obstacles:V.obstacles,
    main:{x:main.x,y:main.y,aim:main.aim},fixedMics:V.tableMics.length?V.tableMics:null,dispDiag:V.disp?V.disp.diag:null,fits:true};
}

function applyVrc(json){
  const V=parseVrc(json);
  if(!V.seats.length&&!V.main) throw new Error("no chairs or Cisco endpoint found in the file");
  Object.assign(S,{W:+V.W.toFixed(2),D:+V.D.toFixed(2),H:+V.H.toFixed(2),layout:"vrc",preset:"",
    seats:V.seats.filter(s=>!s.presenter).length||S.seats});
  if(V.name) S.name=V.name;
  S.vrc={seats:V.seats,tables:V.tables,obstacles:V.obstacles,lectern:V.lectern,main:V.main,tableMics:V.tableMics,disp:V.disp};
  if(V.devId) S.dev[0]=V.devId;
  S.ext[0]=V.ext;
  const a=S.audio[0];
  if(V.spk){a.spk=V.spk.id; a.spkN=0; a.spkPts=V.spk.pts;} else {a.spk="none"; delete a.spkPts;}
  if(V.ceilMics.length){a.mic="cisco-cmp"; a.micN=0; a.micPts=V.ceilMics;} else {a.mic="device"; delete a.micPts;}
  if(V.disp){
    S.mount.bottom=+V.disp.bottom.toFixed(2); S.dual=V.disp.count>1;
    const dh=V.disp.diag*0.0254*0.4903;
    if(V.main&&V.main.z!=null) S.mount.bar=V.main.z>V.disp.bottom+dh/2?"above":"below";
  }
  const skipped=Object.entries(V.skipped).map(([k,n])=>n>1?`${n} × ${k}`:k);
  return {dev:V.devId?byId(V.devId):null,seats:V.seats.length,ptz:V.ext.length,skipped};
}

async function importVrc(){
  if(!Host.api){status("Import needs the desktop app.");return;}
  try{
    const r=await Host.api.open_vrc(); if(!r) return;
    if(r.error){status(r.error);return;}
    const res=applyVrc(JSON.parse(r.text));
    syncInputs(); buildPlans(); render(); save();
    status(`Imported ${r.path}: ${res.dev?res.dev.v+" "+res.dev.name:"no Cisco endpoint recognised (kept "+byId(S.dev[0]).name+")"}, ${res.seats} seats, ${res.ptz} extra camera(s)`+
      (res.skipped.length?`. Not imported: ${res.skipped.join(", ")}`:""));
  }catch(e){status("VRC import failed: "+(e.message||e));}
}

async function exportVrc(c){
  const d=byId(S.dev[c]), data=buildVrc(c), text=JSON.stringify(data,null,5);
  const fname=`${slug()}${S.compare?` - ${c?"B":"A"} ${d.v} ${d.name}`:""}.vrc.json`.replace(/"/g,"in");
  const generic=d.v!=="Cisco"?` (${d.v} devices appear as "Unknown Video Device" in the VRC)`:"";
  if(Host.api){
    try{const p=await Host.api.save_vrc(text,fname); if(p) status(`Saved ${p}${generic}`);}catch(e){status("VRC export failed: "+e);}
  }else{const a=document.createElement("a");a.href="data:application/json,"+encodeURIComponent(text);a.download=fname;a.click();}
}
