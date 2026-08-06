// Lightweight, dependency-free chat sound effects — generated on the fly
// with the Web Audio API instead of loading mp3/wav files, so there's
// nothing to host, no CORS concerns, and no asset bundle bloat.
//
// Browsers require an AudioContext to be created/resumed after a user
// gesture (click, keypress, tap) before it's allowed to produce sound.
// We lazily create ONE shared context on first use and resume it if
// suspended — the first interaction anywhere in the chat UI (opening
// the panel, typing, clicking send) "unlocks" audio for the rest of
// the session, so subsequent programmatic sounds (like an incoming
// message chime) play without needing their own fresh gesture.

let ctx = null;

const getContext = () => {
  if (!ctx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    ctx = new AudioCtx();
  }
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
  return ctx;
};

// Plays a single short tone. frequency in Hz, duration in seconds.
const playTone = (
  frequency,
  duration,
  { type = "sine", volume = 0.18, delay = 0 } = {},
) => {
  const audioCtx = getContext();
  if (!audioCtx) return;

  try {
    const startTime = audioCtx.currentTime + delay;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, startTime);

    // Quick fade in/out avoids audible clicks at the start/end of the tone.
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(volume, startTime + 0.01);
    gain.gain.linearRampToValueAtTime(0, startTime + duration);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
  } catch {
    /* no-op — never let a sound-effect failure break the chat itself */
  }
};

// ── Sent message: a quick, subtle upward blip ──
export const playSendSound = () => {
  playTone(720, 0.06, { type: "sine", volume: 0.14 });
};

// ── Received message (while that chat is open): a soft two-note "pop" ──
export const playReceiveSound = () => {
  playTone(500, 0.07, { type: "sine", volume: 0.16 });
  playTone(760, 0.09, { type: "sine", volume: 0.16, delay: 0.06 });
};

// ── Background notification (new message in a chat/group you're NOT
// currently viewing): a brighter two-note chime so it's distinguishable
// from the inline "receive" pop above. ──
export const playNotificationSound = () => {
  playTone(660, 0.1, { type: "triangle", volume: 0.2 });
  playTone(880, 0.14, { type: "triangle", volume: 0.2, delay: 0.09 });
};