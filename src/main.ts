import './style.css';
import { COLORS, lastUndoable, mergeMatches, nextRound, rankPlayers, receipt, totals, trackState, uid, validateMatch, validateSetupConfiguration, type Match } from './model';
import { loadMatch, saveMatch } from './storage';
import { cachedLicenseState, captureLicense, checkoutUrl, storeLicense, verifyLicense, type LicenseState } from './license';
import { LanPairing } from './lan';

const app = document.querySelector<HTMLDivElement>('#app')!;
const channel = 'BroadcastChannel' in window ? new BroadcastChannel('tabletop-match-ledger') : null;
let match: Match | null = null;
let loading = true;
let storageError = '';
let draftPlayers = ['', ''];
let license: LicenseState = { unlocked: false, checking: false };
let deferredInstall: Event | null = null;
let toastTimer = 0;
const lan = new LanPairing(
  incoming => {
    try { void receivePairedMatch(incoming); }
    catch (reason) { announce(reason instanceof Error ? reason.message : 'Could not accept the paired update.', true); }
  },
  connected => { render(); if (connected) lan.send(match); announce(connected ? 'Table devices paired. Changes now sync over your local network.' : 'Table device pairing disconnected.', !connected); }
);

const escapeHtml = (value: unknown) => String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]!);
const dateTime = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

function icon(name: 'orbit' | 'plus' | 'undo' | 'share' | 'history' | 'wifi' | 'download' | 'spark'): string {
  const paths = {
    orbit: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M4 12h16"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    undo: '<path d="M9 7 4 12l5 5"/><path d="M5 12h8a6 6 0 0 1 6 6"/>',
    share: '<circle cx="18" cy="5" r="2"/><circle cx="6" cy="12" r="2"/><circle cx="18" cy="19" r="2"/><path d="m8 11 8-5M8 13l8 5"/>',
    history: '<path d="M4 12a8 8 0 1 0 2.3-5.7L4 8"/><path d="M4 4v4h4M12 8v5l3 2"/>',
    wifi: '<path d="M5 12.6a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 20h.01"/>',
    download: '<path d="M12 3v12m0 0 5-5m-5 5-5-5M5 21h14"/>',
    spark: '<path d="m12 2 1.4 5.6L19 9l-5.6 1.4L12 16l-1.4-5.6L5 9l5.6-1.4L12 2Z"/><path d="m5 16 .7 2.3L8 19l-2.3.7L5 22l-.7-2.3L2 19l2.3-.7L5 16Z"/>'
  };
  return `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[name]}</svg>`;
}

function shell(content: string): string {
  return `
    <header class="site-header">
      <a class="brand" href="/" aria-label="Tabletop Match Ledger home">${icon('orbit')}<span>Match <i>Ledger</i></span></a>
      <div class="header-actions">
        <span class="connection" id="connection">${icon('wifi')}<span>${navigator.onLine ? 'Ready offline' : 'Offline'}</span></span>
        <button class="text-button" id="sync-button" type="button">${lan.isConnected() ? 'Paired' : 'Share table'}</button>
        <button class="text-button" id="support-button" type="button">${license.unlocked ? 'Table Keeper' : 'Support'}</button>
      </div>
    </header>
    ${storageError ? `<div class="storage-alert" role="alert"><strong>Local save unavailable.</strong> ${escapeHtml(storageError)} Keep this tab open and export your match.</div>` : ''}
    ${content}
    <footer><span>Scores stay at your table.</span><nav aria-label="Legal"><a href="/privacy/">Privacy</a><a href="/terms/">Terms</a></nav></footer>
    <div class="toast" id="toast" role="status" aria-live="polite"></div>
    ${supportDialog()}
    ${syncDialog()}`;
}

function syncDialog(): string {
  return `<dialog id="sync-dialog" class="dialog wide-dialog">
    <form method="dialog"><button class="icon-button dialog-close" aria-label="Close device pairing">×</button></form>
    <div class="eyebrow">${icon('wifi')} Local table sync</div>
    <h2>Pair another device</h2>
    <p>Pair directly over the same local network. No account, server, or match data leaves the table. Keep this dialog open while you pass the two short pairing codes.</p>
    <section class="pair-step" aria-labelledby="host-pair-title"><h3 id="host-pair-title">1. Table owner</h3><button class="button secondary" id="create-offer" type="button">Create pairing code</button><label for="offer-code">Your pairing code</label><textarea id="offer-code" readonly rows="3" spellcheck="false" aria-describedby="pair-help"></textarea><label for="answer-code">Reply from joining device</label><textarea id="answer-code" rows="3" spellcheck="false"></textarea><button class="button primary" id="accept-answer" type="button">Connect device</button></section>
    <section class="pair-step" aria-labelledby="join-pair-title"><h3 id="join-pair-title">2. Joining device</h3><label for="offer-input">Owner’s pairing code</label><textarea id="offer-input" rows="3" spellcheck="false"></textarea><button class="button secondary" id="create-answer" type="button">Create reply code</button><label for="answer-output">Your reply code</label><textarea id="answer-output" readonly rows="3" spellcheck="false"></textarea></section>
    <p class="form-help" id="pair-help">${lan.isConnected() ? 'Paired now. Every new round, correction, or undo is shared and merged into the append-only history.' : 'For best results, use the same Wi-Fi network and copy each code exactly.'}</p>
    <p class="field-error" id="pair-error" role="alert"></p>
  </dialog>`;
}

function supportDialog(): string {
  const options = license.unlocked ? `
    <fieldset class="theme-picker"><legend>Table theme</legend>
      <label><input type="radio" name="theme" value="felt" ${theme() === 'felt' ? 'checked' : ''}/> Green felt</label>
      <label><input type="radio" name="theme" value="blue" ${theme() === 'blue' ? 'checked' : ''}/> Tournament blue</label>
      <label><input type="radio" name="theme" value="candle" ${theme() === 'candle' ? 'checked' : ''}/> Candle room</label>
    </fieldset>` : `
    <div class="price-row"><strong>$5</strong><span>one-time purchase</span></div>
    <p>Unlock two extra table themes and help keep this small utility maintained. Core scoring, history, offline use, and every export stay free.</p>
    <a class="button primary full" href="${checkoutUrl}">Buy Table Keeper</a>
    <div class="or"><span>or restore a purchase</span></div>
    <form id="license-form" class="license-form">
      <label for="license-token">License token</label>
      <div class="input-action"><input id="license-token" autocomplete="off" required/><button class="button secondary" type="submit">Verify</button></div>
      <p class="field-error" id="license-error" aria-live="polite"></p>
    </form>`;
  return `<dialog id="support-dialog" class="dialog">
    <form method="dialog"><button class="icon-button dialog-close" aria-label="Close support window">×</button></form>
    <div class="eyebrow">${icon('spark')} Optional supporter unlock</div>
    <h2>${license.unlocked ? 'Table Keeper unlocked' : 'Keep scorekeeping independent'}</h2>
    ${license.notice ? `<p class="notice">${escapeHtml(license.notice)}</p>` : ''}
    ${options}
    <p class="fine-print">Checkout is handled by Sociobot/Dodo, the merchant of record. Refunds revoke the license. <a href="/terms/">Terms</a> apply.</p>
  </dialog>`;
}

function loadingView(): string {
  return shell(`<main id="main" class="loading-state"><div class="orbit-loader" aria-hidden="true"></div><h1>Opening your score sheet…</h1><p>Reading the match saved on this device.</p></main>`);
}

function setupView(): string {
  const players = draftPlayers.map((name, i) => `<div class="player-field">
    <span class="player-dot" style="--player:${COLORS[i]}" aria-hidden="true"></span>
    <label for="player-${i}">Player ${i + 1}</label>
    <input id="player-${i}" name="player" value="${escapeHtml(name)}" maxlength="24" autocomplete="off" placeholder="Name" required/>
    ${draftPlayers.length > 2 ? `<button class="remove-player" type="button" data-remove-player="${i}" aria-label="Remove player ${i + 1}">×</button>` : ''}
  </div>`).join('');
  return shell(`<main id="main" class="setup-page">
    <section class="hero-copy">
      <div class="eyebrow"><span class="pip"></span> Offline table utility</div>
      <h1>Scores that survive the next lap.</h1>
      <p class="lede">Track rounds, board position, and every correction—without accounts, ads, or mental arithmetic.</p>
      <div class="hero-art">
        <picture><source srcset="/assets/score-orbit.avif" type="image/avif"/><img src="/assets/score-orbit.webp" width="768" height="512" alt="Abstract circular score tracks with colorful geometric player markers" fetchpriority="high" decoding="async"/></picture>
        <div class="art-caption"><span>Position</span><strong>37</strong><span>+</span><strong>2 laps</strong></div>
      </div>
    </section>
    <section class="setup-panel" aria-labelledby="setup-title">
      <div class="step-mark">01 / SETUP</div>
      <h2 id="setup-title">Put the players on the track</h2>
      <p>Start with the names. Everything else has a sensible default.</p>
      <form id="setup-form" novalidate>
        <label for="match-title">Match name</label>
        <input id="match-title" name="title" value="Tonight's match" maxlength="48" required/>
        <fieldset class="players"><legend>Players</legend><div id="player-fields">${players}</div>
          <button class="button add-player" type="button" id="add-player" ${draftPlayers.length >= 6 ? 'disabled' : ''}>${icon('plus')} Add player</button>
        </fieldset>
        <div class="config-grid">
          <div><label for="track-length">Track wraps after</label><div class="input-suffix"><input id="track-length" name="trackLength" type="number" inputmode="numeric" min="2" max="1000" value="100" required/><span>spaces</span></div></div>
          <div><label for="target">Target score <small>optional</small></label><input id="target" name="target" type="number" inputmode="numeric" min="1" max="999999" placeholder="No target"/></div>
          <div><label for="max-rounds">Rounds <small>optional</small></label><input id="max-rounds" name="maxRounds" type="number" inputmode="numeric" min="1" max="999" placeholder="Play until done"/></div>
        </div>
        <p class="field-error" id="setup-error" role="alert"></p>
        <button class="button primary start-button" type="submit">Start the ledger <span>→</span></button>
      </form>
      <div class="import-block"><span>Already have a ledger?</span><button class="text-button" id="import-button" type="button">Import JSON</button><input class="visually-hidden" id="import-file" type="file" accept="application/json,.json" aria-label="Choose a ledger JSON file"/></div>
    </section>
    <section class="promise-strip" aria-label="Product promises"><div><strong>0</strong><span>accounts</span></div><div><strong>∞</strong><span>undo history</span></div><div><strong>1</strong><span>shared truth</span></div></section>
  </main>`);
}

function playerBoard(match: Match): string {
  const scores = totals(match);
  const ranked = rankPlayers(match);
  const leader = ranked[0]?.id;
  return ranked.map((player, index) => {
    const score = scores[player.id];
    const state = trackState(score, match.trackLength);
    const progress = Math.max(0, Math.min(100, state.position / match.trackLength * 100));
    const targetProgress = match.target ? Math.max(0, Math.min(100, score / match.target * 100)) : null;
    return `<article class="score-card ${player.id === leader && score !== 0 ? 'leader' : ''}" style="--player:${player.color};--track-progress:${progress * 3.6}deg">
      <div class="rank">${index + 1}</div>
      <div class="score-orbit" aria-hidden="true"><span>${state.position}</span></div>
      <div class="player-score"><div class="name-row"><h3>${escapeHtml(player.name)}</h3>${player.id === leader && score !== 0 ? '<span class="leader-tag">Leading</span>' : ''}</div>
        <div class="total"><strong>${score}</strong><span>total points</span></div>
        <div class="lap-line"><span><b>${state.laps}</b> ${state.laps === 1 ? 'lap' : 'laps'} completed</span><span>${state.position} / ${match.trackLength}</span></div>
        ${targetProgress !== null ? `<div class="target-bar" title="${Math.round(targetProgress)}% of target"><span style="width:${targetProgress}%"></span></div>` : ''}
      </div>
    </article>`;
  }).join('');
}

function activeView(match: Match): string {
  const round = nextRound(match);
  const isRoundLimit = match.maxRounds !== null && round > match.maxRounds;
  const fields = match.players.map(player => `<div class="round-player">
    <label for="score-${player.id}"><span class="player-dot" style="--player:${player.color}"></span>${escapeHtml(player.name)}</label>
    <div class="score-input"><button type="button" data-step="-1" data-for="score-${player.id}" aria-label="Subtract one point from ${escapeHtml(player.name)}">−</button><input id="score-${player.id}" name="${player.id}" type="number" inputmode="numeric" min="-99999" max="99999" value="0" aria-describedby="score-help"/><button type="button" data-step="1" data-for="score-${player.id}" aria-label="Add one point to ${escapeHtml(player.name)}">+</button></div>
  </div>`).join('');
  const events = [...match.events].reverse().map(event => {
    if (event.kind === 'undo') return `<li class="history-item undone"><span>${icon('undo')}</span><div><strong>Undo recorded</strong><small>${escapeHtml(event.note)} · ${dateTime(event.createdAt)}</small></div></li>`;
    const summary = match.players.map(player => `${player.name} ${event.scores[player.id] >= 0 ? '+' : ''}${event.scores[player.id] ?? 0}`).join(' · ');
    const wasUndone = match.events.some(candidate => candidate.kind === 'undo' && candidate.targetId === event.id);
    return `<li class="history-item ${wasUndone ? 'undone' : ''}"><span class="event-round">${event.kind === 'round' ? `R${event.round}` : '±'}</span><div><strong>${escapeHtml(summary)}</strong><small>${event.note ? `${escapeHtml(event.note)} · ` : ''}${dateTime(event.createdAt)}${wasUndone ? ' · Undone' : ''}</small></div></li>`;
  }).join('');
  return shell(`<main id="main" class="match-page">
    <div class="match-titlebar"><div><div class="eyebrow"><span class="live-dot"></span>${match.status === 'finished' ? 'Final score' : `Round ${Math.min(round, match.maxRounds ?? round)}`}</div><h1>${escapeHtml(match.title)}</h1><p>${match.trackLength}-space track${match.target ? ` · first to ${match.target}` : ''}${match.maxRounds ? ` · ${match.maxRounds} rounds` : ''}</p></div>
      <div class="title-actions"><button class="button secondary" id="history-button" type="button">${icon('history')} History <span class="count">${match.events.length}</span></button><button class="icon-button" id="menu-button" type="button" aria-label="Open match options">•••</button></div>
    </div>
    <div class="match-layout">
      <section class="standings" aria-labelledby="standings-title"><div class="section-label"><h2 id="standings-title">Standings</h2><span>Position = total mod ${match.trackLength}</span></div>${playerBoard(match)}</section>
      <aside class="entry-sheet" aria-labelledby="entry-title">
        ${match.status === 'finished' || isRoundLimit ? `<div class="finish-card"><div class="finish-orbit">${icon('orbit')}</div><div class="eyebrow">Ledger complete</div><h2 id="entry-title">The final table is ready.</h2><p>${isRoundLimit && match.status !== 'finished' ? 'The configured round limit has been reached.' : 'Save a receipt before the board is cleared.'}</p><button class="button primary full" id="receipt-button" type="button">${icon('share')} View final receipt</button>${match.status !== 'finished' ? '<button class="button secondary full" id="continue-button" type="button">Add another round</button>' : ''}<button class="text-button" id="undo-button" type="button" ${lastUndoable(match) ? '' : 'disabled'}>${icon('undo')} Undo last entry</button></div>` : `
        <div class="entry-heading"><div><div class="step-mark">ROUND ${round.toString().padStart(2, '0')}</div><h2 id="entry-title">Add this round</h2></div><span class="autosave">Saved locally</span></div>
        <form id="round-form" novalidate>${fields}<label for="round-note">Round note <small>optional</small></label><input id="round-note" name="note" maxlength="80" placeholder="Bonus, tie-break, reminder…"/><p id="score-help" class="form-help">Enter points gained this round. Negative scores are welcome.</p><p class="field-error" id="round-error" role="alert"></p><button class="button primary full" type="submit">Commit round ${round} <span>→</span></button></form>
        <div class="entry-actions"><button class="text-button" id="correction-button" type="button">Add correction</button><button class="text-button" id="undo-button" type="button" ${lastUndoable(match) ? '' : 'disabled'}>${icon('undo')} Undo last entry</button></div>
        <button class="button finish-button" id="finish-button" type="button">Finish match & share</button>`}
      </aside>
    </div>
    <dialog id="history-dialog" class="dialog wide-dialog"><form method="dialog"><button class="icon-button dialog-close" aria-label="Close history">×</button></form><div class="eyebrow">Immutable activity log</div><h2>Every score has a trail</h2><p>Corrections and undos are appended here; prior entries are never silently changed.</p><ol class="history-list">${events || '<li class="empty-history">No rounds recorded yet.</li>'}</ol></dialog>
    <dialog id="correction-dialog" class="dialog"><form method="dialog"><button class="icon-button dialog-close" aria-label="Close correction">×</button></form><div class="eyebrow">Append-only adjustment</div><h2>Add a correction</h2><form id="correction-form">${fields.replaceAll('score-', 'correction-').replaceAll('score-help', 'correction-help')}<label for="correction-note">Reason</label><input id="correction-note" name="note" maxlength="80" required placeholder="What changed?"/><p id="correction-help" class="form-help">The correction appears as a new history entry.</p><p class="field-error" id="correction-error" role="alert"></p><button class="button primary full" type="submit">Record correction</button></form></dialog>
    <dialog id="receipt-dialog" class="dialog receipt-dialog"><form method="dialog"><button class="icon-button dialog-close" aria-label="Close receipt">×</button></form><div class="receipt-mark">FINAL LEDGER / ${new Date(match.createdAt).getFullYear()}</div><h2>${escapeHtml(match.title)}</h2><pre id="receipt-text">${escapeHtml(receipt(match))}</pre><div class="receipt-actions"><button class="button primary" id="share-receipt" type="button">${icon('share')} Share receipt</button><button class="button secondary" id="copy-receipt" type="button">Copy text</button></div></dialog>
    <dialog id="options-dialog" class="dialog"><form method="dialog"><button class="icon-button dialog-close" aria-label="Close match options">×</button></form><div class="eyebrow">Match data</div><h2>Keep your ledger portable</h2><div class="option-list"><button class="button secondary full" id="export-json" type="button">${icon('download')} Export JSON</button><button class="button secondary full" id="export-csv" type="button">${icon('download')} Export CSV</button><button class="button secondary full" id="import-button" type="button">Import another match</button><input class="visually-hidden" id="import-file" type="file" accept="application/json,.json" aria-label="Choose a ledger JSON file"/><button class="button danger full" id="new-match" type="button">Clear & start a new match</button></div></dialog>
  </main>`);
}

function theme(): string { return license.unlocked ? localStorage.getItem('ledger-theme') ?? 'felt' : 'felt'; }

function render(): void {
  document.documentElement.dataset.theme = theme();
  app.innerHTML = loading ? loadingView() : match ? activeView(match) : setupView();
  bindCommon();
  if (!loading) match ? bindMatch() : bindSetup();
}

function bindCommon(): void {
  document.querySelector('#support-button')?.addEventListener('click', () => openDialog('support-dialog'));
  document.querySelector('#sync-button')?.addEventListener('click', () => openDialog('sync-dialog'));
  const pairError = (): HTMLElement => document.querySelector<HTMLElement>('#pair-error')!;
  document.querySelector('#create-offer')?.addEventListener('click', async () => {
    try {
      pairError().textContent = '';
      document.querySelector<HTMLTextAreaElement>('#offer-code')!.value = await lan.createOffer();
      announce('Pairing code ready. Send it to the joining device.');
    } catch (reason) { pairError().textContent = reason instanceof Error ? reason.message : 'Could not create a pairing code.'; }
  });
  document.querySelector('#create-answer')?.addEventListener('click', async () => {
    try {
      pairError().textContent = '';
      const offer = document.querySelector<HTMLTextAreaElement>('#offer-input')!.value;
      document.querySelector<HTMLTextAreaElement>('#answer-output')!.value = await lan.createAnswer(offer);
      announce('Reply code ready. Return it to the table owner.');
    } catch (reason) { pairError().textContent = reason instanceof Error ? reason.message : 'Could not create a reply code.'; }
  });
  document.querySelector('#accept-answer')?.addEventListener('click', async () => {
    try {
      pairError().textContent = '';
      await lan.acceptAnswer(document.querySelector<HTMLTextAreaElement>('#answer-code')!.value);
      announce('Connecting to the paired device…');
    } catch (reason) { pairError().textContent = reason instanceof Error ? reason.message : 'Could not connect the paired device.'; }
  });
  document.querySelector('#license-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    const input = document.querySelector<HTMLInputElement>('#license-token')!;
    const error = document.querySelector<HTMLElement>('#license-error')!;
    try { storeLicense(input.value); license = { unlocked: true, checking: true }; render(); license = await verifyLicense(true); render(); openDialog('support-dialog'); }
    catch (reason) { error.textContent = reason instanceof Error ? reason.message : 'Could not save that license.'; }
  });
  document.querySelectorAll<HTMLInputElement>('input[name="theme"]').forEach(input => input.addEventListener('change', () => {
    localStorage.setItem('ledger-theme', input.value); document.documentElement.dataset.theme = input.value; announce(`${input.parentElement?.textContent?.trim()} theme applied.`);
  }));
}

function bindSetup(): void {
  document.querySelectorAll<HTMLInputElement>('input[name="player"]').forEach((input, index) => input.addEventListener('input', () => { draftPlayers[index] = input.value; }));
  document.querySelector('#add-player')?.addEventListener('click', () => { if (draftPlayers.length < 6) draftPlayers.push(''); render(); requestAnimationFrame(() => document.querySelector<HTMLInputElement>(`#player-${draftPlayers.length - 1}`)?.focus()); });
  document.querySelectorAll<HTMLElement>('[data-remove-player]').forEach(button => button.addEventListener('click', () => { draftPlayers.splice(Number(button.dataset.removePlayer), 1); render(); }));
  document.querySelector<HTMLFormElement>('#setup-form')?.addEventListener('submit', event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget as HTMLFormElement);
    const names = draftPlayers.map(name => name.trim());
    const error = document.querySelector<HTMLElement>('#setup-error')!;
    if (names.some(name => !name)) { error.textContent = 'Give every player a name.'; document.querySelector<HTMLInputElement>('input[name="player"]:invalid')?.focus(); return; }
    const lowered = names.map(name => name.toLocaleLowerCase());
    if (new Set(lowered).size !== lowered.length) { error.textContent = 'Use a different name for each player.'; return; }
    const trackLength = Number(form.get('trackLength'));
    const target = form.get('target') ? Number(form.get('target')) : null;
    const maxRounds = form.get('maxRounds') ? Number(form.get('maxRounds')) : null;
    try { validateSetupConfiguration(trackLength, target, maxRounds); }
    catch (reason) { error.textContent = reason instanceof Error ? reason.message : 'Check the match configuration.'; return; }
    const now = new Date().toISOString();
    void updateMatch({ version: 1, id: uid('match'), title: String(form.get('title')).trim() || "Tonight's match", createdAt: now, updatedAt: now, status: 'active', trackLength, target, maxRounds, players: names.map((name, i) => ({ id: uid('player'), name, color: COLORS[i] })), events: [] }, 'Match started. Pass the device when each round ends.');
  });
  bindImport();
}

function bindMatch(): void {
  if (!match) return;
  document.querySelector('#history-button')?.addEventListener('click', () => openDialog('history-dialog'));
  document.querySelector('#menu-button')?.addEventListener('click', () => openDialog('options-dialog'));
  document.querySelector('#correction-button')?.addEventListener('click', () => openDialog('correction-dialog'));
  document.querySelectorAll<HTMLButtonElement>('[data-step]').forEach(button => button.addEventListener('click', () => {
    const input = document.querySelector<HTMLInputElement>(`#${CSS.escape(button.dataset.for!)}`)!;
    input.value = String(Number(input.value || 0) + Number(button.dataset.step)); input.dispatchEvent(new Event('input')); input.focus();
  }));
  document.querySelector<HTMLFormElement>('#round-form')?.addEventListener('submit', event => submitScores(event, 'round'));
  document.querySelector<HTMLFormElement>('#correction-form')?.addEventListener('submit', event => submitScores(event, 'correction'));
  document.querySelector('#undo-button')?.addEventListener('click', () => {
    if (!match) return; const target = lastUndoable(match); if (!target) return;
    const event = { id: uid('event'), kind: 'undo' as const, round: nextRound(match), targetId: target.id, note: `${target.kind === 'round' ? `Round ${target.round}` : 'Correction'} removed`, createdAt: new Date().toISOString() };
    void updateMatch({ ...match, status: 'active', updatedAt: event.createdAt, events: [...match.events, event] }, 'Last entry undone. The history remains intact.');
  });
  const finish = () => { if (!match) return; const finished = { ...match, status: 'finished' as const, updatedAt: new Date().toISOString() }; void updateMatch(finished, 'Final ledger ready.').then(() => openDialog('receipt-dialog')); };
  document.querySelector('#finish-button')?.addEventListener('click', finish);
  document.querySelector('#receipt-button')?.addEventListener('click', () => openDialog('receipt-dialog'));
  document.querySelector('#continue-button')?.addEventListener('click', () => { if (!match) return; void updateMatch({ ...match, maxRounds: null, updatedAt: new Date().toISOString() }, 'Round limit removed.'); });
  document.querySelector('#share-receipt')?.addEventListener('click', () => void shareReceipt());
  document.querySelector('#copy-receipt')?.addEventListener('click', () => void copyReceipt());
  document.querySelector('#export-json')?.addEventListener('click', () => match && download(`${slug(match.title)}.ledger.json`, JSON.stringify(match, null, 2), 'application/json'));
  document.querySelector('#export-csv')?.addEventListener('click', exportCsv);
  document.querySelector('#new-match')?.addEventListener('click', () => {
    if (!match || confirm(`Clear “${match.title}” from this device? Export first if you need a copy.`)) void updateMatch(null, 'Ready for a new match.');
  });
  bindImport();
}

function submitScores(event: SubmitEvent, kind: 'round' | 'correction'): void {
  event.preventDefault(); if (!match) return;
  const form = new FormData(event.currentTarget as HTMLFormElement);
  const scores = Object.fromEntries(match.players.map(player => [player.id, Number(form.get(player.id) ?? 0)]));
  const error = document.querySelector<HTMLElement>(kind === 'round' ? '#round-error' : '#correction-error')!;
  if (Object.values(scores).some(score => !Number.isInteger(score) || Math.abs(score) > 99999)) { error.textContent = 'Each score must be a whole number between −99,999 and 99,999.'; return; }
  if (Object.values(scores).every(score => score === 0)) { error.textContent = 'Enter at least one non-zero score.'; return; }
  const note = String(form.get('note') ?? '').trim();
  if (kind === 'correction' && !note) { error.textContent = 'Add a short reason so everyone can follow the correction.'; return; }
  const now = new Date().toISOString();
  const scoreEvent = { id: uid('event'), kind, round: nextRound(match), scores, note, createdAt: now } as const;
  const updated = { ...match, updatedAt: now, events: [...match.events, scoreEvent] };
  const reached = updated.target !== null && Object.values(totals(updated)).some(score => score >= updated.target!);
  if (reached) updated.status = 'finished';
  void updateMatch(updated, kind === 'round' ? `Round ${scoreEvent.round} committed.` : 'Correction recorded.').then(() => {
    if (reached) openDialog('receipt-dialog');
  });
}

function bindImport(): void {
  document.querySelector('#import-button')?.addEventListener('click', () => document.querySelector<HTMLInputElement>('#import-file')?.click());
  document.querySelector<HTMLInputElement>('#import-file')?.addEventListener('change', async event => {
    const input = event.currentTarget as HTMLInputElement;
    const file = (input.files ?? [])[0]; if (!file) return;
    try { const imported = validateMatch(JSON.parse(await file.text())); await updateMatch({ ...imported, updatedAt: new Date().toISOString() }, `Imported “${imported.title}”.`); }
    catch (reason) { announce(reason instanceof Error ? reason.message : 'Could not import that file.', true); }
  });
}

async function updateMatch(next: Match | null, message: string): Promise<void> {
  match = next; render(); announce(message);
  try { await saveMatch(next); storageError = ''; channel?.postMessage(next); lan.send(next); }
  catch (reason) { storageError = reason instanceof Error ? reason.message : 'Storage failed.'; render(); announce('Could not save locally. Export a copy before closing.', true); }
}

async function receivePairedMatch(incoming: Match): Promise<void> {
  const merged = mergeMatches(match, incoming);
  match = merged;
  render();
  try { await saveMatch(merged); storageError = ''; }
  catch (reason) { storageError = reason instanceof Error ? reason.message : 'Storage failed.'; render(); announce('Could not save the paired update locally. Export a copy before closing.', true); return; }
  announce('Paired device updated the ledger.');
}

function openDialog(id: string): void { document.querySelector<HTMLDialogElement>(`#${id}`)?.showModal(); }
function announce(message: string, isError = false): void {
  const toast = document.querySelector<HTMLElement>('#toast'); if (!toast) return;
  toast.textContent = message; toast.classList.toggle('error', isError); toast.classList.add('shown');
  clearTimeout(toastTimer); toastTimer = window.setTimeout(() => toast.classList.remove('shown'), 3800);
}
function slug(value: string): string { return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'match'; }
function download(filename: string, contents: string, type: string): void { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([contents], { type })); a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); announce(`${filename} exported.`); }
function exportCsv(): void {
  if (!match) return; const headings = ['entry', 'type', 'time', 'note', ...match.players.map(player => player.name)];
  const rows = match.events.map((event, index) => [index + 1, event.kind, event.createdAt, event.note, ...match!.players.map(player => event.kind === 'undo' ? '' : event.scores[player.id] ?? 0)]);
  const csv = [headings, ...rows].map(row => row.map(cell => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n'); download(`${slug(match.title)}.csv`, csv, 'text/csv');
}
async function shareReceipt(): Promise<void> { if (!match) return; const text = receipt(match); if (navigator.share) { try { await navigator.share({ title: match.title, text }); return; } catch { /* user cancelled */ } } await navigator.clipboard.writeText(text); announce('Receipt copied to the clipboard.'); }
async function copyReceipt(): Promise<void> { if (!match) return; try { await navigator.clipboard.writeText(receipt(match)); announce('Receipt copied to the clipboard.'); } catch { announce('Select the receipt text and copy it manually.', true); } }

function updateConnection(): void { const el = document.querySelector<HTMLElement>('#connection'); if (el) el.innerHTML = `${icon('wifi')}<span>${navigator.onLine ? 'Ready offline' : 'Offline'}</span>`; }
window.addEventListener('online', updateConnection); window.addEventListener('offline', updateConnection);
window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); deferredInstall = event; });
channel?.addEventListener('message', event => {
  const incoming = event.data as Match | null;
  if (incoming === null) { match = null; render(); announce('Match cleared in another tab.'); return; }
  try { void receivePairedMatch(validateMatch(incoming)); }
  catch { announce('Ignored an invalid update from another tab.', true); }
});

async function start(): Promise<void> {
  captureLicense(); license = cachedLicenseState(); render();
  try { const saved = await loadMatch(); match = saved === null ? null : validateMatch(saved); }
  catch (reason) { storageError = reason instanceof Error ? reason.message : 'Local storage is unavailable.'; }
  loading = false; render();
  void verifyLicense().then(result => { license = result; render(); });
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      registration.addEventListener('updatefound', () => { const worker = registration.installing; worker?.addEventListener('statechange', () => { if (worker.state === 'installed' && navigator.serviceWorker.controller) announce('An update is ready. Reload to use it.'); }); });
    } catch { announce('Offline setup will retry on the next visit.', true); }
  }
}

void start();
