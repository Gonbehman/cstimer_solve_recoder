/* 記録1件からタイム（秒）を取得。DNFはnull。+2は加算。 */
(function(root){
  function single(row){
    const t=row?.[0];
    if(!Array.isArray(t)||!Number.isFinite(t[1])||t[1]<0||!Number.isFinite(t[0])) return null;
    return t[0]===-1?null:(t[1]+Math.max(0,t[0]))/1000;
  }
  const api={single};
  if(typeof module!=='undefined'&&module.exports) module.exports=api; else root.CSTRecMath=api;
})(globalThis);
