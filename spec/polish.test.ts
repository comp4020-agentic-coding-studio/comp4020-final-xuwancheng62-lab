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
