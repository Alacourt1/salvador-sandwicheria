export function saveStorage(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); }
  catch (err) { console.error('saveStorage error:', err); }
}
export function loadStorage(key, defaultValue = []) {
  try {
    const raw = localStorage.getItem(key);
    return raw !== null ? JSON.parse(raw) : defaultValue;
  } catch (err) {
    console.error('loadStorage error:', err);
    return defaultValue;
  }
}