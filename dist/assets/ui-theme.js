(function(){
  const KEY='mh_ui_theme_v1';
  const palettes={classic:{text:'#222222',grid:'rgba(0,0,0,0.1)',positive:'#16703d'},light:{text:'#202020',grid:'rgba(0,0,0,0.1)',positive:'#16703d'},dark:{text:'#eeeeee',grid:'rgba(255,255,255,0.14)',positive:'#77d99a'}};
  function current(){const id=localStorage.getItem(KEY);return Object.hasOwn(palettes,id)?id:'classic';}
  function apply(id){if(!Object.hasOwn(palettes,id))id='classic';document.documentElement.dataset.uiTheme=id;localStorage.setItem(KEY,id);}
  window.uiTheme={current,apply,palette:()=>palettes[current()]};apply(current());
})();
