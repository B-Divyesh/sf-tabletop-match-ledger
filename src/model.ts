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
  return { laps: Math.floor(total / trackLength), position: ((total % trackLength) + trackLength) % trackLength };
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function text(value: unknown, label: string, max = 160): asserts value is string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(`The imported ${label} is invalid.`);
}

function optionalText(value: unknown, label: string, max = 160): asserts value is string {
  if (typeof value !== 'string' || value.length > max) throw new Error(`The imported ${label} is invalid.`);
}

function timestamp(value: unknown, label: string): asserts value is string {
  text(value, label, 64);
  if (Number.isNaN(Date.parse(value))) throw new Error(`The imported ${label} is invalid.`);
}

function integerInRange(value: unknown, label: string, min: number, max: number): asserts value is number {
  if (!Number.isInteger(value) || (value as number) < min || (value as number) > max) throw new Error(`The imported ${label} is invalid.`);
}

/** Validates every persisted field before an import or peer snapshot can render. */
export function validateMatch(value: unknown): Match {
  if (!isRecord(value)) throw new Error('That file does not contain a match.');
  if (value.version !== 1) throw new Error('This match file is incomplete or from an unsupported version.');
  text(value.id, 'match identifier'); text(value.title, 'match name', 48);
  timestamp(value.createdAt, 'creation time'); timestamp(value.updatedAt, 'update time');
  if (value.status !== 'active' && value.status !== 'finished') throw new Error('The imported match status is invalid.');
  integerInRange(value.trackLength, 'score track', 2, 1000);
  if (value.target !== null) integerInRange(value.target, 'target score', 1, 999999);
  if (value.maxRounds !== null) integerInRange(value.maxRounds, 'round limit', 1, 999);
  if (!Array.isArray(value.players) || value.players.length < 2 || value.players.length > 6) throw new Error('The imported players are invalid.');
  const playerIds = new Set<string>();
  for (const player of value.players) {
    if (!isRecord(player)) throw new Error('The imported players are invalid.');
    text(player.id, 'player identifier', 80); text(player.name, 'player name', 24); text(player.color, 'player color', 32);
    if (playerIds.has(player.id)) throw new Error('The imported players are invalid.');
    playerIds.add(player.id);
  }
  if (!Array.isArray(value.events)) throw new Error('The imported activity history is invalid.');
  const eventIds = new Set<string>();
  const scoreEventIds = new Set<string>();
  for (const event of value.events) {
    if (!isRecord(event)) throw new Error('The imported activity history is invalid.');
    text(event.id, 'event identifier', 80); timestamp(event.createdAt, 'event time'); optionalText(event.note, 'event note', 80);
    integerInRange(event.round, 'event round', 1, 999999);
    if (eventIds.has(event.id)) throw new Error('The imported activity history is invalid.');
    eventIds.add(event.id);
    if (event.kind === 'round' || event.kind === 'correction') {
      if (!isRecord(event.scores) || Object.keys(event.scores).length !== playerIds.size || Object.keys(event.scores).some(id => !playerIds.has(id))) throw new Error('The imported event scores are invalid.');
      for (const score of Object.values(event.scores)) integerInRange(score, 'event score', -99999, 99999);
      scoreEventIds.add(event.id);
    } else if (event.kind === 'undo') {
      text(event.targetId, 'undo target', 80);
      if (!scoreEventIds.has(event.targetId)) throw new Error('The imported undo history is invalid.');
    } else {
      throw new Error('The imported activity history is invalid.');
    }
  }
  return value as Match;
}

export function validateSetupConfiguration(trackLength: number, target: number | null, maxRounds: number | null): void {
  if (!Number.isInteger(trackLength) || trackLength < 2 || trackLength > 1000) throw new Error('Track length must be a whole number between 2 and 1,000.');
  if (target !== null && (!Number.isInteger(target) || target < 1 || target > 999999)) throw new Error('Target score must be a whole number between 1 and 999,999.');
  if (maxRounds !== null && (!Number.isInteger(maxRounds) || maxRounds < 1 || maxRounds > 999)) throw new Error('Rounds must be a whole number between 1 and 999.');
}

/** Combines append-only events from paired devices; setup fields use the latest update. */
export function mergeMatches(local: Match | null, remote: Match): Match {
  validateMatch(remote);
  if (!local) return remote;
  validateMatch(local);
  if (local.id !== remote.id) throw new Error('This pairing belongs to a different match.');
  const latest = Date.parse(remote.updatedAt) > Date.parse(local.updatedAt) ? remote : local;
  const events = [...local.events, ...remote.events].filter((event, index, all) => all.findIndex(candidate => candidate.id === event.id) === index)
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id.localeCompare(b.id));
  return validateMatch({ ...latest, events, updatedAt: new Date(Math.max(Date.parse(local.updatedAt), Date.parse(remote.updatedAt))).toISOString() });
}
