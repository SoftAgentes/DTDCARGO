/* global React */
/* ── DTD ERP · Despacho · Vista 1 (Admin desktop) ─────────────── */
/* Panel donde el admin/op manager prioriza paquetes pendientes,    */
/* los reordena manualmente si hace falta, y los manda a la app del */
/* almacenista en lotes.                                              */

(function () {
  const { useState, useMemo, useEffect } = React;

  // ── Mock data ────────────────────────────────────────────────
  // En producción esto vive en erp/data.jsx (DISPATCH_QUEUE) y se calcula
  // server-side con el motor de reglas (ver Vista 2).
  // tier viene de CLIENTS.tier — solo Gold/Platinum cuentan como "VIP" para scoring.
  // Cada paquete lleva barrio + distanceToStopKm (vendrá del geocoding · mock hoy)
  // Cada paquete lleva weight + volume + descripción de mercancía (para SENIAT,
  // aduana, almacenista, transportista). Datos llenados por oficina CN al recibir.
  const PKGS = [
    { order: 'DTD-2026-0142', client: 'Carlos Méndez',     markbox: 'DTD-5452', city: 'Valencia',     barrio: 'Naguanagua',     pay: 'pagado',    days: 18, tier: 'Gold',     ageRoute: 5, distanceToStopKm: null, boxes: 12, weightKg: 980,  volumeCBM: 6.4, hsCode: '8517.12', description: 'Cables eléctricos blindados 2.5mm + conectores industriales · 12 cajas estandarizadas' },
    { order: 'DTD-2026-0150', client: 'Manuel Quintero',   markbox: 'DTD-5476', city: 'Valencia',     barrio: 'El Viñedo',      pay: 'pagado',    days: 5,  tier: null,       ageRoute: 5, distanceToStopKm: null, boxes: 8, weightKg: 540, volumeCBM: 3.8, hsCode: '9405.40', description: 'Lámparas LED de pared 24W · 8 cajas con drivers' },
    { order: 'DTD-2026-0151', client: 'Luis Fernández',    markbox: 'DTD-5392', city: 'Caracas',      barrio: 'Las Mercedes',   pay: 'pagado',    days: 8,  tier: 'Platinum', ageRoute: 3, distanceToStopKm: null, boxes: 42, weightKg: 12400, volumeCBM: 28.4, hsCode: '8418.50', description: 'Heladeras industriales vitrina 600L · acero inox · 42 unidades' },
    { order: 'DTD-2026-0147', client: 'Andrea Silva',      markbox: 'DTD-5481', city: 'Valencia',     barrio: 'Trigal Norte',   pay: 'parcial',   days: 13, tier: null,       ageRoute: 5, distanceToStopKm: null, boxes: 6, weightKg: 320, volumeCBM: 2.4, hsCode: '4202.92', description: 'Carteras y mochilas escolares · 6 cajas (40 u/c)' },
    { order: 'DTD-2026-0149', client: 'Carolina Vargas',   markbox: 'DTD-5298', city: 'Valencia',     barrio: 'San José',       pay: 'parcial',   days: 6,  tier: null,       ageRoute: 5, distanceToStopKm: null, boxes: 4, weightKg: 180, volumeCBM: 1.6, hsCode: '6109.10', description: 'Camisetas algodón unisex · 4 cajas × 80 unidades' },
    { order: 'DTD-2026-0145', client: 'Adriana Pereira',   markbox: 'DTD-5418', city: 'Caracas',      barrio: 'Chacao',         pay: 'pagado',    days: 12, tier: null,       ageRoute: 3, distanceToStopKm: null, boxes: 18, weightKg: 1450, volumeCBM: 8.2, hsCode: '9405.40', description: 'LED 30W (10cj) + LED 50W panel (8cj) · drivers incluidos' },
    { order: 'DTD-2026-0148', client: 'Valentina Ortiz',   markbox: 'DTD-5215', city: 'Caracas',      barrio: 'Altamira',       pay: 'pagado',    days: 11, tier: null,       ageRoute: 3, distanceToStopKm: null, boxes: 6, weightKg: 320, volumeCBM: 3.4, hsCode: '3304.99', description: 'Maquillaje · labiales + paletas 12-pan · 6 cajas surtidas' },
    { order: 'DTD-2026-0140', client: 'José Hernández',    markbox: 'DTD-5241', city: 'Maturín',      barrio: 'La Floresta',    pay: 'pagado',    days: 28, tier: 'Gold',     ageRoute: 1, distanceToStopKm: null, boxes: 28, weightKg: 3200, volumeCBM: 12.4, hsCode: '7321.11', description: 'Cocinas industriales 6 hornillas acero · 28 unidades en pallets' },
    { order: 'DTD-2026-0138', client: 'Roberto Castro',    markbox: 'DTD-5354', city: 'Punto Fijo',   barrio: 'Centro',         pay: 'pagado',    days: 22, tier: 'Gold',     ageRoute: 2, distanceToStopKm: null, boxes: 33, weightKg: 4100, volumeCBM: 14.8, hsCode: '6402.99', description: 'Calzado deportivo · 33 cajas × 12 pares · varios talles' },
    { order: 'DTD-2026-0152', client: 'Andrés Briceño',    markbox: 'DTD-5277', city: 'Barquisimeto', barrio: 'Centro',         pay: 'pagado',    days: 9,  tier: 'Gold',     ageRoute: 3, distanceToStopKm: 12, boxes: 22, weightKg: 2400, volumeCBM: 6.2, hsCode: '5208.32', description: 'Tela algodón crudo · bobinas 50m × 1.5m · 22 rollos' },
    { order: 'DTD-2026-0143', client: 'María González',    markbox: 'DTD-5371', city: 'Maracaibo',    barrio: 'Bella Vista',    pay: 'parcial',   days: 16, tier: null,       ageRoute: 1, distanceToStopKm: null, boxes: 24, weightKg: 1800, volumeCBM: 4.6, hsCode: '8471.30', description: 'Laptops Lenovo IdeaPad 3 · i5/8GB/512GB · 24 unidades' },
    { order: 'DTD-2026-0146', client: 'Eduardo Salazar',   markbox: 'DTD-5321', city: 'Caracas',      barrio: 'Sabana Grande',  pay: 'parcial',   days: 14, tier: null,       ageRoute: 3, distanceToStopKm: null, boxes: 14, weightKg: 2100, volumeCBM: 5.4, hsCode: '4202.92', description: 'Bolsos cuero sintético · 7 modelos × 2 colores · 50u/cj' },
    { order: 'DTD-2026-0144', client: 'Sofía Linares',     markbox: 'DTD-5263', city: 'Caracas',      barrio: 'Chacao',         pay: 'pendiente', days: 19, tier: null,       ageRoute: 3, distanceToStopKm: null, boxes: 5, weightKg: 240, volumeCBM: 2.2, hsCode: '6109.10', description: 'Vestidos noche poliéster · 5 cajas × 30 unidades' },
    { order: 'DTD-2026-0153', client: 'Patricia Rojas',    markbox: 'DTD-5340', city: 'Mérida',       barrio: 'La Hechicera',   pay: 'pendiente', days: 4,  tier: null,       ageRoute: 1, distanceToStopKm: null, boxes: 9, weightKg: 680, volumeCBM: 3.6, hsCode: '6307.90', description: 'Manteles y blancos hotelería · 9 cajas con sets de 12 piezas' },
    // Paquetes en ciudades de PARADA — ejercitan la lógica de radio
    { order: 'DTD-2026-0155', client: 'Pedro Camacaro',    markbox: 'DTD-5489', city: 'Maracay',      barrio: 'San Jacinto',    pay: 'pagado',    days: 7,  tier: null,       ageRoute: 4, distanceToStopKm: 14, boxes: 3, weightKg: 120, volumeCBM: 1.2, hsCode: '7013.99', description: 'Vajilla vidrio templado · juego completo 24 piezas × 3 cajas' },
    { order: 'DTD-2026-0156', client: 'Rosa Méndez',       markbox: 'DTD-5491', city: 'Maracay',      barrio: 'El Castaño',     pay: 'parcial',   days: 11, tier: null,       ageRoute: 4, distanceToStopKm: 25, boxes: 7, weightKg: 420, volumeCBM: 2.8, hsCode: '6109.10', description: 'Ropa interior masculina · 7 cajas × 80 piezas surtidas' },
    { order: 'DTD-2026-0157', client: 'Diego Pacheco',     markbox: 'DTD-5493', city: 'Coro',         barrio: 'Centro',         pay: 'pagado',    days: 9,  tier: null,       ageRoute: 2, distanceToStopKm: 22, boxes: 11, weightKg: 980, volumeCBM: 4.2, hsCode: '9018.90', description: 'Equipos médicos · tensiómetros + oxímetros · 11 cajas' },
    // Paquetes en ciudad de PARADA pero SIN GEOCODING todavía (distanceToStopKm = null)
    { order: 'DTD-2026-0158', client: 'Carmen Lugo',        markbox: 'DTD-5495', city: 'Barquisimeto', barrio: 'El Tostado',     pay: 'pagado',    days: 6,  tier: null,       ageRoute: 3, distanceToStopKm: null, boxes: 4, weightKg: 210, volumeCBM: 1.8, hsCode: '4202.92', description: 'Mochilas escolares estampadas · 4 cajas × 40 unidades' },
    { order: 'DTD-2026-0159', client: 'Manuel Sojo',        markbox: 'DTD-5497', city: 'Maracay',      barrio: 'Las Delicias',   pay: 'parcial',   days: 10, tier: null,       ageRoute: 4, distanceToStopKm: null, boxes: 6, weightKg: 480, volumeCBM: 2.6, hsCode: '8501.10', description: 'Motores eléctricos 0.5HP · 6 cajas con repuestos' },
  ];

  // Rutas activas del tenant (en prod viene de Admin → Rutas)
  const ROUTES_SEED = [
    { id: 'R-001', name: 'Valencia → Caracas',                type: 'directa',     destination: 'Caracas',   stops: [],                                                                            active: true },
    { id: 'R-002', name: 'Valencia → Caracas + 2 paradas',    type: 'con-paradas', destination: 'Caracas',   stops: [{ city: 'Maracay', radiusKm: 20 }, { city: 'San Juan de los Morros', radiusKm: 15 }], active: true },
    { id: 'R-003', name: 'Valencia → Maracaibo',              type: 'directa',     destination: 'Maracaibo', stops: [],                                                                            active: true },
    { id: 'R-004', name: 'Valencia → Maracaibo + 2 paradas',  type: 'con-paradas', destination: 'Maracaibo', stops: [{ city: 'Barquisimeto', radiusKm: 30 }, { city: 'Coro', radiusKm: 25 }],         active: true },
  ];
  let ROUTES = ROUTES_SEED;

  // ── Flota (TRUCKS + DRIVERS) · en prod viene de window.ERPData ─
  const TRUCKS = [
    { id: 'T-001', plate: 'AC542XK', label: 'Volvo FH',       hub: 'Valencia', capacityKg: 30000, capacityCBM: 76, status: 'disponible' },
    { id: 'T-002', plate: 'AD188PL', label: 'Mercedes Atego', hub: 'Valencia', capacityKg: 12000, capacityCBM: 38, status: 'disponible' },
    { id: 'T-006', plate: 'AH445BR', label: 'Kenworth T880',  hub: 'Valencia', capacityKg: 30000, capacityCBM: 92, status: 'cargando' },
    { id: 'T-003', plate: 'AE204JR', label: 'Iveco Daily',    hub: 'La Guaira',capacityKg: 7000,  capacityCBM: 22, status: 'disponible' },
    { id: 'T-007', plate: 'AI223GH', label: 'Mercedes Atego', hub: 'Punto Fijo', capacityKg: 12000, capacityCBM: 38, status: 'disponible' },
  ];
  const DRIVERS = [
    { id: 'd-001', name: 'Luis Hernández', hub: 'Valencia',   rating: 4.9, trips30d: 22, status: 'disponible' },
    { id: 'd-002', name: 'José Velásquez', hub: 'Valencia',   rating: 4.7, trips30d: 18, status: 'disponible' },
    { id: 'd-005', name: 'Mario Castillo', hub: 'Valencia',   rating: 4.6, trips30d: 14, status: 'cargando' },
    { id: 'd-003', name: 'Carlos Salinas', hub: 'La Guaira',  rating: 4.8, trips30d: 16, status: 'disponible' },
    { id: 'd-006', name: 'Ramón Briceño',  hub: 'Punto Fijo', rating: 4.7, trips30d: 12, status: 'disponible' },
  ];

  // ── Órdenes de despacho activas (seed mock) ─────────────────
  // En prod cada OD se crea cuando admin asigna ruta+camión+chofer y se
  // sigue su ciclo: creada → cargando → lista → en-ruta → entregada → cerrada.
  const SEED_ORDERS = [
    {
      id: 'OD-2026-0142', status: 'en-ruta', routeId: 'R-002', truckId: 'T-001', driverId: 'd-001',
      packageIds: ['DTD-2026-0151', 'DTD-2026-0155', 'DTD-2026-0145'],
      packageCount: 11, totalKg: 8400, totalCBM: 22.4, capacityKg: 30000, capacityCBM: 76,
      createdAt: '2026-05-24 08:12', departedAt: '2026-05-24 09:45', progress: 36,
      cities: ['Maracay', 'San Juan de los Morros', 'Caracas'],
    },
    {
      id: 'OD-2026-0141', status: 'cargando', routeId: 'R-003', truckId: 'T-004', driverId: 'd-004',
      packageIds: ['DTD-2026-0143'],
      packageCount: 6, totalKg: 5200, totalCBM: 14.8, capacityKg: 30000, capacityCBM: 76,
      createdAt: '2026-05-24 09:30', progress: 0,
      cities: ['Maracaibo'],
    },
    {
      id: 'OD-2026-0140', status: 'entregada', routeId: 'R-001', truckId: 'T-002', driverId: 'd-002',
      packageIds: [],
      packageCount: 8, totalKg: 1850, totalCBM: 9.4, capacityKg: 12000, capacityCBM: 38,
      createdAt: '2026-05-23 07:45', departedAt: '2026-05-23 08:10', completedAt: '2026-05-23 14:20', progress: 100,
      cities: ['Caracas'],
    },
  ];

  const ORDER_STATUS = {
    'creada':    { label: 'Creada',     tone: 'neutral', icon: 'plus',    next: 'cargando',  pct: 5 },
    'cargando':  { label: 'Cargando',   tone: 'warning', icon: 'box',     next: 'lista',     pct: 20 },
    'lista':     { label: 'Lista',      tone: 'info',    icon: 'check',   next: 'en-ruta',   pct: 35 },
    'en-ruta':   { label: 'En ruta',    tone: 'wine',    icon: 'truck',   next: 'entregada', pct: 60 },
    'entregada': { label: 'Entregada',  tone: 'success', icon: 'check',   next: 'cerrada',   pct: 100 },
    'cerrada':   { label: 'Cerrada',    tone: 'neutral', icon: 'lock',    next: null,        pct: 100 },
  };

    // Devuelve { eligible, via } para un paquete en una ruta dada.
  function routeEligibility(p, route) {
    if (!route) return { eligible: true, via: null };
    if (route.type === 'directa') {
      return p.city === route.destination ? { eligible: true, via: 'directo' } : { eligible: false };
    }
    if (p.city === route.destination) return { eligible: true, via: 'directo' };
    const stop = route.stops.find(s => s.city === p.city);
    if (stop) {
      if (p.distanceToStopKm == null) {
        return { eligible: true, via: 'sin coords', state: 'pending-coords', stopCity: stop.city };
      }
      if (p.distanceToStopKm <= stop.radiusKm) {
        return { eligible: true, via: `vía ${stop.city} · ${p.distanceToStopKm}km` };
      }
    }
    return { eligible: false };
  }

  // Helper global: el paquete necesita geocoding (su ciudad es parada de alguna ruta activa)
  function needsGeocoding(p, routes) {
    if (p.distanceToStopKm != null) return false;
    return routes.some(r => r.active && r.type === 'con-paradas' && r.stops.some(s => s.city === p.city));
  }

  // Tier === Gold/Platinum = elegible para bonus VIP
  const isVip = (p) => p.tier === 'Gold' || p.tier === 'Platinum';

  // ── Scoring engine (default weights · sincronizado con Vista 2) ─
  const WEIGHTS = {
    valencia: 40,    // destino Valencia → HQ DTD-Cargo
    fullPay: 30,     // pago 100%
    partialPay: 15,  // pago parcial
    fifo: 15,        // FIFO antigüedad · 0-15 según días en bodega
    vip: 10,         // cliente VIP
    routeProx: 5,    // cercanía a ruta del día · 0-5
  };

  function scorePkg(p, rulesEnabled = { tier: true }) {
    let s = 0;
    if (p.city === 'Valencia') s += WEIGHTS.valencia;
    if (p.pay === 'pagado') s += WEIGHTS.fullPay;
    else if (p.pay === 'parcial') s += WEIGHTS.partialPay;
    // FIFO: 0 días = 0, 21+ días = 15 (lineal)
    s += Math.min(WEIGHTS.fifo, Math.round((p.days / 21) * WEIGHTS.fifo));
    if (rulesEnabled.tier && isVip(p)) s += WEIGHTS.vip;
    // Cercanía: ya viene precalculado 0-5
    s += Math.min(WEIGHTS.routeProx, p.ageRoute);
    return Math.min(100, s);
  }

  function priorityLevel(score) {
    if (score >= 80) return { label: 'Crítico', tone: 'danger' };
    if (score >= 65) return { label: 'Alto',    tone: 'wine' };
    if (score >= 45) return { label: 'Medio',   tone: 'warning' };
    return { label: 'Bajo', tone: 'neutral' };
  }

  function payTone(pay) {
    if (pay === 'pagado') return 'success';
    if (pay === 'parcial') return 'warning';
    return 'danger';
  }

  function payLabel(pay) {
    if (pay === 'pagado') return 'Pagado 100%';
    if (pay === 'parcial') return 'Abono';
    return 'Pendiente';
  }

  function daysColor(days) {
    if (days >= 21) return 'var(--danger)';
    if (days >= 15) return 'var(--warning)';
    if (days >= 8)  return 'var(--ink)';
    return 'var(--ink-soft)';
  }

  // ── Main module ──────────────────────────────────────────────
  function ModuleDespacho({ goTo }) {
    const U = window.ERPUI;
    const I = window.Icon;

    // En producción estas reglas vienen de la config del tenant (Vista 2).
    const [bridgeRules, setBridgeRules] = useState(null);
    useEffect(() => {
      if (!window.DTDData) return;
      const off = window.DTDData.rules.subscribe((r) => setBridgeRules(r));
      return off;
    }, []);
    const rulesEnabled = bridgeRules?.optionalRules || { tier: true };

    // Estado de lista (con score pre-calculado) ordenada por score desc por default.
    const initial = useMemo(() => {
      return PKGS.map(p => ({ ...p, score: scorePkg(p, rulesEnabled) }))
                 .sort((a, b) => b.score - a.score);
    }, []);
    const [rows, setRows] = useState(initial);

    // A · Pipeline CN → Despacho: mergear paquetes recibidos en CN
    useEffect(() => {
      if (!window.DTDData) return;
      const off = window.DTDData.cnInbox.subscribe((inbox) => {
        if (!inbox || inbox.length === 0) return;
        setRows(prev => {
          const existing = new Set(prev.map(r => r.order));
          const incoming = inbox.filter(p => !existing.has(p.order)).map(p => ({
            ...p, score: scorePkg(p, rulesEnabled),
          }));
          if (incoming.length === 0) return prev;
          return [...incoming, ...prev].sort((a, b) => b.score - a.score);
        });
      });
      return off;
    }, []);
    const [manual, setManual] = useState(false); // si el usuario tocó el orden

    const [search, setSearch]   = useState('');
    const [fCity, setFCity]     = useState('all');
    const [fBarrio, setFBarrio] = useState('all');
    const [fPay, setFPay]       = useState('all');
    const [fDays, setFDays]     = useState('all');
    const [fRoute, setFRoute]   = useState('all');
    const [selected, setSelected] = useState([]);

    // Reset filtros dependientes
    React.useEffect(() => { setFBarrio('all'); }, [fCity]);

    // Barrios disponibles según ciudad seleccionada
    const barriosForCurrentCity = React.useMemo(() => {
      const src = fCity === 'all' ? rows : rows.filter(r => r.city === fCity);
      return Array.from(new Set(src.map(r => r.barrio).filter(Boolean))).sort();
    }, [rows, fCity]);

    const [bridgeRoutes, setBridgeRoutes] = useState(ROUTES_SEED);
    useEffect(() => {
      if (!window.DTDData) return;
      const off = window.DTDData.routes.subscribe((r) => {
        if (r && r.length) { ROUTES = r; setBridgeRoutes(r); }
      });
      return off;
    }, []);
    const activeRoute = bridgeRoutes.find(r => r.id === fRoute);

    const [geoModalOpen, setGeoModalOpen] = useState(false);
    const [assignModalOpen, setAssignModalOpen] = useState(false);
    const [pendingBatch, setPendingBatch] = useState(null);
    const [orders, setOrders] = useState(SEED_ORDERS);
    const [contactOrder, setContactOrder] = useState(null);
    const [dragIdx, setDragIdx] = useState(null);
    const [overIdx, setOverIdx] = useState(null);

    const [toast, setToast] = useState(null);
    useEffect(() => {
      if (!toast) return;
      const t = setTimeout(() => setToast(null), 3200);
      return () => clearTimeout(t);
    }, [toast]);

    // ── Filtering (no toca el orden, solo oculta filas) ─────────
    const filtered = useMemo(() => {
      return rows.filter(r => {
        if (fCity !== 'all' && r.city !== fCity) return false;
        if (fBarrio !== 'all' && r.barrio !== fBarrio) return false;
        if (fPay  !== 'all' && r.pay  !== fPay)  return false;
        if (activeRoute && !routeEligibility(r, activeRoute).eligible) return false;
        if (fDays === '0-7'   && !(r.days <= 7))               return false;
        if (fDays === '8-14'  && !(r.days >= 8 && r.days <= 14)) return false;
        if (fDays === '15-20' && !(r.days >= 15 && r.days <= 20)) return false;
        if (fDays === '21+'   && !(r.days >= 21))              return false;
        if (search) {
          const q = search.toLowerCase();
          const hit = r.order.toLowerCase().includes(q)
                   || r.client.toLowerCase().includes(q)
                   || r.markbox.toLowerCase().includes(q)
                   || r.city.toLowerCase().includes(q);
          if (!hit) return false;
        }
        return true;
      });
    }, [rows, fCity, fBarrio, fPay, fDays, fRoute, search, activeRoute]);

    // ── KPIs ────────────────────────────────────────────────────
    const kpis = useMemo(() => {
      const total    = rows.length;
      const listos   = rows.filter(r => r.score >= 65).length;
      const atrasados= rows.filter(r => r.days >= 21).length;
      const avgDays  = Math.round(rows.reduce((s, r) => s + r.days, 0) / rows.length);
      const pendingCoords = rows.filter(r => needsGeocoding(r, ROUTES)).length;
      return { total, listos, atrasados, avgDays, pendingCoords };
    }, [rows]);

    // ── Drag handlers ───────────────────────────────────────────
    function onDragStart(e, idx) {
      setDragIdx(idx);
      e.dataTransfer.effectAllowed = 'move';
      // ghost transparente para no ver toda la fila arrastrada
      try { e.dataTransfer.setData('text/plain', String(idx)); } catch (_) {}
    }
    function onDragOver(e, idx) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (overIdx !== idx) setOverIdx(idx);
    }
    function onDrop(e, idx) {
      e.preventDefault();
      if (dragIdx === null || dragIdx === idx) {
        setDragIdx(null); setOverIdx(null); return;
      }
      const next = [...rows];
      const [moved] = next.splice(dragIdx, 1);
      next.splice(idx, 0, moved);
      setRows(next);
      setManual(true);
      setDragIdx(null);
      setOverIdx(null);
    }
    function onDragEnd() { setDragIdx(null); setOverIdx(null); }

    function resetOrder() {
      setRows([...rows].sort((a, b) => b.score - a.score));
      setManual(false);
    }

    // ── Selection ───────────────────────────────────────────────
    const allShownSelected = filtered.length > 0 && filtered.every(r => selected.includes(r.order));
    function toggleAll() {
      if (allShownSelected) setSelected(selected.filter(id => !filtered.some(r => r.order === id)));
      else setSelected(Array.from(new Set([...selected, ...filtered.map(r => r.order)])));
    }
    function toggleOne(id) {
      setSelected(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
    }

    // ── Send to almacenista ───────────────────────────────────────
    function sendBatch(ids) {
      const list = ids && ids.length ? ids : filtered.slice(0, 10).map(r => r.order);
      setPendingBatch(list);
      setAssignModalOpen(true);
    }

    function confirmAssignment({ routeId, truckId, driverId }) {
      const list = pendingBatch;
      const route  = ROUTES.find(r => r.id === routeId);
      const truck  = TRUCKS.find(t => t.id === truckId);
      const driver = DRIVERS.find(d => d.id === driverId);
      const batchPkgs = rows.filter(r => list.includes(r.order));
      const totalKg  = batchPkgs.reduce((s, p) => s + (p.weightKg || 0), 0);
      const totalCBM = batchPkgs.reduce((s, p) => s + (p.volumeCBM || 0), 0);
      // Crear nueva OD (creada → cargando)
      const nextNum = String(orders.length + 143).padStart(4, '0');
      const newOrder = {
        id: `OD-2026-${nextNum}`, status: 'creada',
        routeId, truckId, driverId, packageIds: list, packageCount: list.length,
        totalKg, totalCBM, capacityKg: truck.capacityKg, capacityCBM: truck.capacityCBM,
        createdAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
        progress: 5,
        cities: Array.from(new Set(batchPkgs.map(p => p.city))),
      };
      setOrders([newOrder, ...orders]);
      setRows(rows.filter(r => !list.includes(r.order)));
      setSelected(selected.filter(id => !list.includes(id)));
      setToast(`${newOrder.id} · ${list.length} paquetes · ${truck.plate} · ${driver.name.split(' ')[0]} → almacenista`);
      setAssignModalOpen(false);
      setPendingBatch(null);
    }

    function advanceOrderStatus(orderId) {
      setOrders(orders.map(o => {
        if (o.id !== orderId) return o;
        const cur = ORDER_STATUS[o.status];
        if (!cur.next) return o;
        const next = ORDER_STATUS[cur.next];
        return { ...o, status: cur.next, progress: next.pct };
      }));
    }

    // Job de geocoding: asigna distanceToStopKm sintética (en prod sería server-side)
    function applyGeocoding(updatedDistances) {
      setRows(rows.map(r => updatedDistances[r.order] != null ? { ...r, distanceToStopKm: updatedDistances[r.order] } : r));
      setToast(`Geocoding completado · ${Object.keys(updatedDistances).length} direcciones enriquecidas`);
      setGeoModalOpen(false);
    }

    const cities = ['Valencia', 'Caracas', 'Maracay', 'Maracaibo', 'Barquisimeto', 'Coro', 'Punto Fijo', 'Maturín', 'Mérida'];

    return (
      <div>
        <U.PageHeader
          eyebrow="OPERACIONES · VENEZUELA"
          title="Orden de Despacho"
          subtitle="Cola priorizada de paquetes en bodega VE listos para reparto. El motor de reglas asigna un score 0-100; podés reordenar manualmente y enviar el lote a la app del almacenista."
          actions={
            <React.Fragment>
              {manual && (
                <U.Btn variant="ghost" size="md" icon={I.refresh(14)} onClick={resetOrder}>
                  Restaurar orden auto
                </U.Btn>
              )}
              <U.Btn variant="ghost" size="md" icon={I.cog(14)} onClick={() => goTo && goTo('despacho-rules')}>
                Reglas de prioridad
              </U.Btn>
              <U.Btn variant="primary" size="md" icon={I.truck(14)} onClick={() => sendBatch(selected)}>
                {selected.length > 0
                  ? `Enviar ${selected.length} al almacenista`
                  : 'Enviar TOP 10 al almacenista'}
              </U.Btn>
            </React.Fragment>
          }
        />

        {/* ── KPIs ───────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 'var(--s-6)' }}>
          <U.KPI label="Total pendientes" value={kpis.total}     sub="en bodega VE" tone="wine"    icon={I.box(18)} />
          <U.KPI label="Listos hoy"       value={kpis.listos}    sub={`score ≥ 65 · ${Math.round(kpis.listos/kpis.total*100)}% del total`} tone="success" icon={I.check(18)} />
          <U.KPI label="Atrasados"        value={kpis.atrasados} sub="21+ días en bodega" tone="danger"  icon={I.warn(18)} />
          <U.KPI label="Días promedio"    value={`${kpis.avgDays}d`} sub="permanencia bodega" tone="neutral" icon={I.clock(18)} />
          <CoordsKPI count={kpis.pendingCoords} onRun={() => setGeoModalOpen(true)} />
        </div>

        {/* ── Toolbar / filters ──────────────────────────────── */}
        <U.Toolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Buscar # orden, cliente, MARKBOX, ciudad…"
          filters={
            <React.Fragment>
              <U.Select value={fCity} onChange={(e) => setFCity(e.target.value)} style={{ width: 170 }} options={[
                { value: 'all', label: 'Todas las ciudades' },
                ...cities.map(c => ({ value: c, label: c })),
              ]} />
              <U.Select
                value={fBarrio}
                onChange={(e) => setFBarrio(e.target.value)}
                style={{ width: 170 }}
                options={[
                  { value: 'all', label: barriosForCurrentCity.length ? 'Todos los barrios' : 'Sin barrios' },
                  ...barriosForCurrentCity.map(b => ({ value: b, label: b })),
                ]}
              />
              <U.Select value={fPay} onChange={(e) => setFPay(e.target.value)} style={{ width: 170 }} options={[
                { value: 'all',       label: 'Todos los pagos' },
                { value: 'pagado',    label: 'Pagado 100%' },
                { value: 'parcial',   label: 'Abono' },
                { value: 'pendiente', label: 'Pendiente' },
              ]} />
              <U.Select value={fDays} onChange={(e) => setFDays(e.target.value)} style={{ width: 170 }} options={[
                { value: 'all',   label: 'Todos los días' },
                { value: '0-7',   label: '0–7 días' },
                { value: '8-14',  label: '8–14 días' },
                { value: '15-20', label: '15–20 días' },
                { value: '21+',   label: '21+ días · atrasado' },
              ]} />
              <U.Select
                value={fRoute}
                onChange={(e) => setFRoute(e.target.value)}
                style={{ width: 230 }}
                options={[
                  { value: 'all', label: 'Todas las rutas' },
                  ...ROUTES.filter(r => r.active && r.type === 'directa').map(r => ({ value: r.id, label: `${r.id} · ${r.name}` })),
                  ...ROUTES.filter(r => r.active && r.type === 'con-paradas').map(r => ({ value: r.id, label: `${r.id} · ${r.name}` })),
                ]}
              />
            </React.Fragment>
          }
          actions={
            manual && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 10px', borderRadius: 'var(--r-pill)',
                background: 'var(--warning-bg)', color: 'var(--warning)',
                font: '700 11px/1 var(--f-sans)', letterSpacing: '0.04em', textTransform: 'uppercase',
              }}>
                {I.pin(12)} Orden manual activo
              </span>
            )
          }
        />

        {/* ── Custom table (no usamos U.Table porque necesitamos drag-handles) ── */}
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r-lg)',
          overflow: 'hidden',
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1400 }}>
              <thead>
                <tr style={{ background: 'var(--bg-elevated)' }}>
                  <th style={th({ w: 36 })}></th>
                  <th style={th({ w: 36 })}>
                    <input type="checkbox" checked={allShownSelected} onChange={toggleAll} />
                  </th>
                  <th style={th({ w: 56,  align: 'center' })}>#</th>
                  <th style={th({ w: 150 })}>Tracking</th>
                  <th style={th({})}>Cliente</th>
                  <th style={th({ w: 150 })}>Ciudad destino</th>
                  <th style={th({ w: 140 })}>Estado pago</th>
                  <th style={th({ w: 110, align: 'right' })}>Días bodega</th>
                  <th style={th({ w: 180 })}>Score · prioridad</th>
                  <th style={th({ w: 220 })}>Descripción mercancía</th>
                  <th style={th({ w: 170, align: 'right' })}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={10} style={{ padding: 0 }}>
                    <U.EmptyState
                      icon={I.box(22)}
                      title="No hay paquetes con esos filtros"
                      body="Ajustá los filtros o limpiá la búsqueda para volver a ver la cola completa."
                      style={{ border: 0, borderRadius: 0 }}
                    />
                  </td></tr>
                )}
                {filtered.map((r) => {
                  const realIdx = rows.findIndex(x => x.order === r.order);
                  const pos     = realIdx + 1;
                  const prio    = priorityLevel(r.score);
                  const isSel   = selected.includes(r.order);
                  const isDrag  = dragIdx === realIdx;
                  const isOver  = overIdx === realIdx && dragIdx !== null && dragIdx !== realIdx;

                  return (
                    <tr
                      key={r.order}
                      draggable
                      onDragStart={(e) => onDragStart(e, realIdx)}
                      onDragOver={(e) => onDragOver(e, realIdx)}
                      onDrop={(e) => onDrop(e, realIdx)}
                      onDragEnd={onDragEnd}
                      style={{
                        background: isSel ? 'var(--wine-tint)' : isOver ? 'var(--info-bg)' : 'transparent',
                        opacity: isDrag ? 0.5 : 1,
                        borderTop: isOver ? '2px solid var(--info)' : '2px solid transparent',
                        boxShadow: isDrag ? 'var(--shadow-pop)' : 'none',
                        transform: isDrag ? 'scale(1.01)' : isOver ? 'translateY(2px)' : 'none',
                        transition: 'background 160ms var(--ease), opacity 160ms var(--ease), transform 200ms cubic-bezier(0.2, 0.9, 0.3, 1.3), box-shadow 160ms var(--ease)',
                        cursor: isDrag ? 'grabbing' : 'default',
                        position: 'relative', zIndex: isDrag ? 5 : 1,
                      }}
                      onMouseEnter={(e) => { if (!isSel && !isOver) e.currentTarget.style.background = 'var(--bg-elevated)'; }}
                      onMouseLeave={(e) => { if (!isSel && !isOver) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <td style={td({ w: 36 })}>
                        <span title="Arrastrar para reordenar" style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          width: 22, height: 28, color: 'var(--ink-mute)',
                          cursor: 'grab', borderRadius: 'var(--r-sm)',
                        }}>
                          <DragDots />
                        </span>
                      </td>
                      <td style={td({ w: 36 })} onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={isSel} onChange={() => toggleOne(r.order)} />
                      </td>
                      <td style={td({ align: 'center' })}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          width: 28, height: 28, borderRadius: 'var(--r-md)',
                          background: pos <= 3 ? 'var(--wine)' : pos <= 10 ? 'var(--wine-tint)' : 'var(--bg-elevated)',
                          color: pos <= 3 ? '#fff' : pos <= 10 ? 'var(--wine)' : 'var(--ink-soft)',
                          font: '900 13px/1 var(--f-display)', letterSpacing: '-0.02em',
                        }}>{pos}</span>
                      </td>
                      <td style={td({})}>
                        <code style={{ font: '700 12.5px/1 var(--f-mono)', color: 'var(--ink)' }}>{r.order}</code>
                      </td>
                      <td style={td({})}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <div style={{ font: '600 13px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{r.client}</div>
                          {rulesEnabled.tier && r.tier && <TierBadge tier={r.tier} />}
                          {activeRoute && (() => {
                            const elig = routeEligibility(r, activeRoute);
                            if (!elig.via) return null;
                            const pending = elig.state === 'pending-coords';
                            const isDir   = elig.via === 'directo';
                            const tone    = pending ? 'danger' : isDir ? 'info' : 'warning';
                            const label   = pending ? `⚠ falta coords · ${elig.stopCity}` : elig.via;
                            return (
                              <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                height: 18, padding: '0 7px',
                                background: `var(--${tone}-bg)`,
                                color:      `var(--${tone})`,
                                borderRadius: 'var(--r-sm)',
                                font: '800 10px/1 var(--f-sans)', letterSpacing: '0.06em', textTransform: 'uppercase',
                              }}>{label}</span>
                            );
                          })()}
                          {!activeRoute && needsGeocoding(r, ROUTES) && (
                            <span title="Falta geocoding · sin coordenadas para validar radio de paradas" style={{
                              display: 'inline-flex', alignItems: 'center', gap: 3,
                              height: 18, padding: '0 6px',
                              background: 'var(--danger-bg)', color: 'var(--danger)',
                              borderRadius: 'var(--r-sm)',
                              font: '800 9.5px/1 var(--f-sans)', letterSpacing: '0.06em', textTransform: 'uppercase',
                            }}>⚠ sin coords</span>
                          )}
                        </div>
                        <code style={{ font: '600 11px/1 var(--f-mono)', color: 'var(--wine)' }}>{r.markbox}</code>
                      </td>
                      <td style={td({})}>
                        <U.Badge tone="wine" size="sm">{r.city}</U.Badge>
                      </td>
                      <td style={td({})}>
                        <U.Badge tone={payTone(r.pay)} dot size="sm">{payLabel(r.pay)}</U.Badge>
                      </td>
                      <td style={{ ...td({ align: 'right' }), font: '700 13px/1 var(--f-mono)', color: daysColor(r.days) }}>
                        {r.days}d
                      </td>
                      <td style={td({})}>
                        <ScoreCell score={r.score} prio={prio} />
                      </td>
                      <td style={td({})}>
                        {r.description ? (
                          <div title={r.description + ' · HS ' + r.hsCode} style={{ maxWidth: 220 }}>
                            <div style={{
                              font: '500 11.5px/1.35 var(--f-sans)', color: 'var(--ink-soft)',
                              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                              overflow: 'hidden', textOverflow: 'ellipsis',
                            }}>{r.description}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, font: '500 10px/1 var(--f-sans)', color: 'var(--ink-mute)' }}>
                              <code style={{ font: '700 10px/1 var(--f-mono)' }}>HS {r.hsCode}</code>
                              <span>·</span>
                              <span className="mono" style={{ font: '600 10px/1 var(--f-mono)' }}>{r.weightKg}kg · {r.volumeCBM}m³</span>
                            </div>
                          </div>
                        ) : <span style={{ font: '500 11px/1 var(--f-sans)', color: 'var(--ink-mute)' }}>— sin descripción</span>}
                      </td>
                      <td style={td({ align: 'right' })} onClick={(e) => e.stopPropagation()}>
                        <U.Btn variant="soft" size="sm" icon={I.truck(13)} onClick={() => sendBatch([r.order])}>
                          Enviar
                        </U.Btn>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── footer / summary ─────────────────────────────── */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            padding: '12px 18px', borderTop: '1px solid var(--border)',
            background: 'var(--bg-elevated)',
            font: '500 12px/1 var(--f-sans)', color: 'var(--ink-soft)',
          }}>
            <span>
              Mostrando <b style={{ color: 'var(--ink)' }}>{filtered.length}</b> de <b style={{ color: 'var(--ink)' }}>{rows.length}</b> paquetes pendientes
              {selected.length > 0 && <span> · <b style={{ color: 'var(--wine)' }}>{selected.length} seleccionados</b></span>}
            </span>
            <span>
              Pesos motor → Valencia 40 · Pago 100% 30 · Abono 15 · FIFO 0–15 · VIP 10 · Ruta 0–5
            </span>
          </div>
        </div>

        {/* Contact driver modal */}
        {contactOrder && (
          <ContactDriverModal
            order={contactOrder}
            truck={TRUCKS.find(t => t.id === contactOrder.truckId)}
            driver={DRIVERS.find(d => d.id === contactOrder.driverId)}
            route={ROUTES.find(r => r.id === contactOrder.routeId)}
            onClose={() => setContactOrder(null)}
            onSendPush={(msg) => { setContactOrder(null); setToast(`Push enviado a ${msg}`); }}
          />
        )}

        {/* Assignment modal */}
        {assignModalOpen && pendingBatch && (
          <DispatchAssignmentModal
            batchIds={pendingBatch}
            rows={rows}
            routes={ROUTES}
            trucks={TRUCKS}
            drivers={DRIVERS}
            onClose={() => { setAssignModalOpen(false); setPendingBatch(null); }}
            onConfirm={confirmAssignment}
          />
        )}

        {/* ── Geocoding modal ────────────────────────────────── */}
        {geoModalOpen && (
          <GeocodingModal
            pending={rows.filter(r => needsGeocoding(r, ROUTES))}
            routes={ROUTES}
            onClose={() => setGeoModalOpen(false)}
            onApply={applyGeocoding}
          />
        )}

        {/* ── Toast ──────────────────────────────────────────── */}
        {toast && (
          <div style={{
            position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
            background: 'var(--success)', color: '#fff',
            padding: '12px 20px', borderRadius: 'var(--r-md)',
            boxShadow: 'var(--shadow-lg)', zIndex: 200,
            font: '700 13px/1 var(--f-sans)',
            display: 'inline-flex', alignItems: 'center', gap: 10,
            animation: 'erp-pop 200ms var(--ease)',
          }}>
            {I.check(16)} {toast}
          </div>
        )}
      </div>
    );
  }

  // ── Sub-components ───────────────────────────────────────────
  function ScoreCell({ score, prio }) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ minWidth: 38 }}>
          <div style={{ font: '900 17px/1 var(--f-display)', color: `var(--${prio.tone === 'neutral' ? 'ink-soft' : prio.tone})`, letterSpacing: '-0.02em' }}>
            {score}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 60 }}>
          <div style={{ height: 5, background: 'var(--bg-elevated)', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${score}%`,
              background: `var(--${prio.tone === 'neutral' ? 'neutral' : prio.tone})`,
              borderRadius: 999,
            }} />
          </div>
          <div style={{ marginTop: 4 }}>
            <window.ERPUI.Badge tone={prio.tone} size="sm">{prio.label}</window.ERPUI.Badge>
          </div>
        </div>
      </div>
    );
  }

  function DragDots() {
    return (
      <svg width="10" height="16" viewBox="0 0 10 16" fill="none">
        {[2, 8, 14].flatMap((y, i) => [
          <circle key={`l${i}`} cx="2" cy={y} r="1.4" fill="currentColor" />,
          <circle key={`r${i}`} cx="8" cy={y} r="1.4" fill="currentColor" />,
        ])}
      </svg>
    );
  }

  // ── Tier badge (Gold / Platinum) ────────────────────────
  function TierBadge({ tier, size = 'sm' }) {
    if (!tier) return null;
    const isPlat = tier === 'Platinum';
    const conf = isPlat
      ? { bg: 'var(--ink)',       fg: 'var(--ink-inv)', dot: 'var(--wine-soft)', label: 'PLAT' }
      : { bg: 'var(--warning-bg)', fg: 'var(--warning)', dot: 'var(--warning)',   label: 'GOLD' };
    const fs = size === 'xs' ? 9 : 10;
    const h  = size === 'xs' ? 16 : 18;
    return (
      <span title={`Cliente ${tier}`} style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        height: h, padding: '0 7px',
        background: conf.bg, color: conf.fg,
        borderRadius: 'var(--r-sm)',
        font: `800 ${fs}px/1 var(--f-sans)`,
        letterSpacing: '0.1em',
        border: isPlat ? '1px solid var(--wine)' : '1px solid transparent',
      }}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: conf.dot }} />
        {conf.label}
      </span>
    );
  }

  // ── Table cell helpers ───────────────────────────────────────
  function th({ w, align }) {
    return {
      padding: '12px 14px',
      textAlign: align || 'left',
      font: '700 10.5px/1 var(--f-sans)',
      color: 'var(--ink-soft)',
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      borderBottom: '1px solid var(--border)',
      width: w,
      whiteSpace: 'nowrap',
    };
  }
  function td({ w, align }) {
    return {
      padding: '12px 14px',
      textAlign: align || 'left',
      font: '500 13px/1.4 var(--f-sans)',
      color: 'var(--ink)',
      borderBottom: '1px solid var(--border)',
      width: w,
      whiteSpace: 'nowrap',
    };
  }


  // ── KPI interactivo: Sin coordenadas + CTA "Enriquecer" ──────
  function CoordsKPI({ count, onRun }) {
    const I = window.Icon;
    return (
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-lg)',
        padding: 'var(--s-5)',
        boxShadow: 'var(--shadow-xs)',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
          <span style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Sin coordenadas</span>
          <span style={{ color: count > 0 ? 'var(--warning)' : 'var(--success)', opacity: 0.85 }}>{count > 0 ? I.warn(18) : I.check(18)}</span>
        </div>
        <div style={{ font: '900 30px/1 var(--f-display)', color: count > 0 ? 'var(--warning)' : 'var(--ink)', letterSpacing: '-0.02em' }}>{count}</div>
        <div style={{ marginTop: 8, font: '500 11.5px/1.4 var(--f-sans)', color: 'var(--ink-mute)' }}>
          {count > 0 ? 'ciudades de parada · falta geocoding' : 'todas las direcciones enriquecidas'}
        </div>
        {count > 0 && (
          <button onClick={onRun} style={{
            marginTop: 12, padding: '7px 10px',
            background: 'var(--warning-bg)', color: 'var(--warning)',
            border: '1px solid transparent', borderRadius: 'var(--r-sm)',
            font: '700 11.5px/1 var(--f-sans)',
            display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
            cursor: 'pointer', transition: 'all var(--dur-fast) var(--ease)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--warning)'; e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--warning-bg)'; e.currentTarget.style.color = 'var(--warning)'; }}
          >
            {I.spark(12)} Enriquecer {count} {count === 1 ? 'dirección' : 'direcciones'} →
          </button>
        )}
      </div>
    );
  }

  // ── Modal: Geocoding job ─────────────────────────────────────
  function GeocodingModal({ pending, routes, onClose, onApply }) {
    const U = window.ERPUI;
    const I = window.Icon;
    const [state, setState] = useState('idle');    // 'idle' | 'running' | 'done'
    const [processed, setProcessed] = useState({});  // order → { distance, qualified }
    const timersRef = React.useRef([]);

    // Limpia timers al desmontar
    React.useEffect(() => () => { timersRef.current.forEach(clearTimeout); }, []);

    function pickDistance(p) {
      // Sintético: encuentra el primer stop que matchee la ciudad y asigna un km plausible
      for (const r of routes) {
        if (!r.active || r.type !== 'con-paradas') continue;
        const stop = r.stops.find(s => s.city === p.city);
        if (stop) {
          // 70% de probabilidad de caer dentro del radio, 30% fuera
          const inside = Math.random() < 0.7;
          const km = inside
            ? Math.max(1, Math.round(stop.radiusKm * (0.3 + Math.random() * 0.55)))   // 30%-85% del radio
            : Math.round(stop.radiusKm * (1.05 + Math.random() * 0.6));                // 105%-165% del radio
          return { km, radiusKm: stop.radiusKm, qualified: inside };
        }
      }
      return { km: 0, radiusKm: 0, qualified: false };
    }

    function start() {
      setState('running');
      const updated = {};
      pending.forEach((p, i) => {
        const tm = setTimeout(() => {
          const d = pickDistance(p);
          updated[p.order] = d;
          setProcessed(prev => ({ ...prev, [p.order]: d }));
          if (i === pending.length - 1) {
            setTimeout(() => setState('done'), 320);
          }
        }, 280 + i * 480);
        timersRef.current.push(tm);
      });
    }

    function apply() {
      const map = {};
      for (const [order, d] of Object.entries(processed)) map[order] = d.km;
      onApply(map);
    }

    return (
      <U.Modal
        open
        onClose={state === 'running' ? () => {} : onClose}
        title={state === 'done' ? 'Geocoding completado' : 'Enriquecer direcciones · geocoding'}
        width={560}
        actions={
          state === 'idle' ? (
            <React.Fragment>
              <U.Btn variant="ghost" onClick={onClose}>Cancelar</U.Btn>
              <U.Btn variant="primary" icon={I.spark(13)} onClick={start}>Iniciar job</U.Btn>
            </React.Fragment>
          ) : state === 'running' ? (
            <U.Btn variant="ghost" disabled>Procesando…</U.Btn>
          ) : (
            <React.Fragment>
              <U.Btn variant="ghost" onClick={onClose}>Cerrar sin aplicar</U.Btn>
              <U.Btn variant="primary" icon={I.check(13)} onClick={apply}>Aplicar al despacho</U.Btn>
            </React.Fragment>
          )
        }
      >
        {state === 'idle' && (
          <div>
            <div style={{ font: '500 13px/1.5 var(--f-sans)', color: 'var(--ink-soft)', marginBottom: 14 }}>
              Vamos a geocodificar las direcciones de <b style={{ color: 'var(--ink)' }}>{pending.length} paquetes</b> cuya ciudad coincide con una parada de ruta. El job calcula la distancia exacta al centro de la parada para evaluar si caen dentro del radio.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {pending.map(p => (
                <div key={p.order} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                  padding: '8px 10px', background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)', borderRadius: 'var(--r-sm)',
                }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <code style={{ font: '700 11.5px/1 var(--f-mono)', color: 'var(--wine)' }}>{p.order}</code>
                    <span style={{ marginLeft: 8, font: '600 12.5px/1 var(--f-sans)', color: 'var(--ink)' }}>{p.client}</span>
                  </div>
                  <span style={{ font: '500 11.5px/1 var(--f-sans)', color: 'var(--ink-soft)' }}>
                    {p.city} · {p.barrio}
                  </span>
                </div>
              ))}
            </div>
            <div style={{
              marginTop: 14, padding: '10px 12px',
              background: 'var(--info-bg)', color: 'var(--info)',
              borderRadius: 'var(--r-md)',
              font: '500 11.5px/1.5 var(--f-sans)',
              display: 'flex', alignItems: 'flex-start', gap: 8,
            }}>
              <span style={{ marginTop: 1, flexShrink: 0 }}>{I.info(13)}</span>
              <span>En producción esto consume una API de geocoding (Google Maps o similar). Acá simulamos el resultado con distancias plausibles.</span>
            </div>
          </div>
        )}

        {(state === 'running' || state === 'done') && (
          <div>
            <div style={{
              padding: 14, marginBottom: 12,
              background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: state === 'done' ? 'var(--success-bg)' : 'var(--info-bg)',
                color:      state === 'done' ? 'var(--success)'    : 'var(--info)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>{state === 'done' ? I.check(18) : I.spark(18)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: '800 14px/1.1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.01em' }}>
                  {state === 'done'
                    ? `${Object.keys(processed).length} direcciones geocodificadas`
                    : `Geocodificando ${Object.keys(processed).length} / ${pending.length}…`}
                </div>
                <div style={{ font: '500 11.5px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 3 }}>
                  {state === 'done'
                    ? `${Object.values(processed).filter(d => d.qualified).length} dentro de radio · ${Object.values(processed).filter(d => !d.qualified).length} fuera de radio`
                    : 'Consultando API · calculando distancia al centro de la parada'}
                </div>
                <U.Progress
                  value={(Object.keys(processed).length / pending.length) * 100}
                  tone={state === 'done' ? 'success' : 'info'}
                  height={4}
                  style={{ marginTop: 8 }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 280, overflowY: 'auto' }}>
              {pending.map(p => {
                const d = processed[p.order];
                const status = d ? (d.qualified ? 'qualified' : 'out') : 'pending';
                return (
                  <div key={p.order} style={{
                    display: 'grid', gridTemplateColumns: '20px 1fr auto', gap: 10, alignItems: 'center',
                    padding: '8px 10px',
                    background: status === 'pending' ? 'var(--bg-elevated)' : 'var(--bg-surface)',
                    border: `1px solid ${status === 'qualified' ? 'var(--success)' : status === 'out' ? 'var(--warning)' : 'var(--border)'}`,
                    borderRadius: 'var(--r-sm)',
                    opacity: status === 'pending' ? 0.6 : 1,
                    transition: 'all var(--dur) var(--ease)',
                  }}>
                    <span style={{ color: status === 'qualified' ? 'var(--success)' : status === 'out' ? 'var(--warning)' : 'var(--ink-mute)' }}>
                      {status === 'pending' ? <Spinner /> : status === 'qualified' ? I.check(13) : I.warn(13)}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <code style={{ font: '700 11.5px/1 var(--f-mono)', color: 'var(--wine)' }}>{p.order}</code>
                      <span style={{ marginLeft: 8, font: '600 12.5px/1 var(--f-sans)', color: 'var(--ink)' }}>{p.client}</span>
                      <div style={{ font: '500 10.5px/1 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 3 }}>{p.city} · {p.barrio}</div>
                    </div>
                    {d && (
                      <span style={{
                        padding: '4px 8px', borderRadius: 'var(--r-sm)',
                        background: status === 'qualified' ? 'var(--success-bg)' : 'var(--warning-bg)',
                        color:      status === 'qualified' ? 'var(--success)'    : 'var(--warning)',
                        font: '800 11px/1 var(--f-mono)', whiteSpace: 'nowrap',
                      }}>{d.km}km / {d.radiusKm}km</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </U.Modal>
    );
  }

  function Spinner() {
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ animation: 'erp-spin 700ms linear infinite' }}>
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" strokeDasharray="44" strokeDashoffset="22" strokeLinecap="round" />
      </svg>
    );
  }

  // Inyecta keyframe del spinner una sola vez
  if (typeof document !== 'undefined' && !document.getElementById('__despacho-anim')) {
    const s = document.createElement('style');
    s.id = '__despacho-anim';
    s.textContent = '@keyframes erp-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }';
    document.head.appendChild(s);
  }


  // ── Batch summary block ──────────────────────────────────────
  function BatchSummary({ batch }) {
    const I = window.Icon;
    const kg  = batch.reduce((s, p) => s + (p.weightKg || 0), 0);
    const cbm = batch.reduce((s, p) => s + (p.volumeCBM || 0), 0);
    const boxes = batch.reduce((s, p) => s + (p.boxes || 0), 0);
    const cities = new Set(batch.map(p => p.city)).size;
    return (
      <div style={{
        marginBottom: 12, padding: '12px 14px',
        background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)',
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14,
      }}>
        <StatCell label="Paquetes"  value={batch.length} sub={`${cities} ciudad${cities === 1 ? '' : 'es'}`} />
        <StatCell label="Cajas"     value={boxes}        mono />
        <StatCell label="Peso"      value={`${(kg/1000).toFixed(2)}t`}  sub={`${kg.toLocaleString()} kg`} mono />
        <StatCell label="Volumen"   value={`${cbm.toFixed(1)}m³`}      sub="total declarado" mono />
      </div>
    );
  }

  function StatCell({ label, value, sub, mono }) {
    return (
      <div>
        <div style={{ font: '700 9.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>{label}</div>
        <div style={{ font: `900 20px/1 var(--f-display)`, color: 'var(--ink)', letterSpacing: '-0.02em', marginTop: 5 }}>{value}</div>
        {sub && <div style={{ font: '500 10.5px/1 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 4 }}>{sub}</div>}
      </div>
    );
  }

  // ── SENIAT / Autoridades summary ─────────────────────────────
  function SENIATSummary({ batch }) {
    const I = window.Icon;
    // Agrupa por HS code
    const byHs = {};
    for (const p of batch) {
      if (!p.hsCode) continue;
      if (!byHs[p.hsCode]) byHs[p.hsCode] = { code: p.hsCode, count: 0, boxes: 0, weight: 0, descriptions: new Set() };
      byHs[p.hsCode].count++;
      byHs[p.hsCode].boxes  += (p.boxes || 0);
      byHs[p.hsCode].weight += (p.weightKg || 0);
      if (p.description) byHs[p.hsCode].descriptions.add(p.description.split(' · ')[0]);
    }
    const groups = Object.values(byHs).sort((a, b) => b.weight - a.weight);

    return (
      <div style={{
        marginBottom: 14, padding: '12px 14px',
        background: 'var(--info-bg)',
        border: '1px solid transparent',
        borderRadius: 'var(--r-md)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <span style={{ color: 'var(--info)' }}>{I.shield(13)}</span>
          <div style={{ font: '800 11.5px/1 var(--f-sans)', color: 'var(--info)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Mercancía declarada · para SENIAT / supervisiones terrestres
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {groups.map(g => (
            <div key={g.code} style={{
              display: 'grid', gridTemplateColumns: '90px 1fr auto', gap: 10, alignItems: 'center',
              padding: '6px 8px', background: 'var(--bg-surface)', borderRadius: 'var(--r-sm)',
            }}>
              <code style={{ font: '800 11px/1 var(--f-mono)', color: 'var(--wine)' }}>HS {g.code}</code>
              <div style={{ font: '500 11.5px/1.3 var(--f-sans)', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {Array.from(g.descriptions).join(' · ')}
              </div>
              <div style={{ font: '600 10.5px/1 var(--f-mono)', color: 'var(--ink-soft)', textAlign: 'right' }}>
                {g.count} pkg · {g.boxes} cj · {g.weight.toLocaleString()}kg
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 8, font: '500 11px/1.4 var(--f-sans)', color: 'var(--info)' }}>
          ✓ Cada paquete viaja con su HS code + descripción al alcance del chofer (app transportista · vista detalle). Si te detienen, mostrás el resumen al fiscal.
        </div>
      </div>
    );
  }

  // ── Mini progress bar para capacidad ─────────────────────────
  function CapBar({ label, pct, current, max }) {
    const over = pct > 100;
    const high = pct > 85;
    const color = over ? 'var(--danger)' : high ? 'var(--warning)' : 'var(--success)';
    const display = Math.min(100, pct);
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', font: '600 9.5px/1 var(--f-sans)', color: 'var(--ink-soft)', marginBottom: 2 }}>
          <span>{label} · <span style={{ color, fontWeight: 800 }}>{Math.round(pct)}%</span></span>
          <span className="mono" style={{ font: '700 10px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>{current} / {max}</span>
        </div>
        <div style={{ height: 4, background: 'var(--bg-surface)', borderRadius: 999, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${display}%`, background: color, borderRadius: 999, transition: 'width var(--dur) var(--ease)' }} />
        </div>
      </div>
    );
  }

  // ── Dispatch Assignment Modal ────────────────────────────────
  function DispatchAssignmentModal({ batchIds, rows, routes, trucks, drivers, onClose, onConfirm }) {
    const U = window.ERPUI;
    const I = window.Icon;
    const batch = rows.filter(r => batchIds.includes(r.order));
    const activeRoutes = routes.filter(r => r.active);
    const totalKg  = batch.reduce((s, p) => s + (p.weightKg || 0), 0);
    const totalCBM = batch.reduce((s, p) => s + (p.volumeCBM || 0), 0);

    // Pre-select: ruta que cubre la mayoría de paquetes del batch
    const initialRoute = useMemo(() => {
      let best = activeRoutes[0];
      let bestCount = 0;
      for (const r of activeRoutes) {
        const elig = batch.filter(p => {
          if (r.type === 'directa') return p.city === r.destination;
          return p.city === r.destination || r.stops.some(s => s.city === p.city && p.distanceToStopKm != null && p.distanceToStopKm <= s.radiusKm);
        }).length;
        if (elig > bestCount) { bestCount = elig; best = r; }
      }
      return best;
    }, [batch, activeRoutes]);

    const [routeId, setRouteId] = useState(initialRoute?.id || '');
    const [truckId, setTruckId] = useState('');
    const [driverId, setDriverId] = useState('');

    const route  = routes.find(r => r.id === routeId);
    const truck  = trucks.find(t => t.id === truckId);
    const driver = drivers.find(d => d.id === driverId);

    // Hub esperado: el origen de la ruta (siempre Valencia hoy)
    const expectedHub = 'Valencia';
    const ready = !!routeId && !!truckId && !!driverId;

    return (
      <U.Modal
        open
        onClose={onClose}
        title="Enviar lote al almacenista"
        width={680}
        actions={
          <React.Fragment>
            <U.Btn variant="ghost" onClick={onClose}>Cancelar</U.Btn>
            <U.Btn variant="primary" icon={I.truck(13)} onClick={() => onConfirm({ routeId, truckId, driverId })} disabled={!ready}>
              Confirmar y enviar al almacenista
            </U.Btn>
          </React.Fragment>
        }
      >
        <BatchSummary batch={batch} />
        <SENIATSummary batch={batch} />

        {/* ── Ruta ── */}
        <FieldGroup label="1. Asignar ruta">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6 }}>
            {activeRoutes.map(r => {
              const elig = batch.filter(p => {
                if (r.type === 'directa') return p.city === r.destination;
                return p.city === r.destination || r.stops.some(s => s.city === p.city && p.distanceToStopKm != null && p.distanceToStopKm <= s.radiusKm);
              }).length;
              const sel = routeId === r.id;
              const cov = batch.length > 0 ? Math.round(elig / batch.length * 100) : 0;
              return (
                <button key={r.id} onClick={() => setRouteId(r.id)} style={{
                  padding: '10px 12px', textAlign: 'left',
                  background: sel ? 'var(--wine-tint)' : 'var(--bg-elevated)',
                  border: `1px solid ${sel ? 'var(--wine)' : 'transparent'}`,
                  borderRadius: 'var(--r-md)', cursor: 'pointer',
                  display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center',
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                      <code style={{ font: '800 11.5px/1 var(--f-mono)', color: sel ? 'var(--wine)' : 'var(--ink-soft)' }}>{r.id}</code>
                      <div style={{ font: '700 13px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{r.name}</div>
                      <span style={{
                        padding: '1px 6px', borderRadius: 'var(--r-sm)',
                        background: r.type === 'directa' ? 'var(--info-bg)' : 'var(--warning-bg)',
                        color:      r.type === 'directa' ? 'var(--info)'    : 'var(--warning)',
                        font: '800 9px/1 var(--f-sans)', letterSpacing: '0.1em', textTransform: 'uppercase',
                      }}>{r.type === 'directa' ? 'Directa' : `${r.stops.length} ciudades`}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ font: '900 15px/1 var(--f-display)', color: cov === 100 ? 'var(--success)' : cov >= 50 ? 'var(--wine)' : 'var(--ink-mute)', letterSpacing: '-0.02em' }}>{cov}%</div>
                    <div style={{ font: '600 10px/1 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 2 }}>cobertura</div>
                  </div>
                </button>
              );
            })}
          </div>
        </FieldGroup>

        {/* ── Camión ── */}
        <FieldGroup label="2. Asignar camión">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {trucks.map(tr => {
              const sel = truckId === tr.id;
              const matchHub = tr.hub === expectedHub;
              const available = tr.status === 'disponible';
              const kgUse  = totalKg / tr.capacityKg;
              const cbmUse = totalCBM / tr.capacityCBM;
              const overflowsKg  = kgUse  > 1;
              const overflowsCBM = cbmUse > 1;
              const fits = !overflowsKg && !overflowsCBM;
              return (
                <button key={tr.id} onClick={() => setTruckId(tr.id)} disabled={!available} style={{
                  padding: '10px 12px', textAlign: 'left',
                  background: sel ? 'var(--wine-tint)' : !fits ? 'var(--danger-bg)' : 'var(--bg-elevated)',
                  border: `1px solid ${sel ? 'var(--wine)' : !fits ? 'var(--danger)' : 'transparent'}`,
                  borderRadius: 'var(--r-md)', cursor: available ? 'pointer' : 'not-allowed',
                  opacity: available ? 1 : 0.4,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <code style={{ font: '800 11px/1 var(--f-mono)', color: sel ? 'var(--wine)' : 'var(--ink-soft)' }}>{tr.id}</code>
                    <div style={{ font: '700 12.5px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{tr.plate}</div>
                    {!fits && <span style={{ marginLeft: 'auto', font: '800 9.5px/1 var(--f-sans)', color: 'var(--danger)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>⚠ No entra</span>}
                    {fits && totalKg > 0 && <span style={{ marginLeft: 'auto', font: '800 9.5px/1 var(--f-sans)', color: 'var(--success)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>✓ Entra</span>}
                  </div>
                  <div style={{ font: '500 11px/1.3 var(--f-sans)', color: 'var(--ink-soft)', marginBottom: 6 }}>{tr.label} · {(tr.capacityKg/1000).toFixed(0)}t · {tr.capacityCBM}m³</div>
                  {totalKg > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 4 }}>
                      <CapBar label="Peso"   pct={kgUse * 100}  current={`${(totalKg/1000).toFixed(1)}t`}  max={`${(tr.capacityKg/1000).toFixed(0)}t`} />
                      <CapBar label="Volumen" pct={cbmUse * 100} current={`${totalCBM.toFixed(1)}m³`} max={`${tr.capacityCBM}m³`} />
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2, font: '600 10.5px/1 var(--f-sans)' }}>
                    <span style={{ color: matchHub ? 'var(--success)' : 'var(--warning)' }}>{matchHub ? '✓' : '⚠'} {tr.hub}</span>
                    <span style={{ color: 'var(--ink-mute)' }}>·</span>
                    <span style={{ color: available ? 'var(--success)' : 'var(--ink-mute)', textTransform: 'capitalize' }}>{tr.status}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </FieldGroup>

        {/* ── Chofer ── */}
        <FieldGroup label="3. Asignar chofer">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {drivers.map(d => {
              const sel = driverId === d.id;
              const matchHub = d.hub === expectedHub;
              const available = d.status === 'disponible';
              return (
                <button key={d.id} onClick={() => setDriverId(d.id)} disabled={!available} style={{
                  padding: '9px 11px', textAlign: 'left',
                  background: sel ? 'var(--wine-tint)' : 'var(--bg-elevated)',
                  border: `1px solid ${sel ? 'var(--wine)' : 'transparent'}`,
                  borderRadius: 'var(--r-md)', cursor: available ? 'pointer' : 'not-allowed',
                  opacity: available ? 1 : 0.4,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 2 }}>
                    <div style={{ font: '700 12.5px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{d.name}</div>
                    <span style={{ font: '800 11px/1 var(--f-mono)', color: 'var(--warning)' }}>★ {d.rating}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, font: '600 10.5px/1 var(--f-sans)' }}>
                    <span style={{ color: matchHub ? 'var(--success)' : 'var(--warning)' }}>{matchHub ? '✓' : '⚠'} {d.hub}</span>
                    <span style={{ color: 'var(--ink-mute)' }}>·</span>
                    <span style={{ color: 'var(--ink-soft)' }}>{d.trips30d} viajes/30d</span>
                    <span style={{ color: 'var(--ink-mute)' }}>·</span>
                    <span style={{ color: available ? 'var(--success)' : 'var(--ink-mute)', textTransform: 'capitalize' }}>{d.status}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </FieldGroup>

        {ready && (
          <div style={{
            marginTop: 14, padding: '12px 14px',
            background: 'var(--success-bg)', color: 'var(--success)',
            borderRadius: 'var(--r-md)',
            font: '500 12px/1.5 var(--f-sans)',
            display: 'flex', alignItems: 'flex-start', gap: 8,
          }}>
            <span style={{ marginTop: 1, flexShrink: 0 }}>{I.check(14)}</span>
            <span>
              <b>Listo para enviar:</b> {batch.length} paquetes ejecutarán la ruta <b>{route.id}</b> en el camión <b>{truck.plate}</b> ({truck.label}) con <b>{driver.name}</b> al volante.
            </span>
          </div>
        )}
      </U.Modal>
    );
  }

  function FieldGroup({ label, children }) {
    return (
      <div style={{ marginBottom: 12 }}>
        <div style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>{label}</div>
        {children}
      </div>
    );
  }


  // ── Active Orders Panel ──────────────────────────────────────
  function ActiveOrdersPanel({ orders, routes, trucks, drivers, onAdvance, onContact }) {
    const U = window.ERPUI;
    const I = window.Icon;
    const [open, setOpen] = useState(true);
    const active = orders.filter(o => o.status !== 'cerrada' && o.status !== 'entregada');
    const recent = orders.filter(o => o.status === 'entregada' || o.status === 'cerrada').slice(0, 2);

    return (
      <div style={{ marginBottom: 'var(--s-6)' }}>
        <button onClick={() => setOpen(!open)} style={{
          width: '100%', padding: '12px 16px',
          background: 'var(--bg-surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--r-lg)' + (open ? ' var(--r-lg) 0 0' : ''),
          borderBottom: open && (active.length + recent.length > 0) ? 'none' : '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          textAlign: 'left',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{
              width: 32, height: 32, borderRadius: 'var(--r-md)',
              background: 'var(--wine-tint)', color: 'var(--wine)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}>{I.truck(16)}</span>
            <div>
              <div style={{ font: '800 13.5px/1.1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.01em' }}>
                Órdenes de despacho activas
              </div>
              <div style={{ font: '500 11.5px/1.3 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 3 }}>
                {active.length} activa{active.length === 1 ? '' : 's'} · {recent.length} completada{recent.length === 1 ? '' : 's'} hoy
              </div>
            </div>
          </div>
          <span style={{ color: 'var(--ink-soft)', transform: `rotate(${open ? 180 : 0}deg)`, transition: 'transform var(--dur) var(--ease)' }}>{I.chevD(15)}</span>
        </button>
        {open && (
          <div style={{
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            borderTop: 'none', borderRadius: '0 0 var(--r-lg) var(--r-lg)',
            padding: '8px 12px 14px',
          }}>
            {[...active, ...recent].map(o => (
              <OrderRow key={o.id} order={o}
                truck={trucks.find(t => t.id === o.truckId)}
                driver={drivers.find(d => d.id === o.driverId)}
                route={routes.find(r => r.id === o.routeId)}
                onAdvance={() => onAdvance(o.id)}
                onContact={() => onContact(o)}
              />
            ))}
            {(active.length + recent.length) === 0 && (
              <div style={{ padding: 18, textAlign: 'center', font: '500 12px/1.5 var(--f-sans)', color: 'var(--ink-mute)' }}>
                Todavía no hay órdenes hoy. Seleccioná paquetes y enviá al almacenista.
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  function OrderRow({ order, truck, driver, route, onAdvance, onContact }) {
    const U = window.ERPUI;
    const I = window.Icon;
    const st = ORDER_STATUS[order.status];
    const kgPct  = (order.totalKg  / order.capacityKg)  * 100;
    const cbmPct = (order.totalCBM / order.capacityCBM) * 100;
    const live = order.status === 'en-ruta';
    return (
      <div style={{
        padding: '12px 14px', marginTop: 6,
        background: 'var(--bg-elevated)',
        border: live ? `1px solid var(--${st.tone})` : '1px solid transparent',
        borderRadius: 'var(--r-md)',
        display: 'grid', gridTemplateColumns: '32px 130px 1fr auto auto', gap: 14, alignItems: 'center',
      }}>
        <div style={{
          width: 30, height: 30, borderRadius: '50%',
          background: `var(--${st.tone}-bg)`, color: `var(--${st.tone})`,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative',
        }}>
          {I[st.icon] ? I[st.icon](13) : I.box(13)}
          {live && <span style={{
            position: 'absolute', inset: -3,
            border: `2px solid var(--${st.tone})`, borderRadius: '50%',
            animation: 'erp-shimmer 1.6s ease-out infinite',
          }} />}
        </div>
        <div>
          <code style={{ font: '800 11.5px/1 var(--f-mono)', color: 'var(--ink)' }}>{order.id}</code>
          <div style={{ marginTop: 4 }}>
            <U.Badge tone={st.tone} size="sm" dot>{st.label}</U.Badge>
          </div>
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ font: '700 12.5px/1.2 var(--f-sans)', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {route ? route.name : '—'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, font: '500 11px/1 var(--f-sans)', color: 'var(--ink-soft)' }}>
            <span>{truck ? truck.plate : '—'}</span>
            <span style={{ color: 'var(--ink-mute)' }}>·</span>
            <span>{driver ? driver.name.split(' ')[0] : '—'}</span>
            <span style={{ color: 'var(--ink-mute)' }}>·</span>
            <span>{order.packageCount} pkg</span>
            <span style={{ color: 'var(--ink-mute)' }}>·</span>
            <span className="mono" style={{ font: '600 11px/1 var(--f-mono)' }}>{(order.totalKg/1000).toFixed(1)}t · {order.totalCBM.toFixed(1)}m³</span>
          </div>
          {live && (
            <div style={{ marginTop: 6, height: 3, background: 'var(--bg-surface)', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${order.progress}%`, background: `var(--${st.tone})`, borderRadius: 999 }} />
            </div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
          <CapMini label="kg"  pct={kgPct} />
          <CapMini label="m³"  pct={cbmPct} />
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <U.Btn variant="ghost" size="sm" icon={I.bell(12)} onClick={onContact}>Contactar</U.Btn>
          {st.next && <U.Btn variant="soft" size="sm" icon={I.arrowR(12)} onClick={onAdvance}>→ {ORDER_STATUS[st.next].label}</U.Btn>}
        </div>
      </div>
    );
  }

  function CapMini({ label, pct }) {
    const color = pct > 100 ? 'var(--danger)' : pct > 85 ? 'var(--warning)' : 'var(--success)';
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, font: '600 10px/1 var(--f-sans)', color: 'var(--ink-soft)' }}>
        <span style={{ width: 28, textAlign: 'right' }}>{label}</span>
        <div style={{ width: 50, height: 4, background: 'var(--bg-surface)', borderRadius: 999, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${Math.min(100, pct)}%`, background: color }} />
        </div>
        <span style={{ width: 30, textAlign: 'right', color, fontWeight: 800 }}>{Math.round(pct)}%</span>
      </div>
    );
  }

  // ── Contact Driver Modal ─────────────────────────────────────
  function ContactDriverModal({ order, truck, driver, route, onClose, onSendPush }) {
    const U = window.ERPUI;
    const I = window.Icon;
    return (
      <U.Modal
        open
        onClose={onClose}
        title={`Contactar a ${driver ? driver.name : 'transportista'}`}
        width={460}
        actions={<U.Btn variant="ghost" onClick={onClose}>Cerrar</U.Btn>}
      >
        <div style={{ marginBottom: 14, padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)' }}>
          <code style={{ font: '800 11px/1 var(--f-mono)', color: 'var(--ink)' }}>{order.id}</code>
          <div style={{ marginTop: 6, font: '600 12.5px/1.3 var(--f-sans)', color: 'var(--ink)' }}>
            {route ? route.name : '—'}
          </div>
          <div style={{ marginTop: 3, font: '500 11px/1 var(--f-sans)', color: 'var(--ink-soft)' }}>
            {truck?.plate} · {driver?.name}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <ContactBtn icon={I.bell(20)}  label="Llamar"   tone="wine"    onClick={() => onSendPush('llamada iniciada')} />
          <ContactBtn icon={I.mail(20)}  label="WhatsApp" tone="success" onClick={() => onSendPush('WhatsApp abierto')} />
          <ContactBtn icon={I.spark(20)} label="Push"     tone="info"    onClick={() => onSendPush(driver?.name + ' (push)')} />
        </div>
        <div style={{ marginTop: 12, padding: '8px 10px', background: 'var(--info-bg)', color: 'var(--info)', borderRadius: 'var(--r-sm)', font: '500 11px/1.4 var(--f-sans)', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
          <span style={{ marginTop: 1, flexShrink: 0 }}>{I.info(11)}</span>
          <span>El push va al app del transportista. Si tiene GPS off, le aparece la alerta y le pedimos encenderlo.</span>
        </div>
      </U.Modal>
    );
  }

  function ContactBtn({ icon, label, tone, onClick }) {
    return (
      <button onClick={onClick} style={{
        padding: '14px 8px', borderRadius: 'var(--r-md)',
        background: `var(--${tone}-bg)`, color: `var(--${tone})`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
        font: '800 12px/1 var(--f-sans)',
      }}>{icon}{label}</button>
    );
  }

  // Expose
  window.ModuleDespacho = ModuleDespacho;
})();
