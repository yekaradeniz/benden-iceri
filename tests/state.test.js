import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, unlinkSync, writeFileSync, mkdirSync } from 'node:fs';
import { readState, writeState, daysSinceLaunch } from '../src/state.js';

const TEST_PATH = './output/test-log.json';

describe('state', () => {
  beforeEach(() => {
    mkdirSync('./output', { recursive: true });
    if (existsSync(TEST_PATH)) unlinkSync(TEST_PATH);
  });
  afterEach(() => {
    if (existsSync(TEST_PATH)) unlinkSync(TEST_PATH);
  });

  it('readState returns default when file missing', () => {
    const s = readState(TEST_PATH);
    expect(s.launchDate).toBeNull();
    expect(s.lastPost).toBeNull();
    expect(s.recentPhotos).toEqual([]);
  });

  it('writeState then readState roundtrips', () => {
    writeState(TEST_PATH, {
      launchDate: '2026-04-27',
      lastPost: { date: '2026-04-27', verseId: '001', photoId: 'p1' },
      recentPhotos: ['p1', 'p2']
    });
    const s = readState(TEST_PATH);
    expect(s.launchDate).toBe('2026-04-27');
    expect(s.lastPost.verseId).toBe('001');
    expect(s.recentPhotos).toEqual(['p1', 'p2']);
  });

  it('daysSinceLaunch counts days from launch to today', () => {
    expect(daysSinceLaunch('2026-04-27', '2026-04-27')).toBe(0);
    expect(daysSinceLaunch('2026-04-27', '2026-04-28')).toBe(1);
    expect(daysSinceLaunch('2026-04-27', '2026-05-27')).toBe(30);
  });
});
