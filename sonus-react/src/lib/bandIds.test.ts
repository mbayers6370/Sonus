import { describe, expect, it } from 'vitest';
import {
  firstTrackLevelIds,
  isTrackLevelLocked,
  nextTrackLevelId,
  isMandarinBandLocked,
} from './bandIds';

describe('track progression helpers', () => {
  it('resolves Mandarin next-level progression', () => {
    expect(nextTrackLevelId('band1')).toBe('band2');
    expect(nextTrackLevelId('band4')).toBe('band5');
    expect(nextTrackLevelId('band9')).toBe('advanced');
    expect(nextTrackLevelId('advanced')).toBeNull();
  });

  it('includes first level for each supported track', () => {
    expect(firstTrackLevelIds()).toEqual(
      expect.arrayContaining(['band1', 'n5', 'topik1-1', 'a1'])
    );
  });

  it('resolves Japanese next-level progression', () => {
    expect(nextTrackLevelId('n5')).toBe('n4');
    expect(nextTrackLevelId('n4')).toBe('n3');
    expect(nextTrackLevelId('n1')).toBeNull();
  });

  it('treats Japanese levels as lockable progression levels', () => {
    const unlocked = ['intro', 'n5'];
    expect(isTrackLevelLocked('n5', unlocked)).toBe(false);
    expect(isTrackLevelLocked('n4', unlocked)).toBe(true);
  });

  it('treats Mandarin levels as lockable progression levels', () => {
    const unlocked = ['intro', 'band1'];
    expect(isTrackLevelLocked('band1', unlocked)).toBe(false);
    expect(isTrackLevelLocked('band2', unlocked)).toBe(true);
  });

  it('keeps legacy lock helper compatible with non-Mandarin tracks', () => {
    const unlocked = ['intro', 'n5'];
    expect(isMandarinBandLocked('n4', unlocked)).toBe(true);
    expect(isMandarinBandLocked('n5', unlocked)).toBe(false);
  });
});
