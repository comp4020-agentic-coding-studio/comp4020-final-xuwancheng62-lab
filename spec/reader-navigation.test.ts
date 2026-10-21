import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {expect,it} from 'vitest';
it('turns pages and goes back without recreating the music player', async()=>{
 const page=(n:number)=>`<main><section class="intro"><h1>Page ${n}</h1><a href="/intro?page=${n+1}">Continue</a></section></main>`;
 const dom=new JSDOM(`${page(1)}<aside data-music hidden><button></button><input value="0.25"><small data-music-label></small></aside>`,{url:'http://localhost/intro',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window;let instances=0,plays=0;
 class Sound extends w.EventTarget {src='';volume=0;currentTime=12;duration=73;paused=true;constructor(){super();instances++;} async play(){plays++;this.paused=false;}pause(){this.paused=true;}}
 Object.defineProperty(w,'Audio',{value:Sound});Object.defineProperty(w,'scrollTo',{value:()=>{}});
 Object.defineProperty(w,'fetch',{value:async(url:string)=>({ok:true,url,text:async()=>`<title>Next</title>${page(Number(new URL(url).searchParams.get('page')))}`})});
 w.eval(readFileSync('static/music.js','utf8'));w.eval(readFileSync('static/reader-navigation.js','utf8'));
 w.document.querySelector('button')!.click();await new Promise(r=>setTimeout(r,0));
 const player=w.document.querySelector('[data-music]');
 w.document.querySelector('main a')!.dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true,button:0}));
 await new Promise(r=>setTimeout(r,10));
 expect(w.document.querySelector('h1')!.textContent).toBe('Page 2');expect(w.location.search).toBe('?page=2');
 expect(w.document.querySelector('[data-music]')).toBe(player);expect(instances).toBe(1);expect(plays).toBe(1);
 w.history.replaceState(null,'','/intro?page=1');w.dispatchEvent(new w.PopStateEvent('popstate'));
 await new Promise(r=>setTimeout(r,10));expect(w.document.querySelector('h1')!.textContent).toBe('Page 1');expect(plays).toBe(1);
 dom.window.close();
});
