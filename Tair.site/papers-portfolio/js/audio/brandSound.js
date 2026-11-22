/** Sound follows the active intro, including when playback unlocks during it. */
export function playBrandSound(intro, { desktop }) {
  const Audio = window.AudioContext || window.webkitAudioContext;
  if (!Audio) return;
  let context;
  try { context = new Audio(); } catch { return; }

  const listeners = new AbortController();
  const startedAt = performance.now();
  let played = false;
  function play() {
    if (played || context.state !== 'running') return;
    played = true;
    listeners.abort();
    if (desktop) {
      playAir(context, (performance.now() - startedAt) / 1000);
      return;
    }
    const start = context.currentTime + .025;
    const timbre = context.createPeriodicWave(
      new Float32Array(4),
      new Float32Array([0, 1, .24, .07])
    );
    const notes = [[392, 0, .42], [587.33, .17, .48], [783.99, .39, .62]];
    for (const [frequency, offset, duration] of notes) {
      const tone = context.createOscillator();
      tone.setPeriodicWave(timbre);
      const envelope = context.createGain();
      const at = start + offset;
      tone.frequency.setValueAtTime(frequency * .995, at);
      tone.frequency.exponentialRampToValueAtTime(frequency, at + .09);
      envelope.gain.setValueAtTime(.0001, at);
      envelope.gain.exponentialRampToValueAtTime(.105, at + .045);
      envelope.gain.exponentialRampToValueAtTime(.047, at + .14);
      envelope.gain.exponentialRampToValueAtTime(.0001, at + duration);
      tone.connect(envelope).connect(context.destination);
      tone.start(at);
      tone.stop(at + duration);
    }
    setTimeout(() => { void context.close().catch(() => {}); }, 1150);
  }

  function unlock() {
    if (played) return;
    void context.resume().then(play).catch(() => {});
  }
  intro.addEventListener('click', unlock, { signal: listeners.signal });
  if (context.state === 'running') play();
  else unlock();
  return () => {
    listeners.abort();
    if (context.state !== 'closed') void context.close().catch(() => {});
  };
}

function playAir(context, elapsed) {
  const wind = context.createBuffer(1, Math.ceil(context.sampleRate * .8), context.sampleRate);
  const samples = wind.getChannelData(0);
  for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;

  // Offsets follow the CSS for letter separation, the falling line, and the gates.
  for (const [offset, duration, from, to, volume] of [
    [1.11, .46, 650, 1350, .15],
    [1.69, .70, 1500, 370, .18],
    [2.56, .67, 530, 210, .22],
  ]) {
    if (offset < elapsed - .07) continue;
    const at = context.currentTime + Math.max(.025, offset - elapsed);
    const air = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const envelope = context.createGain();
    air.buffer = wind;
    filter.type = 'bandpass';
    filter.Q.value = .65;
    filter.frequency.setValueAtTime(from, at);
    filter.frequency.exponentialRampToValueAtTime(to, at + duration);
    envelope.gain.setValueAtTime(.0001, at);
    envelope.gain.linearRampToValueAtTime(volume, at + duration * .37);
    envelope.gain.exponentialRampToValueAtTime(.0001, at + duration);
    air.connect(filter).connect(envelope).connect(context.destination);
    air.start(at);
    air.stop(at + duration);
  }
}
