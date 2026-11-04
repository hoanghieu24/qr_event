/**
 * Scanner sound and haptic feedback utility
 * Supports iOS Safari, Android Chrome, and Mobile In-App Browsers (Zalo, etc.)
 * with auto-unlocking AudioContext and HTML5 Audio fallback.
 */
import { ref } from 'vue';

export const isSoundEnabled = ref<boolean>(true);

let sharedAudioCtx: AudioContext | null = null;
let fallbackSuccessAudio: HTMLAudioElement | null = null;
let fallbackWarningAudio: HTMLAudioElement | null = null;
let fallbackErrorAudio: HTMLAudioElement | null = null;

// Initialize WAV Audio element from synthesized PCM
function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

function createWavDataUri(sampleRate: number, durationSec: number, getSample: (t: number) => number): string {
  const numSamples = Math.floor(sampleRate * durationSec);
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true); // 16-bit mono block align
  view.setUint16(34, 16, true); // Bits per sample
  writeString(view, 36, 'data');
  view.setUint32(40, numSamples * 2, true);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const s = Math.max(-1, Math.min(1, getSample(t)));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return 'data:audio/wav;base64,' + btoa(binary);
}

function getFallbackAudio(type: 'SUCCESS' | 'ALREADY_USED' | 'INVALID'): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null;
  try {
    if (type === 'SUCCESS') {
      if (!fallbackSuccessAudio) {
        const uri = createWavDataUri(22050, 0.35, (t) => {
          if (t < 0.08) {
            return Math.sin(2 * Math.PI * 1318.5 * t) * 0.7; // E6
          }
          const t2 = t - 0.08;
          const env = Math.exp(-t2 * 9);
          return (Math.sin(2 * Math.PI * 1760 * t) * 0.8 + Math.sin(2 * Math.PI * 2637 * t) * 0.25) * env; // A6 + E7 chime
        });
        fallbackSuccessAudio = new Audio(uri);
      }
      return fallbackSuccessAudio;
    } else if (type === 'ALREADY_USED') {
      if (!fallbackWarningAudio) {
        const uri = createWavDataUri(22050, 0.35, (t) => {
          if (t < 0.12) {
            return Math.sin(2 * Math.PI * 520 * t) * 0.6;
          }
          if (t < 0.18) return 0;
          return Math.sin(2 * Math.PI * 440 * (t - 0.18)) * 0.6;
        });
        fallbackWarningAudio = new Audio(uri);
      }
      return fallbackWarningAudio;
    } else {
      if (!fallbackErrorAudio) {
        const uri = createWavDataUri(22050, 0.3, (t) => {
          const freq = 200 - t * 150;
          return (Math.sin(2 * Math.PI * freq * t) > 0 ? 0.5 : -0.5) * Math.exp(-t * 4);
        });
        fallbackErrorAudio = new Audio(uri);
      }
      return fallbackErrorAudio;
    }
  } catch {
    return null;
  }
}

export function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!sharedAudioCtx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        sharedAudioCtx = new AudioCtxClass();
      }
    }
    if (sharedAudioCtx && sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {});
    }
  } catch {
    // Ignore
  }
  return sharedAudioCtx;
}

/**
 * Call on any user gesture to unlock Web Audio on iOS and Android
 */
export function unlockAudio() {
  try {
    const ctx = getAudioContext();
    if (ctx) {
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      // Play a 1ms inaudible buffer to wake up mobile audio hardware
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
    }
    // Also preload fallback audio
    getFallbackAudio('SUCCESS');
  } catch {
    // Ignore
  }
}

// Attach auto-unlock listeners on first user interaction
if (typeof window !== 'undefined') {
  const events = ['click', 'touchstart', 'touchend', 'pointerdown', 'keydown'];
  const onInteraction = () => {
    unlockAudio();
  };
  events.forEach((evt) => {
    window.addEventListener(evt, onInteraction, { once: false, passive: true });
  });
}

/**
 * Play synthesized check-in sound & trigger tactile haptic vibration
 */
export function playScanSound(type: 'SUCCESS' | 'ALREADY_USED' | 'INVALID' = 'SUCCESS') {
  if (!isSoundEnabled.value) return;

  // 1. Tactile feedback (Vibration)
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      if (type === 'SUCCESS') {
        navigator.vibrate([100]);
      } else if (type === 'ALREADY_USED') {
        navigator.vibrate([120, 60, 120]);
      } else {
        navigator.vibrate([250]);
      }
    }
  } catch {}

  let playedWithWebAudio = false;

  // 2. High-fidelity Web Audio API
  try {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'running') {
      const now = ctx.currentTime;

      if (type === 'SUCCESS') {
        // High-pitched bright scanner chime (1318.5Hz E6 -> 1760Hz A6 + sparkle 2637Hz)
        const masterGain = ctx.createGain();
        masterGain.connect(ctx.destination);
        masterGain.gain.setValueAtTime(0.85, now);

        // Tone 1: E6 (first ding)
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(1318.5, now);
        gain1.gain.setValueAtTime(0.8, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc1.connect(gain1);
        gain1.connect(masterGain);
        osc1.start(now);
        osc1.stop(now + 0.12);

        // Tone 2: A6 (crisp high chime)
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(1760.0, now + 0.07);
        gain2.gain.setValueAtTime(0.001, now);
        gain2.gain.setValueAtTime(0.9, now + 0.07);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
        osc2.connect(gain2);
        gain2.connect(masterGain);
        osc2.start(now + 0.07);
        osc2.stop(now + 0.36);

        // Sparkle overtone: E7 (crystal clear top harmonic)
        const osc3 = ctx.createOscillator();
        const gain3 = ctx.createGain();
        osc3.type = 'triangle';
        osc3.frequency.setValueAtTime(2637.0, now + 0.08);
        gain3.gain.setValueAtTime(0.001, now);
        gain3.gain.setValueAtTime(0.35, now + 0.08);
        gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
        osc3.connect(gain3);
        gain3.connect(masterGain);
        osc3.start(now + 0.08);
        osc3.stop(now + 0.28);

        playedWithWebAudio = true;
      } else if (type === 'ALREADY_USED') {
        // Warning double-beep (520Hz -> 440Hz)
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'triangle';
        osc1.frequency.setValueAtTime(520, now);
        gain1.gain.setValueAtTime(0.7, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.12);

        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(440, now + 0.15);
        gain2.gain.setValueAtTime(0.001, now);
        gain2.gain.setValueAtTime(0.7, now + 0.15);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now + 0.15);
        osc2.stop(now + 0.32);

        playedWithWebAudio = true;
      } else {
        // Error buzz (low sawtooth downsweep 220Hz -> 140Hz)
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(140, now + 0.28);
        gain.gain.setValueAtTime(0.6, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.28);

        playedWithWebAudio = true;
      }
    }
  } catch {
    playedWithWebAudio = false;
  }

  // 3. Fallback to HTML5 in-memory WAV Audio if Web Audio was suspended or failed
  if (!playedWithWebAudio) {
    try {
      const audio = getFallbackAudio(type);
      if (audio) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      }
    } catch {}
  }
}
