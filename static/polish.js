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
