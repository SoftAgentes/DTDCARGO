/* global window */
/* ── DTD ERP · Data Bridge (localStorage shared state) ──────── */
/* Persistencia compartida entre módulos para clientes, rutas,    */
/* reglas, tasas y recepciones CN. En prod = backend REST.        */

(function () {
  const POLL_MS = 1500;

  function makeStore(key, defaultValue) {
    function read() {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : defaultValue;
      } catch (e) { return defaultValue; }
    }
    function write(value) {
      localStorage.setItem(key, JSON.stringify(value));
      window.dispatchEvent(new CustomEvent('dtd-' + key + '-changed'));
    }
    function subscribe(callback) {
      let last = JSON.stringify(read());
      callback(read());
      const onStorage = (e) => { if (e.key === key) callback(read()); };
      const onCustom = () => callback(read());
      const poll = setInterval(() => {
        const cur = JSON.stringify(read());
        if (cur !== last) { last = cur; callback(read()); }
      }, POLL_MS);
      window.addEventListener('storage', onStorage);
      window.addEventListener('dtd-' + key + '-changed', onCustom);
      return () => {
        clearInterval(poll);
        window.removeEventListener('storage', onStorage);
        window.removeEventListener('dtd-' + key + '-changed', onCustom);
      };
    }
    function reset() {
      localStorage.removeItem(key);
      window.dispatchEvent(new CustomEvent('dtd-' + key + '-changed'));
    }
    return { read, write, subscribe, reset };
  }

  // A · Pipeline CN → Despacho
  const cnInbox = makeStore('dtd-cn-inbox', []);

  // B · Clientes registrados (MARKBOX shared)
  const clients = makeStore('dtd-clients', []);

  // C · Reglas de prioridad persistentes
  const rules = makeStore('dtd-rules', null);

  // D · Rutas + catálogo de ciudades persistentes
  const routes = makeStore('dtd-routes', null);
  const cities = makeStore('dtd-cities', null);

  // E · Tasas de cambio
  const rates  = makeStore('dtd-rates', null);

  // F · Emails enviados (mock log para Mailing → Logs)
  const emailsSent = makeStore('dtd-emails-sent', []);

  // ── MARKBOX helpers (validación + secuencial server-side) ──
  // Formato oficial: DTD-XXXX o DTD-XXXXX (4 o 5 dígitos)
  // Ver CLAUDE.md y portal/registro.jsx para nomenclatura completa.
  const MARKBOX_REGEX = /^DTD-\d{4,5}$/;
  function validateMarkboxFormat(code) {
    return MARKBOX_REGEX.test(code || '');
  }
  function allKnownMarkboxes() {
    const fromBridge = (clients.read() || []).map(c => c.markbox).filter(Boolean);
    const fromSeed = ((window.ERPData && window.ERPData.CLIENTS) || []).map(c => c.markbox).filter(Boolean);
    return new Set([...fromBridge, ...fromSeed]);
  }
  function isMarkboxUnique(code) {
    if (!validateMarkboxFormat(code)) return false;
    return !allKnownMarkboxes().has(code);
  }
  function nextMarkbox() {
    const known = allKnownMarkboxes();
    let max = 5499; // baseline conservador
    known.forEach(m => {
      const n = parseInt((m || '').replace('DTD-', ''), 10);
      if (!isNaN(n) && n > max) max = n;
    });
    // Probar siguientes con retry defensivo contra race conditions
    for (let i = 1; i <= 10; i++) {
      const candidate = `DTD-${max + i}`;
      if (validateMarkboxFormat(candidate) && !known.has(candidate)) return candidate;
    }
    // Fallback (extremadamente improbable)
    return `DTD-${max + 1}`;
  }

  // ── Email helpers (mock pero traceable) ─────────────────────
  // Renderiza template m-05 'Bienvenida MARKBOX' con substituciones
  // y pushea entrada al log de emails enviados.
  function renderTemplate(body, vars) {
    return body.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] != null ? vars[k] : `{{${k}}}`);
  }
  function sendWelcomeEmail(client) {
    const D = window.ERPData;
    const template = D && D.MAIL_TEMPLATES.find(t => t.id === 'm-05');
    if (!template) {
      console.warn('[DTDData] template m-05 no encontrado, abortando welcome email');
      return null;
    }
    const vars = {
      client_name: client.name || client.company || 'cliente',
      markbox: client.markbox,
      portal_link: 'https://portal.dtdcargo.com/' + client.markbox.toLowerCase(),
    };
    const subject = renderTemplate(template.subject, vars);
    const body = renderTemplate(template.body.es, vars);
    const log = emailsSent.read() || [];
    const entry = {
      id: 'e-' + Date.now().toString(36),
      to: client.email,
      toName: client.name,
      template: template.id,
      templateName: template.name,
      subject, body,
      sentAt: new Date().toISOString(),
      status: 'sent',
      markbox: client.markbox,
      channel: 'email',
    };
    emailsSent.write([entry, ...log].slice(0, 500));
    // Audit log (si está cargado)
    try {
      const auditKey = 'dtd_audit_log_v1';
      const raw = localStorage.getItem(auditKey);
      const audit = raw ? JSON.parse(raw) : [];
      audit.unshift({
        id: 'a-' + Date.now().toString(36),
        ts: entry.sentAt,
        action: 'auto',
        module: 'Mailing',
        actor: { id: 'system', name: 'Sistema · auto', role: 'auto' },
        target: { kind: 'email', id: entry.id, label: `Bienvenida MARKBOX → ${client.markbox}` },
        detail: `Email m-05 enviado a ${client.email}`,
      });
      localStorage.setItem(auditKey, JSON.stringify(audit.slice(0, 500)));
    } catch (e) {}
    return entry;
  }

  window.DTDData = {
    cnInbox, clients, rules, routes, cities, rates, emailsSent,
    // MARKBOX
    validateMarkboxFormat, isMarkboxUnique, nextMarkbox,
    // Email
    sendWelcomeEmail, renderTemplate,
    resetAll: () => {
      ['dtd-cn-inbox','dtd-clients','dtd-rules','dtd-routes','dtd-cities','dtd-rates','dtd-emails-sent'].forEach(k => {
        localStorage.removeItem(k);
      });
      window.dispatchEvent(new CustomEvent('dtd-data-reset'));
    },
  };
})();
