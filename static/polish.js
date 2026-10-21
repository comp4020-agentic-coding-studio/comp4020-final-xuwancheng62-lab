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
  if(!card){if(location.hash==='#solo-h'){cards.forEach(c=>c.hidden=false);const more=root.querySelector('[data-more-locations]');if(more){more.hidden=false;more.open=false;}const locked=root.querySelector('[data-locked-locations]');if(locked){locked.hidden=false;locked.open=false;}if(reset)reset.hidden=true;}return;}
  cards.forEach(c=>c.hidden=c!==card);
  const more=root.querySelector("[data-more-locations]");if(more){more.hidden=!more.contains(card);more.open=more.contains(card);}
  const locked=root.querySelector('[data-locked-locations]');
  locked.hidden=!locked.contains(card);if(!locked.hidden)locked.open=true;
  if(reset)reset.hidden=false;card.scrollIntoView({block:'center'});card.focus({preventScroll:true});
 };
 reset?.addEventListener('click',()=>{cards.forEach(c=>c.hidden=false);const more=root.querySelector('[data-more-locations]');if(more){more.hidden=false;more.open=false;}const locked=root.querySelector('[data-locked-locations]');locked.hidden=false;locked.open=false;reset.hidden=true;history.replaceState(null,'',location.pathname+location.search+'#solo-h');});
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
 const key='holdout.person.'+(picker.querySelector('button')?.textContent.trim()||'');
 if(cards.length<2)return;picker.hidden=false;
 const select=who=>{if(!cards.some(c=>c.dataset.who===who))who='you';cards.forEach(c=>c.hidden=c.dataset.who!==who);picker.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.person===who)));};
 picker.addEventListener('click',e=>{const b=e.target.closest('[data-person]');if(b){select(b.dataset.person);try{sessionStorage.setItem(key,b.dataset.person);}catch{}};});
 const hash=()=>{if(location.hash.startsWith('#person-'))select(location.hash.slice(8));};
 let selected='you';try{selected=sessionStorage.getItem(key)||'you';}catch{}select(selected);hash();window.addEventListener('hashchange',hash);
})();
// Two rows per stash category, adapting to desktop and phone column counts.
document.querySelectorAll('#stash .st-icon-grid').forEach((grid,index)=>{
 const items=[...grid.children],button=document.createElement('button');
 let expanded=false;
 grid.id=grid.id||`stash-category-${index}`;
 button.type='button';button.className='stash-more';button.setAttribute('aria-controls',grid.id);
 const label=grid.previousElementSibling?.textContent.trim()||'items';
 const update=()=>{
  const columns=Math.max(1,getComputedStyle(grid).gridTemplateColumns.split(/\s+/).filter(Boolean).length),limit=columns*2;
  items.forEach((item,i)=>{item.hidden=!expanded&&i>=limit;});
  button.hidden=items.length<=limit;
  button.textContent=expanded?'−':`＋ ${Math.max(0,items.length-limit)}`;
  button.setAttribute('aria-expanded',String(expanded));
  button.setAttribute('aria-label',`${expanded?'Show fewer':'Show more'} ${label}`);
 };
 button.addEventListener('click',()=>{expanded=!expanded;update();});
 grid.after(button);update();
 if(typeof ResizeObserver!=='undefined')new ResizeObserver(update).observe(grid);
 else window.addEventListener('resize',update);
});
document.querySelectorAll('[data-track-quest]').forEach(b=>b.hidden=false);

// Server-rendered shop filtering remains usable without scripting.
const marketFilter=document.querySelector('.market-filter');
marketFilter?.addEventListener('change',()=>marketFilter.requestSubmit());

// Keep reward previews within the viewport even for the last item in a row.
document.addEventListener('toggle',e=>{
 const chip=e.target;if(!chip.matches?.('.loot-chip')||!chip.open)return;
 const box=chip.querySelector('.loot-tooltip');box.style.left='';
 if(window.innerWidth<=600)return;
 const rect=box.getBoundingClientRect(),shift=Math.min(0,window.innerWidth-12-rect.right);
 box.style.left=Math.max(12-rect.left,shift)+'px';
},true);

const bulkSale=document.querySelector('.bulk-sale');
if(bulkSale){
 const form=bulkSale.querySelector('form'),error=bulkSale.querySelector('[data-sale-error]');
 const selection=()=>{const items=[...form.querySelectorAll('[data-sale-price]:checked')];return {count:items.length,total:items.reduce((n,i)=>n+Number(i.dataset.salePrice),0)};};
 const problem=()=>{const {count,total}=selection(),budget=Number(bulkSale.dataset.saleBudget);return !count?'Select equipment to sell.':total>budget?`Selection exceeds today’s buyback budget by ${total-budget} Credits. Uncheck some equipment; nothing has been sold.`:!form.querySelector('[name=confirm]').checked?'Tick “I have reviewed this selection” before selling.':'';};
 const update=()=>{const {count,total}=selection();bulkSale.querySelector('[data-sale-total]').textContent=`${count} selected · ${total} Credits`;error.textContent=problem();};
 form.addEventListener('change',update);
 form.addEventListener('submit',e=>{update();if(error.textContent){e.preventDefault();error.focus();}});
 update();
}
