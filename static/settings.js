// Native details still works without JavaScript.
(() => {
 const menu=document.querySelector('[data-settings]');
 if(!menu)return;
 document.addEventListener('click',e=>{if(menu.open&&!menu.contains(e.target))menu.open=false;});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&menu.open){menu.open=false;menu.querySelector('summary').focus();}});
})();
