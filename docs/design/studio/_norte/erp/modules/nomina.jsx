/* global React */
/* ── DTD ERP · Nómina · v2.5 ────────────────────────────────── */
/* Sueldos indexados USD · pago en VES · contabilidad en USD.    */
/* Tabs: Nómina del período · Empleados · Envío por WhatsApp.    */

function ModuleNomina({ goTo }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const N = window.NominaData;
  const R = window.ERPRates;
  const [rates] = R.useRates();
  const [tab, setTab] = React.useState('periodo');
  const [reglasOpen, setReglasOpen] = React.useState(false);
  const [, force] = React.useReducer(x => x + 1, 0);
  React.useEffect(() => {
    const f = () => force();
    window.addEventListener('dtd-nomina-changed', f);
    return () => window.removeEventListener('dtd-nomina-changed', f);
  }, []);

  // Estado compartido del período (tasa, bono, etiqueta)
  const [period, setPeriod] = React.useState({ label: 'Mayo 2026', date: '2026-05-31', rate: rates.bcv, bono: 40 });
  const setP = (patch) => setPeriod(p => ({ ...p, ...patch }));

  const activos = N.EMPLOYEES.filter(e => !e.inactive).length;
  const ruleChanges = N.rulesDiff ? N.rulesDiff().length : 0;

  return (
    <div>
      <U.PageHeader
        eyebrow="FINANZAS · RRHH"
        title="Nómina"
        subtitle={`Sueldos indexados en USD · pago en bolívares · contabilidad en USD funcional · ${activos} empleados activos · BCV ${rates.bcv.toFixed(2)}`}
        actions={
          <U.Btn variant="secondary" icon={I.sliders ? I.sliders(15) : I.calc(15)} onClick={() => setReglasOpen(true)}>
            Reglas de cálculo{ruleChanges > 0 ? ` · ${ruleChanges} ajuste${ruleChanges > 1 ? 's' : ''}` : ''}
          </U.Btn>
        }
      />
      <U.Tabs
        value={tab}
        onChange={setTab}
        items={[
          { value: 'periodo',  label: 'Nómina del período' },
          { value: 'empleados', label: 'Empleados', count: N.EMPLOYEES.length },
          { value: 'asistencia', label: 'Asistencia' },
          { value: 'solicitudes', label: 'Solicitudes', count: N.pendingRegs ? N.pendingRegs().length : 0 },
          { value: 'prestamos', label: 'Préstamos', count: N.allLoans ? N.allLoans().filter(l => l.status === 'activo').length : 0 },
          { value: 'liquidacion', label: 'Liquidación' },
          { value: 'prestadores', label: 'Prestadores' },
          { value: 'comunicaciones', label: 'Comunicaciones' },
          { value: 'whatsapp', label: 'Envío por WhatsApp' },
        ]}
        style={{ marginBottom: 'var(--s-5)' }}
      />
      {tab === 'periodo'   && <PeriodoTab period={period} setP={setP} />}
      {tab === 'empleados' && <EmpleadosTab />}
      {tab === 'asistencia' && <AsistenciaTab />}
      {tab === 'solicitudes' && <SolicitudesTab />}
      {tab === 'prestamos' && <PrestamosTab />}
      {tab === 'liquidacion' && <LiquidacionTab />}
      {tab === 'prestadores' && <PrestadoresTab />}
      {tab === 'comunicaciones' && <ComunicacionesTab />}
      {tab === 'whatsapp'  && <WhatsAppTab period={period} setP={setP} />}
      <ReglasDrawer open={reglasOpen} onClose={() => setReglasOpen(false)} />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Nómina del período
// ════════════════════════════════════════════════════════════════
function PeriodoTab({ period, setP }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const N = window.NominaData;
  const R = window.ERPRates;
  const C = window.ContabilidadData;

  const rows = N.payrollRows(period.bono);
  const t = N.payrollTotals(period.bono);
  const rate = Number(period.rate) || 1;
  const ves = (usd) => 'Bs. ' + Math.round(usd * rate).toLocaleString('es-VE');
  const runs = N.payrollRuns();

  const post = () => {
    const unlocked = C && C.isUnlocked ? C.isUnlocked() : false;
    if (!unlocked) { alert('Activa "Edición abierta" en Contabilidad (header del módulo) para contabilizar la nómina.'); return; }
    if (!window.confirm(`¿Contabilizar la nómina "${period.label}"? Débito 6.09.04 · crédito aportes 2.08 · crédito banco VES por el neto.`)) return;
    const e = C.createEntry(N.buildPayrollEntry(period.label, period.date, rate, period.bono));
    N.recordPayrollRun({ label: period.label, date: period.date, rate, bono: period.bono, empleados: t.empleados, asignaciones: t.asignaciones, deducciones: t.deducciones, neto: t.neto, netoVes: Math.round(t.neto * rate), entryId: e.id, at: new Date().toISOString().slice(0, 16).replace('T', ' ') });
    alert(`Nómina contabilizada · asiento ${e.id}. Neto pagado ${ves(t.neto)}.`);
  };

  const box = { padding: '8px 10px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--ink)', font: '600 13px/1 var(--f-sans)', width: '100%' };
  const mono = { ...box, fontFamily: 'var(--f-mono)', fontWeight: 700, textAlign: 'right' };

  const pst = N.getPeriodStatus(period.label);
  const P_STEPS = { borrador: { label: 'Borrador', tone: 'neutral' }, confirmado: { label: 'Confirmado', tone: 'info' }, pagado: { label: 'Pagado', tone: 'success' } };
  const pcur = P_STEPS[pst.status] || P_STEPS.borrador;
  const advance = (to) => N.setPeriodStatus(period.label, { status: to });
  const onComprobante = (e) => { const f = e.target.files && e.target.files[0]; if (f) N.setPeriodStatus(period.label, { comprobante: f.name }); };
  const exportCsv = () => {
    const head = ['Empleado', 'Cargo', 'Cédula', 'Sueldo USD', 'Bono USD', 'Asignaciones USD', 'Deducciones USD', 'Préstamo USD', 'Neto USD', 'Neto Bs'];
    const lines = [head.join(';')];
    rows.forEach(x => lines.push([x.emp.name, x.emp.cargo, x.emp.cedula, x.r.sueldo, x.r.bono, x.r.asignaciones, x.r.deducciones, x.r.prestamo || 0, x.r.netoFinal, Math.round(x.r.netoFinal * rate)].join(';')));
    lines.push(['TOTALES', '', '', '', '', t.asignaciones, t.deducciones, '', t.neto, Math.round(t.neto * rate)].join(';'));
    const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `nomina-${period.label.replace(/[^\w]+/g, '-')}.csv`; a.click();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 16px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ font: '700 10px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Estado del corte</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {['borrador', 'confirmado', 'pagado'].map((s, i) => {
              const on = ['borrador', 'confirmado', 'pagado'].indexOf(pst.status) >= i;
              return <React.Fragment key={s}>{i > 0 && <span style={{ width: 16, height: 2, background: on ? `var(--${P_STEPS[s].tone})` : 'var(--border)' }} />}<U.Badge tone={on ? P_STEPS[s].tone : 'neutral'} size="sm" dot={pst.status === s}>{P_STEPS[s].label}</U.Badge></React.Fragment>;
            })}
          </div>
          {pst.comprobante && <span style={{ font: '500 11px/1 var(--f-mono)', color: 'var(--ink-mute)' }}>· {pst.comprobante}</span>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <U.Btn variant="secondary" size="sm" icon={I.download ? I.download(13) : null} onClick={exportCsv}>Exportar Excel</U.Btn>
          {pst.status === 'borrador' && <U.Btn variant="primary" size="sm" icon={I.check(13)} onClick={() => advance('confirmado')}>Confirmar corte</U.Btn>}
          {pst.status === 'confirmado' && <React.Fragment>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', height: 30, padding: '0 10px', borderRadius: 'var(--r-md)', border: '1px solid var(--border-strong)', background: 'var(--bg-surface)', font: '600 12.5px/1 var(--f-sans)', color: 'var(--ink)' }}>{I.upload ? I.upload(13) : null} Subir comprobante<input type="file" onChange={onComprobante} style={{ display: 'none' }} /></label>
            <U.Btn variant="primary" size="sm" icon={I.check(13)} onClick={() => advance('pagado')}>Marcar pagado</U.Btn>
          </React.Fragment>}
          {pst.status === 'pagado' && <U.Btn variant="ghost" size="sm" onClick={() => advance('borrador')}>Reabrir</U.Btn>}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        <U.KPI label="Total asignaciones" value={R.fmtUsd(t.asignaciones)} delta={ves(t.asignaciones)} tone="info" icon={I.invoice(18)} />
        <U.KPI label="Deducciones (SSO/RPE/FAOV)" value={R.fmtUsd(t.deducciones)} delta="aportes de ley" tone="warning" icon={I.shield(18)} />
        <U.KPI label="Neto a pagar (USD)" value={R.fmtUsd(t.neto)} delta={`${t.empleados} empleados`} tone="wine" icon={I.cash ? I.cash(18) : I.invoice(18)} />
        <U.KPI label="Neto a pagar (Bs.)" value={ves(t.neto)} delta={`@ BCV ${rate.toFixed(2)}`} tone="success" icon={I.wallet ? I.wallet(18) : I.chart(18)} />
      </div>

      <U.Card padded>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 150px 130px 130px', gap: 14, alignItems: 'end' }}>
          <div>
            <div style={{ font: '700 9px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 5 }}>Período</div>
            <input value={period.label} onChange={(e) => setP({ label: e.target.value })} style={box} />
          </div>
          <div>
            <div style={{ font: '700 9px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 5 }}>Fecha</div>
            <input type="date" value={period.date} onChange={(e) => setP({ date: e.target.value })} style={{ ...box, fontFamily: 'var(--f-mono)' }} />
          </div>
          <div>
            <div style={{ font: '700 9px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 5 }}>Tasa BCV</div>
            <window.ERPUI.CalcInput value={period.rate} onChange={(e) => setP({ rate: e.target.value })} style={mono} />
          </div>
          <div>
            <div style={{ font: '700 9px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 5 }}>Bono (USD)</div>
            <window.ERPUI.CalcInput value={period.bono} onChange={(e) => setP({ bono: e.target.value })} style={mono} />
          </div>
        </div>
      </U.Card>

      <U.Card padded={false}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 90px 80px 110px 100px 120px 130px', padding: '10px 18px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)', font: '700 10px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.08em', textTransform: 'uppercase', gap: 12 }}>
          <span>Empleado</span><span style={{ textAlign: 'right' }}>Sueldo</span><span style={{ textAlign: 'right' }}>Bono</span><span style={{ textAlign: 'right' }}>Asign.</span><span style={{ textAlign: 'right' }}>Deduc.</span><span style={{ textAlign: 'right' }}>Neto USD</span><span style={{ textAlign: 'right' }}>Neto Bs.</span>
        </div>
        {rows.map((x, i) => (
          <div key={x.emp.id} style={{ display: 'grid', gridTemplateColumns: '1.4fr 90px 80px 110px 100px 120px 130px', padding: '11px 18px', alignItems: 'center', gap: 12, borderTop: i > 0 ? '1px solid var(--border)' : 0 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ font: '600 12.5px/1.2 var(--f-sans)', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.emp.name}</div>
              <div style={{ font: '500 10.5px/1.2 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 2 }}>{x.emp.cargo}</div>
            </div>
            <div style={{ textAlign: 'right', font: '600 11.5px/1 var(--f-mono)', color: 'var(--ink)' }}>{R.fmtUsd(x.r.sueldo)}</div>
            <div style={{ textAlign: 'right', font: '500 11.5px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>{R.fmtUsd(x.r.bono)}</div>
            <div style={{ textAlign: 'right', font: '600 11.5px/1 var(--f-mono)', color: 'var(--ink)' }}>{R.fmtUsd(x.r.asignaciones)}</div>
            <div style={{ textAlign: 'right', font: '500 11.5px/1 var(--f-mono)', color: 'var(--warning)' }}>−{R.fmtUsd(x.r.deducciones)}</div>
            <div style={{ textAlign: 'right', font: '800 12px/1 var(--f-mono)', color: 'var(--ink)' }}>{R.fmtUsd(x.r.neto)}</div>
            <div style={{ textAlign: 'right', font: '700 11.5px/1 var(--f-mono)', color: 'var(--wine)' }}>{ves(x.r.neto)}</div>
          </div>
        ))}
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 90px 80px 110px 100px 120px 130px', padding: '12px 18px', alignItems: 'center', gap: 12, borderTop: '2px solid var(--ink)', background: 'var(--bg-elevated)', font: '900 12px/1 var(--f-mono)', color: 'var(--ink)' }}>
          <span style={{ font: '700 11px/1 var(--f-sans)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-soft)' }}>Totales</span>
          <span></span><span></span>
          <span style={{ textAlign: 'right' }}>{R.fmtUsd(t.asignaciones)}</span>
          <span style={{ textAlign: 'right', color: 'var(--warning)' }}>−{R.fmtUsd(t.deducciones)}</span>
          <span style={{ textAlign: 'right' }}>{R.fmtUsd(t.neto)}</span>
          <span style={{ textAlign: 'right', color: 'var(--wine)' }}>{ves(t.neto)}</span>
        </div>
      </U.Card>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', background: 'var(--bg-sidebar)', color: '#fff', borderRadius: 'var(--r-lg)' }}>
        <div>
          <div style={{ font: '700 10px/1 var(--f-sans)', color: 'rgba(255,255,255,0.55)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>NETO A PAGAR EN BOLÍVARES</div>
          <div style={{ font: '500 11.5px/1.4 var(--f-sans)', color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>Se contabiliza en USD a tasa BCV {rate.toFixed(2)} · débito 6.09.04 / crédito 2.08 + banco VES 1.01.02</div>
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <div style={{ font: '900 22px/1 var(--f-display)' }}>{ves(t.neto)}</div>
          <U.Btn variant="primary" icon={I.check(14)} onClick={post}>Contabilizar nómina</U.Btn>
        </div>
      </div>

      {runs.length > 0 && (
        <U.Card padded={false}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
            <div className="eyebrow eyebrow-wine">NÓMINAS CONTABILIZADAS</div>
          </div>
          {runs.map((run, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 110px 120px 130px 110px', padding: '11px 18px', alignItems: 'center', gap: 12, borderTop: i > 0 ? '1px solid var(--border)' : 0 }}>
              <span style={{ font: '600 12.5px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{run.label}</span>
              <code style={{ font: '600 11px/1 var(--f-mono)', color: 'var(--wine)' }}>{run.entryId}</code>
              <span style={{ textAlign: 'right', font: '500 11px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>{run.empleados} empl.</span>
              <span style={{ textAlign: 'right', font: '700 12px/1 var(--f-mono)', color: 'var(--ink)' }}>{R.fmtUsd(run.neto)}</span>
              <span style={{ textAlign: 'right', font: '500 10.5px/1 var(--f-mono)', color: 'var(--ink-mute)' }}>{run.at}</span>
            </div>
          ))}
        </U.Card>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Empleados
// ════════════════════════════════════════════════════════════════
function EmpleadosTab() {
  const U = window.ERPUI;
  const I = window.Icon;
  const N = window.NominaData;
  const R = window.ERPRates;
  const [open, setOpen] = React.useState(null); // emp en edición o 'new'
  const [exp, setExp] = React.useState(null); // emp en expediente
  const [, force] = React.useReducer(x => x + 1, 0);
  React.useEffect(() => {
    const f = () => force();
    window.addEventListener('dtd-nomina-changed', f);
    return () => window.removeEventListener('dtd-nomina-changed', f);
  }, []);

  if (exp) {
    const emp = N.EMPLOYEES.find(e => e.id === exp);
    if (emp) return (
      <React.Fragment>
        <ExpedienteView emp={emp} onBack={() => setExp(null)} onEdit={() => setOpen(emp)} />
        <EmpleadoDrawer emp={open === 'new' ? null : open} open={!!open} onClose={() => setOpen(null)} />
      </React.Fragment>
    );
  }

  return (
    <div>
      <U.Toolbar actions={<U.Btn variant="primary" size="sm" icon={I.plus(12)} onClick={() => setOpen('new')}>Nuevo empleado</U.Btn>} />
      <U.Card padded={false}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 130px 130px 110px 70px', padding: '10px 18px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)', font: '700 10px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.08em', textTransform: 'uppercase', gap: 12 }}>
          <span>Empleado</span><span>Cargo</span><span>Cédula</span><span>Teléfono</span><span style={{ textAlign: 'right' }}>Sueldo USD</span><span></span>
        </div>
        {N.EMPLOYEES.map((e, i) => (
          <div key={e.id} onClick={() => setExp(e.id)} style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 130px 130px 110px 70px', padding: '11px 18px', alignItems: 'center', gap: 12, borderTop: i > 0 ? '1px solid var(--border)' : 0, opacity: e.inactive ? 0.5 : 1, cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <span style={{ font: '600 12.5px/1.2 var(--f-sans)', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name}</span>
              {e.inactive && <U.Badge tone="neutral" size="sm">Inactivo</U.Badge>}
            </div>
            <span style={{ font: '500 12px/1.2 var(--f-sans)', color: 'var(--ink-soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.cargo}</span>
            <code style={{ font: '500 11px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>{e.cedula}</code>
            <code style={{ font: '500 11px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>{e.phone}</code>
            <span style={{ textAlign: 'right', font: '700 12px/1 var(--f-mono)', color: 'var(--ink)' }}>{R.fmtUsd(e.salarioUsd)}</span>
            <div style={{ textAlign: 'right' }}>
              <button onClick={(ev) => { ev.stopPropagation(); setOpen(e); }} style={{ font: '600 11px/1 var(--f-sans)', color: 'var(--wine)', display: 'inline-flex', alignItems: 'center', gap: 4, background: 'transparent', border: 'none', cursor: 'pointer' }}>{I.edit(12)} Editar</button>
            </div>
          </div>
        ))}
      </U.Card>
      <EmpleadoDrawer emp={open === 'new' ? null : open} open={!!open} onClose={() => setOpen(null)} />
    </div>
  );
}

function EmpleadoDrawer({ emp, open, onClose }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const N = window.NominaData;
  const isEdit = !!emp;
  const [f, setF] = React.useState({ name: '', cargo: '', cedula: '', phone: '+58 ', salarioUsd: '', dept: '' });
  const [active, setActive] = React.useState(true);
  React.useEffect(() => {
    if (!open) return;
    if (emp) { setF({ name: emp.name, cargo: emp.cargo, cedula: emp.cedula, phone: emp.phone, salarioUsd: emp.salarioUsd, dept: emp.dept || '' }); setActive(!emp.inactive); }
    else { setF({ name: '', cargo: '', cedula: '', phone: '+58 ', salarioUsd: '', dept: '' }); setActive(true); }
  }, [open, emp]);
  const set = (k, v) => setF(o => ({ ...o, [k]: v }));
  const valid = f.name.trim() && f.cargo.trim() && Number(f.salarioUsd) > 0;
  const save = () => {
    const payload = { name: f.name.trim(), cargo: f.cargo.trim(), cedula: f.cedula.trim(), phone: f.phone.trim(), salarioUsd: Number(f.salarioUsd), dept: f.dept.trim() };
    if (isEdit) { N.updateEmployee(emp.id, payload); N.setEmployeeActive(emp.id, active); }
    else N.createEmployee(payload);
    onClose();
  };
  const box = { width: '100%', padding: '9px 11px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--ink)', font: '500 13px/1.3 var(--f-sans)' };
  const Lbl = ({ children }) => (<div style={{ font: '700 10px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>{children}</div>);
  return (
    <U.Drawer open={open} onClose={onClose} width={520} title={isEdit ? `Editar ${emp.name}` : 'Nuevo empleado'} subtitle="Sueldo indexado en USD · se paga en bolívares"
      actions={<React.Fragment><U.Btn variant="ghost" onClick={onClose}>Cancelar</U.Btn><U.Btn variant="primary" icon={I.check(14)} disabled={!valid} onClick={save}>{isEdit ? 'Guardar' : 'Registrar'}</U.Btn></React.Fragment>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div><Lbl>Nombre completo</Lbl><input value={f.name} onChange={(e) => set('name', e.target.value)} style={box} /></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div><Lbl>Cargo</Lbl><input value={f.cargo} onChange={(e) => set('cargo', e.target.value)} style={box} /></div>
          <div><Lbl>Departamento</Lbl><input value={f.dept} onChange={(e) => set('dept', e.target.value)} style={box} /></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div><Lbl>Cédula / RIF</Lbl><input value={f.cedula} onChange={(e) => set('cedula', e.target.value)} placeholder="V-00.000.000" style={{ ...box, fontFamily: 'var(--f-mono)' }} /></div>
          <div><Lbl>WhatsApp</Lbl><input value={f.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+58 412 0000000" style={{ ...box, fontFamily: 'var(--f-mono)' }} /></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'end' }}>
          <div><Lbl>Sueldo mensual (USD)</Lbl><window.ERPUI.CalcInput value={f.salarioUsd} onChange={(e) => set('salarioUsd', e.target.value)} placeholder="0" style={{ ...box, fontFamily: 'var(--f-mono)', fontWeight: 700, textAlign: 'right' }} /></div>
          {isEdit && (
            <div>
              <Lbl>Estado</Lbl>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[['Activo', true], ['Inactivo', false]].map(([l, v]) => (
                  <button key={l} onClick={() => setActive(v)} style={{ padding: '9px 8px', borderRadius: 'var(--r-md)', cursor: 'pointer', border: '1px solid ' + (active === v ? 'var(--wine)' : 'var(--border)'), background: active === v ? 'var(--wine-tint)' : 'var(--bg-surface)', color: active === v ? 'var(--wine)' : 'var(--ink)', font: `${active === v ? '700' : '500'} 12px/1 var(--f-sans)` }}>{l}</button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </U.Drawer>
  );
}

// ════════════════════════════════════════════════════════════════
// Comunicaciones (RRHH → empleado · le llega a su app)
// ════════════════════════════════════════════════════════════════
function ComunicacionesTab() {
  const U = window.ERPUI;
  const I = window.Icon;
  const N = window.NominaData;
  const [, force] = React.useReducer(x => x + 1, 0);
  React.useEffect(() => {
    const f = () => force();
    window.addEventListener('dtd-nomina-changed', f);
    return () => window.removeEventListener('dtd-nomina-changed', f);
  }, []);
  const [compose, setCompose] = React.useState(false);
  const [amon, setAmon] = React.useState(false);
  const comms = N.allComms();
  const typeBadge = (t) => { const c = N.COMM_TYPES[t] || {}; return <U.Badge tone={c.tone || 'neutral'} size="sm">{c.label || t}</U.Badge>; };
  const empName = (id) => { const e = N.EMPLOYEES.find(x => x.id === id); return e ? e.name : id; };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 16px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)' }}>
        <span style={{ font: '500 12px/1.5 var(--f-sans)', color: 'var(--ink-soft)' }}>
          Mensajes de RRHH que le llegan al empleado a su <b>app</b> (recibo, aviso, llamado de atención, amonestación). Puedes además reenviarlos por WhatsApp.
        </span>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <U.Btn variant="secondary" size="sm" icon={I.shield ? I.shield(12) : null} onClick={() => setAmon(true)}>Nueva amonestación</U.Btn>
          <U.Btn variant="primary" size="sm" icon={I.plus(12)} onClick={() => setCompose(true)}>Nueva comunicación</U.Btn>
        </div>
      </div>

      <U.Card padded={false}>
        <div style={{ display: 'grid', gridTemplateColumns: '150px 1.4fr 1fr 110px 110px', padding: '10px 18px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)', font: '700 10px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.08em', textTransform: 'uppercase', gap: 12 }}>
          <span>Tipo</span><span>Empleado · asunto</span><span>Fecha · emisor</span><span style={{ textAlign: 'center' }}>Estado</span><span></span>
        </div>
        {comms.map((c, i) => {
          const emp = N.EMPLOYEES.find(x => x.id === c.empId);
          return (
            <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '150px 1.4fr 1fr 110px 110px', padding: '11px 18px', alignItems: 'center', gap: 12, borderTop: i > 0 ? '1px solid var(--border)' : 0 }}>
              <span>{typeBadge(c.type)}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ font: '600 12.5px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{empName(c.empId)}</div>
                <div style={{ font: '500 11px/1.3 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</div>
              </div>
              <div>
                <div style={{ font: '500 11.5px/1.2 var(--f-mono)', color: 'var(--ink-soft)' }}>{c.date}</div>
                <div style={{ font: '500 10.5px/1.2 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 2 }}>{c.by}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                {c.ack ? <U.Badge tone="success" size="sm" dot>Confirmado</U.Badge> : c.read ? <U.Badge tone="info" size="sm" dot>Leído</U.Badge> : <U.Badge tone="neutral" size="sm" dot>Enviado</U.Badge>}
              </div>
              <div style={{ textAlign: 'right' }}>
                {emp && <U.Btn variant="ghost" size="sm" icon={I.chat ? I.chat(11) : I.mail(11)} onClick={() => window.open(N.commWaLink(emp, c.type, c.title, c.body), '_blank')}>WhatsApp</U.Btn>}
              </div>
            </div>
          );
        })}
      </U.Card>

      <ComposeComm open={compose} onClose={() => setCompose(false)} />
      <AmonestacionWizard open={amon} onClose={() => setAmon(false)} />
    </div>
  );
}

function ComposeComm({ open, onClose }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const N = window.NominaData;
  const activos = N.EMPLOYEES.filter(e => !e.inactive);
  const [empId, setEmpId] = React.useState(activos[0] ? activos[0].id : '');
  const [type, setType] = React.useState('aviso');
  const [title, setTitle] = React.useState('');
  const [body, setBody] = React.useState('');
  const [alsoWa, setAlsoWa] = React.useState(true);
  React.useEffect(() => { if (open) { setEmpId(activos[0] ? activos[0].id : ''); setType('aviso'); setTitle(''); setBody(''); setAlsoWa(true); } }, [open]);
  const emp = N.EMPLOYEES.find(e => e.id === empId);
  const valid = empId && title.trim() && body.trim();
  const send = () => {
    N.createComm({ empId, type, title: title.trim(), body: body.trim(), by: 'RRHH' });
    if (alsoWa && emp) window.open(N.commWaLink(emp, type, title.trim(), body.trim()), '_blank');
    onClose();
  };
  const box = { width: '100%', padding: '9px 11px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--ink)', font: '500 13px/1.4 var(--f-sans)' };
  const Lbl = ({ children }) => (<div style={{ font: '700 10px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>{children}</div>);
  return (
    <U.Drawer open={open} onClose={onClose} width={540} title="Nueva comunicación" subtitle="Le llega al empleado a su app · opcionalmente por WhatsApp"
      actions={<React.Fragment><U.Btn variant="ghost" onClick={onClose}>Cancelar</U.Btn><U.Btn variant="primary" icon={I.check(14)} disabled={!valid} onClick={send}>Enviar</U.Btn></React.Fragment>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div><Lbl>Empleado</Lbl><U.Select value={empId} onChange={(e) => setEmpId(e.target.value)} options={activos.map(e => ({ value: e.id, label: `${e.name} · ${e.cargo}` }))} /></div>
        <div>
          <Lbl>Tipo de comunicación</Lbl>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
            {Object.entries(N.COMM_TYPES).map(([k, v]) => {
              const on = type === k;
              return (
                <button key={k} onClick={() => setType(k)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 'var(--r-md)', cursor: 'pointer', textAlign: 'left', border: '1px solid ' + (on ? `var(--${v.tone})` : 'var(--border)'), background: on ? 'var(--bg-elevated)' : 'var(--bg-surface)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: 'var(--r-pill)', background: `var(--${v.tone})` }}></span>
                  <span style={{ font: `${on ? '700' : '500'} 12.5px/1 var(--f-sans)`, color: 'var(--ink)' }}>{v.label}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div><Lbl>Asunto</Lbl><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Inasistencia del 21/05" style={box} /></div>
        <div><Lbl>Mensaje</Lbl><textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} placeholder="Detalle de la comunicación…" style={{ ...box, resize: 'vertical', fontFamily: 'var(--f-sans)' }} /></div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)' }}>
          <input type="checkbox" checked={alsoWa} onChange={(e) => setAlsoWa(e.target.checked)} style={{ width: 16, height: 16, accentColor: 'var(--wine)' }} />
          <span style={{ font: '500 12.5px/1.3 var(--f-sans)', color: 'var(--ink)' }}>Además reenviar por WhatsApp ahora</span>
        </label>
      </div>
    </U.Drawer>
  );
}

// ════════════════════════════════════════════════════════════════
// Envío por WhatsApp
// ════════════════════════════════════════════════════════════════
function WhatsAppTab({ period, setP }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const N = window.NominaData;
  const R = window.ERPRates;
  const [preview, setPreview] = React.useState(null);
  const rate = Number(period.rate) || 1;
  const rows = N.payrollRows(period.bono);
  const ves = (usd) => 'Bs. ' + Math.round(usd * rate).toLocaleString('es-VE');

  const send = (emp) => window.open(N.waLink(emp, period.bono, rate, period.label), '_blank');
  const copy = (emp) => { try { navigator.clipboard.writeText(N.reciboWhatsApp(emp, period.bono, rate, period.label)); alert('Recibo copiado al portapapeles.'); } catch (e) { setPreview(emp); } };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)' }}>
        <span style={{ color: 'var(--success)' }}>{I.chat ? I.chat(16) : I.mail(16)}</span>
        <span style={{ font: '500 12px/1.5 var(--f-sans)', color: 'var(--ink-soft)' }}>
          Envía el recibo de pago a cada empleado por WhatsApp · período <b>{period.label}</b> · tasa BCV {rate.toFixed(2)}. El monto se muestra en bolívares. (Versión básica — luego sumamos más detalle.)
        </span>
      </div>

      <U.Card padded={false}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 130px 130px 1fr', padding: '10px 18px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)', font: '700 10px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.08em', textTransform: 'uppercase', gap: 12 }}>
          <span>Empleado</span><span>WhatsApp</span><span style={{ textAlign: 'right' }}>Neto Bs.</span><span style={{ textAlign: 'right' }}>Acción</span>
        </div>
        {rows.map((x, i) => (
          <div key={x.emp.id} style={{ display: 'grid', gridTemplateColumns: '1.3fr 130px 130px 1fr', padding: '11px 18px', alignItems: 'center', gap: 12, borderTop: i > 0 ? '1px solid var(--border)' : 0 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ font: '600 12.5px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{x.emp.name}</div>
              <div style={{ font: '500 10.5px/1.2 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 2 }}>{x.emp.cargo}</div>
            </div>
            <code style={{ font: '500 11px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>{x.emp.phone}</code>
            <span style={{ textAlign: 'right', font: '700 12px/1 var(--f-mono)', color: 'var(--wine)' }}>{ves(x.r.neto)}</span>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <U.Btn variant="ghost" size="sm" onClick={() => setPreview(x.emp)}>Ver</U.Btn>
              <U.Btn variant="secondary" size="sm" onClick={() => copy(x.emp)}>Copiar</U.Btn>
              <U.Btn variant="primary" size="sm" icon={I.chat ? I.chat(12) : I.mail(12)} onClick={() => send(x.emp)}>WhatsApp</U.Btn>
            </div>
          </div>
        ))}
      </U.Card>

      <U.Drawer open={!!preview} onClose={() => setPreview(null)} width={460} title={preview ? `Recibo · ${preview.name}` : ''} subtitle="Vista previa del mensaje de WhatsApp"
        actions={preview ? <React.Fragment><U.Btn variant="ghost" onClick={() => setPreview(null)}>Cerrar</U.Btn><U.Btn variant="primary" icon={I.chat ? I.chat(13) : I.mail(13)} onClick={() => send(preview)}>Abrir WhatsApp</U.Btn></React.Fragment> : null}>
        {preview && (
          <pre style={{ whiteSpace: 'pre-wrap', font: '500 12.5px/1.6 var(--f-mono)', color: 'var(--ink)', background: 'var(--bg-elevated)', padding: '16px 18px', borderRadius: 'var(--r-md)', margin: 0 }}>{N.reciboWhatsApp(preview, period.bono, rate, period.label)}</pre>
        )}
      </U.Drawer>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Reglas de cálculo · configuración que gobierna toda la nómina
// El sistema trae los parámetros ya cargados según la ley vigente.
// Si la ley cambia (o la empresa aplica otra política), se editan
// acá — sin que nadie tenga que saber la mecánica detrás.
// ════════════════════════════════════════════════════════════════
const reglasStyles = {
  section: { paddingTop: 18, borderTop: '1px solid var(--border)' },
  secTitle: { font: '800 13px/1.2 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.01em' },
  secHelp: { font: '500 11.5px/1.5 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 4, marginBottom: 14, maxWidth: '52ch' },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 },
  seg: { padding: '9px 8px', borderRadius: 'var(--r-md)', cursor: 'pointer', textAlign: 'center', transition: 'all var(--dur-fast) var(--ease)' },
};

function RuleSection({ title, help, children }) {
  return (
    <div style={reglasStyles.section}>
      <div style={reglasStyles.secTitle}>{title}</div>
      {help && <div style={reglasStyles.secHelp}>{help}</div>}
      <div style={reglasStyles.grid2}>{children}</div>
    </div>
  );
}

function RuleNum({ label, k, draft, set, def, suffix, hint }) {
  const changed = String(draft[k]) !== String(def[k]);
  return (
    <window.ERPUI.Input
      label={label}
      value={draft[k]}
      onChange={(e) => set(k, e.target.value)}
      suffix={suffix}
      mono calc
      hint={changed ? `Editado · ley: ${def[k]}${suffix ? ' ' + suffix : ''}` : hint}
    />
  );
}

function RuleSeg({ value, onChange, options }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${options.length}, 1fr)`, gap: 8 }}>
      {options.map(o => {
        const on = String(value) === String(o.value);
        return (
          <button key={String(o.value)} onClick={() => onChange(o.value)} style={{
            ...reglasStyles.seg,
            border: '1px solid ' + (on ? 'var(--wine)' : 'var(--border)'),
            background: on ? 'var(--wine-tint)' : 'var(--bg-surface)',
            color: on ? 'var(--wine)' : 'var(--ink)',
            font: `${on ? '700' : '500'} 12.5px/1.2 var(--f-sans)`,
          }}>{o.label}</button>
        );
      })}
    </div>
  );
}

function ReglasDrawer({ open, onClose }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const N = window.NominaData;
  const D = N.NOMINA_RULES_DEFAULTS;
  const [draft, setDraft] = React.useState(() => N.loadRules());
  React.useEffect(() => { if (open) setDraft(N.loadRules()); }, [open]);
  const set = (k, v) => setDraft(o => ({ ...o, [k]: v }));
  const changes = Object.keys(D).filter(k => String(draft[k]) !== String(D[k])).length;

  const save = () => { N.saveRules(draft); onClose(); };
  const restore = () => {
    if (!window.confirm('¿Restaurar todos los parámetros a los valores de ley por defecto?')) return;
    setDraft({ ...D });
  };

  const Lbl = ({ children }) => (<div style={{ font: '700 9px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 7 }}>{children}</div>);

  return (
    <U.Drawer open={open} onClose={onClose} width={680} title="Reglas de cálculo" subtitle="Parámetros que gobiernan toda la nómina · base LOTTT"
      actions={
        <React.Fragment>
          <U.Btn variant="ghost" icon={I.refresh ? I.refresh(13) : null} style={{ marginRight: 'auto' }} onClick={restore}>Restaurar valores de ley</U.Btn>
          <U.Btn variant="ghost" onClick={onClose}>Cancelar</U.Btn>
          <U.Btn variant="primary" icon={I.check(14)} onClick={save}>Guardar reglas</U.Btn>
        </React.Fragment>
      }>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>

        {/* Intro */}
        <div style={{ display: 'flex', gap: 12, padding: '14px 16px', borderRadius: 'var(--r-lg)', background: 'var(--info-bg)', marginBottom: 6 }}>
          <span style={{ color: 'var(--info)', flexShrink: 0, marginTop: 1 }}>{I.info ? I.info(18) : null}</span>
          <div>
            <div style={{ font: '700 12.5px/1.3 var(--f-sans)', color: 'var(--ink)' }}>El sistema ya trae las reglas configuradas según la ley vigente.</div>
            <div style={{ font: '500 11.5px/1.55 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 4 }}>
              Edita un valor solo si la ley cambió o tu empresa aplica otra política. Lo que toques acá recalcula toda la nómina. Cada corte que confirmes <b>congela</b> las reglas vigentes, así los recibos históricos no se mueven.
            </div>
          </div>
        </div>

        {/* Vigencia */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, alignItems: 'end', paddingTop: 14 }}>
          <U.Input label="Vigente desde" type="date" value={draft.vigencia} onChange={(e) => set('vigencia', e.target.value)} mono />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', height: 38 }}>
            {changes > 0
              ? <U.Badge tone="wine" size="sm" dot>{changes} parámetro{changes > 1 ? 's' : ''} fuera de la ley base</U.Badge>
              : <U.Badge tone="success" size="sm" dot>Igual a la ley base</U.Badge>}
          </div>
        </div>

        {/* 1 · Base de cálculo */}
        <RuleSection title="Base de cálculo"
          help="Cómo se pasa el sueldo mensual a diario y por hora. El estándar comercial usa 30 días por mes; “días reales” usa los días de cada mes (28–31).">
          <div style={{ gridColumn: '1 / -1' }}>
            <Lbl>Método de días del mes</Lbl>
            <RuleSeg value={draft.metodoDias} onChange={(v) => set('metodoDias', v)}
              options={[{ value: 30, label: '30 días (comercial)' }, { value: 'reales', label: 'Días reales del mes' }]} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <Lbl>Frecuencia de pago</Lbl>
            <RuleSeg value={draft.frecuenciaPago} onChange={(v) => set('frecuenciaPago', v)}
              options={[{ value: 'mensual', label: 'Mensual' }, { value: 'quincenal', label: 'Quincenal' }, { value: 'semanal', label: 'Semanal' }]} />
          </div>
          <RuleNum label="Jornada" k="jornadaHoras" draft={draft} set={set} def={D} suffix="h" hint="Horas por jornada" />
          <RuleNum label="Jornada semanal" k="horasSemana" draft={draft} set={set} def={D} suffix="h" hint="LOTTT · 44 h" />
        </RuleSection>

        {/* 2 · Parámetros del Estado */}
        <RuleSection title="Parámetros del Estado (Bs)"
          help="Montos fijados por decreto. Son los que más cambian: actualizalos cuando salga la Gaceta. El cestaticket y el bono de guerra son no salariales.">
          <RuleNum label="Salario mínimo" k="salarioMinimoBs" draft={draft} set={set} def={D} suffix="Bs" />
          <RuleNum label="Cestaticket" k="cestaticketBs" draft={draft} set={set} def={D} suffix="Bs" hint="No salarial" />
          <RuleNum label="Bono de guerra" k="bonoGuerraBs" draft={draft} set={set} def={D} suffix="Bs" hint="No salarial" />
        </RuleSection>

        {/* 3 · Deducciones del trabajador */}
        <RuleSection title="Deducciones del trabajador (%)"
          help="Aportes de ley que se le retienen al empleado. Aplican directo al cálculo del recibo. La base topa a los SM indicados (IVSS 5 · RPE 10), como manda la ley. Si tu empresa cotiza sobre el salario real, sube los topes (ej. 999 SM) y la retención se calcula sobre el sueldo completo — decisión del contador.">
          <RuleNum label="Seguro Social · IVSS" k="ssoPct" draft={draft} set={set} def={D} suffix="%" />
          <RuleNum label="Paro forzoso · RPE" k="rpePct" draft={draft} set={set} def={D} suffix="%" />
          <RuleNum label="Vivienda · FAOV" k="faovPct" draft={draft} set={set} def={D} suffix="%" />
          <RuleNum label="Tope IVSS" k="ssoTopeSM" draft={draft} set={set} def={D} suffix="SM" hint="En salarios mínimos" />
          <RuleNum label="Tope RPE" k="rpeTopeSM" draft={draft} set={set} def={D} suffix="SM" hint="En salarios mínimos" />
        </RuleSection>

        {/* 4 · Aportes patronales */}
        <RuleSection title="Aportes patronales (%)"
          help="Costo de la empresa (no se le descuenta al empleado). Informativo, para calcular el costo total de la nómina.">
          <RuleNum label="IVSS patronal" k="ssoPatronalPct" draft={draft} set={set} def={D} suffix="%" />
          <RuleNum label="RPE patronal" k="rpePatronalPct" draft={draft} set={set} def={D} suffix="%" />
          <RuleNum label="FAOV patronal" k="faovPatronalPct" draft={draft} set={set} def={D} suffix="%" />
          <RuleNum label="INCES" k="incesPct" draft={draft} set={set} def={D} suffix="%" />
        </RuleSection>

        {/* 5 · Horas extra y recargos */}
        <RuleSection title="Horas extra y recargos (%)"
          help="Recargos sobre la hora normal según LOTTT, y los topes legales de horas extra.">
          <RuleNum label="Hora extra diurna" k="recargoExtraDiurna" draft={draft} set={set} def={D} suffix="%" />
          <RuleNum label="Bono nocturno" k="recargoNocturno" draft={draft} set={set} def={D} suffix="%" />
          <RuleNum label="Feriado / descanso" k="recargoFeriado" draft={draft} set={set} def={D} suffix="%" />
          <RuleNum label="Tope extra / semana" k="topeExtraSemana" draft={draft} set={set} def={D} suffix="h" />
        </RuleSection>

        {/* 6 · Beneficios y provisiones */}
        <RuleSection title="Beneficios y provisiones (días)"
          help="Días que se provisionan por vacaciones, bono vacacional y utilidades.">
          <RuleNum label="Vacaciones · base" k="vacacionesDias" draft={draft} set={set} def={D} suffix="días" />
          <RuleNum label="Días adic. por año" k="vacacionesAdicXAnio" draft={draft} set={set} def={D} suffix="días" />
          <RuleNum label="Bono vacacional" k="bonoVacacionalDias" draft={draft} set={set} def={D} suffix="días" />
          <RuleNum label="Tope vacaciones" k="vacacionesTope" draft={draft} set={set} def={D} suffix="días" />
          <RuleNum label="Utilidades · mínimo" k="utilidadesDiasMin" draft={draft} set={set} def={D} suffix="días" />
          <RuleNum label="Utilidades · máximo" k="utilidadesDiasMax" draft={draft} set={set} def={D} suffix="días" />
        </RuleSection>

        {/* 7 · Prestaciones sociales */}
        <RuleSection title="Prestaciones sociales · Art. 142 LOTTT"
          help="Garantía trimestral, días adicionales por año, y qué método se usa para liquidar.">
          <RuleNum label="Garantía trimestral" k="garantiaTrimestralDias" draft={draft} set={set} def={D} suffix="días" />
          <RuleNum label="Días adic. por año" k="diasAdicXAnio" draft={draft} set={set} def={D} suffix="días" />
          <div style={{ gridColumn: '1 / -1' }}>
            <Lbl>Método de liquidación</Lbl>
            <RuleSeg value={draft.prestacionesMetodo} onChange={(v) => set('prestacionesMetodo', v)}
              options={[{ value: 'mayor', label: 'El mayor (Art. 142.d)' }, { value: 'garantia', label: 'Garantía' }, { value: 'retroactivo', label: 'Retroactivo' }]} />
            <div style={{ font: '500 11px/1.5 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 8 }}>
              “El mayor” compara el cálculo retroactivo contra la garantía acumulada y paga el más alto, como manda el literal d del Art. 142.
            </div>
          </div>
        </RuleSection>

        <div style={{ font: '500 11px/1.6 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
          Estos valores son la base que aplica el sistema. Ante una reforma o un caso particular, confirma con tu contador antes de cerrar la nómina o emitir una liquidación.
        </div>
      </div>
    </U.Drawer>
  );
}

// ════════════════════════════════════════════════════════════════
// Solicitudes · auto-registro de empleados con aprobación del admin
// ════════════════════════════════════════════════════════════════
function SolicitudesTab() {
  const U = window.ERPUI;
  const I = window.Icon;
  const N = window.NominaData;
  const [, force] = React.useReducer(x => x + 1, 0);
  React.useEffect(() => {
    const f = () => force();
    window.addEventListener('dtd-nomina-changed', f);
    window.addEventListener('storage', f);
    return () => { window.removeEventListener('dtd-nomina-changed', f); window.removeEventListener('storage', f); };
  }, []);

  const [review, setReview] = React.useState(null);
  const [newCargo, setNewCargo] = React.useState('');
  const [newDept, setNewDept] = React.useState('');
  const [copied, setCopied] = React.useState('');

  const links = N.regLinks().filter(l => l.active);
  const regs = N.allRegs();
  const pend = regs.filter(r => r.status === 'pendiente');
  const decided = regs.filter(r => r.status !== 'pendiente');

  const gen = () => { N.createRegLink({ cargo: newCargo.trim(), dept: newDept.trim() }); setNewCargo(''); setNewDept(''); };
  const copy = (token) => { try { const url = new URL(N.regLinkUrl(token), location.href).href; navigator.clipboard.writeText(url); setCopied(token); setTimeout(() => setCopied(''), 1600); } catch (e) {} };

  const box = { padding: '9px 11px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--ink)', font: '500 13px/1.2 var(--f-sans)', width: '100%', boxSizing: 'border-box' };
  const avatar = (reg, size) => reg.photo
    ? <img src={reg.photo} alt="" style={{ width: size, height: size, borderRadius: 'var(--r-pill)', objectFit: 'cover', flexShrink: 0 }} />
    : <span style={{ width: size, height: size, borderRadius: 'var(--r-pill)', background: 'var(--wine-tint)', color: 'var(--wine)', font: `700 ${Math.round(size / 2.6)}px/1 var(--f-sans)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{(reg.name || '··').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()}</span>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Generar link de invitación */}
      <U.Card padded>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ maxWidth: '46ch' }}>
            <div style={{ font: '800 14px/1.2 var(--f-display)', color: 'var(--ink)' }}>Link de invitación</div>
            <div style={{ font: '500 12px/1.55 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 5 }}>
              Genera un link y compártelo por WhatsApp. El empleado se registra solo desde su app; tú lo apruebas acá. Puedes prellenar el cargo para esa invitación.
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
            <div>
              <div style={{ font: '700 9px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 5 }}>Cargo (opcional)</div>
              <input value={newCargo} onChange={(e) => setNewCargo(e.target.value)} placeholder="Ej. Almacén" style={{ ...box, width: 160 }} />
            </div>
            <U.Btn variant="primary" icon={I.link ? I.link(14) : I.plus(14)} onClick={gen}>Generar link</U.Btn>
          </div>
        </div>

        {links.length > 0 && (
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {links.map(l => (
              <div key={l.token} style={{ display: 'grid', gridTemplateColumns: '150px 1fr 90px auto', gap: 12, alignItems: 'center', padding: '10px 14px', borderRadius: 'var(--r-md)', background: 'var(--bg-elevated)' }}>
                <code style={{ font: '700 12px/1 var(--f-mono)', color: 'var(--wine)' }}>{l.token}</code>
                <span style={{ font: '500 12px/1.2 var(--f-sans)', color: 'var(--ink-soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.cargo || 'Sin cargo asignado'}</span>
                <span style={{ font: '500 11px/1 var(--f-mono)', color: 'var(--ink-mute)' }}>{l.uses || 0} uso{(l.uses || 0) === 1 ? '' : 's'}</span>
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  <U.Btn variant="secondary" size="sm" icon={I.copy ? I.copy(12) : null} onClick={() => copy(l.token)}>{copied === l.token ? 'Copiado' : 'Copiar link'}</U.Btn>
                  <U.Btn variant="ghost" size="sm" onClick={() => { if (window.confirm('¿Revocar este link de invitación?')) N.revokeRegLink(l.token); }}>Revocar</U.Btn>
                </div>
              </div>
            ))}
          </div>
        )}
      </U.Card>

      {/* Pendientes de aprobación */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <span className="eyebrow eyebrow-wine">PENDIENTES DE APROBACIÓN</span>
          {pend.length > 0 && <U.Badge tone="warning" size="sm">{pend.length}</U.Badge>}
        </div>
        {pend.length === 0 ? (
          <U.Card padded>
            <div style={{ textAlign: 'center', padding: '24px 16px', color: 'var(--ink-mute)' }}>
              <div style={{ font: '600 13px/1.3 var(--f-sans)', color: 'var(--ink-soft)' }}>No hay solicitudes pendientes</div>
              <div style={{ font: '500 11.5px/1.5 var(--f-sans)', marginTop: 5 }}>Cuando alguien se registre desde el link, lo vas a ver acá para aprobar.</div>
            </div>
          </U.Card>
        ) : (
          <U.Card padded={false}>
            {pend.map((r, i) => (
              <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '44px 1.5fr 1fr 130px 110px', gap: 14, alignItems: 'center', padding: '13px 18px', borderTop: i > 0 ? '1px solid var(--border)' : 0 }}>
                {avatar(r, 38)}
                <div style={{ minWidth: 0 }}>
                  <div style={{ font: '600 13px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{r.name}</div>
                  <div style={{ font: '500 11px/1.2 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 2 }}>{r.cargo}{r.token ? ` · ${r.token}` : ' · registro directo'}</div>
                </div>
                <code style={{ font: '500 11px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>{r.cedula}</code>
                <span style={{ font: '500 11px/1 var(--f-mono)', color: 'var(--ink-mute)' }}>{r.createdAt}</span>
                <div style={{ textAlign: 'right' }}>
                  <U.Btn variant="primary" size="sm" onClick={() => setReview(r.id)}>Revisar</U.Btn>
                </div>
              </div>
            ))}
          </U.Card>
        )}
      </div>

      {/* Resueltas */}
      {decided.length > 0 && (
        <div>
          <div className="eyebrow eyebrow-wine" style={{ marginBottom: 10 }}>RESUELTAS</div>
          <U.Card padded={false}>
            {decided.map((r, i) => (
              <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '44px 1.5fr 1fr 130px 110px', gap: 14, alignItems: 'center', padding: '11px 18px', borderTop: i > 0 ? '1px solid var(--border)' : 0, opacity: r.status === 'rechazado' ? 0.7 : 1 }}>
                {avatar(r, 32)}
                <div style={{ minWidth: 0 }}>
                  <div style={{ font: '600 12.5px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{r.name}</div>
                  <div style={{ font: '500 11px/1.2 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 2 }}>{r.cargo}{r.status === 'aprobado' && r.salarioUsd ? ` · ${window.ERPRates.fmtUsd(r.salarioUsd)}` : ''}</div>
                </div>
                <span style={{ font: '500 11px/1.3 var(--f-sans)', color: 'var(--ink-mute)' }}>{r.status === 'rechazado' && r.motivo ? r.motivo : ''}</span>
                <span style={{ font: '500 11px/1 var(--f-mono)', color: 'var(--ink-mute)' }}>{r.decidedAt || ''}</span>
                <div style={{ textAlign: 'right' }}>
                  {r.status === 'aprobado' ? <U.Badge tone="success" size="sm" dot>Aprobado</U.Badge> : <U.Badge tone="danger" size="sm" dot>Rechazado</U.Badge>}
                </div>
              </div>
            ))}
          </U.Card>
        </div>
      )}

      <RegistroReviewDrawer regId={review} onClose={() => setReview(null)} />
    </div>
  );
}

function RegistroReviewDrawer({ regId, onClose }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const N = window.NominaData;
  const R = window.ERPRates;
  const reg = regId ? N.regById(regId) : null;
  const [sueldo, setSueldo] = React.useState('');
  const [dept, setDept] = React.useState('');
  const [rejecting, setRejecting] = React.useState(false);
  const [motivo, setMotivo] = React.useState('');
  React.useEffect(() => { if (reg) { setSueldo(''); setDept(reg.dept || ''); setRejecting(false); setMotivo(''); } }, [regId]);

  const approve = () => {
    if (!(Number(sueldo) > 0)) { alert('Asigna un sueldo mensual en USD para aprobar.'); return; }
    N.approveRegistration(reg.id, { salarioUsd: Number(sueldo), dept });
    onClose();
  };
  const reject = () => { N.rejectRegistration(reg.id, motivo.trim()); onClose(); };

  const box = { width: '100%', padding: '9px 11px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--ink)', font: '500 13px/1.3 var(--f-sans)', boxSizing: 'border-box' };
  const Row = ({ label, value, mono }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '10px 0', borderTop: '1px solid var(--border)' }}>
      <span style={{ font: '500 12px/1.3 var(--f-sans)', color: 'var(--ink-soft)' }}>{label}</span>
      <span style={{ font: `600 12.5px/1.3 ${mono ? 'var(--f-mono)' : 'var(--f-sans)'}`, color: 'var(--ink)', textAlign: 'right' }}>{value || '—'}</span>
    </div>
  );

  return (
    <U.Drawer open={!!reg} onClose={onClose} width={560} title={reg ? `Revisar · ${reg.name}` : ''} subtitle="Aprobá para crear la ficha y el acceso del empleado"
      actions={reg ? (
        rejecting ? (
          <React.Fragment>
            <U.Btn variant="ghost" style={{ marginRight: 'auto' }} onClick={() => setRejecting(false)}>Volver</U.Btn>
            <U.Btn variant="danger" icon={I.close(14)} onClick={reject}>Confirmar rechazo</U.Btn>
          </React.Fragment>
        ) : (
          <React.Fragment>
            <U.Btn variant="ghost" style={{ marginRight: 'auto', color: 'var(--danger)' }} onClick={() => setRejecting(true)}>Rechazar</U.Btn>
            <U.Btn variant="ghost" onClick={onClose}>Cancelar</U.Btn>
            <U.Btn variant="primary" icon={I.check(14)} onClick={approve}>Aprobar y crear empleado</U.Btn>
          </React.Fragment>
        )
      ) : null}>
      {reg && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {reg.photo
              ? <img src={reg.photo} alt="" style={{ width: 56, height: 56, borderRadius: 'var(--r-pill)', objectFit: 'cover' }} />
              : <span style={{ width: 56, height: 56, borderRadius: 'var(--r-pill)', background: 'var(--wine-tint)', color: 'var(--wine)', font: '700 20px/1 var(--f-display)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{(reg.name || '··').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()}</span>}
            <div>
              <div style={{ font: '800 17px/1.1 var(--f-display)', color: 'var(--ink)' }}>{reg.name}</div>
              <div style={{ font: '500 12.5px/1.3 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 3 }}>{reg.cargo}{reg.token ? ` · invitación ${reg.token}` : ' · registro directo'}</div>
            </div>
          </div>

          <div style={{ marginTop: 20 }}>
            <Row label="Cédula" value={reg.cedula} mono />
            <Row label="Fecha de nacimiento" value={reg.birth} mono />
            <Row label="Fecha de inicio" value={reg.startDate} mono />
            <Row label="WhatsApp" value={reg.phone} mono />
            <Row label="Correo" value={reg.email} />
            <Row label="Banco" value={reg.banco} />
            <Row label="Cuenta" value={`${reg.tipoCuenta} · ${reg.cuenta}`} mono />
            <Row label="Enviado" value={reg.createdAt} mono />
          </div>

          {!rejecting ? (
            <div style={{ marginTop: 22, padding: '16px', borderRadius: 'var(--r-lg)', background: 'var(--bg-elevated)' }}>
              <div style={{ font: '700 11px/1 var(--f-sans)', color: 'var(--wine)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>Datos que define la empresa</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div style={{ font: '700 9px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Sueldo mensual (USD)</div>
                  <window.ERPUI.CalcInput value={sueldo} onChange={(e) => setSueldo(e.target.value)} placeholder="0" style={{ ...box, fontFamily: 'var(--f-mono)', fontWeight: 700, textAlign: 'right' }} />
                </div>
                <div>
                  <div style={{ font: '700 9px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Departamento</div>
                  <input value={dept} onChange={(e) => setDept(e.target.value)} placeholder="Ej. Almacén" style={box} />
                </div>
              </div>
              <div style={{ font: '500 11px/1.5 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 10 }}>
                Al aprobar se crea la ficha y el login del empleado, y le llega un mensaje de bienvenida a su app.
              </div>
            </div>
          ) : (
            <div style={{ marginTop: 22, padding: '16px', borderRadius: 'var(--r-lg)', background: 'var(--danger-bg)' }}>
              <div style={{ font: '700 11px/1 var(--f-sans)', color: 'var(--danger)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>Motivo del rechazo</div>
              <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} placeholder="Opcional · queda registrado en la solicitud" style={{ ...box, resize: 'vertical', fontFamily: 'var(--f-sans)' }} />
            </div>
          )}
        </div>
      )}
    </U.Drawer>
  );
}

// ════════════════════════════════════════════════════════════════
// Préstamos · descuento automático en nómina
// ════════════════════════════════════════════════════════════════
function PrestamosTab() {
  const U = window.ERPUI;
  const I = window.Icon;
  const N = window.NominaData;
  const R = window.ERPRates;
  const [, force] = React.useReducer(x => x + 1, 0);
  React.useEffect(() => {
    const f = () => force();
    window.addEventListener('dtd-nomina-changed', f);
    return () => window.removeEventListener('dtd-nomina-changed', f);
  }, []);
  const [nuevo, setNuevo] = React.useState(false);
  const [pago, setPago] = React.useState(null);

  const loans = N.allLoans();
  const activos = loans.filter(l => l.status === 'activo');
  const empName = (id) => { const e = N.EMPLOYEES.find(x => x.id === id); return e ? e.name : id; };
  const empCargo = (id) => { const e = N.EMPLOYEES.find(x => x.id === id); return e ? e.cargo : ''; };
  const totPrestado = activos.reduce((s, l) => s + Number(l.monto), 0);
  const totSaldo = activos.reduce((s, l) => s + N.loanBalance(l), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        <U.KPI label="Préstamos activos" value={activos.length} delta="con saldo" tone="wine" icon={I.cash ? I.cash(18) : I.invoice(18)} />
        <U.KPI label="Total prestado" value={R.fmtUsd(totPrestado)} delta="capital vigente" tone="info" icon={I.wallet ? I.wallet(18) : I.invoice(18)} />
        <U.KPI label="Saldo por recuperar" value={R.fmtUsd(totSaldo)} delta="se descuenta en nómina" tone="warning" icon={I.invoice(18)} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '11px 16px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)' }}>
        <span style={{ font: '500 12px/1.5 var(--f-sans)', color: 'var(--ink-soft)' }}>
          La cuota se descuenta <b>automáticamente</b> del recibo de cada empleado hasta saldar el préstamo. El empleado ve el saldo en su app.
        </span>
        <U.Btn variant="primary" size="sm" icon={I.plus(12)} onClick={() => setNuevo(true)}>Nuevo préstamo</U.Btn>
      </div>

      {loans.length === 0 ? (
        <U.Card padded>
          <div style={{ textAlign: 'center', padding: '28px 16px', color: 'var(--ink-mute)' }}>
            <div style={{ font: '600 13px/1.3 var(--f-sans)', color: 'var(--ink-soft)' }}>Sin préstamos registrados</div>
            <div style={{ font: '500 11.5px/1.5 var(--f-sans)', marginTop: 5 }}>Registra un adelanto o préstamo y la cuota se descontará sola en cada nómina.</div>
          </div>
        </U.Card>
      ) : (
        <U.Card padded={false}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 100px 100px 1fr 110px 150px', padding: '10px 18px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)', font: '700 10px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.08em', textTransform: 'uppercase', gap: 12 }}>
            <span>Empleado</span><span style={{ textAlign: 'right' }}>Monto</span><span style={{ textAlign: 'right' }}>Cuota</span><span>Saldo</span><span style={{ textAlign: 'center' }}>Estado</span><span></span>
          </div>
          {loans.map((l, i) => {
            const saldo = N.loanBalance(l);
            const pct = Number(l.monto) > 0 ? Math.min(100, Math.round((Number(l.pagado || 0) / Number(l.monto)) * 100)) : 0;
            return (
              <div key={l.id} style={{ display: 'grid', gridTemplateColumns: '1.4fr 100px 100px 1fr 110px 150px', padding: '12px 18px', alignItems: 'center', gap: 12, borderTop: i > 0 ? '1px solid var(--border)' : 0, opacity: l.status === 'saldado' ? 0.6 : 1 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ font: '600 12.5px/1.2 var(--f-sans)', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{empName(l.empId)}</div>
                  <div style={{ font: '500 10.5px/1.2 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 2 }}>{l.motivo || empCargo(l.empId)}</div>
                </div>
                <span style={{ textAlign: 'right', font: '700 12px/1 var(--f-mono)', color: 'var(--ink)' }}>{R.fmtUsd(l.monto)}</span>
                <span style={{ textAlign: 'right', font: '600 11.5px/1 var(--f-mono)', color: 'var(--wine)' }}>{R.fmtUsd(l.cuota)}</span>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', font: '600 11px/1 var(--f-mono)', color: 'var(--ink-soft)', marginBottom: 5 }}><span>{R.fmtUsd(saldo)}</span><span style={{ color: 'var(--ink-mute)' }}>{pct}%</span></div>
                  <div style={{ height: 5, borderRadius: 'var(--r-pill)', background: 'var(--bg-elevated)', overflow: 'hidden' }}><div style={{ width: pct + '%', height: '100%', background: l.status === 'saldado' ? 'var(--success)' : 'var(--wine)' }} /></div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  {l.status === 'saldado' ? <U.Badge tone="success" size="sm" dot>Saldado</U.Badge> : <U.Badge tone="wine" size="sm" dot>Activo</U.Badge>}
                </div>
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  {l.status === 'activo' && <U.Btn variant="secondary" size="sm" onClick={() => setPago(l)}>Registrar pago</U.Btn>}
                </div>
              </div>
            );
          })}
        </U.Card>
      )}

      <NuevoPrestamoDrawer open={nuevo} onClose={() => setNuevo(false)} />
      <PagoPrestamoModal loan={pago} onClose={() => setPago(null)} />
    </div>
  );
}

function NuevoPrestamoDrawer({ open, onClose }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const N = window.NominaData;
  const activos = N.EMPLOYEES.filter(e => !e.inactive);
  const [empId, setEmpId] = React.useState(activos[0] ? activos[0].id : '');
  const [monto, setMonto] = React.useState('');
  const [cuota, setCuota] = React.useState('');
  const [motivo, setMotivo] = React.useState('');
  React.useEffect(() => { if (open) { setEmpId(activos[0] ? activos[0].id : ''); setMonto(''); setCuota(''); setMotivo(''); } }, [open]);
  const valid = empId && Number(monto) > 0 && Number(cuota) > 0;
  const cuotas = Number(monto) > 0 && Number(cuota) > 0 ? Math.ceil(Number(monto) / Number(cuota)) : 0;
  const save = () => { N.createLoan({ empId, monto: Number(monto), cuota: Number(cuota), motivo: motivo.trim() }); onClose(); };
  const box = { width: '100%', padding: '9px 11px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--ink)', font: '500 13px/1.3 var(--f-sans)', boxSizing: 'border-box' };
  const mono = { ...box, fontFamily: 'var(--f-mono)', fontWeight: 700, textAlign: 'right' };
  const Lbl = ({ children }) => (<div style={{ font: '700 10px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>{children}</div>);
  return (
    <U.Drawer open={open} onClose={onClose} width={520} title="Nuevo préstamo" subtitle="La cuota se descuenta automáticamente de la nómina"
      actions={<React.Fragment><U.Btn variant="ghost" onClick={onClose}>Cancelar</U.Btn><U.Btn variant="primary" icon={I.check(14)} disabled={!valid} onClick={save}>Registrar préstamo</U.Btn></React.Fragment>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div><Lbl>Empleado</Lbl><U.Select value={empId} onChange={(e) => setEmpId(e.target.value)} options={activos.map(e => ({ value: e.id, label: `${e.name} · ${e.cargo}` }))} /></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div><Lbl>Monto del préstamo (USD)</Lbl><U.CalcInput value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0" style={mono} /></div>
          <div><Lbl>Cuota por pago (USD)</Lbl><U.CalcInput value={cuota} onChange={(e) => setCuota(e.target.value)} placeholder="0" style={mono} /></div>
        </div>
        <div><Lbl>Motivo</Lbl><input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej. Adelanto personal" style={box} /></div>
        {cuotas > 0 && (
          <div style={{ padding: '12px 14px', borderRadius: 'var(--r-md)', background: 'var(--bg-elevated)', font: '500 12px/1.5 var(--f-sans)', color: 'var(--ink-soft)' }}>
            Se descontará <b style={{ color: 'var(--wine)' }}>{window.ERPRates.fmtUsd(Number(cuota))}</b> por pago durante <b style={{ color: 'var(--ink)' }}>{cuotas} cuota{cuotas > 1 ? 's' : ''}</b> hasta saldar {window.ERPRates.fmtUsd(Number(monto))}.
          </div>
        )}
      </div>
    </U.Drawer>
  );
}

function PagoPrestamoModal({ loan, onClose }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const N = window.NominaData;
  const R = window.ERPRates;
  const [amount, setAmount] = React.useState('');
  React.useEffect(() => { if (loan) setAmount(String(Math.min(Number(loan.cuota), N.loanBalance(loan)))); }, [loan && loan.id]);
  if (!loan) return null;
  const saldo = N.loanBalance(loan);
  const emp = N.EMPLOYEES.find(e => e.id === loan.empId);
  const reg = () => { N.registerLoanPayment(loan.id, Number(amount)); onClose(); };
  const box = { width: '100%', padding: '10px 12px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--ink)', font: '700 14px/1 var(--f-mono)', textAlign: 'right', boxSizing: 'border-box' };
  return (
    <U.Modal open={!!loan} onClose={onClose} title="Registrar pago" width={420}
      actions={<React.Fragment><U.Btn variant="ghost" onClick={onClose}>Cancelar</U.Btn><U.Btn variant="primary" icon={I.check(14)} disabled={!(Number(amount) > 0)} onClick={reg}>Registrar</U.Btn></React.Fragment>}>
      <div style={{ font: '500 12.5px/1.5 var(--f-sans)', color: 'var(--ink-soft)', marginBottom: 14 }}>
        {emp ? emp.name : ''} · saldo actual <b style={{ color: 'var(--ink)' }}>{R.fmtUsd(saldo)}</b>
      </div>
      <div style={{ font: '700 10px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Monto del pago (USD)</div>
      <U.CalcInput value={amount} onChange={(e) => setAmount(e.target.value)} style={box} />
      <div style={{ font: '500 11px/1.5 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 10 }}>Normalmente esto ocurre solo al confirmar la nómina; puedes registrar un pago manual acá.</div>
    </U.Modal>
  );
}

// ════════════════════════════════════════════════════════════════
// Liquidación · legal vs contingente
// ════════════════════════════════════════════════════════════════
function LiquidacionTab() {
  const U = window.ERPUI;
  const I = window.Icon;
  const N = window.NominaData;
  const R = window.ERPRates;
  const [rates] = R.useRates();
  const activos = N.EMPLOYEES.filter(e => !e.inactive);
  const [empId, setEmpId] = React.useState(activos[0] ? activos[0].id : '');
  const [causa, setCausa] = React.useState('art76');
  const [fecha, setFecha] = React.useState('2026-05-31');
  const [bonoVol, setBonoVol] = React.useState(40);
  const [finiquito, setFiniquito] = React.useState(false);

  const emp = N.EMPLOYEES.find(e => e.id === empId) || activos[0];
  if (!emp) return <U.Card padded><div style={{ padding: 24, color: 'var(--ink-mute)' }}>No hay empleados activos.</div></U.Card>;
  const L = N.calcLiquidacion(emp, { causa, fechaEgreso: fecha, bonoVoluntario: bonoVol, rate: rates.bcv });
  const ves = (usd) => 'Bs. ' + Math.round(usd * rates.bcv).toLocaleString('es-VE');

  const box = { padding: '9px 11px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--ink)', font: '600 13px/1 var(--f-sans)', width: '100%', boxSizing: 'border-box' };
  const Lbl = ({ children }) => (<div style={{ font: '700 9px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 5 }}>{children}</div>);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Controles */}
      <U.Card padded>
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1.2fr 130px 120px', gap: 14, alignItems: 'end' }}>
          <div><Lbl>Empleado</Lbl><U.Select value={empId} onChange={(e) => setEmpId(e.target.value)} options={activos.map(e => ({ value: e.id, label: `${e.name} · ${e.cargo}` }))} /></div>
          <div><Lbl>Causa de egreso</Lbl><U.Select value={causa} onChange={(e) => setCausa(e.target.value)} options={Object.entries(N.LIQ_CAUSAS).map(([k, v]) => ({ value: k, label: `${v.label} · ${v.art}` }))} /></div>
          <div><Lbl>Fecha de egreso</Lbl><input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} style={{ ...box, fontFamily: 'var(--f-mono)' }} /></div>
          <div><Lbl>Bono voluntario (USD)</Lbl><U.CalcInput value={bonoVol} onChange={(e) => setBonoVol(e.target.value)} style={{ ...box, fontFamily: 'var(--f-mono)', fontWeight: 700, textAlign: 'right' }} /></div>
        </div>
        <div style={{ display: 'flex', gap: 24, marginTop: 14, font: '500 12px/1.4 var(--f-sans)', color: 'var(--ink-soft)' }}>
          <span>Antigüedad: <b style={{ color: 'var(--ink)' }}>{L.fullYears} a {L.fracMonths} m</b></span>
          <span>Salario base: <b style={{ color: 'var(--ink)' }}>{R.fmtUsd(L.baseMensual)}/mes</b></span>
          <span>Ingreso real: <b style={{ color: 'var(--ink)' }}>{R.fmtUsd(L.realMensual)}/mes</b></span>
        </div>
      </U.Card>

      {/* Tres cifras */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
        <U.KPI label="Liquidación legal" value={R.fmtUsd(L.netoLegal)} delta="sobre salario base" tone="info" icon={I.shield(18)} />
        <U.KPI label="Liquidación contingente" value={R.fmtUsd(L.netoCont)} delta="sobre ingreso real" tone="warning" icon={I.warn ? I.warn(18) : I.shield(18)} />
        <div style={{ padding: 'var(--s-5)', borderRadius: 'var(--r-lg)', background: 'var(--bg-sidebar)', color: '#fff' }}>
          <div style={{ font: '700 10px/1 var(--f-sans)', color: 'rgba(255,255,255,0.6)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Exposición oculta</div>
          <div style={{ font: '900 26px/1 var(--f-display)', marginTop: 10 }}>{R.fmtUsd(L.exposicion)}</div>
          <div style={{ font: '500 11px/1.4 var(--f-sans)', color: 'rgba(255,255,255,0.65)', marginTop: 6 }}>diferencia si un tribunal reclasifica los bonos como salario</div>
        </div>
      </div>

      {/* Desglose */}
      <U.Card padded={false}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 90px 1fr 1fr', padding: '10px 18px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)', font: '700 10px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.08em', textTransform: 'uppercase', gap: 12 }}>
          <span>Concepto</span><span style={{ textAlign: 'right' }}>Días</span><span style={{ textAlign: 'right' }}>Legal (base)</span><span style={{ textAlign: 'right' }}>Contingente (real)</span>
        </div>
        {L.rows.map((r, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.6fr 90px 1fr 1fr', padding: '11px 18px', alignItems: 'center', gap: 12, borderTop: i > 0 ? '1px solid var(--border)' : 0 }}>
            <div>
              <div style={{ font: '600 12.5px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{r.concepto}</div>
              <div style={{ font: '500 10.5px/1.2 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 2 }}>{r.sub}</div>
            </div>
            <span style={{ textAlign: 'right', font: '500 11.5px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>{r.dias.toFixed(1)}</span>
            <span style={{ textAlign: 'right', font: '600 12px/1 var(--f-mono)', color: 'var(--ink)' }}>{R.fmtUsd(r.legal)}</span>
            <span style={{ textAlign: 'right', font: '600 12px/1 var(--f-mono)', color: 'var(--warning)' }}>{R.fmtUsd(r.cont)}</span>
          </div>
        ))}
        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 90px 1fr 1fr', padding: '12px 18px', alignItems: 'center', gap: 12, borderTop: '2px solid var(--ink)', background: 'var(--bg-elevated)' }}>
          <span style={{ font: '700 11px/1 var(--f-sans)', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-soft)' }}>Subtotal</span>
          <span></span>
          <span style={{ textAlign: 'right', font: '800 13px/1 var(--f-mono)', color: 'var(--ink)' }}>{R.fmtUsd(L.totLegal)}</span>
          <span style={{ textAlign: 'right', font: '800 13px/1 var(--f-mono)', color: 'var(--warning)' }}>{R.fmtUsd(L.totCont)}</span>
        </div>
        {L.prestamos > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 90px 1fr 1fr', padding: '11px 18px', alignItems: 'center', gap: 12, borderTop: '1px solid var(--border)' }}>
            <span style={{ font: '500 12px/1.2 var(--f-sans)', color: 'var(--ink-soft)' }}>(−) Préstamos pendientes</span>
            <span></span>
            <span style={{ textAlign: 'right', font: '600 12px/1 var(--f-mono)', color: 'var(--danger)' }}>−{R.fmtUsd(L.prestamos)}</span>
            <span style={{ textAlign: 'right', font: '600 12px/1 var(--f-mono)', color: 'var(--danger)' }}>−{R.fmtUsd(L.prestamos)}</span>
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 90px 1fr 1fr', padding: '13px 18px', alignItems: 'center', gap: 12, borderTop: '1px solid var(--border)', background: 'var(--bg-sidebar)', color: '#fff' }}>
          <span style={{ font: '700 11px/1 var(--f-sans)', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)' }}>Neto a liquidar</span>
          <span></span>
          <span style={{ textAlign: 'right', font: '900 14px/1 var(--f-mono)' }}>{R.fmtUsd(L.netoLegal)}</span>
          <span style={{ textAlign: 'right', font: '900 14px/1 var(--f-mono)', color: 'var(--wine-soft)' }}>{R.fmtUsd(L.netoCont)}</span>
        </div>
      </U.Card>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ font: '500 11.5px/1.5 var(--f-sans)', color: 'var(--ink-mute)', maxWidth: '64ch' }}>
          Estimación según los parámetros de <b>Reglas de cálculo</b>. La liquidación final debe confirmarse con tu contador antes de emitir el finiquito.
        </div>
        <U.Btn variant="primary" icon={I.doc ? I.doc(14) : null} onClick={() => setFiniquito(true)}>Generar finiquito</U.Btn>
      </div>

      <FiniquitoModal open={finiquito} onClose={() => setFiniquito(false)} emp={emp} L={L} fecha={fecha} ves={ves} />
    </div>
  );
}

function FiniquitoModal({ open, onClose, emp, L, fecha, ves }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const R = window.ERPRates;
  const text = () => {
    const lines = [
      'DTD Cargo · Finiquito de prestaciones',
      `Empleado: ${emp.name} — ${emp.cargo}`,
      `Cédula: ${emp.cedula}`,
      `Causa de egreso: ${L.causa.label} (${L.causa.art})`,
      `Fecha de egreso: ${fecha}`,
      `Antigüedad: ${L.fullYears} años ${L.fracMonths} meses`,
      '',
      ...L.rows.map(r => `${r.concepto}: ${R.fmtUsd(r.legal)} (legal) · ${R.fmtUsd(r.cont)} (real)`),
      '',
      `Subtotal legal: ${R.fmtUsd(L.totLegal)}`,
      `Subtotal contingente: ${R.fmtUsd(L.totCont)}`,
      L.prestamos > 0 ? `(−) Préstamos: ${R.fmtUsd(L.prestamos)}` : '',
      `Neto a liquidar (legal): ${R.fmtUsd(L.netoLegal)} · ${ves(L.netoLegal)}`,
      `Exposición contingente: ${R.fmtUsd(L.exposicion)}`,
    ].filter(Boolean);
    return lines.join('\n');
  };
  const copy = () => { try { navigator.clipboard.writeText(text()); } catch (e) {} onClose(); };
  const pdf = () => { window.NominaData.printDoc(window.NominaData.finiquitoHtml(emp, L, fecha, window.ERPRates.read().bcv)); };
  return (
    <U.Modal open={open} onClose={onClose} title="Finiquito" width={520}
      actions={<React.Fragment><U.Btn variant="ghost" onClick={onClose}>Cerrar</U.Btn><U.Btn variant="secondary" icon={I.copy ? I.copy(13) : null} onClick={copy}>Copiar texto</U.Btn><U.Btn variant="primary" icon={I.download ? I.download(13) : null} onClick={pdf}>Descargar PDF</U.Btn></React.Fragment>}>
      <pre style={{ whiteSpace: 'pre-wrap', font: '500 12px/1.6 var(--f-mono)', color: 'var(--ink)', background: 'var(--bg-elevated)', padding: '16px 18px', borderRadius: 'var(--r-md)', margin: 0, maxHeight: 420, overflowY: 'auto' }}>{text()}</pre>
    </U.Modal>
  );
}

// ════════════════════════════════════════════════════════════════
// Amonestación · asistente por pasos (causa Art. 79 → relato → testigos)
// ════════════════════════════════════════════════════════════════
const AMON_CAUSAS = [
  { value: 'a', label: 'Falta de probidad o conducta inmoral en el trabajo' },
  { value: 'b', label: 'Vías de hecho (salvo en legítima defensa)' },
  { value: 'c', label: 'Injuria o falta grave al respeto y consideración' },
  { value: 'd', label: 'Hecho intencional o negligencia que afecte la seguridad e higiene' },
  { value: 'f', label: 'Inasistencia injustificada (3 días hábiles en un mes)' },
  { value: 'g', label: 'Perjuicio material por dolo o negligencia grave' },
  { value: 'i', label: 'Falta grave a las obligaciones del contrato de trabajo' },
  { value: 'j', label: 'Abandono del trabajo' },
];

function AmonestacionWizard({ open, onClose }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const N = window.NominaData;
  const activos = N.EMPLOYEES.filter(e => !e.inactive);
  const [step, setStep] = React.useState(0);
  const [empId, setEmpId] = React.useState(activos[0] ? activos[0].id : '');
  const [causa, setCausa] = React.useState('f');
  const [fecha, setFecha] = React.useState('2026-05-31');
  const [relato, setRelato] = React.useState('');
  const [t1, setT1] = React.useState({ nombre: '', cedula: '' });
  const [t2, setT2] = React.useState({ nombre: '', cedula: '' });
  const [alsoWa, setAlsoWa] = React.useState(true);

  React.useEffect(() => { if (open) { setStep(0); setEmpId(activos[0] ? activos[0].id : ''); setCausa('f'); setFecha('2026-05-31'); setRelato(''); setT1({ nombre: '', cedula: '' }); setT2({ nombre: '', cedula: '' }); setAlsoWa(true); } }, [open]);

  const emp = N.EMPLOYEES.find(e => e.id === empId);
  const causaObj = AMON_CAUSAS.find(c => c.value === causa) || AMON_CAUSAS[0];
  const stepValid = [
    !!(empId && causa && fecha),
    !!relato.trim(),
    !!t1.nombre.trim(),
    true,
  ][step];

  const bodyText = () => {
    const L = [
      `Causa (Art. 79 LOTTT): ${causaObj.label}`,
      `Fecha del hecho: ${fecha}`,
      '',
      relato.trim(),
      '',
      'Testigos:',
      `1. ${t1.nombre.trim()}${t1.cedula.trim() ? ' — ' + t1.cedula.trim() : ''}`,
    ];
    if (t2.nombre.trim()) L.push(`2. ${t2.nombre.trim()}${t2.cedula.trim() ? ' — ' + t2.cedula.trim() : ''}`);
    return L.join('\n');
  };
  const title = `Amonestación · ${causaObj.label.split('(')[0].trim().slice(0, 40)}`;

  const emit = () => {
    N.createComm({ empId, type: 'amonestacion', title, body: bodyText(), by: 'RRHH · Amonestación' });
    if (alsoWa && emp) window.open(N.commWaLink(emp, 'amonestacion', title, bodyText()), '_blank');
    onClose();
  };

  const box = { width: '100%', padding: '10px 12px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--ink)', font: '500 13px/1.4 var(--f-sans)', boxSizing: 'border-box' };
  const Lbl = ({ children }) => (<div style={{ font: '700 10px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>{children}</div>);
  const steps = ['Causa', 'Relato', 'Testigos', 'Revisión'];

  return (
    <U.Drawer open={open} onClose={onClose} width={560} title="Nueva amonestación" subtitle="Asistente por pasos · base Art. 79 LOTTT"
      actions={
        <React.Fragment>
          {step > 0 && <U.Btn variant="ghost" style={{ marginRight: 'auto' }} onClick={() => setStep(s => s - 1)}>Atrás</U.Btn>}
          <U.Btn variant="ghost" onClick={onClose}>Cancelar</U.Btn>
          {step < 3
            ? <U.Btn variant="primary" disabled={!stepValid} onClick={() => setStep(s => s + 1)}>Siguiente</U.Btn>
            : <U.Btn variant="danger" icon={I.shield ? I.shield(14) : null} onClick={emit}>Emitir amonestación</U.Btn>}
        </React.Fragment>
      }>
      {/* Stepper */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 22 }}>
        {steps.map((s, i) => (
          <div key={s} style={{ flex: 1 }}>
            <div style={{ height: 4, borderRadius: 'var(--r-pill)', background: i <= step ? 'var(--wine)' : 'var(--border)' }} />
            <div style={{ font: `${i === step ? '700' : '500'} 10px/1 var(--f-sans)`, color: i === step ? 'var(--wine)' : 'var(--ink-mute)', marginTop: 7, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{i + 1}. {s}</div>
          </div>
        ))}
      </div>

      {step === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div><Lbl>Empleado</Lbl><U.Select value={empId} onChange={(e) => setEmpId(e.target.value)} options={activos.map(e => ({ value: e.id, label: `${e.name} · ${e.cargo}` }))} /></div>
          <div><Lbl>Causa · Art. 79 LOTTT</Lbl><U.Select value={causa} onChange={(e) => setCausa(e.target.value)} options={AMON_CAUSAS.map(c => ({ value: c.value, label: `${c.value}) ${c.label}` }))} /></div>
          <div><Lbl>Fecha del hecho</Lbl><input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} style={{ ...box, fontFamily: 'var(--f-mono)' }} /></div>
        </div>
      )}

      {step === 1 && (
        <div>
          <Lbl>Relato de los hechos</Lbl>
          <textarea value={relato} onChange={(e) => setRelato(e.target.value)} rows={8} placeholder="Describí objetivamente qué pasó, dónde y cuándo. Evitá opiniones; ceñite a los hechos." style={{ ...box, resize: 'vertical', lineHeight: 1.6 }} />
          <div style={{ font: '500 11px/1.5 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 8 }}>Este texto queda en el expediente y se le notifica al empleado en su app.</div>
        </div>
      )}

      {step === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ font: '500 12px/1.5 var(--f-sans)', color: 'var(--ink-soft)' }}>Registra al menos un testigo (se recomiendan dos).</div>
          {[['Testigo 1', t1, setT1], ['Testigo 2 (opcional)', t2, setT2]].map(([lbl, val, setVal]) => (
            <div key={lbl}>
              <Lbl>{lbl}</Lbl>
              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 10 }}>
                <input value={val.nombre} onChange={(e) => setVal({ ...val, nombre: e.target.value })} placeholder="Nombre y apellido" style={box} />
                <input value={val.cedula} onChange={(e) => setVal({ ...val, cedula: e.target.value })} placeholder="V-00.000.000" style={{ ...box, fontFamily: 'var(--f-mono)' }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {step === 3 && (
        <div>
          <div style={{ padding: '16px', borderRadius: 'var(--r-lg)', background: 'var(--danger-bg)', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: 'var(--danger)' }}>{I.shield ? I.shield(16) : '!'}</span>
              <span style={{ font: '700 13px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{emp ? emp.name : ''} · {emp ? emp.cargo : ''}</span>
            </div>
          </div>
          <pre style={{ whiteSpace: 'pre-wrap', font: '500 12.5px/1.65 var(--f-mono)', color: 'var(--ink)', background: 'var(--bg-elevated)', padding: '16px 18px', borderRadius: 'var(--r-md)', margin: 0 }}>{title}{'\n\n'}{bodyText()}</pre>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '12px 14px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', marginTop: 14 }}>
            <input type="checkbox" checked={alsoWa} onChange={(e) => setAlsoWa(e.target.checked)} style={{ width: 16, height: 16, accentColor: 'var(--wine)' }} />
            <span style={{ font: '500 12.5px/1.3 var(--f-sans)', color: 'var(--ink)' }}>Además enviar copia por WhatsApp</span>
          </label>
          <div style={{ font: '500 11px/1.5 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 10 }}>Al emitir, le llega al empleado a su app y debe dar <b>acuse de recibo</b>.</div>
        </div>
      )}
    </U.Drawer>
  );
}

// ════════════════════════════════════════════════════════════════
// Asistencia · calendario mensual por empleado
// ════════════════════════════════════════════════════════════════
function AsistenciaTab() {
  const U = window.ERPUI;
  const I = window.Icon;
  const N = window.NominaData;
  const [, force] = React.useReducer(x => x + 1, 0);
  React.useEffect(() => {
    const f = () => force();
    window.addEventListener('dtd-nomina-changed', f);
    return () => window.removeEventListener('dtd-nomina-changed', f);
  }, []);
  const activos = N.EMPLOYEES.filter(e => !e.inactive);
  const [empId, setEmpId] = React.useState(activos[0] ? activos[0].id : '');
  const [ym, setYm] = React.useState({ y: 2026, m: 4 });
  const [edit, setEdit] = React.useState(null);
  const [ferOpen, setFerOpen] = React.useState(false);

  const days = N.attMonth(empId, ym.y, ym.m);
  const sum = N.attSummary(empId, ym.y, ym.m);
  const firstOffset = (new Date(ym.y, ym.m, 1).getDay() + 6) % 7;
  const monthLabel = new Date(ym.y, ym.m, 1).toLocaleDateString('es-VE', { month: 'long', year: 'numeric' });
  const nav = (delta) => setYm(p => { let m = p.m + delta, y = p.y; if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; } return { y, m }; });
  const dow = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'];

  const box = { padding: '9px 11px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--ink)', font: '600 13px/1 var(--f-sans)', boxSizing: 'border-box' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ width: 320 }}>
          <U.Select value={empId} onChange={(e) => setEmpId(e.target.value)} options={activos.map(e => ({ value: e.id, label: `${e.name} · ${e.cargo}` }))} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <U.Btn variant="secondary" size="sm" icon={I.flag ? I.flag(13) : null} onClick={() => setFerOpen(true)}>Feriados</U.Btn>
          <U.Btn variant="ghost" size="sm" icon={I.arrowL ? I.arrowL(14) : '‹'} onClick={() => nav(-1)}>{''}</U.Btn>
          <span style={{ font: '700 14px/1 var(--f-display)', color: 'var(--ink)', minWidth: 150, textAlign: 'center', textTransform: 'capitalize' }}>{monthLabel}</span>
          <U.Btn variant="ghost" size="sm" icon={I.arrowR ? I.arrowR(14) : '›'} onClick={() => nav(1)}>{''}</U.Btn>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        <U.KPI label="Días trabajados" value={sum.trabajado} tone="success" icon={I.check(18)} />
        <U.KPI label="Ausencias" value={sum.ausente} tone="danger" icon={I.warn ? I.warn(18) : I.shield(18)} />
        <U.KPI label="Días libres" value={sum.libre} tone="neutral" icon={I.calendar ? I.calendar(18) : I.box(18)} />
        <U.KPI label="Horas extra netas" value={`${sum.extra - sum.resta} h`} delta={`+${sum.extra} / −${sum.resta}`} tone="wine" icon={I.clock ? I.clock(18) : I.box(18)} />
      </div>

      <U.Card padded>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
          {dow.map(d => <div key={d} style={{ textAlign: 'center', font: '700 10px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.08em', textTransform: 'uppercase', paddingBottom: 4 }}>{d}</div>)}
          {Array.from({ length: firstOffset }).map((_, i) => <div key={'b' + i} />)}
          {days.map(d => {
            const st = N.ATT_STATES[d.estado] || N.ATT_STATES.trabajado;
            const net = (Number(d.extra) || 0) - (Number(d.resta) || 0);
            const fer = N.feriadoOn(d.date);
            return (
              <button key={d.date} onClick={() => setEdit(d.date)} style={{
                aspectRatio: '1 / 1', borderRadius: 'var(--r-md)', cursor: 'pointer', textAlign: 'left',
                border: '1px solid ' + (fer ? 'var(--wine)' : d.estado === 'trabajado' ? 'var(--border)' : `var(--${st.tone})`),
                background: fer ? 'var(--wine-tint)' : d.estado === 'trabajado' ? 'var(--bg-surface)' : `var(--${st.tone}-bg)`,
                padding: '7px 9px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ font: '700 13px/1 var(--f-mono)', color: 'var(--ink)' }}>{d.day}</span>
                  {fer ? <span style={{ color: 'var(--wine)' }}>{I.flag ? I.flag(12) : '⚑'}</span> : <span style={{ width: 8, height: 8, borderRadius: '50%', background: `var(--${st.tone})` }} />}
                </div>
                <div>
                  {fer
                    ? <div title={fer.name} style={{ font: '700 8.5px/1.15 var(--f-sans)', color: 'var(--wine)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{fer.name}</div>
                    : <div style={{ font: '600 9px/1.1 var(--f-sans)', color: d.estado === 'trabajado' ? 'var(--ink-mute)' : `var(--${st.tone})` }}>{st.label}</div>}
                  {net !== 0 && <div style={{ font: '700 9.5px/1 var(--f-mono)', color: net > 0 ? 'var(--wine)' : 'var(--warning)', marginTop: 2 }}>{net > 0 ? '+' : ''}{net} h</div>}
                </div>
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 16, flexWrap: 'wrap' }}>
          {Object.entries(N.ATT_STATES).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: `var(--${v.tone})` }} />
              <span style={{ font: '500 11px/1 var(--f-sans)', color: 'var(--ink-soft)' }}>{v.label}</span>
            </div>
          ))}
          <span style={{ font: '500 11px/1 var(--f-sans)', color: 'var(--ink-mute)' }}>· Toca un día para marcar estado y horas.</span>
        </div>
      </U.Card>

      <DiaEditorModal date={edit} empId={empId} onClose={() => setEdit(null)} />
      <FeriadosModal open={ferOpen} year={ym.y} onClose={() => setFerOpen(false)} />
    </div>
  );
}

function DiaEditorModal({ date, empId, onClose }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const N = window.NominaData;
  const [d, setD] = React.useState({ estado: 'trabajado', extra: 0, resta: 0 });
  React.useEffect(() => { if (date) setD(N.getAtt(empId, date)); }, [date, empId]);
  if (!date) return null;
  const fer = N.feriadoOn(date);
  const save = () => { N.setAtt(empId, date, { estado: d.estado, extra: Number(d.extra) || 0, resta: Number(d.resta) || 0 }); onClose(); };
  const label = new Date(date + 'T00:00:00').toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long' });
  const box = { width: '100%', padding: '10px 12px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--ink)', font: '700 14px/1 var(--f-mono)', textAlign: 'right', boxSizing: 'border-box' };
  const Lbl = ({ children }) => (<div style={{ font: '700 9px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>{children}</div>);
  return (
    <U.Modal open={!!date} onClose={onClose} title={label.charAt(0).toUpperCase() + label.slice(1)} width={440}
      actions={<React.Fragment><U.Btn variant="ghost" onClick={onClose}>Cancelar</U.Btn><U.Btn variant="primary" icon={I.check(14)} onClick={save}>Guardar</U.Btn></React.Fragment>}>
      {fer && <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 'var(--r-md)', background: 'var(--wine-tint)', marginBottom: 14 }}>
        <span style={{ color: 'var(--wine)' }}>{I.flag ? I.flag(14) : '⚑'}</span>
        <span style={{ font: '700 12px/1.3 var(--f-sans)', color: 'var(--wine)' }}>Feriado: {fer.name}</span>
      </div>}
      <Lbl>Estado del día</Lbl>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
        {Object.entries(N.ATT_STATES).map(([k, v]) => {
          const on = d.estado === k;
          return (
            <button key={k} onClick={() => setD(o => ({ ...o, estado: k }))} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 12px', borderRadius: 'var(--r-md)', cursor: 'pointer', textAlign: 'left', border: '1px solid ' + (on ? `var(--${v.tone})` : 'var(--border)'), background: on ? `var(--${v.tone}-bg)` : 'var(--bg-surface)' }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: `var(--${v.tone})` }} />
              <span style={{ font: `${on ? '700' : '500'} 12.5px/1.2 var(--f-sans)`, color: 'var(--ink)' }}>{v.label}</span>
            </button>
          );
        })}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div><Lbl>+ Horas extra</Lbl><U.CalcInput value={d.extra} onChange={(e) => setD(o => ({ ...o, extra: e.target.value }))} style={box} /></div>
        <div><Lbl>− Horas a restar</Lbl><U.CalcInput value={d.resta} onChange={(e) => setD(o => ({ ...o, resta: e.target.value }))} style={box} /></div>
      </div>
    </U.Modal>
  );
}

// ════════════════════════════════════════════════════════════════
// Expediente del empleado · junta ficha, pagos, préstamos,
// asistencia, comunicaciones y línea de tiempo en un solo lugar
// ════════════════════════════════════════════════════════════════
function ExpedienteView({ emp, onBack, onEdit }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const N = window.NominaData;
  const R = window.ERPRates;
  const [rates] = R.useRates();
  const r = N.calcRecibo(emp, 40);
  const loans = N.loansFor(emp.id);
  const activeLoans = loans.filter(l => l.status === 'activo');
  const saldo = activeLoans.reduce((s, l) => s + N.loanBalance(l), 0);
  const att = N.attSummary(emp.id, 2026, 4);
  const comms = N.commsFor(emp.id);
  const reg = (N.allRegs ? N.allRegs() : []).find(x => x.empId === emp.id && x.status === 'aprobado');

  // antigüedad
  const start = new Date((emp.startDate || '2024-01-15') + 'T00:00:00');
  const end = new Date('2026-05-31T00:00:00');
  const months = Math.max(0, (end - start) / 86400000 / 30.44);
  const aYears = Math.floor(months / 12), aMonths = Math.round(months - aYears * 12);

  // línea de tiempo
  const tl = [];
  if (emp.startDate) tl.push({ date: emp.startDate, label: 'Ingreso a la empresa', tone: 'info' });
  comms.forEach(c => { const t = N.COMM_TYPES[c.type] || {}; tl.push({ date: c.date, label: `${t.label || c.type} · ${c.title}`, tone: t.tone || 'neutral' }); });
  loans.forEach(l => tl.push({ date: l.fecha, label: `Préstamo otorgado · ${R.fmtUsd(l.monto)}`, tone: 'wine' }));
  tl.sort((a, b) => String(b.date).localeCompare(String(a.date)));

  const Card = ({ title, action, children }) => (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '18px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ font: '700 10px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>{title}</div>
        {action}
      </div>
      {children}
    </div>
  );
  const Field = ({ label, value, mono }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '9px 0', borderTop: '1px solid var(--border)' }}>
      <span style={{ font: '500 12px/1.3 var(--f-sans)', color: 'var(--ink-soft)' }}>{label}</span>
      <span style={{ font: `600 12px/1.3 ${mono ? 'var(--f-mono)' : 'var(--f-sans)'}`, color: 'var(--ink)', textAlign: 'right' }}>{value || '—'}</span>
    </div>
  );

  return (
    <div>
      <button onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', background: 'transparent', cursor: 'pointer', font: '600 12.5px/1 var(--f-sans)', color: 'var(--wine)', padding: '4px 0', marginBottom: 14 }}>
        {I.arrowL ? I.arrowL(14) : '‹'} Empleados
      </button>

      {/* Encabezado */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 18 }}>
        {emp.photo
          ? <img src={emp.photo} alt="" style={{ width: 64, height: 64, borderRadius: 'var(--r-pill)', objectFit: 'cover', flexShrink: 0 }} />
          : <span style={{ width: 64, height: 64, flexShrink: 0, borderRadius: 'var(--r-pill)', background: 'var(--wine-tint)', color: 'var(--wine)', font: '800 24px/1 var(--f-display)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{emp.name.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()}</span>}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 style={{ font: '900 24px/1.05 var(--f-display)', color: 'var(--ink)', margin: 0, letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{emp.name}</h2>
            {emp.inactive ? <U.Badge tone="neutral" size="sm">Inactivo</U.Badge> : <U.Badge tone="success" size="sm" dot>Activo</U.Badge>}
          </div>
          <div style={{ font: '500 13px/1.3 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 6 }}>{emp.cargo} · {emp.dept || '—'} · ingresó hace {aYears} a {aMonths} m</div>
        </div>
        <U.Btn variant="secondary" icon={I.edit(13)} onClick={onEdit} style={{ flexShrink: 0 }}>Editar ficha</U.Btn>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 16 }}>
        <U.KPI label="Sueldo mensual" value={R.fmtUsd(emp.salarioUsd)} delta="indexado USD" tone="info" icon={I.cash ? I.cash(18) : I.invoice(18)} />
        <U.KPI label="Neto a cobrar" value={'Bs. ' + Math.round(r.netoFinal * rates.bcv).toLocaleString('es-VE')} delta={R.fmtUsd(r.netoFinal)} tone="wine" icon={I.invoice(18)} />
        <U.KPI label="Saldo préstamo" value={R.fmtUsd(saldo)} delta={`${activeLoans.length} activo${activeLoans.length === 1 ? '' : 's'}`} tone="warning" icon={I.wallet ? I.wallet(18) : I.invoice(18)} />
        <U.KPI label="Asistencia · mayo" value={`${att.trabajado} días`} delta={`${att.ausente} ausencias`} tone="success" icon={I.check(18)} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: 16, alignItems: 'start' }}>
        {/* Columna izquierda */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card title="Ficha">
            <Field label="Cédula / RIF" value={emp.cedula} mono />
            <Field label="WhatsApp" value={emp.phone} mono />
            <Field label="Correo" value={emp.email || (reg && reg.email)} />
            <Field label="Fecha de nacimiento" value={emp.birth || (reg && reg.birth)} mono />
            <Field label="Fecha de ingreso" value={emp.startDate} mono />
          </Card>
          <Card title="Datos bancarios">
            <Field label="Banco" value={emp.banco || (reg && reg.banco)} />
            <Field label="Tipo de cuenta" value={emp.tipoCuenta || (reg && reg.tipoCuenta)} />
            <Field label="Número de cuenta" value={emp.cuenta || (reg && reg.cuenta)} mono />
          </Card>
          <Card title="Documentos">
            {[['Contrato de trabajo', false], ['Cédula de identidad', !!(emp.photo || (reg && reg.photo))], ['Comprobantes de pago', N.payrollRuns().length > 0]].map(([doc, ok]) => (
              <div key={doc} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderTop: '1px solid var(--border)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, font: '500 12.5px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{I.doc ? I.doc(14) : null} {doc}</span>
                {ok ? <U.Badge tone="success" size="sm" dot>Cargado</U.Badge> : <U.Badge tone="neutral" size="sm">Pendiente</U.Badge>}
              </div>
            ))}
          </Card>
        </div>

        {/* Columna derecha */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card title="Préstamos">
            {loans.length === 0 ? <div style={{ font: '500 12px/1.5 var(--f-sans)', color: 'var(--ink-mute)' }}>Sin préstamos.</div> : loans.map((l, i) => {
              const sal = N.loanBalance(l);
              return (
                <div key={l.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderTop: i > 0 ? '1px solid var(--border)' : 0 }}>
                  <div>
                    <div style={{ font: '600 12.5px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{l.motivo || 'Préstamo'}</div>
                    <div style={{ font: '500 10.5px/1.2 var(--f-mono)', color: 'var(--ink-mute)', marginTop: 2 }}>{R.fmtUsd(l.monto)} · cuota {R.fmtUsd(l.cuota)}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ font: '700 12px/1 var(--f-mono)', color: sal > 0 ? 'var(--wine)' : 'var(--success)' }}>{sal > 0 ? `saldo ${R.fmtUsd(sal)}` : 'saldado'}</div>
                  </div>
                </div>
              );
            })}
          </Card>

          <Card title={`Comunicaciones (${comms.length})`}>
            {comms.length === 0 ? <div style={{ font: '500 12px/1.5 var(--f-sans)', color: 'var(--ink-mute)' }}>Sin comunicaciones.</div> : comms.slice(0, 6).map((c, i) => {
              const t = N.COMM_TYPES[c.type] || {};
              return (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderTop: i > 0 ? '1px solid var(--border)' : 0 }}>
                  <U.Badge tone={t.tone || 'neutral'} size="sm">{t.label || c.type}</U.Badge>
                  <span style={{ flex: 1, minWidth: 0, font: '500 12px/1.3 var(--f-sans)', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</span>
                  <span style={{ font: '500 10.5px/1 var(--f-mono)', color: 'var(--ink-mute)' }}>{c.date}</span>
                  {c.ack && <span style={{ color: 'var(--success)' }}>{I.check(13)}</span>}
                </div>
              );
            })}
          </Card>

          <Card title="Línea de tiempo">
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {tl.map((e, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, paddingBottom: i < tl.length - 1 ? 14 : 0 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span style={{ width: 9, height: 9, borderRadius: '50%', background: `var(--${e.tone})`, marginTop: 4, flexShrink: 0 }} />
                    {i < tl.length - 1 && <span style={{ width: 1, flex: 1, background: 'var(--border)', marginTop: 4 }} />}
                  </div>
                  <div style={{ paddingBottom: 2 }}>
                    <div style={{ font: '600 12px/1.3 var(--f-sans)', color: 'var(--ink)' }}>{e.label}</div>
                    <div style={{ font: '500 10.5px/1 var(--f-mono)', color: 'var(--ink-mute)', marginTop: 2 }}>{e.date}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function FeriadosModal({ open, year, onClose }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const N = window.NominaData;
  const [, force] = React.useReducer(x => x + 1, 0);
  const [date, setDate] = React.useState(`${year}-01-01`);
  const [name, setName] = React.useState('');
  const list = N.feriados().filter(f => f.date.slice(0, 4) === String(year));
  const add = () => { if (!date || !name.trim()) return; N.addFeriado(date, name.trim()); setName(''); force(); };
  const box = { width: '100%', padding: '9px 11px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--ink)', font: '500 13px/1.2 var(--f-sans)', boxSizing: 'border-box' };
  return (
    <U.Modal open={open} onClose={onClose} title={`Feriados ${year}`} width={520}
      actions={<U.Btn variant="ghost" onClick={onClose}>Cerrar</U.Btn>}>
      <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr auto', gap: 8, alignItems: 'center', marginBottom: 14 }}>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ ...box, fontFamily: 'var(--f-mono)' }} />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre del feriado propio" style={box} />
        <U.Btn variant="primary" size="sm" icon={I.plus(12)} onClick={add}>Agregar</U.Btn>
      </div>
      <div style={{ maxHeight: 360, overflowY: 'auto' }}>
        {list.map((f, i) => (
          <div key={f.date} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '9px 0', borderTop: i > 0 ? '1px solid var(--border)' : 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <code style={{ font: '600 11px/1 var(--f-mono)', color: 'var(--ink-soft)', flexShrink: 0 }}>{f.date}</code>
              <span style={{ font: '500 12.5px/1.2 var(--f-sans)', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
              {f.nac ? <U.Badge tone="info" size="sm">Nacional</U.Badge> : <U.Badge tone="wine" size="sm">Propio</U.Badge>}
            </div>
            <button onClick={() => { N.removeFeriado(f.date); force(); }} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--ink-mute)', display: 'inline-flex' }} title="Quitar">{I.close ? I.close(14) : '✕'}</button>
          </div>
        ))}
      </div>
    </U.Modal>
  );
}

// ════════════════════════════════════════════════════════════════
// Servicios / prestadores · pagos por sesión a freelance
// ════════════════════════════════════════════════════════════════
function PrestadoresTab() {
  const U = window.ERPUI;
  const I = window.Icon;
  const N = window.NominaData;
  const R = window.ERPRates;
  const [, force] = React.useReducer(x => x + 1, 0);
  React.useEffect(() => { const f = () => force(); window.addEventListener('dtd-nomina-changed', f); return () => window.removeEventListener('dtd-nomina-changed', f); }, []);
  const [nuevo, setNuevo] = React.useState(false);
  const [pago, setPago] = React.useState(null);
  const list = N.prestadores();
  const pagos = N.prestPagos();
  const prestName = (id) => { const p = list.find(x => x.id === id); return p ? p.name : id; };
  const totalMes = pagos.filter(p => p.fecha >= '2026-05-01' && p.fecha <= '2026-05-31').reduce((s, p) => s + Number(p.monto), 0);

  const box = { width: '100%', padding: '9px 11px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--ink)', font: '500 13px/1.3 var(--f-sans)', boxSizing: 'border-box' };
  const Lbl = ({ children }) => (<div style={{ font: '700 10px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>{children}</div>);

  const NuevoModal = () => {
    const [f, setF] = React.useState({ name: '', servicio: '', phone: '+58 ', tarifa: '' });
    const valid = f.name.trim() && f.servicio.trim();
    return (
      <U.Modal open={nuevo} onClose={() => setNuevo(false)} title="Nuevo prestador" width={460}
        actions={<React.Fragment><U.Btn variant="ghost" onClick={() => setNuevo(false)}>Cancelar</U.Btn><U.Btn variant="primary" icon={I.check(14)} disabled={!valid} onClick={() => { N.createPrestador(f); setNuevo(false); }}>Registrar</U.Btn></React.Fragment>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div><Lbl>Nombre</Lbl><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} style={box} /></div>
          <div><Lbl>Servicio</Lbl><input value={f.servicio} onChange={(e) => setF({ ...f, servicio: e.target.value })} placeholder="Ej. Plomería" style={box} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><Lbl>WhatsApp</Lbl><input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} style={{ ...box, fontFamily: 'var(--f-mono)' }} /></div>
            <div><Lbl>Tarifa sesión (USD)</Lbl><U.CalcInput value={f.tarifa} onChange={(e) => setF({ ...f, tarifa: e.target.value })} style={{ ...box, fontFamily: 'var(--f-mono)', fontWeight: 700, textAlign: 'right' }} /></div>
          </div>
        </div>
      </U.Modal>
    );
  };
  const PagoModal = () => {
    const [f, setF] = React.useState({ concepto: '', monto: pago ? String(pago.tarifa) : '', fecha: '2026-05-31' });
    React.useEffect(() => { if (pago) setF({ concepto: '', monto: String(pago.tarifa || ''), fecha: '2026-05-31' }); }, [pago && pago.id]);
    if (!pago) return null;
    return (
      <U.Modal open={!!pago} onClose={() => setPago(null)} title={`Pago · ${pago.name}`} width={440}
        actions={<React.Fragment><U.Btn variant="ghost" onClick={() => setPago(null)}>Cancelar</U.Btn><U.Btn variant="primary" icon={I.check(14)} disabled={!(Number(f.monto) > 0)} onClick={() => { N.createPrestPago({ prestId: pago.id, concepto: f.concepto.trim() || pago.servicio, monto: Number(f.monto), fecha: f.fecha }); setPago(null); }}>Registrar pago</U.Btn></React.Fragment>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div><Lbl>Concepto</Lbl><input value={f.concepto} onChange={(e) => setF({ ...f, concepto: e.target.value })} placeholder={pago.servicio} style={box} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><Lbl>Fecha</Lbl><input type="date" value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} style={{ ...box, fontFamily: 'var(--f-mono)' }} /></div>
            <div><Lbl>Monto (USD)</Lbl><U.CalcInput value={f.monto} onChange={(e) => setF({ ...f, monto: e.target.value })} style={{ ...box, fontFamily: 'var(--f-mono)', fontWeight: 700, textAlign: 'right' }} /></div>
          </div>
        </div>
      </U.Modal>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '11px 16px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)' }}>
        <span style={{ font: '500 12px/1.5 var(--f-sans)', color: 'var(--ink-soft)' }}>Pagos por sesión a prestadores externos (doméstica, plomero, etc.), fuera de la nómina fija. Pagado en mayo: <b style={{ color: 'var(--ink)' }}>{R.fmtUsd(totalMes)}</b>.</span>
        <U.Btn variant="primary" size="sm" icon={I.plus(12)} onClick={() => setNuevo(true)}>Nuevo prestador</U.Btn>
      </div>

      <U.Card padded={false}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr 130px 100px 120px', padding: '10px 18px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)', font: '700 10px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.08em', textTransform: 'uppercase', gap: 12 }}>
          <span>Prestador</span><span>Servicio</span><span>WhatsApp</span><span style={{ textAlign: 'right' }}>Tarifa</span><span></span>
        </div>
        {list.map((p, i) => (
          <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr 130px 100px 120px', padding: '11px 18px', alignItems: 'center', gap: 12, borderTop: i > 0 ? '1px solid var(--border)' : 0 }}>
            <span style={{ font: '600 12.5px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{p.name}</span>
            <span style={{ font: '500 12px/1.2 var(--f-sans)', color: 'var(--ink-soft)' }}>{p.servicio}</span>
            <code style={{ font: '500 11px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>{p.phone}</code>
            <span style={{ textAlign: 'right', font: '700 12px/1 var(--f-mono)', color: 'var(--ink)' }}>{R.fmtUsd(p.tarifa)}</span>
            <div style={{ textAlign: 'right' }}><U.Btn variant="secondary" size="sm" onClick={() => setPago(p)}>Pagar sesión</U.Btn></div>
          </div>
        ))}
      </U.Card>

      <div>
        <div className="eyebrow eyebrow-wine" style={{ marginBottom: 10 }}>PAGOS RECIENTES</div>
        <U.Card padded={false}>
          {pagos.length === 0 ? <div style={{ padding: 18, font: '500 12px/1.5 var(--f-sans)', color: 'var(--ink-mute)' }}>Sin pagos registrados.</div> : pagos.map((p, i) => (
            <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '120px 1.4fr 1fr 110px', padding: '11px 18px', alignItems: 'center', gap: 12, borderTop: i > 0 ? '1px solid var(--border)' : 0 }}>
              <code style={{ font: '500 11px/1 var(--f-mono)', color: 'var(--ink-mute)' }}>{p.fecha}</code>
              <span style={{ font: '600 12.5px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{prestName(p.prestId)}</span>
              <span style={{ font: '500 11.5px/1.2 var(--f-sans)', color: 'var(--ink-soft)' }}>{p.concepto}</span>
              <span style={{ textAlign: 'right', font: '700 12px/1 var(--f-mono)', color: 'var(--wine)' }}>{R.fmtUsd(p.monto)}</span>
            </div>
          ))}
        </U.Card>
      </div>

      <NuevoModal />
      <PagoModal />
    </div>
  );
}

window.ModuleNomina = ModuleNomina;
