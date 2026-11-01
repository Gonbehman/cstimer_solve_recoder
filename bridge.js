/* ページ側APIで現在セッションの記録を読むだけ。書き込みはしない。 */
(()=>{
  if(window.__cstRecBridge) return;
  window.__cstRecBridge=true;
  window.addEventListener('message',async e=>{
    if(e.source!==window||e.origin!==location.origin||e.data?.type!=='CST_REC_REQUEST_V1') return;
    const token=e.data.token;
    if(typeof token!=='string'||token.length>100) return;
    let id=null,rows=null;
    try{ if(typeof kernel!=='undefined'&&typeof kernel.getProp==='function') id=Number(kernel.getProp('session')); }catch(_){}
    try{
      if(id>0&&typeof storage!=='undefined'&&typeof storage.get==='function'){
        const r=storage.get(id);
        if(r&&typeof r.then==='function') rows=await Promise.race([r,new Promise(res=>setTimeout(()=>res(null),900))]);
      }
    }catch(_){}
    window.postMessage({type:'CST_REC_RESPONSE_V1',token,id,rows:Array.isArray(rows)?rows:null},location.origin);
  });
})();
