import { expect, inject, it } from "vitest";
import { JSDOM } from "jsdom";
const base = inject("baseUrl");
it("welcomes a new account with a skippable, replayable prologue and usable first steps", async () => {
 const reg = await fetch(new URL('/register',base), {method:'POST',redirect:'manual',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({username:`spec_in${Date.now().toString(36)}`,password:'correct horse battery'})});
 expect(reg.status).toBe(303); expect(reg.headers.get('location')).toBe('/intro');
 const cookie=reg.headers.getSetCookie().find(x=>x.startsWith('sid='))!.split(';')[0];
 const get=async(path:string)=>fetch(new URL(path,base),{headers:{cookie}});
 for(let n=1;n<=11;n++) {
  const res=await get(`/intro?page=${n}`); expect(res.status).toBe(200);
  const doc=new JSDOM(await res.text()).window.document;
  expect(doc.querySelector('h1')?.textContent).toBeTruthy();
  expect(doc.querySelector('.intro-nav')?.textContent).toContain(`${n} / 11`);
  if(n<11) { expect(doc.querySelector('.intro-top a[href="/intro?page=11"]')).not.toBeNull(); expect(doc.querySelector('.intro-nav .intro-primary')?.getAttribute('href')).toBe(`/intro?page=${n+1}`); }
  for(const img of doc.querySelectorAll('img')) expect((await get(img.getAttribute('src')!)).status).toBe(200);
  if(n===11) { expect(doc.body.textContent).toContain('Five years later'); expect(doc.querySelectorAll('.intro-guide a')).toHaveLength(4); }
 }
 const collection=new JSDOM(await (await get('/collection')).text()).window.document;
 expect(collection.querySelector('.cl-prologue')?.getAttribute('href')).toBe('/intro');
 expect((await get(collection.querySelector('.cl-prologue img')!.getAttribute('src')!)).status).toBe(200);
 const home=new JSDOM(await (await get('/')).text()).window.document;
 expect(home.querySelector('footer a[href="/intro"]')).toBeNull();
 const invalid=await (await get('/intro?page=NaN')).text(); expect(invalid).toContain('Before the silence');
 const guest=await fetch(new URL('/intro',base),{redirect:'manual'}); expect(guest.headers.get('location')).toBe('/login');
});
