/* global React */
/* ── DTD ERP · Despacho · Vista 2 (Config Reglas de Prioridad) ─ */
/* Patrón Stripe/Linear: cada regla = card con header siempre      */
/* visible (switch + resumen + chevron) y body plegable.           */

(function () {
  const { useState, useMemo, useEffect } = React;

  // ── Puntos por regla (defaults) ───────────────────────────────
  const DEFAULTS = {
    valencia:   { value: 40, max: 50, label: 'Bonus HQ · Valencia',    desc: 'Puntos cuando el destino es Valencia (donde está la bodega DTD). Cuando integremos Rutas, este peso queda dentro de la lógica de cobertura.' },
    fullPay:    { value: 30, max: 50, label: 'Pagado 100%',            desc: 'Puntos cuando la factura del paquete está saldada.' },
    partialPay: { value: 15, max: 30, label: 'Abono',                   desc: 'Puntos cuando el cliente abonó pero no completó. Debe ser menor a Pagado 100%.' },
    fifo:       { value: 15, max: 25, label: 'FIFO antigüedad',        desc: 'Lineal entre 0 y este máximo según los días en bodega (21+ días = máximo).' },
    vip:        { value: 10, max: 20, label: 'Cliente Gold / Platinum',desc: 'Puntos para clientes Gold o Platinum. Se controla con la regla Tier.' },
    routeProx:  { value: 5,  max: 15, label: 'Cercanía ruta del día',  desc: 'Puntos 0–5 según qué tan cerca está el paquete de la ruta del camión del día. Será reemplazado por la regla Rutas.' },
  };

  // ── Presets (solo 2 quedan; Foco comercial / Ruta eficiente se fueron) ─
  const PRESETS = [
    { id: 'equilibrado',   name: 'Equilibrado',   desc: 'El default DTD-Cargo. Buen balance entre HQ, pago y antigüedad.',
      values: { valencia: 40, fullPay: 30, partialPay: 15, fifo: 15, vip: 10, routeProx: 5 } },
    { id: 'fifo-estricto', name: 'FIFO estricto', desc: 'Lo más viejo en bodega primero. Menos peso a HQ.',
      values: { valencia: 20, fullPay: 25, partialPay: 10, fifo: 25, vip: 10, routeProx: 10 } },
  ];

  // ── Política Pago primero (anclada) ───────────────────────────
  const POLICY_MODES = [
    { id: 'strict', label: 'Estricto',         tone: 'wine',    short: 'Sin pago = no despacha.',     desc: 'Modo por defecto. Bloquea automáticamente paquetes con abono o pendiente. Solo se despachan cuando la factura está saldada.' },
    { id: 'hold',   label: 'En hold temporal', tone: 'warning', short: 'Pausada hasta fecha.',         desc: 'Suspende la política temporalmente — útil en fin de mes, feriados, o si SENIAT está demorando. Vencida la fecha vuelve a Estricto.' },
    { id: 'credit', label: 'Crédito permitido', tone: 'danger',  short: 'Solo clientes en whitelist.',  desc: 'Excepción: permite despachar sin pago a una lista corta de clientes con crédito aprobado por dirección. El resto sigue bloqueado.' },
  ];
  const CREDIT_CANDIDATES = [
    { markbox: 'DTD-5392', name: 'Luis Fernández',  company: 'Industrias Polar SA',  tier: 'Platinum' },
    { markbox: 'DTD-5354', name: 'Roberto Castro',  company: 'Castro Hermanos CA',   tier: 'Gold' },
    { markbox: 'DTD-5452', name: 'Carlos Méndez',   company: 'Acindar Comercial CA', tier: 'Gold' },
    { markbox: 'DTD-5241', name: 'José Hernández',  company: 'Industrias Hernández', tier: 'Gold' },
    { markbox: 'DTD-5277', name: 'Andrés Briceño',  company: 'BriceñoTex',           tier: 'Gold' },
  ];

  // ── Clientes Gold / Platinum (editor de Tier) ─────────────────
  const TIER_CLIENTS = [
    { markbox: 'DTD-5392', name: 'Luis Fernández', company: 'Industrias Polar SA',   tier: 'Platinum', city: 'Caracas',      shipments: 41, since: '2017-06' },
    { markbox: 'DTD-5452', name: 'Carlos Méndez',  company: 'Acindar Comercial CA',  tier: 'Gold',     city: 'Valencia',     shipments: 24, since: '2019-03' },
    { markbox: 'DTD-5354', name: 'Roberto Castro', company: 'Castro Hermanos CA',    tier: 'Gold',     city: 'Punto Fijo',   shipments: 33, since: '2018-02' },
    { markbox: 'DTD-5241', name: 'José Hernández', company: 'Industrias Hernández',  tier: 'Gold',     city: 'Maturín',      shipments: 28, since: '2018-11' },
    { markbox: 'DTD-5277', name: 'Andrés Briceño', company: 'BriceñoTex Manuf.',     tier: 'Gold',     city: 'Barquisimeto', shipments: 19, since: '2018-09' },
  ];

  // ── Rutas (preview read-only en este card; CRUD en Admin → Rutas) ─
  const MOCK_ROUTES = [
    { id: 'R-001', type: 'directa',     hub: 'Valencia', destination: 'Caracas',   stops: [], active: true  },
    { id: 'R-002', type: 'con-paradas', hub: 'Valencia', destination: 'Caracas',   stops: [{ city: 'Maracay', radiusKm: 20 }, { city: 'San Juan de los Morros', radiusKm: 15 }], active: true  },
    { id: 'R-003', type: 'directa',     hub: 'Valencia', destination: 'Maracaibo', stops: [], active: true  },
    { id: 'R-004', type: 'con-paradas', hub: 'Valencia', destination: 'Maracaibo', stops: [{ city: 'Barquisimeto', radiusKm: 30 }, { city: 'Coro', radiusKm: 25 }], active: false },
  ];

  // ── Samples (preview en vivo) ─────────────────────────────────
  const SAMPLES = [
    { id: 's1', order: 'DTD-2026-0151', client: 'Luis Fernández', markbox: 'DTD-5392', city: 'Caracas',  pay: 'pagado',    days: 8,  tier: 'Platinum', routeProx: 3 },
    { id: 's2', order: 'DTD-2026-0142', client: 'Carlos Méndez',  markbox: 'DTD-5452', city: 'Valencia', pay: 'pagado',    days: 18, tier: 'Gold',     routeProx: 5 },
    { id: 's3', order: 'DTD-2026-0144', client: 'Sofía Linares',  markbox: 'DTD-5263', city: 'Caracas',  pay: 'pendiente', days: 19, tier: null,       routeProx: 3 },
    { id: 's4', order: 'DTD-2026-0140', client: 'José Hernández', markbox: 'DTD-5241', city: 'Maturín',  pay: 'pagado',    days: 28, tier: 'Gold',     routeProx: 1 },
  ];
  const isVip = (p) => p.tier === 'Gold' || p.tier === 'Platinum';

  // ── Scoring (motor) ───────────────────────────────────────────
  function scorePkg(p, w, rules) {
    rules = rules || { tier: true };
    const lines = [];
    let total = 0;
    if (p.city === 'Valencia') { lines.push({ key: 'valencia', label: 'Bonus HQ · Valencia', pts: w.valencia }); total += w.valencia; }
    if (p.pay === 'pagado')    { lines.push({ key: 'fullPay',  label: 'Pagado 100%',         pts: w.fullPay });  total += w.fullPay; }
    else if (p.pay === 'parcial') { lines.push({ key: 'partialPay', label: 'Abono',          pts: w.partialPay }); total += w.partialPay; }
    else { lines.push({ key: 'noPay', label: 'Sin pago', pts: 0, muted: true }); }
    const fifoPts = Math.min(w.fifo, Math.round((p.days / 21) * w.fifo));
    lines.push({ key: 'fifo', label: `FIFO antigüedad · ${p.days}d`, pts: fifoPts, hint: `${fifoPts}/${w.fifo}` });
    total += fifoPts;
    if (isVip(p)) {
      if (rules.tier) { lines.push({ key: 'vip', label: `Cliente ${p.tier}`, pts: w.vip }); total += w.vip; }
      else            { lines.push({ key: 'vip', label: `Cliente ${p.tier} · regla desactivada`, pts: 0, muted: true, strike: true }); }
    }
    const routePts = Math.min(w.routeProx, p.routeProx);
    lines.push({ key: 'route', label: `Cercanía ruta · ${p.routeProx}/5`, pts: routePts, hint: `${routePts}/${w.routeProx}` });
    total += routePts;
    return { total: Math.min(100, total), lines };
  }

  function priorityLevel(score) {
    if (score >= 80) return { label: 'Crítico', tone: 'danger' };
    if (score >= 65) return { label: 'Alto',    tone: 'wine' };
    if (score >= 45) return { label: 'Medio',   tone: 'warning' };
    return { label: 'Bajo', tone: 'neutral' };
  }

  function daysUntil(iso) {
    const target = new Date(iso);
    const now = new Date('2026-05-25');
    return Math.max(0, Math.round((target - now) / 86400000));
  }

  // ──────────────────────────────────────────────────────────────
  // MAIN
  // ──────────────────────────────────────────────────────────────
  function ModuleDespachoRules({ goTo }) {
    const U = window.ERPUI;
    const I = window.Icon;

    const [weights, setWeights] = useState(() => {
      if (window.DTDData) {
        const saved = window.DTDData.rules.read();
        if (saved && saved.weights) return saved.weights;
      }
      const init = {}; for (const k of Object.keys(DEFAULTS)) init[k] = DEFAULTS[k].value; return init;
    });
    const [tenant, setTenant] = useState('dtd-ca');
    const [sample, setSample] = useState(SAMPLES[0]);
    const [dirty, setDirty]   = useState(false);
    const [toast, setToast]   = useState(null);

    const [policy, setPolicy] = useState({
      mode: 'strict',
      holdUntil: '2026-06-15',
      holdReason: 'Cierre fiscal Q2 · contabilidad revisando facturación.',
      creditClients: ['DTD-5392', 'DTD-5354'],
    });
    function setPolicyMode(mode) { setPolicy({ ...policy, mode }); setDirty(true); }
    function setPolicyField(field, val) { setPolicy({ ...policy, [field]: val }); setDirty(true); }
    function toggleCreditClient(mb) {
      const next = policy.creditClients.includes(mb) ? policy.creditClients.filter(x => x !== mb) : [...policy.creditClients, mb];
      setPolicy({ ...policy, creditClients: next }); setDirty(true);
    }

    const [optionalRules, setOptionalRules] = useState({ tier: true, routes: true });
    function toggleRule(key) { setOptionalRules({ ...optionalRules, [key]: !optionalRules[key] }); setDirty(true); }

    // Estado de plegado de cada card. Por default: Política colapsada,
    // Tier colapsada, Rutas colapsada. El usuario abre lo que necesita.
    const [openCards, setOpenCards] = useState({ policy: false, tier: false, routes: false });
    function toggleCard(k) { setOpenCards({ ...openCards, [k]: !openCards[k] }); }

    useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); }, [toast]);

    const totalMax = useMemo(() => Object.values(weights).reduce((s, v) => s + v, 0), [weights]);
    const valid    = totalMax <= 100;
    const overBy   = totalMax - 100;

    function setW(k, v) { setWeights({ ...weights, [k]: v }); setDirty(true); }
    function applyPreset(p) { setWeights({ ...p.values }); setDirty(true); }
    function restoreDefaults() {
      const def = {}; for (const k of Object.keys(DEFAULTS)) def[k] = DEFAULTS[k].value;
      setWeights(def); setDirty(false); setToast('Pesos por defecto restaurados');
    }
    function save() {
      if (!valid) return;
      setDirty(false);
      // Persistir al bridge para que Vista 1 las use
      if (window.DTDData) {
        window.DTDData.rules.write({
          weights, policy, optionalRules, tenant,
          savedAt: new Date().toISOString(),
        });
      }
      setToast(`Reglas guardadas para ${tenant === 'dtd-ca' ? 'DTD-Cargo CA' : tenant}`);
    }

    // ── Policy evaluation (en vivo) ─────────────────────────────
    function evaluatePolicy(p) {
      if (p.pay === 'pagado') return { state: 'ok', reason: 'Pago saldado · sin restricción.' };
      if (policy.mode === 'strict') return { state: 'blocked', reason: `Política Pago primero (estricta) — ${p.pay === 'parcial' ? 'abono' : p.pay} no permitido. El paquete queda fuera de la cola hasta saldar.` };
      if (policy.mode === 'hold')   return { state: 'hold',    reason: `Política en hold hasta ${policy.holdUntil}. El paquete entra a la cola con score normal pero quedará marcado.` };
      if (policy.mode === 'credit') {
        if (policy.creditClients.includes(p.markbox)) return { state: 'credit-ok', reason: `Cliente con crédito aprobado · excepción permitida.` };
        return { state: 'blocked', reason: `Cliente ${p.markbox} no está en la whitelist de crédito. ${p.pay === 'parcial' ? 'Abono' : 'Pago pendiente'} bloqueado.` };
      }
      return { state: 'ok' };
    }

    const policyEval = useMemo(() => evaluatePolicy(sample), [sample, policy]);
    const result  = useMemo(() => scorePkg(sample, weights, optionalRules), [sample, weights, optionalRules]);
    const prio    = priorityLevel(result.total);
    const blocked = policyEval.state === 'blocked';

    const activePreset = useMemo(() => PRESETS.find(p => Object.keys(p.values).every(k => p.values[k] === weights[k])), [weights]);

    // ── Resúmenes del header de cada card ────────────────────────
    const policySummary = useMemo(() => {
      const m = POLICY_MODES.find(x => x.id === policy.mode);
      if (policy.mode === 'hold')   return `Modo: ${m.label} · vence en ${daysUntil(policy.holdUntil)}d`;
      if (policy.mode === 'credit') return `Modo: ${m.label} · ${policy.creditClients.length} clientes en whitelist`;
      return `Modo: ${m.label}`;
    }, [policy]);
    const tierSummary = useMemo(() => {
      if (!optionalRules.tier) return 'Regla desactivada';
      const p = TIER_CLIENTS.filter(c => c.tier === 'Platinum').length;
      const g = TIER_CLIENTS.filter(c => c.tier === 'Gold').length;
      return `${TIER_CLIENTS.length} clientes · ${p} Plat · ${g} Gold · +${weights.vip} pts c/u`;
    }, [optionalRules.tier, weights.vip]);
    const routesSummary = useMemo(() => {
      if (!optionalRules.routes) return 'Regla desactivada';
      const act = MOCK_ROUTES.filter(r => r.active).length;
      const cp  = MOCK_ROUTES.filter(r => r.type === 'con-paradas').length;
      const dir = MOCK_ROUTES.filter(r => r.type === 'directa').length;
      return `${act} activas · ${dir} directas · ${cp} con ciudades`;
    }, [optionalRules.routes]);

    return (
      <div>
        <U.PageHeader
          eyebrow="CONFIGURACIÓN · DESPACHO"
          title="Reglas de Prioridad"
          subtitle="Cada regla es una card plegable con su propio switch. Apagás sin abrir; abrís para configurar."
          breadcrumbs={[
            { label: 'Despacho', onClick: () => goTo && goTo('despacho') },
            { label: 'Reglas de prioridad' },
          ]}
          actions={
            <React.Fragment>
              <U.Select value={tenant} onChange={(e) => setTenant(e.target.value)} style={{ width: 220 }} options={[
                { value: 'dtd-ca',    label: 'DTD-Cargo CA · Caracas' },
                { value: 'dtd-zulia', label: 'DTD-Cargo Zulia · Maracaibo' },
                { value: 'dtd-occ',   label: 'DTD-Cargo Occidente · Pto Fijo' },
              ]} />
              <U.Btn variant="ghost" size="md" icon={I.refresh(14)} onClick={restoreDefaults}>Restaurar defaults</U.Btn>
              <U.Btn variant="primary" size="md" icon={I.check(14)} onClick={save} disabled={!valid || !dirty}>Guardar cambios</U.Btn>
            </React.Fragment>
          }
        />

        {/* ── Presets ─────────────────────────────────────────── */}
        <SectionTitle>Presets rápidos</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 'var(--s-6)' }}>
          {PRESETS.map(p => {
            const active = activePreset?.id === p.id;
            return (
              <button key={p.id} onClick={() => applyPreset(p)} style={{
                padding: 'var(--s-4)', textAlign: 'left',
                background: active ? 'var(--wine-tint)' : 'var(--bg-surface)',
                border: `1px solid ${active ? 'var(--wine)' : 'var(--border)'}`,
                borderRadius: 'var(--r-lg)',
                boxShadow: active ? '0 0 0 3px var(--wine-tint)' : 'var(--shadow-xs)',
                cursor: 'pointer', transition: 'all var(--dur-fast) var(--ease)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <div style={{ font: '800 13.5px/1.1 var(--f-display)', color: active ? 'var(--wine)' : 'var(--ink)', letterSpacing: '-0.01em' }}>{p.name}</div>
                  {active && <span style={{ color: 'var(--wine)' }}>{I.check(12)}</span>}
                </div>
                <div style={{ font: '500 11.5px/1.4 var(--f-sans)', color: 'var(--ink-soft)' }}>{p.desc}</div>
              </button>
            );
          })}
        </div>

        {/* ── Política maestra (anclada, plegable) ────────────── */}
        <SectionTitle>Política maestra</SectionTitle>
        <CollapsibleCard
          icon={I.lock(20)} iconTone="wine"
          title="Pago primero"
          tag={{ label: 'Anclada', tone: 'wine' }}
          summary={policySummary}
          locked
          open={openCards.policy}
          onToggleOpen={() => toggleCard('policy')}
        >
          <PolicyEditor
            policy={policy}
            setMode={setPolicyMode}
            setField={setPolicyField}
            toggleCredit={toggleCreditClient}
            candidates={CREDIT_CANDIDATES}
          />
        </CollapsibleCard>

        {/* ── Reglas opcionales (plegables, con switch) ──────── */}
        <SectionTitle>Reglas opcionales</SectionTitle>
        <CollapsibleCard
          icon={I.star(18)} iconTone="warning"
          title="Tier · Gold / Platinum"
          tag={{ label: 'Opcional', tone: 'neutral' }}
          summary={tierSummary}
          switchProps={{ on: optionalRules.tier, onChange: () => toggleRule('tier') }}
          open={openCards.tier}
          onToggleOpen={() => toggleCard('tier')}
          dimmed={!optionalRules.tier}
        >
          <TierEditor enabled={optionalRules.tier} clients={TIER_CLIENTS} points={weights.vip} goTo={goTo} />
        </CollapsibleCard>

        <CollapsibleCard
          icon={I.truck(18)} iconTone="info"
          title="Rutas"
          tag={{ label: 'Opcional', tone: 'neutral' }}
          summary={routesSummary}
          switchProps={{ on: optionalRules.routes, onChange: () => toggleRule('routes') }}
          open={openCards.routes}
          onToggleOpen={() => toggleCard('routes')}
          dimmed={!optionalRules.routes}
        >
          <RoutesPreview enabled={optionalRules.routes} routes={MOCK_ROUTES} goTo={goTo} />
        </CollapsibleCard>

        {/* ── Puntos por regla + Vista previa ─────────────────── */}
        <SectionTitle>Puntos por regla <span style={{ color: 'var(--ink-mute)', textTransform: 'none', letterSpacing: 0, font: '500 11.5px/1 var(--f-sans)' }}>· afinado fino</span></SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.35fr) minmax(0, 1fr)', gap: 'var(--s-6)' }}>
          <SlidersCard
            weights={weights}
            setW={setW}
            totalMax={totalMax}
            valid={valid}
            overBy={overBy}
            optionalRules={optionalRules}
          />
          <PreviewCard
            sample={sample}
            setSample={setSample}
            samples={SAMPLES}
            result={result}
            prio={prio}
            blocked={blocked}
            policy={policy}
            policyEval={policyEval}
            optionalRules={optionalRules}
          />
        </div>

        {/* ── Toast ──────────────────────────────────────────── */}
        {toast && (
          <div style={{
            position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
            background: 'var(--success)', color: '#fff', padding: '12px 20px',
            borderRadius: 'var(--r-md)', boxShadow: 'var(--shadow-lg)', zIndex: 200,
            font: '700 13px/1 var(--f-sans)',
            display: 'inline-flex', alignItems: 'center', gap: 10,
            animation: 'erp-pop 200ms var(--ease)',
          }}>{I.check(16)} {toast}</div>
        )}
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────────
  // CollapsibleCard — patrón Stripe/Linear
  // ──────────────────────────────────────────────────────────────
  function CollapsibleCard({ icon, iconTone = 'wine', title, tag, summary, switchProps, locked, open, onToggleOpen, children, dimmed }) {
    const I = window.Icon;
    const tagTone = (tag && tag.tone) || 'neutral';
    return (
      <div style={{
        marginBottom: 12,
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-lg)',
        boxShadow: 'var(--shadow-xs)',
        overflow: 'hidden',
        transition: 'border-color var(--dur-fast) var(--ease)',
      }}>
        <header
          onClick={onToggleOpen}
          style={{
            display: 'grid',
            gridTemplateColumns: '44px minmax(0, 1fr) auto auto 28px',
            alignItems: 'center', gap: 14,
            padding: '12px 16px',
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          <div style={{
            width: 36, height: 36, borderRadius: 'var(--r-md)',
            background: `var(--${iconTone}-bg)`, color: `var(--${iconTone})`,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}>{icon}</div>

          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ font: '800 14.5px/1.1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
              {tag && (
                <span style={{
                  padding: '2px 7px', borderRadius: 'var(--r-pill)',
                  background: tagTone === 'neutral' ? 'var(--bg-elevated)' : `var(--${tagTone}-bg)`,
                  color: tagTone === 'neutral' ? 'var(--ink-soft)' : `var(--${tagTone})`,
                  font: '800 9.5px/1 var(--f-sans)', letterSpacing: '0.14em', textTransform: 'uppercase',
                  flexShrink: 0,
                }}>{tag.label}</span>
              )}
            </div>
            <div style={{ font: '500 12px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{summary}</div>
          </div>

          <div /> {/* spacer */}

          <div onClick={(e) => e.stopPropagation()}>
            {locked
              ? <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '5px 9px', borderRadius: 'var(--r-pill)',
                  background: 'var(--wine-tint)', color: 'var(--wine)',
                  font: '800 10px/1 var(--f-sans)', letterSpacing: '0.1em', textTransform: 'uppercase',
                }}>{I.lock(11)} Siempre activa</span>
              : <SwitchPill on={switchProps.on} onChange={switchProps.onChange} />
            }
          </div>

          <button onClick={(e) => { e.stopPropagation(); onToggleOpen(); }} aria-label={open ? 'Cerrar' : 'Abrir'} style={{
            width: 28, height: 28, borderRadius: 'var(--r-md)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--ink-soft)',
          }}>
            <span style={{ display: 'inline-block', transform: `rotate(${open ? 180 : 0}deg)`, transition: 'transform var(--dur) var(--ease)' }}>
              {I.chevD(16)}
            </span>
          </button>
        </header>

        {open && (
          <div style={{
            borderTop: '1px solid var(--border)',
            opacity: dimmed ? 0.6 : 1,
            transition: 'opacity var(--dur) var(--ease)',
            animation: 'erp-fade 180ms var(--ease)',
          }}>{children}</div>
        )}
      </div>
    );
  }

  // ── Switch pill (iOV-style) ──────────────────────────────────
  function SwitchPill({ on, onChange }) {
    return (
      <button
        onClick={onChange}
        role="switch"
        aria-checked={on}
        style={{
          position: 'relative',
          width: 40, height: 22, borderRadius: 999,
          background: on ? 'var(--wine)' : 'var(--bg-elevated)',
          border: `1px solid ${on ? 'var(--wine)' : 'var(--border-strong)'}`,
          transition: 'background var(--dur-fast) var(--ease), border-color var(--dur-fast) var(--ease)',
          flexShrink: 0,
        }}>
        <span style={{
          position: 'absolute', top: 2, left: on ? 20 : 2,
          width: 16, height: 16, borderRadius: '50%',
          background: '#fff', boxShadow: 'var(--shadow-sm)',
          transition: 'left var(--dur-fast) var(--ease)',
        }} />
      </button>
    );
  }

  // ── Section title ────────────────────────────────────────────
  function SectionTitle({ children }) {
    return (
      <div style={{
        margin: '20px 4px 10px',
        font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)',
        letterSpacing: '0.14em', textTransform: 'uppercase',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>{children}</div>
    );
  }

  // ──────────────────────────────────────────────────────────────
  // PolicyEditor (cuerpo expandido de Pago primero)
  // ──────────────────────────────────────────────────────────────
  function PolicyEditor({ policy, setMode, setField, toggleCredit, candidates }) {
    const I = window.Icon;
    const U = window.ERPUI;
    const activeMode = POLICY_MODES.find(m => m.id === policy.mode);
    return (
      <React.Fragment>
        <div style={{ padding: '16px 20px 8px' }}>
          <div style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>
            Estado actual de la política
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {POLICY_MODES.map(m => {
              const active = policy.mode === m.id;
              return (
                <button key={m.id} onClick={() => setMode(m.id)} style={{
                  padding: '12px 14px', textAlign: 'left',
                  background: active ? `var(--${m.tone}-bg)` : 'var(--bg-elevated)',
                  border: `1px solid ${active ? `var(--${m.tone})` : 'transparent'}`,
                  borderRadius: 'var(--r-md)',
                  cursor: 'pointer', transition: 'all var(--dur-fast) var(--ease)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <div style={{ font: '800 13px/1.1 var(--f-display)', color: active ? `var(--${m.tone})` : 'var(--ink)', letterSpacing: '-0.01em' }}>{m.label}</div>
                    {active && <span style={{ marginLeft: 'auto', color: `var(--${m.tone})` }}>{I.check(12)}</span>}
                  </div>
                  <div style={{ font: '600 11px/1.3 var(--f-sans)', color: active ? `var(--${m.tone})` : 'var(--ink-soft)' }}>{m.short}</div>
                </button>
              );
            })}
          </div>
          <div style={{
            marginTop: 12, padding: '10px 12px',
            background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)',
            font: '500 12px/1.5 var(--f-sans)', color: 'var(--ink-soft)',
          }}>{activeMode.desc}</div>
        </div>

        {policy.mode === 'hold' && (
          <div style={{ padding: '14px 20px', borderTop: '1px dashed var(--border)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 14 }}>
              <U.Input label="Vence el" type="date" value={policy.holdUntil} onChange={(e) => setField('holdUntil', e.target.value)} mono />
              <U.Input label="Motivo (auditable)" value={policy.holdReason} placeholder="ej: cierre fiscal Q2, feriado, demora SENIAT…" onChange={(e) => setField('holdReason', e.target.value)} />
            </div>
            <div style={{ marginTop: 10, font: '500 11.5px/1.5 var(--f-sans)', color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: 6 }}>
              {I.clock(12)} Quedan <b>{daysUntil(policy.holdUntil)}</b> días — la política vuelve a Estricto automáticamente al vencer.
            </div>
          </div>
        )}

        {policy.mode === 'credit' && (
          <div style={{ padding: '14px 20px', borderTop: '1px dashed var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
              <div>
                <div style={{ font: '800 12.5px/1.1 var(--f-sans)', color: 'var(--ink)' }}>Clientes con crédito aprobado</div>
                <div style={{ font: '500 11.5px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 2 }}>
                  Solo estos clientes pueden despacharse sin pago saldado. El resto sigue bloqueado.
                </div>
              </div>
              <span style={{
                padding: '4px 10px', borderRadius: 'var(--r-pill)',
                background: 'var(--danger-bg)', color: 'var(--danger)',
                font: '800 11px/1 var(--f-sans)', letterSpacing: '0.06em',
              }}>{policy.creditClients.length} {policy.creditClients.length === 1 ? 'cliente' : 'clientes'}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
              {candidates.map(c => {
                const on = policy.creditClients.includes(c.markbox);
                return (
                  <button key={c.markbox} onClick={() => toggleCredit(c.markbox)} style={{
                    padding: '10px 12px', textAlign: 'left',
                    background: on ? 'var(--danger-bg)' : 'var(--bg-elevated)',
                    border: `1px solid ${on ? 'var(--danger)' : 'transparent'}`,
                    borderRadius: 'var(--r-md)', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}>
                    <div style={{
                      width: 18, height: 18, borderRadius: 4,
                      background: on ? 'var(--danger)' : 'var(--bg-surface)',
                      border: `1px solid ${on ? 'var(--danger)' : 'var(--border-strong)'}`,
                      color: '#fff',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>{on ? I.check(12) : null}</div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ font: '700 12.5px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{c.name}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        <code style={{ font: '600 10.5px/1 var(--f-mono)', color: 'var(--wine)' }}>{c.markbox}</code>
                        <span style={{ font: '600 10px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>· {c.tier}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <footer style={{
          padding: '10px 20px',
          background: 'var(--bg-elevated)',
          borderTop: '1px solid var(--border)',
          font: '500 11.5px/1.4 var(--f-sans)', color: 'var(--ink-soft)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          {I.lock(11)}
          <span>La política <b style={{ color: 'var(--ink)' }}>no puede eliminarse</b>. Si necesitas operar sin ella, cambiá el modo a <b>Crédito permitido</b> con excepciones específicas — siempre auditable.</span>
        </footer>
      </React.Fragment>
    );
  }

  // ──────────────────────────────────────────────────────────────
  // TierEditor (cuerpo expandido de Tier)
  // ──────────────────────────────────────────────────────────────
  function TierEditor({ enabled, clients, points, goTo }) {
    const I = window.Icon;
    const [q, setQ] = useState('');
    const filtered = clients.filter(c => {
      if (!q) return true;
      const s = q.toLowerCase();
      return c.name.toLowerCase().includes(s) || c.company.toLowerCase().includes(s) || c.markbox.toLowerCase().includes(s) || c.city.toLowerCase().includes(s);
    });
    return (
      <div style={{ padding: '14px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ font: '800 13px/1.1 var(--f-sans)', color: 'var(--ink)' }}>Clientes elegibles</div>
            <div style={{ font: '500 11.5px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 2 }}>
              Los clientes Gold y Platinum reciben <b style={{ color: 'var(--wine)' }}>+{points} pts</b> al score cuando esta regla está activa. La edición de tier vive en el módulo Clientes.
            </div>
          </div>
          <button onClick={() => goTo && goTo('clients')} style={{
            padding: '7px 12px',
            background: 'transparent', color: 'var(--wine)',
            border: '1px solid var(--border-strong)', borderRadius: 'var(--r-md)',
            font: '700 12px/1 var(--f-sans)',
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>Editar en Clientes →</button>
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          height: 34, padding: '0 12px',
          background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
          marginBottom: 12,
        }}>
          <span style={{ color: 'var(--ink-mute)' }}>{I.search(14)}</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cliente, Shipping Mark, ciudad…"
            style={{ flex: 1, height: '100%', border: 0, outline: 'none', background: 'transparent', font: '500 12.5px/1 var(--f-sans)', color: 'var(--ink)' }} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 8 }}>
          {filtered.map(c => (
            <div key={c.markbox} style={{
              padding: '10px 12px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-md)',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: '700 12.5px/1.2 var(--f-sans)', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                  <code style={{ font: '600 10.5px/1 var(--f-mono)', color: 'var(--wine)' }}>{c.markbox}</code>
                  <span style={{ font: '500 10px/1 var(--f-sans)', color: 'var(--ink-mute)' }}>· {c.city}</span>
                </div>
                <div style={{ font: '500 10.5px/1 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 3 }}>{c.shipments} envíos · desde {c.since}</div>
              </div>
              <TierBadge tier={c.tier} />
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ gridColumn: '1 / -1', padding: 16, textAlign: 'center', font: '500 12px/1 var(--f-sans)', color: 'var(--ink-mute)' }}>
              Sin resultados para “{q}”
            </div>
          )}
        </div>
      </div>
    );
  }

  function TierBadge({ tier }) {
    if (!tier) return null;
    const isPlat = tier === 'Platinum';
    const conf = isPlat
      ? { bg: 'var(--ink)',        fg: 'var(--ink-inv)', dot: 'var(--wine-soft)', label: 'PLAT', border: '1px solid var(--wine)' }
      : { bg: 'var(--warning-bg)', fg: 'var(--warning)', dot: 'var(--warning)',   label: 'GOLD', border: '1px solid transparent' };
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        height: 20, padding: '0 8px',
        background: conf.bg, color: conf.fg, border: conf.border,
        borderRadius: 'var(--r-sm)',
        font: '800 10px/1 var(--f-sans)', letterSpacing: '0.1em', flexShrink: 0,
      }}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: conf.dot }} />
        {conf.label}
      </span>
    );
  }

  // ──────────────────────────────────────────────────────────────
  // RoutesPreview (placeholder · CRUD vive en Admin → Rutas)
  // ──────────────────────────────────────────────────────────────
  function RoutesPreview({ enabled, routes, goTo }) {
    const I = window.Icon;
    return (
      <div style={{ padding: '14px 20px' }}>
        <div style={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          gap: 12, marginBottom: 14, flexWrap: 'wrap',
        }}>
          <div>
            <div style={{ font: '800 13px/1.1 var(--f-sans)', color: 'var(--ink)' }}>Rutas configuradas</div>
            <div style={{ font: '500 11.5px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 2, maxWidth: '60ch' }}>
              Las rutas funcionan como filtros en la cola de despacho. Acá puedes ver el resumen; la creación, edición y catálogo de ciudades vive en <b>Admin → Rutas</b>.
            </div>
          </div>
          <button onClick={() => goTo && goTo('admin-routes')} style={{
            padding: '8px 14px',
            background: 'var(--wine)', color: '#fff',
            border: '1px solid var(--wine)', borderRadius: 'var(--r-md)',
            font: '700 12.5px/1 var(--f-sans)',
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>Administrar rutas →</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {routes.map(r => (
            <RouteRow key={r.id} route={r} />
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
          <span>Una vez integremos el geocoding, la elegibilidad de cada paquete se calculará automáticamente desde la dirección del cliente contra el radio de las paradas.</span>
        </div>
      </div>
    );
  }

  function RouteRow({ route }) {
    const I = window.Icon;
    const isDir = route.type === 'directa';
    return (
      <div style={{
        padding: '10px 14px',
        background: route.active ? 'var(--bg-elevated)' : 'transparent',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-md)',
        opacity: route.active ? 1 : 0.55,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <code style={{ font: '700 11.5px/1 var(--f-mono)', color: 'var(--wine)' }}>{route.id}</code>
              <div style={{ font: '700 13px/1.2 var(--f-sans)', color: 'var(--ink)' }}>
                {route.hub} → {route.destination}
              </div>
              <span style={{
                padding: '2px 7px', borderRadius: 'var(--r-sm)',
                background: isDir ? 'var(--info-bg)' : 'var(--warning-bg)',
                color: isDir ? 'var(--info)' : 'var(--warning)',
                font: '800 9.5px/1 var(--f-sans)', letterSpacing: '0.12em', textTransform: 'uppercase',
              }}>{isDir ? 'Directa' : 'Con ciudades'}</span>
              {!route.active && (
                <span style={{
                  padding: '2px 7px', borderRadius: 'var(--r-sm)',
                  background: 'var(--neutral-bg)', color: 'var(--ink-mute)',
                  font: '800 9.5px/1 var(--f-sans)', letterSpacing: '0.12em', textTransform: 'uppercase',
                }}>Inactiva</span>
              )}
            </div>
            {!isDir && route.stops.length > 0 && (
              <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6, font: '500 11px/1 var(--f-sans)', color: 'var(--ink-soft)' }}>
                {route.stops.map((s, i) => (
                  <span key={i} style={{
                    padding: '3px 7px', background: 'var(--bg-surface)',
                    border: '1px solid var(--border)', borderRadius: 'var(--r-sm)',
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                  }}>
                    <span style={{ color: 'var(--ink)', font: '600 11px/1 var(--f-sans)' }}>{s.city}</span>
                    <span style={{ color: 'var(--ink-mute)', font: '600 10.5px/1 var(--f-mono)' }}>· {s.radiusKm}km</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────────
  // SlidersCard
  // ──────────────────────────────────────────────────────────────
  function SlidersCard({ weights, setW, totalMax, valid, overBy, optionalRules }) {
    const I = window.Icon;
    const U = window.ERPUI;
    return (
      <U.Card padded={false}>
        <header style={{ padding: '18px 20px 12px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ font: '900 18px/1.1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em' }}>Puntos por regla</div>
          <div style={{ font: '500 12px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 4 }}>
            Cuántos puntos suma cada regla cuando se cumple. El score total de cada paquete es 0–100.
          </div>
        </header>
        <div style={{ padding: '8px 20px 20px' }}>
          {Object.keys(DEFAULTS).map((k, i) => (
            <SliderRow
              key={k}
              cfg={DEFAULTS[k]}
              value={weights[k]}
              onChange={(v) => setW(k, v)}
              disabled={k === 'vip' && !optionalRules.tier}
              disabledHint={k === 'vip' && !optionalRules.tier ? 'Regla Tier OFF' : null}
              isLast={i === Object.keys(DEFAULTS).length - 1}
            />
          ))}
        </div>
        <footer style={{
          padding: '14px 20px',
          borderTop: '1px solid var(--border)',
          background: valid ? 'var(--bg-elevated)' : 'var(--danger-bg)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
            <div style={{
              font: '900 22px/1 var(--f-display)',
              color: valid ? 'var(--ink)' : 'var(--danger)',
              letterSpacing: '-0.02em', flexShrink: 0,
            }}>{totalMax}<span style={{ color: 'var(--ink-mute)', fontSize: 14 }}> /100</span></div>
            <div style={{ flex: 1, minWidth: 60 }}>
              <div style={{ height: 6, background: 'var(--bg-base)', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${Math.min(100, totalMax)}%`,
                  background: valid ? 'var(--wine)' : 'var(--danger)',
                  borderRadius: 999, transition: 'width var(--dur) var(--ease)',
                }} />
              </div>
            </div>
          </div>
          <div style={{
            font: '700 12px/1.4 var(--f-sans)',
            color: valid ? 'var(--success)' : 'var(--danger)',
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
            {valid
              ? <React.Fragment>{I.check(14)} Suma válida</React.Fragment>
              : <React.Fragment>{I.warn(14)} Excede en {overBy} pts</React.Fragment>}
          </div>
        </footer>
      </U.Card>
    );
  }

  function SliderRow({ cfg, value, onChange, isLast, disabled, disabledHint }) {
    const isFixed = disabled;
    const pct = (value / cfg.max) * 100;
    return (
      <div style={{ padding: '14px 0', borderBottom: isLast ? 0 : '1px dashed var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, marginBottom: 8 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ font: '800 14px/1.2 var(--f-sans)', color: 'var(--ink)', letterSpacing: '-0.01em' }}>{cfg.label}</div>
              {disabled && disabledHint && (
                <span style={{
                  padding: '2px 6px', borderRadius: 'var(--r-sm)',
                  background: 'var(--neutral-bg)', color: 'var(--ink-mute)',
                  font: '700 9.5px/1 var(--f-sans)', letterSpacing: '0.08em', textTransform: 'uppercase',
                }}>{disabledHint}</span>
              )}
            </div>
            <div style={{ font: '500 11.5px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 3 }}>{cfg.desc}</div>
          </div>
          <div style={{
            display: 'inline-flex', alignItems: 'baseline', gap: 4,
            font: '900 22px/1 var(--f-display)', color: 'var(--wine)',
            letterSpacing: '-0.02em', flexShrink: 0,
          }}>
            {value}
            <span style={{ font: '600 11px/1 var(--f-mono)', color: 'var(--ink-mute)' }}>/{cfg.max}</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, position: 'relative', height: 28 }}>
            <input type="range" min={0} max={cfg.max} value={value}
              onChange={(e) => onChange(parseInt(e.target.value, 10))}
              disabled={isFixed}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: isFixed ? 'not-allowed' : 'pointer', margin: 0 }} />
            <div style={{
              position: 'absolute', top: '50%', left: 0, right: 0, height: 6,
              background: 'var(--bg-elevated)', borderRadius: 999,
              transform: 'translateY(-50%)', opacity: isFixed ? 0.5 : 1,
            }}>
              <div style={{
                position: 'absolute', top: 0, left: 0, height: '100%',
                width: `${pct}%`, borderRadius: 999,
                background: isFixed ? 'var(--ink-mute)' : 'var(--wine)',
                transition: 'width var(--dur-fast) var(--ease)',
              }} />
            </div>
            <div style={{
              position: 'absolute', top: '50%', left: `${pct}%`,
              transform: 'translate(-50%, -50%)',
              width: 18, height: 18, borderRadius: '50%',
              background: isFixed ? 'var(--ink-mute)' : 'var(--wine)',
              border: '3px solid var(--bg-surface)',
              boxShadow: 'var(--shadow-sm)', pointerEvents: 'none',
              transition: 'left var(--dur-fast) var(--ease)',
            }} />
          </div>
          <input type="number" min={0} max={cfg.max} value={value} disabled={isFixed}
            onChange={(e) => { const v = Math.max(0, Math.min(cfg.max, parseInt(e.target.value || '0', 10))); onChange(v); }}
            style={{
              width: 56, height: 32, padding: '0 8px',
              background: 'var(--bg-surface)', color: 'var(--ink)',
              border: '1px solid var(--border)', borderRadius: 'var(--r-sm)',
              font: '700 13px/1 var(--f-mono)', textAlign: 'center', outline: 'none',
              opacity: isFixed ? 0.5 : 1,
            }} />
        </div>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────────
  // PreviewCard (sticky)
  // ──────────────────────────────────────────────────────────────
  function PreviewCard({ sample, setSample, samples, result, prio, blocked, policy, policyEval, optionalRules }) {
    const I = window.Icon;
    const U = window.ERPUI;
    return (
      <U.Card padded={false} style={{ position: 'sticky', top: 24 }}>
        <header style={{
          padding: '18px 20px 14px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
        }}>
          <div>
            <div style={{ font: '900 18px/1.1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em' }}>Vista previa</div>
            <div style={{ font: '500 12px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 4 }}>
              Prueba con un paquete real para ver cómo lo rankearía tu config.
            </div>
          </div>
          <span style={{
            padding: '4px 8px', borderRadius: 'var(--r-pill)',
            background: 'var(--success-bg)', color: 'var(--success)',
            font: '700 9.5px/1 var(--f-sans)', letterSpacing: '0.12em', textTransform: 'uppercase',
          }}>● Live</span>
        </header>

        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Paquete ejemplo</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {samples.map(s => (
              <button key={s.id} onClick={() => setSample(s)} style={{
                padding: '8px 10px', textAlign: 'left',
                background: sample.id === s.id ? 'var(--wine-tint)' : 'var(--bg-elevated)',
                border: `1px solid ${sample.id === s.id ? 'var(--wine)' : 'transparent'}`,
                borderRadius: 'var(--r-md)',
                cursor: 'pointer', transition: 'all var(--dur-fast) var(--ease)',
              }}>
                <code style={{ font: '700 11px/1 var(--f-mono)', color: sample.id === s.id ? 'var(--wine)' : 'var(--ink-soft)' }}>{s.order}</code>
                <div style={{ font: '600 12px/1.2 var(--f-sans)', color: 'var(--ink)', marginTop: 2 }}>{s.client}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3, font: '500 10.5px/1 var(--f-sans)', color: 'var(--ink-mute)' }}>
                  <span>{s.city} · {s.days}d · {s.pay}</span>
                  {s.tier && optionalRules.tier && (
                    <span style={{
                      padding: '1px 4px', borderRadius: 'var(--r-sm)',
                      background: s.tier === 'Platinum' ? 'var(--ink)' : 'var(--warning-bg)',
                      color: s.tier === 'Platinum' ? 'var(--ink-inv)' : 'var(--warning)',
                      font: '800 8.5px/1.2 var(--f-sans)', letterSpacing: '0.1em',
                    }}>{s.tier === 'Platinum' ? 'PLAT' : 'GOLD'}</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div style={{ padding: '20px' }}>
          <PolicyStatusPill policy={policy} evalResult={policyEval} />

          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 14, opacity: blocked ? 0.4 : 1 }}>
            <div>
              <div style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Score final</div>
              <div style={{
                font: '900 64px/1 var(--f-display)',
                color: blocked ? 'var(--ink-mute)' : `var(--${prio.tone === 'neutral' ? 'ink-soft' : prio.tone})`,
                letterSpacing: '-0.04em', marginTop: 6,
                textDecoration: blocked ? 'line-through' : 'none',
              }}>{result.total}<span style={{ fontSize: 22, color: 'var(--ink-mute)' }}>/100</span></div>
            </div>
            <U.Badge tone={blocked ? 'neutral' : prio.tone} size="md">{blocked ? 'Bloqueado' : prio.label}</U.Badge>
          </div>

          <div style={{ height: 8, background: 'var(--bg-elevated)', borderRadius: 999, overflow: 'hidden', marginBottom: 18, opacity: blocked ? 0.4 : 1 }}>
            <div style={{
              height: '100%', width: `${result.total}%`,
              background: blocked ? 'var(--ink-mute)' : `var(--${prio.tone === 'neutral' ? 'neutral' : prio.tone})`,
              borderRadius: 999, transition: 'width var(--dur) var(--ease)',
            }} />
          </div>

          <div style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Desglose</div>
          <div>
            {result.lines.map(l => (
              <div key={l.key} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                padding: '8px 0', borderBottom: '1px dashed var(--border)',
                opacity: l.muted ? 0.4 : 1,
              }}>
                <div style={{ font: '600 12.5px/1.3 var(--f-sans)', color: 'var(--ink)', textDecoration: l.strike ? 'line-through' : 'none' }}>
                  {l.label}
                  {l.hint && <span style={{ color: 'var(--ink-mute)', font: '500 11px/1 var(--f-mono)', marginLeft: 6 }}>({l.hint})</span>}
                </div>
                <div style={{ font: '800 13.5px/1 var(--f-mono)', color: l.pts > 0 ? 'var(--wine)' : 'var(--ink-mute)' }}>
                  {l.pts > 0 ? '+' : ''}{l.pts}
                </div>
              </div>
            ))}
          </div>

          <div style={{
            marginTop: 14, padding: '10px 12px',
            background: blocked ? 'var(--danger-bg)' : policyEval.state === 'hold' ? 'var(--warning-bg)' : policyEval.state === 'credit-ok' ? 'var(--success-bg)' : 'var(--info-bg)',
            borderRadius: 'var(--r-md)',
            font: '500 11.5px/1.4 var(--f-sans)',
            color: blocked ? 'var(--danger)' : policyEval.state === 'hold' ? 'var(--warning)' : policyEval.state === 'credit-ok' ? 'var(--success)' : 'var(--info)',
            display: 'flex', alignItems: 'flex-start', gap: 8,
          }}>
            <span style={{ flexShrink: 0, marginTop: 1 }}>{blocked ? I.warn(13) : policyEval.state === 'hold' ? I.clock(13) : policyEval.state === 'credit-ok' ? I.check(13) : I.info(13)}</span>
            <span>
              {blocked
                ? <React.Fragment><b>Paquete bloqueado.</b> {policyEval.reason} No entrará a la cola.</React.Fragment>
                : policyEval.state === 'hold'
                  ? <React.Fragment><b>Política en hold.</b> {policyEval.reason} Quedaría en categoría <b>{prio.label.toLowerCase()}</b> pero marcado.</React.Fragment>
                  : policyEval.state === 'credit-ok'
                    ? <React.Fragment><b>Crédito autorizado.</b> {policyEval.reason} Entra en categoría <b>{prio.label.toLowerCase()}</b>.</React.Fragment>
                    : <React.Fragment>Aplicando estas reglas, este paquete quedaría en categoría <b>{prio.label.toLowerCase()}</b>.</React.Fragment>}
            </span>
          </div>
        </div>
      </U.Card>
    );
  }

  function PolicyStatusPill({ policy, evalResult }) {
    const I = window.Icon;
    const mode = POLICY_MODES.find(m => m.id === policy.mode);
    const state = evalResult.state;
    const tone =
      state === 'blocked'   ? 'danger'  :
      state === 'hold'      ? 'warning' :
      state === 'credit-ok' ? 'success' :
      mode.tone;
    const label =
      state === 'blocked'   ? `Bloqueado por política · modo ${mode.label.toLowerCase()}` :
      state === 'hold'      ? `Política en hold hasta ${policy.holdUntil}` :
      state === 'credit-ok' ? `Crédito autorizado · permitido sin pago` :
                              `Política activa · ${mode.label}`;
    return (
      <div style={{
        marginBottom: 14,
        padding: '8px 12px',
        background: `var(--${tone}-bg)`, color: `var(--${tone})`,
        borderRadius: 'var(--r-md)',
        font: '700 11.5px/1.3 var(--f-sans)',
        display: 'inline-flex', alignItems: 'center', gap: 8,
        letterSpacing: '0.02em',
      }}>
        {I.lock(13)} {label}
      </div>
    );
  }

  window.ModuleDespachoRules = ModuleDespachoRules;
})();
