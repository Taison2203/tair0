/** A quiet three-note cue. If autoplay is blocked, unlock on entry interaction. */
export function playBrandSound({ waitForIntroTap = false } = {}) {
  const Audio = window.AudioContext || window.webkitAudioContext;
  if (!Audio) return;
  let context;
  try { context = new Audio(); } catch { return; }

  const listeners = new AbortController();
  let played = false;
  function play() {
    if (played || context.state !== 'running') return;
    played = true;
    listeners.abort();
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
  if (waitForIntroTap && context.state !== 'running' && navigator.getAutoplayPolicy?.(context) !== 'allowed') {
    return unlock;
  }
  const options = { signal: listeners.signal, capture: true };
  for (const selector of ['#brand-intro', '#language-screen']) {
    document.querySelector(selector).addEventListener('click', unlock, options);
  }
  if (context.state === 'running') play();
  else if (navigator.getAutoplayPolicy?.(context) === 'allowed') unlock();
}
