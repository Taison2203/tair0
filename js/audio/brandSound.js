/** Sound follows the active intro, including when playback unlocks during it. */
export function playBrandSound(intro, { desktop }) {
  const Audio = window.AudioContext || window.webkitAudioContext;
  if (!Audio) return;
  let context;
  try { context = new Audio(); } catch { return; }

  const startedAt = performance.now();
  const mobileMix = desktop ? null : fetch(new URL('../../assets/audio/mobile-intro.wav', import.meta.url))
    .then(response => {
      if (!response.ok) throw new Error('Intro audio unavailable');
      return response.arrayBuffer();
    })
    .then(bytes => context.decodeAudioData(bytes))
    .catch(() => null);
  let played = false;
  let ended = false;
  function play() {
    if (ended || played || context.state !== 'running') return;
    played = true;
    intro.removeEventListener('pointerdown', unlock);
    intro.removeEventListener('click', unlock);
    if (desktop) {
      playAir(context, (performance.now() - startedAt) / 1000);
      return;
    }
    void mobileMix.then(buffer => {
      if (ended || !buffer) return;
      const offset = (performance.now() - startedAt) / 1000;
      if (offset >= buffer.duration) return;
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);
      source.start(context.currentTime, offset);
    });
  }

  function unlock() {
    if (ended || played) return;
    void context.resume().then(play).catch(() => {});
  }
  intro.addEventListener('pointerdown', unlock);
  intro.addEventListener('click', unlock);
  if (context.state === 'running') play();
  else unlock();
  return () => {
    ended = true;
    intro.removeEventListener('pointerdown', unlock);
    intro.removeEventListener('click', unlock);
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

  // An open fifth under the movement, resolving an octave higher at the gates.
  for (const [offset, frequency, duration, level] of [
    [1.23, 293.66, .48, .062],
    [1.86, 440, .52, .05],
    [2.72, 587.33, .62, .042],
  ]) {
    if (offset < elapsed) continue;
    const at = context.currentTime + offset - elapsed;
    const tone = context.createOscillator();
    const envelope = context.createGain();
    tone.type = 'sine';
    tone.frequency.value = frequency;
    envelope.gain.setValueAtTime(.0001, at);
    envelope.gain.exponentialRampToValueAtTime(level, at + .055);
    envelope.gain.exponentialRampToValueAtTime(.0001, at + duration);
    tone.connect(envelope).connect(context.destination);
    tone.start(at);
    tone.stop(at + duration);
  }
}
