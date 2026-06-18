export function formatPrice(value) {
  const num = Number(value);
  if (isNaN(num)) return '0';
  return num.toLocaleString('es-AR');
}