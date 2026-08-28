import { describe, expect, it } from 'vitest';
import { activeEvents, lastUndoable, mergeMatches, nextRound, receipt, totals, trackState, validateMatch, validateSetupConfiguration, type Match } from '../src/model';

const base: Match = {
  version: 1, id: 'match-1', title: 'Tuesday table', createdAt: '2026-08-28T00:00:00.000Z', updatedAt: '2026-08-28T00:00:00.000Z',
  status: 'active', trackLength: 100, target: 250, maxRounds: null,
  players: [{ id: 'a', name: 'Ada', color: '#fff' }, { id: 'b', name: 'Bea', color: '#000' }], events: []
};

describe('score model', () => {
  it('derives laps and wrapped position for positive and negative totals', () => {
    expect(trackState(237, 100)).toEqual({ laps: 2, position: 37 });
    expect(trackState(-3, 100)).toEqual({ laps: -1, position: 97 });
  });

  it('keeps corrected and undone events in history but removes their effect', () => {
    const match: Match = { ...base, events: [
      { id: 'r1', kind: 'round', round: 1, scores: { a: 120, b: 80 }, note: '', createdAt: base.createdAt },
      { id: 'fix', kind: 'correction', round: 2, scores: { a: -20, b: 0 }, note: 'miscount', createdAt: base.createdAt },
      { id: 'undo', kind: 'undo', round: 2, targetId: 'fix', note: 'Correction removed', createdAt: base.createdAt }
    ] };
    expect(match.events).toHaveLength(3);
    expect(activeEvents(match).map(event => event.id)).toEqual(['r1']);
    expect(totals(match)).toEqual({ a: 120, b: 80 });
    expect(lastUndoable(match)?.id).toBe('r1');
    expect(nextRound(match)).toBe(2);
  });

  it('creates a portable final receipt', () => {
    const match: Match = { ...base, status: 'finished', events: [{ id: 'r1', kind: 'round', round: 1, scores: { a: 237, b: 199 }, note: '', createdAt: base.createdAt }] };
    expect(receipt(match)).toContain('Ada — 237 (2 laps + 37)');
    expect(receipt(match)).toContain('Recorded offline');
  });

  it('rejects malformed imports', () => {
    expect(() => validateMatch({ version: 2 })).toThrow(/unsupported/);
    expect(() => validateMatch({ ...base, events: [{ id: 'bad', kind: 'round', round: 1, scores: { a: 3 }, note: '', createdAt: base.createdAt }] })).toThrow(/event scores/);
    expect(() => validateMatch({ ...base, players: [{ ...base.players[0] }, { ...base.players[1], id: 'a' }] })).toThrow(/players/);
    expect(validateMatch(base)).toEqual(base);
  });

  it('rejects invalid optional match limits before a match is created', () => {
    expect(() => validateSetupConfiguration(100, -5, null)).toThrow(/Target score/);
    expect(() => validateSetupConfiguration(100, null, 1.5)).toThrow(/Rounds/);
    expect(() => validateSetupConfiguration(100, 250, 8)).not.toThrow();
  });

  it('merges append-only paired-device events without dropping either score', () => {
    const left: Match = { ...base, updatedAt: '2026-08-28T01:00:00.000Z', events: [{ id: 'left', kind: 'round', round: 1, scores: { a: 8, b: 0 }, note: '', createdAt: '2026-08-28T01:00:00.000Z' }] };
    const right: Match = { ...base, updatedAt: '2026-08-28T01:01:00.000Z', events: [{ id: 'right', kind: 'round', round: 1, scores: { a: 0, b: 5 }, note: '', createdAt: '2026-08-28T01:01:00.000Z' }] };
    expect(totals(mergeMatches(left, right))).toEqual({ a: 8, b: 5 });
  });
});
