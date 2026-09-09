/* ============================================================
   main.js — bootstrap + wiring.
   ============================================================ */
import * as E from './engine.js';
import { initPresent, setTextSpeed } from './present.js';
import { initHud } from './hud.js';
import { initMinigames } from './minigames/index.js';
import { initBreathing } from './breathing.js';
import { initEndings } from './endings.js';
import { showMainMenu, showPauseMenu, hideScreen } from './ui.js';
import { initVoice } from './voice.js';
import { save, hasSave, loadData, clearSave } from './save.js';

initHud();
initPresent();
initMinigames();
initBreathing();
initVoice();                       // load voice manifest (tolerant of missing files)

// restore persisted text-speed preference
{ const sp = localStorage.getItem('720_speed'); if(sp!==null) setTextSpeed(+sp); }
initEndings({
  restart: ()=>{ clearSave(); E.startGame(E.state.gender); },
  toMenu:  ()=> backToMenu(),
});

/* ---- GA reporting ----
   A run is one school day. The four endings all mean the day was seen
   through, so they report outcome 'win'; the three fail screens (stress,
   energy, time) report 'lose'; leaving mid-day reports 'quit'.
   There is no single score here, so the four meters are sent instead. */
let runActive = false, runEndSent = false, runT0 = 0;

function reportGameStart(resumed){
  runActive = true; runEndSent = false; runT0 = Date.now();
  if(typeof window.gtag === 'function')
    window.gtag('event', 'game_start', { game_name: window.GAME_NAME, resumed: !!resumed });
}
function reportGameEnd(outcome, failReason){
  if(!runActive || runEndSent) return;
  runEndSent = true; runActive = false;
  if(typeof window.gtag !== 'function') return;
  const s = E.state;
  const params = {
    game_name: window.GAME_NAME,
    outcome: outcome,
    control: s.control, energy: s.energy, stress: s.stress, fun: s.fun,
    time_left: s.timeLeft,
    time_played_seconds: Math.round((Date.now() - runT0) / 1000),
  };
  if(failReason) params.fail_reason = failReason;
  window.gtag('event', 'game_end', params);
}

E.on('start', d => reportGameStart(d && d.resumed));
E.on('ending', ()=> reportGameEnd('win'));
E.on('fail', mode => reportGameEnd('lose', mode));
addEventListener('pagehide', ()=> reportGameEnd('quit'));

/* autosave on every node entry; clear the save when the day ends */
E.on('node', save);
E.on('ending', clearSave);
E.on('fail', clearSave);
E.on('restart', ()=> E.startGame(E.state.gender));

/* in-game menu button */
document.getElementById('menuBtn').onclick = ()=>{
  showPauseMenu({
    onResume:  ()=>{},
    onRestart: ()=>{ clearSave(); E.startGame(E.state.gender); },
    onMain:    ()=> backToMenu(),
  });
};

function backToMenu(){
  hideScreen();
  showMainMenu({
    canContinue: hasSave(),
    onContinue: continueGame,
  });
}

function continueGame(){
  const d = loadData();
  if(!d) return;
  hideScreen();
  E.applySaved(d);
  reportGameStart(true);
  E.goTo(d.currentId || 's0_home');
}

/* boot */
showMainMenu({ canContinue: hasSave(), onContinue: continueGame });
