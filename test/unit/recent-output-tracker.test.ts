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
    tracker.append('a'.repeat(7000));
    tracker.append('b'.repeat(7000));
    const snapshot = tracker.snapshot();
    expect(snapshot.length).toBe(8000);
    expect(snapshot.endsWith('b'.repeat(7000))).toBe(true);
    expect(snapshot).not.toContain('a');
  });
});
