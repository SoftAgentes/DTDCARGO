/* global React */
/* ── Propuesta visual · Órdenes · Caja · Proveedores ─────────── */
/* NO integrada al ERP. Mockup de revisión con el sistema real    */
/* (tokens + ERPUI + Icon + ERPData). Tres piezas:                */
/*   A · Almacén CN → pestaña "Esperadas / en camino" (Órdenes)   */
/*   B · Cobranzas → cobro que entra a una cuenta de caja         */
/*   C · Proveedores de clientes · CN (renombrado + grupo WeChat) */
/* ───────────────────────────────────────────────────────────── */

(function () {
  const { useState } = React;
  const U = window.ERPUI;
  const I = window.Icon;
  const D = window.ERPData;

  const money = (n, sym = '$') => sym + Math.round(n).toLocaleString('en-US');

  // ── Mock: Órdenes (mercancía en camino, registrada por el cliente) ──
  // Código = MARKBOX-proveedor-compra · ese código es el grupo WeChat.
  const ORDERS = [
  { code: 'DTD-5452-1-1', client: 'DTD-5452', clientName: 'Acindar Comercial', supplier: 'Yiwu Standard Trading', boxes: 12, cbm: 6.4, weight: 980, packing: true, invoice: true, status: 'por verificar', eta: '2026-06-04', goods: 'Cables eléctricos + conectores' },
  { code: 'DTD-5392-3-2', client: 'DTD-5392', clientName: 'Industrias Polar', supplier: 'Industrial CN Group', boxes: 42, cbm: 28.4, weight: 12400, packing: true, invoice: true, status: 'por verificar', eta: '2026-06-02', goods: 'Heladeras vitrina 600L' },
  { code: 'DTD-5418-2-1', client: 'DTD-5418', clientName: 'Imp. Pereira', supplier: 'Shenzhen Lights Ltd', boxes: 8, cbm: 4.2, weight: 620, packing: true, invoice: false, status: 'en camino', eta: '2026-06-10', goods: 'Lámparas LED 30/50W' },
  { code: 'DTD-5340-1-3', client: 'DTD-5340', clientName: 'Dist. Andina', supplier: 'Yiwu Trade Mall', boxes: 14, cbm: 5.4, weight: 2100, packing: false, invoice: true, status: 'en camino', eta: '2026-06-18', goods: 'Bolsos cuero sintético' },
  { code: 'DTD-5277-1-1', client: 'DTD-5277', clientName: 'BriceñoTex', supplier: 'Guangzhou Textile Mfg', boxes: 22, cbm: 6.2, weight: 2400, packing: true, invoice: true, status: 'verificada', eta: '2026-06-06', goods: 'Tela algodón crudo · 22 rollos' }];

  const orderTone = (s) => s === 'verificada' ? 'success' : s === 'por verificar' ? 'warning' : 'info';

  // ── Mock: cuentas de caja (viven en Tesorería) ──
  const CAJAS = [
  { id: 'usd', name: 'Caja USD · Wire / Zelle', cur: 'USD', sym: '$', balance: 184200 },
  { id: 'usdt', name: 'Caja USDT · Binance', cur: 'USDT', sym: '₮', balance: 42800 },
  { id: 'ves', name: 'Caja VES · Transferencias', cur: 'VES', sym: 'Bs ', balance: 6820000 }];

  const METODOS = ['Wire USD', 'Zelle', 'USDT (TRC20)', 'Efectivo USD', 'Transferencia VES'];
  // Tasa del día · unidades de la moneda por 1 USD (autodetectada, editable)
  const RATES = { USD: 1, USDT: 1, VES: 36.45 };
  // Columnas configurables de la tabla de órdenes (reordenar / ocultar)
  const ORDER_COLS_DEFAULT = [
  { key: 'code', visible: true }, { key: 'clientName', visible: true },
  { key: 'supplier', visible: true }, { key: 'boxes', visible: true },
  { key: 'packing', visible: true }, { key: 'status', visible: true }];

  // ════════════════════════════════════════════════════════════
  //  Layout helpers
  // ════════════════════════════════════════════════════════════
  function SectionFrame({ tag, title, intent, children, notes }) {
    return (
      <section style={{ marginBottom: 'var(--s-16)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
          <span style={{
            font: '900 12px/1 var(--f-mono)', color: '#fff', background: 'var(--wine)',
            padding: '5px 9px', borderRadius: 'var(--r-sm)', letterSpacing: '0.04em', flexShrink: 0
          }}>{tag}</span>
          <h2 style={{ font: '900 26px/1.15 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em', margin: 0, flex: 1, minWidth: 0 }}>{title}</h2>
        </div>
        <p style={{ font: '500 14px/1.55 var(--f-sans)', color: 'var(--ink-soft)', margin: '0 0 20px', maxWidth: 720 }}>{intent}</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.9fr) minmax(280px, 1fr)', gap: 22, alignItems: 'start' }}>
          <div>{children}</div>
          <aside style={{ position: 'sticky', top: 20 }}>{notes}</aside>
        </div>
      </section>);

  }

  // Marco que simula el área de contenido de un módulo del ERP
  function ScreenChrome({ module, children }) {
    return (
      <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', overflow: 'hidden', boxShadow: 'var(--shadow-md)', background: 'var(--bg-surface)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 18px', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
          <span style={{ display: 'inline-flex', gap: 5 }}>
            {['#E06C66', '#E8B84B', '#4FA86A'].map((c) => <span key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c, opacity: 0.85 }} />)}
          </span>
          <span style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.14em', textTransform: 'uppercase', marginLeft: 6 }}>Módulo</span>
          <span style={{ font: '900 13px/1 var(--f-display)', color: 'var(--ink)' }}>{module}</span>
        </div>
        <div style={{ padding: 'var(--s-6)', background: 'var(--bg-base)' }}>{children}</div>
      </div>);

  }

  function NotesCard({ title, children, tone = 'wine' }) {
    return (
      <U.Card padded>
        <div className={`eyebrow eyebrow-${tone === 'wine' ? 'wine' : 'wine'}`} style={{ marginBottom: 12 }}>{title}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>{children}</div>
      </U.Card>);

  }
  function Bullet({ children }) {
    return (
      <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--wine)', marginTop: 7, flexShrink: 0 }} />
        <div style={{ font: '500 12.5px/1.55 var(--f-sans)', color: 'var(--ink)' }}>{children}</div>
      </div>);

  }

  // ════════════════════════════════════════════════════════════
  //  A · ALMACÉN CN → pestaña Esperadas / en camino (Órdenes)
  // ════════════════════════════════════════════════════════════
  function SectionOrdenes() {
    const [tab, setTab] = useState('camino');
    const [verify, setVerify] = useState(null);
    const [colCfg, setColCfg] = U.useColumns('dtd-prop-orders-cols-v1', ORDER_COLS_DEFAULT);

    const docChip = (ok, label) =>
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 7px', borderRadius: 'var(--r-pill)',
      font: '700 10px/1 var(--f-sans)', whiteSpace: 'nowrap',
      background: ok ? 'var(--success-bg)' : 'var(--bg-elevated)',
      color: ok ? 'var(--success)' : 'var(--ink-mute)'
    }}>{ok ? I.check(10) : I.warn(10)} {label}</span>;


    const columns = [
    { label: 'Código · grupo WeChat', key: 'code', render: (r) =>
      <div>
          <code style={{ font: '800 12.5px/1 var(--f-mono)', color: 'var(--wine)' }}>{r.code}</code>
          <div style={{ font: '500 10.5px/1.3 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 3 }}>{I.chat ? null : null}{r.goods}</div>
        </div>,
      width: 200 },
    { label: 'Cliente', key: 'clientName', render: (r) =>
      <div>
          <div style={{ font: '600 12.5px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{r.clientName}</div>
          <code style={{ font: '500 10.5px/1 var(--f-mono)', color: 'var(--ink-mute)' }}>{r.client}</code>
        </div>,
      width: 150 },
    { label: 'Proveedor CN', key: 'supplier', render: (r) => <span style={{ font: '500 12px/1.3 var(--f-sans)', color: 'var(--ink-soft)' }}>{r.supplier}</span>, width: 150 },
    { label: 'Declarado', key: 'boxes', align: 'right', render: (r) =>
      <div style={{ font: '600 11.5px/1.4 var(--f-mono)', color: 'var(--ink)', textAlign: 'right' }}>
          {r.boxes} cajas<br /><span style={{ color: 'var(--ink-soft)' }}>{r.cbm} CBM · {r.weight}kg</span>
        </div>,
      width: 110 },
    { label: 'Documentos', key: 'packing', render: (r) =>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>{docChip(r.packing, 'Packing')}{docChip(r.invoice, 'Factura')}</div>,
      width: 150 },
    { label: 'Estado', key: 'status', render: (r) => <U.Badge tone={orderTone(r.status)} size="sm">{r.status}</U.Badge>, width: 120 }];
    const actionCol = { label: '', key: '_a', render: (r) => r.status === 'verificada' ?
      <span style={{ font: '600 11px/1 var(--f-sans)', color: 'var(--success)' }}>en recepción ✓</span> :
      <U.Btn variant="soft" size="sm" onClick={() => setVerify(r)}>Verificar</U.Btn>, width: 100 };
    const visibleCols = [...U.applyColumns(columns, colCfg), actionCol];


    const enCamino = ORDERS.filter((o) => o.status !== 'verificada');
    const porVerificar = ORDERS.filter((o) => o.status === 'por verificar').length;

    return (
      <SectionFrame
        tag="A"
        title="Almacén CN · Esperadas / en camino"
        intent="Las órdenes que el cliente registra al comprar en China entran como “esperadas”. Traen proveedor, packing list y documentos que declaran cajas, CBM y peso — antes de tocar la bodega. El almacén solo verifica y avanza."
        notes={
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <NotesCard title="CÓMO FUNCIONA">
              <Bullet><b>El cliente</b> crea la orden (proveedor + packing list + factura) al comprar. Llega sola.</Bullet>
              <Bullet>El código <code style={{ font: '700 11px/1 var(--f-mono)', color: 'var(--wine)' }}>DTD-5452-1-1</code> <b>es</b> el nombre del grupo WeChat — se genera automático.</Bullet>
              <Bullet><b>El almacén no carga datos</b>: rectifica la sumatoria de cajas, CBM y peso, y que los docs estén atados al grupo.</Bullet>
              <Bullet>Al confirmar, la orden pasa a <b>recepción</b> (la lista actual de “Recibidas”).</Bullet>
            </NotesCard>
            <NotesCard title="CODIFICACIÓN · DTD-5452-1-1">
              <CodeBreakdown />
            </NotesCard>
          </div>
        }>
        
        <ScreenChrome module="Almacén CN · 中国仓库">
          <U.PageHeader
            title="Almacén CN"
            subtitle="Recepción y consolidación. Lo que viene en camino entra como orden esperada."
            actions={<U.Btn variant="secondary" icon={I.download(14)}>Exportar</U.Btn>} />
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 'var(--s-5)' }}>
            <U.KPI label="En camino" value={enCamino.length} delta="esperadas" tone="info" icon={I.ship ? I.ship(18) : I.box(18)} />
            <U.KPI label="Por verificar" value={porVerificar} delta="llegaron a bodega" tone="warning" icon={I.clock(18)} />
            <U.KPI label="CBM esperado" value={ORDERS.reduce((a, o) => a + o.cbm, 0).toFixed(1)} sub="declarado por clientes" tone="neutral" icon={I.box(18)} />
            <U.KPI label="Recepciones del mes" value={D.WAREHOUSE_CN.length} delta="+8 esta sem" tone="wine" icon={I.warehouse(18)} />
          </div>
          <U.Tabs value={tab} onChange={setTab} items={[
          { value: 'recibidas', label: 'Recibidas', count: D.WAREHOUSE_CN.length },
          { value: 'camino', label: 'Esperadas · en camino', count: enCamino.length }]
          } style={{ marginBottom: 'var(--s-5)' }} />
          {tab === 'camino' ?
          <React.Fragment>
            <U.Toolbar filters={<U.ColumnManager cfg={colCfg} setCfg={setColCfg} columns={columns} defaultCfg={ORDER_COLS_DEFAULT} />} />
            <U.Table columns={visibleCols} rows={ORDERS} onRowClick={(r) => r.status !== 'verificada' && setVerify(r)} />
          </React.Fragment> :

          <div style={{ padding: '46px 20px', textAlign: 'center', font: '500 13px/1.6 var(--f-sans)', color: 'var(--ink-mute)' }}>
              ← Pestaña actual del módulo (recepciones ya en bodega).<br />La novedad de esta propuesta es la pestaña <b style={{ color: 'var(--wine)' }}>Esperadas · en camino</b>.
            </div>
          }
        </ScreenChrome>
        <VerifyDrawer order={verify} onClose={() => setVerify(null)} />
      </SectionFrame>);

  }

  function CodeBreakdown() {
    const parts = [
    { v: 'DTD', l: 'Aliado / nosotros' },
    { v: '5452', l: 'Nº de cliente (MARKBOX)' },
    { v: '1', l: 'Proveedor de la compra' },
    { v: '2', l: '2ª compra a ese proveedor' }];

    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', marginBottom: 12 }}>
          {parts.map((p, i) =>
          <React.Fragment key={i}>
              <span style={{ font: '800 15px/1 var(--f-mono)', color: i < 2 ? 'var(--ink)' : 'var(--wine)' }}>{p.v}</span>
              {i < parts.length - 1 && <span style={{ font: '800 15px/1 var(--f-mono)', color: 'var(--ink-mute)' }}>-</span>}
            </React.Fragment>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {parts.map((p, i) =>
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '42px 1fr', gap: 8, alignItems: 'start' }}>
              <code style={{ font: '700 11px/1.3 var(--f-mono)', color: i < 2 ? 'var(--ink)' : 'var(--wine)' }}>{p.v}</code>
              <span style={{ font: '500 11.5px/1.35 var(--f-sans)', color: 'var(--ink-soft)' }}>{p.l}</span>
            </div>
          )}
        </div>
      </div>);

  }

  function VerifyDrawer({ order, onClose }) {
    const [boxes, setBoxes] = useState('');
    const [cbm, setCbm] = useState('');
    const [weight, setWeight] = useState('');
    const [done, setDone] = useState(false);
    React.useEffect(() => {
      if (order) {setBoxes(order.boxes);setCbm(order.cbm);setWeight(order.weight);setDone(false);}
    }, [order]);
    if (!order) return null;

    const Row = ({ label, declared, value, set, unit }) => {
      const diff = Number(value) !== Number(declared);
      return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 96px 96px', gap: 12, alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
          <span style={{ font: '600 12.5px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{label}</span>
          <div>
            <div style={{ font: '700 8.5px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Declarado</div>
            <code style={{ font: '700 13px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>{declared}{unit}</code>
          </div>
          <div>
            <div style={{ font: '700 8.5px/1 var(--f-sans)', color: diff ? 'var(--warning)' : 'var(--ink-mute)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Rectificado</div>
            <input value={value} onChange={(e) => set(e.target.value)} style={{
              width: '100%', padding: '6px 8px', borderRadius: 'var(--r-sm)',
              border: '1px solid ' + (diff ? 'var(--warning)' : 'var(--border)'),
              background: 'var(--bg-surface)', color: 'var(--ink)', font: '700 13px/1 var(--f-mono)'
            }} />
          </div>
        </div>);

    };

    return (
      <U.Drawer open={!!order} onClose={onClose} width={520}
      title={done ? 'Orden verificada' : 'Verificar orden'}
      subtitle={order.code + ' · ' + order.supplier}
      actions={done ?
      <U.Btn variant="primary" onClick={onClose}>Listo</U.Btn> :

      <>
            <U.Btn variant="ghost" onClick={onClose}>Cancelar</U.Btn>
            <U.Btn variant="primary" icon={I.check(14)} onClick={() => setDone(true)}>Confirmar y pasar a recepción</U.Btn>
          </>
      }>
        
        {done ?
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, animation: 'erp-fade 240ms' }}>
            <div style={{ padding: 16, background: 'var(--success-bg)', border: '1px solid var(--success)', borderRadius: 'var(--r-md)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span style={{ color: 'var(--success)' }}>{I.check(18)}</span>
              <div style={{ font: '500 12.5px/1.55 var(--f-sans)', color: 'var(--ink)' }}>
                <b>{order.code}</b> pasó a la lista de <b>Recibidas</b>. Sumatorias confirmadas: {boxes} cajas · {cbm} CBM · {weight} kg. El seguimiento del cliente avanza solo.
              </div>
            </div>
          </div> :

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ padding: '12px 14px', background: 'var(--wine-tint)', borderRadius: 'var(--r-md)', font: '500 12px/1.55 var(--f-sans)', color: 'var(--ink)' }}>
              Lo declaró el cliente al comprar. <b>Rectificá</b> contra lo que llegó físicamente; si difiere, el campo se marca.
            </div>
            <div className="eyebrow eyebrow-wine">SUMATORIAS</div>
            <div>
              <Row label="Cantidad de cajas" declared={order.boxes} value={boxes} set={setBoxes} unit="" />
              <Row label="Volumen (CBM)" declared={order.cbm} value={cbm} set={setCbm} unit="" />
              <Row label="Peso (kg)" declared={order.weight} value={weight} set={setWeight} unit="" />
            </div>
            <div className="eyebrow eyebrow-wine" style={{ marginTop: 4 }}>DOCUMENTOS ATADOS AL GRUPO</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <DocCheck ok={order.packing} label="Packing list" sub="Detalle por caja" />
              <DocCheck ok={order.invoice} label="Factura comercial" sub="Valor de la mercancía" />
            </div>
          </div>
        }
      </U.Drawer>);

  }
  function DocCheck({ ok, label, sub }) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: ok ? 'var(--success-bg)' : 'var(--bg-elevated)' }}>
        <span style={{ color: ok ? 'var(--success)' : 'var(--ink-mute)' }}>{ok ? I.check(16) : I.upload(16)}</span>
        <div style={{ flex: 1 }}>
          <div style={{ font: '700 12.5px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{label}</div>
          <div style={{ font: '500 10.5px/1.3 var(--f-sans)', color: 'var(--ink-mute)' }}>{sub}</div>
        </div>
        <span style={{ font: '600 11px/1 var(--f-sans)', color: ok ? 'var(--success)' : 'var(--warning)' }}>{ok ? 'Adjunto' : 'Falta'}</span>
      </div>);

  }

  // ════════════════════════════════════════════════════════════
  //  B · COBRANZAS → cobro que entra a una caja
  // ════════════════════════════════════════════════════════════
  function SectionCaja() {
    const [open, setOpen] = useState(false);
    const [cajas, setCajas] = useState(CAJAS);
    const [lastMove, setLastMove] = useState(null);
    const inv = D.INVOICES.find((i) => i.id === 'F-2026-0418') || D.INVOICES[0];

    const registrar = ({ cajaId, metodo, montoUsd, montoCur, rate, proof }) => {
      setCajas((cs) => cs.map((c) => c.id === cajaId ? { ...c, balance: c.balance + Number(montoCur) } : c));
      const caja = CAJAS.find((c) => c.id === cajaId);
      setLastMove({ caja, metodo, montoUsd: Number(montoUsd), montoCur: Number(montoCur), rate: Number(rate), proof, inv: inv.id, client: inv.clientName });
      setOpen(false);
    };

    return (
      <SectionFrame
        tag="B"
        title="Cobranzas → Caja"
        intent="Cuando se cobra una factura, el dinero entra a una caja real. Se elige la cuenta (USD / USDT / VES) y el método; si la caja es en otra moneda aparece la tasa del día (autodetectada y editable) y el equivalente siempre se muestra en dólares. Se adjunta el comprobante y la factura baja su saldo."
        notes={
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <NotesCard title="CÓMO FUNCIONA">
              <Bullet>El cobro <b>siempre</b> aterriza en una cuenta de caja concreta — no queda en el aire.</Bullet>
              <Bullet>Elegís <b>cuenta + método</b>; podés cobrar parcial (abono) y el resto queda pendiente.</Bullet>
              <Bullet>Si la caja es en otra moneda, traés la <b>tasa del día</b> (auto, editable) y el equivalente <b>siempre se muestra en US$</b> — la factura se salda en dólares.</Bullet>
              <Bullet>Se adjunta el <b>comprobante</b> del pago (la prueba) antes de confirmar.</Bullet>
              <Bullet>Un mismo cobro: <b>baja</b> el saldo de la factura y <b>genera un ingreso</b> en Tesorería.</Bullet>
              <Bullet>La posición de caja por moneda se actualiza al instante.</Bullet>
            </NotesCard>
          </div>
        }>
        
        <ScreenChrome module="Cobranzas">
          <U.PageHeader eyebrow="FINANZAS · CUENTAS POR COBRAR" title="Cobranzas"
          subtitle="Cola de cobranza sobre facturas con saldo. Registrar el cobro lo manda a caja." />
          <U.Card padded style={{ marginBottom: 'var(--s-5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }} data-comment-anchor="96151dabe1-div-339-13">
              <div style={{ flex: 1, minWidth: 220 }}>
                <code style={{ font: '800 14px/1 var(--f-mono)', color: 'var(--ink)' }}>{inv.id}</code>
                <div style={{ font: '600 13px/1.3 var(--f-sans)', color: 'var(--ink)', marginTop: 5 }}>{inv.clientName}</div>
                <div style={{ font: '500 11.5px/1 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 3 }}>{inv.client} · vence {inv.due}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ font: '700 9px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Saldo</div>
                <div style={{ font: '900 22px/1 var(--f-display)', color: 'var(--wine)', marginTop: 5 }}>{money(inv.balance)}</div>
              </div>
              <U.Btn variant="primary" icon={I.invoice(14)} onClick={() => setOpen(true)}>Registrar cobro</U.Btn>
            </div>
          </U.Card>

          <div className="eyebrow eyebrow-wine" style={{ marginBottom: 12 }}>POSICIÓN DE CAJA · TESORERÍA</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            {cajas.map((c) => {
              const justUpdated = lastMove && lastMove.caja.id === c.id;
              return (
                <U.Card key={c.id} padded style={justUpdated ? { borderColor: 'var(--success)', boxShadow: '0 0 0 1px var(--success)' } : {}}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ font: '700 11px/1.2 var(--f-sans)', color: 'var(--ink-soft)' }}>{c.name}</span>
                    <U.Badge tone={justUpdated ? 'success' : 'neutral'} size="sm">{c.cur}</U.Badge>
                  </div>
                  <div style={{ font: '900 21px/1 var(--f-display)', color: 'var(--ink)', marginTop: 12 }}>{c.sym}{c.balance.toLocaleString('en-US')}</div>
                  {justUpdated && <div style={{ font: '600 11px/1.3 var(--f-sans)', color: 'var(--success)', marginTop: 8 }}>↑ +{c.sym}{Math.round(lastMove.montoCur).toLocaleString('en-US')} · {lastMove.metodo}</div>}
                </U.Card>);

            })}
          </div>

          {lastMove &&
          <div style={{ marginTop: 16, padding: '12px 16px', border: '1px solid var(--success)', background: 'var(--success-bg)', borderRadius: 'var(--r-md)', display: 'flex', gap: 12, alignItems: 'center' }}>
              <span style={{ color: 'var(--success)' }}>{I.check(16)}</span>
              <div style={{ font: '500 12.5px/1.5 var(--f-sans)', color: 'var(--ink)' }}>
                Ingreso de <b>{lastMove.caja.sym}{Math.round(lastMove.montoCur).toLocaleString('en-US')}</b>{lastMove.caja.cur !== 'USD' ? ` (= ${money(lastMove.montoUsd)} · tasa ${lastMove.rate})` : ''} en <b>{lastMove.caja.name}</b> ({lastMove.metodo}) · factura <code style={{ font: '700 11px/1 var(--f-mono)', color: 'var(--wine)' }}>{lastMove.inv}</code> de {lastMove.client} · comprobante adjunto ✓.
              </div>
            </div>
          }
        </ScreenChrome>
        <CobroModal open={open} onClose={() => setOpen(false)} inv={inv} onConfirm={registrar} />
      </SectionFrame>);

  }

  function CobroModal({ open, onClose, inv, onConfirm }) {
    const [cajaId, setCajaId] = useState('usd');
    const [metodo, setMetodo] = useState(METODOS[0]);
    const [montoUsd, setMontoUsd] = useState(inv.balance);
    const [rate, setRate] = useState(1);
    const [proof, setProof] = useState(null);
    const caja = CAJAS.find((c) => c.id === cajaId) || CAJAS[0];
    const esUsd = caja.cur === 'USD';
    React.useEffect(() => {if (open) {setMontoUsd(inv.balance);setCajaId('usd');setMetodo(METODOS[0]);setRate(1);setProof(null);}}, [open]);
    React.useEffect(() => {setRate(RATES[caja.cur] || 1);}, [cajaId]);
    const montoCur = Number(montoUsd || 0) * Number(rate || 1); // lo que entra a la caja, en su moneda
    const parcial = Number(montoUsd) < inv.balance;
    const fmtCur = (n) => caja.sym + Math.round(n).toLocaleString('en-US');
    const inputBox = { width: '100%', padding: '10px 12px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--ink)', font: '700 15px/1 var(--f-mono)' };

    return (
      <U.Modal open={open} onClose={onClose} width={470} title="Registrar cobro"
      actions={
      <>
            <U.Btn variant="ghost" onClick={onClose}>Cancelar</U.Btn>
            <U.Btn variant="primary" icon={I.check(14)} disabled={!proof}
            onClick={() => proof && onConfirm({ cajaId, metodo, montoUsd: Number(montoUsd), montoCur, rate: Number(rate), proof })}>Confirmar ingreso</U.Btn>
          </>
      }>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ padding: '10px 14px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <code style={{ font: '800 12.5px/1 var(--f-mono)', color: 'var(--ink)' }}>{inv.id}</code>
              <div style={{ font: '500 11px/1 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 3 }}>{inv.clientName}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ font: '700 8px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Saldo (factura en US$)</div>
              <div style={{ font: '800 15px/1 var(--f-mono)', color: 'var(--wine)' }}>{money(inv.balance)}</div>
            </div>
          </div>

          <U.Select label="Cuenta de caja" value={cajaId} onChange={(e) => setCajaId(e.target.value)}
          options={CAJAS.map((c) => ({ value: c.id, label: c.name }))} />
          <U.Select label="Método de pago" value={metodo} onChange={(e) => setMetodo(e.target.value)} options={METODOS} />

          {/* Tasa del día · solo si la caja no es USD */}
          {!esUsd &&
          <div style={{ padding: '10px 12px', background: 'var(--wine-tint)', borderRadius: 'var(--r-md)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ font: '700 10px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Tasa del día · {caja.cur}/USD</span>
                  <span style={{ font: '700 8.5px/1 var(--f-sans)', color: '#fff', background: 'var(--success)', padding: '2px 5px', borderRadius: 'var(--r-pill)' }}>AUTO · BCV</span>
                </div>
                <div style={{ font: '500 10.5px/1.3 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 4 }}>Detectada automática · editable si la negociaste distinto.</div>
              </div>
              <input type="number" value={rate} onChange={(e) => setRate(e.target.value)} style={{ width: 96, padding: '8px 10px', borderRadius: 'var(--r-sm)', border: '1px solid var(--wine)', background: 'var(--bg-surface)', color: 'var(--ink)', font: '700 14px/1 var(--f-mono)' }} />
            </div>
          }

          {/* Monto · en moneda de caja + equivalente SIEMPRE en US$ */}
          <div>
            <div style={{ font: '700 10px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
              {esUsd ? 'Monto a cobrar (US$)' : `Monto que entra a caja (${caja.cur})`}
            </div>
            {esUsd ?
            <input type="number" value={montoUsd} onChange={(e) => setMontoUsd(e.target.value)} style={inputBox} /> :
            <React.Fragment>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <div style={{ font: '600 9px/1 var(--f-sans)', color: 'var(--ink-mute)', marginBottom: 4 }}>En {caja.cur}</div>
                    <input type="number" value={Math.round(montoCur)} onChange={(e) => setMontoUsd(Number(e.target.value) / Number(rate || 1))} style={inputBox} />
                  </div>
                  <div>
                    <div style={{ font: '600 9px/1 var(--f-sans)', color: 'var(--wine)', marginBottom: 4 }}>En US$ · se aplica a la factura</div>
                    <input type="number" value={Math.round(Number(montoUsd))} onChange={(e) => setMontoUsd(e.target.value)} style={{ ...inputBox, borderColor: 'var(--wine)', color: 'var(--wine)' }} />
                  </div>
                </div>
                <div style={{ font: '500 11.5px/1.5 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 8 }}>
                  Entran <b>{fmtCur(montoCur)}</b> a la caja · equivalen a <b style={{ color: 'var(--wine)' }}>{money(Number(montoUsd))}</b> (la factura siempre se salda en dólares).
                </div>
              </React.Fragment>
            }
            <div style={{ font: '500 11px/1.4 var(--f-sans)', color: parcial ? 'var(--warning)' : 'var(--ink-mute)', marginTop: 6 }}>
              {parcial ? `Abono parcial · quedan ${money(inv.balance - Number(montoUsd))} pendientes.` : 'Cobro total · salda la factura.'}
            </div>
          </div>

          {/* Comprobante de pago · prueba */}
          <div>
            <div style={{ font: '700 10px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Comprobante de pago</div>
            {proof ?
            <div style={{ padding: 12, background: 'var(--success-bg)', border: '1px solid var(--success)', borderRadius: 'var(--r-md)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ color: 'var(--success)' }}>{I.check(16)}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ font: '700 12px/1.2 var(--f-sans)', color: 'var(--success)' }}>Comprobante adjunto</div>
                  <code style={{ font: '500 10.5px/1.3 var(--f-mono)', color: 'var(--ink-soft)' }}>comprobante-pago.jpg</code>
                </div>
                <button onClick={() => setProof(null)} style={{ font: '600 11px/1 var(--f-sans)', color: 'var(--ink-soft)', padding: '4px 8px', cursor: 'pointer' }}>Quitar</button>
              </div> :
            <button onClick={() => setProof('mock-proof-' + Date.now())} style={{
              padding: '16px 14px', width: '100%', background: 'var(--bg-elevated)', border: '1px dashed var(--border)',
              borderRadius: 'var(--r-md)', color: 'var(--ink-soft)', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, font: '600 12px/1.4 var(--f-sans)', textAlign: 'center'
            }}
            onMouseEnter={(e) => {e.currentTarget.style.borderColor = 'var(--wine)';e.currentTarget.style.color = 'var(--wine)';}}
            onMouseLeave={(e) => {e.currentTarget.style.borderColor = 'var(--border)';e.currentTarget.style.color = 'var(--ink-soft)';}}>
                {I.upload(18)}
                <span style={{ font: '700 12px/1.2 var(--f-sans)' }}>Adjuntar prueba del pago</span>
                <span style={{ font: '500 10.5px/1.4 var(--f-sans)', color: 'var(--ink-mute)' }}>Transferencia, captura o recibo · JPG/PDF</span>
              </button>
            }
            {!proof && <div style={{ font: '500 11px/1.4 var(--f-sans)', color: 'var(--warning)', marginTop: 6 }}>El comprobante es obligatorio para registrar el ingreso.</div>}
          </div>
        </div>
      </U.Modal>);

  }

  // ════════════════════════════════════════════════════════════
  //  C · PROVEEDORES DE CLIENTES · CN
  // ════════════════════════════════════════════════════════════
  function SectionProveedores() {
    // Tomamos 3 suppliers reales y les sumamos el campo grupo WeChat + clientes
    const wechatCode = { 'sup-001': 'DTD-5452-1', 'sup-003': 'DTD-5277-1', 'sup-004': 'DTD-5371-1' };
    const picks = ['sup-001', 'sup-003', 'sup-004'].map((id) => D.SUPPLIERS.find((s) => s.id === id)).filter(Boolean);
    const clientsOf = (id) => D.SUPPLIER_CLIENTS.filter((sc) => sc.supplierId === id).map((sc) => sc.clientMarkbox);

    return (
      <SectionFrame
        tag="C"
        title="Proveedores de clientes · CN"
        intent="No son proveedores de la empresa: son los proveedores chinos de nuestros clientes, que se registran para que les recibamos la mercancía. Cada uno tiene su grupo de WeChat con código y se ve a qué cliente(s) pertenece."
        notes={
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <NotesCard title="LO QUE CAMBIA">
              <Bullet><b>Renombrado</b> a “Proveedores de clientes · CN” para no confundir con los de la empresa.</Bullet>
              <Bullet>Nuevo campo <b>Grupo WeChat + código</b> (el del seguimiento de la compra).</Bullet>
              <Bullet>Se muestra <b>a qué cliente(s)</b> pertenece cada proveedor.</Bullet>
            </NotesCard>
            <U.Card padded style={{ borderColor: 'var(--wine)' }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ color: 'var(--wine)' }}>{I.info(15)}</span>
                <div style={{ font: '500 12px/1.55 var(--f-sans)', color: 'var(--ink)' }}>
                  ¿A quién <b>le debe</b> la empresa? Eso no va acá: vive en <b>Tesorería · Cuentas por pagar</b> (proveedores de la empresa, navieras, aduana, transporte).
                </div>
              </div>
            </U.Card>
          </div>
        }>
        
        <ScreenChrome module="Proveedores de clientes · CN">
          <U.PageHeader title="Proveedores de clientes · CN · 客户供应商"
          subtitle="Proveedores chinos de nuestros clientes. No son acreedores de la empresa."
          actions={<U.Btn variant="primary" icon={I.plus(14)}>Nuevo proveedor</U.Btn>} />

          <div style={{ padding: '11px 16px', background: 'var(--wine-tint)', borderRadius: 'var(--r-md)', marginBottom: 'var(--s-5)', display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ color: 'var(--wine)' }}>{I.info(14)}</span>
            <div style={{ font: '500 12px/1.4 var(--f-sans)', color: 'var(--ink)' }}>
              Estos proveedores pertenecen a los <b>clientes</b>. La deuda de la empresa con sus propios proveedores se gestiona en <b>Tesorería · CxP</b>.
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
            {picks.map((s) => {
              const cls = clientsOf(s.id);
              const avg = ((s.rating.onTime + s.rating.quality + s.rating.price + s.rating.comms) / 4).toFixed(1);
              return (
                <U.Card key={s.id} padded>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ font: '800 14px/1.3 var(--f-display)', color: 'var(--ink)' }}>{s.name}</div>
                      <div style={{ font: '500 12px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 5 }}>{s.cn} · {s.city}</div>
                    </div>
                    <U.Badge tone={s.status === 'preferido' ? 'success' : 'info'} size="sm">★ {avg}</U.Badge>
                  </div>

                  {/* NUEVO · grupo WeChat */}
                  <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
                      <span style={{ color: 'var(--success)' }}>{I.chat ? I.chat(13) : I.globe(13)}</span>
                      <span style={{ font: '700 9.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Grupo WeChat</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <code style={{ font: '800 13px/1 var(--f-mono)', color: 'var(--wine)' }}>{wechatCode[s.id] || 'DTD-' + s.id.slice(-3)}</code>
                      <span style={{ font: '500 11px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>{s.wechat}</span>
                    </div>
                  </div>

                  {/* NUEVO · clientes */}
                  <div style={{ marginTop: 12 }}>
                    <div style={{ font: '700 9.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 7 }}>Cliente(s) que lo usan</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {cls.length ? cls.map((m) => {
                        const cli = D.byMarkbox(m);
                        return (
                          <span key={m} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 9px', borderRadius: 'var(--r-pill)', background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                            <code style={{ font: '700 10.5px/1 var(--f-mono)', color: 'var(--wine)' }}>{m}</code>
                            <span style={{ font: '500 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)' }}>{cli ? cli.name.split(' ')[0] : ''}</span>
                          </span>);

                      }) : <span style={{ font: '500 11px/1 var(--f-sans)', color: 'var(--ink-mute)' }}>Sin clientes asignados</span>}
                    </div>
                  </div>
                </U.Card>);

            })}
          </div>
        </ScreenChrome>
      </SectionFrame>);

  }

  // ════════════════════════════════════════════════════════════
  //  ROOT
  // ════════════════════════════════════════════════════════════
  function PropuestaApp() {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
        {/* Header de la propuesta */}
        <header style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
          <div style={{ maxWidth: 1160, margin: '0 auto', padding: '26px var(--s-8)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span style={{ font: '900 10.5px/1 var(--f-sans)', color: '#fff', background: 'var(--ink)', padding: '5px 9px', borderRadius: 'var(--r-sm)', letterSpacing: '0.14em' }}>PROPUESTA</span>
              <span style={{ font: '600 11.5px/1 var(--f-sans)', color: 'var(--ink-mute)' }}>Para revisión · todavía no integrada al ERP</span>
            </div>
            <h1 style={{ font: '900 30px/1.1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.025em', margin: '0 0 8px' }}>Órdenes en camino · Cobro a caja · Proveedores de clientes</h1>
            <p style={{ font: '500 14px/1.6 var(--f-sans)', color: 'var(--ink-soft)', margin: 0, maxWidth: 760 }}>
              Tres ajustes mockeados con el sistema real de DTD. Son interactivos: probá <b>Verificar</b> una orden y <b>Registrar cobro</b>. Si te cierran, los integro a los módulos vivos.
            </p>
          </div>
        </header>

        <main style={{ maxWidth: 1160, margin: '0 auto', padding: 'var(--s-10) var(--s-8) var(--s-16)' }}>
          <SectionOrdenes />
          <SectionCaja />
          <SectionProveedores />
        </main>
      </div>);

  }

  window.PropuestaApp = PropuestaApp;
})();