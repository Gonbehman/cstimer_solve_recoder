const defaults={thresholdOn:true,threshold:30,bestOn:true,preRoll:3,postRoll:1.5,holdSec:60,previewShow:true,previewWidth:240,saveFolder:'cstimer_rec'};
const keys=Object.keys(defaults);
const $=id=>document.getElementById(id);
function fill(s){for(const k of keys){const el=$(k);if(el.type==='checkbox')el.checked=s[k];else el.value=s[k];}$('pwv').textContent=s.previewWidth+'px';}
chrome.storage.local.get(defaults).then(fill);
$('previewWidth').addEventListener('input',e=>{$('pwv').textContent=e.target.value+'px';chrome.storage.local.set({previewWidth:Number(e.target.value)});});
$('previewShow').addEventListener('change',e=>chrome.storage.local.set({previewShow:e.target.checked}));
$('form').addEventListener('submit',async e=>{
  e.preventDefault();const s={};
  for(const k of keys){const el=$(k);s[k]=el.type==='checkbox'?el.checked:el.type==='text'?el.value.trim():Number(el.value);}
  await chrome.storage.local.set(s);$('status').textContent='保存しました。';
});
