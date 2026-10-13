import { expect, it } from 'vitest';
import { CHARACTER, DROPS, GEAR, type ItemKind } from '../src/game/config.ts';
import { DUNGEONS, canEnterDungeon } from '../src/game/dungeons.ts';
import { runSolo } from '../src/game/solo.ts';
import { destination } from '../src/game/world.ts';
import { effective, rollGear, rollPiece, type Loadout } from '../src/game/items.ts';
import { seeded } from '../src/game/rng.ts';
import { runExpedition } from '../src/game/expedition.ts';
import type { PartyMember } from '../src/game/combat.ts';

function prepared(level:number, build:'strength'|'agility', weapon:ItemKind, itemLevel:number, seed:number, armour:ItemKind='jacket'):PartyMember {
 const body={level,strength:CHARACTER.strength,agility:CHARACTER.agility,constitution:CHARACTER.constitution}; body[build]+=level-1;
 const rng=seeded(seed);
 const gear:Loadout={weapon:rollGear(rng,weapon,itemLevel,'uncommon'),armour:rollGear(rng,armour,itemLevel,'uncommon'),tool:rollGear(rng,'respirator',itemLevel,'uncommon')};
 const ammo=GEAR[weapon].ammo; const pack=ammo?{[ammo]:40}:{};
 return {key:build,name:build,who:'you',body,gear,pack,belt:{firstaid:2},hp:effective(body,gear,pack).maxHp,row:'front'};
}

it('lets both full-stat builds progress with previous-location uncommon gear and two first aid kits, without chosen traits',()=>{
 const routes=[{id:'nest',level:3,il:3,source:'workshop',str:'crowbar',agi:'slingshot'}, {id:'raider-camp',level:5,il:4,source:'beast',str:'spear',agi:'rifle22'}, {id:'research-station',level:8,il:6,source:'raider-camp',str:'spear',agi:'rifle22'}, {id:'armoury',level:11,il:9,source:'research-station',str:'spear',agi:'servicerifle'}] as const;
 for(const route of routes)for(const build of ['strength','agility'] as const){
  const weapon=route[build==='strength'?'str':'agi'];
  // Slingshot is available in the supermarket before the workshop.
  expect(DROPS[weapon==='slingshot'?'supermarket':route.source].gear.kinds).toContain(weapon);
  let wins=0;
  for(let seed=1;seed<=500;seed++){
   const member=prepared(route.level,build,weapon,route.il,seed,route.id==='armoury'?'bodyarmour':'jacket');
   // Early preparation can use a starter jacket and reservoir respirator.
   const r=runSolo(destination(route.id)!,member,seed); if(r.result==='won') wins++;
  }
  expect(wins/500,`${route.id} ${build}`).toBeGreaterThanOrEqual(.9);
 }
});

it('caps solo rarity and keeps all expedition equipment inside its recommended level band',()=>{
 for(const table of Object.values(DROPS))for(let seed=1;seed<=500;seed++){
  if(!table.gear.kinds.length)continue;
  expect(['common','uncommon','rare']).toContain(rollPiece(seeded(seed),table).quality);
 }
 for(const d of DUNGEONS)for(const table of Object.values(d.drops))for(let seed=1;seed<=500;seed++){
  const g=rollPiece(seeded(seed),table);
  expect(g.level).toBeGreaterThanOrEqual(d.level![0]);expect(g.level).toBeLessThanOrEqual(d.level![1]);
  if(d.id!=='freight-yard')expect(g.quality).not.toBe('common');
 }
 expect(canEnterDungeon(1,DUNGEONS[0])).toBe(true);
 for(const d of DUNGEONS.slice(1))expect(canEnterDungeon(4,d)).toBe(false);
 expect(canEnterDungeon(5,DUNGEONS[1])).toBe(true);
 expect(canEnterDungeon(5,DUNGEONS[3])).toBe(false);
 expect(canEnterDungeon(6,DUNGEONS[3])).toBe(true);
});

it('supports prepared pairs in each formal expedition and makes the higher dungeons costly',()=>{
 for(const d of DUNGEONS.slice(1)){
  let won=0,damage=0;
  for(let seed=1;seed<=300;seed++){
   const lv=d.level![0],il=lv-1;
   const members=[prepared(lv,'strength','spear',il,seed,lv>=8?'hazmat':'jacket'),prepared(lv,'agility',lv>=8?'servicerifle':'rifle22',il,seed+300,lv>=8?'hazmat':'jacket')];
   members[1].row='back';
   const r=runExpedition({dungeon:d,seed,members,approach:'fight',retreat:'half',records:[],players:2});
   if(r.outcome==='cleared')won++;
   damage+=members.reduce((n,m)=>n+m.hp,0)-r.members.reduce((n,m)=>n+m.hp,0);
  }
  expect(won/300,d.id).toBeGreaterThanOrEqual(.7);
  expect(damage/300,d.id).toBeGreaterThan(10);
 }
});
