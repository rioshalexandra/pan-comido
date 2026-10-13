import { attachmentFileUrl } from '../api';

// Dibujitos para elegir en cada producto
export const ICONS = ['🍪', '🥐', '🍞', '🥖', '🧁', '🎂', '🍰', '🥧', '🍩', '🥮', '🍫', '🍋', '🍓', '🍎', '🥕', '🥥', '🍯', '🎁', '☕', '🥪'];

// Un dibujito según el nombre (igual que el que pone el servidor al arrancar)
const GUESSES = [
  [/cookie|galleti|pepa|masas/, '🍪'],
  [/alfajor/, '🥮'],
  [/lim[oó]n/, '🍋'],
  [/medialuna|croissant|factura/, '🥐'],
  [/muffin|cupcake/, '🧁'],
  [/brownie|chocolate/, '🍫'],
  [/zanahoria|carrot/, '🥕'],
  [/tarta|pie|lemon/, '🥧'],
  [/bud[ií]n|bizcocho|porci[oó]n/, '🍰'],
  [/torta|cake/, '🎂'],
  [/dona|rosquilla/, '🍩'],
  [/caja|combo|box|regalo/, '🎁'],
  [/baguette/, '🥖'],
  [/(^|\s)pan/, '🍞'],
  [/caf[eé]/, '☕'],
];

export function guessIcon(name) {
  const text = String(name || '').toLowerCase();
  return GUESSES.find(([re]) => re.test(text))?.[1] || '🧁';
}

// Dibujito que se muestra: el elegido, o uno según el nombre si nunca se eligió. '' = sin dibujo.
export function productIcon(row) {
  if (!row || row.kind === 'ingredient') return '';
  if (row.icon == null) return guessIcon(row.name);
  return row.icon;
}

// Foto si tiene, si no el dibujito, si no la inicial
export function ProductIcon({ row, size = 'md' }) {
  const box = size === 'sm' ? 'h-8 w-8 text-lg' : 'h-12 w-12 text-2xl';
  if (row.photo_id) {
    return <img src={attachmentFileUrl(row.photo_id)} alt="" className={`${box} shrink-0 rounded-lg object-cover`} />;
  }
  const icon = productIcon(row);
  if (icon) {
    return (
      <span className={`${box} grid shrink-0 place-items-center rounded-lg bg-[#f7efe0]`} aria-hidden="true">
        {icon}
      </span>
    );
  }
  return <span className="avatar small">{String(row.name || '?').slice(0, 1).toUpperCase()}</span>;
}
