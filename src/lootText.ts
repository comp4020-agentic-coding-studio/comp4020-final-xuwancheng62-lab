import {html} from 'hono/html';
import {GEAR, LEGENDARIES} from './game/config.ts';
// Old reports store plain text. Match only catalogued equipment labels and
// leave all surrounding/user-controlled text escaped by the template engine.
const escapePattern=(s:string)=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const names=[...Object.values(GEAR).map(g=>g.name),...Object.keys(GEAR),...LEGENDARIES.map(g=>g.name)].sort((a,b)=>b.length-a.length).map(escapePattern).join('|');
const pattern=new RegExp(`(?:(Common|Uncommon|Rare|Epic|Legendary) )?(${names})( \\(level \\d+\\)| \\((common|uncommon|rare|epic|legendary), level \\d+\\))`,'g');
export function colouredLoot(text:string){
 const out=[];let end=0;
 for(const m of text.matchAll(pattern)){
  out.push(html`${text.slice(end,m.index)}`);
  const quality=(m[1]??m[4]??'common').toLowerCase();
  out.push(html`<span class="loot-name q-${quality}">${m[1]?`${m[1]} `:''}${m[2]}</span>${m[3]}`);
  end=m.index!+m[0].length;
 }
 out.push(html`${text.slice(end)}`);return html`${out}`;
}
