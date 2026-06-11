/* global React */
/* ── DTD Portal Cliente · Mobile · pantallas secundarias + primitivos ──
   Carga ANTES de portal/mobile.jsx. Expone:
   · window.PM       → primitivos UI móviles (SubHeader, Section, ListRow, Sheet, Chip)
   · window.PMExtra  → pantallas (Pagar, Proveedores, Más + subpantallas, NotifSheet)
   Reusa tokens + ERPUI + ERPData + Icon. Cero hex inventados.            */

const { useState: mUseState, useEffect: mUseEffect } = React;

// ════════════════════════════════════════════════════════════════
// PRIMITIVOS MÓVILES
// ════════════════════════════════════════════════════════════════

// Encabezado de subpantalla con botón volver
function SubHeader({ title, subtitle, onBack, action }) {
  const I = window.Icon;
  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 20,
      background: 'var(--bg-base)', borderBottom: '1px solid var(--border)',
      padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12,
    }}>
      {onBack && (
        <button onClick={onBack} aria-label="Volver" style={{
          width: 40, height: 40, flexShrink: 0, borderRadius: 'var(--r-pill)',
          background: 'var(--bg-elevated)', color: 'var(--ink)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>{I.arrowL(18)}</button>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ font: '800 17px/1.1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.01em' }}>{title}</div>
        {subtitle && <div style={{ font: '500 12px/1.3 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 3 }}>{subtitle}</div>}
      </div>
      {action}
    </div>
  );
}

// Bloque de sección con eyebrow
function Section({ title, right, children, style = {} }) {
  return (
    <section style={{ marginBottom: 'var(--s-6)', ...style }}>
      {(title || right) && (
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 'var(--s-3)' }}>
          {title && <div className="eyebrow eyebrow-wine">{title}</div>}
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

// Fila de lista táctil (≥56px)
function ListRow({ icon, iconTone = 'wine', title, sub, right, onClick, badge }) {
  const tones = { wine: 'var(--wine)', info: 'var(--info)', success: 'var(--success)', warning: 'var(--warning)', neutral: 'var(--ink-soft)' };
  return (
    <button onClick={onClick} style={{
      width: '100%', minHeight: 60, display: 'flex', alignItems: 'center', gap: 14,
      padding: '12px 14px', background: 'var(--bg-surface)',
      border: '1px solid var(--border)', borderRadius: 'var(--r-lg)',
      textAlign: 'left', cursor: 'pointer',
    }}>
      {icon && (
        <span style={{
          width: 40, height: 40, flexShrink: 0, borderRadius: 'var(--r-md)',
          background: 'var(--bg-elevated)', color: tones[iconTone] || tones.wine,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>{icon}</span>
      )}
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', font: '700 14px/1.25 var(--f-sans)', color: 'var(--ink)' }}>{title}</span>
        {sub && <span style={{ display: 'block', font: '500 12px/1.35 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 2 }}>{sub}</span>}
      </span>
      {badge}
      {right !== undefined ? right : <span style={{ color: 'var(--ink-mute)', flexShrink: 0 }}>{window.Icon.chevR(16)}</span>}
    </button>
  );
}

// Chip de filtro
function Chip({ active, children, onClick, count }) {
  return (
    <button onClick={onClick} style={{
      flexShrink: 0, padding: '8px 14px', borderRadius: 'var(--r-pill)',
      background: active ? 'var(--wine)' : 'var(--bg-surface)',
      border: `1px solid ${active ? 'var(--wine)' : 'var(--border)'}`,
      color: active ? '#fff' : 'var(--ink-soft)',
      font: '700 12.5px/1 var(--f-sans)', cursor: 'pointer', whiteSpace: 'nowrap',
      display: 'inline-flex', alignItems: 'center', gap: 6,
    }}>
      {children}
      {count != null && <span style={{ font: '700 11px/1 var(--f-mono)', opacity: 0.8 }}>{count}</span>}
    </button>
  );
}

// Bottom sheet
function Sheet({ open, onClose, title, children }) {
  mUseEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(15,30,61,0.45)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      animation: 'erp-fade 180ms var(--ease)',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: '100%', maxWidth: 480, maxHeight: '85vh', overflowY: 'auto',
        background: 'var(--bg-base)', borderRadius: 'var(--r-xl) var(--r-xl) 0 0',
        padding: '10px 16px calc(20px + env(safe-area-inset-bottom))',
        animation: 'mobile-bounce-in 320ms var(--ease)',
      }}>
        <div style={{ width: 38, height: 4, borderRadius: 'var(--r-pill)', background: 'var(--border-strong, var(--border))', margin: '4px auto 14px' }} />
        {title && <div style={{ font: '800 18px/1.1 var(--f-display)', color: 'var(--ink)', marginBottom: 'var(--s-4)' }}>{title}</div>}
        {children}
      </div>
    </div>
  );
}

Object.assign(window, { SubHeader, Section, ListRow, Chip, Sheet });
window.PM = { SubHeader, Section, ListRow, Chip, Sheet };

// ════════════════════════════════════════════════════════════════
// PAGAR · facturas del cliente
// ════════════════════════════════════════════════════════════════
function PagarScreen({ invs }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const [pay, setPay] = mUseState(null);
  const statusTone = { pagada: 'success', emitida: 'info', parcial: 'warning', vencida: 'danger' };
  const outstanding = invs.reduce((s, i) => s + i.balance, 0);
  const pending = invs.filter(i => i.balance > 0).sort((a, b) => new Date(a.due) - new Date(b.due));
  const paid = invs.filter(i => i.balance === 0);

  return (
    <div style={{ padding: '18px 16px 24px' }}>
      <h1 style={{ font: '900 26px/1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em', margin: '0 0 18px' }}>Pagar</h1>

      {/* Hero saldo */}
      <div style={{
        padding: 22, borderRadius: 'var(--r-xl)', marginBottom: 'var(--s-6)',
        background: outstanding > 0 ? 'linear-gradient(135deg, var(--ink), #1F3055)' : 'var(--bg-surface)',
        border: outstanding > 0 ? 0 : '1px solid var(--border)',
        color: outstanding > 0 ? '#fff' : 'var(--ink)',
      }}>
        <div style={{ font: '700 10.5px/1 var(--f-sans)', letterSpacing: '0.16em', textTransform: 'uppercase', color: outstanding > 0 ? 'var(--wine-soft)' : 'var(--ink-mute)' }}>SALDO PENDIENTE</div>
        <div style={{ font: '900 38px/1 var(--f-display)', letterSpacing: '-0.025em', margin: '12px 0 6px' }}>${outstanding.toLocaleString()}</div>
        <div style={{ font: '500 12.5px/1.4 var(--f-sans)', color: outstanding > 0 ? 'rgba(255,255,255,0.7)' : 'var(--ink-soft)' }}>
          {pending.length === 0 ? 'Estás al día. Gracias.' : `${pending.length} ${pending.length === 1 ? 'factura por pagar' : 'facturas por pagar'}`}
        </div>
      </div>

      {pending.length > 0 && (
        <window.PM.Section title="POR PAGAR">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pending.map(inv => (
              <U.Card key={inv.id} padded style={{ padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <code style={{ font: '800 13px/1 var(--f-mono)', color: 'var(--ink)' }}>{inv.id}</code>
                  <U.Badge tone={statusTone[inv.status]} size="sm" dot>{inv.status}</U.Badge>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ font: '500 11.5px/1 var(--f-sans)', color: 'var(--ink-mute)' }}>Vence {inv.due}</div>
                    <div style={{ font: '500 11.5px/1 var(--f-mono)', color: 'var(--ink-soft)', marginTop: 5 }}>{inv.shipment}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ font: '900 20px/1 var(--f-display)', color: 'var(--wine)' }}>${inv.balance.toLocaleString()}</div>
                    {inv.paid > 0 && <div style={{ font: '500 10.5px/1 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 4 }}>de ${inv.amount.toLocaleString()}</div>}
                  </div>
                </div>
                <U.Btn variant="primary" full icon={I.invoice(14)} style={{ marginTop: 14 }} onClick={() => setPay(inv)}>Pagar factura</U.Btn>
              </U.Card>
            ))}
          </div>
        </window.PM.Section>
      )}

      {paid.length > 0 && (
        <window.PM.Section title="HISTORIAL · PAGADAS">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {paid.map(inv => (
              <window.PM.ListRow key={inv.id} icon={I.check(16)} iconTone="success"
                title={inv.id} sub={`${inv.shipment} · pagada`} onClick={() => setPay(inv)}
                right={<span style={{ font: '700 13px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>${inv.amount.toLocaleString()}</span>} />
            ))}
          </div>
        </window.PM.Section>
      )}

      <window.PM.Sheet open={!!pay} onClose={() => setPay(null)} title={pay ? pay.id : ''}>
        {pay && <FacturaDetail inv={pay} onDone={() => setPay(null)} />}
      </window.PM.Sheet>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// PROVEEDORES · re-compra rápida
// ════════════════════════════════════════════════════════════════
function ProveedoresScreen({ me, verified, inReview, onVerify }) {
  const D = window.ERPData;
  const U = window.ERPUI;
  const I = window.Icon;
  const [add, setAdd] = mUseState(false);
  const [intro, setIntro] = mUseState(() => { try { return localStorage.getItem('dtd-portal-mobile-prov-intro') !== '1'; } catch (e) { return true; } });
  const dismissIntro = () => { setIntro(false); try { localStorage.setItem('dtd-portal-mobile-prov-intro', '1'); } catch (e) {} };
  const [added, setAdded] = mUseState(null);
  const [copiedLbl, setCopiedLbl] = mUseState(false);
  const [rebought, setRebought] = mUseState({});
  const links = (D.SUPPLIER_CLIENTS || []).filter(sc => sc.clientMarkbox === me.markbox);
  const rows = links.map(l => ({ ...l, sup: (D.SUPPLIERS || []).find(s => s.id === l.supplierId) })).filter(r => r.sup);

  if (verified === false) {
    return (
      <div style={{ padding: '18px 16px 24px' }}>
        <h1 style={{ font: '900 26px/1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em', margin: '0 0 18px' }}>Proveedores</h1>
        <div style={{ padding: 22, borderRadius: 'var(--r-xl)', background: 'var(--bg-surface)', border: '1px solid var(--border)', textAlign: 'center' }}>
          <span style={{ width: 52, height: 52, borderRadius: 'var(--r-lg)', background: inReview ? 'var(--bg-elevated)' : 'var(--wine-tint)', color: inReview ? 'var(--info)' : 'var(--wine)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>{inReview ? I.clock(22) : I.lock(22)}</span>
          <div style={{ font: '800 16px/1.2 var(--f-display)', color: 'var(--ink)' }}>{inReview ? 'Verificación en revisión' : 'Necesitas tu Shipping Mark'}</div>
          <p style={{ font: '500 13px/1.5 var(--f-sans)', color: 'var(--ink-soft)', margin: '8px 0 18px' }}>{inReview ? 'Apenas aprobemos tus documentos vas a poder cargar proveedores y pedir re-compras.' : 'Para cargar proveedores y pedir re-compras primero verifica tu identidad. Es rápido: dirección + cédula.'}</p>
          {!inReview && <U.Btn variant="primary" full icon={I.shield(14)} onClick={onVerify}>Verificar ahora</U.Btn>}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '18px 16px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 18 }}>
        <h1 style={{ font: '900 26px/1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em', margin: 0 }}>Comprar en China</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setIntro(true)} aria-label="¿Cómo funciona?" style={{ width: 34, height: 34, borderRadius: 'var(--r-pill)', background: 'var(--bg-elevated)', color: 'var(--ink-soft)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{I.info(16)}</button>
          <U.Btn variant="secondary" size="sm" icon={I.plus(13)} onClick={() => setAdd(true)}>Agregar</U.Btn>
        </div>
      </div>

      {intro && (
        <div style={{ marginBottom: 'var(--s-5)', borderRadius: 'var(--r-xl)', overflow: 'hidden', border: '1px solid var(--border)' }}>
          <div style={{ padding: '18px 18px 16px', background: 'linear-gradient(135deg, var(--ink), #1F3055)', color: '#fff', position: 'relative' }}>
            <button onClick={dismissIntro} aria-label="Cerrar" style={{ position: 'absolute', top: 12, right: 12, width: 28, height: 28, borderRadius: 'var(--r-pill)', background: 'rgba(255,255,255,0.12)', color: '#fff', fontSize: 15 }}>×</button>
            <div style={{ font: '700 10px/1 var(--f-sans)', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--wine-soft)' }}>Tu centro de compras</div>
            <div style={{ font: '900 19px/1.2 var(--f-display)', letterSpacing: '-0.01em', margin: '8px 0 8px' }}>Toda tu importación, ordenada por código.</div>
            <p style={{ font: '500 12.5px/1.5 var(--f-sans)', color: 'rgba(255,255,255,0.72)', margin: 0 }}>Acá manejás tus fábricas en China y le haces seguimiento a cada compra. Mientras más ordenado, más rápido y seguro llega todo a tu puerta.</p>
          </div>
          <div style={{ padding: 16, background: 'var(--bg-surface)', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { icon: 'radar', tone: 'info', t: 'Seguís tus compras', d: 'Veés el estado de cada pedido, desde la fábrica hasta tu local.' },
              { icon: 'warehouse', tone: 'wine', t: 'Registras tus proveedores', d: 'Guardás cada fábrica para pedir re-compras en un toque.' },
              { icon: 'tag', tone: 'success', t: 'Todo bajo tu código', d: 'Cada compra queda asociada a tu Shipping Mark — nada se mezcla ni se pierde.' },
            ].map((it, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span style={{ width: 36, height: 36, flexShrink: 0, borderRadius: 'var(--r-md)', background: 'var(--bg-elevated)', color: `var(--${it.tone})`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{I[it.icon]?.(17)}</span>
                <div><div style={{ font: '700 13px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{it.t}</div><div style={{ font: '500 11.5px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 2 }}>{it.d}</div></div>
              </div>
            ))}
            {/* Sistema de codificación */}
            <div style={{ marginTop: 4, padding: 14, background: 'var(--bg-elevated)', borderRadius: 'var(--r-lg)' }}>
              <div style={{ font: '700 10px/1 var(--f-sans)', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-mute)', marginBottom: 8 }}>Cómo funciona el código</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                <code style={{ font: '800 13px/1 var(--f-mono)', color: 'var(--wine)', padding: '5px 8px', background: 'var(--wine-tint)', borderRadius: 'var(--r-sm)' }}>{me.markbox}</code>
                <span style={{ font: '500 12px/1.4 var(--f-sans)', color: 'var(--ink-soft)' }}>es tu Shipping Mark: te identifica a tú.</span>
              </div>
              <p style={{ font: '500 11.5px/1.5 var(--f-sans)', color: 'var(--ink-soft)', margin: 0 }}>Cada caja en China se etiqueta con tu Shipping Mark y su número de caja (<code style={{ font: '700 11px/1 var(--f-mono)', color: 'var(--ink)' }}>Caja 1/4</code>). Así consolidamos solo lo tuyo y lo rastreas por su código de embarque <code style={{ font: '700 11px/1 var(--f-mono)', color: 'var(--ink)' }}>DTDU-…</code> hasta la entrega.</p>
            </div>
            <button onClick={dismissIntro} style={{ alignSelf: 'flex-start', background: 'none', border: 0, color: 'var(--wine)', font: '700 12.5px/1 var(--f-sans)', cursor: 'pointer', padding: '4px 0' }}>Entendido</button>
          </div>
        </div>
      )}

      <p style={{ font: '500 13px/1.5 var(--f-sans)', color: 'var(--ink-soft)', margin: '0 0 var(--s-5)' }}>
        Tus fábricas en China. Pide re-compra con tu Shipping Mark <code style={{ font: '700 12px/1 var(--f-mono)', color: 'var(--wine)' }}>{me.markbox}</code> y nosotros consolidamos.
      </p>

      {rows.length === 0 ? (
        <U.EmptyState icon={I.warehouse(22)} title="Sin proveedores aún" body="Agregá tu primera fábrica para pedir re-compras en un toque." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map(r => (
            <U.Card key={r.supplierId} padded style={{ padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <span style={{ width: 44, height: 44, flexShrink: 0, borderRadius: 'var(--r-md)', background: 'var(--bg-elevated)', color: 'var(--wine)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{I.warehouse(20)}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ font: '800 14px/1.2 var(--f-display)', color: 'var(--ink)' }}>{r.sup.name}</div>
                    {r.favorite && <span style={{ color: 'var(--warning)' }}>{I.star(13)}</span>}
                  </div>
                  <div style={{ font: '500 12px/1.3 var(--f-cn)', color: 'var(--ink-soft)', marginTop: 3 }}>{r.sup.cn}</div>
                  <div style={{ font: '500 11.5px/1.3 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 4 }}>{r.sup.city} · {r.sup.industry}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 18, margin: '14px 0', padding: '12px 0', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
                <div><div style={{ font: '500 10px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Envíos</div><div style={{ font: '800 16px/1 var(--f-display)', color: 'var(--ink)', marginTop: 5 }}>{r.shipments}</div></div>
                <div><div style={{ font: '500 10px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Total</div><div style={{ font: '800 16px/1 var(--f-mono)', color: 'var(--ink)', marginTop: 5 }}>${(r.totalValue / 1000).toFixed(0)}K</div></div>
                <div><div style={{ font: '500 10px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Desde</div><div style={{ font: '800 16px/1 var(--f-mono)', color: 'var(--ink)', marginTop: 5 }}>{r.since}</div></div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <U.Btn variant={rebought[r.supplierId] ? 'soft' : 'primary'} size="sm" full
                  icon={rebought[r.supplierId] ? I.check(13) : I.refresh(13)}
                  disabled={!!rebought[r.supplierId]}
                  onClick={() => {
                    try {
                      window.DTDData && window.DTDData.pushPortalEvent && window.DTDData.pushPortalEvent({
                        kind: 'recompra', tone: 'success', markbox: me.markbox,
                        title: 'Re-compra solicitada · ' + (me.name || me.markbox),
                        detail: r.sup.name + (r.sup.city ? ' · ' + r.sup.city : ''),
                        channel: 'portal-mobile',
                        meta: { supplierId: r.supplierId, supplier: r.sup.name },
                      });
                    } catch (e) { console.error('[recompra] pushPortalEvent falló:', e); }
                    setRebought(s => ({ ...s, [r.supplierId]: true }));
                  }}>{rebought[r.supplierId] ? 'Pedido enviado' : 'Pedir re-compra'}</U.Btn>
                <U.Btn variant="secondary" size="sm" icon={I.chat(13)}>Mensaje</U.Btn>
              </div>
            </U.Card>
          ))}
        </div>
      )}

      <window.PM.Sheet open={add} onClose={() => { setAdd(false); setAdded(null); }} title={added ? 'Etiqueta para tu fábrica' : 'Agregar proveedor'}>
        {!added ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-4)' }}>
            <U.Input label="Nombre de la fábrica" placeholder="Ej. Yiwu Standard Trading" />
            <U.Input label="Ciudad en China" placeholder="Yiwu · Shenzhen · Guangzhou…" />
            <U.Input label="Contacto (WeChat / teléfono)" placeholder="Opcional" />
            <p style={{ font: '500 11.5px/1.5 var(--f-sans)', color: 'var(--ink-mute)', margin: 0 }}>Al agregarla te damos la etiqueta con tu Shipping Mark para que se la pases a la fábrica. Así marcan tus cajas y nosotros las consolidamos.</p>
            <U.Btn variant="primary" full onClick={() => setAdded(true)}>Agregar y generar etiqueta</U.Btn>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, background: 'var(--success-bg)', borderRadius: 'var(--r-lg)' }}>
              <span style={{ color: 'var(--success)' }}>{I.check(17)}</span>
              <span style={{ font: '700 13px/1.4 var(--f-sans)', color: 'var(--ink)' }}>Proveedor agregado. Mandále esta etiqueta a tu fábrica.</span>
            </div>

            {/* Etiqueta bilingüe ES / 中文 */}
            <div style={{ borderRadius: 'var(--r-lg)', overflow: 'hidden', border: '1px solid var(--border)' }}>
              <div style={{ padding: '14px 16px', background: 'var(--ink)', color: '#fff', textAlign: 'center' }}>
                <div style={{ font: '700 9.5px/1 var(--f-sans)', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--wine-soft)' }}>DTD-Cargo · Shipping Mark</div>
                <code style={{ font: '900 30px/1 var(--f-mono)', letterSpacing: '0.04em', display: 'block', marginTop: 8 }}>{me.markbox}</code>
              </div>
              <div style={{ padding: 16, background: 'var(--bg-surface)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <div style={{ font: '700 11px/1.4 var(--f-sans)', color: 'var(--ink)' }}>Etiquetá cada caja con este código y su número (Caja 1/N).</div>
                  <div style={{ font: '700 12px/1.5 var(--f-cn)', color: 'var(--ink-soft)', marginTop: 4 }}>请在每个箱子上标注此代码和箱号（箱 1/N）。</div>
                </div>
                <div style={{ height: 1, background: 'var(--border)' }} />
                <div>
                  <div style={{ font: '500 10px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Enviar al almacén · 发到仓库</div>
                  <div style={{ font: '600 12px/1.5 var(--f-sans)', color: 'var(--ink)' }}>DTD-Cargo Yiwu Warehouse · 义乌仓库</div>
                  <div style={{ font: '500 11.5px/1.5 var(--f-cn)', color: 'var(--ink-soft)' }}>浙江省义乌市 · No. 8 Chouzhou Rd · +86 579 0000 0000</div>
                </div>
              </div>
            </div>

            <U.Btn variant="primary" full icon={copiedLbl ? I.check(14) : I.chat(14)}
              onClick={() => {
                const txt = `DTD-Cargo · Shipping Mark: ${me.markbox}\nEtiquetá cada caja con este código + número de caja (Caja 1/N).\n请在每个箱子上标注此代码和箱号。\nEnviar a / 发到: DTD-Cargo Yiwu Warehouse 义乌仓库`;
                try { navigator.clipboard && navigator.clipboard.writeText(txt); } catch (e) {}
                setCopiedLbl(true); setTimeout(() => setCopiedLbl(false), 1800);
              }}>{copiedLbl ? 'Copiado · compártelo por WeChat' : 'Copiar instrucciones para la fábrica'}</U.Btn>
            <U.Btn variant="ghost" full onClick={() => { setAdd(false); setAdded(null); }}>Listo</U.Btn>
          </div>
        )}
      </window.PM.Sheet>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// MÁS · menú + subpantallas
// ════════════════════════════════════════════════════════════════
function MasScreen({ me, theme, setTheme, onLogout, onOpen }) {
  const I = window.Icon;
  const U = window.ERPUI;
  return (
    <div style={{ padding: '18px 16px 24px' }}>
      <h1 style={{ font: '900 26px/1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em', margin: '0 0 18px' }}>Más</h1>

      {/* Perfil card */}
      <button onClick={() => onOpen('perfil')} style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 14, padding: 16, marginBottom: 'var(--s-6)', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', cursor: 'pointer' }}>
        <U.Avatar initials={me.name.split(' ').map(w => w[0]).slice(0, 2).join('')} color="wine" size={52} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ font: '800 16px/1.2 var(--f-display)', color: 'var(--ink)' }}>{me.name}</div>
          <div style={{ font: '500 12.5px/1.3 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 3 }}>{me.company}</div>
          <code style={{ font: '700 11.5px/1 var(--f-mono)', color: 'var(--wine)', marginTop: 5, display: 'inline-block' }}>{me.markbox}</code>
        </div>
        <span style={{ color: 'var(--ink-mute)' }}>{I.chevR(16)}</span>
      </button>

      <window.PM.Section title="TU CUENTA">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <window.PM.ListRow icon={I.doc(16)}   iconTone="info"    title="Documentos"  sub="BL, facturas, packing lists" onClick={() => onOpen('documentos')} />
          <window.PM.ListRow icon={I.spark(16)} iconTone="wine"    title="Referidos"    sub="Ganá descuentos invitando" onClick={() => onOpen('referidos')} />
          <window.PM.ListRow icon={I.chat(16)}  iconTone="success" title="Soporte"      sub="Abre un caso o hablá con tu agente" onClick={() => onOpen('soporte')} />
        </div>
      </window.PM.Section>

      <window.PM.Section title="PREFERENCIAS">
        <window.PM.ListRow
          icon={theme === 'dark' ? I.moon(16) : I.sun(16)} iconTone="neutral"
          title="Tema oscuro" sub="Cómodo de noche"
          right={
            <span onClick={(e) => { e.stopPropagation(); setTheme(theme === 'dark' ? 'light' : 'dark'); }}
              style={{ width: 44, height: 26, borderRadius: 'var(--r-pill)', flexShrink: 0, background: theme === 'dark' ? 'var(--wine)' : 'var(--border-strong, var(--border))', position: 'relative', transition: 'background var(--dur-fast) var(--ease)', cursor: 'pointer' }}>
              <span style={{ position: 'absolute', top: 3, left: theme === 'dark' ? 21 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left var(--dur-fast) var(--ease)' }} />
            </span>
          }
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        />
      </window.PM.Section>

      <window.ERPUI.Btn variant="ghost" full onClick={onLogout} style={{ color: 'var(--danger)' }}>Cerrar sesión</window.ERPUI.Btn>
      <div style={{ textAlign: 'center', marginTop: 'var(--s-6)', font: '500 11px/1.5 var(--f-sans)', color: 'var(--ink-mute)' }}>
        DTD-Cargo · Portal Cliente v2.3<br />Con Confianza, de China a tu puerta.
      </div>
    </div>
  );
}

// ── Subpantalla: Documentos ──────────────────────────────────
function DocumentosScreen({ onBack, ships }) {
  const I = window.Icon;
  const docs = ships.filter(s => s.billed).flatMap(s => ([
    { id: s.invoice, kind: 'Factura', ship: s.id, tone: 'wine' },
    { id: 'BL-' + s.id.slice(5), kind: 'Bill of Lading', ship: s.id, tone: 'info' },
    { id: 'PL-' + s.id.slice(5), kind: 'Packing list', ship: s.id, tone: 'neutral' },
  ])).slice(0, 9);
  return (
    <div>
      <window.PM.SubHeader title="Documentos" subtitle={`${docs.length} archivos disponibles`} onBack={onBack} />
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {docs.map((d, i) => (
          <window.PM.ListRow key={i} icon={I.doc(16)} iconTone={d.tone}
            title={d.id} sub={`${d.kind} · ${d.ship}`}
            right={<span style={{ color: 'var(--wine)' }}>{I.download(16)}</span>} />
        ))}
      </div>
    </div>
  );
}

// ── Subpantalla: Referidos ───────────────────────────────────
function ReferidosScreen({ onBack, me }) {
  const U = window.ERPUI;
  const I = window.Icon;
  // Feature flag · si está OFF, el cliente ve "Próximamente"
  const flags = (window.DTDFlags && window.DTDFlags.getFlags()) || {};
  if (!flags.referidos) {
    return (
      <div>
        <window.PM.SubHeader title="Referidos" onBack={onBack} />
        <div style={{ padding: '40px 24px', textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: 'var(--r-lg)', background: 'var(--wine-tint)', color: 'var(--wine)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>{I.star ? I.star(30) : I.spark(30)}</div>
          <div style={{ font: '900 22px/1.1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em' }}>Próximamente</div>
          <div style={{ font: '500 13.5px/1.6 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 10 }}>
            Estamos afinando el programa de referidos. Muy pronto vas a poder invitar a otros importadores y ganar crédito por cada uno.
          </div>
        </div>
      </div>
    );
  }
  const code = 'DTD-' + me.markbox.slice(4);
  const [copied, setCopied] = mUseState(false);
  return (
    <div>
      <window.PM.SubHeader title="Referidos" subtitle="Construyendo confianza, cliente a cliente" onBack={onBack} />
      <div style={{ padding: '16px 16px 24px' }}>
        <div style={{ padding: 22, borderRadius: 'var(--r-xl)', background: 'linear-gradient(135deg, var(--ink), #1F3055)', color: '#fff', marginBottom: 'var(--s-6)' }}>
          <div style={{ font: '700 10.5px/1 var(--f-sans)', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--wine-soft)' }}>TU CÓDIGO</div>
          <code style={{ font: '900 30px/1 var(--f-mono)', letterSpacing: '0.02em', display: 'block', margin: '14px 0 16px' }}>{code}</code>
          <button onClick={() => { setCopied(true); setTimeout(() => setCopied(false), 1600); }} style={{ width: '100%', padding: '12px', borderRadius: 'var(--r-md)', background: '#fff', color: 'var(--ink)', font: '700 13px/1 var(--f-sans)', cursor: 'pointer' }}>
            {copied ? '✓ Copiado' : 'Copiar y compartir'}
          </button>
        </div>
        <window.PM.Section title="CÓMO FUNCIONA">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { n: '1', t: 'Comparte tu código', d: 'Pasáselo a otro importador.' },
              { n: '2', t: 'Hace su primer embarque', d: 'Usando tu código al registrarse.' },
              { n: '3', t: 'Ganan los dos', d: '$50 de crédito para cada uno.' },
            ].map(s => (
              <div key={s.n} style={{ display: 'flex', gap: 12, padding: 14, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)' }}>
                <span style={{ width: 28, height: 28, flexShrink: 0, borderRadius: '50%', background: 'var(--wine-tint)', color: 'var(--wine)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', font: '800 13px/1 var(--f-display)' }}>{s.n}</span>
                <div><div style={{ font: '700 13.5px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{s.t}</div><div style={{ font: '500 12px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 3 }}>{s.d}</div></div>
              </div>
            ))}
          </div>
        </window.PM.Section>
        <div style={{ display: 'flex', gap: 12 }}>
          <U.KPI label="Invitados" value="3" tone="wine" icon={I.users(16)} style={{ flex: 1 }} />
          <U.KPI label="Crédito ganado" value="$150" tone="success" icon={I.spark(16)} style={{ flex: 1 }} />
        </div>
      </div>
    </div>
  );
}

// ── Subpantalla: Soporte · fusión Reclamos + Soporte ──
function SoporteScreen({ onBack }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const [open, setOpen] = mUseState(false);
  const [msg, setMsg] = mUseState('');
  const tickets = [
    { id: 'SP-2026-0042', t: 'Faltante en CN-2026-2836', tipo: 'Faltante', step: 'en-revision', date: '24 may', tone: 'warning' },
    { id: 'SP-2026-0031', t: 'Daño en caja 4 de 12', tipo: 'Daño', step: 'resuelto', date: '18 may', tone: 'success' },
    { id: 'SP-2026-0028', t: 'Consulta sobre tarifa de almacenaje', tipo: 'Consulta', step: 'resuelto', date: '12 may', tone: 'success' },
  ];
  const stepLabel = { recibido: 'Recibido', 'en-revision': 'En revisión', resuelto: 'Resuelto' };
  return (
    <div>
      <window.PM.SubHeader title="Soporte" subtitle="Respuesta típica en menos de 1 hora" onBack={onBack}
        action={<U.Btn variant="primary" size="sm" icon={I.plus(13)} onClick={() => setOpen(true)}>Nuevo caso</U.Btn>} />
      <div style={{ padding: '16px 16px 24px' }}>
        {/* Agente */}
        <U.Card padded style={{ padding: 16, marginBottom: 'var(--s-6)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <U.Avatar initials="MA" color="wine" size={48} />
            <div style={{ flex: 1 }}>
              <div style={{ font: '800 14px/1.2 var(--f-display)', color: 'var(--ink)' }}>Martina Acuña</div>
              <div style={{ font: '500 11.5px/1.2 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 3 }}>Tu agente · LATAM</div>
            </div>
            <U.Badge tone="success" size="sm" dot>en línea</U.Badge>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <U.Btn variant="secondary" size="sm" full icon={I.chat(13)}>WhatsApp</U.Btn>
            <U.Btn variant="secondary" size="sm" full icon={I.mail(13)}>Email</U.Btn>
          </div>
        </U.Card>

        {/* Casos */}
        <window.PM.Section title="TUS CASOS">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {tickets.map(c => (
              <U.Card key={c.id} padded style={{ padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <code style={{ font: '800 12.5px/1 var(--f-mono)', color: 'var(--ink)' }}>{c.id}</code>
                    <U.Badge tone="neutral" size="sm">{c.tipo}</U.Badge>
                  </div>
                  <U.Badge tone={c.tone} size="sm" dot>{stepLabel[c.step]}</U.Badge>
                </div>
                <div style={{ font: '600 13.5px/1.3 var(--f-sans)', color: 'var(--ink)' }}>{c.t}</div>
                <div style={{ font: '500 11.5px/1 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 6 }}>Abierto el {c.date}</div>
              </U.Card>
            ))}
          </div>
        </window.PM.Section>
      </div>

      {/* Nuevo caso */}
      <window.PM.Sheet open={open} onClose={() => { setOpen(false); setMsg(''); }} title="Nuevo caso">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-4)' }}>
          <U.Select label="Tipo" options={[{ value: 'consulta', label: 'Consulta general' }, { value: 'faltante', label: 'Faltante' }, { value: 'daño', label: 'Daño' }, { value: 'demora', label: 'Demora' }, { value: 'pago', label: 'Facturación / pago' }, { value: 'otro', label: 'Otro' }]} />
          <U.Select label="Embarque relacionado" hint="Opcional · solo si aplica" options={[{ value: '', label: 'Ninguno / general' }]} />
          <U.Input label="Cuéntanos qué necesitas" placeholder="Escribe el detalle…" value={msg} onChange={(e) => setMsg(e.target.value)} />
          <U.Btn variant="primary" full disabled={!msg.trim()} onClick={() => { setOpen(false); setMsg(''); }}>Enviar</U.Btn>
        </div>
      </window.PM.Sheet>
    </div>
  );
}

// ── Subpantalla: Perfil ──────────────────────────────────────
function PerfilScreen({ onBack, me }) {
  const U = window.ERPUI;
  return (
    <div>
      <window.PM.SubHeader title="Mi perfil" onBack={onBack} />
      <div style={{ padding: '16px 16px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 'var(--s-6)' }}>
          <U.Avatar initials={me.name.split(' ').map(w => w[0]).slice(0, 2).join('')} color="wine" size={64} />
          <div>
            <div style={{ font: '900 20px/1.1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.01em' }}>{me.name}</div>
            <div style={{ font: '500 13px/1.3 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 4 }}>{me.company}</div>
          </div>
        </div>
        <window.PM.Section title="DATOS DE CUENTA">
          <U.Card padded style={{ padding: '6px 16px' }}>
            {[['Shipping Mark', me.markbox, true], ['RIF', me.rif, true], ['Segmento', me.segment], ['Ciudad', me.city], ['Embarques', String(me.shipments)]].map(([k, v, mono], i, arr) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderTop: i > 0 ? '1px solid var(--border)' : 0 }}>
                <span style={{ font: '500 12.5px/1 var(--f-sans)', color: 'var(--ink-soft)' }}>{k}</span>
                <span style={{ font: `700 13px/1 ${mono ? 'var(--f-mono)' : 'var(--f-sans)'}`, color: 'var(--ink)' }}>{v}</span>
              </div>
            ))}
          </U.Card>
        </window.PM.Section>
        <window.PM.Section title="SEGURIDAD">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <window.PM.ListRow icon={window.Icon.lock(16)} iconTone="neutral" title="Cambiar contraseña" sub="Recomendado cada 90 días" onClick={() => {}} />
          </div>
        </window.PM.Section>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// CENTRO DE AVISOS (bottom sheet)
// ════════════════════════════════════════════════════════════════
function NotifSheet({ open, onClose, ships }) {
  const I = window.Icon;
  const avisos = [];
  ships.forEach(s => {
    if (s.alert) avisos.push({ tone: 'warning', icon: 'warn', t: `${s.id} · ${s.alert}`, m: 'Tu agente sigue el caso' });
    if (s.status === 'liberado') avisos.push({ tone: 'success', icon: 'check', t: `${s.id} liberado en aduana`, m: 'Listo para entrega' });
    if (s.status === 'tránsito') avisos.push({ tone: 'info', icon: 'ship', t: `${s.id} en tránsito · ${s.progress}%`, m: `ETA ${s.eta}` });
  });
  if (avisos.length === 0) avisos.push({ tone: 'neutral', icon: 'bell', t: 'No tienes avisos nuevos', m: 'Te avisamos cuando haya novedades' });
  return (
    <window.PM.Sheet open={open} onClose={onClose} title="Avisos">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {avisos.map((a, i) => (
          <div key={i} style={{ display: 'flex', gap: 12, padding: 14, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)' }}>
            <span style={{ width: 36, height: 36, flexShrink: 0, borderRadius: 'var(--r-md)', background: 'var(--bg-elevated)', color: `var(--${a.tone === 'neutral' ? 'ink-soft' : a.tone})`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{I[a.icon]?.(16)}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ font: '700 13px/1.3 var(--f-sans)', color: 'var(--ink)' }}>{a.t}</div>
              <div style={{ font: '500 11.5px/1.3 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 3 }}>{a.m}</div>
            </div>
          </div>
        ))}
      </div>
    </window.PM.Sheet>
  );
}

// ════════════════════════════════════════════════════════════════
// DETALLE DE FACTURA · desglose + pago + comprobante
// ════════════════════════════════════════════════════════════════
function FacturaDetail({ inv, onDone }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const D = window.ERPData;
  const [proof, setProof] = mUseState(null);
  const [sent, setSent] = mUseState(false);
  const statusTone = { pagada: 'success', emitida: 'info', parcial: 'warning', vencida: 'danger' };
  const ship = D.SHIPMENTS.find(s => s.id === inv.shipment);
  const isPaid = inv.balance === 0;
  // Desglose estimado (mock): flete 62% · aduana+impuestos 26% · última milla 12%
  const lines = [
    ['Flete internacional', Math.round(inv.amount * 0.62)],
    ['Aduana e impuestos', Math.round(inv.amount * 0.26)],
    ['Última milla en Venezuela', inv.amount - Math.round(inv.amount * 0.62) - Math.round(inv.amount * 0.26)],
  ];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 'var(--s-4)' }}>
        <U.Badge tone={statusTone[inv.status]} size="md" dot>{inv.status}</U.Badge>
        {ship && <span style={{ font: '600 12px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>{ship.type} · {ship.cbm} CBM</span>}
      </div>

      {/* Desglose */}
      <div style={{ padding: '6px 16px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', marginBottom: 'var(--s-4)' }}>
        {lines.map(([k, v], i) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderTop: i > 0 ? '1px solid var(--border)' : 0 }}>
            <span style={{ font: '500 12.5px/1 var(--f-sans)', color: 'var(--ink-soft)' }}>{k}</span>
            <span style={{ font: '700 13px/1 var(--f-mono)', color: 'var(--ink)' }}>${v.toLocaleString()}</span>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderTop: '1px solid var(--border)' }}>
          <span style={{ font: '800 13px/1 var(--f-display)', color: 'var(--ink)' }}>Total</span>
          <span style={{ font: '900 18px/1 var(--f-display)', color: 'var(--ink)' }}>${inv.amount.toLocaleString()}</span>
        </div>
        {inv.paid > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 0 14px' }}>
            <span style={{ font: '600 12px/1 var(--f-sans)', color: 'var(--ink-mute)' }}>Pagado a la fecha</span>
            <span style={{ font: '700 12.5px/1 var(--f-mono)', color: 'var(--success)' }}>−${inv.paid.toLocaleString()}</span>
          </div>
        )}
      </div>

      {isPaid ? (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 14, background: 'var(--success-bg)', borderRadius: 'var(--r-lg)', marginBottom: 'var(--s-4)' }}>
            <span style={{ color: 'var(--success)' }}>{I.check(18)}</span>
            <span style={{ font: '700 13px/1.3 var(--f-sans)', color: 'var(--ink)' }}>Factura pagada · saldo $0</span>
          </div>
          <U.Btn variant="secondary" full icon={I.download(14)} onClick={onDone}>Descargar comprobante</U.Btn>
        </div>
      ) : sent ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 14, background: 'var(--info-bg, var(--bg-elevated))', border: '1px solid var(--info)', borderRadius: 'var(--r-lg)' }}>
          <span style={{ color: 'var(--info)' }}>{I.check(18)}</span>
          <span style={{ font: '700 13px/1.4 var(--f-sans)', color: 'var(--ink)' }}>Pago reportado. Tu agente valida y actualiza el saldo.</span>
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 16, background: 'var(--bg-elevated)', borderRadius: 'var(--r-lg)', marginBottom: 'var(--s-4)' }}>
            <span style={{ font: '700 13px/1 var(--f-sans)', color: 'var(--ink)' }}>A pagar ahora</span>
            <span style={{ font: '900 20px/1 var(--f-display)', color: 'var(--wine)' }}>${inv.balance.toLocaleString()}</span>
          </div>

          <div className="eyebrow eyebrow-wine" style={{ marginBottom: 10 }}>MÉTODO DE PAGO</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 'var(--s-4)' }}>
            {['Transferencia USD · Zelle / wire', 'Pago móvil VES · al cambio BCV'].map((m, i) => (
              <window.PM.ListRow key={i} icon={I.invoice(15)} iconTone="wine" title={m} onClick={() => {}} />
            ))}
          </div>

          {/* Comprobante */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, background: 'var(--bg-surface)', border: `1px dashed ${proof ? 'var(--success)' : 'var(--border-strong, var(--border))'}`, borderRadius: 'var(--r-lg)', cursor: 'pointer', marginBottom: 'var(--s-4)' }}>
            <span style={{ width: 38, height: 38, flexShrink: 0, borderRadius: 'var(--r-md)', background: 'var(--bg-elevated)', color: proof ? 'var(--success)' : 'var(--wine)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{proof ? I.check(18) : I.upload(18)}</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', font: '700 13px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{proof ? 'Comprobante adjunto' : 'Subir comprobante'}</span>
              <span style={{ display: 'block', font: '500 11.5px/1.3 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{proof || 'Captura de la transferencia o pago móvil'}</span>
            </span>
            <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={(e) => setProof(e.target.files[0] ? e.target.files[0].name : null)} />
          </label>

          <U.Btn variant="primary" full icon={I.check(14)} onClick={() => setSent(true)}>Reportar pago</U.Btn>
          <p style={{ font: '500 11px/1.5 var(--f-sans)', color: 'var(--ink-mute)', margin: '12px 0 0' }}>Tu agente confirma cada pago manualmente. El saldo se actualiza al validarse.</p>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// ESTIMADOR EXPRÉS · estimación DDP desde el teléfono
// ════════════════════════════════════════════════════════════════
function EstimadorScreen({ onBack, me }) {
  const D = window.ERPData;
  const U = window.ERPUI;
  const I = window.Icon;
  const SERVICES = [
    { k: 'LCL DDP', label: 'LCL · carga suelta', hint: 'Pagas por volumen (CBM)' },
    { k: "FCL 20'", label: "Contenedor 20'", hint: 'Hasta ~28 CBM', flat: 3800, days: 40 },
    { k: "FCL 40'HC", label: "Contenedor 40'HC", hint: 'Hasta ~68 CBM', flat: 6400, days: 42 },
  ];
  const [origin, setOrigin] = mUseState(D.ORIGINS[0].code);
  const [dest, setDest] = mUseState(D.DESTINATIONS[0].code);
  const [service, setService] = mUseState('LCL DDP');
  const [cbm, setCbm] = mUseState('6');
  const [sent, setSent] = mUseState(false);
  const [reqRef, setReqRef] = mUseState(null);

  const svc = SERVICES.find(s => s.k === service);
  const lclRate = (D.RATES || []).find(r => r.service === 'LCL DDP' && r.origin === origin && r.destination === dest)
    || (D.RATES || []).find(r => r.service === 'LCL DDP' && r.origin === origin)
    || { perCBM: 820, minCharge: 380, transit: 38 };

  let estimate = 0, transit = lclRate.transit, perInfo = '';
  if (service === 'LCL DDP') {
    const n = Math.max(0, parseFloat(cbm) || 0);
    estimate = Math.max(Math.round(n * lclRate.perCBM), lclRate.minCharge);
    perInfo = `$${lclRate.perCBM}/CBM · mínimo $${lclRate.minCharge}`;
  } else {
    estimate = svc.flat;
    transit = svc.days;
    perInfo = 'Tarifa plana puerta a puerta';
  }

  return (
    <div>
      <window.PM.SubHeader title="Crear estimado" subtitle="Estimación al instante · puerta a puerta" onBack={onBack} />
      <div style={{ padding: '16px 16px 24px' }}>
        <window.PM.Section title="RUTA">
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <U.Select label="Origen · China" value={origin} onChange={setOrigin} options={D.ORIGINS.map(o => ({ value: o.code, label: o.name }))} style={{ flex: 1 }} />
            <span style={{ paddingBottom: 12, color: 'var(--wine)' }}>{I.arrowR(16)}</span>
            <U.Select label="Destino · Venezuela" value={dest} onChange={setDest} options={D.DESTINATIONS.map(d => ({ value: d.code, label: d.name }))} style={{ flex: 1 }} />
          </div>
        </window.PM.Section>

        <window.PM.Section title="SERVICIO">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {SERVICES.map(s => (
              <button key={s.k} onClick={() => setService(s.k)} style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12, padding: 14, background: 'var(--bg-surface)', border: `1px solid ${service === s.k ? 'var(--wine)' : 'var(--border)'}`, borderRadius: 'var(--r-lg)', cursor: 'pointer' }}>
                <span style={{ width: 20, height: 20, flexShrink: 0, borderRadius: '50%', border: `2px solid ${service === s.k ? 'var(--wine)' : 'var(--border-strong, var(--border))'}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  {service === s.k && <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--wine)' }} />}
                </span>
                <span style={{ flex: 1 }}>
                  <span style={{ display: 'block', font: '700 13.5px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{s.label}</span>
                  <span style={{ display: 'block', font: '500 11.5px/1.3 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 2 }}>{s.hint}</span>
                </span>
              </button>
            ))}
          </div>
        </window.PM.Section>

        {service === 'LCL DDP' && (
          <window.PM.Section title="VOLUMEN">
            <U.Input label="Metros cúbicos (CBM)" type="number" value={cbm} onChange={setCbm} suffix="CBM" mono />
          </window.PM.Section>
        )}

        {/* Estimación */}
        <div style={{ padding: 20, borderRadius: 'var(--r-xl)', background: 'linear-gradient(135deg, var(--ink), #1F3055)', color: '#fff', marginBottom: 'var(--s-5)' }}>
          <div style={{ font: '700 10.5px/1 var(--f-sans)', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--wine-soft)' }}>ESTIMADO DDP</div>
          <div style={{ font: '900 36px/1 var(--f-display)', letterSpacing: '-0.025em', margin: '12px 0 6px' }}>${estimate.toLocaleString()}</div>
          <div style={{ font: '500 12px/1.4 var(--f-sans)', color: 'rgba(255,255,255,0.65)' }}>{perInfo}</div>
          <div style={{ display: 'flex', gap: 24, marginTop: 16 }}>
            <div><div style={{ font: '500 10px/1 var(--f-sans)', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Ruta</div><div style={{ font: '800 14px/1.1 var(--f-display)', marginTop: 5 }}>{D.origin(origin).name} → {D.dest(dest).name}</div></div>
            <div><div style={{ font: '500 10px/1 var(--f-sans)', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Tránsito</div><div style={{ font: '800 14px/1.1 var(--f-display)', marginTop: 5 }}>~{transit} días</div></div>
          </div>
        </div>

        {sent ? (
          <div style={{ padding: 16, background: 'var(--success-bg)', borderRadius: 'var(--r-lg)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ color: 'var(--success)' }}>{I.check(18)}</span>
              <span style={{ font: '700 13px/1.4 var(--f-sans)', color: 'var(--ink)' }}>Solicitud enviada</span>
            </div>
            <div style={{ font: '500 12px/1.5 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 8 }}>
              Tu agente prepara el estimado formal. La vas a ver en <b>Mis envíos</b> como <b>“Estimado en proceso”</b> y te avisamos cuando esté lista para aceptar.
            </div>
            <div style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-pill)' }}>
              <span style={{ font: '600 9.5px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Referencia</span>
              <code style={{ font: '700 12px/1 var(--f-mono)', color: 'var(--wine)' }}>{reqRef}</code>
            </div>
          </div>
        ) : (
          <U.Btn variant="primary" full icon={I.mail(14)} onClick={() => {
            // Publica la solicitud al bridge → el ERP la ve como lead/estimado entrante
            try {
              const route = `${D.origin(origin).name} → ${D.dest(dest).name}`;
              window.DTDData && window.DTDData.pushPortalEvent && window.DTDData.pushPortalEvent({
                kind: 'cotizacion', tone: 'info', markbox: me.markbox,
                title: 'Estimado solicitada · ' + (me.name || me.markbox),
                detail: `${service} · ${route} · estimado $${estimate.toLocaleString()}`,
                channel: 'portal-mobile',
                meta: { origin, dest, service, cbm: service === 'LCL DDP' ? cbm : null, estimate, transit },
              });
            } catch (e) { console.error('[estimador] pushPortalEvent falló:', e); }
            const _ref = 'SOL-2026-' + String(Math.floor(100 + Math.random() * 900));
            try {
              window.DTDData && window.DTDData.pushPortalQuote && window.DTDData.pushPortalQuote({
                markbox: me.markbox, clientName: me.name || me.markbox,
                origin, dest, service, cbm: service === 'LCL DDP' ? cbm : null, estimate, ref: _ref,
              });
            } catch (e) { console.error('[estimador] pushPortalQuote falló:', e); }
            setReqRef(_ref);
            setSent(true);
          }}>Solicitar estimado formal</U.Btn>
        )}
        <p style={{ font: '500 11px/1.5 var(--f-sans)', color: 'var(--ink-mute)', margin: '12px 0 0', textAlign: 'center' }}>Estimación referencial. El precio final lo confirma tu agente según la mercadería.</p>
      </div>
    </div>
  );
}

window.PMExtra = {
  PagarScreen, ProveedoresScreen, MasScreen,
  DocumentosScreen, ReferidosScreen, SoporteScreen, PerfilScreen,
  EstimadorScreen, NotifSheet,
};
