/** Exact enumeration of small synthetic pools. No official procurement rules implied. */
export function choose(n, k) {
  if (!Number.isInteger(n) || !Number.isInteger(k) || k < 0 || n < k) return 0;
  let value = 1;
  for (let i = 1; i <= Math.min(k, n - k); i++) value = value * (n - i + 1) / i;
  return Math.round(value);
}

export function overlaps(a, b) {
  return a.start <= b.end && b.start <= a.end;
}

export function isReserved(personId, entity, reservations) {
  return reservations.some(reservation => reservation.personIds.includes(personId)
    && reservation.visits.some(a => entity.visits.some(b => overlaps(a, b))));
}

export function remainingWorks(firm, reservations) {
  return firm.works - reservations.filter(r => r.firmId === firm.id).reduce((sum, r) => sum + r.works, 0);
}

export function scoreTeam(team) {
  const scoring = team.filter(member => member.role !== 'experto');
  const hours = scoring.reduce((sum, member) => sum + member.hours.reduce((a, b) => a + b, 0), 0);
  const weighted = scoring.reduce((sum, member) => sum + member.score * member.hours.reduce((a, b) => a + b, 0), 0);
  return hours ? weighted / hours : 0;
}

function* combinations(items, count, start = 0, prefix = []) {
  if (count === 0) { yield prefix; return; }
  for (let i = start; i <= items.length - count; i++) {
    yield* combinations(items, count - 1, i + 1, [...prefix, items[i]]);
  }
}

function teamKey(team) { return team.map(member => `${member.role}:${member.id}`).join('|'); }

export function simulate({ firm, entity, people, reservations = [], target = 300 }) {
  const started = performance.now();
  if (!Number.isFinite(target) || target < 0 || target > 500) throw new Error('La meta debe estar entre 0 y 500.');
  const firmPeople = people.filter(person => person.firmId === firm.id);
  const theoretical = entity.requirements.reduce((n, req) => n * choose(firmPeople.filter(p => p.roles.includes(req.role)).length, req.count), 1);
  const worksLeft = remainingWorks(firm, reservations);
  const alreadyReserved = reservations.some(r => r.firmId === firm.id && r.entityId === entity.id);
  const pools = entity.requirements.map(req => ({ ...req, candidates: firmPeople.filter(p =>
    p.roles.includes(req.role) && p.experience >= req.minExperience
    && req.hours.every((hours, visit) => p.capacity[visit] >= hours)
    && !isReserved(p.id, entity, reservations)
  ) }));
  let feasible = 0;
  let atTarget = 0;
  let maxTeam = null;
  let targetTeam = null;
  let maximum = -Infinity;
  let minimumAtTarget = Infinity;
  const histogram = Array.from({ length: 12 }, (_, index) => ({ start: 180 + index * 20, count: 0 }));

  function visit(poolIndex, selected, usedIds) {
    if (poolIndex === pools.length) {
      const score = scoreTeam(selected);
      feasible += 1;
      const bucket = Math.max(0, Math.min(histogram.length - 1, Math.floor((score - 180) / 20)));
      histogram[bucket].count += 1;
      if (score > maximum + 1e-9 || (Math.abs(score - maximum) < 1e-9 && teamKey(selected) < teamKey(maxTeam))) {
        maximum = score;
        maxTeam = selected;
      }
      if (score + 1e-9 >= target) {
        atTarget += 1;
        if (score < minimumAtTarget - 1e-9 || (Math.abs(score - minimumAtTarget) < 1e-9 && teamKey(selected) < teamKey(targetTeam))) {
          minimumAtTarget = score;
          targetTeam = selected;
        }
      }
      return;
    }
    const req = pools[poolIndex];
    for (const members of combinations(req.candidates.filter(person => !usedIds.has(person.id)), req.count)) {
      const nextTeam = members.map(person => ({ id: person.id, name: person.name, role: req.role, hours: req.hours, score: person.score, experience: person.experience }));
      visit(poolIndex + 1, [...selected, ...nextTeam], new Set([...usedIds, ...members.map(person => person.id)]));
    }
  }

  if (!alreadyReserved && worksLeft >= entity.works) visit(0, [], new Set());
  const reason = alreadyReserved ? 'Esta sociedad ya tiene un equipo reservado para esta entidad.'
    : worksLeft < entity.works ? `Se necesitan ${entity.works} unidades de experiencia; quedan ${worksLeft}.`
    : !feasible ? 'No hay suficientes perfiles disponibles que cumplan cargos, horas y experiencia.' : null;
  return {
    firmId: firm.id, entityId: entity.id, target, theoretical, feasible, atTarget,
    maximum: maxTeam ? maximum : null, minimumAtTarget: targetTeam ? minimumAtTarget : null,
    maxTeam, targetTeam, histogram, worksLeft, reason,
    eligibleByRole: pools.map(p => ({ role: p.role, available: p.candidates.length, required: p.count })),
    elapsedMs: performance.now() - started
  };
}

export function createReservation({ id, firm, entity, team, reservations, people }) {
  if (!team?.length) throw new Error('Primero calcula un equipo válido.');
  // Validate from the current state, never trust a stale rendered result.
  if (reservations.some(r => r.firmId === firm.id && r.entityId === entity.id)) throw new Error('Esta entidad ya está reservada para la sociedad.');
  if (remainingWorks(firm, reservations) < entity.works) throw new Error('No quedan suficientes unidades de experiencia.');
  const selectedIds = team.map(p => p.id);
  if (new Set(selectedIds).size !== selectedIds.length) throw new Error('Una persona no puede ocupar dos cargos.');
  if (selectedIds.some(personId => isReserved(personId, entity, reservations))) throw new Error('El equipo contiene perfiles que ya están reservados.');
  for (const req of entity.requirements) {
    const members = team.filter(member => member.role === req.role);
    if (members.length !== req.count) throw new Error('La cantidad por cargo no es válida.');
    for (const member of members) {
      const person = people.find(p => p.id === member.id && p.firmId === firm.id);
      if (!person || !person.roles.includes(req.role) || person.experience < req.minExperience
        || req.hours.some((hours, visit) => person.capacity[visit] < hours)
        || req.hours.some((hours, visit) => member.hours[visit] !== hours)
        || member.score !== person.score) throw new Error('El perfil no cumple los requisitos del escenario.');
    }
  }
  if (team.length !== entity.requirements.reduce((sum, req) => sum + req.count, 0)) throw new Error('El equipo incluye cargos adicionales.');
  return { id, firmId: firm.id, entityId: entity.id, personIds: selectedIds, visits: entity.visits, works: entity.works, score: scoreTeam(team) };
}
