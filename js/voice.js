/* ============================================================
   voice.js — runtime speech playback. Loads a manifest of
   pre-generated ElevenLabs clips (built by scripts/generate_voices.mjs)
   and plays the right one per beat / choice. Degrades silently.
   ============================================================ */
import * as E from './engine.js';
import { clipId } from './voice-hash.js';

let manifest = null;
let cur = null;                                    // the currently-playing Audio
let prefetched = [];                               // retained refs so prefetch Audio objects aren't GC'd
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
  if(!voiceOn) return false;
  const speaker = E.state.gender === 'f' ? 'dana' : 'yoav';
  const src = srcFor(speaker, resolvedChoiceText);
  if(!src) return false;
  play(src);
  return true;
}

export function prefetchChoices(node){
  if(!manifest || !node || !node.choices) return;
  prefetched = [];                                    // drop the previous node's prefetch refs
  const speaker = E.state.gender === 'f' ? 'dana' : 'yoav';
  for(const c of node.choices){
    const src = srcFor(speaker, E.resolveSpeech({ speech:c.speech ?? c.t }));
    if(src){ const a = new Audio(); a.preload = 'auto'; a.src = src; prefetched.push(a); }
  }
}

export function setVoiceOn(on){
  voiceOn = !!on;
  localStorage.setItem('720_voice', voiceOn ? '1' : '0');
  if(!voiceOn) stopVoice();
}
export function isVoiceOn(){ return voiceOn; }
