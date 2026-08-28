export type Player = { id: string; name: string; color: string };

export type ScoreEvent = {
  id: string;
  kind: 'round' | 'correction';
  round: number;
  scores: Record<string, number>;
  note: string;
  createdAt: string;
} | {
  id: string;
  kind: 'undo';
  round: number;
  targetId: string;
  note: string;
  createdAt: string;
};

export type Match = {
  version: 1;
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'finished';
  trackLength: number;
  target: number | null;
  maxRounds: number | null;
  players: Player[];
  events: ScoreEvent[];
};

export const COLORS = ['#d8f277', '#ff8a70', '#89d7f1', '#f4c95d', '#d5a6ff', '#f7f1df'];

export function uid(prefix = 'id'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function activeEvents(match: Match): Array<Extract<ScoreEvent, { scores: Record<string, number> }>> {
  const undone = new Set(match.events.filter((e): e is Extract<ScoreEvent, { kind: 'undo' }> => e.kind === 'undo').map(e => e.targetId));
  return match.events.filter((e): e is Extract<ScoreEvent, { scores: Record<string, number> }> => e.kind !== 'undo' && !undone.has(e.id));
}

export function totals(match: Match): Record<string, number> {
  const result = Object.fromEntries(match.players.map(player => [player.id, 0]));
  for (const event of activeEvents(match)) {
    for (const [id, score] of Object.entries(event.scores)) result[id] = (result[id] ?? 0) + score;
  }
  return result;
}

export function trackState(total: number, trackLength: number): { laps: number; position: number } {
  return {
    laps: Math.floor(total / trackLength),
    position: ((total % trackLength) + trackLength) % trackLength
  };
}

export function nextRound(match: Match): number {
  const rounds = activeEvents(match).filter(event => event.kind === 'round').map(event => event.round);
  return rounds.length ? Math.max(...rounds) + 1 : 1;
}

export function lastUndoable(match: Match): Extract<ScoreEvent, { scores: Record<string, number> }> | undefined {
  const active = new Set(activeEvents(match).map(event => event.id));
  return [...match.events].reverse().find((event): event is Extract<ScoreEvent, { scores: Record<string, number> }> => event.kind !== 'undo' && active.has(event.id));
}

export function rankPlayers(match: Match): Player[] {
  const scores = totals(match);
  return [...match.players].sort((a, b) => scores[b.id] - scores[a.id]);
}

export function receipt(match: Match): string {
  const scores = totals(match);
  const rounds = nextRound(match) - 1;
  const lines = rankPlayers(match).map((player, index) => {
    const state = trackState(scores[player.id], match.trackLength);
    return `${index + 1}. ${player.name} — ${scores[player.id]} (${state.laps} ${state.laps === 1 ? 'lap' : 'laps'} + ${state.position})`;
  });
  return `${match.title}\n${rounds} ${rounds === 1 ? 'round' : 'rounds'} · ${match.trackLength}-space track\n\n${lines.join('\n')}\n\nRecorded offline with Tabletop Match Ledger`;
}

export function validateMatch(value: unknown): Match {
  if (!value || typeof value !== 'object') throw new Error('That file does not contain a match.');
  const match = value as Partial<Match>;
  if (match.version !== 1 || !match.id || !Array.isArray(match.players) || match.players.length < 2 || !Array.isArray(match.events)) {
    throw new Error('This match file is incomplete or from an unsupported version.');
  }
  if (!Number.isInteger(match.trackLength) || (match.trackLength ?? 0) < 2) throw new Error('The imported score track is invalid.');
  return match as Match;
}
