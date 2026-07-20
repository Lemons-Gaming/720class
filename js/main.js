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
  restart: ()=>{ hideScreen(); clearSave(); E.startGame(E.state.gender); },
  toMenu:  ()=> backToMenu(),
});

/* autosave on every node entry; clear the save when the day ends */
E.on('node', save);
E.on('ending', clearSave);
E.on('fail', clearSave);
E.on('restart', ()=> E.startGame(E.state.gender));

/* in-game menu button */
document.getElementById('menuBtn').onclick = ()=>{
  showPauseMenu({
    onResume:  ()=>{},
    onRestart: ()=>{ hideScreen(); clearSave(); E.startGame(E.state.gender); },
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
  E.goTo(d.currentId || 's0_home');
}

/* boot */
showMainMenu({ canContinue: hasSave(), onContinue: continueGame });
