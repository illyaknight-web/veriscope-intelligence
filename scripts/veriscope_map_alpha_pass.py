from pathlib import Path
p=Path('veriscope-alpha-command.html')
s=p.read_text()
marker='/* VERISCOPE ILLUMINATED MAP ALPHA PASS */'
if marker in s:
    print('map alpha pass already present')
    raise SystemExit(0)
css='''
<style>
/* VERISCOPE ILLUMINATED MAP ALPHA PASS */
.worldWrap{background:radial-gradient(ellipse at 50% 46%,rgba(28,103,165,.20),transparent 44%),radial-gradient(circle at 25% 38%,rgba(53,143,229,.12),transparent 18%),radial-gradient(circle at 50% 28%,rgba(240,169,59,.10),transparent 14%),linear-gradient(180deg,#06111d 0%,#050d16 100%)!important}
.worldWrap:before{content:"";position:absolute;inset:0;pointer-events:none;z-index:1;background-image:radial-gradient(circle at 19% 33%,rgba(255,194,75,.95) 0 1px,transparent 2px),radial-gradient(circle at 21% 35%,rgba(255,194,75,.7) 0 1px,transparent 2px),radial-gradient(circle at 23% 37%,rgba(73,166,255,.9) 0 1px,transparent 2px),radial-gradient(circle at 27% 40%,rgba(255,194,75,.8) 0 1px,transparent 2px),radial-gradient(circle at 47% 25%,rgba(255,194,75,.95) 0 1px,transparent 2px),radial-gradient(circle at 50% 27%,rgba(255,194,75,.8) 0 1px,transparent 2px),radial-gradient(circle at 53% 29%,rgba(73,166,255,.85) 0 1px,transparent 2px),radial-gradient(circle at 55% 31%,rgba(255,194,75,.75) 0 1px,transparent 2px),radial-gradient(circle at 68% 33%,rgba(255,194,75,.9) 0 1px,transparent 2px),radial-gradient(circle at 71% 35%,rgba(73,166,255,.9) 0 1px,transparent 2px),radial-gradient(circle at 74% 38%,rgba(255,194,75,.85) 0 1px,transparent 2px),radial-gradient(circle at 77% 41%,rgba(255,194,75,.7) 0 1px,transparent 2px),radial-gradient(circle at 30% 63%,rgba(255,194,75,.8) 0 1px,transparent 2px),radial-gradient(circle at 32% 67%,rgba(73,166,255,.75) 0 1px,transparent 2px),radial-gradient(circle at 51% 58%,rgba(255,194,75,.85) 0 1px,transparent 2px),radial-gradient(circle at 54% 63%,rgba(255,194,75,.7) 0 1px,transparent 2px),radial-gradient(circle at 83% 70%,rgba(255,194,75,.95) 0 1px,transparent 2px),radial-gradient(circle at 86% 72%,rgba(73,166,255,.75) 0 1px,transparent 2px);filter:drop-shadow(0 0 4px rgba(255,194,75,.85));opacity:.9;animation:cityPulse 4.8s ease-in-out infinite alternate}
.worldWrap:after{content:"";position:absolute;inset:0;pointer-events:none;z-index:1;background:repeating-linear-gradient(0deg,rgba(95,160,225,.025) 0 1px,transparent 1px 4px);mix-blend-mode:screen;opacity:.28}
@keyframes cityPulse{0%{opacity:.68}100%{opacity:1}}
.worldWrap svg{position:relative;z-index:0;filter:drop-shadow(0 0 18px rgba(32,104,168,.16))}
.land{fill:url(#vsLandGradient)!important;stroke:#2e678f!important;stroke-width:1.15!important;filter:url(#vsLandGlow)}
.graticule{stroke:#214968!important;opacity:.28!important}
.connection{stroke-width:1.45!important;opacity:.74!important;filter:drop-shadow(0 0 5px rgba(73,166,255,.55));stroke-dasharray:4 8!important}
.connection.gold{filter:drop-shadow(0 0 5px rgba(255,194,75,.55))}.connection.red{filter:drop-shadow(0 0 6px rgba(229,72,77,.58))}
.marker{animation:markerPulse 2.4s ease-in-out infinite alternate}
.marker:after{content:"";position:absolute;inset:-14px;border:1px solid rgba(255,255,255,.18);border-radius:50%;opacity:.22;animation:ringPulse 2.8s ease-out infinite}
@keyframes markerPulse{to{transform:scale(1.12)}}@keyframes ringPulse{0%{transform:scale(.72);opacity:.28}100%{transform:scale(1.35);opacity:0}}
.regionLabel{font-weight:600;letter-spacing:.025em}.regionLabel span{letter-spacing:.045em}
@media(max-width:760px){.worldWrap{height:500px!important;flex-basis:500px!important}.worldWrap svg{transform:scale(1.04);transform-origin:center center}.regionLabel{font-size:8px!important;text-shadow:0 1px 4px #000,0 0 9px rgba(0,0,0,.8)!important}.regionLabel span{font-size:6.7px!important}.mapHeader{padding-bottom:12px!important}}
</style>
'''
js='''
<script>
(function(){
 const svg=document.querySelector('#worldWrap svg'); if(!svg||svg.querySelector('#vsMapDefs'))return;
 const NS='http://www.w3.org/2000/svg';
 const defs=document.createElementNS(NS,'defs'); defs.id='vsMapDefs';
 defs.innerHTML='<linearGradient id="vsLandGradient" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#123c5e"/><stop offset="45%" stop-color="#0a2740"/><stop offset="100%" stop-color="#061723"/></linearGradient><filter id="vsLandGlow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.8" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter><filter id="vsCityGlow" x="-500%" y="-500%" width="1000%" height="1000%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>';
 svg.insertBefore(defs,svg.firstChild);
 const pts=[[170,150,'g'],[188,158,'g'],[205,165,'b'],[220,172,'g'],[245,183,'g'],[260,192,'b'],[438,118,'g'],[458,124,'g'],[475,131,'g'],[492,137,'b'],[510,144,'g'],[526,150,'g'],[590,145,'b'],[612,154,'g'],[638,162,'g'],[667,171,'b'],[695,181,'g'],[720,188,'r'],[748,195,'b'],[270,285,'g'],[286,306,'b'],[300,324,'g'],[315,345,'g'],[500,250,'b'],[520,270,'g'],[535,296,'g'],[760,318,'b'],[790,330,'g'],[820,346,'g']];
 const g=document.createElementNS(NS,'g');g.setAttribute('filter','url(#vsCityGlow)');g.setAttribute('opacity','.92');
 pts.forEach((q,i)=>{const c=document.createElementNS(NS,'circle');c.setAttribute('cx',q[0]);c.setAttribute('cy',q[1]);c.setAttribute('r',i%5===0?'2.1':'1.25');c.setAttribute('fill',q[2]==='g'?'#ffc24b':q[2]==='r'?'#ff5d62':'#49a6ff');g.appendChild(c)});svg.appendChild(g);
})();
</script>
'''
s=s.replace('</head>',css+'</head>',1)
s=s.replace('</body>',js+'</body>',1)
p.write_text(s)
print('patched')
