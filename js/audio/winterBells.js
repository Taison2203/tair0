const tunes = {
  desktop: [[1.13, 523, .55], [1.28, 659, .55], [1.73, 784, .58], [2.58, 392, 1], [2.68, 523, .87], [2.76, 659, .74]],
  mobile: [[.21, 523, .52], [.43, 659, .49], [.71, 784, .58], [1.10, 1047, .72], [1.32, 784, .62]],
  card: [[0, 659, .48], [.13, 784, .50], [.25, 1047, .55]],
};
const sleigh = {
  desktop: [1.04, 1.18, 1.32, 1.58, 1.68, 1.81, 2.45, 2.58, 2.71, 2.87],
  mobile: [.18, .30, .45, .64, .81, 1.05, 1.18, 1.33],
  card: [.09, .25],
};

export function playWinterBells(context, mix, elapsed = 0, destination = context.destination) {
  const strike = (offset, hz, duration, volume) => {
    if (offset < elapsed) return;
    const time = context.currentTime + .012 + offset - elapsed;
    const tone = context.createOscillator();
    const envelope = context.createGain();
    tone.frequency.value = hz;
    envelope.gain.setValueAtTime(.0001, time);
    envelope.gain.exponentialRampToValueAtTime(volume, time + .009);
    envelope.gain.exponentialRampToValueAtTime(.0001, time + duration);
    tone.connect(envelope).connect(destination);
    tone.onended = () => { tone.disconnect(); envelope.disconnect(); };
    tone.start(time);
    tone.stop(time + duration);
  };
  for (const [time, hz, duration] of tunes[mix]) {
    strike(time, hz, duration, .085);
    strike(time, hz * 2.013, duration * .68, .037);
    strike(time, hz * 2.76, duration * .35, .019);
  }
  for (const [i, time] of sleigh[mix].entries()) {
    const fundamental = [1730, 1980, 1550][i % 3];
    strike(time, fundamental, .13, .035);
    strike(time + .021, fundamental * 1.43, .09, .023);
    strike(time + .043, fundamental * 1.82, .085, .013);
  }
}
