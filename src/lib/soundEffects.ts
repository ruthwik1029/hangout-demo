/**
 * HANGOUT Web Audio Synthesizer
 * Generates realistic thermal printer paper feed sounds and success chimes
 * using the standard browser Web Audio API. Zero external audio file dependencies.
 */

const STORAGE_KEY_MUTED = 'hangout_printer_sound_muted';

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function isPrinterSoundMuted(): boolean {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(STORAGE_KEY_MUTED) === 'true';
}

export function setPrinterSoundMuted(muted: boolean): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY_MUTED, String(muted));
}

/**
 * Plays a realistic mechanical thermal paper feed sound
 */
export function playThermalPrinterSound(durationMs = 2200): () => void {
  if (isPrinterSoundMuted()) return () => {};
  const ctx = getAudioContext();
  if (!ctx) return () => {};

  let isPlaying = true;

  try {
    const bufferSize = ctx.sampleRate * (durationMs / 1000);
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    // Create subtle pulsed thermal printer motor noise
    for (let i = 0; i < bufferSize; i++) {
      const stepPulse = Math.sin((i / ctx.sampleRate) * 2 * Math.PI * 180); // 180Hz stepper buzz
      const whiteNoise = (Math.random() * 2 - 1) * 0.15;
      output[i] = (stepPulse > 0 ? whiteNoise * 1.5 : whiteNoise * 0.4);
    }

    const whiteNoiseSource = ctx.createBufferSource();
    whiteNoiseSource.buffer = noiseBuffer;

    // Filter to sound like a small thermal receipt roller
    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.setValueAtTime(1400, ctx.currentTime);
    bandpass.Q.setValueAtTime(1.8, ctx.currentTime);

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0.08, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationMs / 1000);

    whiteNoiseSource.connect(bandpass);
    bandpass.connect(gainNode);
    gainNode.connect(ctx.destination);

    whiteNoiseSource.start();

    return () => {
      if (isPlaying) {
        isPlaying = false;
        try {
          whiteNoiseSource.stop();
          whiteNoiseSource.disconnect();
        } catch {}
      }
    };
  } catch {
    return () => {};
  }
}

/**
 * Plays a subtle, pleasant two-tone completion chime
 */
export function playCompletionChime(): void {
  if (isPrinterSoundMuted()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;

    // Tone 1: E5 (659.25 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0.08, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.3);

    // Tone 2: G#5 / B5 (987.77 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(987.77, now + 0.12);
    gain2.gain.setValueAtTime(0.1, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.6);
  } catch {}
}
