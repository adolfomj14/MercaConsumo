// Formateo de moneda colombiana, fechas y números
export function formatCurrency(amount, currency = 'COP') {
  if (amount === null || amount === undefined || isNaN(amount)) return '$0';
  const num = Math.round(Number(amount));
  return '$' + num.toLocaleString('es-CO');
}

export function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString + 'T00:00:00');
  if (isNaN(date.getTime())) return dateString;
  return new Intl.DateTimeFormat('es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(date);
}

export function formatRelativeDays(days) {
  if (days === null || days === undefined || isNaN(days)) return 'Sin estimación';
  const d = Math.round(days);
  if (d <= 0) return 'Hoy / Agotado';
  if (d === 1) return 'Mañana';
  if (d <= 7) return `En aprox. ${d} días`;
  if (d <= 30) return `En ${Math.round(d / 7)} semanas (${d}d)`;
  return `En más de 1 mes (${d}d)`;
}

export function formatQuantity(qty, unit = '') {
  if (qty === null || qty === undefined) return `0 ${unit}`;
  const num = Number(qty);
  const formatted = num % 1 === 0 ? num.toString() : num.toFixed(2);
  return `${formatted} ${unit}`.trim();
}
