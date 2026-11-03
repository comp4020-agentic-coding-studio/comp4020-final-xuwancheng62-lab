import { html } from 'hono/html';
import type { DatabaseSync } from 'node:sqlite';
import { FACTIONS, type Faction } from './game/narrative.ts';

// Only public allegiance is exposed; trust and choices remain private.
export function factionFor(db: DatabaseSync, name: string): Faction | null {
  const row = db.prepare('SELECT n.faction FROM users u JOIN shelters s ON s.user_id=u.id JOIN narrative_state n ON n.shelter_id=s.id WHERE u.username=?').get(name) as {faction:Faction|null}|undefined;
  return row?.faction ?? null;
}
export function factionBadge(faction?: Faction | null) {
  return faction && Object.hasOwn(FACTIONS,faction)
    ? html`<img class="faction-badge" data-faction="${faction}" src="/static/img/factions/${faction}.png?v=20261103" alt="${FACTIONS[faction].name}" title="${FACTIONS[faction].name}" width="24" height="24">`
    : '';
}
