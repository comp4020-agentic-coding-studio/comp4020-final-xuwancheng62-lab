import {JSDOM} from 'jsdom';
import {expect,inject,it} from 'vitest';
import {nextStep,FIRST_STEP,type NextStepState} from '../src/game/nextStep.ts';
import {questProgress,LAST_REPLY,OLD_WORKS} from '../src/game/quests.ts';
import {openLeads} from '../src/game/stories.ts';

// The Shelter page points a player at one next step, so a newcomer (or a
// marker arriving from the URL) always knows what to do.
const baseUrl = inject('baseUrl');
const url = (path: string) => new URL(path, baseUrl);

it('points a new account at its first exploration on the Shelter page', async () => {
  const res = await fetch(url('/register'), {method:'POST', redirect:'manual', headers:{'content-type':'application/x-www-form-urlencoded'}, body:new URLSearchParams({username:`spec_next${Date.now().toString(36)}${Math.random().toString(36).slice(2,5)}`, password:'correct horse battery'})});
  const cookie = res.headers.getSetCookie().find(c => c.startsWith('sid='))!.split(';')[0];
  const doc = new JSDOM(await (await fetch(url('/'), {headers:{cookie}})).text()).window.document;
  const box = doc.querySelector('.sh-next')!;
  expect(box.querySelector('h2')?.textContent).toBe('Next step');
  expect(box.textContent).toContain('Supermarket');
  expect(box.querySelector('a')?.getAttribute('href')).toBe('/world#dest-supermarket');
  // during the first-steps tour the card stays out of the way
  const touring = new JSDOM(await (await fetch(url('/?tour=1'), {headers:{cookie}})).text()).window.document;
  expect(touring.querySelector('.shelter-tour')).not.toBeNull();
  expect(touring.querySelector('.sh-next')).toBeNull();
});

const none = {found:[] as string[], marks:[] as string[]};
const base: NextStepState = {away:false, invites:0, encounter:null, unread:null, quests:[], leads:[]};

it('says nothing while away or while someone is waiting to be asked in', () => {
  expect(nextStep({...base, away:true})).toBeNull();
  expect(nextStep({...base, invites:1, encounter:{id:'thirst', title:'Thirst'}})).toBeNull();
});

it('puts an encounter first, then an unread story, then a started quest, then a lead', () => {
  const started = questProgress(OLD_WORKS, {found:['unit-plate'], marks:[]} as never);
  const lead = openLeads(['day-fifteen'] as never);
  expect(lead.length).toBeGreaterThan(0);
  const full: NextStepState = {...base, encounter:{id:'thirst', title:'Thirst'}, unread:{id:'toby', title:'Toby Wren'}, quests:[started], leads:lead};
  expect(nextStep(full)?.href).toBe('/story/thirst');
  expect(nextStep({...full, encounter:null})?.href).toBe('/collection/toby/comic');
  const quest = nextStep({...full, encounter:null, unread:null})!;
  expect(quest.text).toContain('The Old Works');
  expect(quest.href).toBe('/world#dest-reservoir');
  expect(nextStep({...base, leads:lead})?.href).toBe('/journal?tab=clues');
});

it('ignores quests nobody has started and falls back to the first exploration', () => {
  const untouched = questProgress(LAST_REPLY, none as never);
  expect(nextStep({...base, quests:[untouched]})).toEqual(FIRST_STEP);
});
