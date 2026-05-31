/* global React */
/* ── DTD ERP · Administración (entry + nivel básico) ────────── */

const { useState: _aUseState, useMemo: _aUseMemo } = React;

const ADMIN_SECTIONS = [
  // Nivel básico
  { group: 'BÁSICO',     id: 'company',     label: 'Datos de la empresa', icon: 'shield' },
  { group: 'BÁSICO',     id: 'features',    label: 'Casos de uso · ON/OFF', icon: 'flag' },
  { group: 'BÁSICO',     id: 'masterdata',  label: 'Master data',         icon: 'tag' },
  { group: 'BÁSICO',     id: 'rates',       label: 'Tasas de cambio',     icon: 'invoice' },
  { group: 'BÁSICO',     id: 'fiscal',      label: 'Impuestos · IVA/SENIAT', icon: 'shield' },
  { group: 'BÁSICO',     id: 'holidays',    label: 'Feriados CN/VE',      icon: 'clock' },
  { group: 'BÁSICO',     id: 'appearance',  label: 'Apariencia',          icon: 'sun' },
  { group: 'BÁSICO',     id: 'routes',      label: 'Administrar rutas',   icon: 'truck' },
  // Marca · NUEVO grupo dedicado v1.0
  { group: 'MARCA',      id: 'brand-system',label: 'Sistema de marca',    icon: 'spark' },
  { group: 'MARCA',      id: 'brand-icons', label: 'Íconos de perfil',    icon: 'users' },
  { group: 'MARCA',      id: 'brand-apps',  label: 'Aplicaciones de marca',icon: 'tag' },
  { group: 'MARCA',      id: 'brand-ads',   label: 'Publicidad activa',   icon: 'flame' },
  // Nivel intermedio
  { group: 'INTERMEDIO', id: 'permissions', label: 'Permisos por rol',    icon: 'lock' },
  { group: 'INTERMEDIO', id: 'audit',       label: 'Audit log',           icon: 'eye' },
  { group: 'INTERMEDIO', id: 'numbering',   label: 'Numeración & legal',  icon: 'doc' },
  // Nivel pro
  { group: 'PRO',        id: 'api',         label: 'API keys & webhooks', icon: 'link' },
  { group: 'PRO',        id: 'workflows',   label: 'Workflows custom',    icon: 'radar' },
  { group: 'PRO',        id: 'import',      label: 'Importar / Exportar', icon: 'upload' },
];

function ModuleAdmin() {
  const U = window.ERPUI;
  const [section, setSection] = _aUseState('company');

  // Group sections by level
  const grouped = _aUseMemo(() => {
    const m = new Map();
    ADMIN_SECTIONS.forEach(s => {
      if (!m.has(s.group)) m.set(s.group, []);
      m.get(s.group).push(s);
    });
    return [...m.entries()];
  }, []);

  const active = ADMIN_SECTIONS.find(s => s.id === section);

  return (
    <div>
      <U.PageHeader
        title="Administración"
        subtitle="Configuración global del ERP DTD-Cargo · solo accesible para rol Admin."
        actions={
          <window.ERPUI.Badge tone="wine" size="md" dot>Acceso restringido · Admin</window.ERPUI.Badge>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 16, alignItems: 'flex-start' }}>
        {/* Side nav */}
        <U.Card padded={false}>
          {grouped.map(([level, items]) => (
            <div key={level}>
              <div style={{ padding: '12px 14px 6px', font: '700 9.5px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.16em', textTransform: 'uppercase' }}>{level}</div>
              {items.map((s, i) => (
                <button key={s.id} onClick={() => setSection(s.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%', padding: '10px 14px',
                  background: section === s.id ? 'var(--wine-tint)' : 'transparent',
                  color: section === s.id ? 'var(--wine)' : 'var(--ink)',
                  font: `${section === s.id ? '700' : '500'} 13px/1 var(--f-sans)`,
                  textAlign: 'left',
                  position: 'relative',
                }}
                onMouseEnter={(e) => { if (section !== s.id) e.currentTarget.style.background = 'var(--bg-elevated)'; }}
                onMouseLeave={(e) => { if (section !== s.id) e.currentTarget.style.background = 'transparent'; }}
                >
                  {section === s.id && <span style={{ position: 'absolute', left: 0, top: 8, bottom: 8, width: 3, background: 'var(--wine)', borderRadius: 2 }} />}
                  <span style={{ color: section === s.id ? 'var(--wine)' : 'var(--ink-soft)' }}>{window.Icon[s.icon](15)}</span>
                  <span>{s.label}</span>
                </button>
              ))}
            </div>
          ))}
        </U.Card>

        {/* Content */}
        <div key={section} style={{ animation: 'erp-route-in 200ms var(--ease)' }}>
          <div style={{ marginBottom: 'var(--s-5)' }}>
            <div className="eyebrow eyebrow-wine">{active.group}</div>
            <h2 style={{ font: '900 22px/1.1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em', margin: '6px 0 0' }}>{active.label}</h2>
          </div>

          {section === 'company'     && <SectionCompany />}
          {section === 'features'    && <SectionFeatures />}
          {section === 'masterdata'  && <SectionMasterData />}
          {section === 'rates'       && <SectionRates />}
          {section === 'fiscal'      && (window.AdminFiscalConfig ? <window.AdminFiscalConfig /> : null)}
          {section === 'holidays'    && <SectionHolidays />}
          {section === 'appearance'  && <SectionAppearance />}
          {section === 'brand-system'&& (window.AdminBrandSystem ? <window.AdminBrandSystem /> : null)}
          {section === 'brand-icons' && (window.AdminBrandIcons ? <window.AdminBrandIcons /> : null)}
          {section === 'brand-apps'  && (window.AdminBrandApps ? <window.AdminBrandApps /> : null)}
          {section === 'brand-ads'   && (window.AdminBrandAds ? <window.AdminBrandAds /> : null)}
          {section === 'routes'      && (window.AdminSectionRoutes ? <window.AdminSectionRoutes /> : <div style={{ padding: 20, color: 'var(--ink-soft)' }}>Cargando administrador de rutas…</div>)}
          {section === 'permissions' && <SectionPermissions />}
          {section === 'audit'       && <SectionAudit />}
          {section === 'numbering'   && <SectionNumbering />}
          {section === 'api'         && <SectionApi />}
          {section === 'workflows'   && <SectionWorkflows />}
          {section === 'import'      && <SectionImport />}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// NIVEL BÁSICO
// ════════════════════════════════════════════════════════════

// ── 1. Datos de la empresa ───────────────────────────────────
function SectionCompany() {
  const U = window.ERPUI;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <U.Card padded>
        <div className="eyebrow eyebrow-wine" style={{ marginBottom: 14 }}>IDENTIFICACIÓN FISCAL</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <U.Input label="Razón social" value="DTD-Cargo CA" />
          <U.Input label="RIF" value="J-30182554-9" mono />
          <U.Input label="Nombre comercial" value="DTD-Cargo" />
          <U.Input label="Email comercial" value="comercial@dtdcargo.com" />
        </div>
        <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <U.Input label="Teléfono" value="+58 412 DTD-CARG" mono />
          <U.Input label="WhatsApp Business" value="+58 412 383-2274" mono />
          <U.Input label="Sitio web" value="dtdcargo.com" mono />
        </div>
      </U.Card>

      <U.Card padded>
        <div className="eyebrow eyebrow-wine" style={{ marginBottom: 14 }}>OFICINAS</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { country: '🇻🇪', name: 'Caracas · HQ', addr: 'Av. Francisco de Miranda, Torre Provincial, Piso 12, Chacao' },
            { country: '🇻🇪', name: 'Valencia', addr: 'Av. Bolívar Norte, CC Sambil, Local 142' },
            { country: '🇨🇳', name: 'Yiwu · 义乌办公室', addr: '义乌市义乌港二期直通仓2栋2号货7--货11' },
            { country: '🇨🇳', name: 'Shenzhen', addr: '深圳市盐田区港口路38号' },
          ].map((o, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 1fr 80px', gap: 14, padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', alignItems: 'center' }}>
              <span style={{ fontSize: 22 }}>{o.country}</span>
              <div style={{ font: '700 13px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{o.name}</div>
              <div style={{ font: '500 12px/1.4 var(--f-sans)', color: 'var(--ink-soft)' }}>{o.addr}</div>
              <button style={{ font: '600 11.5px/1 var(--f-sans)', color: 'var(--wine)', justifySelf: 'end' }}>Editar →</button>
            </div>
          ))}
          <button style={{ padding: 12, font: '600 12.5px/1 var(--f-sans)', color: 'var(--ink-soft)', border: '1px dashed var(--border-strong)', borderRadius: 'var(--r-md)', textAlign: 'center' }}>+ Agregar oficina</button>
        </div>
      </U.Card>

      <U.Card padded>
        <div className="eyebrow eyebrow-wine" style={{ marginBottom: 14 }}>DATOS BANCARIOS (aparecen en facturas)</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { bank: 'Banco Mercantil', type: 'Cta. Corriente · USD', acc: '0105-0000-00-0000000001' },
            { bank: 'BBVA Provincial', type: 'Cta. Corriente · VES',  acc: '0108-0000-00-0000000002' },
          ].map((b, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '180px 200px 1fr 80px', gap: 14, padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', alignItems: 'center' }}>
              <div style={{ font: '700 13px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{b.bank}</div>
              <U.Badge tone="info" size="sm">{b.type}</U.Badge>
              <code style={{ font: '700 12px/1 var(--f-mono)', color: 'var(--ink)' }}>{b.acc}</code>
              <button style={{ font: '600 11.5px/1 var(--f-sans)', color: 'var(--wine)', justifySelf: 'end' }}>Editar →</button>
            </div>
          ))}
          <button style={{ padding: 12, font: '600 12.5px/1 var(--f-sans)', color: 'var(--ink-soft)', border: '1px dashed var(--border-strong)', borderRadius: 'var(--r-md)' }}>+ Agregar cuenta bancaria</button>
        </div>
      </U.Card>

      <U.Card padded>
        <div className="eyebrow eyebrow-wine" style={{ marginBottom: 14 }}>IMPUESTOS</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          <U.Input label="IVA" value="16" suffix="%" mono />
          <U.Input label="ISLR (retención)" value="3" suffix="%" mono />
          <U.Input label="IGTF (grandes transacc.)" value="3" suffix="%" mono />
        </div>
      </U.Card>

      <SaveBar />
    </div>
  );
}

// ── 2. Master data ───────────────────────────────────────────
function SectionMasterData() {
  const U = window.ERPUI;
  const [tab, setTab] = _aUseState('segments');

  const tabs = [
    { value: 'segments',  label: 'Segmentos',     count: 8 },
    { value: 'tiers',     label: 'Tiers',         count: 4 },
    { value: 'services',  label: 'Servicios',     count: 4 },
    { value: 'statuses',  label: 'Estados',       count: 9 },
    { value: 'doctypes',  label: 'Documentos',    count: 4 },
    { value: 'hscodes',   label: 'HS codes · OMA',count: 12 },
    { value: 'aes',       label: 'AES · Arancel VE', count: 10 },
  ];

  const lists = {
    segments: [
      { name: 'Industrial', desc: 'Fabricantes, plantas', tone: 'wine' },
      { name: 'Retail', desc: 'Tiendas físicas y e-commerce', tone: 'info' },
      { name: 'Mayorista', desc: 'Distribuidores', tone: 'warning' },
      { name: 'Tecnología', desc: 'IT, electrónica', tone: 'info' },
      { name: 'Textil', desc: 'Indumentaria, telas', tone: 'neutral' },
      { name: 'Belleza', desc: 'Cosmética, cuidado personal', tone: 'wine' },
      { name: 'Comercial', desc: 'Genérico B2B', tone: 'neutral' },
      { name: 'Servicios', desc: 'Empresas de servicios', tone: 'success' },
    ],
    tiers: [
      { name: 'Platinum', desc: '$200K+ facturado/año · onboarding manual · agente dedicado', tone: 'wine' },
      { name: 'Gold',     desc: '$80K-200K/año · prioridad media · Account Manager asignado', tone: 'warning' },
      { name: 'Silver',   desc: '$20K-80K/año · soporte estándar', tone: 'info' },
      { name: 'Bronze',   desc: '<$20K/año · self-service', tone: 'neutral' },
    ],
    services: [
      { name: 'LCL DDP', desc: 'Carga suelta puerta a puerta · $800/CBM base', tone: 'wine' },
      { name: "FCL 20'", desc: 'Contenedor 20" exclusivo · tarifa cerrada', tone: 'info' },
      { name: "FCL 40'", desc: 'Contenedor 40" estándar', tone: 'info' },
      { name: "FCL 40'HC", desc: 'High Cube · mayor volumen', tone: 'info' },
    ],
    statuses: window.ERPData.STATUS_FLOW.map(s => ({
      name: s, desc: `Estado del workflow de embarques`, tone: window.ERPData.STATUS_TONE[s] || 'neutral'
    })),
    doctypes: [
      { name: 'BL · Bill of Lading', desc: 'Conocimiento de embarque · obligatorio', tone: 'wine' },
      { name: 'Packing List',         desc: 'Lista de contenido detallado', tone: 'info' },
      { name: 'Factura comercial',    desc: 'Para aduana e importación', tone: 'info' },
      { name: 'POD',                  desc: 'Proof of Delivery · firma recepción', tone: 'success' },
    ],
    hscodes: [
      { name: '8517.12', desc: 'Teléfonos móviles', tone: 'neutral' },
      { name: '9405.40', desc: 'Aparatos eléctricos de alumbrado', tone: 'neutral' },
      { name: '8471.30', desc: 'Computadoras portátiles', tone: 'neutral' },
      { name: '5208.32', desc: 'Tejidos algodón', tone: 'neutral' },
      { name: '4202.92', desc: 'Maletas, mochilas', tone: 'neutral' },
      { name: '3304.99', desc: 'Cosmética', tone: 'neutral' },
      { name: '8418.50', desc: 'Refrigeración industrial', tone: 'neutral' },
      { name: '8504.40', desc: 'Convertidores estáticos', tone: 'neutral' },
      { name: '9403.20', desc: 'Muebles metálicos', tone: 'neutral' },
      { name: '6403.99', desc: 'Calzado con suela de caucho', tone: 'neutral' },
      { name: '8528.72', desc: 'TVs y monitores', tone: 'neutral' },
      { name: '6109.10', desc: 'T-shirts algodón', tone: 'neutral' },
    ],
    aes: [
      { code: '8517.12.10', desc: 'Teléfonos móviles GSM',         duty: 15, iva: 16, flag: 'general' },
      { code: '9405.40.20', desc: 'Lámparas LED · iluminación',     duty: 10, iva: 16, flag: 'general' },
      { code: '8471.30.10', desc: 'Notebooks personales',            duty:  5, iva: 16, flag: 'tech-favorable' },
      { code: '6109.10.10', desc: 'T-shirts algodón · prenda',       duty: 25, iva: 16, flag: 'restringido' },
      { code: '3304.99.20', desc: 'Cosmética antiarrugas',           duty: 20, iva: 16, flag: 'sanitario' },
      { code: '8418.50.10', desc: 'Vitrinas frigoríficas comerciales', duty: 12, iva: 16, flag: 'general' },
      { code: '6403.99.10', desc: 'Zapatillas deportivas (caucho)',  duty: 25, iva: 16, flag: 'restringido' },
      { code: '8528.72.20', desc: 'Televisores LED 32–55"',          duty: 18, iva: 16, flag: 'general' },
      { code: '9403.20.30', desc: 'Estanterías metálicas industriales', duty: 12, iva: 16, flag: 'general' },
      { code: '4202.92.10', desc: 'Maletas de viaje',                duty: 22, iva: 16, flag: 'general' },
    ],
  };

  const items = lists[tab];
  const isSyncedList = tab === 'hscodes' || tab === 'aes';

  return (
    <div>
      <U.Tabs value={tab} onChange={setTab} items={tabs} style={{ marginBottom: 'var(--s-4)' }} />

      {isSyncedList && <CodesSyncHeader source={tab} />}

      <U.Card padded={false}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="eyebrow eyebrow-wine">{items.length} ITEMS{isSyncedList ? ' · sincronizados' : ''}</div>
          {!isSyncedList && <U.Btn variant="primary" size="sm" icon={window.Icon.plus(12)}>Agregar</U.Btn>}
          {isSyncedList && <U.Btn variant="ghost" size="sm" icon={window.Icon.search(12)}>Buscar código</U.Btn>}
        </div>
        <div>
          {tab === 'aes' ? items.map((it, i) => <AesRow key={it.code} it={it} first={i === 0} />)
          : items.map((it, i) => (
            <div key={it.name} style={{
              display: 'grid', gridTemplateColumns: '160px 1fr 90px 80px',
              gap: 14, padding: '14px 18px', alignItems: 'center',
              borderTop: i > 0 ? '1px solid var(--border)' : 0,
            }}>
              <U.Badge tone={it.tone} size="md">{it.name}</U.Badge>
              <span style={{ font: '500 12.5px/1.4 var(--f-sans)', color: 'var(--ink-soft)' }}>{it.desc}</span>
              <U.Badge tone="success" size="sm" dot>activo</U.Badge>
              <div style={{ display: 'inline-flex', gap: 4, justifyContent: 'flex-end' }}>
                <button style={{ width: 26, height: 26, color: 'var(--ink-soft)' }}>{window.Icon.edit(13)}</button>
                <button style={{ width: 26, height: 26, color: 'var(--ink-soft)' }}>{window.Icon.trash(13)}</button>
              </div>
            </div>
          ))}
        </div>
      </U.Card>
    </div>
  );
}

// ── 3. Tasas de cambio ───────────────────────────────────────
function SectionRates() {
  const U = window.ERPUI;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        <U.KPI label="USD / VES · BCV"        value="36.45"   delta="↑ 0.12 vs ayer"      tone="wine" />
        <U.KPI label="USD / VES · Paralelo"   value="37.20"   delta="↑ 0.08 vs ayer"      tone="warning" />
        <U.KPI label="USD / CNY (China)"      value="7.18"    delta="estable"              tone="info" />
      </div>

      <U.Card padded>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div className="eyebrow eyebrow-wine">CONFIGURACIÓN</div>
          <U.Btn variant="secondary" size="sm" icon={window.Icon.refresh(12)}>Sincronizar BCV</U.Btn>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <U.Select label="Fuente USD/VES" options={['BCV · Oficial', 'Paralelo · Monitor', 'Promedio', 'Manual']} />
          <U.Select label="Frecuencia actualización" options={['Cada hora', 'Diario · 9:00 AM', 'Diario · 6:00 PM', 'Manual']} />
          <U.Input label="USD / VES (override manual)" value="36.45" prefix="Bs." mono />
          <U.Input label="USD / CNY" value="7.18" suffix="¥" mono />
        </div>

        <div style={{ marginTop: 14, padding: '12px 14px', background: 'var(--info-bg)', borderRadius: 'var(--r-md)', display: 'flex', gap: 10 }}>
          <span style={{ color: 'var(--info)' }}>{window.Icon.info(13)}</span>
          <div style={{ font: '500 12px/1.5 var(--f-sans)', color: 'var(--ink)' }}>
            Las cotizaciones se mantienen en USD. La conversión a VES solo aplica en facturas locales según la fuente seleccionada.
          </div>
        </div>
      </U.Card>

      <U.Card padded>
        <div className="eyebrow eyebrow-wine" style={{ marginBottom: 14 }}>HISTORIAL ÚLTIMOS 7 DÍAS</div>
        <RatesChart />
      </U.Card>

      <ScrapersCard />
    </div>
  );
}

// ── Fuentes de scraping (BCV + paralelos) ───────────────────
function ScrapersCard() {
  const U = window.ERPUI;
  const I = window.Icon;
  const [scrapers, setScrapers] = _aUseState([
    { id: 'bcv',       name: 'BCV · Oficial',       url: 'bcv.org.ve/estadisticas/tipo-de-cambio',     pair: 'USD/VES',  enabled: true,  rate: '36.45', lastSync: 'hace 8 min',  status: 'ok' },
    { id: 'monitor',   name: 'Monitor Dólar VE',   url: 'monitordolarvenezuela.com',                  pair: 'USD/VES',  enabled: true,  rate: '37.20', lastSync: 'hace 12 min', status: 'ok' },
    { id: 'dolartoday',name: 'DolarToday',          url: 'dolartoday.com',                              pair: 'USD/VES',  enabled: false, rate: '37.45', lastSync: 'hace 3 h',    status: 'paused' },
    { id: 'pboc',      name: 'PBOC · China',        url: 'pbc.gov.cn/en/3688006/3688098/index.html',   pair: 'USD/CNY',  enabled: true,  rate: '7.18',  lastSync: 'hace 1 h',    status: 'ok' },
  ]);
  const [syncing, setSyncing] = _aUseState(null);

  function toggle(id) { setScrapers(scrapers.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s)); }
  function syncOne(id) {
    setSyncing(id);
    setTimeout(() => {
      setScrapers(scrapers.map(s => s.id === id ? { ...s, lastSync: 'hace 1 seg', status: 'ok' } : s));
      setSyncing(null);
    }, 1600);
  }
  function syncAll() {
    setSyncing('all');
    setTimeout(() => {
      const next = scrapers.map(s => s.enabled ? { ...s, lastSync: 'hace 1 seg', status: 'ok' } : s);
      setScrapers(next);
      // Publish al bridge
      if (window.DTDData) {
        const rates = {};
        next.filter(s => s.enabled).forEach(s => { rates[s.pair] = parseFloat(s.rate); });
        window.DTDData.rates.write({ rates, sources: next, syncedAt: new Date().toISOString() });
      }
      setSyncing(null);
    }, 2200);
  }

  return (
    <U.Card padded>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
        <div>
          <div className="eyebrow eyebrow-wine">FUENTES DE SCRAPING · AUTOMÁTICO</div>
          <div style={{ font: '500 12.5px/1.5 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 6, maxWidth: '64ch' }}>
            Páginas web que el sistema consulta automáticamente para traer la tasa de cambio. La frecuencia se configura arriba. Podés activar/desactivar cada fuente o forzar sync manual.
          </div>
        </div>
        <U.Btn variant="primary" size="sm" icon={I.refresh(12)} onClick={syncAll} disabled={syncing}>{syncing === 'all' ? 'Sincronizando…' : 'Sincronizar todo'}</U.Btn>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {scrapers.map(s => {
          const busy = syncing === s.id || syncing === 'all';
          return (
            <div key={s.id} style={{
              display: 'grid', gridTemplateColumns: '32px 1fr 110px 110px 110px 80px', gap: 12, alignItems: 'center',
              padding: '10px 14px',
              background: s.enabled ? 'var(--bg-elevated)' : 'var(--bg-surface)',
              border: `1px solid ${s.enabled ? 'var(--border)' : 'var(--border)'}`,
              borderRadius: 'var(--r-md)',
              opacity: s.enabled ? 1 : 0.55,
            }}>
              <span style={{ color: s.status === 'ok' ? 'var(--success)' : 'var(--ink-mute)' }}>
                {s.status === 'ok' ? I.check(14) : I.clock(14)}
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ font: '700 12.5px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{s.name}</div>
                <a href={`https://${s.url}`} target="_blank" rel="noreferrer" style={{ font: '500 11px/1 var(--f-mono)', color: 'var(--wine)', textDecoration: 'none' }}>{s.url}</a>
              </div>
              <U.Badge tone="info" size="sm">{s.pair}</U.Badge>
              <code className="mono" style={{ font: '800 13px/1 var(--f-mono)', color: 'var(--wine)' }}>{s.rate}</code>
              <span style={{ font: '500 11px/1 var(--f-sans)', color: 'var(--ink-soft)' }}>{s.lastSync}</span>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
                <button onClick={() => syncOne(s.id)} disabled={busy || !s.enabled} title="Sincronizar ahora" style={{
                  width: 28, height: 28, borderRadius: 'var(--r-sm)',
                  background: 'transparent', color: busy && (syncing === s.id || syncing === 'all') ? 'var(--wine)' : 'var(--ink-soft)',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  cursor: busy ? 'wait' : 'pointer', opacity: !s.enabled ? 0.4 : 1,
                  animation: busy && (syncing === s.id || syncing === 'all') ? 'erp-fade 0.6s ease-in-out infinite alternate' : 'none',
                }}>{I.refresh(13)}</button>
                <ScrapeSwitch on={s.enabled} onClick={() => toggle(s.id)} />
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 14, padding: '10px 12px', background: 'var(--warning-bg)', color: 'var(--warning)', borderRadius: 'var(--r-md)', font: '500 11.5px/1.5 var(--f-sans)', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <span style={{ marginTop: 1, flexShrink: 0 }}>{I.warn(12)}</span>
        <span>Los scrapers corren del lado servidor (Node + Puppeteer/Cheerio). Si una fuente cambia su HTML, el scraper falla — vas a recibir alerta en <code style={{ font: '700 11px/1 var(--f-mono)' }}>Audit log</code>. La <b>tasa fallback</b> es el último valor exitoso o el override manual.</span>
      </div>
    </U.Card>
  );
}

function ScrapeSwitch({ on, onClick }) {
  return (
    <button onClick={onClick} role="switch" aria-checked={on} style={{
      position: 'relative', width: 32, height: 18, borderRadius: 999,
      background: on ? 'var(--success)' : 'var(--bg-elevated)',
      border: `1px solid ${on ? 'var(--success)' : 'var(--border-strong)'}`,
    }}>
      <span style={{ position: 'absolute', top: 1, left: on ? 15 : 1, width: 14, height: 14, borderRadius: '50%', background: '#fff', boxShadow: 'var(--shadow-sm)', transition: 'left var(--dur-fast) var(--ease)' }} />
    </button>
  );
}

function RatesChart() {
  const days = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];
  const bcv = [36.10, 36.18, 36.25, 36.30, 36.38, 36.42, 36.45];
  const par = [36.85, 36.92, 37.00, 37.05, 37.10, 37.15, 37.20];
  const min = 35.8, max = 37.5;
  const W = 720, H = 200, pad = 36;
  const xStep = (W - pad * 2) / (days.length - 1);
  const yFor = v => H - ((v - min) / (max - min)) * (H - 20);
  const pathBcv = bcv.map((v,i) => `${i===0?'M':'L'} ${pad+i*xStep} ${yFor(v)}`).join(' ');
  const pathPar = par.map((v,i) => `${i===0?'M':'L'} ${pad+i*xStep} ${yFor(v)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H + 30}`} style={{ width: '100%', height: 'auto' }}>
      {[0, 0.5, 1].map((p, i) => (
        <line key={i} x1={pad} x2={W-pad} y1={H-p*(H-20)} y2={H-p*(H-20)} stroke="var(--border)" strokeWidth="1" strokeDasharray={i === 0 ? '0' : '2 4'} />
      ))}
      <path d={pathBcv} fill="none" stroke="var(--wine)" strokeWidth="2.5" />
      <path d={pathPar} fill="none" stroke="var(--warning)" strokeWidth="2.5" strokeDasharray="4 4" />
      {bcv.map((v,i) => <circle key={'b'+i} cx={pad+i*xStep} cy={yFor(v)} r="3" fill="var(--wine)" />)}
      {par.map((v,i) => <circle key={'p'+i} cx={pad+i*xStep} cy={yFor(v)} r="3" fill="var(--warning)" />)}
      {days.map((d,i) => <text key={d} x={pad+i*xStep} y={H+18} fontFamily="Archivo" fontSize="10" fontWeight="600" fill="var(--ink-mute)" textAnchor="middle">{d}</text>)}
      <g transform={`translate(${pad}, ${H + 28})`}>
        <line x1="0" x2="14" y1="6" y2="6" stroke="var(--wine)" strokeWidth="2.5" />
        <text x="20" y="9" fontFamily="Archivo" fontSize="10" fontWeight="600" fill="var(--ink-soft)">BCV oficial</text>
        <line x1="110" x2="124" y1="6" y2="6" stroke="var(--warning)" strokeWidth="2.5" strokeDasharray="4 4" />
        <text x="130" y="9" fontFamily="Archivo" fontSize="10" fontWeight="600" fill="var(--ink-soft)">Paralelo</text>
      </g>
    </svg>
  );
}

// ── 4. Feriados ──────────────────────────────────────────────
function SectionHolidays() {
  const U = window.ERPUI;
  const [country, setCountry] = _aUseState('cn');

  const cn = [
    { date: '2026-01-01', end: '2026-01-01', name: 'Año Nuevo', critical: false },
    { date: '2026-02-16', end: '2026-02-24', name: 'Año Nuevo Chino · 春节', critical: true },
    { date: '2026-04-04', end: '2026-04-06', name: 'Qingming · 清明节', critical: false },
    { date: '2026-05-01', end: '2026-05-05', name: 'Día del Trabajador · 劳动节', critical: false },
    { date: '2026-06-19', end: '2026-06-21', name: 'Dragon Boat · 端午节', critical: false },
    { date: '2026-09-25', end: '2026-09-27', name: 'Mid-Autumn · 中秋节', critical: false },
    { date: '2026-10-01', end: '2026-10-07', name: 'Golden Week · 国庆节', critical: true },
  ];
  const ve = [
    { date: '2026-01-01', end: '2026-01-01', name: 'Año Nuevo VE' },
    { date: '2026-04-02', end: '2026-04-03', name: 'Jueves y Viernes Santo' },
    { date: '2026-04-19', end: '2026-04-19', name: 'Declaración Independencia' },
    { date: '2026-05-01', end: '2026-05-01', name: 'Día del Trabajador VE' },
    { date: '2026-07-05', end: '2026-07-05', name: 'Independencia' },
    { date: '2026-07-24', end: '2026-07-24', name: 'Natalicio Bolívar' },
    { date: '2026-10-12', end: '2026-10-12', name: 'Día de la Resistencia Indígena' },
    { date: '2026-12-25', end: '2026-12-25', name: 'Navidad' },
  ];
  const list = country === 'cn' ? cn : ve;

  return (
    <div>
      <U.Tabs value={country} onChange={setCountry} items={[
        { value: 'cn', label: '🇨🇳 China',     count: cn.length },
        { value: 've', label: '🇻🇪 Venezuela', count: ve.length },
      ]} style={{ marginBottom: 'var(--s-4)' }} />

      <U.Card padded={false}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="eyebrow eyebrow-wine">{country === 'cn' ? 'FERIADOS DE OPERACIÓN CN' : 'FERIADOS VENEZUELA'}</div>
          <U.Btn variant="primary" size="sm" icon={window.Icon.plus(12)}>Agregar feriado</U.Btn>
        </div>
        {list.map((h, i) => (
          <div key={h.date} style={{
            display: 'grid', gridTemplateColumns: '130px 130px 1fr 100px 70px',
            gap: 14, padding: '14px 18px', alignItems: 'center',
            borderTop: i > 0 ? '1px solid var(--border)' : 0,
            background: h.critical ? 'var(--wine-tint)' : 'transparent',
          }}>
            <code style={{ font: '700 12px/1 var(--f-mono)', color: 'var(--ink)' }}>{h.date}</code>
            <span style={{ font: '500 12px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>{h.date === h.end ? '— mismo día' : `→ ${h.end}`}</span>
            <span style={{ font: '700 13px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{h.name}</span>
            {h.critical
              ? <U.Badge tone="wine" size="sm" dot>crítico</U.Badge>
              : <U.Badge tone="neutral" size="sm">estándar</U.Badge>
            }
            <div style={{ display: 'inline-flex', gap: 4, justifyContent: 'flex-end' }}>
              <button style={{ width: 26, height: 26, color: 'var(--ink-soft)' }}>{window.Icon.edit(13)}</button>
              <button style={{ width: 26, height: 26, color: 'var(--ink-soft)' }}>{window.Icon.trash(13)}</button>
            </div>
          </div>
        ))}
      </U.Card>

      <div style={{ marginTop: 12, padding: '12px 14px', background: 'var(--warning-bg)', borderRadius: 'var(--r-md)', display: 'flex', gap: 10 }}>
        <span style={{ color: 'var(--warning)' }}>{window.Icon.warn(13)}</span>
        <div style={{ font: '500 12px/1.5 var(--f-sans)', color: 'var(--ink)' }}>
          Los feriados marcados <b>críticos</b> bloquean nuevos zarpes desde CN durante esos días. Se reflejan en el módulo Calendario y en alertas operativas.
        </div>
      </div>
    </div>
  );
}

// ── 5. Apariencia ────────────────────────────────────────────
function SectionAppearance() {
  const U = window.ERPUI;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <U.Card padded>
        <div className="eyebrow eyebrow-wine" style={{ marginBottom: 14 }}>LOGO & FAVICON</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {['Logo principal', 'Favicon'].map(label => (
            <div key={label} style={{ padding: 18, background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', textAlign: 'center' }}>
              <img src="assets/dtdcargo-icon-navy.png" alt="" style={{ width: 64, height: 64, margin: '0 auto 12px', objectFit: 'contain' }} />
              <div style={{ font: '700 11px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{label}</div>
              <div style={{ marginTop: 10, display: 'flex', gap: 6, justifyContent: 'center' }}>
                <U.Btn variant="secondary" size="sm" icon={window.Icon.upload(12)}>Reemplazar</U.Btn>
              </div>
            </div>
          ))}
        </div>
      </U.Card>

      <U.Card padded>
        <div className="eyebrow eyebrow-wine" style={{ marginBottom: 6 }}>PALETA DE MARCA</div>
        <div style={{ font: '500 12px/1.5 var(--f-sans)', color: 'var(--ink-soft)', marginBottom: 12 }}>
          Los colores oficiales no se pueden modificar — están bloqueados por reglas de marca (ver CLAUDE.md).
          Para alternar entre temas claro/oscuro usá Tweaks.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {[
            { name: 'Wine',     val: '#7F0F1A', token: '--wine' },
            { name: 'Wine-soft', val: '#C2747F', token: '--wine-soft' },
            { name: 'Ink',      val: '#0F1E3D', token: '--ink' },
            { name: 'Paper',    val: '#FBFAF7', token: '--bg-base' },
          ].map(c => (
            <div key={c.name} style={{ padding: 12, background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)' }}>
              <div style={{ width: '100%', height: 48, background: c.val, borderRadius: 'var(--r-sm)', border: '1px solid var(--border)' }} />
              <div style={{ marginTop: 8, font: '700 12px/1 var(--f-sans)', color: 'var(--ink)' }}>{c.name}</div>
              <code style={{ font: '600 10.5px/1.3 var(--f-mono)', color: 'var(--ink-soft)' }}>{c.token}</code>
              <div style={{ marginTop: 4, font: '500 10.5px/1 var(--f-mono)', color: 'var(--ink-mute)' }}>{c.val}</div>
            </div>
          ))}
        </div>
      </U.Card>

      <U.Card padded>
        <div className="eyebrow eyebrow-wine" style={{ marginBottom: 14 }}>SALUDO DEL DASHBOARD</div>
        <U.Input label="Mensaje de bienvenida" value="Buenos días, {{user_name}}." hint="Variables disponibles: {{user_name}}, {{user_role}}" />
      </U.Card>

      <SaveBar />
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// NIVEL INTERMEDIO
// ════════════════════════════════════════════════════════════

// ── 6. Permisos por rol ──────────────────────────────────────
function SectionPermissions() {
  const U = window.ERPUI;
  const roles = ['Admin. Tenant', 'Comercial', 'Operaciones', 'Contabilidad', 'Almacén CN', 'Soporte'];
  const modules = [
    'Dashboard', 'Embarques', 'Tracking', 'Calendario', 'Almacén CN', 'Almacén VE',
    'Cotizador', 'Clientes', 'CRM Leads', 'Tarifas', 'Facturación', 'Documentos',
    'Reportes', 'Mailing', 'Vault', 'Usuarios', 'Administración',
  ];
  // Permission matrix: V=view, C=create, E=edit, D=delete
  const perms = {
    Admin:         modules.reduce((a, m) => ({ ...a, [m]: 'VCED' }), {}),
    Comercial:     { 'Dashboard': 'V', 'Embarques': 'V', 'Tracking': 'V', 'Calendario': 'V', 'Cotizador': 'VCE', 'Clientes': 'VCE', 'CRM Leads': 'VCED', 'Tarifas': 'V', 'Facturación': 'V', 'Documentos': 'V', 'Reportes': 'V', 'Mailing': 'V' },
    Operaciones:   { 'Dashboard': 'V', 'Embarques': 'VCE', 'Tracking': 'VE', 'Calendario': 'V', 'Almacén CN': 'V', 'Almacén VE': 'VCE', 'Clientes': 'V', 'Documentos': 'VC', 'Mailing': 'V' },
    Contabilidad:  { 'Dashboard': 'V', 'Embarques': 'V', 'Facturación': 'VCED', 'Documentos': 'VC', 'Clientes': 'V', 'Reportes': 'V', 'Tarifas': 'V' },
    'Almacén CN':  { 'Dashboard': 'V', 'Almacén CN': 'VCE', 'Embarques': 'V' },
    Soporte:       { 'Dashboard': 'V', 'Embarques': 'V', 'Tracking': 'V', 'Clientes': 'V', 'Documentos': 'V', 'Mailing': 'V' },
  };
  const cellColor = (val) => {
    if (!val) return { bg: 'var(--bg-elevated)', txt: 'var(--ink-mute)', label: '—' };
    if (val === 'VCED') return { bg: 'var(--wine)', txt: '#fff', label: 'TOTAL' };
    if (val.includes('E') || val.includes('D')) return { bg: 'var(--success-bg)', txt: 'var(--success)', label: val };
    if (val.includes('C')) return { bg: 'var(--info-bg)', txt: 'var(--info)', label: val };
    return { bg: 'var(--bg-elevated)', txt: 'var(--ink-soft)', label: val };
  };

  return (
    <div>
      <U.Card padded style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', font: '500 12px/1.5 var(--f-sans)', color: 'var(--ink-soft)' }}>
          <b style={{ color: 'var(--ink)' }}>Códigos:</b>
          <span><b style={{ color: 'var(--ink-soft)' }}>V</b> ver</span>
          <span><b style={{ color: 'var(--info)' }}>C</b> crear</span>
          <span><b style={{ color: 'var(--success)' }}>E</b> editar</span>
          <span><b style={{ color: 'var(--danger)' }}>D</b> borrar</span>
          <span style={{ marginLeft: 'auto', font: '600 11px/1 var(--f-mono)', color: 'var(--ink-mute)' }}>{Object.keys(perms).length} roles × {modules.length} módulos</span>
        </div>
      </U.Card>

      <U.Card padded={false} style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
          <thead>
            <tr style={{ background: 'var(--bg-elevated)' }}>
              <th style={{ padding: '12px 16px', textAlign: 'left', font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase', position: 'sticky', left: 0, background: 'var(--bg-elevated)', zIndex: 2 }}>MÓDULO</th>
              {roles.map(r => (
                <th key={r} style={{ padding: '12px 8px', font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{r}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {modules.map((m, i) => (
              <tr key={m} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ padding: '10px 16px', font: '600 12.5px/1.2 var(--f-sans)', color: 'var(--ink)', position: 'sticky', left: 0, background: 'var(--bg-surface)', borderRight: '1px solid var(--border)' }}>{m}</td>
                {roles.map(r => {
                  const v = perms[r]?.[m] || '';
                  const c = cellColor(v);
                  return (
                    <td key={r} style={{ padding: '8px 6px', textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-block', minWidth: 44,
                        padding: '5px 8px', borderRadius: 'var(--r-sm)',
                        background: c.bg, color: c.txt,
                        font: '700 10.5px/1 var(--f-mono)', letterSpacing: '0.04em',
                      }}>{c.label}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </U.Card>
      <SaveBar label="Aplicar cambios de permisos" />
    </div>
  );
}

// ── 7. Audit log ─────────────────────────────────────────────
function SectionAudit() {
  const U = window.ERPUI;
  const [search, setSearch] = _aUseState('');
  const [actionFilter, setActionFilter] = _aUseState('all');

  const logs = [
    { time: 'hace 4 min',  user: 'Martina A.',  action: 'edit',   target: 'Cotización Q-2026-0421', detail: 'cambió total de $8,400 a $9,200' },
    { time: 'hace 18 min', user: 'Carlos V.',   action: 'create', target: 'Cliente DTD-5475',      detail: 'creó cliente: Mendoza & Cía CA' },
    { time: 'hace 1 h',    user: 'Yusneidy P.', action: 'edit',   target: 'Embarque DTDU-419032',   detail: 'estado: aduana VE → liberado' },
    { time: 'hace 2 h',    user: 'Andrés B.',   action: 'create', target: 'Factura F-2026-0445',    detail: 'emitida por $54,300' },
    { time: 'hace 3 h',    user: 'Carlos V.',   action: 'login',  target: '—',                       detail: 'IP 190.142.x.x · Caracas' },
    { time: 'hace 4 h',    user: 'Diego N.',    action: 'edit',   target: 'Lead L-0140',             detail: 'movió de "nuevo" a "demo"' },
    { time: 'hace 5 h',    user: 'Carlos V.',   action: 'config', target: 'Sistema · Mailing',       detail: 'activó proveedor Gmail Workspace' },
    { time: 'hace 8 h',    user: 'Wang H.',     action: 'create', target: 'Recepción CN-2026-2842', detail: 'recibió 18 cajas en YIW-A1' },
    { time: 'ayer 17:42',  user: 'Martina A.',  action: 'delete', target: 'Cotización Q-2026-0410', detail: 'eliminó borrador' },
    { time: 'ayer 16:18',  user: 'Carlos V.',   action: 'config', target: 'Usuario u-008',           detail: 'invitó: Carolina Méndez (Soporte)' },
    { time: 'ayer 14:05',  user: 'Andrés B.',   action: 'edit',   target: 'Factura F-2026-0391',    detail: 'registró pago $156,800 · saldo 0' },
    { time: 'ayer 11:30',  user: 'Sistema',     action: 'auto',   target: 'Cron · backup diario',    detail: 'backup completo a S3 · 4.2GB' },
  ];

  const filtered = logs.filter(l => {
    if (actionFilter !== 'all' && l.action !== actionFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!l.user.toLowerCase().includes(q) && !l.target.toLowerCase().includes(q) && !l.detail.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const actionMap = {
    create: { tone: 'success', label: 'CREÓ' },
    edit:   { tone: 'info',    label: 'EDITÓ' },
    delete: { tone: 'danger',  label: 'BORRÓ' },
    login:  { tone: 'neutral', label: 'LOGIN' },
    config: { tone: 'wine',    label: 'CONFIG' },
    auto:   { tone: 'neutral', label: 'AUTO' },
  };

  return (
    <div>
      <U.Toolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar por usuario, target o detalle…"
        filters={
          <U.Select value={actionFilter} onChange={(e)=>setActionFilter(e.target.value)} style={{ width: 160 }} options={[
            { value: 'all',    label: 'Todas las acciones' },
            { value: 'create', label: 'Crear' },
            { value: 'edit',   label: 'Editar' },
            { value: 'delete', label: 'Borrar' },
            { value: 'config', label: 'Config' },
            { value: 'login',  label: 'Login' },
            { value: 'auto',   label: 'Auto · sistema' },
          ]} />
        }
        actions={<U.Btn variant="secondary" size="sm" icon={window.Icon.download(12)}>Exportar CSV</U.Btn>}
      />

      <U.Card padded={false}>
        <div style={{ display: 'grid', gridTemplateColumns: '110px 80px 130px 1fr 1fr', padding: '10px 18px', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
          {['Cuando', 'Acción', 'Usuario', 'Target', 'Detalle'].map(h => (
            <span key={h} style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{h}</span>
          ))}
        </div>
        {filtered.map((l, i) => {
          const m = actionMap[l.action];
          return (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '110px 80px 130px 1fr 1fr',
              padding: '12px 18px', gap: 14, alignItems: 'center',
              borderTop: i > 0 ? '1px solid var(--border)' : 0,
            }}>
              <span style={{ font: '500 11.5px/1.3 var(--f-mono)', color: 'var(--ink-mute)' }}>{l.time}</span>
              <U.Badge tone={m.tone} size="sm">{m.label}</U.Badge>
              <span style={{ font: '600 12.5px/1 var(--f-sans)', color: 'var(--ink)' }}>{l.user}</span>
              <code style={{ font: '600 11.5px/1 var(--f-mono)', color: 'var(--ink)' }}>{l.target}</code>
              <span style={{ font: '500 12px/1.4 var(--f-sans)', color: 'var(--ink-soft)' }}>{l.detail}</span>
            </div>
          );
        })}
      </U.Card>
    </div>
  );
}

// ── 8. Numeración & legal ────────────────────────────────────
function SectionNumbering() {
  const U = window.ERPUI;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <U.Card padded>
        <div className="eyebrow eyebrow-wine" style={{ marginBottom: 14 }}>FORMATOS DE NUMERACIÓN</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            { label: 'MARKBOX cliente',  format: 'DTD-NNNN',     next: 'DTD-5476', counter: 5475 },
            { label: 'Embarques',        format: 'DTDU-NNNNNN',   next: 'DTDU-472817', counter: 472816 },
            { label: 'Cotizaciones',     format: 'Q-YYYY-NNNN',   next: 'Q-2026-0422', counter: 421 },
            { label: 'Facturas',         format: 'F-YYYY-NNNN',   next: 'F-2026-0446', counter: 445 },
            { label: 'Recepciones CN',   format: 'CN-YYYY-NNNN',  next: 'CN-2026-2843', counter: 2842 },
            { label: 'Recepciones VE',   format: 'VE-YYYY-NNNN',  next: 'VE-2026-1183', counter: 1182 },
          ].map(n => (
            <div key={n.label} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 80px', gap: 14, padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', alignItems: 'center' }}>
              <div>
                <div style={{ font: '700 13px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{n.label}</div>
                <div style={{ font: '500 11px/1.2 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 3 }}>contador interno: {n.counter}</div>
              </div>
              <code style={{ font: '700 13px/1 var(--f-mono)', color: 'var(--wine)' }}>{n.format}</code>
              <div>
                <div style={{ font: '600 10.5px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>SIGUIENTE</div>
                <code style={{ font: '800 13px/1 var(--f-mono)', color: 'var(--ink)', marginTop: 4, display: 'block' }}>{n.next}</code>
              </div>
              <button style={{ font: '600 11.5px/1 var(--f-sans)', color: 'var(--wine)', justifySelf: 'end' }}>Editar →</button>
            </div>
          ))}
        </div>
      </U.Card>

      <U.Card padded>
        <div className="eyebrow eyebrow-wine" style={{ marginBottom: 14 }}>LEYENDAS LEGALES EN FACTURAS</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div style={{ font: '600 11px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 6 }}>Texto pie de página</div>
            <textarea rows={3} defaultValue="DTD-Cargo CA · RIF J-30182554-9 · Contribuyente especial · Resolución SENIAT 2023-1842 · Imprenta autorizada Nº 2024-3318."
              style={{ width: '100%', padding: 12, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', font: '500 12.5px/1.6 var(--f-sans)', color: 'var(--ink)', resize: 'vertical' }}
            />
          </div>
          <div>
            <div style={{ font: '600 11px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 6 }}>Términos y condiciones</div>
            <textarea rows={4} defaultValue="Tarifa cerrada DDP incluye flete marítimo, aduana, impuestos de importación y entrega final puerta a puerta. No incluye carga peligrosa, productos restringidos por SENIAT ni mercadería que requiera permisos especiales. Pago a 30 días desde emisión de factura."
              style={{ width: '100%', padding: 12, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', font: '500 12.5px/1.6 var(--f-sans)', color: 'var(--ink)', resize: 'vertical' }}
            />
          </div>
        </div>
      </U.Card>

      <SaveBar />
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// NIVEL PRO
// ════════════════════════════════════════════════════════════

// ── 9. API keys & webhooks ───────────────────────────────────
function SectionApi() {
  const U = window.ERPUI;
  const [tab, setTab] = _aUseState('keys');

  return (
    <div>
      <U.Tabs value={tab} onChange={setTab} items={[
        { value: 'keys',     label: 'API Keys',     count: 3 },
        { value: 'webhooks', label: 'Webhooks',     count: 4 },
        { value: 'docs',     label: 'Documentación' },
      ]} style={{ marginBottom: 'var(--s-4)' }} />

      {tab === 'keys' && (
        <div>
          <U.Card padded style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ color: 'var(--warning)' }}>{window.Icon.warn(14)}</span>
              <div style={{ font: '500 12.5px/1.5 var(--f-sans)', color: 'var(--ink)', flex: 1 }}>
                Las API keys dan acceso programático al ERP. Compartilas solo con sistemas confiables (Cargowise, SAP, Odoo).
              </div>
              <U.Btn variant="primary" size="sm" icon={window.Icon.plus(12)}>Generar API key</U.Btn>
            </div>
          </U.Card>

          <U.Card padded={false}>
            {[
              { name: 'Cargowise · prod',   key: 'dtd_live_•••••••••••••42x9',   scopes: 'read · write', used: '14 min',  status: 'active' },
              { name: 'Odoo integration',   key: 'dtd_live_•••••••••••••88aZ',   scopes: 'read',         used: '2 h',     status: 'active' },
              { name: 'BI reports · staging',key: 'dtd_test_•••••••••••••3vP',   scopes: 'read',         used: 'hace 7d', status: 'inactive' },
            ].map((k, i) => (
              <div key={i} style={{
                display: 'grid', gridTemplateColumns: '1fr 1.6fr 100px 110px 80px',
                gap: 14, padding: '14px 18px', alignItems: 'center',
                borderTop: i > 0 ? '1px solid var(--border)' : 0,
              }}>
                <div>
                  <div style={{ font: '700 13px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{k.name}</div>
                  <div style={{ font: '500 11px/1.2 var(--f-mono)', color: 'var(--ink-mute)', marginTop: 3 }}>último uso: {k.used}</div>
                </div>
                <code style={{ font: '700 12.5px/1 var(--f-mono)', color: 'var(--ink-soft)', padding: '6px 10px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-sm)' }}>{k.key}</code>
                <U.Badge tone="info" size="sm">{k.scopes}</U.Badge>
                <U.Badge tone={k.status === 'active' ? 'success' : 'neutral'} size="sm" dot>{k.status}</U.Badge>
                <div style={{ display: 'inline-flex', gap: 4, justifyContent: 'flex-end' }}>
                  <button style={{ width: 26, height: 26, color: 'var(--ink-soft)' }} title="Copiar">{window.Icon.copy(13)}</button>
                  <button style={{ width: 26, height: 26, color: 'var(--ink-soft)' }} title="Revocar">{window.Icon.trash(13)}</button>
                </div>
              </div>
            ))}
          </U.Card>
        </div>
      )}

      {tab === 'webhooks' && (
        <U.Card padded={false}>
          {[
            { event: 'shipment.status_changed', url: 'https://hooks.acindar.ve/dtd/status',       success: 142, fail: 0, last: '4 min' },
            { event: 'shipment.delivered',       url: 'https://api.polar.com.ve/v2/shipments',    success: 32,  fail: 1, last: 'ayer' },
            { event: 'invoice.created',          url: 'https://contabilidad.dtd.com/incoming',    success: 78,  fail: 0, last: '2 h' },
            { event: 'quote.accepted',           url: 'https://crm.dtd.com/leads/won',            success: 22,  fail: 2, last: '1 sem' },
          ].map((w, i) => (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '180px 1fr 90px 70px 80px',
              gap: 14, padding: '14px 18px', alignItems: 'center',
              borderTop: i > 0 ? '1px solid var(--border)' : 0,
            }}>
              <code style={{ font: '700 12px/1 var(--f-mono)', color: 'var(--wine)' }}>{w.event}</code>
              <code style={{ font: '500 11.5px/1.3 var(--f-mono)', color: 'var(--ink-soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.url}</code>
              <div>
                <span style={{ font: '700 12px/1 var(--f-mono)', color: 'var(--success)' }}>{w.success}</span>
                <span style={{ font: '500 11px/1 var(--f-sans)', color: 'var(--ink-mute)', marginLeft: 4 }}>OK</span>
              </div>
              {w.fail > 0
                ? <U.Badge tone="danger" size="sm">{w.fail} fail</U.Badge>
                : <U.Badge tone="success" size="sm" dot>100% ok</U.Badge>
              }
              <span style={{ font: '500 11px/1 var(--f-mono)', color: 'var(--ink-mute)', textAlign: 'right' }}>{w.last}</span>
            </div>
          ))}
        </U.Card>
      )}

      {tab === 'docs' && (
        <U.Card padded>
          <div style={{ font: '500 13px/1.6 var(--f-sans)', color: 'var(--ink)' }}>
            Base URL: <code style={{ font: '700 12.5px/1 var(--f-mono)', color: 'var(--wine)', padding: '4px 8px', background: 'var(--wine-tint)', borderRadius: 'var(--r-sm)' }}>https://api.dtdcargo.com/v1</code>
          </div>
          <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { method: 'GET',  path: '/shipments',           desc: 'Listar embarques (paginado)' },
              { method: 'GET',  path: '/shipments/{id}',      desc: 'Detalle de un embarque + eventos' },
              { method: 'POST', path: '/quotes',              desc: 'Crear cotización · devuelve total DDP' },
              { method: 'POST', path: '/shipments/{id}/track', desc: 'Push de evento operativo' },
              { method: 'GET',  path: '/invoices',            desc: 'Listar facturas del cliente autenticado' },
            ].map((e, i) => {
              const c = e.method === 'GET' ? 'var(--success)' : 'var(--info)';
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)' }}>
                  <span style={{ padding: '3px 8px', borderRadius: 3, background: c, color: '#fff', font: '700 10.5px/1 var(--f-mono)' }}>{e.method}</span>
                  <code style={{ font: '700 12.5px/1 var(--f-mono)', color: 'var(--ink)' }}>{e.path}</code>
                  <span style={{ marginLeft: 'auto', font: '500 12px/1 var(--f-sans)', color: 'var(--ink-soft)' }}>{e.desc}</span>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 14 }}>
            <U.Btn variant="primary" icon={window.Icon.external(12)}>Ver documentación completa</U.Btn>
          </div>
        </U.Card>
      )}
    </div>
  );
}

// ── 10. Workflows custom ─────────────────────────────────────
function SectionWorkflows() {
  const U = window.ERPUI;
  const flow = window.ERPData.STATUS_FLOW;
  const tones = window.ERPData.STATUS_TONE;

  return (
    <div>
      <U.Card padded style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <span style={{ color: 'var(--warning)' }}>{window.Icon.warn(14)}</span>
          <div style={{ font: '500 12.5px/1.5 var(--f-sans)', color: 'var(--ink)' }}>
            Editar el flujo de estados afecta todos los embarques actuales y futuros. Las reglas de notificación (Mailing → Reglas auto.) referencian estos estados — si los cambiás, revisalas.
          </div>
        </div>
      </U.Card>

      <U.Card padded>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div className="eyebrow eyebrow-wine">FLUJO DE EMBARQUES</div>
            <div style={{ font: '900 15px/1.1 var(--f-display)', color: 'var(--ink)', marginTop: 6 }}>{flow.length} estados encadenados</div>
          </div>
          <U.Btn variant="primary" size="sm" icon={window.Icon.plus(12)}>Agregar estado</U.Btn>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {flow.map((s, i) => {
            const tone = tones[s] || 'neutral';
            return (
              <div key={s} style={{
                display: 'grid', gridTemplateColumns: '40px 140px 1fr 110px 90px 80px',
                gap: 12, alignItems: 'center',
                padding: '12px 14px',
                background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)',
                borderLeft: `3px solid var(--${tone === 'wine' ? 'wine' : tone === 'success' ? 'success' : tone === 'warning' ? 'warning' : tone === 'info' ? 'info' : 'ink-soft'})`,
              }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: '50%', background: 'var(--bg-surface)', font: '800 12px/1 var(--f-mono)', color: 'var(--ink)' }}>{i+1}</span>
                <U.Badge tone={tone} size="md" dot>{s}</U.Badge>
                <U.Input value={s} style={{ margin: 0 }} />
                <U.Select value={tone} options={['wine','success','warning','info','neutral','danger']} />
                <span style={{ font: '500 11px/1.3 var(--f-sans)', color: 'var(--ink-soft)' }}>{i === 0 ? 'Inicial' : i === flow.length-1 ? 'Final' : 'Intermedio'}</span>
                <div style={{ display: 'inline-flex', gap: 4, justifyContent: 'flex-end' }}>
                  <button style={{ width: 24, height: 24, color: 'var(--ink-soft)' }} title="Mover arriba">{window.Icon.chevU(12)}</button>
                  <button style={{ width: 24, height: 24, color: 'var(--ink-soft)' }} title="Mover abajo">{window.Icon.chevD(12)}</button>
                  <button style={{ width: 24, height: 24, color: 'var(--ink-soft)' }} title="Borrar">{window.Icon.trash(12)}</button>
                </div>
              </div>
            );
          })}
        </div>
      </U.Card>

      <SaveBar label="Aplicar workflow" />
    </div>
  );
}

// ── 11. Importar / Exportar ──────────────────────────────────
function SectionImport() {
  const U = window.ERPUI;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <U.Card padded>
        <div className="eyebrow eyebrow-wine" style={{ marginBottom: 14 }}>IMPORTAR DESDE EXCEL/CSV</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {[
            { l: 'Clientes',  i: 'users',    desc: 'Cargar clientes en lote con MARKBOX' },
            { l: 'Embarques', i: 'box',      desc: 'Importar embarques históricos' },
            { l: 'Tarifas',   i: 'tag',      desc: 'Subir tarifario completo' },
            { l: 'Facturas',  i: 'invoice',  desc: 'Importar facturación histórica' },
            { l: 'Leads',     i: 'spark',    desc: 'Bulk-load desde lista de prospects' },
            { l: 'Productos / HS', i: 'doc',  desc: 'Catálogo de HS codes' },
          ].map(t => (
            <button key={t.l} style={{
              padding: 16, textAlign: 'left',
              background: 'var(--bg-elevated)', border: '1px solid var(--border)',
              borderRadius: 'var(--r-md)',
            }}>
              <span style={{ color: 'var(--wine)' }}>{window.Icon[t.i](18)}</span>
              <div style={{ marginTop: 10, font: '800 13px/1.2 var(--f-display)', color: 'var(--ink)' }}>{t.l}</div>
              <div style={{ marginTop: 4, font: '500 11.5px/1.4 var(--f-sans)', color: 'var(--ink-soft)' }}>{t.desc}</div>
              <div style={{ marginTop: 10, font: '700 11.5px/1 var(--f-sans)', color: 'var(--wine)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                {window.Icon.upload(11)} Subir CSV
              </div>
            </button>
          ))}
        </div>
      </U.Card>

      <U.Card padded>
        <div className="eyebrow eyebrow-wine" style={{ marginBottom: 14 }}>EXPORTAR & BACKUP</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { l: 'Backup completo · JSON', desc: 'Toda la data del ERP en un archivo cifrado', size: '~4.2 GB', last: 'ayer 03:00 AM' },
            { l: 'Clientes · CSV',         desc: '187 registros', size: '128 KB', last: 'manual' },
            { l: 'Embarques YTD · Excel',  desc: '412 embarques con eventos', size: '2.4 MB', last: 'manual' },
            { l: 'Facturación · PDF',      desc: 'Libro de ventas Q2 2026', size: '8.1 MB', last: 'manual' },
          ].map((e, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 100px 110px 90px', gap: 14, padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', alignItems: 'center' }}>
              <div style={{ font: '700 13px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{e.l}</div>
              <div style={{ font: '500 11.5px/1.3 var(--f-sans)', color: 'var(--ink-soft)' }}>{e.desc}</div>
              <code style={{ font: '700 11.5px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>{e.size}</code>
              <span style={{ font: '500 11px/1 var(--f-mono)', color: 'var(--ink-mute)' }}>{e.last}</span>
              <U.Btn variant="secondary" size="sm" icon={window.Icon.download(12)}>Descargar</U.Btn>
            </div>
          ))}
        </div>
      </U.Card>

      <U.Card padded>
        <div className="eyebrow eyebrow-wine" style={{ marginBottom: 12 }}>BACKUP AUTOMÁTICO</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <U.Select label="Frecuencia" options={['Diario · 03:00 AM', 'Cada 6 horas', 'Solo manual']} />
          <U.Select label="Retención" options={['30 días', '90 días', '1 año', 'Permanente']} />
          <U.Select label="Destino" options={['AWS S3 (configurado)', 'Google Cloud Storage', 'Local · disco propio']} />
          <U.Input label="Bucket" value="dtd-backups-prod" mono />
        </div>
      </U.Card>
    </div>
  );
}

// ── Save bar ─────────────────────────────────────────────────
function SaveBar({ label = 'Guardar cambios' }) {
  const U = window.ERPUI;
  return (
    <div style={{
      position: 'sticky', bottom: 12,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14,
      padding: '12px 16px', background: 'var(--bg-surface)',
      border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
      boxShadow: 'var(--shadow-md)',
    }}>
      <div style={{ font: '500 12px/1.4 var(--f-sans)', color: 'var(--ink-soft)' }}>
        Cambios pendientes · se aplicarán a todo el ERP cuando guardes.
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <U.Btn variant="ghost" size="sm">Descartar</U.Btn>
        <U.Btn variant="primary" size="sm" icon={window.Icon.check(12)}>{label}</U.Btn>
      </div>
    </div>
  );
}

window.ModuleAdmin = ModuleAdmin;

// ── Casos de uso · Feature flags ─────────────────────────────
function SectionFeatures() {
  const U = window.ERPUI;
  const [flags, , toggleFlag] = window.DTDFlags.useFeatureFlags();

  const toggle = (k) => toggleFlag(k);

  const groups = [
    {
      label: 'Servicios operativos',
      items: [
        { k: 'customs_seniat',    name: 'Aduana SENIAT · workflow',  desc: 'Checklist DUA, agente aduanal, tracking de liberación. Activá si DTD-Cargo hace el trámite aduanero (sino el agente externo lo hace).', module: 'embarques' },
        { k: 'cargo_insurance',   name: 'Seguro de carga',           desc: 'Cotización y emisión de seguro por embarque. Algunos clientes lo piden, otros traen seguro propio.', module: 'embarques' },
        { k: 'warehouse_location', name: 'Ubicación en bodega · pasillo · zona · estante', desc: 'Muestra al bodeguero/camionero la ubicación física exacta del paquete en bodega VE. Útil para bodegas grandes con sistema de localizaciones. Por defecto OFF — DTD-Cargo aún no usa codificación interna de bodega.', module: 'almacén VE · bodeguero', defaultOn: false },
                { k: 'consolidation_partial', name: 'Consolidación parcial', desc: 'Permite partir un envío en P1/P2 cuando no entra completo. Recomendado para todos los freight forwarders.', module: 'almacén CN' },
        { k: 'hs_autodetect',     name: 'Auto-detección HS · IA',    desc: 'Detecta código HS desde fotos de la caja. Útil cuando el supplier no lo provee.', module: 'almacén CN' },
        { k: 'sustainability',    name: 'Tracking CO₂ · sostenibilidad', desc: 'Calcula emisiones por embarque. Algunos clientes corporativos lo exigen.', module: 'reportes' },
      ],
    },
    {
      label: 'Comunicación con cliente',
      items: [
        { k: 'whatsapp',          name: 'WhatsApp Business',         desc: 'Canal paralelo al email para alertas. Requiere Meta Business Account.', module: 'mailing' },
        { k: 'email_sequences',   name: 'Email sequences CRM',       desc: 'Secuencias automáticas para nurturing de leads (día 0, 3, 7, 14).', module: 'crm' },
        { k: 'branding_xcliente', name: 'White-label por cliente',   desc: 'Clientes Platinum reciben correos con su propio branding.', module: 'mailing' },
        { k: 'cn_translation',    name: 'Traductor CN ↔ ES',         desc: 'Toggle de idioma + traducción de proveedores chinos.', module: 'almacén CN' },
        { k: 'comments',          name: 'Comentarios + @menciones',  desc: 'Hilos de comentarios en embarques/clientes/facturas con menciones.', module: 'global' },
        { k: 'portal_cliente',    name: 'Portal externo del cliente', desc: 'Permite que clientes se logueen y vean sus envíos. Si lo apagás, solo se comunica por email.', module: 'global' },
      ],
    },
    {
      label: 'Sistema y seguridad',
      items: [
        { k: 'vault',             name: 'Vault de contraseñas',      desc: 'Caja fuerte para credenciales del equipo. Activala si vas a guardar passwords de aduana, navieras, etc.', module: 'sistema' },
        { k: 'audit_log',         name: 'Audit log',                 desc: 'Registra todas las acciones del equipo. Obligatorio si tu cliente exige compliance.', module: 'sistema' },
        { k: 'api_public',        name: 'API pública',               desc: 'Expone endpoints REST para integraciones con clientes (Polar, Acindar). Requiere docs públicas.', module: 'sistema' },
        { k: 'webhooks',          name: 'Webhooks salientes',        desc: 'Envía eventos del ERP a sistemas externos (Cargowise, Odoo, SAP del cliente).', module: 'sistema' },
        { k: 'sso',               name: 'Single Sign-On (SSO)',      desc: 'Login con Google/Microsoft del equipo. Requiere plan empresarial.', module: 'sistema' },
        { k: 'backup_auto',       name: 'Backup automático',         desc: 'Snapshot diario de toda la data del ERP. Configurable a S3, GCS, o local.', module: 'sistema' },
        { k: 'mobile_operator',   name: 'App móvil operario CN',     desc: 'App mobile-only para Wang en almacén Yiwu. Solo recepción de cajas.', module: 'almacén CN' },
      ],
    },
    {
      label: 'Finanzas',
      items: [
        { k: 'multi_currency',    name: 'Multi-moneda',              desc: 'USD + VES (BCV y paralelo) + CNY. Si solo facturás en USD, apagá esto.', module: 'finanzas' },
        { k: 'ai_copilot',        name: 'AI Copilot conversacional', desc: 'Chatbot en el ERP que responde preguntas en lenguaje natural. Beta · uso experimental.', module: 'global' },
      ],
    },
  ];

  const activeCount = Object.values(flags).filter(Boolean).length;
  const totalCount = Object.keys(flags).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Hero */}
      <U.Card padded style={{ background: 'linear-gradient(135deg, var(--ink) 0%, #1F3055 100%)', border: 0, color: '#fff' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 18, alignItems: 'center' }}>
          <div>
            <div style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--wine-soft)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>FEATURE FLAGS · CASOS DE USO</div>
            <div style={{ font: '900 18px/1.1 var(--f-display)', color: '#fff', marginTop: 6 }}>Activá solo lo que tu empresa usa</div>
            <div style={{ marginTop: 8, font: '500 12px/1.5 var(--f-sans)', color: 'rgba(255,255,255,0.65)', maxWidth: '52ch' }}>
              No todos los freight forwarders necesitan todo. Si <b style={{ color: '#fff' }}>no manejás aduana SENIAT</b> internamente (lo hace un agente externo), apagá ese módulo y desaparece del ERP. Lo mismo con seguro de carga, sostenibilidad, etc.
            </div>
          </div>
          <StatChip label="Activas" value={activeCount} color="var(--wine-soft)" />
          <StatChip label="Apagadas" value={totalCount - activeCount} color="rgba(255,255,255,0.4)" />
          <StatChip label="Total" value={totalCount} color="#fff" />
        </div>
      </U.Card>

      {/* Feature groups */}
      {groups.map(g => (
        <U.Card key={g.label} padded>
          <div className="eyebrow eyebrow-wine" style={{ marginBottom: 14 }}>{g.label}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {g.items.map(it => {
              const isOn = flags[it.k];
              return (
                <div key={it.k} style={{
                  display: 'grid', gridTemplateColumns: '1fr 100px 60px',
                  gap: 14, alignItems: 'center',
                  padding: '12px 14px',
                  background: isOn ? 'var(--bg-elevated)' : 'transparent',
                  border: `1px solid ${isOn ? 'var(--border-strong)' : 'var(--border)'}`,
                  borderRadius: 'var(--r-md)',
                  borderLeft: `3px solid ${isOn ? 'var(--success)' : 'var(--border-strong)'}`,
                  opacity: isOn ? 1 : 0.7,
                  transition: 'all var(--dur-fast) var(--ease)',
                }}>
                  <div>
                    <div style={{ font: '700 13px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{it.name}</div>
                    <div style={{ font: '500 11.5px/1.5 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 4 }}>{it.desc}</div>
                  </div>
                  <U.Badge tone="neutral" size="sm">{it.module}</U.Badge>
                  <Toggle on={isOn} onChange={() => toggle(it.k)} />
                </div>
              );
            })}
          </div>
        </U.Card>
      ))}

      <div style={{ padding: '12px 14px', background: 'var(--info-bg)', borderRadius: 'var(--r-md)', display: 'flex', gap: 10 }}>
        <span style={{ color: 'var(--info)' }}>{window.Icon.info(13)}</span>
        <div style={{ font: '500 12px/1.5 var(--f-sans)', color: 'var(--ink)' }}>
          Apagar un caso de uso <b>oculta</b> sus botones y módulos del ERP completo · no borra data. Podés re-activarlo en cualquier momento y todo vuelve a aparecer.
        </div>
      </div>
    </div>
  );
}

function StatChip({ label, value, color }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ font: '700 9.5px/1 var(--f-sans)', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ font: '900 24px/1 var(--f-display)', color, marginTop: 6, letterSpacing: '-0.02em' }}>{value}</div>
    </div>
  );
}

function Toggle({ on, onChange }) {
  return (
    <button onClick={onChange} style={{
      width: 46, height: 24, padding: 2,
      borderRadius: 'var(--r-pill)',
      background: on ? 'var(--success)' : 'var(--border-strong)',
      transition: 'background var(--dur-fast) var(--ease)',
      cursor: 'pointer', justifySelf: 'end',
    }} title={on ? 'ENCENDIDO · click para apagar' : 'APAGADO · click para encender'}>
      <div style={{
        width: 18, height: 18, borderRadius: '50%',
        background: '#fff',
        transform: `translateX(${on ? 22 : 0}px)`,
        transition: 'transform var(--dur-fast) var(--ease)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </button>
  );
}

// ── Sync header for code lists (HS · AES) ────────────────────
function CodesSyncHeader({ source }) {
  const U = window.ERPUI;
  const [syncing, setSyncing] = React.useState(false);
  const [expanded, setExpanded] = React.useState(true);
  const [activeSource, setActiveSource] = React.useState('api');
  const lsKey = `dtd_codes_lastsync_${source}`;
  const [lastSync, setLastSync] = React.useState(() => {
    try { return localStorage.getItem(lsKey); } catch (e) { return null; }
  });
  const [, force] = React.useReducer(x => x + 1, 0);

  // Re-render cada 30s para actualizar "hace X min"
  React.useEffect(() => {
    const t = setInterval(force, 30000);
    return () => clearInterval(t);
  }, []);

  function fmtAgo(iso) {
    if (!iso) return null;
    const diff = Date.now() - new Date(iso).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return 'recién';
    if (min < 60) return `hace ${min} min`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `hace ${hr} h`;
    return `hace ${Math.floor(hr / 24)} d`;
  }

  const cfg = source === 'hscodes'
    ? {
        label: 'HS Codes · Organización Mundial de Aduanas',
        sources: {
          api:     { name: 'API oficial OMA', endpoint: 'api.wcoomd.org/v3/hs',           status: 'green',  latency: '142ms', desc: 'Endpoint REST oficial · necesita API key' },
          scraper: { name: 'Web scraper',     endpoint: 'wcoomd.org/en/topics/nomenclature/instrument-and-tools', status: 'green', latency: '1.4s', desc: 'HTML scraping de la web pública' },
          pdf:     { name: 'PDF parser',      endpoint: 'wcoomd.org/.../HS_2022_*.pdf',    status: 'amber',  latency: '8.2s', desc: 'OCR del PDF oficial · solo si las otras fallan' },
        },
        nextSync: 'en 17 h',
        changes30d: 48,
      }
    : {
        label: 'Aranceles Aduanas · SENIAT Venezuela',
        sources: {
          api:     { name: 'API SENIAT',       endpoint: 'seniat.gob.ve/api/v1/aranceles',  status: 'red',    latency: 'timeout', desc: 'No respondió · esperando docs oficiales' },
          scraper: { name: 'Portal Aduanas',   endpoint: 'aduanas.gob.ve/clasificacion',     status: 'green',  latency: '2.1s',    desc: 'HTML scraping del listado oficial' },
          pdf:     { name: 'Gaceta Oficial · PDF', endpoint: 'mppef.gob.ve/gaceta/decreto-arancel-*.pdf', status: 'green', latency: '12s', desc: 'OCR del decreto vigente · gaceta más reciente' },
        },
        nextSync: 'en 6 h',
        changes30d: 124,
      };

  const refresh = () => {
    setSyncing(true);
    setTimeout(() => {
      const now = new Date().toISOString();
      try { localStorage.setItem(lsKey, now); } catch (e) {}
      setLastSync(now);
      setSyncing(false);
    }, 1400);
  };
  const active = cfg.sources[activeSource];

  return (
    <div style={{ marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* ── TOP CARD: Status hero ─────────────────────────── */}
      <U.Card padded style={{ background: 'linear-gradient(135deg, var(--ink) 0%, #1F3055 100%)', border: 0, color: '#fff' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 18, alignItems: 'center' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                background: syncing ? '#DCAB6B' : '#7CE3A5',
                animation: syncing ? 'erp-shimmer 1s infinite' : 'none',
              }} />
              <span style={{ font: '700 10.5px/1 var(--f-sans)', color: 'rgba(255,255,255,0.55)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                {syncing ? 'SINCRONIZANDO…' : `CONECTADO · vía ${active.name}`}
              </span>
            </div>
            <div style={{ font: '900 16px/1.1 var(--f-display)', color: '#fff', letterSpacing: '-0.01em' }}>{cfg.label}</div>
            <div style={{ marginTop: 6, font: '500 11.5px/1.4 var(--f-mono)', color: 'rgba(255,255,255,0.6)' }}>{active.endpoint}</div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ font: '700 10.5px/1 var(--f-sans)', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>ÚLTIMA / PRÓXIMA SYNC</div>
            <div style={{ font: '800 13px/1 var(--f-mono)', color: '#fff', marginTop: 5 }}>
              {lastSync ? fmtAgo(lastSync) : '—'} <span style={{ opacity: 0.5 }}>·</span> {cfg.nextSync}
            </div>
            <div style={{ font: '600 11px/1 var(--f-sans)', color: 'var(--wine-soft)', marginTop: 4 }}>{cfg.changes30d} cambios · 30d</div>
          </div>

          <button onClick={refresh} disabled={syncing} style={{
            padding: '10px 14px', borderRadius: 'var(--r-md)',
            background: 'rgba(255,255,255,0.10)', color: '#fff',
            border: '1px solid rgba(255,255,255,0.18)',
            display: 'inline-flex', alignItems: 'center', gap: 8,
            font: '700 12.5px/1 var(--f-sans)',
            opacity: syncing ? 0.5 : 1, cursor: syncing ? 'not-allowed' : 'pointer',
          }}>
            <span style={{ display: 'inline-flex', animation: syncing ? 'erp-fade 0.6s infinite alternate' : 'none' }}>{window.Icon.refresh(13)}</span>
            {syncing ? 'Sincronizando…' : 'Refrescar ahora'}
          </button>

          <button onClick={() => setExpanded(v => !v)} style={{
            padding: '10px 14px', borderRadius: 'var(--r-md)',
            background: 'rgba(255,255,255,0.10)', color: '#fff',
            border: '1px solid rgba(255,255,255,0.18)',
            display: 'inline-flex', alignItems: 'center', gap: 8,
            font: '700 12.5px/1 var(--f-sans)',
          }}>
            {window.Icon.cog(13)} {expanded ? 'Ocultar config' : 'Configurar'}
          </button>
        </div>
      </U.Card>

      {expanded && (
        <>
          {/* ── 3-tier source cascade ─────────────────────── */}
          <U.Card padded>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div>
                <div className="eyebrow eyebrow-wine">FUENTES EN CASCADA</div>
                <div style={{ font: '900 14px/1.1 var(--f-display)', color: 'var(--ink)', marginTop: 6 }}>3 niveles de fallback automático</div>
              </div>
              <span style={{ font: '500 11.5px/1.4 var(--f-sans)', color: 'var(--ink-soft)', maxWidth: '38ch', textAlign: 'right' }}>
                Si la fuente activa falla, el sistema salta automáticamente a la siguiente disponible.
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {[
                { key: 'api',     priority: 1, label: 'API oficial',    icon: 'link' },
                { key: 'scraper', priority: 2, label: 'Web scraper',    icon: 'globe' },
                { key: 'pdf',     priority: 3, label: 'PDF parser',     icon: 'doc' },
              ].map(t => {
                const s = cfg.sources[t.key];
                const isActive = activeSource === t.key;
                const statusColor = { green: 'var(--success)', amber: 'var(--warning)', red: 'var(--danger)' }[s.status];
                const statusLabel = { green: 'OK', amber: 'lento', red: 'caído' }[s.status];
                return (
                  <button key={t.key} onClick={() => setActiveSource(t.key)} style={{
                    padding: 14, textAlign: 'left',
                    background: isActive ? 'var(--wine-tint)' : 'var(--bg-surface)',
                    border: `1.5px solid ${isActive ? 'var(--wine)' : 'var(--border)'}`,
                    borderRadius: 'var(--r-md)',
                    position: 'relative',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          width: 24, height: 24, borderRadius: 'var(--r-sm)',
                          background: isActive ? 'var(--wine)' : 'var(--bg-elevated)',
                          color: isActive ? '#fff' : 'var(--ink-soft)',
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          font: '800 11px/1 var(--f-mono)',
                        }}>{t.priority}</span>
                        <span style={{ font: '800 13px/1.1 var(--f-display)', color: 'var(--ink)' }}>{t.label}</span>
                      </div>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: statusColor }} />
                        <span style={{ font: '700 10px/1 var(--f-sans)', color: statusColor, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{statusLabel}</span>
                      </div>
                    </div>
                    <div style={{ font: '500 11.5px/1.4 var(--f-sans)', color: 'var(--ink-soft)' }}>{s.desc}</div>
                    <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', font: '600 10.5px/1 var(--f-mono)', color: 'var(--ink-mute)' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>{s.endpoint}</span>
                      <span>{s.latency}</span>
                    </div>
                    {isActive && (
                      <div style={{ position: 'absolute', top: 8, right: 8, padding: '2px 6px', background: 'var(--wine)', color: '#fff', borderRadius: 3, font: '700 9px/1 var(--f-sans)', letterSpacing: '0.08em' }}>ACTIVA</div>
                    )}
                  </button>
                );
              })}
            </div>

            <div style={{ marginTop: 14, padding: '12px 14px', background: 'var(--info-bg)', borderRadius: 'var(--r-md)', display: 'flex', gap: 10 }}>
              <span style={{ color: 'var(--info)' }}>{window.Icon.info(13)}</span>
              <div style={{ font: '500 12px/1.5 var(--f-sans)', color: 'var(--ink)' }}>
                <b>¿Cómo funciona?</b> Click en una fuente para usarla manualmente. En automático, el sistema empieza por la #1 — si falla, prueba con la #2, después la #3. Te avisa por email cada vez que cambia de fuente.
              </div>
            </div>
          </U.Card>

          {/* ── Sync config + Notifications ──────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <U.Card padded>
              <div className="eyebrow eyebrow-wine" style={{ marginBottom: 14 }}>CONFIGURACIÓN DE SYNC</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <U.Select label="Frecuencia" options={['Cada hora', 'Cada 6 horas', 'Diario · 03:00 AM', 'Semanal · lunes 9 AM', 'Solo manual']} />
                <U.Select label="Reintentos en fallo" options={['3 intentos · cada 5 min', '5 intentos · backoff exponencial', 'Sin reintentos']} />
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', cursor: 'pointer' }}>
                  <input type="checkbox" defaultChecked style={{ accentColor: 'var(--wine)' }} />
                  <span style={{ font: '500 12.5px/1.4 var(--f-sans)', color: 'var(--ink)' }}>Auto-fallback entre fuentes si la activa falla</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <input type="checkbox" defaultChecked style={{ accentColor: 'var(--wine)' }} />
                  <span style={{ font: '500 12.5px/1.4 var(--f-sans)', color: 'var(--ink)' }}>Generar PDF changelog tras cada sync</span>
                </label>
              </div>
            </U.Card>

            <U.Card padded>
              <div className="eyebrow eyebrow-wine" style={{ marginBottom: 14 }}>NOTIFICACIONES</div>
              <div style={{ font: '500 12px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginBottom: 10 }}>
                Cuando los códigos cambien, avisar a:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  { who: 'Operaciones', cond: 'cualquier cambio',      ch: 'in-app + email', def: true },
                  { who: 'Contabilidad', cond: 'cambios de arancel ≥ 5pts', ch: 'in-app + email + WhatsApp', def: true },
                  { who: 'Dirección',   cond: 'solo cambios críticos', ch: 'email semanal · digest', def: true },
                  { who: 'Comercial',   cond: 'cambios que afectan cotizaciones activas', ch: 'in-app', def: false },
                ].map((n, i) => (
                  <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-sm)', cursor: 'pointer' }}>
                    <input type="checkbox" defaultChecked={n.def} style={{ accentColor: 'var(--wine)' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ font: '700 12px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{n.who}</div>
                      <div style={{ font: '500 10.5px/1.3 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 2 }}>{n.cond} · <code style={{ fontFamily: 'var(--f-mono)' }}>{n.ch}</code></div>
                    </div>
                  </label>
                ))}
              </div>
            </U.Card>
          </div>

          {/* ── Changelog preview ───────────────────────── */}
          <U.Card padded>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div>
                <div className="eyebrow eyebrow-wine">CHANGELOG · ÚLTIMOS 14 DÍAS</div>
                <div style={{ font: '900 14px/1.1 var(--f-display)', color: 'var(--ink)', marginTop: 6 }}>{source === 'hscodes' ? '4 cambios' : '12 cambios'} recientes</div>
              </div>
              <U.Btn variant="secondary" size="sm" icon={window.Icon.eye(12)}>Ver completo</U.Btn>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {(source === 'hscodes' ? [
                { type: 'modified', code: '8517.12', desc: 'Teléfonos móviles · subdivisión nueva para 5G',  date: '21 may 2026', source: 'WCO Edition 2026' },
                { type: 'new',      code: '8543.71', desc: 'Equipos de carga inalámbrica',                    date: '14 may 2026', source: 'WCO Edition 2026' },
                { type: 'removed',  code: '8519.30', desc: 'Tocadiscos · obsoletos',                          date: '10 may 2026', source: 'WCO Edition 2026' },
                { type: 'modified', code: '6109.10', desc: 'T-shirts · clarificación de fibras mixtas',       date: '08 may 2026', source: 'WCO Edition 2026' },
              ] : [
                { type: 'modified', code: '6109.10.10', desc: 'T-shirts algodón · arancel 22% → 25% (protección industria local)', date: '22 may 2026', source: 'Gaceta Oficial Nº 42.918' },
                { type: 'modified', code: '8471.30.10', desc: 'Notebooks · IVA estándar (no más exención)',    date: '22 may 2026', source: 'Gaceta Oficial Nº 42.918' },
                { type: 'new',      code: '8517.12.30', desc: 'Smartphones plegables · subpartida nueva',      date: '18 may 2026', source: 'Gaceta Oficial Nº 42.915' },
                { type: 'modified', code: '3304.99.20', desc: 'Cosmética · sanitario obligatorio',             date: '12 may 2026', source: 'Gaceta Oficial Nº 42.910' },
                { type: 'removed',  code: '8519.30.10', desc: 'Tocadiscos · armonización con HS 2026',         date: '08 may 2026', source: 'Gaceta Oficial Nº 42.908' },
              ]).map((c, i) => {
                const map = {
                  new:      { tone: 'success', icon: window.Icon.plus(11),  label: 'NUEVO' },
                  modified: { tone: 'warning', icon: window.Icon.edit(11),  label: 'EDITADO' },
                  removed:  { tone: 'danger',  icon: window.Icon.close(11), label: 'BORRADO' },
                };
                const m = map[c.type];
                return (
                  <div key={i} style={{
                    display: 'grid', gridTemplateColumns: '90px 130px 1fr 140px',
                    gap: 14, padding: '10px 12px', alignItems: 'center',
                    background: 'var(--bg-elevated)', borderRadius: 'var(--r-sm)',
                    borderLeft: `3px solid var(--${m.tone})`,
                  }}>
                    <U.Badge tone={m.tone} size="sm">{m.label}</U.Badge>
                    <code style={{ font: '800 12.5px/1 var(--f-mono)', color: 'var(--ink)' }}>{c.code}</code>
                    <span style={{ font: '500 12.5px/1.4 var(--f-sans)', color: 'var(--ink-soft)' }}>{c.desc}</span>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ font: '600 11px/1.2 var(--f-mono)', color: 'var(--ink)' }}>{c.date}</div>
                      <div style={{ font: '500 10px/1.2 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 2 }}>{c.source}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </U.Card>

          {/* ── 3 PDF download options ──────────────────── */}
          <U.Card padded>
            <div className="eyebrow eyebrow-wine" style={{ marginBottom: 14 }}>DESCARGAR PDFs</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {[
                {
                  type: 'full',
                  title: 'Listado completo',
                  desc: 'Todos los códigos vigentes a la fecha. Para imprimir, llevar a aduana, archivar.',
                  pages: source === 'hscodes' ? '~64 pág' : '~88 pág',
                  size: source === 'hscodes' ? '486 KB' : '1.2 MB',
                  freq: 'On-demand',
                  primary: false,
                },
                {
                  type: 'changelog',
                  title: 'Changelog · qué cambió',
                  desc: 'Solo lo nuevo/modificado/eliminado desde el último PDF. Resaltado en colores.',
                  pages: source === 'hscodes' ? '3 pág' : '8 pág',
                  size: source === 'hscodes' ? '142 KB' : '320 KB',
                  freq: 'Cada cambio · auto',
                  primary: true,
                  badge: 'RECOMENDADO',
                },
                {
                  type: 'summary',
                  title: 'Resumen ejecutivo · tasas',
                  desc: 'Por categoría con arancel promedio. Gráfico de tasas. Para Dirección.',
                  pages: '1 pág',
                  size: '68 KB',
                  freq: 'Mensual',
                  primary: false,
                },
              ].map(p => (
                <div key={p.type} style={{
                  padding: 16,
                  background: p.primary ? 'var(--wine-tint)' : 'var(--bg-surface)',
                  border: `1.5px solid ${p.primary ? 'var(--wine)' : 'var(--border)'}`,
                  borderRadius: 'var(--r-md)',
                  display: 'flex', flexDirection: 'column', gap: 10,
                  position: 'relative',
                }}>
                  {p.badge && (
                    <div style={{ position: 'absolute', top: 10, right: 10, padding: '2px 7px', background: 'var(--wine)', color: '#fff', borderRadius: 3, font: '700 9px/1 var(--f-sans)', letterSpacing: '0.1em' }}>{p.badge}</div>
                  )}
                  <div style={{
                    width: 36, height: 36, borderRadius: 'var(--r-sm)',
                    background: p.primary ? 'var(--wine)' : 'var(--bg-elevated)',
                    color: p.primary ? '#fff' : 'var(--wine)',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  }}>{window.Icon.doc(18)}</div>
                  <div style={{ font: '900 14px/1.2 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.01em' }}>{p.title}</div>
                  <div style={{ font: '500 11.5px/1.5 var(--f-sans)', color: 'var(--ink-soft)', flex: 1 }}>{p.desc}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, font: '600 10.5px/1 var(--f-mono)', color: 'var(--ink-mute)', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                    <span>{p.pages}</span>
                    <span>·</span>
                    <span>{p.size}</span>
                    <span style={{ marginLeft: 'auto', font: '600 10px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{p.freq}</span>
                  </div>
                  <U.Btn variant={p.primary ? 'primary' : 'secondary'} size="sm" icon={window.Icon.download(12)} full>Descargar</U.Btn>
                </div>
              ))}
            </div>
          </U.Card>
        </>
      )}
    </div>
  );
}

function SyncStat({ label, value, delta }) {
  return (
    <div>
      <div style={{ font: '700 10px/1 var(--f-sans)', color: 'rgba(255,255,255,0.45)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ font: '700 13px/1.2 var(--f-sans)', color: '#fff', marginTop: 5 }}>{value}</div>
      {delta && <div style={{ font: '600 10.5px/1 var(--f-sans)', color: 'var(--wine-soft)', marginTop: 3 }}>{delta}</div>}
    </div>
  );
}

// ── AES code row (Arancel VE — duty + IVA + flag) ────────────
function AesRow({ it, first }) {
  const U = window.ERPUI;
  const flagMap = {
    'general':         { tone: 'neutral', label: 'General' },
    'tech-favorable':  { tone: 'success', label: 'Tasa reducida' },
    'restringido':     { tone: 'warning', label: 'Restringido textil' },
    'sanitario':       { tone: 'info',    label: 'Permiso sanitario' },
  };
  const f = flagMap[it.flag] || flagMap.general;
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '140px 1fr 70px 70px 180px 80px',
      gap: 14, padding: '14px 18px', alignItems: 'center',
      borderTop: !first ? '1px solid var(--border)' : 0,
    }}>
      <code style={{ font: '800 13px/1 var(--f-mono)', color: 'var(--wine)' }}>{it.code}</code>
      <span style={{ font: '500 12.5px/1.4 var(--f-sans)', color: 'var(--ink)' }}>{it.desc}</span>
      <div style={{ textAlign: 'right' }}>
        <div style={{ font: '700 9.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Arancel</div>
        <div style={{ font: '800 14px/1 var(--f-mono)', color: it.duty >= 20 ? 'var(--warning)' : 'var(--ink)', marginTop: 4 }}>{it.duty}%</div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ font: '700 9.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>IVA</div>
        <div style={{ font: '700 14px/1 var(--f-mono)', color: 'var(--ink)', marginTop: 4 }}>{it.iva}%</div>
      </div>
      <U.Badge tone={f.tone} size="sm" dot>{f.label}</U.Badge>
      <div style={{ display: 'inline-flex', gap: 4, justifyContent: 'flex-end' }}>
        <button style={{ width: 26, height: 26, color: 'var(--ink-soft)' }} title="Detalle">{window.Icon.eye(13)}</button>
        <button style={{ width: 26, height: 26, color: 'var(--ink-soft)' }} title="Copiar">{window.Icon.copy(13)}</button>
      </div>
    </div>
  );
}
