// Lessons come from completed failed encounters, never from a destination's
// future enemy list. Equipment descriptions are available with the item.
export const SPRAY_LESSON='Spray gets through much of ordinary armour. Hazmat coveralls or sealed armour block spray attacks; a respirator halves the remaining spray damage.';
export function failureLessons(result:string,log:readonly string[]):string[]{
 if(result!=='defeated')return [];
 return log.some(line=>/\bsprayed\b[^·]*?\s[1-9]\d*\.?\s*(?:·|$)/.test(line))?[SPRAY_LESSON]:[];
}
