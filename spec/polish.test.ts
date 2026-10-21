import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { expect, it } from 'vitest';
import { journalPage } from '../src/journalViews.ts';
import { LAST_REPLY, questProgress } from '../src/game/quests.ts';
import { lootChip } from '../src/lootViews.ts';

it('reveals a discovered quest and highlights only one next step without losing the other steps', async()=>{
 const found=['cart-dogs'] as const;
 const doc=new JSDOM(String(await journalPage([{id:found[0],at:1,journeyId:null}], [questProgress(LAST_REPLY,{found:[...found],marks:[]})]))).window.document;
 expect(doc.querySelector('[data-quest="last-reply"]')).not.toBeNull();
 expect(doc.querySelectorAll('.qs-next')).toHaveLength(1);
 expect(doc.querySelectorAll('.qs-history [data-step]')).toHaveLength(LAST_REPLY.steps.length);
});
it('keeps exact reward level and quality in an accessible equipment preview',async()=>{
 const doc=new JSDOM(String(await lootChip({kind:'stick',level:8,quality:'epic',bonuses:{},traits:[]}))).window.document;
 expect(doc.querySelector('.loot-chip.q-epic>summary img')).not.toBeNull();
 expect(doc.querySelector('.loot-tooltip')?.textContent).toMatch(/Level 8/);
 expect(doc.querySelector('.loot-chip')?.hasAttribute('open')).toBe(false);
});
it('filters equipment without hiding supplies, and restores all items',()=>{
 const dom=new JSDOM(`<div class="stash-filters" hidden><select><option value="">All</option><option value="rare">Rare</option></select><input value="1"><span data-stash-count></span></div><details data-gear-quality="rare" data-gear-level="6"></details><details data-gear-quality="common" data-gear-level="2"></details><details id="supplies"></details>`,{url:'http://localhost/',runScripts:'outside-only'});
 dom.window.eval(readFileSync('static/polish.js','utf8'));
 const d=dom.window.document,select=d.querySelector('select')!;select.value='rare';select.dispatchEvent(new dom.window.Event('input',{bubbles:true}));
 expect(d.querySelector<HTMLElement>('[data-gear-quality="common"]')!.hidden).toBe(true);
 expect(d.querySelector<HTMLElement>('#supplies')!.hidden).toBe(false);
 select.value='';select.dispatchEvent(new dom.window.Event('input',{bubbles:true}));
 expect(d.querySelector<HTMLElement>('[data-gear-quality="common"]')!.hidden).toBe(false);
});

it('puts the unlocked investigation focus and a character selector directly in the Journal',async()=>{
 const {mkdtempSync}=await import('node:fs'),{tmpdir}=await import('node:os'),{join}=await import('node:path');
 const {openDb}=await import('../src/db.ts'),{createShelter,loadShelter}=await import('../src/shelter.ts');
 const db=openDb(mkdtempSync(join(tmpdir(),'holdout-journal-depart-'))),at=1800000000000;
 db.prepare("INSERT INTO users(id,username,password_hash,created_at) VALUES(1,'reader','x',?)").run(at);createShelter(db,1,'reader',at);
 const records=[{id:'exchange-chit' as const,at,journeyId:null}];
 const doc=new JSDOM(String(await journalPage(records,[questProgress(LAST_REPLY,{found:['exchange-chit'],marks:[]})],'clues','',loadShelter(db,1,at)))).window.document;
 const form=doc.querySelector('form.jr-depart')!;
 expect(form.getAttribute('action')).toBe('/world/depart');
 expect(form.querySelector<HTMLInputElement>('[name=destination]')?.value).toBe('workshop');
 expect(form.querySelector<HTMLInputElement>('[name=focus]')?.value).toBe('leave-word');
 expect(form.querySelector('select[name=who]')).not.toBeNull();db.close();
});
