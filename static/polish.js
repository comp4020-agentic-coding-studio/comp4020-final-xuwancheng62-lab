// Optional hover preview. Click pins via native details; Escape dismisses.
document.addEventListener('pointerover', e => {
 if (e.pointerType !== 'mouse') return;
 const chip=e.target.closest('.loot-chip');
 if(chip && !chip.open){chip.open=true;chip.dataset.preview='true';}
});
document.addEventListener('pointerout', e => {
 const chip=e.target.closest('.loot-chip');
 if(chip && !chip.contains(e.relatedTarget) && chip.dataset.preview){chip.open=false;delete chip.dataset.preview;}
});
document.addEventListener('click',e=>{const summary=e.target.closest('.loot-chip>summary');if(summary?.parentElement.dataset.preview){e.preventDefault();delete summary.parentElement.dataset.preview;}});
document.addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelectorAll('.loot-chip[open]').forEach(c=>{c.open=false;delete c.dataset.preview;});});

// A map selection focuses its destination, with the full list as the fallback.
(() => {
 const root=document.querySelector('.world-page');if(!root)return;
 const cards=[...root.querySelectorAll('.solo-card')], reset=root.querySelector('[data-location-reset]');
 const select=()=>{
  const card=cards.find(c=>'#'+c.id===location.hash);
  if(!card)return;
  cards.forEach(c=>c.hidden=c!==card);
  const locked=root.querySelector('[data-locked-locations]');
  locked.hidden=!locked.contains(card);if(!locked.hidden)locked.open=true;
  reset.hidden=false;card.scrollIntoView({block:'center'});card.focus({preventScroll:true});
 };
 reset?.addEventListener('click',()=>{cards.forEach(c=>c.hidden=false);const locked=root.querySelector('[data-locked-locations]');locked.hidden=false;locked.open=false;reset.hidden=true;history.replaceState(null,'',location.pathname+location.search+'#solo-h');});
 window.addEventListener('hashchange',select);select();
})();
