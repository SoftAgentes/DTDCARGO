/* ── DTD ERP · Administración · Gestión de Marca v1.0 ────────── */
/* 4 secciones dedicadas a manejar logo, íconos, aplicaciones    */
/* y publicidad. Linkeadas a los HTML standalone correspondientes. */

const { useState: _bUseState } = React;

// ── Reusable card with link to standalone HTML ──────────────
function BrandLink({ href, label, sub, icon, accent = 'wine' }) {
  const U = window.ERPUI;
  return (
    <a href={href} target="_blank" rel="noopener" style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '14px 16px', background: 'var(--bg-elevated)',
      borderRadius: 'var(--r-md)', textDecoration: 'none',
      border: '1px solid var(--border)', transition: 'all 160ms',
      cursor: 'pointer',
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.background = 'var(--bg-surface)';
      e.currentTarget.style.borderColor = 'var(--wine)';
      e.currentTarget.style.transform = 'translateX(4px)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.background = 'var(--bg-elevated)';
      e.currentTarget.style.borderColor = 'var(--border)';
      e.currentTarget.style.transform = 'translateX(0)';
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 'var(--r-sm)',
        background: accent === 'wine' ? 'var(--wine)' : accent === 'navy' ? 'var(--ink)' : 'var(--success)',
        color: '#fff', display: 'grid', placeItems: 'center',
      }}>{window.Icon[icon](20)}</div>
      <div style={{ flex: 1 }}>
        <div style={{ font: '700 14px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{label}</div>
        <div style={{ font: '500 12px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 3 }}>{sub}</div>
      </div>
      <span style={{ color: 'var(--wine)' }}>{window.Icon.external(13)}</span>
    </a>
  );
}

// ── 1. SISTEMA DE MARCA · variantes del logo + Logo Oficial.html
function SectionBrandSystem() {
  const U = window.ERPUI;
  const variants = [
    { id: 'primary',    label: 'Primary',    desc: 'Navy + wine sobre fondos light', file: 'dtdcargo-isologo-primary.png',    bg: '#FBFAF7' },
    { id: 'reverse',    label: 'Reverse',    desc: 'Cream + wine sobre navy / dark', file: 'dtdcargo-isologo-reverse.png',    bg: '#0F1E3D' },
    { id: 'mono-light', label: 'Mono light', desc: 'Solo cream sobre wine / CTA',    file: 'dtdcargo-isologo-mono-light.png', bg: '#7F0F1A' },
    { id: 'mono-dark',  label: 'Mono dark',  desc: 'Solo navy · B&W · sello',        file: 'dtdcargo-isologo-mono-dark.png',  bg: '#F2F0EC' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <U.Card padded>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, gap: 14 }}>
          <div>
            <div className="eyebrow eyebrow-wine">SISTEMA OFICIAL · v1.0</div>
            <div style={{ font: '900 16px/1.2 var(--f-display)', color: 'var(--ink)', marginTop: 6 }}>4 variantes del isólogo</div>
            <div style={{ font: '500 12.5px/1.5 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 6, maxWidth: '60ch' }}>
              Cada variante corresponde a un tipo de fondo. <b>Nunca</b> usar primary sobre navy/wine — ratio 1.1:1, invisible. Ver reglas completas en <code style={{ font: '500 11px/1.3 var(--f-mono)', background: 'var(--bg-elevated)', padding: '2px 6px', borderRadius: 3 }}>CLAUDE.md</code> y <code style={{ font: '500 11px/1.3 var(--f-mono)', background: 'var(--bg-elevated)', padding: '2px 6px', borderRadius: 3 }}>BRAND-MIGRATION-2026-05.md</code>.
            </div>
          </div>
          <window.ERPUI.Badge tone="success" size="sm" dot>v1.0 oficial</window.ERPUI.Badge>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {variants.map(v => (
            <div key={v.id} style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', overflow: 'hidden', border: '1px solid var(--border)' }}>
              <div style={{ background: v.bg, padding: 18, display: 'grid', placeItems: 'center', aspectRatio: '1.2/1' }}>
                <img src={`assets/${v.file}`} alt={v.label} style={{ width: '50%', maxHeight: '70%', objectFit: 'contain' }} />
              </div>
              <div style={{ padding: '12px 14px' }}>
                <div style={{ font: '700 13px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{v.label}</div>
                <div style={{ font: '500 11px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 3 }}>{v.desc}</div>
                <code style={{ font: '500 10px/1.3 var(--f-mono)', color: 'var(--wine)', display: 'block', marginTop: 6 }}>{v.file}</code>
              </div>
            </div>
          ))}
        </div>
      </U.Card>

      <U.Card padded>
        <div className="eyebrow eyebrow-wine" style={{ marginBottom: 12 }}>HERRAMIENTAS</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <BrandLink href="Logo Oficial.html"
            icon="spark"
            label="Abrir Logo Oficial · spec interactiva"
            sub="Carrusel de las 4 variantes · tweaks en vivo · spec técnica · descarga PNG por variante" />
          <BrandLink href="Brand Book DTD v3.0.html"
            icon="doc"
            label="Brand Book completo"
            sub="Tipografía · paleta · iconografía · aplicaciones · mockups" accent="navy" />
        </div>
      </U.Card>

      <U.Card padded>
        <div className="eyebrow eyebrow-wine" style={{ marginBottom: 12 }}>REEMPLAZAR LOGO (futuro)</div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: 12, background: 'var(--warning-bg)', borderRadius: 'var(--r-md)' }}>
          <span style={{ color: 'var(--warning)' }}>{window.Icon.warn(15)}</span>
          <div style={{ font: '500 12.5px/1.5 var(--f-sans)', color: 'var(--ink)', flex: 1 }}>
            Cambiar el logo oficial es una operación crítica que afecta todos los módulos. Requiere doble aprobación (CEO + Sub-CEO) y migra todos los assets en cascada.
          </div>
          <U.Btn variant="secondary" size="sm" disabled>Iniciar reemplazo</U.Btn>
        </div>
      </U.Card>
    </div>
  );
}

// ── 2. ÍCONOS DE PERFIL · 15 íconos del sistema
function SectionBrandIcons() {
  const U = window.ERPUI;
  const roles = [
    { id: 'almacenista',    label: 'Almacenista',    wa: '+58 412 100 0001' },
    { id: 'transportista',  label: 'Transportista',  wa: '+58 412 495 0884' },
    { id: 'logistica',      label: 'Logística',      wa: '+58 414 888 8805' },
    { id: 'administracion', label: 'Administración', wa: '+58 241 414 7886' },
    { id: 'contabilidad',   label: 'Contabilidad',   wa: '+58 414 887 0000' },
    { id: 'compras',        label: 'Compras',        wa: '+58 412 100 0006' },
    { id: 'subceo',         label: 'Sub-CEO',        wa: '+58 412 454 5325' },
    { id: 'bigboss',        label: 'CEO · Big Boss', wa: '+58 414 884 0000' },
  ];
  const groups = [
    { id: 'oficina',       label: 'Oficina',           wa: '+58 412 100 1000' },
    { id: 'despachos',     label: 'Despachos',         wa: '+58 412 100 1001' },
    { id: 'marketing',     label: 'Marketing',         wa: '+58 412 100 1002' },
    { id: 'redessociales', label: 'Redes Sociales',    wa: '+58 412 160 5202' },
    { id: 'crm',           label: 'CRM · Atención',    wa: '+58 412 166 8021' },
    { id: 'alianzas',      label: 'Alianzas Estratégicas', wa: '+58 412 100 1003' },
    { id: 'comunidad',     label: 'Comunidad',         wa: '+58 412 100 1004' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <U.Card padded>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, gap: 14 }}>
          <div>
            <div className="eyebrow eyebrow-wine">15 ÍCONOS · 2 VERSIONES C/U</div>
            <div style={{ font: '900 16px/1.2 var(--f-display)', color: 'var(--ink)', marginTop: 6 }}>Avatares oficiales del directorio</div>
            <div style={{ font: '500 12.5px/1.5 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 6, maxWidth: '60ch' }}>
              Cada rol/grupo de WhatsApp tiene un ícono fijo (PNG para perfil de WhatsApp Business) y uno interactivo (animado para portal interno y onboarding).
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <window.ERPUI.Badge tone="info" size="sm">8 roles</window.ERPUI.Badge>
            <window.ERPUI.Badge tone="wine" size="sm">7 grupos</window.ERPUI.Badge>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22 }}>
          <div>
            <div style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 10 }}>Roles individuales · 8</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {roles.map(r => (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-sm)' }}>
                  <window.ERPUI.Avatar initials={r.label.slice(0,2).toUpperCase()} size={26} color="wine" />
                  <span style={{ font: '600 12.5px/1 var(--f-sans)', color: 'var(--ink)', flex: 1 }}>{r.label}</span>
                  <code style={{ font: '600 10.5px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>{r.wa}</code>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 10 }}>Grupos / canales · 7</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {groups.map(r => (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-sm)' }}>
                  <window.ERPUI.Avatar initials={r.label.slice(0,2).toUpperCase()} size={26} color="navy" />
                  <span style={{ font: '600 12.5px/1 var(--f-sans)', color: 'var(--ink)', flex: 1 }}>{r.label}</span>
                  <code style={{ font: '600 10.5px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>{r.wa}</code>
                </div>
              ))}
            </div>
          </div>
        </div>
      </U.Card>

      <BrandLink href="Iconos de Perfil.html"
        icon="users"
        label="Abrir gestor de íconos · 15 perfiles"
        sub="Ver todos los íconos, cambiar números WA, descargar PNG @512 / @1024, copiar SVG" />
    </div>
  );
}

// ── 3. APLICACIONES DE MARCA · 12 piezas vivas
function SectionBrandApps() {
  const U = window.ERPUI;
  const apps = [
    { id: 'favicon',     label: 'Favicon set',           sub: 'Web, PWA, Apple touch · 16/32/64/180 px', icon: 'globe' },
    { id: 'doc',         label: 'Header de documentos',  sub: 'Factura, cotización, remito, recibo',       icon: 'invoice' },
    { id: 'seal',        label: 'Sello jurídico',        sub: 'Contratos, NDAs, autorizaciones',          icon: 'shield' },
    { id: 'email',       label: 'Firma de email',        sub: 'HTML embebible · Gmail / Outlook',         icon: 'mail' },
    { id: 'spinner',     label: 'Loading spinner',       sub: 'Estados de carga del ERP y apps móviles',  icon: 'refresh' },
    { id: 'social',      label: 'Social profile pack',   sub: 'IG · LinkedIn · TikTok · X · 1080×1080',    icon: 'star' },
    { id: 'qr',          label: 'QR code branded',       sub: 'Para tracking · vCards · link al portal',  icon: 'box' },
    { id: 'emoji',       label: 'Emoji pack Slack/Discord', sub: '16 emojis para el workspace interno',  icon: 'spark' },
    { id: 'map',         label: 'Marcadores de mapa',    sub: 'Pins por etapa: bodega · puerto · cliente',icon: 'pin' },
    { id: 'watermark',   label: 'Watermark fotos',       sub: 'Trazabilidad en fotos del bodeguero',       icon: 'eye' },
    { id: 'sticker',     label: 'Etiqueta de caja',      sub: 'A6 imprimible · Zebra ZPL · QR + MARKBOX', icon: 'tag' },
    { id: 'wapack',      label: 'WhatsApp sticker pack', sub: '12 stickers animados · diferenciador',     icon: 'spark' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <U.Card padded>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, gap: 14 }}>
          <div>
            <div className="eyebrow eyebrow-wine">12 APLICACIONES · SISTEMA EXTENDIDO</div>
            <div style={{ font: '900 16px/1.2 var(--f-display)', color: 'var(--ink)', marginTop: 6 }}>Donde vive el branding</div>
            <div style={{ font: '500 12.5px/1.5 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 6, maxWidth: '60ch' }}>
              El isólogo no es solo el logo — extiende a 12 touchpoints operacionales y comerciales. Cada pieza es entregable independiente.
            </div>
          </div>
          <window.ERPUI.Badge tone="success" size="sm" dot>12 vivas</window.ERPUI.Badge>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {apps.map(a => (
            <div key={a.id} style={{ display: 'flex', gap: 10, padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-sm)', alignItems: 'flex-start' }}>
              <span style={{ color: 'var(--wine)', marginTop: 2 }}>{window.Icon[a.icon](16)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: '700 12.5px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{a.label}</div>
                <div style={{ font: '500 11px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 2 }}>{a.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </U.Card>

      <BrandLink href="Aplicaciones de Marca.html"
        icon="tag"
        label="Abrir Aplicaciones de Marca · 12 piezas"
        sub="Cada aplicación con preview interactivo, código copiable y exportable" />
    </div>
  );
}

// ── 4. PUBLICIDAD ACTIVA · campañas + ads gestionados
function SectionBrandAds() {
  const U = window.ERPUI;
  const [tab, setTab] = _bUseState('active');

  const campaigns = [
    { id: 'cmp-2026-05', name: 'Black Friday Asia Q2',   ch: ['Meta', 'TikTok'],  budget: '$ 4,800',  spent: 62, status: 'live',     start: '15 May', end: '01 Jun', kpi: '218 leads · CPL $ 22' },
    { id: 'cmp-2026-04', name: 'Ruta nueva · Cánton-PBL', ch: ['Meta', 'LinkedIn'], budget: '$ 2,200', spent: 88, status: 'live',     start: '01 May', end: '31 May', kpi: '94 leads · CPL $ 23' },
    { id: 'cmp-2026-03', name: 'Reefer estacional VE',   ch: ['Google'],          budget: '$ 1,500',  spent: 100, status: 'finished', start: '01 Abr', end: '30 Abr', kpi: '146 leads · CPL $ 10' },
    { id: 'cmp-2026-06', name: 'Día del padre · regalo',  ch: ['Meta'],            budget: '$ 800',   spent: 0,   status: 'draft',    start: '08 Jun', end: '20 Jun', kpi: '—' },
  ];
  const filtered = campaigns.filter(c => tab === 'all' ? true : tab === 'active' ? c.status === 'live' : tab === 'draft' ? c.status === 'draft' : c.status === 'finished');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <U.Card padded>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, gap: 14 }}>
          <div>
            <div className="eyebrow eyebrow-wine">CAMPAÑAS · PUBLICIDAD</div>
            <div style={{ font: '900 16px/1.2 var(--f-display)', color: 'var(--ink)', marginTop: 6 }}>Gestión de publicidad de marca</div>
            <div style={{ font: '500 12.5px/1.5 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 6, maxWidth: '60ch' }}>
              Campañas de marketing activas que usan los assets del sistema. Para pedidos de pauta nueva o stock de productos publicitarios, ir a <b>Administración de productos</b>.
            </div>
          </div>
          <U.Btn variant="primary" icon={window.Icon.plus(13)} size="sm">Nueva campaña</U.Btn>
        </div>

        <U.Tabs value={tab} onChange={setTab} items={[
          { value: 'active',   label: 'Activas',     count: campaigns.filter(c => c.status === 'live').length },
          { value: 'draft',    label: 'Borrador',    count: campaigns.filter(c => c.status === 'draft').length },
          { value: 'finished', label: 'Finalizadas', count: campaigns.filter(c => c.status === 'finished').length },
          { value: 'all',      label: 'Todas',       count: campaigns.length },
        ]} style={{ marginBottom: 12 }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(c => (
            <div key={c.id} style={{ padding: 14, background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <code style={{ font: '700 10.5px/1 var(--f-mono)', color: 'var(--wine)', padding: '3px 6px', background: 'var(--wine-tint)', borderRadius: 3 }}>{c.id}</code>
                <span style={{ font: '700 13px/1 var(--f-sans)', color: 'var(--ink)', flex: 1 }}>{c.name}</span>
                <window.ERPUI.Badge tone={c.status === 'live' ? 'success' : c.status === 'draft' ? 'neutral' : 'info'} size="sm" dot={c.status === 'live'}>
                  {c.status === 'live' ? 'En vivo' : c.status === 'draft' ? 'Borrador' : 'Finalizada'}
                </window.ERPUI.Badge>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, fontSize: 12 }}>
                <div><div style={{ color: 'var(--ink-mute)', font: '600 9.5px/1 var(--f-sans)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Canales</div><span style={{ color: 'var(--ink)', fontWeight: 600 }}>{c.ch.join(' · ')}</span></div>
                <div><div style={{ color: 'var(--ink-mute)', font: '600 9.5px/1 var(--f-sans)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Periodo</div><span style={{ color: 'var(--ink)', fontFamily: 'var(--f-mono)' }}>{c.start} → {c.end}</span></div>
                <div><div style={{ color: 'var(--ink-mute)', font: '600 9.5px/1 var(--f-sans)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Budget</div><span style={{ color: 'var(--ink)', fontFamily: 'var(--f-mono)' }}>{c.budget} · {c.spent}%</span></div>
                <div><div style={{ color: 'var(--ink-mute)', font: '600 9.5px/1 var(--f-sans)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>KPI</div><span style={{ color: 'var(--wine)', fontFamily: 'var(--f-mono)', fontWeight: 600 }}>{c.kpi}</span></div>
              </div>
              <div style={{ marginTop: 10, height: 4, background: 'rgba(0,0,0,0.06)', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ width: c.spent + '%', height: '100%', background: c.spent >= 90 ? 'var(--warning)' : 'var(--wine)' }} />
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--ink-mute)', font: '500 13px/1.4 var(--f-sans)' }}>Sin campañas en este estado.</div>
          )}
        </div>
      </U.Card>

      <U.Card padded>
        <div className="eyebrow eyebrow-wine" style={{ marginBottom: 12 }}>PRODUCTOS PUBLICITARIOS</div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: 14, background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)' }}>
          <span style={{ color: 'var(--wine)' }}>{window.Icon.tag(20)}</span>
          <div style={{ flex: 1 }}>
            <div style={{ font: '700 13.5px/1.2 var(--f-sans)', color: 'var(--ink)' }}>Pedir merchandising / material impreso</div>
            <div style={{ font: '500 12px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 3 }}>
              Tarjetas · stickers de caja · uniformes · vinilos para camiones · banners · POP. Stock y pedidos se gestionan en <b>Productos del ERP</b>.
            </div>
          </div>
          <U.Btn variant="primary" size="sm" icon={window.Icon.arrowR(13)}
            onClick={() => window.dispatchEvent(new CustomEvent('erp:navigate', { detail: { module: 'suppliers' } }))}
          >Ir a productos</U.Btn>
        </div>
      </U.Card>
    </div>
  );
}

window.AdminBrandSystem = SectionBrandSystem;
window.AdminBrandIcons = SectionBrandIcons;
window.AdminBrandApps = SectionBrandApps;
window.AdminBrandAds = SectionBrandAds;
