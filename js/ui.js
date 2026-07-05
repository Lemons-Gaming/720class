/* ============================================================
   ui.js — framing screens: title, gender select, settings,
   credits, pause menu. Full save/load wired in T12/T14.
   ============================================================ */
import * as E from './engine.js';
import { setTextSpeed } from './present.js';
import { setMuted, isMuted, unlock, playClick, playConfirm } from './audio.js';
import { isVoiceOn, setVoiceOn } from './voice.js';
import { charImage, BG } from './assets.js';

const overlay = document.getElementById('screenOverlay');

export function showScreen(html, opts={}){
  overlay.innerHTML = `<div class="screen-card">${html}</div>`;
  overlay.classList.add('open');
  overlay.classList.remove('menu-splash');
  if(opts.bg){
    overlay.style.backgroundImage = `linear-gradient(rgba(16,11,31,.72), rgba(20,14,34,.9)), url("${opts.bg}")`;
    overlay.style.backgroundSize = 'cover';
    overlay.style.backgroundPosition = 'center';
  } else {
    overlay.style.backgroundImage = '';
  }
}
export function hideScreen(){ overlay.classList.remove('open'); overlay.innerHTML=''; }
export function isScreenOpen(){ return overlay.classList.contains('open'); }

/* ---- main menu ---- */
export function showMainMenu(opts={}){
  showScreen(`
    <div class="menu-tagline">מכינת 720 · היום הראשון</div>
    <div class="title" style="margin-bottom:26px;">יום ראשון,<br><span class="accent">שיעור ראשון</span></div>
    <div class="btn-stack">
      <button class="big-btn orange" id="mNew">▶ משחק חדש</button>
      <button class="big-btn" id="mCont" ${opts.canContinue?'':'disabled'}>המשך מהמקום שעצרתי</button>
      <button class="big-btn ghost" id="mSet">הגדרות</button>
      <button class="big-btn ghost" id="mCred">קרדיטים</button>
    </div>`);
  overlay.classList.add('menu-splash');
  document.getElementById('mNew').onclick  = ()=>{ unlock(); playConfirm(); showGenderSelect(g=>{ hideScreen(); E.startGame(g); }); };
  document.getElementById('mCont').onclick = ()=>{ unlock(); playConfirm(); opts.onContinue && opts.onContinue(); };
  document.getElementById('mSet').onclick  = ()=>{ unlock(); playClick(); showSettings(()=> showMainMenu(opts)); };
  document.getElementById('mCred').onclick = ()=>{ unlock(); playClick(); showCredits(()=> showMainMenu(opts)); };
}

/* ---- gender select ---- */
export function showGenderSelect(cb){
  showScreen(`
    <div class="title" style="font-size:clamp(28px,6.5vw,44px); margin-bottom:20px;">בחירת דמות</div>
    <div class="char-row">
      <button class="char-choice male" id="gM">
        <div class="char-portrait" style="background-image:url('${charImage('yoav','relief')}')"></div>
        <div class="char-banner">לשון זכר</div>
      </button>
      <button class="char-choice female" id="gF">
        <div class="char-portrait" style="background-image:url('${charImage('dana','grin')}')"></div>
        <div class="char-banner">לשון נקבה</div>
      </button>
    </div>
    <button class="big-btn ghost" id="gBack" style="margin-top:20px;">חזרה</button>`,
    { bg: BG.class_calm });
  document.getElementById('gM').onclick   = ()=>{ unlock(); playConfirm(); cb('m'); };
  document.getElementById('gF').onclick   = ()=>{ unlock(); playConfirm(); cb('f'); };
  document.getElementById('gBack').onclick= ()=>{ playClick(); showMainMenu(); };
}

/* ---- settings (text speed + sound stub) ---- */
let currentSpeedMs = (()=>{ const v = localStorage.getItem('720_speed'); return v===null ? 32 : +v; })();
export function showSettings(back){
  const speeds = [['רגיל',32],['מהיר',16],['מיידי',0]];
  const muted = isMuted();
  const vOn = isVoiceOn();
  showScreen(`
    <div class="prompt">הגדרות</div>
    <div class="setting-row"><label>מהירות טקסט</label><div id="spd" class="btn-row"></div></div>
    <div class="setting-row"><label>צלילי ממשק</label><button class="toggle-btn ${muted?'off':''}" id="snd">${muted?'מושתק':'פועל'}</button></div>
    <div class="setting-row"><label>קול דיבור</label><button class="toggle-btn ${vOn?'':'off'}" id="voi">${vOn?'פועל':'מושתק'}</button></div>
    <button class="big-btn ghost" id="sBack" style="margin-top:16px;">חזרה</button>`);
  const spd = document.getElementById('spd');
  speeds.forEach(([lbl,ms])=>{
    const b=document.createElement('button');
    b.className='big-btn'+(ms===currentSpeedMs?' green':''); b.style.cssText='padding:6px 14px;font-size:14px;';
    b.textContent=lbl;
    b.onclick=()=>{ currentSpeedMs=ms; setTextSpeed(ms); localStorage.setItem('720_speed', ms); [...spd.children].forEach(x=>x.classList.remove('green')); b.classList.add('green'); };
    spd.appendChild(b);
  });
  document.getElementById('snd').onclick=(e)=>{
    unlock();
    const willMute = !isMuted();
    setMuted(willMute);
    const t=e.currentTarget;
    t.classList.toggle('off', willMute);
    t.textContent = willMute ? 'מושתק' : 'פועל';
    if(!willMute) playConfirm();
  };
  document.getElementById('voi').onclick = (e)=>{
    unlock();
    const willOn = !isVoiceOn();
    setVoiceOn(willOn);
    const t = e.currentTarget;
    t.classList.toggle('off', !willOn);
    t.textContent = willOn ? 'פועל' : 'מושתק';
    if(willOn) playConfirm();
  };
  document.getElementById('sBack').onclick = ()=>{ playClick(); back(); };
}

/* ---- credits ---- */
export function showCredits(back){
  showScreen(`
    <div class="prompt">קרדיטים</div>
    <div class="credits-body">
      משחק חינוכי לתוכנית 720.<br>
      כתיבה, עיצוב ופיתוח — צוות 720.<br>
      איורים בסגנון graphic-novel.<br><br>
      תודה ששיחקת 🎮
    </div>
    <button class="big-btn ghost" id="cBack" style="margin-top:20px;">חזרה</button>`);
  document.getElementById('cBack').onclick = back;
}

/* ---- in-game pause menu ---- */
export function showPauseMenu({onResume, onRestart, onMain}){
  showScreen(`
    <div class="prompt">תפריט</div>
    <div class="btn-stack">
      <button class="big-btn orange" id="pRes">חזרה למשחק</button>
      <button class="big-btn ghost" id="pSet">הגדרות</button>
      <button class="big-btn ghost" id="pRestart">להתחיל את היום מחדש</button>
      <button class="big-btn ghost" id="pMain">לתפריט הראשי</button>
    </div>`);
  document.getElementById('pRes').onclick     = ()=>{ hideScreen(); onResume && onResume(); };
  document.getElementById('pSet').onclick     = ()=> showSettings(()=> showPauseMenu({onResume,onRestart,onMain}));
  document.getElementById('pRestart').onclick = ()=>{ hideScreen(); onRestart && onRestart(); };
  document.getElementById('pMain').onclick    = ()=>{ onMain && onMain(); };
}
