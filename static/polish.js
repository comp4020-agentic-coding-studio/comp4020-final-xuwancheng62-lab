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

(() => {
 const tasks=[...document.querySelectorAll('#jr-tasks .qs-quest')];if(!tasks.length)return;
 const focus=id=>{const picked=tasks.find(t=>t.dataset.quest===id);if(!picked)return;tasks.forEach(t=>{t.open=t===picked;t.classList.toggle('is-tracked',t===picked);});};
 try{focus(localStorage.getItem('holdout.trackedQuest'));}catch{}
 document.addEventListener('click',e=>{const b=e.target.closest('[data-track-quest]');if(!b)return;focus(b.dataset.trackQuest);try{localStorage.setItem('holdout.trackedQuest',b.dataset.trackQuest);}catch{}});
})();

// Open native disclosure ancestors when following a deep link.
function revealHash(){let target;try{target=document.getElementById(decodeURIComponent(location.hash.slice(1)));}catch{return;}if(!target)return;for(let p=target;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;}
window.addEventListener('hashchange',revealHash);revealHash();

// Keep every character accessible without JavaScript; enhance to a roster.
(() => {
 const picker=document.querySelector('.people-picker');if(!picker)return;
 const cards=[...document.querySelectorAll('.sv-person')];
 if(cards.length<2)return;picker.hidden=false;
 const select=who=>{if(!cards.some(c=>c.dataset.who===who))who='you';cards.forEach(c=>c.hidden=c.dataset.who!==who);picker.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.person===who)));};
 picker.addEventListener('click',e=>{const b=e.target.closest('[data-person]');if(b)select(b.dataset.person);});
 const hash=()=>{if(location.hash.startsWith('#person-'))select(location.hash.slice(8));};
 select('you');hash();window.addEventListener('hashchange',hash);
})();
(() => {
 const bar=document.querySelector('.stash-filters');if(!bar)return;bar.hidden=false;
 const quality=bar.querySelector('select'),level=bar.querySelector('input'),items=[...document.querySelectorAll('[data-gear-quality]')];
 const update=()=>{let count=0;items.forEach(i=>{i.hidden=!!quality.value&&i.dataset.gearQuality!==quality.value||Number(i.dataset.gearLevel)<Number(level.value||1);if(!i.hidden)count++;});bar.querySelector('[data-stash-count]').textContent=count+' items';};
 bar.addEventListener('input',update);update();
})();
document.querySelectorAll('[data-track-quest]').forEach(b=>b.hidden=false);
