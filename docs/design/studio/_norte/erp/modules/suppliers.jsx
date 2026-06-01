/* global React */
/* ── DTD ERP · Proveedores CN ───────────────────────────────── */

const { useState: _sUseState, useMemo: _sUseMemo } = React;

function ModuleSuppliers({ goTo }) {
  const D = window.ERPData;
  const baseSuppliers = D.byTenant(D.SUPPLIERS);   // multi-tenant
  const U = window.ERPUI;
  const [search, setSearch] = _sUseState('');
  const [industryFilter, setIndustryFilter] = _sUseState('all');
  const [statusFilter, setStatusFilter] = _sUseState('all');
  const [selected, setSelected] = _sUseState(null);
  const [createOpen, setCreateOpen] = _sUseState(false);

  const filtered = _sUseMemo(() => {
    let rows = baseSuppliers;
    if (industryFilter !== 'all') rows = rows.filter(s => s.industry === industryFilter);
    if (statusFilter !== 'all') rows = rows.filter(s => s.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(s => s.name.toLowerCase().includes(q) || s.cn.includes(q) || s.city.toLowerCase().includes(q) || s.contactName.toLowerCase().includes(q));
    }
    return rows;
  }, [search, industryFilter, statusFilter]);

  const preferred = baseSuppliers.filter(s => s.status === 'preferido').length;
  const totalValue = baseSuppliers.reduce((a, s) => a + s.totalValue, 0);
  const totalShipments = baseSuppliers.reduce((a, s) => a + s.shipments, 0);
  const observ = baseSuppliers.filter(s => s.status === 'observación').length;

  const industries = [...new Set(baseSuppliers.map(s => s.industry))];
  const statusTone = { preferido: 'success', aprobado: 'info', observación: 'warning', bloqueado: 'danger' };

  return (
    <div>
      <U.PageHeader
        title="Proveedores de clientes · CN · 客户供应商"
        subtitle="Proveedores chinos de nuestros clientes. Grupo WeChat por compra, contactos, asignación cliente↔proveedor, historial."
        actions={
          <>
            <U.Btn variant="secondary" icon={window.Icon.download(14)}>Exportar CSV</U.Btn>
            <U.Btn variant="primary" icon={window.Icon.plus(14)} onClick={() => setCreateOpen(true)}>Nuevo proveedor</U.Btn>
          </>
        }
      />

      <div style={{ padding: '11px 16px', background: 'var(--wine-tint)', borderRadius: 'var(--r-md)', marginBottom: 'var(--s-5)', display: 'flex', gap: 10, alignItems: 'center' }}>
        <span style={{ color: 'var(--wine)', flexShrink: 0 }}>{window.Icon.info(14)}</span>
        <div style={{ font: '500 12px/1.45 var(--f-sans)', color: 'var(--ink)' }}>
          Estos proveedores pertenecen a los <b>clientes</b>: son a quienes les compran en China. La deuda de la empresa con sus propios acreedores (navieras, aduana, transporte) se gestiona en <b>Tesorería · Cuentas por pagar</b>.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 'var(--s-5)' }}>
        <U.KPI label="Proveedores totales" value={baseSuppliers.length} delta={`${preferred} preferidos`} tone="wine" icon={window.Icon.cn(18)} />
        <U.KPI label="Embarques totales" value={totalShipments} sub="histórico acumulado" tone="info" icon={window.Icon.box(18)} />
        <U.KPI label="Volumen movido" value={`$${(totalValue/1000).toFixed(0)}K`} sub="USD acumulado" tone="success" icon={window.Icon.chart(18)} />
        <U.KPI label="En observación" value={observ} delta={observ > 0 ? 'revisar performance' : 'todos ok'} tone={observ > 0 ? 'warning' : 'success'} icon={window.Icon.warn(18)} />
      </div>

      <U.Toolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar por nombre, 中文, ciudad o contacto…"
        filters={
          <>
            <U.Select value={industryFilter} onChange={(e) => setIndustryFilter(e.target.value)} style={{ width: 200 }} options={[
              { value: 'all', label: 'Todas las industrias' },
              ...industries.map(i => ({ value: i, label: i })),
            ]} />
            <U.Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ width: 150 }} options={[
              { value: 'all', label: 'Todos los estados' },
              'preferido', 'aprobado', 'observación', 'bloqueado',
            ]} />
          </>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 14 }}>
        {filtered.map(s => {
          const avgRating = (s.rating.onTime + s.rating.quality + s.rating.price + s.rating.comms) / 4;
          const clientCount = D.SUPPLIER_CLIENTS.filter(sc => sc.supplierId === s.id).length;
          return (
            <U.Card key={s.id} hoverable onClick={() => setSelected(s)} style={{ padding: 0, display: 'flex', flexDirection: 'column', cursor: 'pointer' }}>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                  <U.Badge tone={statusTone[s.status]} size="sm" dot>{s.status}</U.Badge>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ color: avgRating >= 9 ? 'var(--success)' : avgRating >= 8 ? 'var(--info)' : 'var(--warning)' }}>★</span>
                    <span style={{ font: '800 13px/1 var(--f-mono)', color: 'var(--ink)' }}>{avgRating.toFixed(1)}</span>
                  </div>
                </div>
                <div style={{ font: '900 15px/1.1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.01em' }}>{s.name}</div>
                <div style={{ font: '600 13px/1.3 "Noto Sans SC", var(--f-sans)', color: 'var(--ink-soft)', marginTop: 4 }}>{s.cn}</div>
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <U.Badge tone="neutral" size="sm">{s.industry}</U.Badge>
                  <span style={{ font: '500 11px/1 var(--f-sans)', color: 'var(--ink-mute)' }}>{s.city} · {s.cityCn}</span>
                </div>
              </div>

              <div style={{ padding: '12px 16px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
                <MiniStat label="Envíos" value={s.shipments} />
                <MiniStat label="Valor $" value={`${(s.totalValue/1000).toFixed(0)}K`} />
                <MiniStat label="Clientes" value={clientCount} />
              </div>

              <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, font: '500 11.5px/1.4 var(--f-sans)', color: 'var(--ink-soft)' }}>
                <U.Avatar initials={s.contactCn.slice(-2)} size={26} color="wine" />
                <div style={{ flex: 1 }}>
                  <div style={{ font: '700 12px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{s.contactName} <span style={{ color: 'var(--ink-mute)', fontFamily: '"Noto Sans SC"' }}>{s.contactCn}</span></div>
                  <code style={{ font: '500 10.5px/1.2 var(--f-mono)', color: 'var(--ink-mute)' }}>{s.phone}</code>
                </div>
              </div>
            </U.Card>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <U.EmptyState icon={window.Icon.cn(22)} title="Sin proveedores" body="Ajustá filtros o agregá un proveedor chino nuevo." />
      )}

      <SupplierDetail s={selected} onClose={() => setSelected(null)} goTo={goTo} />
      <SupplierForm open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ font: '700 9px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ font: '800 14px/1 var(--f-mono)', color: 'var(--ink)', marginTop: 4 }}>{value}</div>
    </div>
  );
}

// ── Supplier detail drawer ──────────────────────────────────
function SupplierDetail({ s, onClose, goTo }) {
  const D = window.ERPData;
  const U = window.ERPUI;
  const [tab, setTab] = React.useState('resumen');
  React.useEffect(() => { setTab('resumen'); }, [s && s.id]);
  if (!s) return null;

  const clients = D.SUPPLIER_CLIENTS.filter(sc => sc.supplierId === s.id);
  const totalValue = clients.reduce((a, c) => a + c.totalValue, 0);
  const avgRating = (s.rating.onTime + s.rating.quality + s.rating.price + s.rating.comms) / 4;
  const statusTone = { preferido: 'success', aprobado: 'info', observación: 'warning', bloqueado: 'danger' };

  return (
    <U.Drawer
      open={!!s}
      onClose={onClose}
      title={s.name}
      subtitle={`${s.cn} · ${s.city} ${s.cityCn}`}
      width={680}
      actions={
        <>
          <U.Btn variant="secondary" icon={window.Icon.mail(13)}>Email</U.Btn>
          <U.Btn variant="secondary" icon={window.Icon.globe(13)}>WeChat</U.Btn>
          <U.Btn variant="primary" icon={window.Icon.edit(13)}>Editar</U.Btn>
        </>
      }
    >
      <U.Tabs value={tab} onChange={setTab} style={{ marginBottom: 18 }} items={[
        { value: 'resumen', label: 'Resumen' },
        { value: 'ship', label: 'Embarques históricos', count: s.shipments },
      ]} />

      {tab === 'ship' && <SupplierShipments s={s} clients={clients} goTo={goTo} />}

      {tab === 'resumen' && (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        {/* Status + rating hero */}
        <U.Card padded style={{ background: 'linear-gradient(135deg, var(--ink) 0%, #1F3055 100%)', color: '#fff', border: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <U.Badge tone={statusTone[s.status]} size="md" dot>{s.status}</U.Badge>
              <div style={{ font: '500 12.5px/1.5 var(--f-sans)', color: 'rgba(255,255,255,0.7)', marginTop: 10, maxWidth: '42ch' }}>{s.notes}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ font: '700 10.5px/1 var(--f-sans)', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>RATING GLOBAL</div>
              <div style={{ font: '900 36px/1 var(--f-display)', color: '#fff', marginTop: 8, letterSpacing: '-0.02em' }}>★ {avgRating.toFixed(1)}</div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            <RatingBar label="On-time"    val={s.rating.onTime} />
            <RatingBar label="Calidad"    val={s.rating.quality} />
            <RatingBar label="Precio"     val={s.rating.price} />
            <RatingBar label="Comunicación" val={s.rating.comms} />
          </div>
        </U.Card>

        {/* Info */}
        <div>
          <div className="eyebrow eyebrow-wine" style={{ marginBottom: 14 }}>INFORMACIÓN GENERAL</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            <U.Field label="Industria" value={s.industry} />
            <U.Field label="Ciudad · Provincia" value={`${s.city}, ${s.province}`} />
            <U.Field label="Fundación" value={s.founded} mono />
            <U.Field label="Empleados" value={s.employees} mono />
            <U.Field label="Último negocio" value={s.lastDeal} mono />
            <U.Field label="Envíos totales" value={s.shipments} mono />
          </div>
        </div>

        {/* Address */}
        <div>
          <div className="eyebrow eyebrow-wine" style={{ marginBottom: 10 }}>DIRECCIÓN</div>
          <div style={{ padding: 12, background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', font: '500 12.5px/1.6 "Noto Sans SC", var(--f-sans)', color: 'var(--ink)' }}>{s.address}</div>
        </div>

        {/* Contact */}
        <div>
          <div className="eyebrow eyebrow-wine" style={{ marginBottom: 12 }}>CONTACTO PRINCIPAL</div>
          <U.Card style={{ padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <U.Avatar initials={s.contactCn.slice(-2)} size={44} color="wine" />
              <div style={{ flex: 1 }}>
                <div style={{ font: '800 14px/1.2 var(--f-display)', color: 'var(--ink)' }}>{s.contactName}</div>
                <div style={{ font: '600 13px/1.2 "Noto Sans SC", var(--f-sans)', color: 'var(--ink-soft)', marginTop: 3 }}>{s.contactCn}</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 14 }}>
              <a style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)' }}>
                <span style={{ color: 'var(--wine)' }}>{window.Icon.mail(14)}</span>
                <code style={{ font: '600 11.5px/1 var(--f-mono)', color: 'var(--ink)' }}>{s.email}</code>
              </a>
              <a style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)' }}>
                <span style={{ color: 'var(--wine)' }}>{window.Icon.globe(14)}</span>
                <code style={{ font: '600 11.5px/1 var(--f-mono)', color: 'var(--ink)' }}>{s.phone}</code>
              </a>
              <a style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: '#25D366', color: '#fff', borderRadius: 'var(--r-md)' }}>
                <span>{window.Icon.globe(14)}</span>
                <span style={{ font: '600 11.5px/1 var(--f-mono)' }}>WeChat: {s.wechat}</span>
              </a>
              <a style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)' }}>
                <span style={{ color: 'var(--wine)' }}>{window.Icon.copy(13)}</span>
                <span style={{ font: '600 11.5px/1 var(--f-sans)', color: 'var(--ink-soft)' }}>Copiar contacto</span>
              </a>
            </div>
          </U.Card>
        </div>

        {/* Clientes asignados + grupo WeChat */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div className="eyebrow eyebrow-wine">{clients.length} CLIENTES DTD · GRUPOS WECHAT</div>
            <span style={{ font: '700 11.5px/1 var(--f-mono)', color: 'var(--wine)' }}>${(totalValue/1000).toFixed(0)}K total</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {clients.map(c => {
              const client = D.CLIENTS.find(x => x.markbox === c.clientMarkbox);
              if (!client) return null;
              return (
                <div key={c.clientMarkbox} style={{
                  display: 'grid', gridTemplateColumns: '20px 1fr 92px 78px',
                  gap: 12, alignItems: 'center',
                  padding: '10px 12px',
                  background: c.favorite ? 'var(--wine-tint)' : 'var(--bg-elevated)',
                  borderRadius: 'var(--r-md)',
                  cursor: 'pointer',
                }}
                onClick={() => goTo?.('clients', client.markbox, 'detail')}
                >
                  {c.favorite ? <span style={{ color: 'var(--wine)' }}>★</span> : <span />}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ font: '700 12.5px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{client.company}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 3, flexWrap: 'wrap' }}>
                      <code style={{ font: '600 11px/1.2 var(--f-mono)', color: c.favorite ? 'var(--wine)' : 'var(--ink-mute)' }}>{c.clientMarkbox}</code>
                      {c.wechatGroup && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 7px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)' }} title="Grupo WeChat de la compra">
                          <span style={{ color: 'var(--success)', display: 'flex' }}>{window.Icon.globe(11)}</span>
                          <code style={{ font: '700 10px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>{c.wechatGroup}</code>
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="mono" style={{ font: '700 12px/1 var(--f-mono)', color: 'var(--ink-soft)', textAlign: 'right' }}>{c.shipments} envíos</span>
                  <span className="mono" style={{ font: '800 12.5px/1 var(--f-mono)', color: 'var(--ink)', textAlign: 'right' }}>${(c.totalValue/1000).toFixed(0)}K</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      )}
    </U.Drawer>
  );
}

function RatingBar({ label, val }) {
  const c = val >= 9 ? '#7CE3A5' : val >= 8 ? 'var(--wine-soft)' : 'var(--warning)';
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ font: '700 9.5px/1 var(--f-sans)', color: 'rgba(255,255,255,0.55)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{label}</span>
        <span style={{ font: '800 11.5px/1 var(--f-mono)', color: c }}>{val.toFixed(1)}</span>
      </div>
      <div style={{ height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ width: `${val * 10}%`, height: '100%', background: c, borderRadius: 999 }} />
      </div>
    </div>
  );
}

// ── Supplier create form ────────────────────────────────────
function SupplierForm({ open, onClose }) {
  const U = window.ERPUI;
  const D = window.ERPData;
  const [client, setClient] = _sUseState('');

  // El código del grupo WeChat se genera solo: MARKBOX-N (N = nº de proveedor del cliente).
  const groupCode = _sUseMemo(() => {
    if (!client) return null;
    const n = D.SUPPLIER_CLIENTS.filter(sc => sc.clientMarkbox === client).length + 1;
    return `${client}-${n}`;
  }, [client]);

  const clientOptions = _sUseMemo(() => {
    const seen = new Set();
    return D.byTenant(D.CLIENTS)
      .filter(c => c.markbox && !seen.has(c.markbox) && seen.add(c.markbox))
      .map(c => ({ value: c.markbox, label: `${c.markbox} · ${c.company}` }));
  }, []);

  return (
    <U.Drawer open={open} onClose={onClose} title="Nuevo proveedor de cliente · CN" subtitle="Proveedor chino de un cliente DTD" width={620}
      actions={<><U.Btn variant="ghost" onClick={onClose}>Cancelar</U.Btn><U.Btn variant="primary" icon={window.Icon.check(13)}>Crear proveedor</U.Btn></>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <U.Input label="Nombre comercial (ES)" placeholder="Yiwu Trading Co" />
        <U.Input label="Nombre legal · 中文" placeholder="义乌贸易有限公司" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <U.Select label="Ciudad" options={['Yiwu · 义乌', 'Guangzhou · 广州', 'Shenzhen · 深圳', 'Shanghai · 上海', 'Ningbo · 宁波', 'Hangzhou · 杭州']} />
          <U.Select label="Industria" options={['General · Bazar', 'Iluminación LED', 'Textil · Indumentaria', 'Electrónica', 'Cosmética', 'Industrial pesado', 'Tecnología', 'Mayorista bazar', 'Calzado', 'Muebles']} />
        </div>
        <U.Input label="Dirección completa · 中文" placeholder="义乌市国际商贸城三区..." />

        <div className="eyebrow eyebrow-wine" style={{ marginTop: 8 }}>CONTACTO PRINCIPAL</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <U.Input label="Nombre (ES)" placeholder="Wang Liu" />
          <U.Input label="Nombre · 中文" placeholder="王柳" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <U.Input label="Teléfono" placeholder="+86 137 0000 0000" mono />
          <U.Input label="WeChat ID" placeholder="YiwuStd_Wang" mono />
        </div>
        <U.Input label="Email" type="email" placeholder="contacto@supplier.com" />

        <div className="eyebrow eyebrow-wine" style={{ marginTop: 8 }}>GRUPO WECHAT · CLIENTE</div>
        <U.Select label="Cliente que lo usa" value={client} onChange={(e) => setClient(e.target.value)} options={[
          { value: '', label: 'Seleccionar cliente DTD…' },
          ...clientOptions,
        ]} />
        <div style={{ padding: '11px 14px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: client ? 'var(--success)' : 'var(--ink-mute)', display: 'flex', flexShrink: 0 }}>{window.Icon.globe(15)}</span>
          {groupCode ? (
            <div style={{ font: '500 12px/1.45 var(--f-sans)', color: 'var(--ink)' }}>
              Código del grupo WeChat: <code style={{ font: '800 12.5px/1 var(--f-mono)', color: 'var(--wine)' }}>{groupCode}</code> — se genera solo y es el nombre del grupo de seguimiento de la compra.
            </div>
          ) : (
            <div style={{ font: '500 12px/1.45 var(--f-sans)', color: 'var(--ink-soft)' }}>
              Elegí un cliente y el código del grupo WeChat (<code style={{ font: '700 11.5px/1 var(--f-mono)', color: 'var(--ink-mute)' }}>MARKBOX-N</code>) se genera automáticamente.
            </div>
          )}
        </div>

        <div className="eyebrow eyebrow-wine" style={{ marginTop: 8 }}>ESTADO INICIAL</div>
        <U.Select label="Status" options={['aprobado · uso normal', 'preferido · uso priorizado', 'observación · necesita revisión']} />

        <U.Input label="Notas internas" placeholder="Calidad, comunicación, condiciones de pago, observaciones…" />
      </div>
    </U.Drawer>
  );
}

// ── Historial de embarques del proveedor (derivado determinista) ──
// SHIPMENTS no trae supplierId; derivamos el historial de cada proveedor
// de sus datos reales: clientes que le compran (SUPPLIER_CLIENTS), su
// conteo de envíos y su último negocio. Estable por proveedor (LCG con
// semilla = nº del id). Para backend: reemplazar por SHIPMENTS.filter(supplierId).
function buildSupplierShipments(s, clients, CLIENTS) {
  const n = Math.min(s.shipments || 0, 16);
  const end = new Date((s.lastDeal || '2026-05-01') + 'T00:00:00');
  let seed = parseInt((String(s.id).match(/\d+/) || ['7'])[0], 10) || 7;
  const rng = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  const rows = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(end);
    d.setDate(d.getDate() - Math.round(i * (335 / Math.max(n, 1)) + rng() * 9));
    const cl = clients.length ? clients[i % clients.length] : null;
    const client = cl ? CLIENTS.find(x => x.markbox === cl.clientMarkbox) : null;
    const cbm = +(2.4 + rng() * 30).toFixed(1);
    const value = Math.round(1800 + rng() * 42000);
    const status = i === 0 ? 'tránsito' : i === 1 ? 'aduana VE'
      : (i % 11 === 5 ? 'incidencia' : 'entregado');
    rows.push({
      id: 'DTDU-' + (300000 + (seed % 180000) + i * 41),
      date: d.toISOString().slice(0, 10),
      markbox: cl ? cl.clientMarkbox : '—',
      clientName: client ? client.company : (cl ? cl.clientMarkbox : 'Cliente DTD'),
      cbm, value, status,
    });
  }
  return rows; // i=0 = más reciente
}

function SupplierShipments({ s, clients, goTo }) {
  const D = window.ERPData;
  const U = window.ERPUI;
  const [status, setStatus] = _sUseState('all');
  const [period, setPeriod] = _sUseState('all');

  const all = _sUseMemo(() => buildSupplierShipments(s, clients, D.CLIENTS), [s.id]);
  const NOW = new Date('2026-05-31T00:00:00');
  const monthsAgo = (iso) => (NOW - new Date(iso + 'T00:00:00')) / (1000 * 60 * 60 * 24 * 30.4);

  const rows = all.filter(r => {
    if (status !== 'all' && r.status !== status) return false;
    if (period !== 'all' && monthsAgo(r.date) > parseInt(period, 10)) return false;
    return true;
  });

  const sumCbm = rows.reduce((a, r) => a + r.cbm, 0);
  const sumVal = rows.reduce((a, r) => a + r.value, 0);
  const statusTone = { 'entregado': 'success', 'tránsito': 'info', 'aduana VE': 'warning', 'incidencia': 'danger' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        <ShipKPI label="Embarques" value={rows.length} sub={`de ${s.shipments} totales`} />
        <ShipKPI label="CBM acumulado" value={sumCbm.toFixed(1)} sub="m³ del filtro" />
        <ShipKPI label="Valor FOB" value={`$${(sumVal / 1000).toFixed(0)}K`} sub="USD del filtro" />
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10 }}>
        <U.Select value={status} onChange={(e) => setStatus(e.target.value)} style={{ flex: 1 }} options={[
          { value: 'all', label: 'Todos los estados' },
          'entregado', 'tránsito', 'aduana VE', 'incidencia',
        ]} />
        <U.Select value={period} onChange={(e) => setPeriod(e.target.value)} style={{ flex: 1 }} options={[
          { value: 'all', label: 'Todo el historial' },
          { value: '3', label: 'Últimos 3 meses' },
          { value: '6', label: 'Últimos 6 meses' },
          { value: '12', label: 'Últimos 12 meses' },
        ]} />
      </div>

      {/* Tabla */}
      {rows.length === 0 ? (
        <U.EmptyState icon={window.Icon.box(22)} title="Sin embarques" body="No hay embarques de este proveedor con los filtros aplicados." />
      ) : (
        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '116px 1fr 70px 84px 96px', gap: 10, padding: '9px 14px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
            {['Embarque', 'Cliente · fecha', 'CBM', 'Valor', 'Estado'].map((h, i) => (
              <span key={h} style={{ font: '700 9px/1 var(--f-sans)', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-mute)', textAlign: i >= 2 && i < 4 ? 'right' : 'left' }}>{h}</span>
            ))}
          </div>
          {rows.map((r, i) => (
            <div key={r.id} onClick={() => goTo && goTo('shipments', r.id)} style={{
              display: 'grid', gridTemplateColumns: '116px 1fr 70px 84px 96px', gap: 10, alignItems: 'center',
              padding: '10px 14px', cursor: goTo ? 'pointer' : 'default',
              borderBottom: i === rows.length - 1 ? 'none' : '1px solid var(--border)',
              background: 'var(--bg-surface)',
            }}>
              <code style={{ font: '700 11px/1.2 var(--f-mono)', color: 'var(--wine)' }}>{r.id}</code>
              <div style={{ minWidth: 0 }}>
                <div style={{ font: '600 12.5px/1.2 var(--f-sans)', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.clientName}</div>
                <div style={{ font: '500 10.5px/1.2 var(--f-mono)', color: 'var(--ink-mute)', marginTop: 2 }}>{r.markbox} · {r.date}</div>
              </div>
              <span style={{ font: '700 12px/1 var(--f-mono)', color: 'var(--ink-soft)', textAlign: 'right' }}>{r.cbm}</span>
              <span style={{ font: '800 12px/1 var(--f-mono)', color: 'var(--ink)', textAlign: 'right' }}>${(r.value / 1000).toFixed(1)}K</span>
              <span style={{ textAlign: 'right' }}><U.Badge tone={statusTone[r.status]} size="sm">{r.status}</U.Badge></span>
            </div>
          ))}
        </div>
      )}
      <div style={{ font: '500 10.5px/1.4 var(--f-sans)', color: 'var(--ink-mute)' }}>
        Mostrando los {all.length} embarques más recientes de {s.name}. El historial completo se sincroniza desde el ERP.
      </div>
    </div>
  );
}

function ShipKPI({ label, value, sub }) {
  return (
    <div style={{ padding: '12px 14px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', border: '1px solid var(--border)' }}>
      <div style={{ font: '700 9px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ font: '900 20px/1 var(--f-display)', color: 'var(--ink)', marginTop: 7, letterSpacing: '-0.02em' }}>{value}</div>
      <div style={{ font: '500 10px/1.2 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 4 }}>{sub}</div>
    </div>
  );
}

window.ModuleSuppliers = ModuleSuppliers;
