// Original synthetic fixtures. No imports, extracts or transformations of private data.
export const ROLE_LABELS = {
  supervisor: 'Supervisor', encargado: 'Encargado', auditor: 'Auditor',
  asistente: 'Asistente', experto: 'Experto'
};

export const FIRMS = [
  { id: 'aurora', name: 'Aurora · sociedad ficticia', shortName: 'Aurora', color: 'teal', works: 12 },
  { id: 'vertice', name: 'Vértice · sociedad ficticia', shortName: 'Vértice', color: 'blue', works: 11 }
];

function makePeople(firmId, offset) {
  const groups = [
    ['supervisor', 3, 300], ['encargado', 4, 280], ['auditor', 6, 245],
    ['asistente', 4, 215], ['experto', 2, 0]
  ];
  let index = 0;
  return groups.flatMap(([role, count, base]) => Array.from({ length: count }, (_, k) => {
    index += 1;
    return {
      id: `${firmId}-${String(index).padStart(2, '0')}`,
      name: `Perfil ${String(index).padStart(2, '0')}`,
      firmId,
      // Some auditors may also be assistants: the solver must forbid double assignment.
      roles: role === 'auditor' && k < 2 ? [role, 'asistente'] : [role],
      score: role === 'experto' ? 0 : base + ((k * 37 + offset * 13) % 132),
      experience: 2 + ((k * 3 + index + offset) % 10),
      capacity: [k === 0 && role !== 'experto' ? 72 : 100 + (k % 3) * 20, 150 + (k % 3) * 20]
    };
  }));
}

export const PEOPLE = [...makePeople('aurora', 1), ...makePeople('vertice', 4)];

export const ENTITIES = [
  {
    id: 'puerto', name: 'Proyecto Puerto Claro', sector: 'Infraestructura', works: 4,
    description: 'Un equipo equilibrado para explorar la diferencia entre maximizar y alcanzar una meta.',
    visits: [
      { start: '2027-01-04', end: '2027-01-15' },
      { start: '2027-02-01', end: '2027-02-19' }
    ],
    requirements: [
      { role: 'supervisor', count: 1, hours: [40, 60], minExperience: 4 },
      { role: 'encargado', count: 1, hours: [80, 120], minExperience: 4 },
      { role: 'auditor', count: 2, hours: [80, 120], minExperience: 3 },
      { role: 'asistente', count: 1, hours: [40, 60], minExperience: 2 },
      { role: 'experto', count: 1, hours: [16, 24], minExperience: 3 }
    ]
  },
  {
    id: 'sierra', name: 'Proyecto Sierra Azul', sector: 'Servicios', works: 3,
    description: 'Coincide con Puerto Claro: reservar un equipo reduce las alternativas disponibles.',
    visits: [
      { start: '2027-01-11', end: '2027-01-22' },
      { start: '2027-02-08', end: '2027-02-26' }
    ],
    requirements: [
      { role: 'supervisor', count: 1, hours: [32, 48], minExperience: 4 },
      { role: 'encargado', count: 1, hours: [64, 96], minExperience: 3 },
      { role: 'auditor', count: 1, hours: [64, 96], minExperience: 3 },
      { role: 'asistente', count: 1, hours: [32, 48], minExperience: 2 },
      { role: 'experto', count: 1, hours: [12, 18], minExperience: 3 }
    ]
  },
  {
    id: 'valle', name: 'Proyecto Valle Norte', sector: 'Gestión pública', works: 5,
    description: 'Visitas posteriores: el personal puede volver a participar, si quedan unidades de experiencia.',
    visits: [
      { start: '2027-03-01', end: '2027-03-12' },
      { start: '2027-04-05', end: '2027-04-23' }
    ],
    requirements: [
      { role: 'supervisor', count: 1, hours: [48, 72], minExperience: 5 },
      { role: 'encargado', count: 1, hours: [80, 120], minExperience: 5 },
      { role: 'auditor', count: 2, hours: [80, 120], minExperience: 4 },
      { role: 'asistente', count: 1, hours: [48, 72], minExperience: 3 },
      { role: 'experto', count: 1, hours: [16, 24], minExperience: 4 }
    ]
  }
];
