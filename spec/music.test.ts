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
 expect(audio.src).toBe(expected); expect(audio.paused).toBe(true);
 w.document.querySelector('button')!.click(); await Promise.resolve();
 expect(w.localStorage.getItem('holdout.music.enabled')).toBe('true');expect(audio.paused).toBe(false);
 const details=w.document.querySelector('details')!;details.open=true;details.dispatchEvent(new w.Event('toggle'));
 expect(audio.src).toBe(expected);
 details.open=false;details.dispatchEvent(new w.Event('toggle'));expect(audio.src).toBe(expected);
 w.document.querySelector('button')!.click();expect(audio.paused).toBe(true);expect(w.localStorage.getItem('holdout.music.enabled')).toBe('false');
 dom.window.close();
});
