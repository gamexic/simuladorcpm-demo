import { FIRMS, PEOPLE, ENTITIES, ROLE_LABELS } from './data.js';
import { simulate, createReservation, remainingWorks, isReserved } from './engine.js';

const $ = selector => document.querySelector(selector);
const integer = value => new Intl.NumberFormat('es-PE', { maximumFractionDigits: 0 }).format(value);
const decimal = value => new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const state = { reservations: [], results: [], requestId: 0, busy: false, valid: false, worker: null, timer: null };
const getEntity = () => ENTITIES.find(entity => entity.id === $('#entity').value);
const getMode = () => $('input[name="mode"]:checked').value;
const setStatus = message => { $('#status').textContent = message; };

function shortDate(date) {
  return new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
}
function dateRange(visit) { return `${shortDate(visit.start)} – ${shortDate(visit.end)}`; }

$('#entity').innerHTML = ENTITIES.map(entity => `<option value="${entity.id}">${escape(entity.name)}</option>`).join('');

function renderEntity() {
  const entity = getEntity();
  $('#entity-description').textContent = entity.description;
  $('#entity-summary').innerHTML = `<div class="summary-line"><span>Visita 1 · 2027</span><strong>${dateRange(entity.visits[0])}</strong></div><div class="summary-line"><span>Visita 2 · 2027</span><strong>${dateRange(entity.visits[1])}</strong></div><div class="summary-line"><span>Equipo requerido</span><strong>${entity.requirements.reduce((sum, req) => sum + req.count, 0)} personas</strong></div><div class="summary-line"><span>Experiencia de sociedad</span><strong>${entity.works} unidades</strong></div>`;
  $('#requirements-body').innerHTML = entity.requirements.map(req => `<tr><td>${ROLE_LABELS[req.role]}</td><td>${req.count}</td><td>${req.hours.join(' / ')}</td><td>${req.minExperience} años</td></tr>`).join('');
  renderCapacity();
}

function renderCapacity() {
  const entity = getEntity();
  $('#capacity').innerHTML = FIRMS.map(firm => {
    const people = PEOPLE.filter(person => person.firmId === firm.id);
    const available = people.filter(person => !isReserved(person.id, entity, state.reservations)).length;
    const works = remainingWorks(firm, state.reservations);
    return `<div class="capacity-card ${firm.color}"><h3>${firm.shortName}</h3><div><span class="capacity-stat"><strong>${available}/${people.length}</strong> perfiles libres</span><span class="meter" aria-hidden="true"><span style="width:${available / people.length * 100}%"></span></span></div><div><span class="capacity-stat"><strong>${works}/${firm.works}</strong> unid. de experiencia</span><span class="meter" aria-hidden="true"><span style="width:${works / firm.works * 100}%"></span></span></div></div>`;
  }).join('');
}

function selectedTeam(result) { return getMode() === 'target' && result.targetTeam ? result.targetTeam : result.maxTeam; }

function renderResults() {
  const mode = getMode();
  $('#results').innerHTML = state.results.map(result => {
    const firm = FIRMS.find(item => item.id === result.firmId);
    const heading = `<div class="card-heading"><div class="firm-brand"><span class="firm-monogram" aria-hidden="true">${firm.shortName[0]}</span><h3 class="firm-name">${firm.shortName}</h3></div><span class="card-badge">Sociedad ficticia</span></div>`;
    if (!result.maxTeam) {
      return `<article class="result-card panel ${firm.color}" aria-label="Resultado de ${firm.shortName}">${heading}<div class="empty-result"><strong>Sin equipo viable</strong><p>${escape(result.reason)}</p></div><div class="count-row"><div><strong>${integer(result.theoretical)}</strong><span>combinaciones teóricas</span></div><div><strong>0</strong><span>equipos viables</span></div></div><ul class="eligibility-list">${result.eligibleByRole.map(req => `<li>${ROLE_LABELS[req.role]}: ${req.available} elegibles / ${req.required} requeridos</li>`).join('')}</ul></article>`;
    }
    const team = selectedTeam(result);
    const score = mode === 'target' && result.targetTeam ? result.minimumAtTarget : result.maximum;
    const annotation = mode === 'target' ? result.targetTeam ? `Meta ${decimal(result.target)} alcanzada · ${integer(result.atTarget)} equipos la cumplen` : `Meta ${decimal(result.target)} no alcanzable · se muestra el máximo` : `Máximo entre ${integer(result.feasible)} equipos viables`;
    const histogramMaximum = Math.max(1, ...result.histogram.map(bin => bin.count));
    return `<article class="result-card panel ${firm.color}" aria-label="Resultado de ${firm.shortName}">${heading}
      <div class="score-block"><p class="score-label">${mode === 'target' && result.targetTeam ? 'PPP mínimo que alcanza la meta' : 'PPP máximo disponible'}</p><div class="score"><strong>${decimal(score)}</strong><span>puntos PPP</span></div><p class="score-annotation">${annotation}</p>${mode === 'target' && result.targetTeam ? `<p class="score-baseline">Máximo disponible: ${decimal(result.maximum)} PPP</p>` : ''}</div>
      <div class="count-row"><div><strong>${integer(result.theoretical)}</strong><span>combinaciones teóricas</span></div><div><strong>${integer(result.feasible)}</strong><span>equipos viables</span></div></div>
      <div class="team-title"><h4>Equipo propuesto</h4><span>Horas V1 + V2</span></div>
      <div class="table-scroll" tabindex="0" role="region" aria-label="Equipo de ${firm.shortName}"><table class="team-table"><thead><tr><th>Cargo / perfil</th><th>Horas</th><th>Puntaje</th></tr></thead><tbody>${team.map(member => `<tr><td>${ROLE_LABELS[member.role]} <span class="profile-id">/ ${escape(member.name.replace('Perfil ', 'P'))}</span></td><td>${member.hours.reduce((sum, h) => sum + h, 0)}</td><td>${member.role === 'experto' ? 'No puntúa' : member.score}</td></tr>`).join('')}</tbody></table></div>
      <button type="button" class="button secondary reserve-button" data-reserve="${firm.id}" ${!state.valid || state.busy ? 'disabled' : ''}>Reservar este equipo <span aria-hidden="true">+</span></button>
      <details><summary>Distribución de equipos por PPP</summary><div class="histogram" role="img" aria-label="${result.histogram.map(bin => `PPP ${bin.start} a menos de ${bin.start + 20}: ${bin.count} equipos`).join('; ')}">${result.histogram.map(bin => `<span style="height:${bin.count ? Math.max(3, bin.count / histogramMaximum * 100) : 0}%" title="${bin.start}–${bin.start + 20}: ${integer(bin.count)}"></span>`).join('')}</div><div class="histogram-label"><span>180</span><span>Puntaje PPP · intervalos de 20</span><span>420</span></div></details>
    </article>`;
  }).join('');
  renderComparison();
}

function renderComparison() {
  const scores = state.results.filter(result => result.maxTeam).map(result => ({ name: FIRMS.find(f => f.id === result.firmId).shortName, score: getMode() === 'target' && result.targetTeam ? result.minimumAtTarget : result.maximum }));
  const comparison = $('#comparison');
  comparison.hidden = scores.length !== 2;
  if (scores.length !== 2) return;
  const delta = Math.abs(scores[0].score - scores[1].score);
  if (getMode() === 'target') comparison.textContent = `Modo meta: los equipos buscan acercarse al objetivo por arriba. Una diferencia de ${decimal(delta)} puntos no mide la competitividad real de las sociedades.`;
  else comparison.textContent = delta < 1e-9 ? 'Los máximos disponibles empatan en este escenario sintético.' : `${scores[0].score > scores[1].score ? scores[0].name : scores[1].name} tiene ${decimal(delta)} puntos PPP más en su máximo disponible. La diferencia corresponde solo a este escenario sintético.`;
}

function renderReservations() {
  $('#reset-button').disabled = state.reservations.length === 0;
  $('#reservation-list').innerHTML = state.reservations.length ? state.reservations.map(reservation => {
    const firm = FIRMS.find(f => f.id === reservation.firmId);
    const entity = ENTITIES.find(e => e.id === reservation.entityId);
    return `<div class="reservation-row"><div><strong>${firm.shortName} → ${entity.name}</strong><p>${reservation.personIds.length} perfiles · ${reservation.works} unidades reservadas · PPP ${decimal(reservation.score)}</p></div><button type="button" class="text-button" data-remove="${reservation.id}" aria-label="Deshacer reserva de ${firm.shortName} para ${entity.name}">Deshacer</button></div>`;
  }).join('') : '<div class="reservation-empty">Tu cartera está abierta. Reserva un equipo desde los resultados para empezar.</div>';
  renderCapacity();
}

function invalidate() {
  state.valid = false;
  $('#export-button').disabled = true;
  document.querySelectorAll('[data-reserve]').forEach(button => { button.disabled = true; });
}

function showError(message) {
  $('#error-banner').hidden = false;
  $('#error-banner').textContent = message;
}

function finishRun(requestId, results, error) {
  if (requestId !== state.requestId) return;
  clearTimeout(state.timer);
  state.busy = false;
  $('#run-button').disabled = false;
  $('#run-button').innerHTML = 'Comparar escenarios <span aria-hidden="true">→</span>';
  $('#results').setAttribute('aria-busy', 'false');
  if (error) {
    invalidate();
    showError(error);
    setStatus('No se pudo completar el cálculo. Puedes volver a intentarlo.');
    return;
  }
  state.results = results;
  state.valid = true;
  $('#export-button').disabled = false;
  const totalMs = results.reduce((sum, result) => sum + result.elapsedMs, 0);
  const formattedMs = totalMs < 1 ? '< 1' : integer(totalMs);
  $('#result-title').textContent = getMode() === 'target' ? `Equipos para la meta de ${$('#target').value} PPP.` : 'Dos sociedades. Un escenario.';
  setStatus(`${getEntity().name} · cálculo ${formattedMs} ms · ${integer(results.reduce((sum, r) => sum + r.feasible, 0))} equipos viables evaluados. Datos ficticios.`);
  renderResults();
}

function mainThreadRun(requestId, scenario) {
  // Progressive enhancement for browsers that cannot construct a module worker.
  setTimeout(() => {
    try { finishRun(requestId, FIRMS.map(firm => simulate({ firm, ...scenario }))); }
    catch (error) { finishRun(requestId, [], error.message); }
  }, 0);
}

function run() {
  const rawTarget = $('#target').value;
  const target = getMode() === 'target' ? Number(rawTarget) : 300;
  const badTarget = getMode() === 'target' && (!rawTarget.trim() || !Number.isFinite(target) || target < 0 || target > 500);
  $('#target-error').hidden = !badTarget;
  $('#target-error').textContent = badTarget ? 'Ingresa un puntaje entre 0 y 500.' : '';
  $('#target').setAttribute('aria-invalid', String(badTarget));
  if (badTarget) { invalidate(); $('#target').focus(); return; }
  const requestId = ++state.requestId;
  const scenario = { entity: getEntity(), people: PEOPLE, reservations: state.reservations, target };
  invalidate();
  state.busy = true;
  $('#error-banner').hidden = true;
  $('#run-button').disabled = true;
  $('#run-button').textContent = 'Evaluando equipos…';
  $('#results').setAttribute('aria-busy', 'true');
  setStatus('Comprobando restricciones y comparando todos los equipos del conjunto sintético…');
  clearTimeout(state.timer);
  state.timer = setTimeout(() => {
    state.worker?.terminate();
    state.worker = null;
    finishRun(requestId, [], 'El cálculo excedió el tiempo previsto. Vuelve a intentarlo.');
  }, 10000);
  if (state.worker) {
    try { state.worker.postMessage({ requestId, firms: FIRMS, scenario }); }
    catch { state.worker.terminate(); state.worker = null; mainThreadRun(requestId, scenario); }
  } else mainThreadRun(requestId, scenario);
}

try {
  state.worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
  state.worker.onmessage = ({ data }) => finishRun(data.requestId, data.results, data.error);
  state.worker.onerror = event => {
    event.preventDefault();
    state.worker?.terminate(); state.worker = null;
    if (state.busy) mainThreadRun(state.requestId, { entity: getEntity(), people: PEOPLE, reservations: state.reservations, target: getMode() === 'target' ? Number($('#target').value) : 300 });
  };
} catch { state.worker = null; }

$('#scenario-form').addEventListener('submit', event => { event.preventDefault(); run(); });
$('#entity').addEventListener('change', () => { renderEntity(); run(); });
document.querySelectorAll('input[name="mode"]').forEach(radio => radio.addEventListener('change', () => {
  $('#target-field').hidden = getMode() !== 'target';
  run();
}));
$('#target').addEventListener('input', () => {
  // Drop any in-flight result for the previous target before it can become reservable.
  state.requestId += 1;
  clearTimeout(state.timer);
  state.busy = false;
  $('#run-button').disabled = false;
  $('#run-button').innerHTML = 'Comparar escenarios <span aria-hidden="true">→</span>';
  $('#results').setAttribute('aria-busy', 'false');
  invalidate();
  setStatus('La meta cambió. Pulsa Comparar escenarios para actualizar el resultado.');
});

$('#results').addEventListener('click', event => {
  const button = event.target.closest('[data-reserve]');
  if (!button || !state.valid || state.busy) return;
  const firm = FIRMS.find(item => item.id === button.dataset.reserve);
  const result = state.results.find(item => item.firmId === firm.id);
  try {
    const reservation = createReservation({ id: crypto.randomUUID(), firm, entity: getEntity(), team: selectedTeam(result), reservations: state.reservations, people: PEOPLE });
    state.reservations.push(reservation);
    renderReservations();
    run();
  } catch (error) { showError(error.message); }
});
$('#reservation-list').addEventListener('click', event => {
  const button = event.target.closest('[data-remove]');
  if (!button) return;
  state.reservations = state.reservations.filter(r => r.id !== button.dataset.remove);
  renderReservations();
  run();
});
$('#reset-button').addEventListener('click', () => {
  state.reservations = [];
  renderReservations();
  run();
});
$('#export-button').addEventListener('click', () => {
  if (!state.valid || state.busy) return;
  const report = {
    title: 'Simulador de escenarios — datos sintéticos', version: '1.0.0', generatedAt: new Date().toISOString(),
    notice: 'Datos 100% ficticios. Modelo educativo simplificado, sin validez oficial ni probabilidad de ganar.',
    formula: 'PPP = suma(puntaje × horas) / suma(horas); expertos excluidos de ambas sumas.',
    mode: getMode(), entity: getEntity(), reservations: state.reservations,
    results: state.results.map(result => ({ ...result, selectedTeam: selectedTeam(result) }))
  };
  const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = 'simulador-escenario.json'; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  setStatus('Escenario sintético descargado como JSON.');
});
$('#theme-toggle').addEventListener('click', () => {
  const dark = document.documentElement.dataset.theme !== 'dark';
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  $('#theme-toggle').textContent = dark ? 'Claro' : 'Oscuro';
  $('#theme-toggle').setAttribute('aria-pressed', String(dark));
  $('#theme-toggle').setAttribute('aria-label', dark ? 'Activar tema claro' : 'Activar tema oscuro');
});

renderEntity();
renderReservations();
run();
