export function formatPrice(value) {
  const num = Number(value);
  return isNaN(num) ? '0' : num.toLocaleString('es-AR');
}