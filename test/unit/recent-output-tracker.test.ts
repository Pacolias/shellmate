import { describe, expect, it } from 'vitest';
import { RecentOutputTracker } from '../../src/main/shell-events/recent-output-tracker';

describe('RecentOutputTracker', () => {
  it('accumulates appended chunks', () => {
    const tracker = new RecentOutputTracker();
    tracker.append('hello ');
    tracker.append('world');
    expect(tracker.snapshot()).toBe('hello world');
  });

  it('clears the buffer on reset', () => {
    const tracker = new RecentOutputTracker();
    tracker.append('leftover from a previous command');
    tracker.reset();
    expect(tracker.snapshot()).toBe('');
  });

  it('caps the buffer, keeping only the most recent output', () => {
    const tracker = new RecentOutputTracker();
    tracker.append('a'.repeat(5000));
    tracker.append('b'.repeat(8000));
    const snapshot = tracker.snapshot();
    // The second append alone reaches the cap, so none of the earlier
    // 'a's should survive — an unambiguous check on the eviction math.
    expect(snapshot).toBe('b'.repeat(8000));
  });

  it('keeps the tail of older output when a single append does not fill the cap', () => {
    const tracker = new RecentOutputTracker();
    tracker.append('a'.repeat(5000));
    tracker.append('b'.repeat(5000));
    const snapshot = tracker.snapshot();
    expect(snapshot.length).toBe(8000);
    expect(snapshot).toBe('a'.repeat(3000) + 'b'.repeat(5000));
  });
});
