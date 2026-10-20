/* Mounting heights and cable-laying calculator for one option.
   Plan coordinates as everywhere else: x across the display wall, y away from it, z height above floor (m). */
const EYE_H=1.15;
const HDMI_STD=[1,1.5,2,3,5,7.5,10,15];
const RACKS={credenza:"Credenza under the display",behind:"Behind the display (in-wall box)",
  fl:"Front-left corner rack",fr:"Front-right corner rack",rl:"Rear-left corner rack",rr:"Rear-right corner rack"};
const ROUTES={ceiling:"Ceiling void",floor:"Raised floor / floor ducts",trunk:"Wall trunking (skirting level)"};
// How each extension camera is cabled: to the rack (PoE switch) or to the endpoint (codec / bar).
const EXT_CABLES={
  "cisco-ptz":[{type:"CAT6",to:"rack",what:"PoE+ (video, power, control)"}],
  "cisco-quad":[{type:"HDMI",to:"ep",what:"video"},{type:"CAT6",to:"ep",what:"control"}],
  "logi-sight":[{type:"CAT6",to:"ep",what:"Sight link (confirm cable)"}],
  "neat-center":[{type:"CAT6",to:"ep",what:"PoE link (confirm cable)"}],
  "generic-ptz":[{type:"CAT6",to:"rack",what:"IP / PoE (confirm)"}],
};
const deg=r=>r*180/Math.PI;
const up05=v=>Math.ceil(v*2)/2;
const tilt=a=>Math.abs(a)<0.5?"level":`${fmt(Math.abs(a),0)}° ${a>0?"down":"up"}`;

function geometry(d,A,L){
  const M=S.mount, diag=d.board||L.dispDiag||Math.min(A.rec,98), dw=diag*0.0254*0.8716, dh=diag*0.0254*0.4903, cx=L.cx;
  const two=d.dualBoard||(!d.board&&S.dual), bottom=M.bottom, top=bottom+dh;
  const xs=two?[cx-(dw/2+0.04),cx+dw/2+0.04]:[cx];
  let barZ=null, lensZ;
  if(d.board) lensZ=top-0.02;
  else{barZ=M.bar==="below"?bottom-0.09:top+0.09; lensZ=barZ;}
  return {diag,dw,dh,bottom,top,barZ,lensZ,screens:xs.map(x=>({x,z:bottom+dh/2})),
    topAll:Math.max(top,(barZ||0)+0.05),bw:d.codec?0.55:0.9};
}

function mountingRows(d,L,A,G){
  const M=S.mount, rows=[], seats=A.seats.filter(s=>!s.presenter);
  const near=Math.min(...seats.map(s=>vdist(L,s))), far=Math.max(...seats.map(s=>vdist(L,s)));
  const add=(item,value,check="",note="")=>rows.push({item,value,check,note});
  add("Display bottom edge",`${fmt(G.bottom,2)} m AFF`,
    L.kind!=="board"&&G.bottom<1.2?"warn":G.bottom<0.7?"warn":"ok",
    L.kind!=="board"&&G.bottom<1.2?"Flat floor: heads in front block the lower image. Raise to ≥ 1.2 m or use a raked floor.":G.bottom<0.7?"Very low; the table edge hides the lower image.":"");
  add(`Display centre / top edge (${G.diag}")`,`${fmt(G.bottom+G.dh/2,2)} / ${fmt(G.top,2)} m AFF`);
  if(G.barZ!==null) add(d.codec?"Camera (Quad Camera)":"Video bar / camera",`${fmt(G.barZ,2)} m AFF, ${M.bar} the display`);
  else add("Camera (built into the display)",`${fmt(G.lensZ,2)} m AFF`);
  const tN=deg(Math.atan2(G.lensZ-EYE_H,near)), tF=deg(Math.atan2(G.lensZ-EYE_H,far));
  const steep=G.lensZ>1.75||tN>25;
  add("Camera tilt to seated eyes",`${tilt(tN)} front row · ${tilt(tF)} back row`,steep?"warn":"ok",
    steep?(G.barZ!==null&&M.bar==="above"?"Camera looks down steeply: mount the bar below the display or lower the display.":"Camera looks down steeply: lower the display."):"Camera close to eye level.");
  const upA=deg(Math.atan2(G.top-EYE_H,near));
  add("Viewing angle to top of image, front row",`${fmt(upA,0)}° up at ${fmt(near)} m`,upA>30?"warn":"ok",
    upA>30?"Over ~30°: move the first row back or lower the display.":"");
  add("Back row distance",`${fmt(far)} m (6× rule allows ${fmt(6*G.dh)} m for ${G.diag}")`,far>6*G.dh?"warn":"ok",
    far>6*G.dh?"Image too small for the back row.":"");
  const clr=S.H-G.topAll;
  add("Clearance to ceiling",`${fmt(clr,2)} m`,clr<0.1?"bad":"ok",clr<0.1?"Display/bar does not fit under the ceiling.":"");
  if(L.vrc) add("Layout",`Imported from Video Room Calculator: ${seats.length} seats, endpoint at ${fmt(L.main.x,2)} / ${fmt(L.main.y,2)} m, facing ${fmt(L.main.aim,0)}°`);
  else if(L.kind==="board"){
    add("Display wall to table front edge",`${fmt(L.y0,2)} m`);
    const back=S.D-(L.y0+L.len)-(A.seats.some(s=>s.face==="f")?0.4:0);
    add("Last seat to rear wall",`${fmt(back,2)} m`,back<0.9?"warn":"ok",back<0.9?"Under 0.9 m: tight circulation behind chairs.":"");
  }else{
    add("Seating",`${L.rows} rows × up to ${L.perRow} seats, first row ${fmt(L.y0,2)} m from the display wall`);
    const back=S.D-(L.y0+L.len);
    add("Back row to rear wall",`${fmt(back,2)} m`,back<0.8?"warn":"ok",back<0.8?"Under 0.8 m: tight egress behind the back row.":"");
    add("Presenter / lectern",`${fmt(L.lectern.x,2)} m from left wall, ${fmt(L.lectern.y,2)} m from display wall`);
  }
  A.cams.filter(k=>!k.main).forEach((k,i)=>{
    const tilt=k.hfov>=360?"":` · tilt ${fmt(deg(Math.atan2(k.z-EYE_H,Math.max(1,k.reach*0.5))),0)}° down at mid-reach`;
    add(`C${i+2} ${k.name}`,`${fmt(k.z,2)} m AFF · ${fmt(k.y,2)} m from display wall · ${fmt(k.x,2)} m from left wall${tilt}`);
  });
  return rows;
}

/* ---- routing ---- */
function perim(p){
  const {W,D}=S, d=[["f",p[1]],["r",W-p[0]],["b",D-p[1]],["l",p[0]]].sort((a,b)=>a[1]-b[1])[0][0];
  if(d==="f") return {t:p[0],x:p[0],y:0};
  if(d==="r") return {t:W+p[1],x:W,y:p[1]};
  if(d==="b") return {t:W+D+(W-p[0]),x:p[0],y:D};
  return {t:2*W+D+(D-p[1]),x:0,y:p[1]};
}
function trunkPts(a,b,z=0.15){
  const {W,D}=S, P=2*(W+D), A=perim(a), B=perim(b), corners=[[W,W,0],[W+D,W,D],[2*W+D,0,D],[P,0,0]];
  let fwd=(B.t-A.t+P)%P, dir=fwd<=P/2?1:-1, pts=[a,[A.x,A.y,z]];
  const span=dir>0?fwd:P-fwd;
  const cs=[]; corners.forEach(([t,x,y])=>{const dt=dir>0?((t-A.t+P)%P):((A.t-t+P)%P); if(dt>0&&dt<span) cs.push([dt,x,y]);});
  cs.sort((u,v)=>u[0]-v[0]).forEach(([,x,y])=>pts.push([x,y,z]));
  pts.push([B.x,B.y,z],b);
  return pts;
}
function routePts(a,b,kind){
  const H=S.H, R=S.cab.route, front=p=>p[1]<=0.35;
  if(kind==="wall"&&front(a)&&front(b)) return [a,[a[0],0.03,a[2]],[a[0],0.03,b[2]],[b[0],0.03,b[2]],b]; // inside the display wall
  if(kind==="ceil"||R==="ceiling"&&kind==="wall") return [a,[a[0],a[1],H],[a[0],b[1],H],[b[0],b[1],H],b];
  if(kind==="wall"){
    if(R==="floor") return [a,[a[0],a[1],0],[a[0],b[1],0],[b[0],b[1],0],b];
    return trunkPts(a,b);
  }
  return null;
}
/* Table / lectern items go through the floor box, a ceiling drop, or a floor cable cover. */
function tablePts(a,b,fb){
  const R=S.cab.route, H=S.H, u=0.7;
  const tail=[[fb[0],fb[1],u],[b[0],b[1],u],b];
  if(!S.cab.floorBox&&R==="ceiling") return [a,[a[0],a[1],H],[a[0],fb[1],H],[fb[0],fb[1],H],...tail];
  if(R==="trunk"){
    const w=perim(fb), t=trunkPts(a,[w.x,w.y,0.15]);
    return [...t.slice(0,-1),[w.x,w.y,0],[fb[0],fb[1],0],...tail];
  }
  return [a,[a[0],a[1],0],[a[0],fb[1],0],[fb[0],fb[1],0],...tail];
}
const polyLen=pts=>pts.reduce((s,p,i)=>i?s+Math.hypot(p[0]-pts[i-1][0],p[1]-pts[i-1][1],p[2]-pts[i-1][2]):0,0);

function install(d,L,A,c){
  const G=geometry(d,A,L), M=S.mount, C=S.cab, W=S.W, D=S.D, cx=L.cx;
  const P0=L.main||{x:cx,y:0.06,aim:0}, pa=P0.aim*Math.PI/180, fy=P0.y;
  const rackP={credenza:[cx+Math.sin(pa)*0.25,fy+Math.cos(pa)*0.25,0.4],behind:[cx,fy,Math.max(0.3,G.bottom+0.2)],fl:[0.35,0.35,0.5],fr:[W-0.35,0.35,0.5],
    rl:[0.35,D-0.35,0.5],rr:[W-0.35,D-0.35,0.5]}[C.rack]||[cx,0.3,0.4];
  const ep=d.codec?rackP:d.board?[cx,fy,G.screens[0].z]:[cx,fy,G.barZ];
  const epName=d.codec?"Codec (rack)":d.board?d.name:"Video bar";
  const rows=L.kind!=="board";
  const T0=L.tables&&L.tables[0];
  const box=rows?[L.lectern.x,L.lectern.y,1.0]:T0?[T0.cx,T0.cy,TABLE_TOP+0.02]:[cx,L.y0+0.35,TABLE_TOP+0.02];
  const ctl=rows?[L.lectern.x+0.3,L.lectern.y,1.0]:T0?[T0.cx+0.3,T0.cy,TABLE_TOP+0.02]:[cx+0.4,L.y0+0.35,TABLE_TOP+0.02];
  const fb=rows?[L.lectern.x,L.lectern.y,0]:T0?[T0.cx,T0.cy,0]:[cx,L.y0+L.len/2,0];
  const runs=[];
  const run=(from,to,type,purpose,pts,raw)=>{
    raw=raw??polyLen(pts);
    let len=up05(raw*(1+C.slack/100)+2*C.loop), std=null, hdbt=false;
    if(type==="HDMI"){std=HDMI_STD.find(x=>x>=len)||null; if(!std){hdbt=true; type="CAT6"; purpose+=" via HDBaseT";}}
    runs.push({from,to,type,purpose,pts,raw,len,std,hdbt});
  };
  run("Rack","Network switch / IDF","CAT6","LAN uplink",null,C.uplink);
  if(ep!==rackP) run(epName,"Rack","CAT6","Endpoint network",routePts(ep,rackP,"wall"));
  if(d.codec) {
    const cam=[cx,fy,G.barZ];
    run("Quad Camera","Codec (rack)","HDMI","Camera video",routePts(cam,rackP,"wall"));
    run("Quad Camera","Codec (rack)","CAT6","Camera control",routePts(cam,rackP,"wall"));
  }
  if(!d.board) G.screens.forEach((s,i)=>run(epName,G.screens.length>1?`Display ${i+1}`:"Display","HDMI","Display video",routePts(ep,[s.x,fy,s.z],"wall")));
  run(rows?"Lectern panel":"Table box",epName,"HDMI","Content share (BYOD)",tablePts(ep,box,fb));
  if(d.kit.some(k=>/navigator|tap|pad|console/i.test(k))) run(rows?"Lectern controller":"Table controller",epName,"CAT6","Touch controller (PoE)",tablePts(ep,ctl,fb));
  A.mics.forEach((m,i)=>{
    const dante=A.ad.ext&&A.ad.ext.dante, type=dante||/cisco/i.test(A.ad.name)?"CAT6":"Vendor", p=[m.x,m.y,m.z??TABLE_TOP+0.02];
    const to=dante?rackP:ep;
    const pts=A.ad.ceil?routePts(to,p,"ceil"):tablePts(to,p,fb);
    run(`${A.ad.ceil?"Ceiling":"Table"} mic ${i+1}`,dante?"Rack (PoE switch → DSP)":epName,type,A.ad.name+(dante?" (Dante, PoE)":type==="CAT6"?" (PoE)":" cable"),pts);
  });
  const au=A.au;
  if(au&&au.spk) au.spk.pts.forEach((p,i)=>{
    const pts=routePts(rackP,[p.x,p.y,S.H],"ceil");
    if(au.spk.net) run(`Speaker ${i+1}`,"Rack (PoE switch)","CAT6",`${au.spk.name} (${au.spk.note})`,pts);
    else run(`Speaker ${i+1}`,au.dsp&&au.dsp.amp?"DSP amplifier (rack)":"Amplifier (rack)","Speaker","Loudspeaker feed, 2 × 1.5 mm²",pts);
  });
  if(au&&au.dsp&&ep!==rackP) run("DSP (rack)",epName,"CAT6","DSP ↔ endpoint audio (USB extender / analog, confirm)",routePts(rackP,ep,"wall"));
  A.cams.filter(k=>!k.main).forEach((k,i)=>{
    (EXT_CABLES[k.ext.id]||[]).forEach(cb=>{
      const to=cb.to==="rack"?rackP:ep, p=[k.x,k.y,k.z];
      const pts=k.hfov>=360?tablePts(to,p,fb):routePts(p,to,"wall");
      run(`C${i+2} ${k.name}`,cb.to==="rack"?"Rack (PoE switch)":epName,cb.type,`Camera ${cb.what}`,pts);
    });
  });

  // containment: union of route segments on a 0.25 m grid
  const cells=new Set();
  runs.forEach(r=>{if(!r.pts) return; for(let i=1;i<r.pts.length;i++){
    const a=r.pts[i-1], b=r.pts[i], n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2])/0.25);
    for(let j=0;j<n;j++){const t=(j+0.5)/n; cells.add([0,1,2].map(q=>Math.round((a[q]+(b[q]-a[q])*t)/0.25)).join(","));}
  }});
  const contain=up05(cells.size*0.25);
  const cat=runs.filter(r=>r.type==="CAT6"), catM=cat.reduce((s,r)=>s+r.len,0);
  const hdmi={}; runs.filter(r=>r.type==="HDMI").forEach(r=>{(hdmi[r.std]=hdmi[r.std]||[]).push(r.purpose);});
  const spkM=runs.filter(r=>r.type==="Speaker").reduce((s,r)=>s+r.len,0);
  const poe=runs.filter(r=>/PoE switch/.test(r.to)).length;
  const vendor={}; runs.filter(r=>r.type==="Vendor").forEach(r=>{vendor[r.purpose]=(vendor[r.purpose]||0)+1;});
  const hdbt=runs.filter(r=>r.hdbt).length;
  const boq=[];
  boq.push(["CAT6 U/UTP LSZH cable, 305 m box",Math.max(1,Math.ceil(catM/305)),`${cat.length} runs, ${fmt(catM,1)} m incl. ${C.slack}% slack`]);
  boq.push(["RJ45 connectors / keystone jacks",cat.length*2,"2 per CAT6 run"]);
  boq.push(["CAT6 patch cord 1 m",cat.length*2,"Device and rack patching"]);
  Object.keys(hdmi).map(Number).sort((a,b)=>a-b).forEach(l=>boq.push([`HDMI 2.0 cable ${l} m (4K60)`,hdmi[l].length,[...new Set(hdmi[l])].join(", ")]));
  if(hdbt) boq.push(["HDBaseT extender set (TX + RX)",hdbt,"HDMI runs over 15 m"]);
  Object.entries(vendor).forEach(([k,n])=>boq.push([k,n,"Vendor cable; check length options"]));
  boq.push([rows?"Lectern connectivity panel (HDMI + USB-C + power)":"Table connectivity box (HDMI + USB-C + power)",1,"Content share point"]);
  if(C.floorBox) boq.push(["Floor box with power and data",1,rows?"At the lectern":"Under the table"]);
  if(spkM) boq.push(["Loudspeaker cable 2 × 1.5 mm², metres",up05(spkM),"Amplifier to ceiling speakers"]);
  if(poe) boq.push(["PoE+ switch ports (AV VLAN, Dante/AES67 QoS)",poe,"Check the switch PoE budget"]);
  boq.push([`Cable containment (${ROUTES[C.route].toLowerCase()}), metres`,contain,"Estimate from the cable routes"]);
  const power=[...(d.board?[d.name]:G.screens.map((s,i)=>`Display ${G.screens.length>1?i+1:""}`.trim())),
    ...(d.board?[]:[d.codec?"Quad Camera":"Video bar"]),"Rack / codec",rows?"Lectern":"Table box",...(C.floorBox?["Floor box"]:[])];
  return {geo:G,mount:mountingRows(d,L,A,G),runs,boq,power,rack:rackP,ep,catM,contain,
    sum:{catRuns:cat.length,catM,boxes:Math.max(1,Math.ceil(catM/305)),hdbt,contain}};
}

function installHtml(I,d,c){
  const chk={ok:"✓",warn:"!",bad:"✕","":""};
  const longest=Math.max(...I.runs.filter(r=>r.type==="CAT6").map(r=>r.len),0);
  return `<div class="label">${c?"B":"A"} · ${esc(d.v+" "+d.name)}</div>
  <h3>Mounting</h3>
  <div class="tbl"><table><thead><tr><th>Item</th><th>Value</th><th></th><th>Note</th></tr></thead><tbody>
  ${I.mount.map(r=>`<tr><td>${esc(r.item)}</td><td class="mono">${esc(r.value)}</td><td class="chk ${r.check}">${chk[r.check]}</td><td class="n">${esc(r.note)}</td></tr>`).join("")}
  </tbody></table></div>
  <h3>Cable schedule <span class="hint">${esc(ROUTES[S.cab.route])} · rack: ${esc(RACKS[S.cab.rack])} · +${S.cab.slack}% slack, ${fmt(S.cab.loop,1)} m loop each end</span></h3>
  <div class="tbl"><table><thead><tr><th>#</th><th>From</th><th>To</th><th>Cable</th><th>Purpose</th><th style="text-align:right">Length m</th></tr></thead><tbody>
  ${I.runs.map((r,i)=>`<tr><td class="q">${i+1}</td><td>${esc(r.from)}</td><td>${esc(r.to)}</td><td><span class="ct ${r.type}">${r.type==="HDMI"?`HDMI ${r.std} m`:r.type==="Speaker"?"Speaker 2×1.5":r.type}</span></td><td class="n">${esc(r.purpose)}</td><td class="q">${fmt(r.len,1)}</td></tr>`).join("")}
  </tbody></table></div>
  <div class="verdict">
    <span class="pill info">CAT6 ${I.sum.catRuns} runs · ${fmt(I.sum.catM,1)} m · ${I.sum.boxes} × 305 m box</span>
    <span class="pill ${longest>90?"bad":"info"}">longest CAT6 ${fmt(longest,1)} m${longest>90?" (over 90 m!)":""}</span>
    <span class="pill info">containment ≈ ${fmt(I.sum.contain,1)} m</span>
    ${I.sum.hdbt?`<span class="pill warn">${I.sum.hdbt} HDMI run(s) need HDBaseT</span>`:""}
  </div>
  <p class="n">Power points needed: ${esc(I.power.join(", "))}.</p>`;
}
