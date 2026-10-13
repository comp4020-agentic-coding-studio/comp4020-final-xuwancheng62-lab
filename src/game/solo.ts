import { BEAST, COMBAT, GEAR, RESIDENTS, SOLO_COMBAT } from './config.ts';
import { enemyFighter, fight, memberFighter, type PartyMember } from './combat.ts';
import { add, carry, halve, keener, type Haul } from './character.ts';
import { rollFound, rollHoard, type Destination } from './world.ts';
import { seeded } from './rng.ts';
import { effective, packLoad, type Supplies } from './items.ts';

// A departure snapshot fixes the whole encounter. It remains private until
// settlement; reopening the page cannot reroll combat or spend supplies twice.
export interface SoloResult {
  auto: true;
  result: 'won' | 'escaped' | 'defeated' | 'peaceful';
  hp: number;
  startingHp: number;
  belt: Supplies;
  pack: Supplies;
  loot: Haul;
  left: number;
  enemies: string[];
  log: string[];
  sightings?: {at:number;enemies:string[]}[];
}
export const soloEscapeBonus = (who: string, beast: boolean): number =>
  beast && who === 'toby' ? Math.round(RESIDENTS.toby.escape * 100 - COMBAT.escape.base) : 0;

export function runSolo(d: Destination, member: PartyMember, seed: number, calm = false): SoloResult {
  const rng = seeded(seed * 2654435761);
  const f = memberFighter(member);
  const stages = calm ? [] : d.stages ?? [{name:d.name,enemies:d.enemies ?? []}];
  const seen: string[] = [];
  const sightings: {at:number;enemies:string[]}[] = [];
  const log: string[] = [];
  const retreatState = {attempted:false};
  let result: SoloResult['result'] = calm ? 'peaceful' : 'won';
  for (const [i,stage] of stages.entries()) {
    const enemies = d.beast
      ? [{...enemyFighter('feral-dog',0),name:BEAST.name,hp:BEAST.hp,maxHp:BEAST.hp,damage:BEAST.bite}]
      : stage.enemies.flatMap(e=>Array.from({length:e.n},(_,n)=>enemyFighter(e.id,n)));
    if (!enemies.length) continue;
    const ids=d.beast ? ['scavenger'] : [...new Set(stage.enemies.map(e=>e.id))];
    seen.push(...ids);
    sightings.push({at:(i+1)/(stages.length+1),enemies:ids});
    if(d.stages) log.push(`${i+1}/${stages.length} · ${stage.name}`);
    // Per-fight weapon traits reset; HP and consumable inventories do not.
    f.used=false; f.hitYet=false; f.skip=0;
    const battle=fight(rng,[f],enemies,{
      ambush:d.stages ? stage.ambush ? 'enemy' : null : d.beast ? null : 'enemy',
      ambushText:'The wildlife lunged from cover before they could react.',
      retreatHp:SOLO_COMBAT.retreatHp,singleEscape:true,retreatState,
      escapeBonus:soloEscapeBonus(member.who,Boolean(d.beast)),
    });
    log.push(...battle.log);
    result=battle.result==='wiped'?'defeated':battle.result;
    if(result!=='won') break;
  }
  let found = keener(rollFound(d, seed), f.traits.keen);
  if (d.beast && result === 'won') found = add(found, rollHoard(seed));
  const carried = carry(found, Math.max(0, effective(member.body, member.gear, member.pack).capacity - packLoad(member.pack)));
  // Carrying limits still apply, and retreat keeps half of that haul.
  const w = member.gear.weapon && GEAR[member.gear.weapon.kind];
  if (result !== 'defeated' && w && w.ammo && w.recover && f.shots)
    f.pack[w.ammo] = (f.pack[w.ammo] ?? 0) + Math.floor(f.shots * w.recover);
  return { auto:true, result, hp:f.hp, startingHp:member.hp, belt:f.belt, pack:f.pack,
    loot: result === 'defeated' ? {} : result === 'escaped' ? halve(carried.carried) : carried.carried,
    left:carried.left, enemies:[...new Set(seen)], sightings, log };
}
export function soloResult(json: string | null | undefined): SoloResult | null {
  if (!json) return null;
  const value = JSON.parse(json);
  return value.auto === true ? value as SoloResult : null;
}
