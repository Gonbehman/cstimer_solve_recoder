const DEFAULT_FOLDER='cstimer_rec';
function cleanFolder(v){
  return String(v??'').split(/[\\/]/).map(s=>s.trim().replace(/[:*?"<>|]/g,'_'))
    .filter(s=>s&&s!=='.'&&s!=='..').join('/');
}
chrome.downloads.onDeterminingFilename.addListener((item,suggest)=>{
  const base=item.filename.split(/[\\/]/).pop();
  if(!/^cstimer_.*\.(mp4|webm)$/.test(base)){suggest();return;}
  chrome.storage.local.get({saveFolder:DEFAULT_FOLDER}).then(({saveFolder})=>{
    const f=cleanFolder(saveFolder);
    suggest({filename:f?`${f}/${base}`:base,conflictAction:'uniquify'});
  }).catch(()=>suggest());
  return true;
});
