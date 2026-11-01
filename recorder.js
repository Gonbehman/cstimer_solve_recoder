(()=>{
'use strict';
const VERSION='0.5.0';
if(document.getElementById('cst-solve-recorder')){
  console.warn('[csTimer Recorder] 別の版がすでに動いています。古い拡張機能をオフにしてください。');
  return;
}

// ===== 設定（ポップアップで変更） =====
const DEFAULTS={thresholdOn:true,threshold:30,bestOn:true,preRoll:3,postRoll:1.5,holdSec:60,previewShow:true,previewWidth:240};
let settings={...DEFAULTS};
const MAX_RECORD_MS=5*60*1000;  // 超えたら破棄
const POLL_MS=400;              // 記録追加の確認間隔
const SEG_STEP_MS=1000;         // 先行録画を新しく始める間隔（遡り精度）

let stream=null,mime='',state='idle'; // idle | recording | finishing
let recorder=null,chunks=[],baseCount=null,startedAt=0,pollTimer=null,dbPromise=null;
let segs=[],segTimer=null;      // 先行録画（待機中に常時回しておく）
let forceThis=false,held=null,heldTimer=null;

// ---------- 表示 ----------
const host=document.createElement('div');host.id='cst-solve-recorder';
host.style.cssText='position:fixed!important;right:12px!important;top:12px!important;z-index:2147483647!important;pointer-events:none!important;';
const shadow=host.attachShadow({mode:'closed'});
shadow.innerHTML=`<style>
 .box{position:relative;font:12px system-ui,sans-serif;color:#fff}
 .vw{position:relative}
 video{display:block;width:100%;border-radius:6px;transform:scaleX(-1);background:#000;opacity:.85}
 .st{position:absolute;left:6px;top:6px;padding:2px 7px;border-radius:9px;background:rgba(0,0,0,.6)}
 .rec{background:#d22}.force{background:#e08a00}
 .bar{display:flex;flex-wrap:wrap;gap:6px;align-items:center;justify-content:flex-end;margin-top:4px}
 button{pointer-events:auto;font:12px system-ui,sans-serif;padding:4px 8px;border:0;border-radius:5px;background:#e08a00;color:#111;cursor:pointer}
 button:disabled{background:#666;color:#ddd;cursor:default}
 button.on{background:#ffd23f}
 .info{background:rgba(0,0,0,.6);padding:2px 6px;border-radius:5px}</style>
 <div class="box"><div class="vw"><video muted playsinline autoplay></video><div class="st">カメラ準備中</div></div>
 <div class="bar"><span class="info"></span><button type="button">強制保存</button></div></div>`;
const box=shadow.querySelector('.box'),vw=shadow.querySelector('.vw'),video=shadow.querySelector('video');
const badge=shadow.querySelector('.st');
const forceBtn=shadow.querySelector('button'),info=shadow.querySelector('.info');
document.documentElement.append(host);
forceBtn.addEventListener('mousedown',e=>e.preventDefault());
forceBtn.addEventListener('click',e=>{e.stopPropagation();forceSave();forceBtn.blur();});

function applyLayout(){
  const w=Math.min(1200,Math.max(80,Number(settings.previewWidth)||240));
  box.style.width=(settings.previewShow?w:Math.max(w,200))+'px';
  video.style.display=settings.previewShow?'block':'none';
  vw.style.minHeight=settings.previewShow?'':'24px';
}
function status(text,rec=false){badge.textContent=text;badge.classList.toggle('rec',rec);}
function idleText(){return '待機中 v'+VERSION;}
function updateInfo(){
  const c=[];
  if(settings.thresholdOn)c.push(`≤${Number(settings.threshold).toFixed(2)}s`);
  if(settings.bestOn)c.push('ベスト更新');
  info.textContent=c.length?c.join(' / '):'強制のみ';
  forceBtn.disabled=!(state!=='idle'||held);
  forceBtn.classList.toggle('on',forceThis);
  forceBtn.textContent=state!=='idle'?(forceThis?'保存予約済み':'この回を保存'):held?'直前を保存':'強制保存';
}
function later(msg){status(msg);setTimeout(()=>{if(state==='idle')status(idleText());},2500);}

chrome.storage.local.get(DEFAULTS).then(v=>{settings={...DEFAULTS,...v};applyLayout();updateInfo();restartBuffer();});
chrome.storage.onChanged.addListener((c,a)=>{
  if(a!=='local')return;
  for(const k in DEFAULTS)if(c[k])settings[k]=c[k].newValue??DEFAULTS[k];
  applyLayout();updateInfo();if(c.preRoll)restartBuffer();
});

// ---------- 記録の読み取り（読み取り専用） ----------
function parse(s,f){try{return JSON.parse(s)??f;}catch(_){return f;}}
function selectedId(){
  const sel=document.querySelector('select#session, #session select, #stats select[name="session"]');
  const v=Number(sel?.value);if(Number.isInteger(v)&&v>0)return v;
  const n=Number(parse(localStorage.getItem('properties'),{}).session);
  return Number.isInteger(n)&&n>0?n:null;
}
function bridge(){return new Promise(resolve=>{
  const token=crypto.randomUUID();
  const done=v=>{clearTimeout(to);removeEventListener('message',ls);resolve(v);};
  const ls=e=>{if(e.source===window&&e.data?.type==='CST_REC_RESPONSE_V1'&&e.data.token===token)done(e.data);};
  const to=setTimeout(()=>done({}),1100);
  addEventListener('message',ls);
  postMessage({type:'CST_REC_REQUEST_V1',token},location.origin);
});}
async function database(){
  if(dbPromise)return dbPromise;
  dbPromise=(async()=>{
    if(indexedDB.databases){const l=await indexedDB.databases();if(!l.some(d=>d.name==='cstimer'))return null;}
    return new Promise((res,rej)=>{
      const req=indexedDB.open('cstimer');
      req.onupgradeneeded=()=>req.transaction.abort();
      req.onerror=()=>rej(new Error('IndexedDBを開けません'));
      req.onsuccess=()=>{const db=req.result;if(!db.objectStoreNames.contains('sessions')){db.close();res(null);return;}db.onversionchange=()=>{db.close();dbPromise=null;};res(db);};
    });
  })().catch(e=>{dbPromise=null;throw e;});
  const db=await dbPromise;if(!db)dbPromise=null;return db;
}
function numKey(n){const s=String(n);return String.fromCharCode(47+s.length)+s;}
async function storedRows(id){
  const db=await database();
  if(db)return new Promise((res,rej)=>{
    const prefix='session_'+numKey(id)+'_',out=[];
    const tx=db.transaction('sessions','readonly');
    const req=tx.objectStore('sessions').openCursor(IDBKeyRange.bound(prefix,prefix+'\uffff'));
    req.onsuccess=()=>{const c=req.result;if(!c)return;if(Array.isArray(c.value))out.push(...c.value);c.continue();};
    tx.oncomplete=()=>res(out);tx.onerror=()=>rej(new Error('読み取り失敗'));tx.onabort=tx.onerror;
  });
  const rows=parse(localStorage.getItem('session'+id),null);
  if(Array.isArray(rows))return rows;
  throw new Error('記録を取得できません');
}
async function currentRows(){
  const b=await bridge();
  const id=Number(b.id)>0?Number(b.id):selectedId();
  if(!id)throw new Error('セッション不明');
  return {id,rows:Array.isArray(b.rows)?b.rows:await storedRows(id)};
}

// ---------- カメラ ----------
function pickMime(){
  for(const m of ['video/mp4;codecs=avc1','video/mp4','video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'])
    if(MediaRecorder.isTypeSupported(m))return m;
  return '';
}
async function initCamera(){
  try{
    stream=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:1280},height:{ideal:720},frameRate:{ideal:60}},audio:false});
    video.srcObject=stream;mime=pickMime();
    status(idleText());restartBuffer();
  }catch(e){status('カメラ不可: '+(e.name||e.message));stream=null;}
}
function newSeg(){
  const seg={chunks:[],start:performance.now(),rec:new MediaRecorder(stream,mime?{mimeType:mime,videoBitsPerSecond:8_000_000}:undefined)};
  seg.rec.ondataavailable=e=>{if(e.data.size)seg.chunks.push(e.data);};
  seg.rec.start(500);
  return seg;
}
function dropSeg(seg){try{seg.rec.ondataavailable=null;if(seg.rec.state!=='inactive')seg.rec.stop();}catch(_){}}

// ---------- 先行録画（遡り用） ----------
function restartBuffer(){
  stopBuffer();
  if(!stream||state!=='idle'||!(Number(settings.preRoll)>0))return;
  segs.push(newSeg());
  segTimer=setInterval(()=>{
    if(state!=='idle'){stopBuffer();return;}
    segs.push(newSeg());
    const keep=Number(settings.preRoll)*1000,now=performance.now();
    let idx=-1;segs.forEach((s,i)=>{if(now-s.start>=keep)idx=i;});
    if(idx>0){segs.slice(0,idx).forEach(dropSeg);segs=segs.slice(idx);}
  },SEG_STEP_MS);
}
function stopBuffer(){clearInterval(segTimer);segTimer=null;segs.forEach(dropSeg);segs=[];}
function takeSeg(){
  const need=Number(settings.preRoll)*1000,now=performance.now();
  let pick=null;
  for(const s of segs)if(now-s.start>=need)pick=s;
  pick=pick||segs[0]||null;
  segs.filter(s=>s!==pick).forEach(dropSeg);
  segs=[];clearInterval(segTimer);segTimer=null;
  return pick;
}

// ---------- 録画制御 ----------
async function startRecording(){
  if(!stream||state!=='idle')return;
  state='recording';startedAt=Date.now();baseCount=null;forceThis=false;
  const seg=takeSeg()||newSeg();
  recorder=seg.rec;chunks=seg.chunks;
  status('● 録画中',true);updateInfo();
  try{baseCount=(await currentRows()).rows.length;}catch(_){baseCount=null;}
  pollTimer=setInterval(poll,POLL_MS);
}
function bestOf(rows){
  let b=null;for(const r of rows){const v=CSTRecMath.single(r);if(v!==null&&(b===null||v<b))b=v;}
  return b;
}
async function poll(){
  if(state!=='recording')return;
  if(Date.now()-startedAt>MAX_RECORD_MS){discard('長すぎるため破棄');return;}
  let r;try{r=await currentRows();}catch(_){return;}
  if(state!=='recording')return;
  if(baseCount===null){baseCount=r.rows.length;return;}
  if(r.rows.length>baseCount){
    state='finishing';clearInterval(pollTimer);
    const sec=CSTRecMath.single(r.rows.at(-1));
    const prev=bestOf(r.rows.slice(0,-1));
    const isBest=sec!==null&&(prev===null||sec<prev);
    status('停止後 '+settings.postRoll+'s 録画中',true);
    setTimeout(()=>finish(sec,r.rows.length,isBest),Math.max(0,Number(settings.postRoll)||0)*1000);
  }else if(r.rows.length<baseCount){baseCount=r.rows.length;}
}
function stopRecorder(){return new Promise(res=>{
  if(!recorder||recorder.state==='inactive'){res();return;}
  recorder.onstop=()=>res();recorder.stop();
});}
async function finish(sec,no,isBest){
  await stopRecorder();
  const type=recorder.mimeType||mime||'video/webm';
  const blob=new Blob(chunks,{type});
  const ext=type.includes('mp4')?'mp4':'webm';
  const d=new Date(),p=n=>String(n).padStart(2,'0');
  const stamp=`${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  const t=sec===null?'DNF':sec.toFixed(2)+'s';
  const name=`cstimer_${stamp}_${t}_#${no}`;
  const byThr=settings.thresholdOn&&sec!==null&&sec<=Number(settings.threshold);
  const byBest=settings.bestOn&&isBest;
  if(byBest||byThr||forceThis){
    const tag=byBest?'_BEST':(!byThr?'_force':'');
    download(blob,`${name}${tag}.${ext}`);
    reset('保存: '+t+(byBest?'（ベスト更新）':!byThr?'（強制）':''));
  }else{
    setHeld({blob,name:`${name}_force.${ext}`});
    reset('未保存: '+t);
  }
}
async function discard(msg){clearInterval(pollTimer);await stopRecorder();reset(msg);}
function reset(msg){
  chunks=[];recorder=null;state='idle';forceThis=false;badge.classList.remove('force');
  later(msg);updateInfo();restartBuffer();
}
function setHeld(h){
  clearTimeout(heldTimer);held=h;
  if(h)heldTimer=setTimeout(()=>{held=null;updateInfo();},Math.max(5,Number(settings.holdSec)||60)*1000);
  updateInfo();
}
function forceSave(){
  if(state!=='idle'){
    forceThis=!forceThis;badge.classList.toggle('force',forceThis);
    status(forceThis?'● 録画中（保存予約）':'● 録画中',true);updateInfo();return;
  }
  if(held){download(held.blob,held.name);setHeld(null);later('保存: 直前の動画（強制）');}
}
// 保存先フォルダは background.js が振り分ける
function download(blob,name){
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),10000);
}

// ---------- キー監視 ----------
const typing=el=>el&&(el.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
addEventListener('keydown',e=>{
  if(e.altKey&&e.code==='KeyS'){e.preventDefault();e.stopPropagation();forceSave();return;}
  if(e.repeat||typing(e.target))return;
  if(e.code==='Space'&&state==='idle')startRecording();
  if(e.code==='Escape'&&state==='recording')discard('キャンセル');
},true);

applyLayout();updateInfo();initCamera();
})();
