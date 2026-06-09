/* global window */
/* ── DTD ERP · OD Bridge (localStorage shared pipeline) ─────── */
/* Conecta Admin Despacho ↔ Almacenista ↔ Transportista vía localStorage. */
/* En producción esto se reemplaza por WebSockets / SSE.            */

(function () {
  const KEY = 'dtd-active-ods';
  const POLL_MS = 1500;

  function read() {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
    catch (e) { return []; }
  }
  function write(ods) {
    localStorage.setItem(KEY, JSON.stringify(ods));
    // Notify same-tab subscribers (storage event no se dispara en mismo tab)
    window.dispatchEvent(new CustomEvent('dtd-ods-changed'));
  }

  function publish(order) {
    const ods = read();
    const next = [order, ...ods.filter(o => o.id !== order.id)];
    write(next);
    return order;
  }

  function advance(id, newStatus, extraFields) {
    const ods = read().map(o => o.id === id
      ? { ...o, status: newStatus, ...(extraFields || {}), updatedAt: new Date().toISOString() }
      : o);
    write(ods);
  }

  function cancel(id, reason) {
    const ods = read().map(o => o.id === id
      ? { ...o, status: 'cancelada', cancelReason: reason || 'Sin motivo', cancelledAt: new Date().toISOString() }
      : o);
    write(ods);
  }

  function reassign(id, patch) {
    const ods = read().map(o => o.id === id
      ? { ...o, ...patch, reassignedAt: new Date().toISOString() }
      : o);
    write(ods);
  }

  function remove(id) {
    write(read().filter(o => o.id !== id));
  }

  function reset() {
    localStorage.removeItem(KEY);
    window.dispatchEvent(new CustomEvent('dtd-ods-changed'));
  }

  // ── Subscriptions ────────────────────────────────────────────
  // Llama callback con la lista actual + en cada cambio.
  // Polling como fallback porque 'storage' no dispara en mismo tab.
  function subscribe(callback) {
    let last = JSON.stringify(read());
    callback(read());
    const onStorage = (e) => { if (e.key === KEY) callback(read()); };
    const onCustom = () => callback(read());
    const poll = setInterval(() => {
      const cur = JSON.stringify(read());
      if (cur !== last) { last = cur; callback(read()); }
    }, POLL_MS);
    window.addEventListener('storage', onStorage);
    window.addEventListener('dtd-ods-changed', onCustom);
    return () => {
      clearInterval(poll);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('dtd-ods-changed', onCustom);
    };
  }

  // Helpers de query
  const all     = () => read();
  const find    = (id) => read().find(o => o.id === id);
  const forHub  = (hub) => read().filter(o => o.hub === hub && o.status !== 'cerrada' && o.status !== 'cancelada');
  const forDriver = (driverId) => read().filter(o => o.driverId === driverId && o.status === 'lista');

  window.DTDBridge = {
    publish, advance, cancel, reassign, remove, reset,
    subscribe, all, find, forHub, forDriver,
  };
})();
