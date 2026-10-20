import type { DatabaseSync } from "node:sqlite";
import { tx } from "./db.ts";
import { BASE, BASE_BUILD_COSTS, BASE_RECIPES, RESIDENTS, type ItemKind, type SupplyKind } from "./game/config.ts";
import { baseDefaults, discountedScrap, FACILITIES, gateMax, type BaseState, type FacilityId } from "./game/base.ts";
import { loadForUpdate, log, type ShelterView } from "./shelter.ts";
import { addSupply, grantGear, starter, takeSupply } from "./character.ts";
import type { TendResult } from "./greenhouse.ts";
export function readBase(db: DatabaseSync, id: number): BaseState {
  const b = baseDefaults();
  for (const r of db.prepare("SELECT kind,tier,enabled,progress FROM facilities WHERE shelter_id=?").all(id) as {kind:FacilityId;tier:number;enabled:number;progress:number}[]) {
    if (Object.hasOwn(b,r.kind)) b[r.kind]={tier:r.tier,enabled:!!r.enabled,progress:r.progress};
  }
  return b;
}
export function saveBase(db: DatabaseSync,id:number,b:BaseState) {
  for (const [kind,f] of Object.entries(b)) db.prepare("INSERT INTO facilities(shelter_id,kind,tier,enabled,progress) VALUES(?,?,?,?,?) ON CONFLICT(shelter_id,kind) DO UPDATE SET tier=excluded.tier,enabled=excluded.enabled,progress=excluded.progress").run(id,kind,f.tier,+f.enabled,f.progress);
}
// What a build or repair costs in scrap, with whoever's home on work taking their cut.
export const buildScrap = (s: Pick<ShelterView, "residents">, scrap: number) =>
  discountedScrap(scrap, s.residents.filter((h) => h.working).map((h) => RESIDENTS[h.who].buildDiscount));

export function changeBase(db:DatabaseSync,user:number,kind:string,action:string,expected:string,now:number):TendResult {
  if (!Object.hasOwn(FACILITIES,kind)) return {ok:false,status:400,reason:"Unknown facility."};
  return tx(db,():TendResult=>{
    const s=loadForUpdate(db,"user_id",user,now)!;
    if (!s.anyoneHome) return {ok:false,status:409,reason:"Someone needs to be home to work on the base."};
    const k=kind as FacilityId,f=s.base[k];
    if (action==="toggle" && f.tier>0 && !["gate","storage"].includes(k)) {
      if(!["on","off"].includes(expected)) return {ok:false,status:400,reason:"Choose pause or resume."};
      const enabled=expected==="on";
      f.enabled=enabled;
      log(db,s.id,now,"info",`${FACILITIES[k].name} ${enabled?"resumed":"paused"}.`);
    } else if(action==="repair" && k==="gate") {
      if(s.gateHp>=gateMax(s.base)) return {ok:false,status:409,reason:"The door is already intact."};
      const scrap=buildScrap(s,BASE.repairScrap);
      if(s.stock.scrap<scrap) return {ok:false,status:409,reason:`Repairs need ${scrap} scrap.`};
      db.prepare("UPDATE shelters SET scrap=scrap-?,gate_hp=MIN(?,gate_hp+?) WHERE id=?").run(scrap,gateMax(s.base),BASE.repairHp,s.id);
      log(db,s.id,now,"info",`Repaired the vault door for ${scrap} scrap.`);
    } else if(action==="upgrade") {
      if(Number(expected)!==f.tier) return {ok:false,status:409,reason:"This facility changed. Reload before upgrading."};
      if(f.tier>=BASE.maxTier) return {ok:false,status:409,reason:"Already fully upgraded."};
      const cost={...BASE_BUILD_COSTS[k][f.tier]};
      cost.scrap=buildScrap(s,cost.scrap);
      if(s.stock.scrap<cost.scrap || s.stock.water<(cost.water??0) || Object.entries(cost.materials??{}).some(([kind,n])=>(s.stash.supplies[kind as SupplyKind]??0)<n)) return {ok:false,status:409,reason:"Not enough construction materials. Check the facility's cost."};
      for(const [kind,n] of Object.entries(cost.materials??{})) takeSupply(db,s.id,kind as SupplyKind,n);
      db.prepare("UPDATE shelters SET scrap=scrap-?,water=water-? WHERE id=?").run(cost.scrap,cost.water??0,s.id);
      f.tier++; f.enabled=true;
      if(k==="gate") db.prepare("UPDATE shelters SET gate_hp=?,siege_at=CASE WHEN siege_at=0 THEN ? ELSE siege_at END WHERE id=?").run(gateMax(s.base),now,s.id);
      log(db,s.id,now,"info",`${FACILITIES[k].room} ${f.tier===1?"built":"upgraded"} to tier ${f.tier}.`);
    } else return {ok:false,status:400,reason:"That facility action is unavailable."};
    saveBase(db,s.id,s.base);return {ok:true};
  });
}
export function craftAtBase(db:DatabaseSync,user:number,recipe:string,now:number):TendResult {
  if(!Object.hasOwn(BASE_RECIPES,recipe)) return {ok:false,status:400,reason:"Unknown recipe."};
  const r=BASE_RECIPES[recipe as keyof typeof BASE_RECIPES];
  return tx(db,():TendResult=>{
    const s=loadForUpdate(db,"user_id",user,now)!;
    if(!s.anyoneHome) return {ok:false,status:409,reason:"Someone needs to be home to craft."};
    if(s.base.workshop.tier<r.tier || !s.base.workshop.enabled || s.stock.power<=0) return {ok:false,status:409,reason:"A running workshop of the required tier needs power."};
    if(s.stock.scrap<r.scrap || (s.stash.supplies[r.material]??0)<r.amount) return {ok:false,status:409,reason:"Not enough materials in the stash."};
    takeSupply(db,s.id,r.material as SupplyKind,r.amount);
    db.prepare("UPDATE shelters SET scrap=scrap-? WHERE id=?").run(r.scrap,s.id);
    if("gear" in r) grantGear(db,s.id,{...starter(r.gear as ItemKind),level:r.tier},now);
    else addSupply(db,s.id,r.output as SupplyKind,r.count,now);
    log(db,s.id,now,"loot",`Crafted ${r.name.toLowerCase()} at the workshop.`);
    return {ok:true};
  });
}

// Recover only unused equipment, never a character's equipped or carried kit.
export function salvageAtBase(db:DatabaseSync,user:number,item:string,now:number):TendResult {
 const id=Number(item);
 if(!Number.isSafeInteger(id)||id<=0) return {ok:false,status:400,reason:"Choose spare equipment from the stash."};
 return tx(db,():TendResult=>{
  const s=loadForUpdate(db,"user_id",user,now)!;
  if(!s.anyoneHome) return {ok:false,status:409,reason:"Someone must be home to recover equipment."};
  const gear=s.stash.gear.find(g=>g.id===id);
  if(!gear) return {ok:false,status:409,reason:"That equipment is no longer in the stash."};
  const removed=db.prepare("DELETE FROM items WHERE id=? AND shelter_id=? AND held_by IS NULL AND level>0").run(id,s.id);
  if(removed.changes!==1) return {ok:false,status:409,reason:"That equipment is in use."};
  const scrap=BASE.salvageScrap[gear.quality]+gear.level*BASE.salvagePerLevel;
  db.prepare("UPDATE shelters SET scrap=scrap+? WHERE id=?").run(scrap,s.id);
  log(db,s.id,now,"loot",`Recovered ${scrap} scrap from spare equipment.`);return {ok:true};
 });
}
