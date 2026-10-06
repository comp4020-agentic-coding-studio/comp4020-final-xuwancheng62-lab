import type { DatabaseSync } from "node:sqlite";
import { CROPS, GREENHOUSE, TIME_SCALE, type Crop } from "./game/config.ts";
import { tx } from "./db.ts";
import { loadForUpdate, log } from "./shelter.ts";

export type TendResult = { ok: true } | { ok: false; status: 400 | 409; reason: string };

const parseSlot = (v: string): number | null => {
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 && n < GREENHOUSE.plots ? n : null;
};

export function plant(db: DatabaseSync, userId: number, slotIn: string, cropIn: string, now: number): TendResult {
  const slot = parseSlot(slotIn);
  if (slot === null) return { ok: false, status: 400, reason: "There's no planter there." };
  if (!CROPS.includes(cropIn as Crop)) return { ok: false, status: 400, reason: "You don't have seeds for that." };
  const crop = GREENHOUSE.crops[cropIn as Crop];
  return tx(db, (): TendResult => {
    const s = loadForUpdate(db, "user_id", userId, now)!;
    if (s.journey) return { ok: false, status: 409, reason: "You're not home to plant anything." };
    if (s.plots[slot].crop) return { ok: false, status: 409, reason: "Something's already growing in that planter." };
    if (s.stock.power <= 0) return { ok: false, status: 409, reason: "The grow lights need power." };
    // the water check lives in the update, so two plantings can't overdraw it
    const paid = db.prepare("UPDATE shelters SET water = water - ? WHERE id = ? AND water >= ?").run(crop.water, s.id, crop.water);
    if (paid.changes !== 1) return { ok: false, status: 409, reason: `Planting ${crop.name.toLowerCase()} takes ${crop.water} Water.` };
    const readyAt = now + (crop.growMin * 60_000) / TIME_SCALE;
    db.prepare("INSERT INTO crop_plots (shelter_id, slot, crop, planted_at, ready_at) VALUES (?, ?, ?, ?, ?)").run(s.id, slot, cropIn, now, readyAt);
    log(db, s.id, now, "info", `You planted ${crop.name.toLowerCase()} in planter ${slot + 1}. Ready in ${crop.growMin} minutes.`);
    return { ok: true };
  });
}

export function harvest(db: DatabaseSync, userId: number, slotIn: string, now: number): TendResult {
  const slot = parseSlot(slotIn);
  if (slot === null) return { ok: false, status: 400, reason: "There's no planter there." };
  return tx(db, (): TendResult => {
    const s = loadForUpdate(db, "user_id", userId, now)!;
    if (s.journey) return { ok: false, status: 409, reason: "You're not home to harvest." };
    const p = s.plots[slot];
    if (!p.crop) return { ok: false, status: 409, reason: "That planter is empty." };
    // deleting only a ripe plot makes a double harvest impossible
    const picked = db.prepare("DELETE FROM crop_plots WHERE shelter_id = ? AND slot = ? AND ready_at <= ?").run(s.id, slot, now);
    if (picked.changes !== 1) return { ok: false, status: 409, reason: "It isn't ready yet." };
    const crop = GREENHOUSE.crops[p.crop];
    db.prepare("UPDATE shelters SET food = food + ? WHERE id = ?").run(crop.food, s.id);
    log(db, s.id, now, "loot", `You harvested ${crop.name.toLowerCase()}: +${crop.food} Food.`);
    return { ok: true };
  });
}
