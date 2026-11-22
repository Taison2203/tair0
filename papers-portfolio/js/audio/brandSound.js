/** A quiet three-note cue. If autoplay is blocked, unlock on entry interaction. */
export function playBrandSound() {
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
    const notes = [[392, 0, .32], [587.33, .14, .39], [783.99, .34, .56]];
    for (const [frequency, offset, duration] of notes) {
      const tone = context.createOscillator();
      const envelope = context.createGain();
      const at = start + offset;
      tone.frequency.setValueAtTime(frequency * .995, at);
      tone.frequency.exponentialRampToValueAtTime(frequency, at + .09);
      envelope.gain.setValueAtTime(.0001, at);
      envelope.gain.exponentialRampToValueAtTime(.045, at + .045);
      envelope.gain.exponentialRampToValueAtTime(.0001, at + duration);
      tone.connect(envelope).connect(context.destination);
      tone.start(at);
      tone.stop(at + duration);
    }
    setTimeout(() => { void context.close().catch(() => {}); }, 1000);
  }

  function unlock() {
    if (played) return;
    void context.resume().then(play).catch(() => {});
  }
  const options = { signal: listeners.signal, capture: true };
  for (const selector of ['#brand-intro', '#language-screen']) {
    document.querySelector(selector).addEventListener('click', unlock, options);
  }
  if (context.state === 'running') play();
  else if (navigator.getAutoplayPolicy?.(context) === 'allowed') unlock();
}
