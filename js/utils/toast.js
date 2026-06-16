export function showToast(msg, tipo = 'ok') {
  if (typeof window.mostrarToast === 'function') {
    window.mostrarToast(msg, tipo);
    return;
  }
  // Fallback
  let el = document.getElementById('_toast_fallback');
  if (!el) {
    el = document.createElement('div');
    el.id = '_toast_fallback';
    el.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(80px);background:#262626;color:#fafaf5;border:1px solid #383838;padding:9px 20px;border-radius:99px;font-family:Inter,sans-serif;font-size:.82rem;font-weight:600;z-index:9999;transition:transform .3s;pointer-events:none;white-space:nowrap;';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.borderColor = tipo === 'error' ? 'rgba(192,57,43,.5)' : '#383838';
  el.style.transform = 'translateX(-50%) translateY(0)';
  clearTimeout(el._timer);
  el._timer = setTimeout(() => { el.style.transform = 'translateX(-50%) translateY(80px)'; }, 2400);
}