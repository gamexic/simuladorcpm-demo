import test from 'node:test';
import assert from 'node:assert/strict';
import { choose, overlaps, isReserved, scoreTeam, simulate, createReservation, remainingWorks } from '../engine.js';
import { FIRMS, PEOPLE, ENTITIES } from '../data.js';

const firm = { id: 'test', works: 8 };
const person = (id, roles, score, capacity = [100, 150], experience = 9) => ({ id, name: id, firmId: 'test', roles, score, capacity, experience });
const entity = {
  id: 'test-entity', works: 2,
  visits: [{ start: '2027-01-01', end: '2027-01-05' }, { start: '2027-02-01', end: '2027-02-05' }],
  requirements: [{ role: 'encargado', count: 1, hours: [40, 60], minExperience: 4 }, { role: 'auditor', count: 2, hours: [40, 60], minExperience: 3 }, { role: 'experto', count: 1, hours: [8, 12], minExperience: 3 }]
};
const people = [person('e1', ['encargado'], 350), person('e2', ['encargado'], 280), person('a1', ['auditor'], 320), person('a2', ['auditor'], 290), person('a3', ['auditor'], 260), person('x1', ['experto'], 999)];
const run = (overrides = {}) => simulate({ firm, entity, people, target: 300, ...overrides });

test('combinaciones sin duplicar permutaciones de un cargo', () => {
  assert.equal(choose(6, 2), 15);
  assert.equal(choose(3, 0), 1);
  assert.equal(choose(2, 3), 0);
  assert.equal(run().theoretical, 6);
  assert.equal(run().feasible, 6);
});

test('PPP excluye expertos tanto del numerador como del denominador', () => {
  assert.equal(scoreTeam([{ role: 'encargado', score: 300, hours: [40, 60] }, { role: 'experto', score: 999, hours: [100, 200] }]), 300);
  assert.equal(scoreTeam([]), 0);
  assert.equal(scoreTeam([{ role: 'encargado', score: 400, hours: [20, 30] }, { role: 'auditor', score: 200, hours: [40, 60] }]), 800 / 3);
});

test('máximo y meta coinciden con un oráculo independiente de seis equipos', () => {
  const scores = people.slice(0, 2).flatMap(head => [[2, 3], [2, 4], [3, 4]].map(pair => (head.score + people[pair[0]].score + people[pair[1]].score) / 3));
  const result = run();
  assert.equal(result.maximum, Math.max(...scores));
  assert.equal(result.minimumAtTarget, Math.min(...scores.filter(score => score >= 300)));
  assert.equal(result.atTarget, scores.filter(score => score >= 300).length);
  assert.equal(result.histogram.reduce((sum, bin) => sum + bin.count, 0), result.feasible);
});

test('meta inalcanzable conserva el máximo y no fabrica un equipo de meta', () => {
  const result = run({ target: 450 });
  assert.equal(result.targetTeam, null);
  assert.equal(result.minimumAtTarget, null);
  assert.equal(result.atTarget, 0);
  assert.ok(result.maxTeam);
});

test('horas y experiencia filtran personas antes de asignarlas', () => {
  const result = run({ people: [...people, person('bad-hours', ['encargado'], 500, [39, 150]), person('bad-experience', ['auditor'], 500, [100, 150], 2)] });
  assert.equal(result.feasible, 6);
  assert.ok(result.theoretical > result.feasible);
  assert.equal(result.maximum, run().maximum);
});

test('una identidad nunca puede ocupar dos cargos', () => {
  const crossPeople = [person('same', ['encargado', 'auditor'], 400), person('a1', ['auditor'], 300), person('x1', ['experto'], 0)];
  const result = run({ people: crossPeople });
  assert.equal(result.theoretical, 1);
  assert.equal(result.feasible, 0);
});

test('insuficiencia de experiencia de sociedad impide equipos', () => {
  const result = run({ firm: { ...firm, works: 1 } });
  assert.equal(result.feasible, 0);
  assert.match(result.reason, /unidades/);
});

test('reservas impiden cruce de visitas inclusive en fechas límite', () => {
  assert.equal(overlaps({ start: '2027-01-01', end: '2027-01-05' }, { start: '2027-01-05', end: '2027-01-06' }), true);
  const reservations = [{ personIds: ['a1'], firmId: firm.id, entityId: 'other', visits: [entity.visits[0]], works: 2 }];
  assert.equal(isReserved('a1', entity, reservations), true);
  assert.equal(run({ reservations }).feasible, 2);
  assert.equal(remainingWorks(firm, reservations), 6);
});

test('personal se reutiliza en fechas posteriores; presupuesto sigue reservado', () => {
  const reservations = [{ personIds: ['a1'], firmId: firm.id, entityId: 'other', visits: [{ start: '2026-01-01', end: '2026-01-05' }], works: 2 }];
  assert.equal(isReserved('a1', entity, reservations), false);
  assert.equal(run({ reservations }).feasible, 6);
  assert.equal(run({ reservations }).worksLeft, 6);
});

test('no duplicar una entidad de la misma sociedad', () => {
  const result = run();
  const reservation = createReservation({ id: 'r1', firm, entity, people, team: result.maxTeam, reservations: [] });
  assert.equal(run({ reservations: [reservation] }).feasible, 0);
  assert.throws(() => createReservation({ id: 'r2', firm, entity, people, team: result.maxTeam, reservations: [reservation] }), /ya está reservada/);
});

test('validación de reservas rechaza estado obsoleto y personas ajenas', () => {
  const result = run();
  const reservations = [{ personIds: [result.maxTeam[0].id], firmId: firm.id, entityId: 'other', visits: [entity.visits[0]], works: 2 }];
  assert.throws(() => createReservation({ id: 'r1', firm, entity, people, team: result.maxTeam, reservations }), /ya están reservados/);
  const tampered = structuredClone(result.maxTeam);
  tampered[0].id = 'outsider';
  assert.throws(() => createReservation({ id: 'r1', firm, entity, people, team: tampered, reservations: [] }), /no cumple/);
});

test('validación de reservas rechaza duplicación, horas y puntajes alterados', () => {
  const result = run();
  const duplicate = [...result.maxTeam, result.maxTeam[0]];
  assert.throws(() => createReservation({ id: 'r1', firm, entity, people, team: duplicate, reservations: [] }), /dos cargos/);
  for (const property of ['hours', 'score']) {
    const tampered = structuredClone(result.maxTeam);
    tampered[0][property] = property === 'hours' ? [1000, 1000] : 999;
    assert.throws(() => createReservation({ id: 'r1', firm, entity, people, team: tampered, reservations: [] }), /no cumple/);
  }
});

test('validación de meta numérica', () => {
  for (const target of [NaN, Infinity, -1, 501]) assert.throws(() => run({ target }), /entre 0 y 500/);
});

test('todos los escenarios originales son deterministas, viables y pequeños', () => {
  for (const firm of FIRMS) for (const entity of ENTITIES) {
    const result = simulate({ firm, entity, people: PEOPLE });
    assert.ok(result.feasible > 0, `${firm.id}/${entity.id} viable`);
    assert.ok(result.theoretical < 10000, 'conjunto público acotado');
    assert.ok(result.maximum > 300 && result.maximum < 500);
    assert.ok(result.minimumAtTarget >= 300);
    assert.deepEqual(result.maxTeam, simulate({ firm, entity, people: PEOPLE }).maxTeam);
    assert.equal(new Set(result.maxTeam.map(p => p.id)).size, result.maxTeam.length);
    createReservation({ id: 'r1', firm, entity, people: PEOPLE, team: result.maxTeam, reservations: [] });
  }
});

test('reserva y liberación restablecen el escenario original', () => {
  const original = simulate({ firm: FIRMS[0], entity: ENTITIES[0], people: PEOPLE });
  const reservation = createReservation({ id: 'r1', firm: FIRMS[0], entity: ENTITIES[0], people: PEOPLE, team: original.maxTeam, reservations: [] });
  const next = simulate({ firm: FIRMS[0], entity: ENTITIES[1], people: PEOPLE, reservations: [reservation] });
  const unreserved = simulate({ firm: FIRMS[0], entity: ENTITIES[1], people: PEOPLE });
  assert.ok(next.feasible < unreserved.feasible);
  assert.equal(next.worksLeft, FIRMS[0].works - ENTITIES[0].works);
  assert.equal(simulate({ firm: FIRMS[0], entity: ENTITIES[0], people: PEOPLE, reservations: [] }).maximum, original.maximum);
});
