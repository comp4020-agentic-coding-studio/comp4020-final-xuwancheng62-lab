import { it, expect, inject } from 'vitest';
import { randomUUID } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';
import { openDb, tx } from '../src/db.ts';
import { createShelter, loadShelter } from '../src/shelter.ts';
import { commerce, inventory, offers, getOffer, itemToken, unitSale } from '../src/commerce.ts';
import { balance, money, expeditionCredits } from '../src/currency.ts';
import { grantGear, starter } from '../src/character.ts';
import { products, dayOf, gearPrice } from '../src/game/economy.ts';
import { ECONOMY } from '../src/game/config.ts';
const now=1800000000000;
function fixture(){
 const dir=mkdtempSync(join(tmpdir(),'holdout-commerce-')),db=openDb(dir);
 const player=(name:string)=>{const id=Number(db.prepare("INSERT INTO users(username,password_hash,created_at) VALUES(?,'x',?)").run(name,now).lastInsertRowid);createShelter(db,id,name,now);const s=loadShelter(db,id,now);return {id,sid:s.id,cid:s.character.id};};
 const a=player('trader-a'),b=player('trader-b'),c=player('outsider');
 db.prepare('INSERT INTO friends(a,b,requested_by,created_at,accepted_at) VALUES(?,?,?,?,?)').run(a.id,b.id,a.id,now,now);
 const act=(uid:number,f:Record<string,string>,at=now)=>commerce(db,uid,{request_id:randomUUID(),...f},at);
 return {db,dir,a,b,c,act};
}
it('shop calculates price on server, keeps gear rolls, deduplicates purchase, and applies sell budget',()=>{
 const {db,a,act}=fixture();const p=products(1,now).find(p=>p.kind==='crowbar'&&p.gear?.quality==='common')!;
 const key=randomUUID();expect(act(a.id,{action:'buy',sku:p.sku,qty:'1',price:'0',request_id:key}).ok).toBe(true);
 expect(balance(db,a.sid)).toBe(ECONOMY.starterCredits-p.price);
 const bought=inventory(db,a.sid)[0];expect(bought.bonuses_json).toBe(JSON.stringify(p.gear!.bonuses));
 expect(act(a.id,{action:'buy',sku:p.sku,qty:'1',request_id:key}).ok).toBe(true);expect(inventory(db,a.sid)).toHaveLength(1);
 expect(act(a.id,{action:'buy',sku:p.sku,qty:'-1'}).ok).toBe(false);
 expect(act(a.id,{action:'buy',sku:'gear:nuclearlauncher:legendary:40',qty:'1'}).ok).toBe(false);
 const equipped=(db.prepare('SELECT id FROM items WHERE held_by=?').get(a.cid) as {id:number}).id;
 expect(act(a.id,{action:'sell',item:String(equipped),qty:'1'}).ok).toBe(false);
 const high=grantGear(db,a.sid,{...starter('powerhammer'),level:40,quality:'epic'},now);
 expect(act(a.id,{action:'sell',item:String(high),qty:'1'}).ok).toBe(false);
 expect(act(a.id,{action:'sell',item:String(high),qty:'1',confirm:'yes'}).ok).toBe(false);
 expect(inventory(db,a.sid).some(i=>i.id===high)).toBe(true);db.close();
});
it('Rare stays available, Epic allowance survives levelling, refreshes daily, and Legendary is absent',()=>{
 const {db,a,act}=fixture();tx(db,()=>money(db,a.sid,100000,'test','test',now));
 const list=products(1,now);expect(list.some(p=>p.gear?.quality==='rare')).toBe(true);expect(list.some(p=>p.gear?.quality==='legendary')).toBe(false);
 const p=list.find(p=>p.gear?.quality==='epic')!;
 expect(act(a.id,{action:'buy',sku:p.sku,qty:'1'}).ok).toBe(true);
 expect(act(a.id,{action:'buy',sku:p.sku,qty:'1'}).ok).toBe(false);
 db.prepare('UPDATE characters SET level=2 WHERE id=?').run(a.cid);
 const changed=products(2,now).find(x=>x.kind===p.kind&&x.gear?.quality==='epic');
 if(changed)expect(act(a.id,{action:'buy',sku:changed.sku,qty:'1'}).ok).toBe(false);
 const next=now+ECONOMY.dayMs;const nextEpic=products(2,next).find(x=>x.gear?.quality==='epic')!;
 expect(act(a.id,{action:'buy',sku:nextEpic.sku,qty:'1'},next).ok).toBe(true);db.close();
});
it('escrow preserves gear and resources, atomic acceptance exchanges both sides once',()=>{
 const {db,a,b,c,act}=fixture();const gear={...starter('crowbar'),level:3,quality:'rare' as const,bonuses:{strength:2},traits:[]};
 const id=grantGear(db,a.sid,gear,now);
 expect(act(a.id,{action:'offer',recipient:String(c.id),give_item_0:String(id)}).ok).toBe(false);
 const give={action:'offer',recipient:String(b.id),give_item_0:String(id),give_qty_0:'1',give_credits:'25',give_food:'4',want_credits:'40'};
 expect(act(a.id,give).ok).toBe(true);const o=offers(db,a.id)[0];
 expect(inventory(db,a.sid)).toHaveLength(0);expect(balance(db,a.sid)).toBe(175);
 expect(act(a.id,{action:'sell',item:String(id),qty:'1',confirm:'yes'}).ok).toBe(false);
 expect(act(c.id,{action:'accept',offer:String(o.id)}).ok).toBe(false);
 const key=randomUUID();expect(act(b.id,{action:'accept',offer:String(o.id),request_id:key}).ok).toBe(true);
 expect(balance(db,a.sid)).toBe(215);expect(balance(db,b.sid)).toBe(185);
 const delivered=inventory(db,b.sid)[0];expect(delivered.level).toBe(3);expect(delivered.quality).toBe('rare');expect(JSON.parse(delivered.bonuses_json)).toEqual({strength:2});
 expect(act(b.id,{action:'accept',offer:String(o.id),request_id:key}).ok).toBe(true);
 expect(act(b.id,{action:'accept',offer:String(o.id)}).ok).toBe(false);expect(inventory(db,b.sid)).toHaveLength(1);db.close();
});
it('unaffordable or mismatched acceptance rolls everything back; counteroffer closes the original and refunds it',()=>{
 const {db,a,b,act}=fixture();const id=grantGear(db,b.sid,{...starter('crowbar'),level:1},now);
 expect(act(a.id,{action:'offer',recipient:String(b.id),give_credits:'50',want_kind_0:'crowbar',want_level_0:'3',want_quality_0:'rare',want_credits:'500'}).ok).toBe(true);
 const o=offers(db,a.id)[0];
 expect(act(b.id,{action:'accept',offer:String(o.id),payment_0:String(id)}).ok).toBe(false);expect(inventory(db,b.sid).some(i=>i.id===id)).toBe(true);expect(balance(db,a.sid)).toBe(150);
 expect(act(b.id,{action:'offer',recipient:String(a.id),parent:String(o.id),give_credits:'5000'}).ok).toBe(false);expect(getOffer(db,o.id,a.id)?.state).toBe('open');expect(balance(db,a.sid)).toBe(150);
 expect(act(b.id,{action:'offer',recipient:String(a.id),parent:String(o.id),give_credits:'5',want_credits:'30'}).ok).toBe(true);expect(balance(db,a.sid)).toBe(200);expect(balance(db,b.sid)).toBe(195);expect(getOffer(db,o.id,a.id)?.state).toBe('countered');
 const next=offers(db,b.id).find(x=>x.state==='open')!;expect(act(b.id,{action:'cancel',offer:String(next.id)}).ok).toBe(true);expect(balance(db,b.sid)).toBe(200);db.close();
});
it('expiry refuses acceptance and returns escrow once; reopening preserves wallet and offers',()=>{
 const f=fixture();const {a,b,act,dir}=f;let db=f.db;
 expect(act(a.id,{action:'offer',recipient:String(b.id),give_credits:'30'}).ok).toBe(true);const id=offers(db,a.id)[0].id;
 db.close();db=openDb(dir);expect(balance(db,a.sid)).toBe(170);
 const late=now+ECONOMY.offerMs;
 expect(commerce(db,b.id,{action:'accept',offer:String(id),request_id:randomUUID()},late).ok).toBe(false);
 expect(commerce(db,b.id,{action:'expire',offer:String(id),request_id:randomUUID()},late).ok).toBe(true);expect(balance(db,a.sid)).toBe(200);
 expect(commerce(db,a.id,{action:'expire',offer:String(id),request_id:randomUUID()},late).ok).toBe(false);expect(balance(db,a.sid)).toBe(200);db.close();
});
it('expedition Credits are capped and cannot be claimed twice',()=>{
 const {db,a}=fixture();tx(db,()=>{expect(expeditionCredits(db,a.sid,1,20,now)).toBeGreaterThan(0);expect(expeditionCredits(db,a.sid,1,20,now)).toBe(0);for(let i=2;i<20;i++)expeditionCredits(db,a.sid,i,20,now);});
 expect(balance(db,a.sid)).toBe(ECONOMY.starterCredits+ECONOMY.expeditionDaily);db.close();
});
const base=inject('baseUrl');
it('over HTTP: buy, escrow, review, accept, reject strangers and duplicate requests without JS',async()=>{
 const make=async()=>{const username='spec_market'+randomUUID().slice(0,7);const r=await fetch(new URL('/register',base),{method:'POST',redirect:'manual',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({username,password:'correct horse battery'})});expect(r.status).toBe(303);return {username,cookie:r.headers.getSetCookie().find(c=>c.startsWith('sid='))!.split(';')[0]};};
 type User=Awaited<ReturnType<typeof make>>;
 const get=async(u:User,path:string)=>await(await fetch(new URL(path,base),{headers:{cookie:u.cookie}})).text();
 const post=async(u:User,path:string,f:Record<string,string>)=>fetch(new URL(path,base),{method:'POST',redirect:'manual',headers:{cookie:u.cookie,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams(f)});
 const [a,b,c]=await Promise.all([make(),make(),make()]);
 expect((await post(a,'/social/friends',{name:b.username})).status).toBe(303);expect((await post(b,'/social/friends',{name:a.username})).status).toBe(303);
 const page=new JSDOM(await get(a,'/trade?tab=players')).window.document;
 const recipient=[...page.querySelectorAll<HTMLOptionElement>('select[name=recipient] option')].find(o=>o.textContent===b.username)!.value;
 const key=randomUUID(),buy={action:'buy',sku:'supply:bandage',qty:'2',request_id:key};expect((await post(a,'/trade',buy)).status).toBe(303);expect((await post(a,'/trade',buy)).status).toBe(303);
 const sell=new JSDOM(await get(a,'/trade?tab=sell')).window.document;
 const item=sell.querySelector<HTMLInputElement>('input[name=item]')!.value;
 expect((await post(a,'/trade',{action:'offer',recipient,give_item_0:item,give_qty_0:'2',want_credits:'10',request_id:randomUUID()})).status).toBe(303);
 const view=new JSDOM(await get(b,'/trade?tab=players')).window.document;
 const offer=view.querySelector<HTMLInputElement>('input[name=offer]')!.value;
 expect(await get(c,'/trade?tab=players')).not.toContain(`id="offer-${offer}"`);
 expect((await post(c,'/trade',{action:'accept',offer,request_id:randomUUID()})).status).toBe(409);
 const accepts=await Promise.all([post(b,'/trade',{action:'accept',offer,request_id:randomUUID()}),post(b,'/trade',{action:'accept',offer,request_id:randomUUID()})]);expect(accepts.map(r=>r.status).sort()).toEqual([303,409]);
 expect(await get(b,'/trade?tab=sell')).toContain('×2');expect(await get(a,'/activity')).toContain('Trade #');
 expect(await get(a,`/social?channel=dm:${recipient}`)).toContain('Offer trade');
});

it('rejects a stale item selection and an unaffordable offer without losing escrow',()=>{
 const {db,a,b,act}=fixture();
 const item=grantGear(db,a.sid,starter('crowbar'),now),token=itemToken(inventory(db,a.sid).find(i=>i.id===item)!);
 db.prepare("UPDATE items SET quality='rare' WHERE id=?").run(item);
 const before=balance(db,a.sid);
 expect(act(a.id,{action:'sell',item:token,qty:'1',confirm:'yes'}).ok).toBe(false);
 expect(balance(db,a.sid)).toBe(before);expect(inventory(db,a.sid)).toHaveLength(1);
 expect(act(a.id,{action:'offer',recipient:String(b.id),give_credits:'30',want_credits:'500'}).ok).toBe(true);
 const o=offers(db,a.id)[0];
 expect(act(b.id,{action:'accept',offer:String(o.id)}).ok).toBe(false);
 expect(balance(db,a.sid)).toBe(before-30);expect(balance(db,b.sid)).toBe(200);expect(getOffer(db,o.id,b.id)?.state).toBe('open');
 expect(act(a.id,{action:'cancel',offer:String(o.id)}).ok).toBe(true);expect(balance(db,a.sid)).toBe(before);db.close();
});

it('old daily gear listings are refused and identical purchases never sell back for profit',()=>{
 const {db,a,act}=fixture();
 const p=products(1,now).find(p=>p.gear?.quality==='common')!;
 expect(act(a.id,{action:'buy',sku:p.sku,qty:'1'},now+ECONOMY.dayMs).ok).toBe(false);
 expect(balance(db,a.sid)).toBe(200);
 expect(products(20,now).filter(p=>p.gear).every(p=>Math.floor(gearPrice(p.gear!)*ECONOMY.sellRatio)<p.price)).toBe(true);
 db.close();
});

it('the receipt records the exact requested equipment that was actually delivered',()=>{
 const {db,a,b,act}=fixture();
 const gear={...starter('crowbar'),level:3,quality:'rare' as const,bonuses:{strength:2},name:'Test crowbar'};
 const id=grantGear(db,b.sid,gear,now);
 expect(act(a.id,{action:'offer',recipient:String(b.id),give_credits:'10',want_kind_0:'crowbar',want_level_0:'3',want_quality_0:'rare'}).ok).toBe(true);
 const o=offers(db,a.id)[0],token=itemToken(inventory(db,b.sid).find(i=>i.id===id)!);
 expect(act(b.id,{action:'accept',offer:String(o.id),payment_0:token}).ok).toBe(true);
 const receipt=JSON.parse(getOffer(db,o.id,a.id)!.payment_json!);
 expect(receipt.items[0].name).toBe('Test crowbar');expect(JSON.parse(receipt.items[0].bonuses_json)).toEqual({strength:2});
 expect(inventory(db,a.sid)[0].name).toBe('Test crowbar');expect(balance(db,b.sid)).toBe(210);db.close();
});

it('bulk selling is atomic, restricted to low-level stash gear and replay safe',()=>{
 const {db,a,act}=fixture();db.prepare('UPDATE characters SET level=8 WHERE id=?').run(a.cid);
 const low=grantGear(db,a.sid,{...starter('stick'),level:6},now);
 const high=grantGear(db,a.sid,{...starter('stick'),level:7},now);
 const rare=grantGear(db,a.sid,{...starter('stick'),level:5,quality:'rare'},now);
 const epic=grantGear(db,a.sid,{...starter('stick'),level:2,quality:'epic'},now);
 const row=(id:number)=>inventory(db,a.sid).find(i=>i.id===id)!;
 const select=(id:number)=>({['bulk_item_'+id]:itemToken(row(id))});
 expect(act(a.id,{action:'sell-bulk',confirm:'yes',...select(low),...select(high)}).ok).toBe(false);
 expect(row(low)).toBeDefined();
 expect(act(a.id,{action:'sell-bulk',confirm:'yes',...select(epic)}).ok).toBe(false);
 expect(act(a.id,{action:'sell-bulk',...select(low)}).ok).toBe(false);
 const before=balance(db,a.sid),total=unitSale(row(low))+unitSale(row(rare));
 const form={action:'sell-bulk',confirm:'yes',...select(low),...select(rare),request_id:randomUUID()};
 expect(act(a.id,form).ok).toBe(true);expect(balance(db,a.sid)).toBe(before+total);
 expect(act(a.id,form).ok).toBe(true);expect(balance(db,a.sid)).toBe(before+total);
 expect(row(high)).toBeDefined();expect(row(epic)).toBeDefined();db.close();
});
