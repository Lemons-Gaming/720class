/* ============================================================
   voice.js — runtime speech playback. Loads a manifest of
   pre-generated ElevenLabs clips (built by scripts/generate_voices.mjs)
   and plays the right one per beat / choice. Degrades silently.
   ============================================================ */
import * as E from './engine.js';
import { clipId } from './voice-hash.js';

let manifest = null;
let cur = null;                                    // the currently-playing Audio
let voiceOn = localStorage.getItem('720_voice') !== '0';   // default ON
const dev = location.hostname === 'localhost' || location.hostname === '127.0.0.1';

export async function initVoice(){
  try {
    const r = await fetch('assets/voice/manifest.json', { cache: 'no-cache' });
    manifest = r.ok ? await r.json() : null;
  } catch(_){ manifest = null; }
}

function srcFor(speaker, resolvedText){
  if(!manifest || !manifest.clips) return null;
  const c = manifest.clips[clipId(speaker, resolvedText)];
  if(!c){ if(dev) console.warn('[voice] no clip for', speaker, resolvedText); return null; }
  return 'assets/voice/' + c.file;
}

export function stopVoice(){
  if(cur){ try { cur.pause(); } catch(_){} cur = null; }
}

function play(src){
  stopVoice();
  if(!src) return;
  cur = new Audio(src);
  cur.play().catch(()=>{});                        // autoplay policy may reject — ignore
}

export function speakBeat(speaker, resolvedLineHtml){
  if(!voiceOn) return;
  play(srcFor(speaker, resolvedLineHtml));
}

export function speakChoice(resolvedChoiceText){
  if(!voiceOn) return;
  const speaker = E.state.gender === 'f' ? 'dana' : 'yoav';
  play(srcFor(speaker, resolvedChoiceText));
}

export function prefetchChoices(node){
  if(!manifest || !node || !node.choices) return;
  const speaker = E.state.gender === 'f' ? 'dana' : 'yoav';
  for(const c of node.choices){
    const src = srcFor(speaker, E.resolveText(c.t));
    if(src){ const a = new Audio(); a.preload = 'auto'; a.src = src; }
  }
}

export function setVoiceOn(on){
  voiceOn = !!on;
  localStorage.setItem('720_voice', voiceOn ? '1' : '0');
  if(!voiceOn) stopVoice();
}
export function isVoiceOn(){ return voiceOn; }
export function unlockVoice(){ /* HTML5 Audio unlocks on the same user gesture; kept for symmetry */ }
