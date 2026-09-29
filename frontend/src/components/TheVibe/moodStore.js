let state = { moodId: null, source: null, seq: 0 };
const subs = new Set();

export function publishLock(moodId, source) {
  state = { moodId, source, seq: state.seq + 1 };
  subs.forEach((fn) => fn(state));
}

export function subscribeLocks(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}
