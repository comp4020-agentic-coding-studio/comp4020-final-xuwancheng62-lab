import {expect,it,inject} from 'vitest';
import {JSDOM} from 'jsdom';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {GEAR,DROPS,LATE_SOLO,LATE_TEAM, type ItemKind} from '../src/game/config.ts';
import {ARMOURED_CONVOY,KESTREL_FACILITY} from '../src/game/dungeons.ts';
import {rollPiece, effective, type Gear} from '../src/game/items.ts';
import {seeded} from '../src/game/rng.ts';
import {enemyFighter,fight,memberFighter} from '../src/game/combat.ts';
import {colouredLoot} from '../src/lootText.ts';
import {openDb} from '../src/db.ts';
import {createShelter,loadShelter} from '../src/shelter.ts';
import {grantGear} from '../src/character.ts';
import {stashPanel} from '../src/itemViews.ts';

it('keeps four weapons per late solo pool and limits late-team drops to local equipment, besides the named Legendaries',()=>{
 for(const id of Object.keys(LATE_SOLO)){
  const weapons=DROPS[id].gear.kinds.filter(k=>GEAR[k].slot==='weapon');
  expect(weapons.filter(k=>GEAR[k].range==='ranged')).toHaveLength(2);
  expect(weapons.filter(k=>GEAR[k].range!=='ranged')).toHaveLength(2);
  expect(weapons).not.toContain('spear');
 }
 expect(DROPS['research-station'].gear.quality).toEqual({common:37,uncommon:45,rare:15,epic:3,legendary:0});
 expect(DROPS.armoury.gear.quality).toEqual({common:25,uncommon:50,rare:20,epic:5,legendary:0});
 for(const d of [ARMOURED_CONVOY,KESTREL_FACILITY]){
  const table=d.drops.cache;const counts:Record<string,number>={};let nuclear=0;
  for(let i=1;i<=10000;i++){const g=rollPiece(seeded(i*7919),table);if(!g.name)expect(table.gear.kinds).toContain(g.kind);counts[g.quality]=(counts[g.quality]??0)+1;if(g.kind==='nuclearlauncher')nuclear++;}
  for(const [q,weight] of Object.entries(LATE_TEAM.quality))expect((counts[q]??0)/10000).toBeCloseTo(weight/100,1);
  if(d===KESTREL_FACILITY){expect(nuclear).toBeGreaterThan(50);expect(nuclear).toBeLessThan(400);}
 }
});
const gear=(kind:ItemKind,level=20):Gear=>({kind,level,quality:'uncommon',bonuses:{},traits:[]});
it('uses three rounds for a machine-gun burst, and falls back to melee with insufficient ammo',()=>{
 const body={level:20,strength:5,agility:24,constitution:6},loadout={weapon:gear('lmg')};
 const m={key:'a',name:'A',who:'you',body,gear:loadout,hp:100,belt:{},pack:{r556:3},row:'front' as const};
 const fighter=memberFighter(m);const enemies=[0,1,2].map(n=>enemyFighter('rat',n));
 expect(fight(seeded(1),[fighter],enemies).result).toBe('won');expect(fighter.pack.r556).toBe(0);expect(enemies.every(e=>e.hp===0)).toBe(true);
 expect(effective(body,loadout,{r556:2}).clubbing).toBe(true);
 expect(effective(body,loadout,{r556:3}).clubbing).toBe(false);
});
it('groups melee and ranged separately, orders level before quality and keeps names coloured without colouring level text',async()=>{
 const db=openDb(mkdtempSync(join(tmpdir(),'holdout-late-stash-'))),now=Date.now();
 try{
  const u=Number(db.prepare("INSERT INTO users(username,password_hash,created_at) VALUES('late','x',?)").run(now).lastInsertRowid);createShelter(db,u,'late',now);const s=loadShelter(db,u,now);
  const pieces=[{...gear('chainsaw',15),quality:'epic' as const},gear('chainsaw',16),gear('fireaxe',16),gear('carbine',18)];
  for(const g of pieces)grantGear(db,s.id,g,now);
  const doc=new JSDOM(String(await stashPanel(loadShelter(db,u,now)))).window.document;
  const titles=[...doc.querySelectorAll('.st-h')];const melee=titles.find(x=>x.textContent!.startsWith('Melee weapons'))!;
  const kinds=[...melee.nextElementSibling!.querySelectorAll('.it')];
  expect(kinds.slice(0,3).map(e=>e.getAttribute('data-kind'))).toEqual(['chainsaw','fireaxe','chainsaw']);
  expect(melee.nextElementSibling!.textContent).not.toContain('Assault carbine');
  const txt='Found Epic Chainsaw (level 16), Rare Service rifle (level 12); <script>alert(1)</script>';
  const loot=new JSDOM(String(await colouredLoot(txt))).window.document;
  expect(loot.querySelector('.q-epic')!.textContent).toBe('Epic Chainsaw');expect(loot.querySelector('.q-rare')!.textContent).toBe('Rare Service rifle');expect(loot.querySelector('script')).toBeNull();
  expect(loot.body.textContent).toBe(txt);
 }finally{db.close();}
});
it('serves the new locked solo destinations and team entrances over HTTP without exposing an admission bypass',async()=>{
 const base=inject('baseUrl');const name=`spec_late${Date.now().toString(36)}`;
 const register=await fetch(`${base}/register`,{method:'POST',body:new URLSearchParams({username:name,password:'late-test-password'}),redirect:'manual'});
 expect(register.status).toBe(303);const cookie=register.headers.get('set-cookie')!.split(';')[0];
 const page=async(path:string)=>new JSDOM(await(await fetch(base+path,{headers:{cookie}})).text()).window.document;
 const world=await page('/world'),team=await page('/expeditions');
 for(const id of Object.keys(LATE_SOLO)){
  expect(world.querySelector(`#dest-${id} button[disabled]`)).not.toBeNull();
  expect(world.querySelector(`a[href="#dest-${id}"]`)).not.toBeNull();
  expect((await fetch(`${base}/static/img/world/${id}.jpg`)).status).toBe(200);
  const denied=await fetch(`${base}/world/depart`,{method:'POST',headers:{cookie},body:new URLSearchParams({destination:id}),redirect:'manual'});expect(denied.status).toBe(409);
 }
 for(const id of ['convoy','kestrel']){
  expect(team.querySelector(`#entrance-${id}[aria-disabled="true"]`)).not.toBeNull();expect((await fetch(`${base}/static/img/dungeons/${id}.webp`)).status).toBe(200);
  const denied=await fetch(`${base}/parties`,{method:'POST',headers:{cookie},body:new URLSearchParams({dungeon:id,size:'2',approach:'fight',retreat:'never'}),redirect:'manual'});expect(denied.status).toBe(409);
 }
 const guide=await page('/collection/enemies');expect(guide.querySelectorAll('.be-card')).toHaveLength(12);
});
