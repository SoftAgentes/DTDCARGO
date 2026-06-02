/* global window, fetch */
/* ════════════════════════════════════════════════════════════════════
   DTD-Cargo · API SEAM  ·  window.DTDApi + window.DTDAuth
   ────────────────────────────────────────────────────────────────────
   El seam único entre el front y el backend (CRÍTICO · paso #2 del BRIEF).
   Regla de migración: window.ERPData sigue siendo LA INTERFAZ. Lo que
   cambia es de dónde se llena:
     · mode 'mock' → resuelve desde window.ERPData / DTDData / localStorage
     · mode 'rest' → fetch contra el backend (ver backend/API-CONTRACT.md)
   El backend resuelve tenantId del JWT; acá solo mandamos el token.
   Flip de una línea:  window.DTDApi.config({ mode:'rest', baseUrl:'…' })
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var cfg = {
    mode: 'mock',                 // 'mock' | 'rest'
    baseUrl: '',                  // ej. 'https://api.dtdcargo.com'
    onUnauthorized: null,         // callback 401 → relogin
  };

  // ── Sesión / token (front-side; el server valida de verdad) ──────────
  var TOKEN_KEY = 'dtd_access_token';
  var USER_KEY  = 'dtd_session_user';

  function getToken()  { try { return localStorage.getItem(TOKEN_KEY) || null; } catch (e) { return null; } }
  function setToken(t) { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch (e) {} }

  function getUser() {
    try { var raw = localStorage.getItem(USER_KEY); return raw ? JSON.parse(raw) : (window.__currentUser || null); }
    catch (e) { return window.__currentUser || null; }
  }
  function setUser(u) {
    try { u ? localStorage.setItem(USER_KEY, JSON.stringify(u)) : localStorage.removeItem(USER_KEY); } catch (e) {}
    window.__currentUser = u;
    window.dispatchEvent(new CustomEvent('dtd-user-updated', { detail: u }));
  }

  // Decodifica el tenantId del JWT (sin validar firma — solo lectura local).
  function tenantIdFromToken() {
    var t = getToken();
    if (!t || t.indexOf('.') === -1) return (getUser() || {}).tenantId || null;
    try {
      var payload = JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      return payload.tenantId != null ? payload.tenantId : ((getUser() || {}).tenantId || null);
    } catch (e) { return (getUser() || {}).tenantId || null; }
  }

  // ── Transporte REST ──────────────────────────────────────────────────
  function request(method, path, body) {
    var headers = { 'Content-Type': 'application/json' };
    var tok = getToken();
    if (tok) headers.Authorization = 'Bearer ' + tok;     // tenantId va implícito en el token
    return fetch(cfg.baseUrl + path, {
      method: method,
      headers: headers,
      body: body != null ? JSON.stringify(body) : undefined,
    }).then(function (res) {
      if (res.status === 401) { if (cfg.onUnauthorized) cfg.onUnauthorized(); throw new Error('401 no autorizado'); }
      if (!res.ok) return res.text().then(function (t) { throw new Error(method + ' ' + path + ' → ' + res.status + ' ' + t); });
      return res.status === 204 ? null : res.json();
    });
  }

  // ── Resolución MOCK (espejo del contrato, sin servidor) ──────────────
  // Aplica el filtrado por tenant igual que lo haría el backend, usando
  // ERPData.byTenant si está disponible.
  function mockResolve(method, path) {
    var D = window.ERPData || {};
    var byT = (D.byTenant || function (x) { return x; });
    var p = path.split('?')[0];
    var map = {
      '/me':         function () { return getUser(); },
      '/clients':    function () { return byT(D.CLIENTS || []); },
      '/suppliers':  function () { return byT(D.SUPPLIERS || []); },
      '/shipments':  function () { return byT(D.SHIPMENTS || []); },
      '/invoices':   function () { return byT(D.INVOICES || []); },
      '/quotes':     function () { return byT(D.QUOTES || []); },
      '/accounts':   function () { return D.ACCOUNTS || (window.ContabilidadData && window.ContabilidadData.ACCOUNTS) || []; },
      '/rates':      function () { return (window.ERPRates || (window.DTDData && window.DTDData.rates.read()) || []); },
      '/tms/incidents':    function () { return window.__tmsIncidents || []; },
      '/emails/scheduled': function () { return window.__scheduledEmails || []; },
    };
    if (map[p]) return Promise.resolve(map[p]());
    // GET no mapeado → array vacío (el módulo sigue usando su mock local)
    return Promise.resolve(method === 'GET' ? [] : { ok: true, mock: true });
  }

  function call(method, path, body) {
    return cfg.mode === 'rest' ? request(method, path, body) : mockResolve(method, path, body);
  }

  // ── Hidratación de window.ERPData desde la API (paso #2 del BRIEF) ────
  // En 'rest' reemplaza los arrays seed por datos del tenant logueado.
  // En 'mock' es no-op (deja el seed).
  function hydrate() {
    if (cfg.mode !== 'rest') return Promise.resolve(false);
    window.ERPData = window.ERPData || {};
    var jobs = [
      ['/clients', 'CLIENTS'], ['/suppliers', 'SUPPLIERS'], ['/shipments', 'SHIPMENTS'],
      ['/invoices', 'INVOICES'], ['/quotes', 'QUOTES'], ['/accounts', 'ACCOUNTS'],
    ];
    return Promise.all(jobs.map(function (j) {
      return call('GET', j[0]).then(function (r) {
        window.ERPData[j[1]] = (r && r.data) ? r.data : r;
      }).catch(function () {});
    })).then(function () {
      window.dispatchEvent(new CustomEvent('dtd-data-hydrated'));
      return true;
    });
  }

  // ── API pública ──────────────────────────────────────────────────────
  window.DTDApi = {
    config: function (next) { Object.assign(cfg, next || {}); return cfg; },
    getConfig: function () { return Object.assign({}, cfg); },
    tenantId: tenantIdFromToken,
    get:    function (path)       { return call('GET', path); },
    post:   function (path, body) { return call('POST', path, body); },
    patch:  function (path, body) { return call('PATCH', path, body); },
    del:    function (path)       { return call('DELETE', path); },
    hydrate: hydrate,
  };

  // ── Auth de sesión (front) ────────────────────────────────────────────
  window.DTDAuth = {
    getToken: getToken,
    getUser: getUser,
    tenantId: tenantIdFromToken,
    isPlatform: function () { return tenantIdFromToken() == null; },
    login: function (email, password) {
      if (cfg.mode !== 'rest') {
        // mock: acepta el currentUser ya cargado por el ERP
        var u = getUser();
        setUser(u); return Promise.resolve(u);
      }
      return request('POST', '/auth/login', { email: email, password: password })
        .then(function (r) { setToken(r.accessToken); setUser(r.user); return r.user; });
    },
    logout: function () {
      var done = cfg.mode === 'rest' ? request('POST', '/auth/logout').catch(function () {}) : Promise.resolve();
      return done.then(function () { setToken(null); setUser(null); });
    },
    setSession: function (token, user) { setToken(token); setUser(user); },
  };
})();
