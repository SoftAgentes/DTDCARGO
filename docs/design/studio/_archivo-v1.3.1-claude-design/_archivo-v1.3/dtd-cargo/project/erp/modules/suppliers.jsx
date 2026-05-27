/* global React */
/* ── DTD ERP · Proveedores CN ───────────────────────────────── */

const { useState: _sUseState, useMemo: _sUseMemo } = React;

function ModuleSuppliers({ goTo }) {
  const D = window.ERPData;
  const U = window.ERPUI;
  const [search, setSearch] = _sUseState('');
  const [industryFilter, setIndustryFilter] = _sUseState('all');
  const [statusFilter, setStatusFilter] = _sUseState('all');
  const [selected, setSelected] = _sUseState(null);
  const [createOpen, setCreateOpen] = _sUseState(false);

  const filtered = _sUseMemo(() => {
    let rows = D.SUPPLIERS;
    if (industryFilter !== 'all') rows = rows.filter(s => s.industry === industryFilter);
    if (statusFilter !== 'all') rows = rows.filter(s => s.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(s => s.name.toLowerCase().includes(q) || s.cn.includes(q) || s.city.toLowerCase().includes(q) || s.contactName.toLowerCase().includes(q));
    }
    return rows;
  }, [search, industryFilter, statusFilter]);

  const preferred = D.SUPPLIERS.filter(s => s.status === 'preferido').length;
  const totalValue = D.SUPPLIERS.reduce((a, s) => a + s.totalValue, 0);
  const totalShipments = D.SUPPLIERS.reduce((a, s) => a + s.shipments, 0);
  const observ = D.SUPPLIERS.filter(s => s.status === 'observación').length;

  const industries = [...new Set(D.SUPPLIERS.map(s => s.industry))];
  const statusTone = { preferido: 'success', aprobado: 'info', observación: 'warning', bloqueado: 'danger' };

  return (
    <div>
      <U.PageHeader
        title="Proveedores CN · 中国供应商"
        subtitle="Base de datos de suppliers chinos. Performance, contactos, asignación cliente↔proveedor, historial."
        actions={
          <>
            <U.Btn variant="secondary" icon={window.Icon.download(14)}>Exportar CSV</U.Btn>
            <U.Btn variant="primary" icon={window.Icon.plus(14)} onClick={() => setCreateOpen(true)}>Nuevo proveedor</U.Btn>
          </>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 'var(--s-5)' }}>
        <U.KPI label="Proveedores totales" value={D.SUPPLIERS.length} delta={`${preferred} preferidos`} tone="wine" icon={window.Icon.cn(18)} />
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

        {/* Clientes asignados */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div className="eyebrow eyebrow-wine">{clients.length} CLIENTES DTD QUE COMPRAN AQUÍ</div>
            <span style={{ font: '700 11.5px/1 var(--f-mono)', color: 'var(--wine)' }}>${(totalValue/1000).toFixed(0)}K total</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {clients.map(c => {
              const client = D.CLIENTS.find(x => x.markbox === c.clientMarkbox);
              if (!client) return null;
              return (
                <div key={c.clientMarkbox} style={{
                  display: 'grid', gridTemplateColumns: '24px 1fr 100px 90px 90px',
                  gap: 12, alignItems: 'center',
                  padding: '10px 12px',
                  background: c.favorite ? 'var(--wine-tint)' : 'var(--bg-elevated)',
                  borderRadius: 'var(--r-md)',
                  cursor: 'pointer',
                }}
                onClick={() => goTo?.('clients', client.markbox, 'detail')}
                >
                  {c.favorite ? <span style={{ color: 'var(--wine)' }}>★</span> : <span />}
                  <div>
                    <div style={{ font: '700 12.5px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{client.company}</div>
                    <code style={{ font: '600 11px/1.2 var(--f-mono)', color: c.favorite ? 'var(--wine)' : 'var(--ink-mute)' }}>{c.clientMarkbox}</code>
                  </div>
                  <span className="mono" style={{ font: '700 12px/1 var(--f-mono)', color: 'var(--ink-soft)', textAlign: 'right' }}>{c.shipments} envíos</span>
                  <span className="mono" style={{ font: '800 12.5px/1 var(--f-mono)', color: 'var(--ink)', textAlign: 'right' }}>${(c.totalValue/1000).toFixed(0)}K</span>
                  <span style={{ font: '500 11px/1 var(--f-mono)', color: 'var(--ink-mute)', textAlign: 'right' }}>desde {c.since}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
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
  return (
    <U.Drawer open={open} onClose={onClose} title="Nuevo proveedor chino" subtitle="Alta de supplier en la base de datos DTD" width={620}
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

        <div className="eyebrow eyebrow-wine" style={{ marginTop: 8 }}>ESTADO INICIAL</div>
        <U.Select label="Status" options={['aprobado · uso normal', 'preferido · uso priorizado', 'observación · necesita revisión']} />

        <U.Input label="Notas internas" placeholder="Calidad, comunicación, condiciones de pago, observaciones…" />
      </div>
    </U.Drawer>
  );
}

window.ModuleSuppliers = ModuleSuppliers;
