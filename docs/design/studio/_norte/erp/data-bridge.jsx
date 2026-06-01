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

  // G · Bandeja del Portal (eventos entrantes del cliente → ERP)
  // Registros nuevos, cotizaciones exprés y re-compras publicados desde el
  // portal (web + móvil). El ERP los muestra como notificaciones con badge
  // para aprobar/atender. En prod = endpoint /portal-inbox del backend.
  const portalInbox = makeStore('dtd-portal-inbox', []);

  // Deriva el tenant (empresa) desde el prefijo del MARKBOX (DTD-/AND-/…).
  // Respeta multi-tenant: cada evento queda etiquetado para que el ERP solo
  // lo muestre en la empresa correcta (ver erp/data.jsx byTenant).
  function tenantForMarkbox(markbox) {
    const prefix = (markbox || '').split('-')[0];
    const tenants = (window.ERPData && window.ERPData.TENANTS) || [];
    const t = tenants.find(x => x.prefix === prefix);
    return t ? t.id : 'dtd';
  }

  // Publica un evento entrante del portal. Auto-tag: id, ts, read, tenantId.
  // evt: { kind:'registro'|'cotizacion'|'recompra', tone, markbox, title, detail, channel, meta }
  function pushPortalEvent(evt) {
    const entry = {
      id: 'pi-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6),
      ts: new Date().toISOString(),
      read: false,
      tenantId: evt.tenantId || tenantForMarkbox(evt.markbox),
      ...evt,
    };
    const cur = portalInbox.read() || [];
    portalInbox.write([entry, ...cur].slice(0, 200));
    return entry;
  }

  // Marca eventos del inbox como leídos (todos, o por lista de ids).
  function markPortalRead(ids) {
    const cur = portalInbox.read() || [];
    const set = ids && ids.length ? new Set(ids) : null;
    portalInbox.write(cur.map(e => (!set || set.has(e.id)) ? { ...e, read: true } : e));
  }

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

  // ── Lookup de clientes por documento (cédula / RIF) ─────────
  // Busca en clientes del bridge + seed CLIENTS. Normaliza (upper, sin
  // espacios) para que "j-30182554-9" matchee "J-30182554-9".
  function normDoc(d) { return (d || '').toString().trim().toUpperCase().replace(/\s+/g, ''); }
  function allKnownClients() {
    const fromBridge = clients.read() || [];
    const fromSeed = (window.ERPData && window.ERPData.CLIENTS) || [];
    return [...fromBridge, ...fromSeed];
  }
  // Devuelve el cliente existente cuyo RIF o cédula coincide, o null.
  function findClientByDoc(doc) {
    const q = normDoc(doc);
    if (!q) return null;
    return allKnownClients().find(c => normDoc(c.rif) === q || normDoc(c.cedula) === q) || null;
  }

  // ── Pre-chequeo CNE Venezuela (INTERNO · mock) ──────────────
  // ⚠ Pre-alerta interna únicamente: NO se muestra al cliente y NO
  // bloquea el registro. Verifica si la cédula + nombre declarados
  // coinciden con el registro electoral. En prod = scrape/endpoint real
  // del CNE; acá un mock determinístico para demostrar el flujo.
  // Devuelve { status:'match'|'mismatch'|'unverified', registryName }.
  const CNE_REGISTRY = {
    'V-12345678': 'Carlos Alberto Pérez',
    'V-18402551': 'María Fernanda González',
    'V-25718903': 'José Gregorio Hernández',
  };
  function nameTokens(s) {
    return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .split(/\s+/).filter(t => t.length > 2);
  }
  function cneVerify(cedula, name) {
    const id = normDoc(cedula).replace(/^V(?!-)/, 'V-');
    if (!/^V-?\d{6,9}$/.test(id)) return { status: 'unverified', reason: 'formato' };
    const official = CNE_REGISTRY[id];
    if (!official) return { status: 'unverified', reason: 'no-en-registro' };
    const a = new Set(nameTokens(official));
    const overlap = nameTokens(name).filter(t => a.has(t)).length;
    return { status: overlap >= 1 ? 'match' : 'mismatch', registryName: official };
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
    cnInbox, clients, rules, routes, cities, rates, emailsSent, portalInbox,
    // MARKBOX
    validateMarkboxFormat, isMarkboxUnique, nextMarkbox,
    // Lookup + CNE
    findClientByDoc, cneVerify,
    // Email
    sendWelcomeEmail, renderTemplate,
    // Portal inbox (eventos cliente → ERP)
    pushPortalEvent, markPortalRead, tenantForMarkbox,
    resetAll: () => {
      ['dtd-cn-inbox','dtd-clients','dtd-rules','dtd-routes','dtd-cities','dtd-rates','dtd-emails-sent','dtd-portal-inbox'].forEach(k => {
        localStorage.removeItem(k);
      });
      window.dispatchEvent(new CustomEvent('dtd-data-reset'));
    },
  };
})();
