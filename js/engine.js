/* ============================================================
   engine.js — state, deltas, flags, gender, transitions, event bus.
   No dialogue lives here. All text comes from story.js.
   ============================================================ */
import { story, START } from './story.js';

export const MAX = 10;
export const START_TIME = 45; // minutes

export const state = {
  control:5, energy:7, stress:3, fun:5,
  timeLeft:START_TIME,
  gender:'m',                 // 'm' | 'f'
  flags:{ prepared:false, goal:'', promisedDana:false, triedSolo:false, phoneAddict:false },
  currentId:null,
};

const clamp = v => Math.max(0, Math.min(MAX, v));

export function reset(gender='m'){
  state.control=5; state.energy=7; state.stress=3; state.fun=5;
  state.timeLeft=START_TIME; state.gender=gender; state.currentId=null;
  state.flags={ prepared:false, goal:'', promisedDana:false, triedSolo:false, phoneAddict:false };
}

/* ---- meters ---- */
export function applyDelta(d){
  if(!d) return [];
  const changed=[];
  for(const k of ['control','energy','stress','fun']){
    if(d[k]){ state[k]=clamp(state[k]+d[k]); changed.push({key:k, val:d[k]}); }
  }
  if(d.time){ state.timeLeft=Math.max(0, state.timeLeft+d.time); changed.push({key:'time', val:d.time}); }
  return changed;
}
export function consumeTime(min){ state.timeLeft=Math.max(0, state.timeLeft-min); }
export function applySet(set){ if(set) for(const k in set) state.flags[k]=set[k]; }

/* ---- gender + conditional text ----
   {masc/fem} -> chosen form by state.gender  */
export function resolveText(str){
  if(str==null) return '';
  const fem = state.gender==='f';
  return String(str).replace(/\{([^{}/]*)\/([^{}]*)\}/g, (_,m,f)=> fem ? f : m);
}
/* Resolve a beat's displayed line: tpl (goal) / ifTrue / ifFalse, then gender. */
export function resolveLine(beat){
  let line = beat.line;
  if(beat.tpl){
    const g = state.flags.goal || 'לא ברור';
    line = (line||'').replace(/\{\{goal\}\}/g, g);
  } else if(beat.flag){
    const val = state.flags[beat.flag];
    if(val && beat.ifTrue) line = beat.ifTrue;
    else if(!val && beat.ifFalse) line = beat.ifFalse;
  }
  return resolveText(line);
}

/* Resolve the text sent to TTS. A beat may provide a pronunciation-only
   `speech` variant while keeping the on-screen `line` unchanged. Flagged
   beats can likewise override either reachable branch. */
export function resolveSpeech(beat){
  let line = beat.speech ?? beat.line;
  if(beat.tpl){
    const g = state.flags.goal || 'לא ברור';
    line = (line||'').replace(/\{\{goal\}\}/g, g);
  } else if(beat.flag){
    const val = state.flags[beat.flag];
    if(val) line = beat.speechIfTrue ?? beat.ifTrue ?? beat.speech ?? beat.line;
    else line = beat.speechIfFalse ?? beat.ifFalse ?? beat.speech ?? beat.line;
  }
  return resolveText(line);
}

/* ---- fail check (order matters, mirrors prototype) ---- */
export function checkFail(){
  if(state.stress >= MAX) return 'stress';
  if(state.energy <= 0)   return 'energy';
  if(state.timeLeft <= 0) return 'time';
  return null;
}

/* ---- tiny event bus ---- */
const listeners = {};
export function on(evt, cb){ (listeners[evt] ||= []).push(cb); }
export function emit(evt, payload){ (listeners[evt]||[]).forEach(cb=>cb(payload)); }

/* ---- transitions ---- */
export function goTo(id){
  if(id==='ENDING'){ emit('ending'); return; }
  const node = story[id];
  if(!node){ console.warn('[720] unknown node:', id); return; }
  state.currentId = id;
  if(node.minigame){ emit('minigame', { to:node.to }); return; }
  if(node.breathing){ emit('breathing', { to:node.to, calm:node.calm }); return; }
  emit('node', { id, node });
}

export function startGame(gender){
  reset(gender);
  goTo(START);
}

/* restore a saved snapshot (see save.js) */
export function applySaved(d){
  if(!d) return;
  state.control = d.control; state.energy = d.energy; state.stress = d.stress; state.fun = d.fun;
  state.timeLeft = d.timeLeft; state.gender = d.gender; state.currentId = d.currentId;
  state.flags = { prepared:false, goal:'', promisedDana:false, triedSolo:false, phoneAddict:false, ...(d.flags||{}) };
}
