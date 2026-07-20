/* ============================================================
   present.js — immersive presentation: art-per-beat, typewriter,
   beats, choices, delta chips. Listens to engine events.
   ============================================================ */
import * as E from './engine.js';
import { CHAR, MOMENT, BG, bgVariant, charImage } from './assets.js';
import { playTick, playSelect, playConfirm } from './audio.js';
import { speakBeat, speakChoice, prefetchChoices, stopVoice } from './voice.js';

const artEl      = document.getElementById('art');
const dialogueEl = document.getElementById('dialogue');
const tagEl      = document.getElementById('sceneTag');
const stageEl    = document.getElementById('stage');

const CHAR_SPEAKERS = ['michal','dana','yoav','bot'];

/* text speed (ms per char); 0 = instant. Adjustable from settings. */
export let textSpeed = 32;
export function setTextSpeed(ms){ textSpeed = ms; }

/* ---- two-layer crossfade art ---- */
let layerA, layerB, activeLayer, currentArt=null;
function initArtLayers(){
  artEl.innerHTML = '';
  const mk = ()=>{ const d=document.createElement('div'); d.className='art-fx'; artEl.appendChild(d); return d; };
  layerA = mk(); layerB = mk(); activeLayer = layerA;
}
function setArt(path){
  if(!path || path===currentArt) return;
  currentArt = path;
  const next = activeLayer===layerA ? layerB : layerA;
  next.style.backgroundImage = `url("${path}")`;
  // force reflow so the opacity transition runs
  void next.offsetWidth;
  next.style.opacity = 1;
  activeLayer.style.opacity = 0;
  activeLayer = next;
}

/* choose art for a beat */
function artForBeat(node, beat){
  if(beat.moment && MOMENT[beat.moment]) return MOMENT[beat.moment];
  if(CHAR_SPEAKERS.includes(beat.speaker)) return charImage(beat.speaker, beat.emotion);
  // narrator / inner / you -> location background
  if(beat.bg && BG[beat.bg]) return BG[beat.bg];
  if(node.bg && BG[node.bg]) return BG[node.bg];
  if(node.place) return bgVariant(node.place, E.state.stress);
  return currentArt;
}

/* ---- typewriter that preserves <em> ---- */
let typeTimer=null, typing=false, fullChars=[], typedCount=0, lineEl=null, lastFinish=0;
function markFinished(){ lastFinish = performance.now(); }
function readyToAdvance(){ return performance.now() - lastFinish > 180; }
function tokenize(html){
  const chars=[]; const re=/<em>([\s\S]*?)<\/em>|([\s\S]+?)(?=<em>|$)/g; let m;
  while((m=re.exec(html))){
    const txt = m[1]!=null ? m[1] : m[2];
    const em  = m[1]!=null;
    if(txt==null) continue;
    for(const c of txt) chars.push({c, em});
  }
  return chars;
}
function renderTyped(n){
  let html='', open=false;
  for(let i=0;i<n;i++){
    const {c,em}=fullChars[i];
    if(em && !open){ html+='<em>'; open=true; }
    if(!em && open){ html+='</em>'; open=false; }
    html += c;
  }
  if(open) html+='</em>';
  return html;
}
function startType(el, html, done){
  clearInterval(typeTimer); lineEl=el; fullChars=tokenize(html); typedCount=0;
  if(textSpeed<=0){ el.innerHTML = html; typing=false; done && done(); return; }
  typing=true;
  el.innerHTML = '<span class="caret">▍</span>';
  typeTimer = setInterval(()=>{
    typedCount++;
    const ch = fullChars[typedCount-1];
    if(ch && !/\s/.test(ch.c)) playTick();
    el.innerHTML = renderTyped(typedCount) + (typedCount<fullChars.length?'<span class="caret">▍</span>':'');
    if(typedCount>=fullChars.length){ clearInterval(typeTimer); typing=false; markFinished(); done && done(); }
  }, textSpeed);
}
function finishType(){
  if(!typing) return false;
  clearInterval(typeTimer); typing=false;
  if(lineEl) lineEl.innerHTML = renderTyped(fullChars.length);
  markFinished();
  return true;
}

/* ---- node / beat rendering ---- */
let node=null, beatIndex=0;

function renderNode({id, node:n}){
  node = n; beatIndex = 0;
  tagEl.textContent = E.resolveText(n.tag || '');
  E.emit('bars', { flash:[] });               // keep HUD in sync
  const f = E.checkFail(); if(f){ E.emit('fail', f); return; }
  showBeat();
}

function showBeat(){
  const beat = node.beats[beatIndex];
  const isLast = beatIndex >= node.beats.length-1;
  setArt(artForBeat(node, beat));
  stopVoice();                                   // cut the previous beat's audio

  const speaker = beat.speaker;
  const name = beat.name || (speaker==='inner' ? 'מחשבה' : speaker==='narrator' ? '' : '');
  const lineHtml = E.resolveLine(beat);
  if(CHAR_SPEAKERS.includes(speaker)) speakBeat(speaker, E.resolveSpeech(beat));

  dialogueEl.innerHTML =
    `<div class="fade-in">`+
      (name!=='' || speaker!=='narrator' ? `<span class="speaker ${speaker}">${name||'…'}</span>` : '')+
      `<div class="line" id="lineText"></div>`+
      `<div id="afterLine"></div>`+
    `</div>`;

  const lineNode = document.getElementById('lineText');
  const after = document.getElementById('afterLine');

  startType(lineNode, lineHtml, ()=> renderControls(after, isLast));
  // click anywhere on the box: finish typing, else advance
  dialogueEl.onclick = (ev)=>{
    if(ev.target.closest('.choice, .continue-btn, button')) return;
    if(finishType()){ renderControls(after, isLast); return; }   // 1st click: finish line only
    if(!isLast && readyToAdvance()){ advanceBeat(); }            // then advance (guarded)
  };
}

function renderControls(after, isLast){
  after.innerHTML = '';
  if(!isLast){
    after.innerHTML = `<button class="continue-btn" id="beatBtn">המשך <span class="btn-arrow">←</span></button>`;
    document.getElementById('beatBtn').onclick = ()=>{ playConfirm(); advanceBeat(); };
    return;
  }
  if(node.choices){
    // don't drop the choices on top of the line — let the player finish reading,
    // then click once to bring up the decision notes.
    after.innerHTML = `<button class="continue-btn ready-cue" id="revealBtn">להחליט <span class="btn-arrow">←</span></button>`;
    document.getElementById('revealBtn').onclick = ()=>{ playConfirm(); revealChoices(after); };
  } else if(node.continue){
    after.innerHTML = `<button class="continue-btn" id="contBtn">המשך <span class="btn-arrow">←</span></button>`;
    document.getElementById('contBtn').onclick = ()=>{ playConfirm(); handleContinue(); };
  } else if(node.sliceEnd){
    after.innerHTML = `<button class="continue-btn" id="restartBtn">מהתחלה 🔄</button>`;
    document.getElementById('restartBtn').onclick = ()=>{ playConfirm(); E.emit('restart'); };
  }
}

function revealChoices(after){
  after.innerHTML = '';
  prefetchChoices(node);
  const wrap = document.createElement('div'); wrap.className='choices';
  node.choices.forEach((c,i)=>{
    const b = document.createElement('button');
    b.className = 'choice note note'+(i%4);
    b.style.animationDelay = (i*80) + 'ms';
    b.innerHTML = `<span class="pin"></span>`+
                  `<span class="choice-text">${E.resolveText(c.t)}</span>`+
                  `${c.hint?`<span class="hint-tag">${E.resolveText(c.hint)}</span>`:''}`;
    b.onmouseenter = ()=>{ if(!speakChoice(E.resolveText(c.t))) playSelect(); };
    b.onclick = ()=> handleChoice(c);
    wrap.appendChild(b);
  });
  after.appendChild(wrap);
}

function advanceBeat(){ beatIndex++; showBeat(); }

function handleContinue(){
  stopVoice();
  const changed = E.applyDelta(node.d);
  E.applySet(node.set);
  E.emit('bars', { flash: changed.map(c=>c.key) });
  const f = E.checkFail(); if(f){ E.emit('fail', f); return; }
  E.goTo(node.continue);
}

const FB_TEXT = {
  control:{up:'🎯 שליטה עלתה', down:'🎯 שליטה ירדה'},
  energy:{up:'⚡ אנרגיה עלתה', down:'⚡ אנרגיה ירדה'},
  stress:{up:'🔥 לחץ עלה',    down:'🔥 לחץ ירד'},
  fun:{up:'😊 סיפוק עלה',     down:'😊 סיפוק ירד'},
};

function handleChoice(choice){
  stopVoice();
  playSelect();
  E.applySet(choice.set);
  const changed = E.applyDelta(choice.d);
  const flash = changed.map(c=>c.key);
  E.emit('bars', { flash });

  const bad = changed.some(c => (c.key==='stress'&&c.val>0) ||
                                (['control','energy','fun'].includes(c.key)&&c.val<0));
  if(bad){ stageEl.classList.remove('shake'); void stageEl.offsetWidth; stageEl.classList.add('shake'); }

  let chips='';
  changed.forEach(c=>{
    if(c.key==='time'){ chips+=`<span class="fb time">⏳ ${c.val>0?'+':''}${c.val} דק'</span>`; return; }
    const up=c.val>0;
    chips+=`<span class="fb ${c.key}-${up?'up':'down'}">${FB_TEXT[c.key][up?'up':'down']} ${up?'+':''}${c.val}</span>`;
  });

  const fail = E.checkFail();
  dialogueEl.onclick = null;
  dialogueEl.innerHTML =
    `<div class="fade-in">`+
      `<span class="speaker you">הבחירה שלך</span>`+
      `<div class="line">${E.resolveText(choice.t)}</div>`+
      (chips?`<div class="fb-row">${chips}</div>`:'')+
      (fail?`<div class="warn-text">${fail==='stress'?'🔥 הלחץ הגיע לשיא…':fail==='energy'?'⚡ האנרגיה נגמרה…':'⏳ הזמן אזל…'}</div>`:'')+
      `<button class="continue-btn" id="contBtn">המשך ←</button>`+
    `</div>`;
  document.getElementById('contBtn').onclick = ()=>{
    playConfirm();
    if(fail){ E.emit('fail', fail); } else { E.goTo(choice.to); }
  };
}

/* public init */
export function initPresent(){
  initArtLayers();
  E.on('node', renderNode);
}
export { setArt };
