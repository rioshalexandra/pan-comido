// Salones de ejemplo para mostrar la app. Se reinician solos cada 6 horas y cada vez que alguien entra con el usuario demo.

export const DEMO_USER = 'demo';
export const DEMO_PASSWORD = 'probala';

export const DEMO_VENUES = [
  {
    slug: 'los-aromos',
    name: 'Salón Los Aromos',
    fields: {
      tagline: 'Salón de fiestas con parque, parrilla y juegos para chicos',
      address: 'A 3 cuadras de la plaza',
      capacity: 'Hasta 80 personas',
      price: 'Desde $250.000',
      instagram: 'instagram',
      emoji: '🎈',
      color1: '#7a3e9d',
      color2: '#f4b942',
      logo: null,
    },
    slots: [
      { id: 's1', label: 'Mediodía', hours: '12 a 18 hs' },
      { id: 's2', label: 'Noche', hours: '20 a 4 hs' },
    ],
    // Probabilidad de que esté ocupado, por día de la semana (0 = domingo) y turno
    busy: { 0: [0.75, 0.15], 1: [0.05, 0.03], 2: [0.05, 0.03], 3: [0.06, 0.05], 4: [0.08, 0.1], 5: [0.15, 0.6], 6: [0.5, 0.85] },
  },
  {
    slug: 'la-escondida',
    name: 'Quinta La Escondida',
    fields: {
      tagline: 'Quinta con pileta y quincho para almuerzos y cumpleaños',
      address: 'Camino viejo, a 10 minutos del centro',
      capacity: 'Hasta 50 personas',
      price: 'Desde $180.000',
      instagram: 'instagram',
      emoji: '🌳',
      color1: '#2f6f5e',
      color2: '#e9a23b',
      logo: null,
    },
    slots: [{ id: 's1', label: 'Día completo', hours: '10 a 20 hs' }],
    busy: { 0: [0.7], 1: [0.04], 2: [0.04], 3: [0.05], 4: [0.06], 5: [0.2], 6: [0.75] },
  },
];

const NOTES = [
  'Cumple de 15 de Sofi · seña $80.000',
  'Bautismo familia Pérez',
  'Cumple de 40 de Martín · pagó todo',
  'Almuerzo de egresados',
  'Baby shower de Caro · seña $50.000',
  'Cumple infantil (Tomi, 5 años)',
  'Casamiento civil · falta saldo',
  'Almuerzo de empresa',
];

// Número entre 0 y 1 que siempre da lo mismo para el mismo texto
function hash01(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10000) / 10000;
}

export function demoBlocks(slug, slots, today, busy) {
  const out = [];
  const [y, m, d] = today.split('-').map(Number);
  for (let i = -20; i < 150; i++) {
    const day = new Date(Date.UTC(y, m - 1, d + i));
    const date = day.toISOString().slice(0, 10);
    const dow = day.getUTCDay();
    slots.forEach((s, j) => {
      // Los primeros días, más ocupados (como pasa en la realidad)
      const extra = i >= 0 && i < 30 ? 0.12 : 0;
      if (hash01(`${slug}|${date}|${s.id}`) < (busy[dow][j] || 0) + extra) {
        out.push({ date, slot: s.id, note: NOTES[Math.floor(hash01(`${date}${s.id}n`) * NOTES.length)] });
      }
    });
  }
  return out;
}
