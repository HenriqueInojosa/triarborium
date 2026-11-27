/* Elder Futhark runes drawn as strokes in a 6x12 box: crisp at any size, no font needed */
const RUNE={f:'M1 0V12M1 3L5 0M1 6L5 3',u:'M1 12V0L5 4V12',th:'M1 0V12M1 3L5 6L1 9',a:'M1 0V12M1 0L5 3M1 4L5 7',r:'M1 12V0L5 3L1 6L5 12',k:'M5 3L1 6L5 9',g:'M0 0L6 12M6 0L0 12',w:'M1 12V0L5 3L1 6',h:'M1 0V12M5 0V12M1 4L5 8',n:'M3 0V12M1 4L5 8',i:'M3 0V12',j:'M3 1L0 4L3 7M3 5L6 8L3 11',ei:'M3 0V12M3 0L5 2M3 12L1 10',p:'M1 0V12M1 0L4 3M1 12L4 9M4 3V4M4 9V8',z:'M3 0V12M0 3L3 6L6 3',s:'M5 0L1 4L5 8L1 12',t:'M3 0V12M0 3L3 0L6 3',b:'M1 0V12M1 0L5 3L1 6L5 9L1 12',e:'M0 12V0L3 4L6 0V12',m:'M0 12V0L6 6M6 12V0L0 6',l:'M1 12V0L5 4',ng:'M3 0L6 6L3 12L0 6Z',d:'M0 0V12L6 0V12L0 0',o:'M0 12L6 4L3 0L0 4L6 12'};
/* "sombras de karazhan · triarborium" plus a few extra staves to close the ring */
const SEQ=['s','o','m','b','r','a','s','d','e','k','a','r','a','z','h','a','n','t','r','i','a','r','b','o','r','i','u','m','ng','th','ei','w','j','p','l','g'];
const f1=n=>n.toFixed(1);
const glyph=(k,sw)=>`<path class="rn" d="${RUNE[k]}" stroke-width="${sw}"/>`;
function ringRunes(r,n,size,off,sw){const s=size/12;let o='';for(let i=0;i<n;i++)o+=`<g transform="rotate(${f1(i*360/n)}) translate(0 ${-r}) scale(${s}) translate(-3 -6)">${glyph(SEQ[(i+off)%SEQ.length],f1(sw/s))}</g>`;return o}
function ticks(r1,r2,n,sw){let o='';for(let i=0;i<n;i++){const a=i*2*Math.PI/n,c=Math.cos(a),s=Math.sin(a);o+=`<line x1="${f1(c*r1)}" y1="${f1(s*r1)}" x2="${f1(c*r2)}" y2="${f1(s*r2)}" stroke-width="${sw}"/>`}return o}
function nodes(){return ['ng','o','d','ng','o','d'].map((k,i)=>{const a=(i*60-90)*Math.PI/180,x=f1(Math.cos(a)*85),y=f1(Math.sin(a)*85);
  return `<circle cx="${x}" cy="${y}" r="4.2" fill="#12081f" stroke-width=".9"/><g transform="translate(${x} ${y}) scale(.4) translate(-3 -6)">${glyph(k,2.4)}</g>`}).join('')}
/* the summoning circle around the login: rune band (slowly turning), tick ring and six rune nodes on the hexagram points */
export const RUNE_CIRCLE=`<svg class="kz-circ-ring" viewBox="-100 -100 200 200" aria-hidden="true" fill="none" stroke="currentColor"><circle r="97" stroke-width=".9"/><g class="kz-circ-spin">${ringRunes(91,44,6,2,.8)}</g><circle r="85" stroke-width=".9"/>${ticks(85,87,88,.35)}<circle r="80" stroke-width=".4" stroke-dasharray="1 3"/>${nodes()}</svg>`;
