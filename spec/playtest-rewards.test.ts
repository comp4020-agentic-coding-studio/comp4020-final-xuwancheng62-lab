import { expect, it } from 'vitest';
import { COMBAT, DROPS, PLAYTEST } from '../src/game/config.ts';
import { equipmentRewards, rollDrop } from '../src/game/items.ts';
import { seeded } from '../src/game/rng.ts';
import { FREIGHT_YARD } from '../src/game/dungeons.ts';
import { runExpedition } from '../src/game/expedition.ts';
import type { PartyMember } from '../src/game/combat.ts';
it('gives bulk equipment even on a missed normal roll, without changing level or rarity limits',()=>{
 for(let seed=1;seed<100;seed++){
  const rng=seeded(seed),table=DROPS.reservoir;
  const found=rollDrop(rng,table),gear=equipmentRewards(rng,table,found.gear);
  expect(gear).toHaveLength(PLAYTEST.equipmentCopies);
  for(const g of gear){expect(table.gear.kinds).toContain(g.kind);expect(g.level).toBeLessThanOrEqual(3);expect(['common','uncommon','rare']).toContain(g.quality);}
 }
 expect(equipmentRewards(seeded(1),DROPS.nest)).toEqual([]);
});
it('restores normal rewards when the temporary switch is disabled',()=>{
 const previous=PLAYTEST.enabled;
 try {PLAYTEST.enabled=false;expect(equipmentRewards(seeded(1),DROPS.reservoir)).toEqual([]);}
 finally {PLAYTEST.enabled=previous;}
});
it('keeps exploration duration while combat adds no wait and team rewards are multiplied',()=>{
 expect(COMBAT.roundMs).toBe(0);
 const member=(key:string):PartyMember=>({key,name:key,who:'you',hp:100,row:'front',body:{level:1,strength:5,agility:5,constitution:6},gear:{weapon:{kind:'crowbar',level:1,quality:'common',bonuses:{},traits:[]}},belt:{},pack:{}});
 const run=runExpedition({dungeon:FREIGHT_YARD,seed:1,members:[member('a'),member('b')],approach:'fight',retreat:'never',records:[],players:2});
 expect(run.outcome).toBe('cleared');expect(run.endsAt).toBe(FREIGHT_YARD.rooms.reduce((n,r)=>n+r.ms,0));expect(run.loot.gear).toHaveLength(10);
});
