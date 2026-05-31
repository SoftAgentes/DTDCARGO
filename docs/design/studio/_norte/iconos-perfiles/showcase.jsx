/* ── Showcase de iconos · monta cards + strip + CRM ───────────── */

const ROLES = [
  { id: 'almacenista',    Glyph: GlyphAlmacenista,    wa: '+58 412 100 0001', wc: 'dtd-warehouse-ve', desc: 'Recepción, picking, packing y despacho desde bodega Valencia y reexpediciones a clientes finales.' },
  { id: 'transportista',  Glyph: GlyphTransportista,  wa: '+58 412 495 0884', wc: 'dtd-driver-01',    desc: 'Camioneros y conductores de última milla. Coordinan entrega puerta-a-puerta dentro de Venezuela.' },
  { id: 'logistica',      Glyph: GlyphLogistica,      wa: '+58 414 888 8805', wc: 'dtd-routing-cnve', desc: 'Routing CN→VE, tracking de buques, coordinación con freight forwarders y agentes de aduana.' },
  { id: 'administracion', Glyph: GlyphAdministracion, wa: '+58 241 414 7886', wc: 'dtd-backoffice',   desc: 'Back office: contratos, documentación, aprobación de RIF/cédula y onboarding de clientes nuevos.' },
  { id: 'contabilidad',   Glyph: GlyphContabilidad,   wa: '+58 414 887 0000', wc: 'dtd-accounting',   desc: 'Facturación, conciliación bancaria, balances en USD/Bs y reporte mensual al management.' },
  { id: 'compras',        Glyph: GlyphCompras,        wa: '+58 412 100 0006', wc: 'dtd-procurement',  desc: 'Procurement en CN: cotizaciones en fábrica, inspección Yiwu/Guangzhou, negociación con proveedores.' },
  { id: 'subceo',         Glyph: GlyphSubCEO,         wa: '+58 412 454 5325', wc: 'dtd-vp-ops',       desc: 'Sub-Gerente / VP de operaciones · segunda línea de mando, escalación operativa y proyectos especiales.' },
  { id: 'bigboss',        Glyph: GlyphBigBoss,        wa: '+58 414 884 0000', wc: 'dtd-founder',      desc: 'CEO · dirección general. Solo escalación crítica · cuentas estratégicas y compliance.' },
];

const GROUPS = [
  { id: 'oficina',       Glyph: GlyphOficina,       wa: '+58 412 100 1000', wc: 'dtd-team-oficina', desc: 'Grupo interno con todo el equipo de oficina · coordinación diaria, anuncios y comunicación cross-área.' },
  { id: 'despachos',     Glyph: GlyphDespachos,     wa: '+58 412 100 1001', wc: 'dtd-shipping',     desc: 'Equipo de despachos · seguimiento de paquetes salientes, etiquetas, manifiestos, tracking VE.' },
  { id: 'marketing',     Glyph: GlyphMarketing,     wa: '+58 412 100 1002', wc: 'dtd-growth',       desc: 'Marketing & Estrategia · campañas, contenido, growth, branding y partnerships comerciales.' },
  { id: 'redessociales', Glyph: GlyphRedesSociales, wa: '+58 412 160 5202', wc: 'dtd-social',       desc: 'Redes sociales · gestión de Instagram, TikTok, LinkedIn y X. Contenido, community management y respuestas DM.' },
  { id: 'crm',           Glyph: GlyphCRM,           wa: '+58 412 166 8021', wc: 'dtd-atencion',     desc: 'Línea oficial corporativa · WhatsApp Business API conectado al CRM. Atención al cliente bilingüe ES/中文.' },
  { id: 'alianzas',      Glyph: GlyphAlianzas,      wa: '+58 412 100 1003', wc: 'dtd-partners',     desc: 'Alianzas estratégicas · grupo con otras empresas socias del corredor CN→VE. Coordinación B2B y sinergias.' },
  { id: 'comunidad',     Glyph: GlyphComunidad,     wa: '+58 412 100 1004', wc: 'dtd-community',    desc: 'Comunidad DTD · clientes recurrentes, ambassadors, importadores y referidos. Tips, novedades y descuentos.' },
];

/* ── RoleCard · una tarjeta por rol ───────────────────────────── */
function RoleCard({ role }) {
  const theme = ROLE_THEME[role.id];
  const { Glyph } = role;
  const svgRef = React.useRef(null);

  const exportPNG = async (size) => {
    // Build standalone SVG (without animations baked in)
    const inner = svgRef.current?.querySelector('.icon-shell.is-static svg');
    if (!inner) return;
    const xml = new XMLSerializer().serializeToString(inner);
    const wrapped = '<?xml version="1.0" encoding="UTF-8"?>' + xml;
    const blob = new Blob([wrapped], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const cv = document.createElement('canvas');
      cv.width = size; cv.height = size;
      const ctx = cv.getContext('2d');
      ctx.drawImage(img, 0, 0, size, size);
      cv.toBlob(b => {
        const u = URL.createObjectURL(b);
        const a = document.createElement('a');
        a.href = u;
        a.download = `dtd-${role.id}-${size}.png`;
        a.click();
        URL.revokeObjectURL(u);
        showToast(`PNG ${size}px · ${theme.label}`);
      });
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const copySVG = () => {
    const inner = svgRef.current?.querySelector('.icon-shell.is-static svg');
    if (!inner) return;
    const xml = new XMLSerializer().serializeToString(inner);
    navigator.clipboard.writeText(xml);
    showToast(`SVG copiado · ${theme.label}`);
  };

  return (
    <div className="role-card" ref={svgRef}>
      <div className="role-avatars">
        <div>
          <div className="role-avatar is-small">
            <IconShell role={role.id} interactive={false} hideAnchor={role.id === 'bigboss'}>
              <Glyph />
            </IconShell>
          </div>
          <div className="avatar-label">Fijo</div>
        </div>
        <div>
          <div className="role-avatar">
            <IconShell role={role.id} interactive={true} hideAnchor={role.id === 'bigboss'}>
              <Glyph />
            </IconShell>
          </div>
          <div className="avatar-label">Interactivo</div>
        </div>
      </div>
      <div className="role-body">
        <div className="role-tag">{theme.tag}</div>
        <h3>{theme.label}</h3>
        <p className="role-desc">{role.desc}</p>
        <div className="role-actions">
          <span className="role-num"><span className="wa">WA</span> {role.wa}</span>
          <span className="role-num"><span className="wc">微信</span> {role.wc}</span>
        </div>
        <div className="role-actions" style={{ marginTop: 12 }}>
          <button className="btn primary" onClick={() => exportPNG(512)}>↓ PNG 512</button>
          <button className="btn" onClick={() => exportPNG(1024)}>↓ PNG 1024</button>
          <button className="btn" onClick={copySVG}>⧉ SVG</button>
        </div>
      </div>
    </div>
  );
}

/* ── Strip compacto · 7 avatars sobre fondo navy ──────────────── */
function StripShowcase({ items = ROLES, hideAnchorFor = ['bigboss'] }) {
  return (
    <div className="avatars-strip">
      {items.map(r => {
        const theme = ROLE_THEME[r.id];
        const { Glyph } = r;
        return (
          <div className="pose" key={r.id}>
            <div className="av">
              <IconShell role={r.id} interactive={true} hideAnchor={hideAnchorFor.includes(r.id)}><Glyph /></IconShell>
            </div>
            <div className="name">{theme.label}</div>
            <div className="tag-mini">{theme.tag}</div>
          </div>
        );
      })}
    </div>
  );
}

/* ── CRM Card · WhatsApp Business API integration mock ────────── */
function CRMCard() {
  return (
    <div className="crm-card">
      <div className="crm-avatar">
        <IconShell role="crm" interactive={true} hideAnchor={false}>
          <GlyphCRM />
        </IconShell>
      </div>
      <div>
        <div style={{ font: '600 11px/1 var(--f-sans)', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--wine-soft)', marginBottom: 10 }}>
          Línea oficial · DTD-Cargo
        </div>
        <h2>+58 241 414 7886 · WhatsApp Business</h2>
        <p>El número fijo de la empresa conectado al CRM. Es la línea de <strong>atención al cliente</strong> — NO la línea del CEO. El avatar se sincroniza vía API; podés rotar la variante ("cyber monday", "ruta nueva CN→Caracas", "reefer estacional") sin tocar el teléfono.</p>
        <div className="crm-snippet">
          <span className="com">// POST /api/v1/business-profile/avatar</span><br/>
          <span className="kw">{'{'}</span><br/>
          &nbsp;&nbsp;<span className="str">"role"</span>: <span className="str">"crm"</span>,<br/>
          &nbsp;&nbsp;<span className="str">"format"</span>: <span className="str">"png"</span>,<br/>
          &nbsp;&nbsp;<span className="str">"size"</span>: <span className="str">512</span>,<br/>
          &nbsp;&nbsp;<span className="str">"source"</span>: <span className="str">"dtd-cargo/icons/crm-512.png"</span><br/>
          <span className="kw">{'}'}</span>
        </div>
      </div>
    </div>
  );
}

/* ── Mount ────────────────────────────────────────────────────── */
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 1800);
}

function Grid({ items = ROLES }) {
  return (
    <div className="grid-roles">
      {items.map(r => <RoleCard key={r.id} role={r} />)}
    </div>
  );
}

const grid = document.getElementById('grid-mount');
if (grid) ReactDOM.createRoot(grid).render(<Grid items={ROLES} />);
const groupsGrid = document.getElementById('groups-mount');
if (groupsGrid) ReactDOM.createRoot(groupsGrid).render(<Grid items={GROUPS} />);
const strip = document.getElementById('strip-mount');
if (strip) ReactDOM.createRoot(strip).render(<StripShowcase items={ROLES} hideAnchorFor={['bigboss']} />);
const groupsStrip = document.getElementById('groups-strip-mount');
if (groupsStrip) ReactDOM.createRoot(groupsStrip).render(<StripShowcase items={GROUPS} hideAnchorFor={[]} />);
const crm = document.getElementById('crm-mount');
if (crm) ReactDOM.createRoot(crm).render(<CRMCard />);

/* Tag the static shell so PNG export can find it */
window.addEventListener('load', () => {
  document.querySelectorAll('.icon-shell').forEach((s, i) => {
    if (!s.classList.contains('is-interactive')) s.classList.add('is-static');
  });
});
