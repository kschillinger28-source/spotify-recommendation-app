let ctx = null;

export function playMoodTone(freq) {
  try {
    if (typeof window === "undefined") return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!ctx) ctx = new AC();
    if (ctx.state === "suspended") ctx.resume();
    const t = ctx.currentTime;

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, t);
    master.gain.exponentialRampToValueAtTime(0.11, t + 0.3);
    master.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 1100;
    filter.Q.value = 0.7;

    [freq, freq * 1.5, freq * 0.5].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = i === 0 ? "triangle" : "sine";
      o.frequency.value = f;
      o.detune.value = i * 7 - 7;
      o.connect(filter);
      o.start(t);
      o.stop(t + 2.5);
    });

    filter.connect(master);
    master.connect(ctx.destination);
  } catch (e) {
    /* audio is a garnish, never a blocker */
  }
}
