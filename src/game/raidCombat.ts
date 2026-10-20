import { RAID, SOLO_COMBAT } from './config.ts';
import { fight, memberFighter, type Fighter, type PartyMember } from './combat.ts';
import type { Rng } from './items.ts';

// PvP shares weapon, ammunition, armour, healing and initiative rules with PvE.
// Doors buy time: a short breaching window must finish before guards are fought.
export function resolveRaid(rng: Rng, attacker: PartyMember, defenders: PartyMember[], gateHp: number, gateArmour: number) {
  const raider = memberFighter(attacker);
  const guards = defenders.map(m => ({ ...memberFighter(m), side: 'enemy' as const }));
  const log: string[] = [];
  let remainingGate = gateHp;
  if (gateHp > 0) {
    const gate: Fighter = { ...memberFighter(attacker), key: 'gate', name: 'Vault door', side: 'enemy', hp: gateHp, maxHp: gateHp,
      armour: gateArmour, speed: 0, belt: {}, pack: {}, traits: {}, lastSeal: false };
    const breach = fight(rng, [raider], [gate], { passiveEnemies: true, canRetreat: false, maxRounds: RAID.gateRounds, stopAtLimit: true });
    remainingGate = gate.hp;
    log.push('Breaching the vault door.', ...breach.log, `Door damage: ${gateHp - gate.hp}.`);
    if (gate.hp > 0) {
      log.push('The door held. The raider withdrew without reaching the defenders or supplies.');
      return { won: false, raider, guards, gateHp: remainingGate, log };
    }
    log.push('The door broke open.');
  }
  if (guards.length) {
    log.push(`Defenders: ${guards.map(g => g.name).join(', ')}.`);
    raider.hitYet = false;
    raider.used = false;
    const combat = fight(rng, [raider], guards, { humanEnemies: true, retreatHp: SOLO_COMBAT.retreatHp, singleEscape: true, stopAtLimit: true });
    log.push(...combat.log);
    const won = combat.result === 'won';
    log.push(won ? 'The defenders were overcome.' : 'The raid was repelled. No supplies were taken.');
    return { won, raider, guards, gateHp: remainingGate, log };
  }
  log.push('Nobody was inside to defend the supplies.');
  return { won: true, raider, guards, gateHp: remainingGate, log };
}
