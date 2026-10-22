const fmt0 = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
const fmt2 = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Plata: sin centavos salvo en montos chicos ($ 4,58 por gramo sí importa)
export function money(value) {
  const n = Number(value || 0);
  return Math.abs(n) < 100 && n !== 0 && !Number.isInteger(n) ? fmt2.format(n) : fmt0.format(Math.round(n));
}

export function dateText(iso) {
  if (!iso) return '';
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

export function todayIso() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

// Link de WhatsApp. Los teléfonos argentinos se pasan a 549 + número
export function whatsappLink(phone, message) {
  let digits = String(phone || '').replace(/\D/g, '');
  if (digits.startsWith('0')) digits = digits.slice(1);
  if (digits && !digits.startsWith('54')) digits = `549${digits}`;
  const base = digits ? `https://wa.me/${digits}` : 'https://wa.me/';
  return `${base}?text=${encodeURIComponent(message || '')}`;
}
