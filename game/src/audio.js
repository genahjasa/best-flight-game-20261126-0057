// Procedural sound for Sky Courier: a WebAudio engine hum, wind rush, ring chimes
// and touchdown thuds, all synthesised — the game ships no audio files at all.

/** Create the sound engine. Nothing starts until `unlock()` runs on a gesture. */
export function createAudio() {
  return {
    context: null,
    master: null,
    engineOsc: null,
    engineGain: null,
    windSource: null,
    windGain: null,
    windFilter: null,
    muted: false,
    unlocked: false,
  };
}

/** Build the graph. Call from a click or keypress; browsers block sound before that. */
export function unlockAudio(audio) {
  if (audio.unlocked) return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    audio.context = ctx;
    audio.master = ctx.createGain();
    audio.master.gain.value = 0.5;
    audio.master.connect(ctx.destination);

    audio.engineOsc = ctx.createOscillator();
    audio.engineOsc.type = 'sawtooth';
    audio.engineOsc.frequency.value = 55;
    audio.engineGain = ctx.createGain();
    audio.engineGain.gain.value = 0;
    const engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 320;
    audio.engineOsc.connect(engineFilter);
    engineFilter.connect(audio.engineGain);
    audio.engineGain.connect(audio.master);
    audio.engineOsc.start();

    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    audio.windSource = ctx.createBufferSource();
    audio.windSource.buffer = buffer;
    audio.windSource.loop = true;
    audio.windFilter = ctx.createBiquadFilter();
    audio.windFilter.type = 'bandpass';
    audio.windFilter.frequency.value = 480;
    audio.windFilter.Q.value = 0.6;
    audio.windGain = ctx.createGain();
    audio.windGain.gain.value = 0;
    audio.windSource.connect(audio.windFilter);
    audio.windFilter.connect(audio.windGain);
    audio.windGain.connect(audio.master);
    audio.windSource.start();

    audio.unlocked = true;
  } catch {
    audio.unlocked = false;
  }
}

/** Keep the engine and wind following the plane: call every frame while flying. */
export function updateAudio(audio, plane) {
  if (!audio.unlocked || !audio.context) return;
  const t = audio.context.currentTime;
  const rpm = 40 + plane.throttle * 90 + plane.speed * 0.35;
  audio.engineOsc.frequency.setTargetAtTime(rpm, t, 0.1);
  const engineLevel = plane.onGround && plane.throttle < 0.05 ? 0 : 0.05 + plane.throttle * 0.09;
  audio.engineGain.gain.setTargetAtTime(audio.muted ? 0 : engineLevel, t, 0.1);
  const windLevel = plane.onGround ? 0 : Math.min(0.16, plane.speed * 0.0016);
  audio.windGain.gain.setTargetAtTime(audio.muted ? 0 : windLevel, t, 0.2);
  audio.windFilter.frequency.setTargetAtTime(320 + plane.speed * 9, t, 0.2);
}

/** A short two-note chime when a ring is passed. */
export function chimeAudio(audio) {
  if (!audio.unlocked || !audio.context || audio.muted) return;
  const ctx = audio.context;
  [660, 990].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.09);
    gain.gain.exponentialRampToValueAtTime(0.22, ctx.currentTime + i * 0.09 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.09 + 0.5);
    osc.connect(gain);
    gain.connect(audio.master);
    osc.start(ctx.currentTime + i * 0.09);
    osc.stop(ctx.currentTime + i * 0.09 + 0.55);
  });
}

/** A low thud for a touchdown, harder when the landing is rough. */
export function thudAudio(audio, hard) {
  if (!audio.unlocked || !audio.context || audio.muted) return;
  const ctx = audio.context;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(hard ? 90 : 70, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(38, ctx.currentTime + 0.18);
  gain.gain.setValueAtTime(hard ? 0.5 : 0.3, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
  osc.connect(gain);
  gain.connect(audio.master);
  osc.start();
  osc.stop(ctx.currentTime + 0.3);
}

/** A dull crunch for a crash. */
export function crashAudio(audio) {
  if (!audio.unlocked || !audio.context || audio.muted) return;
  const ctx = audio.context;
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 500;
  const gain = ctx.createGain();
  gain.gain.value = 0.6;
  src.connect(filter);
  filter.connect(gain);
  gain.connect(audio.master);
  src.start();
}

/** Toggle mute; returns the new muted state. */
export function toggleMute(audio) {
  audio.muted = !audio.muted;
  return audio.muted;
}
