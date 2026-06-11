/* global React */
/* ── DTD ERP · Contabilidad · Formularios de escritura · v2.5 ── */
/* Nuevo asiento (manual + edición) · Registrar pago · Registrar  */
/* gasto. Todos postean al libro diario vía ContabilidadData.     */

const TODAY_CONTAB = '2026-05-24';

// ── helpers de cuentas (hojas posteables) ─────────────────────
function _leafAccounts(pred) {
  const C = window.ContabilidadData;
  return C.CHART_OF_ACCOUNTS
    .filter(a => C.isLeaf(a.code) && !a.inactive && (!pred || pred(a)))
    .sort((x, y) => x.code.localeCompare(y.code, undefined, { numeric: true }));
}
function _cashAccounts() {
  // Bancos / caja: hojas bajo los rubros 1.01–1.04
  return _leafAccounts(a => a.type === 'A' && /^1\.0[1-4]\./.test(a.code));
}
function _accOptions(list) {
  return list.map(a => ({ value: a.code, label: `${a.code} · ${a.name}` }));
}
function _ccyOfAccount(code) {
  // Inferencia de moneda por rubro del plan real
  if (/^1\.01\./.test(code)) return 'VES';
  if (/^1\.03\./.test(code)) return 'CNY';
  return 'USD';
}

// ── átomos visuales compartidos ───────────────────────────────
function FLabel({ children, hint }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <span style={{ font: '700 10px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{children}</span>
      {hint && <span style={{ font: '500 10.5px/1 var(--f-sans)', color: 'var(--ink-mute)', marginLeft: 8 }}>{hint}</span>}
    </div>
  );
}
const FORM_INPUT = { width: '100%', padding: '9px 11px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--ink)', font: '500 13px/1.3 var(--f-sans)' };
const FORM_MONO = { ...FORM_INPUT, fontFamily: 'var(--f-mono)', fontWeight: 700, textAlign: 'right' };

function BalanceBanner({ debit, credit }) {
  const R = window.ERPRates;
  const diff = Math.round((debit - credit) * 100) / 100;
  const ok = diff === 0 && debit > 0;
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
      padding: '10px 14px', borderRadius: 'var(--r-md)',
      background: ok ? 'var(--success-bg)' : 'var(--warning-bg)',
      borderLeft: `3px solid var(--${ok ? 'success' : 'warning'})`,
    }}>
      <span style={{ font: '600 12px/1.3 var(--f-sans)', color: 'var(--ink)' }}>
        {ok ? 'Asiento cuadrado · listo para contabilizar' : (debit === 0 ? 'Carga montos en débito y crédito' : `Descuadre de ${R.fmtUsd(Math.abs(diff))}`)}
      </span>
      <div style={{ display: 'flex', gap: 16, font: '700 12px/1 var(--f-mono)', color: 'var(--ink)' }}>
        <span>D {R.fmtUsd(debit)}</span>
        <span>H {R.fmtUsd(credit)}</span>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// 1 · Nuevo asiento (manual) — también edición
// ════════════════════════════════════════════════════════════════
function EntryDrawer({ open, onClose, editEntry }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const C = window.ContabilidadData;
  const isEdit = !!editEntry;

  const blankLine = () => ({ account: '', memo: '', debit: '', credit: '' });
  const [date, setDate] = React.useState(TODAY_CONTAB);
  const [concept, setConcept] = React.useState('');
  const [ref, setRef] = React.useState('');
  const [refType, setRefType] = React.useState('manual');
  const [lines, setLines] = React.useState([blankLine(), blankLine()]);

  React.useEffect(() => {
    if (!open) return;
    if (editEntry) {
      setDate(editEntry.date); setConcept(editEntry.concept); setRef(editEntry.ref === '—' ? '' : editEntry.ref);
      setRefType(editEntry.refType || 'manual');
      setLines(editEntry.lines.map(l => ({ account: l.account, memo: l.memo || '', debit: l.debit ? String(l.debit) : '', credit: l.credit ? String(l.credit) : '' })));
    } else {
      setDate(TODAY_CONTAB); setConcept(''); setRef(''); setRefType('manual'); setLines([blankLine(), blankLine()]);
    }
  }, [open, editEntry]);

  const accOpts = React.useMemo(() => [{ value: '', label: '— elige cuenta —' }, ..._accOptions(_leafAccounts())], [open]);
  const setLine = (i, patch) => setLines(ls => ls.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  const addLine = () => setLines(ls => [...ls, blankLine()]);
  const removeLine = (i) => setLines(ls => ls.length > 2 ? ls.filter((_, idx) => idx !== i) : ls);

  const num = (v) => Number(v) || 0;
  const totalD = lines.reduce((s, l) => s + num(l.debit), 0);
  const totalC = lines.reduce((s, l) => s + num(l.credit), 0);
  const valid = concept.trim() && Math.round((totalD - totalC) * 100) === 0 && totalD > 0 &&
    lines.filter(l => l.account && (num(l.debit) || num(l.credit))).length >= 2;

  const save = () => {
    const payload = {
      date, concept: concept.trim(), ref: ref.trim() || '—', refType,
      lines: lines.filter(l => l.account && (num(l.debit) || num(l.credit)))
        .map(l => ({ account: l.account, debit: num(l.debit), credit: num(l.credit), memo: l.memo.trim() })),
    };
    if (isEdit) C.updateEntry(editEntry.id, payload);
    else C.createEntry(payload);
    onClose();
  };

  return (
    <U.Drawer open={open} onClose={onClose} width={860}
      title={isEdit ? `Editar ${editEntry.id}` : 'Nuevo asiento manual'}
      subtitle={isEdit ? 'Los cambios quedan registrados en el audit log' : 'Partida doble · el asiento debe cuadrar para contabilizar'}
      actions={
        <React.Fragment>
          <U.Btn variant="ghost" onClick={onClose}>Cancelar</U.Btn>
          <U.Btn variant="primary" icon={I.check(14)} disabled={!valid} onClick={save}>{isEdit ? 'Guardar cambios' : 'Contabilizar'}</U.Btn>
        </React.Fragment>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 160px', gap: 12 }}>
          <div><FLabel>Fecha</FLabel><input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ ...FORM_INPUT, fontFamily: 'var(--f-mono)' }} /></div>
          <div><FLabel>Concepto</FLabel><input value={concept} onChange={(e) => setConcept(e.target.value)} placeholder="Ej. Ajuste de provisión de mayo" style={FORM_INPUT} /></div>
          <div><FLabel hint="opcional">Referencia</FLabel><input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="TX / Factura" style={{ ...FORM_INPUT, fontFamily: 'var(--f-mono)' }} /></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 12, alignItems: 'end' }}>
          <div><FLabel>Tipo</FLabel>
            <U.Select value={refType} onChange={(e) => setRefType(e.target.value)} options={[
              { value: 'manual', label: 'Asiento manual' }, { value: 'invoice', label: 'Factura emitida' },
              { value: 'payment', label: 'Pago USD' }, { value: 'payment-ves', label: 'Pago VES' },
              { value: 'expense', label: 'Gasto' }, { value: 'unclassified', label: 'Por clasificar' },
            ]} />
          </div>
        </div>

        {/* Líneas */}
        <div>
          <FLabel>Líneas del asiento</FLabel>
          <U.Card padded={false}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr) 120px 120px 34px', gap: 10, padding: '9px 14px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)', font: '700 10px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              <span>Cuenta</span><span>Memo</span>
              <span style={{ textAlign: 'right' }}>Débito</span><span style={{ textAlign: 'right' }}>Crédito</span><span></span>
            </div>
            {lines.map((l, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr) 120px 120px 34px', gap: 10, padding: '8px 14px', alignItems: 'center', borderTop: i > 0 ? '1px solid var(--border)' : 0 }}>
                <U.Select value={l.account} onChange={(e) => setLine(i, { account: e.target.value })} options={accOpts} style={{ minWidth: 0 }} />
                <input value={l.memo} onChange={(e) => setLine(i, { memo: e.target.value })} placeholder="Detalle" style={{ ...FORM_INPUT, minWidth: 0 }} />
                <U.CalcInput value={l.debit} onChange={(e) => setLine(i, { debit: e.target.value, credit: e.target.value ? '' : l.credit })} placeholder="0" style={FORM_MONO} />
                <U.CalcInput value={l.credit} onChange={(e) => setLine(i, { credit: e.target.value, debit: e.target.value ? '' : l.debit })} placeholder="0" style={FORM_MONO} />
                <button onClick={() => removeLine(i)} disabled={lines.length <= 2} title="Quitar línea" style={{ width: 28, height: 28, borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: lines.length <= 2 ? 'var(--ink-mute)' : 'var(--danger)', cursor: lines.length <= 2 ? 'not-allowed' : 'pointer', font: '700 14px/1 var(--f-sans)' }}>×</button>
              </div>
            ))}
            <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)' }}>
              <U.Btn variant="soft" size="sm" icon={I.plus(12)} onClick={addLine}>Agregar línea</U.Btn>
            </div>
          </U.Card>
        </div>

        <BalanceBanner debit={totalD} credit={totalC} />
      </div>
    </U.Drawer>
  );
}

// ════════════════════════════════════════════════════════════════
// 2 · Registrar pago (cobro de cliente → banco / caja)
// ════════════════════════════════════════════════════════════════
function QuickPayDrawer({ open, onClose }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const C = window.ContabilidadData;
  const R = window.ERPRates;
  const [rates] = R.useRates();

  const cashOpts = React.useMemo(() => _accOptions(_cashAccounts()), [open]);
  const cxcOpts = React.useMemo(() => _accOptions(_leafAccounts(a => /^1\.05\./.test(a.code))), [open]);

  const [date, setDate] = React.useState(TODAY_CONTAB);
  const [cliente, setCliente] = React.useState('');
  const [cxc, setCxc] = React.useState('1.05.01');
  const [dest, setDest] = React.useState('1.04.01');
  const [amount, setAmount] = React.useState('');   // monto en la moneda de la cuenta
  const [rate, setRate] = React.useState(rates.bcv);
  const [ref, setRef] = React.useState('');

  React.useEffect(() => {
    if (!open) return;
    setDate(TODAY_CONTAB); setCliente(''); setCxc('1.05.01'); setDest('1.04.01'); setAmount(''); setRate(rates.bcv); setRef('');
  }, [open]);

  const ccy = _ccyOfAccount(dest);
  const orig = Number(amount) || 0;
  const usd = ccy === 'VES' ? (Number(rate) ? orig / Number(rate) : 0) : ccy === 'CNY' ? (rates.cny ? orig / rates.cny : 0) : orig;
  const usdR = Math.round(usd * 100) / 100;
  const valid = cliente.trim() && usdR > 0 && dest && cxc;

  const save = () => {
    const entry = {
      date, concept: `Pago recibido · ${cliente.trim()}`, ref: ref.trim() || '—',
      refType: ccy === 'VES' ? 'payment-ves' : 'payment',
      lines: [
        { account: dest, debit: usdR, credit: 0, memo: `${C.getAccount(dest)?.name || ''}${ccy !== 'USD' ? ` · ${orig.toLocaleString('es-VE')} ${ccy} @ ${Number(rate || rates.cny).toFixed(2)}` : ''}` },
        { account: cxc, debit: 0, credit: usdR, memo: `Cancelación CxC · ${cliente.trim()}` },
      ],
      ...(ccy !== 'USD' ? { forex: { originalAmount: orig, originalCurrency: ccy, rate: ccy === 'VES' ? Number(rate) : rates.cny, rateSource: ccy === 'VES' ? 'bcv' : 'cny' } } : {}),
    };
    C.createEntry(entry);
    onClose();
  };

  return (
    <U.Drawer open={open} onClose={onClose} width={560}
      title="Registrar pago recibido"
      subtitle="Cobro de cliente · debita banco/caja y cancela la cuenta por cobrar"
      actions={
        <React.Fragment>
          <U.Btn variant="ghost" onClick={onClose}>Cancelar</U.Btn>
          <U.Btn variant="primary" icon={I.check(14)} disabled={!valid} onClick={save}>Registrar pago</U.Btn>
        </React.Fragment>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 12 }}>
          <div><FLabel>Fecha</FLabel><input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ ...FORM_INPUT, fontFamily: 'var(--f-mono)' }} /></div>
          <div><FLabel>Cliente</FLabel><input value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="Ej. Industrias Polar" style={FORM_INPUT} /></div>
        </div>
        <div><FLabel>Cuenta por cobrar</FLabel><U.Select value={cxc} onChange={(e) => setCxc(e.target.value)} options={cxcOpts} /></div>
        <div><FLabel>Entra a (banco / caja)</FLabel><U.Select value={dest} onChange={(e) => setDest(e.target.value)} options={cashOpts} /></div>
        <div style={{ display: 'grid', gridTemplateColumns: ccy === 'VES' ? '1fr 130px' : '1fr', gap: 12 }}>
          <div><FLabel hint={ccy !== 'USD' ? `monto en ${ccy}` : 'monto USD'}>Monto</FLabel><U.CalcInput value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" style={{ ...FORM_INPUT, fontFamily: 'var(--f-mono)', fontWeight: 700 }} /></div>
          {ccy === 'VES' && <div><FLabel>Tasa BCV</FLabel><U.CalcInput value={rate} onChange={(e) => setRate(e.target.value)} placeholder="0" style={{ ...FORM_INPUT, fontFamily: 'var(--f-mono)', fontWeight: 700 }} /></div>}
        </div>
        <div><FLabel hint="opcional">Referencia</FLabel><input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="WIRE / TRF / Pago Móvil" style={{ ...FORM_INPUT, fontFamily: 'var(--f-mono)' }} /></div>

        <div style={{ padding: '12px 14px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ font: '600 12px/1.2 var(--f-sans)', color: 'var(--ink-soft)' }}>Se contabiliza en USD</span>
          <span style={{ font: '900 18px/1 var(--f-display)', color: 'var(--wine)' }}>{R.fmtUsd(usdR)}</span>
        </div>
      </div>
    </U.Drawer>
  );
}

// ════════════════════════════════════════════════════════════════
// 3 · Registrar gasto (gasto/costo → banco / caja)
// ════════════════════════════════════════════════════════════════
function QuickExpenseDrawer({ open, onClose }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const C = window.ContabilidadData;
  const R = window.ERPRates;

  const gastoOpts = React.useMemo(() => _accOptions(_leafAccounts(a => a.type === 'G' || a.type === 'CGS')), [open]);
  const cashOpts = React.useMemo(() => _accOptions(_cashAccounts()), [open]);

  const [date, setDate] = React.useState(TODAY_CONTAB);
  const [concept, setConcept] = React.useState('');
  const [acc, setAcc] = React.useState('');
  const [pay, setPay] = React.useState('1.04.01');
  const [amount, setAmount] = React.useState('');
  const [ref, setRef] = React.useState('');

  React.useEffect(() => {
    if (!open) return;
    setDate(TODAY_CONTAB); setConcept(''); setAcc(''); setPay('1.04.01'); setAmount(''); setRef('');
  }, [open]);

  const usd = Math.round((Number(amount) || 0) * 100) / 100;
  const valid = concept.trim() && acc && pay && usd > 0;
  const save = () => {
    C.createEntry({
      date, concept: concept.trim(), ref: ref.trim() || '—', refType: 'expense',
      lines: [
        { account: acc, debit: usd, credit: 0, memo: concept.trim() },
        { account: pay, debit: 0, credit: usd, memo: `Pago · ${C.getAccount(pay)?.name || ''}` },
      ],
    });
    onClose();
  };

  return (
    <U.Drawer open={open} onClose={onClose} width={560}
      title="Registrar gasto"
      subtitle="Carga un gasto o costo directo y lo paga desde una cuenta de caja/banco"
      actions={
        <React.Fragment>
          <U.Btn variant="ghost" onClick={onClose}>Cancelar</U.Btn>
          <U.Btn variant="primary" icon={I.check(14)} disabled={!valid} onClick={save}>Registrar gasto</U.Btn>
        </React.Fragment>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 12 }}>
          <div><FLabel>Fecha</FLabel><input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ ...FORM_INPUT, fontFamily: 'var(--f-mono)' }} /></div>
          <div><FLabel>Concepto</FLabel><input value={concept} onChange={(e) => setConcept(e.target.value)} placeholder="Ej. Honorarios agente aduanal" style={FORM_INPUT} /></div>
        </div>
        <div><FLabel>Cuenta de gasto / costo</FLabel><U.Select value={acc} onChange={(e) => setAcc(e.target.value)} options={[{ value: '', label: '— elige cuenta —' }, ...gastoOpts]} /></div>
        <div><FLabel>Pagado desde</FLabel><U.Select value={pay} onChange={(e) => setPay(e.target.value)} options={cashOpts} /></div>
        <div><FLabel hint="USD">Monto</FLabel><U.CalcInput value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" style={{ ...FORM_INPUT, fontFamily: 'var(--f-mono)', fontWeight: 700 }} /></div>
        <div><FLabel hint="opcional">Referencia</FLabel><input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="TX / comprobante" style={{ ...FORM_INPUT, fontFamily: 'var(--f-mono)' }} /></div>
        <div style={{ padding: '12px 14px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ font: '600 12px/1.2 var(--f-sans)', color: 'var(--ink-soft)' }}>Total a contabilizar</span>
          <span style={{ font: '900 18px/1 var(--f-display)', color: 'var(--wine)' }}>{R.fmtUsd(usd)}</span>
        </div>
      </div>
    </U.Drawer>
  );
}

window.ContabForms = { EntryDrawer, QuickPayDrawer, QuickExpenseDrawer };
