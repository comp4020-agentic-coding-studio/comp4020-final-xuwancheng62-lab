import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {expect,it} from 'vitest';
it.each(['/','/activity','/journal','/intro?page=4','/collection/toby/comic','/world','/world#dest-nest','/expeditions','/expeditions/'])('uses page music on %s and remembers the preference', async(path)=>{
 const dom=new JSDOM('<main><article class="br-card br-won"><details><summary>Battle report</summary></details></article></main><aside data-music hidden><button></button><input value="0.25"><small data-music-label></small></aside>',{url:`http://localhost${path}`,runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window;
 let audio:any;
 class Sound extends w.EventTarget { src='';volume=0;currentTime=0;duration=73;paused=true;loop=false;preload='';constructor(){super();audio=this;} async play(){this.paused=false;} pause(){this.paused=true;} }
 Object.defineProperty(w,'Audio',{value:Sound});
 w.eval(readFileSync('static/music.js','utf8'));
 const expected = path.startsWith('/world') || path.startsWith('/expeditions') ? '/static/audio/combat.mp3' : '/static/audio/quiet.mp3';
 expect(audio.src).toBe(expected); expect(audio.paused).toBe(false);
 await Promise.resolve();
 expect(w.document.querySelector('button')!.getAttribute('aria-pressed')).toBe('true');
 const details=w.document.querySelector('details')!;details.open=true;details.dispatchEvent(new w.Event('toggle'));
 expect(audio.src).toBe(expected);
 details.open=false;details.dispatchEvent(new w.Event('toggle'));expect(audio.src).toBe(expected);
 w.document.querySelector('button')!.click();expect(audio.paused).toBe(true);expect(w.localStorage.getItem('holdout.music.enabled')).toBe('false');
 dom.window.close();
});

it.each([false,true])('respects saved mute and retries blocked autoplay: muted=%s',async(muted)=>{
 const dom=new JSDOM('<main><button id="action">Explore</button></main><aside data-music hidden><button></button><input value="0.25"><small data-music-label></small></aside>',{url:'http://localhost/',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window;let attempts=0;
 if(muted)w.localStorage.setItem('holdout.music.enabled','false');
 class Sound extends w.EventTarget {src='';volume=0;currentTime=0; async play(){if(++attempts===1)throw new Error('Autoplay blocked');} pause(){} }
 Object.defineProperty(w,'Audio',{value:Sound});w.eval(readFileSync('static/music.js','utf8'));await new Promise(resolve=>setImmediate(resolve));
 expect(attempts).toBe(muted?0:1);
 w.document.querySelector<HTMLButtonElement>('#action')!.click();await Promise.resolve();
 expect(attempts).toBe(muted?0:2);
 expect(w.document.querySelector('[data-music] button')!.textContent).toBe(muted?'♫ Music off':'♫ Music on');
 if(muted)expect(w.localStorage.getItem('holdout.music.enabled')).toBe('false');
 dom.window.close();
});
