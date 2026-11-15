export function testSeat() {
  if (typeof window === 'undefined' || window.top === window) return null;
  return window.frameElement?.dataset.testSeat || null;
}

export function reportTestSeat(update) {
  const seat = testSeat();
  if (seat) window.parent.postMessage({ type: 'actguess:test-seat', seat, ...update }, window.location.origin);
}
