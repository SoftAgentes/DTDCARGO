/* global React */
/* ── DTD ERP · Cobranzas · v1.9.1 ───────────────────────────── */
/* Cola de CxC vencidas con seguimiento: contacto, promesa de    */
/* pago, recordatorios. Sobre el aging real de facturas.         */

function ModuleCobranzas({ goTo }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const R = window.ERPRates;
  const X = window.CobranzasData;
  const fmt = (n) => (R?.fmtUsd ? R.fmtUsd(n) : '$' + Math.round(n || 0).toLocaleString('en-US'));
  const hide = U.useHideValues();
  const loading = U.useFirstLoad('cobranzas');
  const fmtH = (n) => hide ? '•••' : fmt(n);

  const [, force] = React.useState(0);
  React.useEffect(() => {
    const f = () => force(x => x + 1);
    window.addEventListener('dtd-cobranzas-changed', f);
    return () => window.removeEventListener('dtd-cobranzas-changed', f);
  }, []);

  const [stageFilter, setStageFilter] = React.useState('all');
  const [selected, setSelected] = React.useState(null);

  const items = X.cobItems();
  const t = X.cobTotals();
  const rows = items.filter(i => stageFilter === 'all' ? true : stageFilter === 'open' ? i.stage !== 'pagado' : i.stage === stageFilter);

  return (
    <div>
      <U.PageHeader
        eyebrow="FINANZAS · CUENTAS POR COBRAR"
        title="Cobranzas"
        subtitle="Cola de cobranza sobre las facturas con saldo. Seguimiento, promesas de pago y recordatorios escalados."
        actions={<U.Btn variant="primary" icon={I.mail(14)}>Recordatorio masivo</U.Btn>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 'var(--s-5)' }}>
        <U.KPI label="Por cobrar" value={fmtH(t.porCobrar)} delta={`${t.casos} casos abiertos`} tone="wine" icon={I.invoice(18)} />
        <U.KPI label="Vencido" value={fmtH(t.vencido)} delta={t.vencido > 0 ? 'requiere gestión' : 'sin vencidos'} tone={t.vencido > 0 ? 'danger' : 'success'} icon={I.warn(18)} />
        <U.KPI label="En promesa de pago" value={fmtH(t.promesa)} delta="comprometido por el cliente" tone="info" icon={I.clock(18)} />
        <U.KPI label="Tasa de cobro" value={`${t.porCobrar ? Math.round((1 - t.vencido / t.porCobrar) * 100) : 100}%`} delta="al día sobre total" tone="success" icon={I.chart(18)} />
      </div>

      <U.Toolbar
        filters={
          <U.Select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)} options={[
            { value: 'all', label: 'Todas' },
            { value: 'open', label: 'Solo abiertas' },
            ...Object.entries(X.COB_STAGES).map(([k, v]) => ({ value: k, label: v.label })),
          ]} style={{ minWidth: 190 }} />
        }
      />

      {loading ? <U.LoadingRows rows={6} cols={6} /> : (
      <U.Card padded={false}>
        <div style={{
          display: 'grid', gridTemplateColumns: '130px 1fr 120px 120px 1fr 130px', gap: 14,
          padding: '10px 18px', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)',
          font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase',
        }}>
          <span>Factura</span>
          <span>Cliente</span>
          <span style={{ textAlign: 'right' }}>Saldo</span>
          <span>Vencimiento</span>
          <span>Última gestión</span>
          <span style={{ textAlign: 'right' }}>Estado</span>
        </div>
        {rows.map((it, i) => {
          const st = X.COB_STAGES[it.stage];
          const isSel = selected === it.id;
          return (
            <div key={it.id} onClick={() => setSelected(it.id)} style={{
              display: 'grid', gridTemplateColumns: '130px 1fr 120px 120px 1fr 130px', gap: 14, alignItems: 'center',
              padding: '12px 18px', cursor: 'pointer', borderTop: i > 0 ? '1px solid var(--border)' : 0,
              background: isSel ? 'var(--wine-tint)' : (it.days > 30 && it.stage !== 'pagado' ? 'var(--danger-bg)' : 'transparent'),
              transition: 'background var(--dur-fast) var(--ease)',
            }}
              onMouseEnter={(e) => { if (!isSel && !(it.days > 30 && it.stage !== 'pagado')) e.currentTarget.style.background = 'var(--bg-elevated)'; }}
              onMouseLeave={(e) => { if (!isSel && !(it.days > 30 && it.stage !== 'pagado')) e.currentTarget.style.background = 'transparent'; }}
            >
              <code style={{ font: '700 11.5px/1 var(--f-mono)', color: 'var(--ink)' }}>{it.id}</code>
              <div style={{ minWidth: 0 }}>
                <div style={{ font: '600 12.5px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{it.clientName}</div>
                <code style={{ font: '500 10.5px/1 var(--f-mono)', color: 'var(--ink-mute)' }}>{it.client}</code>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ font: '700 12.5px/1 var(--f-mono)', color: 'var(--ink)' }}>{hide ? '•••' : window.ERPRates.fmtUsd(it.balance)}</div>
                {it.status === 'parcial' && <div style={{ font: '500 9.5px/1 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 2 }}>parcial</div>}
              </div>
              <div>
                <div style={{ font: '500 11px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>{it.due.slice(5)}</div>
                <div style={{ font: '700 10px/1 var(--f-sans)', color: it.days > 0 ? 'var(--danger)' : 'var(--ink-mute)', marginTop: 3 }}>
                  {it.days > 0 ? `vencido ${it.days}d` : `en ${Math.abs(it.days)}d`}
                </div>
              </div>
              <div style={{ minWidth: 0 }}>
                {it.lastAction ? (
                  <>
                    <div style={{ font: '600 11.5px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{X.COB_ACTION[it.lastAction.type]?.label || it.lastAction.type}</div>
                    <div style={{ font: '500 10px/1.2 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.lastAction.at}</div>
                  </>
                ) : <span style={{ font: '500 11px/1 var(--f-sans)', color: 'var(--ink-mute)' }}>Sin gestión</span>}
              </div>
              <div style={{ textAlign: 'right' }}><U.Badge tone={st.tone} size="sm" dot>{st.label}</U.Badge></div>
            </div>
          );
        })}
        {rows.length === 0 && (
          <div style={{ padding: '40px', textAlign: 'center', font: '500 13px var(--f-sans)', color: 'var(--ink-mute)' }}>Sin casos en este estado.</div>
        )}
      </U.Card>
      )}

      <CobranzaDrawer item={selected ? items.find(i => i.id === selected) : null} onClose={() => setSelected(null)} goTo={goTo} />
    </div>
  );
}

function CobranzaDrawer({ item, onClose, goTo }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const R = window.ERPRates;
  const X = window.CobranzasData;
  const D = window.ERPData;
  const [promiseOpen, setPromiseOpen] = React.useState(false);
  const [promiseDate, setPromiseDate] = React.useState(X.COB_TODAY);
  const [cobroOpen, setCobroOpen] = React.useState(false);
  if (!item) return null;
  const st = X.COB_STAGES[item.stage];
  const client = (D?.CLIENTS || []).find(c => c.markbox === item.client);

  const act = (type, text, extra) => { X.cobAddAction(item.id, type, text, extra); };

  return (
    <U.Drawer
      open={!!item}
      onClose={onClose}
      title={item.id}
      subtitle={`${item.clientName} · saldo ${R.fmtUsd(item.balance)}`}
      width={640}
      actions={<>
        <U.Btn variant="ghost" onClick={onClose}>Cerrar</U.Btn>
        {item.balance > 0 && <U.Btn variant="primary" icon={I.invoice(13)} onClick={() => setCobroOpen(true)}>Registrar cobro</U.Btn>}
      </>}
    >
      {/* Estado */}
      <div style={{ padding: '14px 16px', marginBottom: 18, borderRadius: 'var(--r-md)', background: `var(--${st.tone}-bg)`, borderLeft: `4px solid var(--${st.tone})`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
        <div>
          <U.Badge tone={st.tone} dot>{st.label}</U.Badge>
          <div style={{ font: '600 12px/1.4 var(--f-sans)', color: item.days > 0 ? 'var(--danger)' : 'var(--ink-soft)', marginTop: 8 }}>
            {item.days > 0 ? `Vencida hace ${item.days} días` : `Vence en ${Math.abs(item.days)} días`}
            {item.promiseDate && <span style={{ color: 'var(--info)' }}> · promesa de pago {item.promiseDate}</span>}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ font: '700 10px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Saldo a cobrar</div>
          <div style={{ font: '900 24px/1 var(--f-display)', color: 'var(--ink)' }}>{R.fmtUsd(item.balance)}</div>
        </div>
      </div>

      {/* Acciones de gestión */}
      <div className="eyebrow eyebrow-wine" style={{ marginBottom: 10 }}>GESTIÓN DE COBRANZA</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 8 }}>
        <U.Btn variant="secondary" size="sm" icon={I.chat(13)} onClick={() => act('contacto', 'Llamada/WhatsApp al cliente')}>Registrar contacto</U.Btn>
        <U.Btn variant="secondary" size="sm" icon={I.clock(13)} onClick={() => setPromiseOpen(o => !o)}>Promesa de pago</U.Btn>
        <U.Btn variant="secondary" size="sm" icon={I.mail(13)} onClick={() => act('recordatorio', 'Recordatorio enviado por email/WhatsApp')}>Enviar recordatorio</U.Btn>
        <U.Btn variant="soft" size="sm" icon={I.check(13)} onClick={() => setCobroOpen(true)}>Registrar cobro</U.Btn>
      </div>
      {promiseOpen && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 8, padding: '12px 14px', background: 'var(--info-bg)', borderRadius: 'var(--r-md)' }}>
          <U.Input label="Fecha comprometida" value={promiseDate} onChange={(e) => setPromiseDate(e.target.value)} mono style={{ flex: 1 }} />
          <U.Btn variant="primary" size="sm" onClick={() => { act('promesa', `Cliente promete pagar el ${promiseDate}`, { date: promiseDate }); setPromiseOpen(false); }}>Confirmar promesa</U.Btn>
        </div>
      )}

      {/* Datos */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, margin: '18px 0' }}>
        <U.Field label="Factura" value={item.id} mono />
        <U.Field label="Emitida / vence" value={`${item.issued} → ${item.due}`} mono />
        <U.Field label="Monto / pagado" value={`${R.fmtUsd(item.amount)} / ${R.fmtUsd(item.paid || 0)}`} mono />
        <U.Field label="Embarque" value={item.shipment} mono />
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        <U.Btn variant="ghost" size="sm" iconRight={I.arrowR(12)} onClick={() => goTo('invoices', item.id)}>Ver factura</U.Btn>
        <U.Btn variant="ghost" size="sm" iconRight={I.arrowR(12)} onClick={() => goTo('clients', item.client)}>Ver cliente</U.Btn>
        {client?.phone && <U.Btn variant="ghost" size="sm" icon={I.globe ? I.globe(12) : null}>WhatsApp</U.Btn>}
      </div>

      {/* Bitácora */}
      <div className="eyebrow eyebrow-wine" style={{ marginBottom: 10 }}>BITÁCORA DE GESTIÓN · {item.log.length}</div>
      {item.log.length === 0 ? (
        <div style={{ padding: '16px', textAlign: 'center', border: '1px dashed var(--border-strong)', borderRadius: 'var(--r-md)', font: '500 12px/1.5 var(--f-sans)', color: 'var(--ink-mute)' }}>
          Sin gestiones registradas. Usa los botones de arriba para registrar el seguimiento.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {[...item.log].reverse().map((l, i) => {
            const meta = X.COB_ACTION[l.type] || { label: l.type, icon: 'edit' };
            return (
              <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 0', borderTop: i > 0 ? '1px solid var(--border)' : 0 }}>
                <span style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--wine-tint)', color: 'var(--wine)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{I[meta.icon] ? I[meta.icon](13) : I.edit(13)}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ font: '600 12.5px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{meta.label}</div>
                  <div style={{ font: '500 11px/1.3 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 2 }}>{l.text}</div>
                </div>
                <span style={{ font: '500 10px/1 var(--f-mono)', color: 'var(--ink-mute)', flexShrink: 0 }}>{l.at}</span>
              </div>
            );
          })}
        </div>
      )}

      <CobroModal open={cobroOpen} onClose={() => setCobroOpen(false)} item={item} />
    </U.Drawer>
  );
}

// ── Registrar cobro → entra a una caja de Tesorería ──────────
function CobroModal({ open, onClose, item }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const R = window.ERPRates;
  const X = window.CobranzasData;
  const T = window.TesoreriaData;
  const money = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('en-US');

  // Cuentas donde se puede cobrar (las de cobro: USD/VES/USDT — se excluye CNY puente a China)
  const accounts = (T?.CASH_ACCOUNTS || []).filter(a => a.currency !== 'CNY');
  const METODOS = ['Wire · USD', 'Zelle', 'USDT · TRC20', 'Pago Móvil', 'Transferencia · VES', 'Efectivo · USD'];

  const [accId, setAccId] = React.useState(accounts[0]?.id);
  const [metodo, setMetodo] = React.useState(METODOS[0]);
  const [montoUsd, setMontoUsd] = React.useState(item ? item.balance : 0);
  const [rate, setRate] = React.useState(1);
  const [proof, setProof] = React.useState(null);
  const [done, setDone] = React.useState(false);

  const acct = accounts.find(a => a.id === accId) || accounts[0];
  const esUsd = !acct || acct.currency === 'USD' || acct.currency === 'USDT';
  const rateFor = (cur) => {
    const r = (R?.read?.() || {});
    if (cur === 'VES') return r.bcv || 36.45;
    if (cur === 'CNY') return r.cny || 7.18;
    return 1;
  };

  React.useEffect(() => { if (open && item) { setMontoUsd(item.balance); setAccId(accounts[0]?.id); setMetodo(METODOS[0]); setProof(null); setDone(false); } }, [open, item && item.id]);
  React.useEffect(() => { setRate(rateFor(acct ? acct.currency : 'USD')); }, [accId]);

  if (!item) return null;
  const montoCur = Number(montoUsd || 0) * Number(rate || 1);
  const parcial = Number(montoUsd) < item.balance;
  const fmtCur = (n) => (acct ? (acct.currency === 'VES' ? 'Bs ' : acct.currency === 'USDT' ? '₮' : '$') : '$') + Math.round(n).toLocaleString('en-US');
  const inputBox = { width: '100%', padding: '10px 12px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--ink)', font: '700 15px/1 var(--f-mono)', boxSizing: 'border-box' };

  const confirm = () => {
    X.cobRegisterPayment(item.id, {
      amountUsd: Number(montoUsd), accountId: accId, method: metodo,
      currency: acct.currency, amountOriginal: montoCur, rate: Number(rate),
      ref: proof, clientName: item.clientName,
    });
    setDone(true);
  };

  return (
    <U.Modal open={open} onClose={onClose} width={480} title={done ? 'Cobro registrado' : 'Registrar cobro'}
      actions={done
        ? <U.Btn variant="primary" onClick={onClose}>Listo</U.Btn>
        : <>
            <U.Btn variant="ghost" onClick={onClose}>Cancelar</U.Btn>
            <U.Btn variant="primary" icon={I.check(14)} disabled={!proof} onClick={() => proof && confirm()}>Confirmar ingreso</U.Btn>
          </>
      }>
      {done ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ padding: 16, background: 'var(--success-bg)', border: '1px solid var(--success)', borderRadius: 'var(--r-md)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <span style={{ color: 'var(--success)' }}>{I.check(18)}</span>
            <div style={{ font: '500 12.5px/1.55 var(--f-sans)', color: 'var(--ink)' }}>
              Ingreso de <b>{fmtCur(montoCur)}</b>{!esUsd ? ` (= ${money(montoUsd)} · tasa ${rate})` : ''} en <b>{acct.name}</b> ({metodo}). La factura <code style={{ font: '700 11px/1 var(--f-mono)', color: 'var(--wine)' }}>{item.id}</code> {parcial ? `bajó su saldo a ${money(item.balance - Number(montoUsd))}` : 'quedó saldada'} · la posición de caja se actualizó.
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ padding: '10px 14px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <code style={{ font: '800 12.5px/1 var(--f-mono)', color: 'var(--ink)' }}>{item.id}</code>
              <div style={{ font: '500 11px/1 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 3 }}>{item.clientName}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ font: '700 8px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Saldo (en US$)</div>
              <div style={{ font: '800 15px/1 var(--f-mono)', color: 'var(--wine)' }}>{money(item.balance)}</div>
            </div>
          </div>

          <U.Select label="Cuenta de caja" value={accId} onChange={(e) => setAccId(e.target.value)} options={accounts.map(a => ({ value: a.id, label: a.name }))} />
          <U.Select label="Método de pago" value={metodo} onChange={(e) => setMetodo(e.target.value)} options={METODOS} />

          {!esUsd && (
            <div style={{ padding: '10px 12px', background: 'var(--wine-tint)', borderRadius: 'var(--r-md)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ font: '700 10px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Tasa del día · {acct.currency}/USD</span>
                  <span style={{ font: '700 8.5px/1 var(--f-sans)', color: '#fff', background: 'var(--success)', padding: '2px 5px', borderRadius: 'var(--r-pill)' }}>AUTO · BCV</span>
                </div>
                <div style={{ font: '500 10.5px/1.3 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 4 }}>Detectada automática · editable si la negociaste distinto.</div>
              </div>
              <window.ERPUI.CalcInput value={rate} onChange={(e) => setRate(e.target.value)} style={{ width: 96, padding: '8px 10px', borderRadius: 'var(--r-sm)', border: '1px solid var(--wine)', background: 'var(--bg-surface)', color: 'var(--ink)', font: '700 14px/1 var(--f-mono)', boxSizing: 'border-box' }} />
            </div>
          )}

          <div>
            <div style={{ font: '700 10px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
              {esUsd ? 'Monto a cobrar (US$)' : `Monto que entra a caja (${acct.currency})`}
            </div>
            {esUsd ? (
              <window.ERPUI.CalcInput value={montoUsd} onChange={(e) => setMontoUsd(e.target.value)} style={inputBox} />
            ) : (
              <React.Fragment>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <div style={{ font: '600 9px/1 var(--f-sans)', color: 'var(--ink-mute)', marginBottom: 4 }}>En {acct.currency}</div>
                    <window.ERPUI.CalcInput value={Math.round(montoCur)} onChange={(e) => setMontoUsd(Number(e.target.value) / Number(rate || 1))} style={inputBox} />
                  </div>
                  <div>
                    <div style={{ font: '600 9px/1 var(--f-sans)', color: 'var(--wine)', marginBottom: 4 }}>En US$ · se aplica a la factura</div>
                    <window.ERPUI.CalcInput value={Math.round(Number(montoUsd))} onChange={(e) => setMontoUsd(e.target.value)} style={{ ...inputBox, borderColor: 'var(--wine)', color: 'var(--wine)' }} />
                  </div>
                </div>
                <div style={{ font: '500 11.5px/1.5 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 8 }}>
                  Entran <b>{fmtCur(montoCur)}</b> a la caja · equivalen a <b style={{ color: 'var(--wine)' }}>{money(montoUsd)}</b> (la factura siempre se salda en dólares).
                </div>
              </React.Fragment>
            )}
            <div style={{ font: '500 11px/1.4 var(--f-sans)', color: parcial ? 'var(--warning)' : 'var(--ink-mute)', marginTop: 6 }}>
              {parcial ? `Abono parcial · quedan ${money(item.balance - Number(montoUsd))} pendientes.` : 'Cobro total · salda la factura.'}
            </div>
          </div>

          <div>
            <div style={{ font: '700 10px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Comprobante de pago</div>
            {proof ? (
              <div style={{ padding: 12, background: 'var(--success-bg)', border: '1px solid var(--success)', borderRadius: 'var(--r-md)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ color: 'var(--success)' }}>{I.check(16)}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ font: '700 12px/1.2 var(--f-sans)', color: 'var(--success)' }}>Comprobante adjunto</div>
                  <code style={{ font: '500 10.5px/1.3 var(--f-mono)', color: 'var(--ink-soft)' }}>comprobante-pago.jpg</code>
                </div>
                <button onClick={() => setProof(null)} style={{ font: '600 11px/1 var(--f-sans)', color: 'var(--ink-soft)', padding: '4px 8px', cursor: 'pointer' }}>Quitar</button>
              </div>
            ) : (
              <button onClick={() => setProof('comprobante-' + Date.now())} style={{
                padding: '16px 14px', width: '100%', background: 'var(--bg-elevated)', border: '1px dashed var(--border)',
                borderRadius: 'var(--r-md)', color: 'var(--ink-soft)', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, font: '600 12px/1.4 var(--f-sans)', textAlign: 'center',
              }}>
                {I.upload(18)}
                <span style={{ font: '700 12px/1.2 var(--f-sans)' }}>Adjuntar prueba del pago</span>
                <span style={{ font: '500 10.5px/1.4 var(--f-sans)', color: 'var(--ink-mute)' }}>Transferencia, captura o recibo · JPG/PDF</span>
              </button>
            )}
            {!proof && <div style={{ font: '500 11px/1.4 var(--f-sans)', color: 'var(--warning)', marginTop: 6 }}>El comprobante es obligatorio para registrar el ingreso.</div>}
          </div>
        </div>
      )}
    </U.Modal>
  );
}

window.ModuleCobranzas = ModuleCobranzas;
