import type { DatabaseSync } from "node:sqlite";
import { tx } from "./db.ts";
import { BASE, BASE_RECIPES, type ItemKind, type SupplyKind } from "./game/config.ts";
import { baseDefaults, FACILITIES, gateMax, type BaseState, type FacilityId } from "./game/base.ts";
import { loadForUpdate, log } from "./shelter.ts";
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
      if(s.stock.scrap<BASE.repairScrap) return {ok:false,status:409,reason:`Repairs need ${BASE.repairScrap} scrap.`};
      db.prepare("UPDATE shelters SET scrap=scrap-?,gate_hp=MIN(?,gate_hp+?) WHERE id=?").run(BASE.repairScrap,gateMax(s.base),BASE.repairHp,s.id);
      log(db,s.id,now,"info","Repaired the vault door.");
    } else if(action==="upgrade") {
      if(Number(expected)!==f.tier) return {ok:false,status:409,reason:"This facility changed. Reload before upgrading."};
      if(f.tier>=BASE.maxTier) return {ok:false,status:409,reason:"Already fully upgraded."};
      const cost=BASE.costs[f.tier];
      if(s.stock.scrap<cost) return {ok:false,status:409,reason:`This needs ${cost} scrap.`};
      db.prepare("UPDATE shelters SET scrap=scrap-? WHERE id=?").run(cost,s.id);
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
