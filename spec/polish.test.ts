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
it('shows two stash rows per category and expands independently across screen sizes',()=>{
 const dom=new JSDOM(`<section id="stash"><h3>Melee weapons</h3><div class="st-icon-grid" style="grid-template-columns:100px 100px">${'<details class="st-item"></details>'.repeat(7)}</div><h3>Supplies</h3><div class="st-icon-grid" style="grid-template-columns:100px 100px"><details class="st-item"></details></div></section>`,{url:'http://localhost/',runScripts:'outside-only'});
 dom.window.eval(readFileSync('static/polish.js','utf8'));
 const d=dom.window.document,grid=d.querySelector<HTMLElement>('.st-icon-grid')!,button=d.querySelector<HTMLButtonElement>('.stash-more')!;
 expect(grid.querySelectorAll('[hidden]')).toHaveLength(3);expect(button.textContent).toContain('3');
 expect(d.querySelectorAll<HTMLButtonElement>('.stash-more')[1].hidden).toBe(true);
 button.click();expect(grid.querySelectorAll('[hidden]')).toHaveLength(0);expect(button.getAttribute('aria-expanded')).toBe('true');
 button.click();grid.style.gridTemplateColumns='100px';dom.window.dispatchEvent(new dom.window.Event('resize'));
 expect(grid.querySelectorAll('[hidden]')).toHaveLength(5);expect(d.querySelector('.stash-filters')).toBeNull();dom.window.close();
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

it('explains blocked bulk sales before submitting and permits a reviewed affordable selection',()=>{
 const dom=new JSDOM(`<details class="bulk-sale" data-sale-budget="100"><form><input type="checkbox" data-sale-price="70" checked><input type="checkbox" data-sale-price="50" checked><input type="checkbox" name="confirm"><p data-sale-total></p><p data-sale-error tabindex="-1"></p><button>Sell</button></form></details>`,{url:'http://localhost/',runScripts:'outside-only'});
 dom.window.eval(readFileSync('static/polish.js','utf8'));
 const d=dom.window.document,form=d.querySelector('form')!,error=d.querySelector('[data-sale-error]')!;
 const submit=()=>form.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));
 expect(submit()).toBe(false);expect(error.textContent).toContain('20 Credits');expect(d.activeElement).toBe(error);
 d.querySelectorAll<HTMLInputElement>('[data-sale-price]')[1].checked=false;
 expect(submit()).toBe(false);expect(error.textContent).toContain('reviewed');
 d.querySelector<HTMLInputElement>('[name=confirm]')!.checked=true;
 expect(submit()).toBe(true);expect(error.textContent).toBe('');
 d.querySelector<HTMLInputElement>('[data-sale-price]')!.checked=false;
 expect(submit()).toBe(false);expect(error.textContent).toContain('Select equipment');
 dom.window.close();
});

it('offers healing beside health, chooses a matching supply and disables it at full health',async()=>{
 const {mkdtempSync}=await import('node:fs'),{tmpdir}=await import('node:os'),{join}=await import('node:path');
 const {openDb}=await import('../src/db.ts'),{createShelter,loadShelter}=await import('../src/shelter.ts');
 const {survivorPanel}=await import('../src/survivorViews.ts');
 const db=openDb(mkdtempSync(join(tmpdir(),'holdout-quick-heal-'))),at=1800000000000;
 db.prepare("INSERT INTO users(id,username,password_hash,created_at) VALUES(1,'healer','x',?)").run(at);createShelter(db,1,'healer',at);
 const s=loadShelter(db,1,at),c=s.crew[0].character;
 c.hp=c.maxHp-18;s.stash.supplies.bandage=2;s.stash.supplies.firstaid=1;
 const render=async()=>new JSDOM(String(await survivorPanel(s,at))).window.document;
 let d=await render();expect(d.querySelector('.sv-health-row .hp')).not.toBeNull();
 expect(d.querySelector<HTMLInputElement>('.sv-quick-heal [name=kind]')?.value).toBe('bandage');
 expect(d.querySelector<HTMLInputElement>('.sv-quick-heal [name=who]')?.value).toBe('you');
 expect(d.querySelector('.sv-quick-heal')?.textContent).toContain('+18 HP');
 c.hp=c.maxHp;d=await render();expect(d.querySelector<HTMLButtonElement>('.sv-quick-heal button')!.disabled).toBe(true);
 db.close();
});
