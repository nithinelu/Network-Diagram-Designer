/* Audio system per option: ceiling speakers, ceiling microphones and an external DSP.
   Loaded after app.js; analyse() calls audioPlan() and install() reads the result for cables and BOQ. */
const CISCO_AUDIO=["cisco-barpro","cisco-eq","cisco-eqx","cisco-pro","cisco-board55","cisco-board75"];
// cov = loudspeaker coverage angle; net = connects over the network (to the rack PoE switch); amp = needs an amplifier
const SPEAKERS=[
  {id:"none",name:"Built-in speakers only"},
  {id:"shure-mxn5",name:"Shure MXN5W-C networked ceiling speaker",cov:110,dante:1,net:1,
   mount:"Shure MXN5W-C tile bridge / backbox",note:"Dante, PoE"},
  {id:"cisco-csp",name:"Cisco Ceiling Speaker Pro",cov:120,net:1,for:CISCO_AUDIO,
   mount:"Cisco Ceiling Speaker Pro mounting kit",note:"Native to the Cisco codec, PoE"},
  {id:"generic-spk",name:"Ceiling loudspeaker 6.5\" (passive, confirm model)",cov:100,amp:1,
   mount:"Ceiling speaker backbox / tile rail",note:"Needs an amplifier"},
];
// r = planning pickup radius (m) under a ~2.8 m ceiling
const CEIL_MICS=[
  {id:"device",name:"Device mics + add-on mics"},
  {id:"cisco-cmp",name:"Cisco Ceiling Microphone Pro",r:4,for:["cisco-barpro","cisco-eq","cisco-eqx","cisco-pro"],native:1},
  {id:"shure-mxa920",name:"Shure MXA920 ceiling array",r:4.5,dante:1},
  {id:"senn-tcc2",name:"Sennheiser TeamConnect Ceiling 2",r:4.4,dante:1},
  {id:"senn-tccm",name:"Sennheiser TeamConnect Ceiling Medium",r:3.5,dante:1},
];
const DSPS=[
  {id:"auto",name:"Auto (add one when needed)"},
  {id:"none",name:"No external DSP"},
  {id:"shure-p300",name:"Shure IntelliMix P300 audio conferencing processor",dante:8},
  {id:"shure-imx",name:"Shure IntelliMix Room (software DSP)",dante:16},
  {id:"biamp-fx",name:"Biamp TesiraFORTÉ X 400",dante:16,amp:1},
  {id:"qsc-nano",name:"QSC Q-SYS Core Nano",dante:64},
];
const spkById=id=>SPEAKERS.find(x=>x.id===id)||SPEAKERS[0];
const micById=id=>CEIL_MICS.find(x=>x.id===id)||CEIL_MICS[0];
const dspById=id=>DSPS.find(x=>x.id===id)||DSPS[0];
const audioFor=(list,devId)=>list.filter(x=>!x.for||x.for.includes(devId));

/* Spread n points (or as many as radius r needs) evenly over the seating area. */
function gridPlace(L,r,n){
  const xs=L.seats.map(s=>s.x), ys=L.seats.map(s=>s.y);
  const x0=Math.max(0.4,Math.min(...xs)-0.4), x1=Math.min(S.W-0.4,Math.max(...xs)+0.4);
  const y0=Math.max(0.4,Math.min(...ys)-0.4), y1=Math.min(S.D-0.4,Math.max(...ys)+0.4);
  const w=Math.max(0.5,x1-x0), h=Math.max(0.5,y1-y0);
  let cols, rows;
  if(n>0){cols=Math.max(1,Math.min(n,Math.round(Math.sqrt(n*w/h)))); rows=Math.ceil(n/cols);}
  else{const sp=Math.max(0.8,r*1.4); cols=Math.max(1,Math.ceil(w/sp)); rows=Math.max(1,Math.ceil(h/sp)); n=cols*rows;}
  const pts=[];
  for(let j=0;j<rows;j++){
    const inRow=Math.min(cols,n-j*cols);
    for(let i=0;i<inRow;i++) pts.push({x:x0+w*(i+0.5)/inRow,y:y0+h*(j+0.5)/rows});
  }
  return pts;
}

function audioCfg(c){return Object.assign({spk:"none",spkN:0,mic:"device",micN:0,dsp:"auto"},(S.audio||[])[c]||{});}

/* Called from analyse(): returns ceiling-mic override (or null) and the speaker layout. */
function audioPlan(d,L,c){
  const a=audioCfg(c), spk=spkById(a.spk), mic=micById(a.mic);
  const okSpk=audioFor(SPEAKERS,d.id).includes(spk), okMic=audioFor(CEIL_MICS,d.id).includes(mic);
  const out={cfg:a,spk:null,mic:null,dsp:null,needDsp:[]};
  if(spk.id!=="none"&&okSpk){
    const r=Math.max(1.2,(S.H-1.2)*Math.tan(spk.cov/2*Math.PI/180));
    out.spk={...spk,r,pts:(a.spkPts&&a.spkPts.length?a.spkPts:gridPlace(L,r,a.spkN)).map(p=>({x:p.x,y:p.y,z:S.H}))};
    if(spk.dante) out.needDsp.push(`${spk.name} is Dante`);
    if(spk.amp) out.needDsp.push(`passive speakers need amplification`);
  }
  if(mic.id!=="device"&&okMic){
    const r=mic.r*S.plan/80; // planning slider (80% default) scales ceiling-mic pickup too
    out.mic={...mic,r,pts:(a.micPts&&a.micPts.length?a.micPts:gridPlace(L,r,a.micN)).map(p=>({x:p.x,y:p.y,z:S.H}))};
    if(mic.dante) out.needDsp.push(`${mic.name} is Dante`);
  }
  let dsp=dspById(a.dsp);
  if(dsp.id==="auto") dsp=out.needDsp.length?dspById(/shure/i.test(spk.name+mic.name)?"shure-p300":"biamp-fx"):null;
  else if(dsp.id==="none") dsp=null;
  out.dsp=dsp;
  return out;
}

function audioNotes(d,A){
  const au=A.au, notes=[], tot=A.seats.length; if(!au) return notes;
  if(au.spk){
    const cov=A.seats.filter(s=>au.spk.pts.some(p=>Math.hypot(s.x-p.x,s.y-p.y)<=au.spk.r)).length;
    notes.push(`${au.spk.pts.length} × ${au.spk.name} at ${fmt(S.H,1)} m: each covers ~${fmt(au.spk.r)} m radius at ear height; ${cov}/${tot} positions covered.`);
    if(cov<tot) notes.push(`${tot-cov} positions are outside speaker coverage: add speakers (or set Count to 0 for automatic).`);
  }else if(A.farthest>7) notes.push(`Back seats are ${fmt(A.farthest)} m from the built-in speakers: add ceiling speakers for even level.`);
  if(au.mic) notes.push(`${au.mic.pts.length} × ${au.mic.name} replace the device and table mics (${fmt(au.mic.r)} m pickup each).`);
  if(au.mic&&A.heardN<tot) notes.push(`${tot-A.heardN} positions are outside ceiling-mic pickup: raise the mic count (0 = automatic).`);
  if(au.needDsp.length&&!au.dsp) notes.push(`No DSP selected, but ${au.needDsp.join(" and ")}: add an external DSP.`);
  if(au.dsp){
    const ch=(au.mic&&au.mic.dante?au.mic.pts.length:0)+(au.spk&&au.spk.dante?au.spk.pts.length:0);
    notes.push(`External DSP: ${au.dsp.name}${au.needDsp.length?` (${au.needDsp.join("; ")})`:""}. Connect it to the ${d.codec?"codec":d.name} over USB/analog and confirm AEC reference routing.`);
    if(au.dsp.dante&&ch>au.dsp.dante) notes.push(`${ch} Dante devices exceed the ${au.dsp.dante} channels of ${au.dsp.name}: choose a larger DSP.`);
    if(au.spk&&au.spk.amp&&!au.dsp.amp) notes.push("Passive ceiling speakers: add a power amplifier sized for the speaker count.");
  }
  return notes;
}
