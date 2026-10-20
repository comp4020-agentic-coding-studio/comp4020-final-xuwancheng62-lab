import { createHash } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { tx } from './db.ts';
import { ECONOMY, GEAR, SUPPLIES, QUALITIES, type Quality, type ItemKind } from './game/config.ts';
import { dayOf, gearPrice, isGear, isSupply, matches, products, sellPrice, supplyPrice, type RequestItem } from './game/economy.ts';
import { addSupply, grantGear } from './character.ts';
import { loadForUpdate, log } from './shelter.ts';
import { areFriends } from './parties.ts';
import { balance, earnedToday, money } from './currency.ts';
import type { LiveEvent } from './realtime.ts';
import type { Gear } from './game/items.ts';

export type Form=Record<string,unknown>;
export interface StoredItem {id:number;kind:string;level:number;quality:Quality;qty:number;bonuses_json:string;traits_json:string;name:string|null}
export type Bundle={credits:number;food:number;water:number;scrap:number;items:StoredItem[]};
export type Want=Omit<Bundle,'items'>&{items:RequestItem[]};
export interface Offer {id:number;sender:number;recipient:number;state:string;give_json:string;want_json:string;payment_json:string|null;created_at:number;expires_at:number;parent_id:number|null;sender_name:string;recipient_name:string}
export const number=(v:unknown,min=0,max:number=ECONOMY.maxAmount):number=>{
  if(v===undefined || v==='') return min;
  if(typeof v!=='string' || !/^\d+$/.test(v))throw new Error('Use whole, non-negative quantities.');
  const n=Number(v);if(!Number.isSafeInteger(n)||n<min||n>max)throw new Error(`Quantity must be between ${min} and ${max}.`);return n;
};
const identifier=(v:unknown)=>{if(typeof v!=='string'||!v)throw new Error('Select an item, friend or offer first.');return number(v,1,Number.MAX_SAFE_INTEGER);};
export const asGear=(i:StoredItem):Gear=>({kind:i.kind as ItemKind,level:i.level,quality:i.quality,bonuses:JSON.parse(i.bonuses_json),traits:JSON.parse(i.traits_json),name:i.name});
// Bind browser selections to the displayed item, even if SQLite reuses a deleted id.
export const itemToken=(i:StoredItem)=>`${i.id}:${createHash('sha256').update(JSON.stringify([i.kind,i.level,i.quality,i.bonuses_json,i.traits_json,i.name,i.qty])).digest('hex')}`;
export const itemName=(i:StoredItem)=>i.level?`${i.quality} ${i.name??GEAR[i.kind as ItemKind].name} · Lv ${i.level}`:isSupply(i.kind)?SUPPLIES[i.kind].name:i.kind;
export const inventory=(db:DatabaseSync,sid:number)=>db.prepare('SELECT * FROM items WHERE shelter_id=? AND held_by IS NULL ORDER BY level DESC,id').all(sid) as unknown as StoredItem[];
export const offers=(db:DatabaseSync,uid:number)=>db.prepare("SELECT t.*,a.username sender_name,b.username recipient_name FROM trade_offers t JOIN users a ON a.id=t.sender JOIN users b ON b.id=t.recipient WHERE sender=? OR recipient=? ORDER BY CASE WHEN state='open' THEN 0 ELSE 1 END,id DESC LIMIT 50").all(uid,uid) as unknown as Offer[];
export const getOffer=(db:DatabaseSync,id:number,uid:number)=>db.prepare('SELECT t.*,a.username sender_name,b.username recipient_name FROM trade_offers t JOIN users a ON a.id=t.sender JOIN users b ON b.id=t.recipient WHERE t.id=? AND (sender=? OR recipient=?)').get(id,uid,uid) as unknown as Offer|undefined;
const sidFor=(db:DatabaseSync,uid:number)=>(db.prepare('SELECT id FROM shelters WHERE user_id=?').get(uid) as {id:number}).id;
export const saleLimit=(level:number)=>ECONOMY.sellDaily+level*ECONOMY.sellPerLevel;
export const unitSale=(i:StoredItem)=>sellPrice(i.level?gearPrice(asGear(i)):supplyPrice(i.kind));
function takeItem(db:DatabaseSync,sid:number,selection:unknown,qty:number):StoredItem {
  const parts=String(selection??'').split(':');
  const id=identifier(parts[0]);
  const row=db.prepare('SELECT * FROM items WHERE id=? AND shelter_id=? AND held_by IS NULL').get(id,sid) as unknown as StoredItem|undefined;
  if(!row || (!isGear(row.kind)&&!isSupply(row.kind)) || qty<1 || qty>row.qty || (row.level>0&&qty!==1))throw new Error('An item is no longer available in your stash.');
  if(parts.length>1&&itemToken(row)!==selection)throw new Error('That item changed since this page was loaded. Reload and review it.');
  if(row.qty===qty)db.prepare('DELETE FROM items WHERE id=?').run(id);
  else db.prepare('UPDATE items SET qty=qty-? WHERE id=?').run(qty,id);
  return {...row,qty};
}
function restore(db:DatabaseSync,sid:number,items:StoredItem[],now:number){
  for(const i of items)if(i.level)grantGear(db,sid,asGear(i),now);else if(isSupply(i.kind))addSupply(db,sid,i.kind,i.qty,now);
}
const amounts=(form:Form,prefix:string)=>({credits:number(form[`${prefix}credits`]),food:number(form[`${prefix}food`]),water:number(form[`${prefix}water`]),scrap:number(form[`${prefix}scrap`])});
function stockChange(db:DatabaseSync,sid:number,b:{food:number;water:number;scrap:number},sign:1|-1){
  const q=db.prepare('UPDATE shelters SET food=food+?,water=water+?,scrap=scrap+? WHERE id=? AND food+?>=0 AND water+?>=0 AND scrap+?>=0').run(sign*b.food,sign*b.water,sign*b.scrap,sid,sign*b.food,sign*b.water,sign*b.scrap);
  if(q.changes!==1)throw new Error('Not enough resources.');
}
function returnEscrow(db:DatabaseSync,o:Offer,state:string,now:number){
  const sid=sidFor(db,o.sender);loadForUpdate(db,'id',sid,now);
  const b=JSON.parse(o.give_json) as Bundle;
  restore(db,sid,b.items,now);stockChange(db,sid,b,1);money(db,sid,b.credits,'Trade escrow returned',`trade:${o.id}:refund`,now);
  db.prepare('UPDATE trade_offers SET state=? WHERE id=? AND state=\'open\'').run(state,o.id);
  for(const uid of [o.sender,o.recipient])log(db,sidFor(db,uid),now,'trade',`Trade #${o.id} ${state}. Reserved items and Credits returned to ${o.sender_name}.`);
}
export function commerce(db:DatabaseSync,uid:number,form:Form,now:number):{ok:boolean;message:string;events?:LiveEvent[]} {
  try {return tx(db,()=>{
    const request=String(form.request_id??'');if(!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(request))throw new Error('Reload the form and try again.');
    const old=db.prepare('SELECT message FROM commerce_receipts WHERE user_id=? AND request_id=?').get(uid,request) as {message:string}|undefined;
    if(old)return {ok:true,message:old.message};
    const s=loadForUpdate(db,'user_id',uid,now)!;
    const action=String(form.action);let message='';let listeners:number[]=[];
    if(action==='buy'){
      const p=products(s.character.base.level,now).find(p=>p.sku===form.sku);if(!p)throw new Error('That shop listing has changed. Reload the shop.');
      const qty=number(form.qty,1,p.gear?1:ECONOMY.maxAmount),total=p.price*qty;
      if(!Number.isSafeInteger(total)||balance(db,s.id)<total)throw new Error('Not enough Credits.');
      // Stock key excludes level so levelling up cannot reset the Epic allowance.
      const stockKey=p.gear?`${p.kind}:${p.gear.quality}`:p.sku;
      const bought=(db.prepare('SELECT qty FROM shop_purchases WHERE shelter_id=? AND day=? AND sku=?').get(s.id,dayOf(now),stockKey) as {qty:number}|undefined)?.qty??0;
      if(p.limit && bought+qty>p.limit)throw new Error('Sold out for your shelter today.');
      money(db,s.id,-total,'Shop purchase',`buy:${request}`,now);
      if(p.gear)grantGear(db,s.id,p.gear,now);else if(isSupply(p.kind))addSupply(db,s.id,p.kind,qty,now);else stockChange(db,s.id,{food:0,water:0,scrap:0,[p.kind]:qty},1);
      db.prepare('INSERT INTO shop_purchases VALUES(?,?,?,?) ON CONFLICT(shelter_id,day,sku) DO UPDATE SET qty=qty+excluded.qty').run(s.id,dayOf(now),stockKey,qty);
      message=`Bought ${qty} × ${p.gear?p.gear.quality+' ':''}${p.name} for ${total} Credits.`;
    }else if(action==='sell'){
      const id=identifier(String(form.item??'').split(':')[0]),qty=number(form.qty,1);
      const row=inventory(db,s.id).find(i=>i.id===id);if(!row)throw new Error('Only items in your stash can be sold.');
      if(row.level>0&&QUALITIES.indexOf(row.quality)>=QUALITIES.indexOf('rare')&&form.confirm!=='yes')throw new Error('Confirm before selling Rare or higher equipment.');
      const total=unitSale(row)*qty;
      if(total>saleLimit(s.character.base.level)-earnedToday(db,s.id,'sell:',now))throw new Error('That exceeds today’s shop buyback budget. Sell fewer items or return tomorrow.');
      takeItem(db,s.id,form.item,qty);money(db,s.id,total,'Shop sale',`sell:${request}`,now);message=`Sold ${qty} × ${itemName(row)} for ${total} Credits.`;
    }else if(action==='offer'){
      const recipient=identifier(form.recipient);if(recipient===uid||!areFriends(db,uid,recipient))throw new Error('Choose an accepted friend.');
      const open=(db.prepare("SELECT COUNT(*) n FROM trade_offers WHERE sender=? AND state='open'").get(uid) as {n:number}).n;
      if(open>=ECONOMY.maxOpenOffers)throw new Error('Close an existing offer before making another.');
      const incoming=(db.prepare("SELECT COUNT(*) n FROM trade_offers WHERE recipient=? AND state='open'").get(recipient) as {n:number}).n;
      if(incoming>=ECONOMY.maxIncomingOffers)throw new Error('Your friend has too many pending offers. Ask them to close one first.');
      const parent=number(form.parent);
      if(parent){const o=getOffer(db,parent,uid);if(!o||o.recipient!==uid||o.sender!==recipient||o.state!=='open'||o.expires_at<=now)throw new Error('That offer can no longer be countered.');returnEscrow(db,o,'countered',now);}
      const give:Bundle={...amounts(form,'give_'),items:[]};
      const want:Want={...amounts(form,'want_'),items:[]};
      for(let n=0;n<ECONOMY.maxLines;n++){
        const selection=form[`give_item_${n}`];if(selection)give.items.push(takeItem(db,s.id,selection,number(form[`give_qty_${n}`],1)));
        const kind=String(form[`want_kind_${n}`]??'');if(!kind)continue;
        if(!isGear(kind)&&!isSupply(kind))throw new Error('Unknown requested item.');
        const quality=String(form[`want_quality_${n}`]??'common') as Quality;if(!QUALITIES.includes(quality))throw new Error('Unknown quality.');
        want.items.push({kind,qty:isGear(kind)?1:number(form[`want_qty_${n}`],1),level:isGear(kind)?number(form[`want_level_${n}`],1):0,quality});
      }
      if(!give.items.length&&!give.credits&&!give.food&&!give.water&&!give.scrap&&!want.items.length&&!want.credits&&!want.food&&!want.water&&!want.scrap)throw new Error('Add an item, resources or Credits.');
      const id=Number(db.prepare("INSERT INTO trade_offers(sender,recipient,state,give_json,want_json,created_at,expires_at,parent_id) VALUES(?,?,'open',?,?,?,?,?)").run(uid,recipient,JSON.stringify(give),JSON.stringify(want),now,now+ECONOMY.offerMs,parent||null).lastInsertRowid);
      stockChange(db,s.id,give,-1);money(db,s.id,-give.credits,'Trade escrow reserved',`trade:${id}:reserve`,now);
      listeners=[uid,recipient];
      message=`Trade #${id} sent. Your offer is reserved until accepted, cancelled or returned after expiry.`;
      log(db,sidFor(db,recipient),now,'trade',`${s.owner} sent trade #${id}. Review it in Trade; nothing is accepted automatically.`);
    }else{
      const id=identifier(form.offer),o=getOffer(db,id,uid);if(!o)throw new Error('Trade not found.');
      if(o.state!=='open')throw new Error(`This trade is already ${o.state}.`);
      listeners=[o.sender,o.recipient];
      if(action==='cancel'&&o.sender===uid || action==='decline'&&o.recipient===uid || action==='expire'&&o.expires_at<=now){
        const state=o.expires_at<=now?'expired':action==='cancel'?'cancelled':'declined';returnEscrow(db,o,state,now);message=`Trade #${id} ${state}.`;
      }else if(action==='accept'){
        if(o.recipient!==uid||o.expires_at<=now||!areFriends(db,o.sender,o.recipient))throw new Error('This offer is expired or no longer available between friends.');
        const sender=sidFor(db,o.sender);loadForUpdate(db,'id',sender,now);
        const give=JSON.parse(o.give_json) as Bundle,want=JSON.parse(o.want_json) as Want;
        const payment:StoredItem[]=[];
        for(let n=0;n<want.items.length;n++){
          const r=want.items[n],item=takeItem(db,s.id,form[`payment_${n}`],r.qty);
          if(!matches(item,r))throw new Error('Selected equipment does not meet the agreed terms.');payment.push(item);
        }
        stockChange(db,s.id,want,-1);money(db,s.id,-want.credits,'Trade payment',`trade:${id}:pay`,now);
        restore(db,sender,payment,now);stockChange(db,sender,want,1);money(db,sender,want.credits,'Trade received',`trade:${id}:receive`,now);
        restore(db,s.id,give.items,now);stockChange(db,s.id,give,1);money(db,s.id,give.credits,'Trade received',`trade:${id}:receive`,now);
        db.prepare("UPDATE trade_offers SET state='accepted',payment_json=? WHERE id=?").run(JSON.stringify({...want,items:payment}),id);
        message=`Trade #${id} completed with ${o.sender_name}.`;
        log(db,sender,now,'trade',`Trade #${id} completed with ${s.owner}. Agreed items, resources and Credits exchanged.`);
      }else throw new Error('That trade action is not allowed.');
    }
    log(db,s.id,now,'trade',message);
    db.prepare('INSERT INTO commerce_receipts VALUES(?,?,?,?)').run(uid,request,message,now);
    return {ok:true,message,events:listeners.map(id=>({channel:`user:${id}`,event:'alert',data:{tone:'ok',message:'Your trade offers have changed. Open Trade to review.'}}))};
  });}catch(e){return {ok:false,message:e instanceof Error?e.message:'Could not complete transaction.'};}
}
