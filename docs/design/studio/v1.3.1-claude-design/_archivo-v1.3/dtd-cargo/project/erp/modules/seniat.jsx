/* global React */
/* ── DTD ERP · Workflow Aduana SENIAT ────────────────────────── */

const { useState: _xUseState, useMemo: _xUseMemo } = React;

// Mock SENIAT customs data
const _seniatData = {
  agents: [
    { id: 'a-001', name: 'Aduanas Carabobo CA',  rif: 'J-31002284-5', port: 'PBL', contact: 'Felipe Briceño', phone: '+58 412 552 8841', shipments: 84, rating: 4.8 },
    { id: 'a-002', name: 'Logística Aduanal VE', rif: 'J-30884512-7', port: 'LGU', contact: 'Romina Salas',  phone: '+58 414 220 1188', shipments: 62, rating: 4.6 },
    { id: 'a-003', name: 'Zulia Aduanas SA',     rif: 'J-30551423-2', port: 'MAR', contact: 'Yoel Castillo', phone: '+58 416 778 4477', shipments: 38, rating: 4.7 },
    { id: 'a-004', name: 'Falcón Customs',       rif: 'J-31884201-9', port: 'PFI', contact: 'Diana Méndez',  phone: '+58 424 999 2200', shipments: 24, rating: 4.9 },
  ],
  shipments: [
    { id: 'DTDU-419032', client: 'Industrias Polar', dua: 'DUA-VE-2026-088421', port: 'MAR', agent: 'a-003', status: 'liberación', arrived: '2026-05-22', cleared: null, hsCodes: ['8418.50.10', '8504.40.10'], totalDuty: 18200, taxes: 25080, iva: 25080, agentFee: 2400, total: 70760, docs: { commercial: true, packing: true, bl: true, certOrigin: true, sanitary: false, dua: true, payment: false }, observations: 'Pendiente pago aranceles · revisión documental OK', alert: null },
    { id: 'DTDU-472816', client: 'Acindar Comercial', dua: 'DUA-VE-2026-088502', port: 'PBL', agent: 'a-001', status: 'en revisión', arrived: '2026-05-12', cleared: null, hsCodes: ['8517.12.10', '9405.40.20'], totalDuty: 12660, taxes: 13472, iva: 13472, agentFee: 1850, total: 41454, docs: { commercial: true, packing: true, bl: true, certOrigin: false, sanitary: false, dua: true, payment: false }, observations: 'Falta certificado de origen · solicitado a supplier YIW', alert: 'Cert. origen pendiente · 5 días en revisión' },
    { id: 'DTDU-388157', client: 'Imp. Pereira',      dua: 'DUA-VE-2026-088301', port: 'LGU', agent: 'a-002', status: 'liberado', arrived: '2026-04-08', cleared: '2026-04-22', hsCodes: ['9405.40.20'], totalDuty: 1260, taxes: 2016, iva: 2016, agentFee: 380, total: 5672, docs: { commercial: true, packing: true, bl: true, certOrigin: true, sanitary: false, dua: true, payment: true }, observations: 'Liberación completa · POD entregado', alert: null },
    { id: 'DTDU-365044', client: 'Castro Hermanos',   dua: 'DUA-VE-2026-088002', port: 'PFI', agent: 'a-004', status: 'liberado', arrived: '2026-04-12', cleared: '2026-05-15', hsCodes: ['8418.50.10', '4202.92.10'], totalDuty: 8440, taxes: 12442, iva: 12442, agentFee: 1620, total: 34944, docs: { commercial: true, packing: true, bl: true, certOrigin: true, sanitary: false, dua: true, payment: true }, observations: 'Despacho normal', alert: null },
    { id: 'DTDU-364299', client: 'Vargas & Asoc',     dua: 'DUA-VE-2026-088421-A', port: 'PBL', agent: 'a-001', status: 'observación', arrived: '2026-05-06', cleared: null, hsCodes: ['6403.99.10'], totalDuty: 5430, taxes: 8688, iva: 8688, agentFee: 980, total: 23786, docs: { commercial: true, packing: false, bl: true, certOrigin: false, sanitary: false, dua: false, payment: false }, observations: '⚠ Inspección física solicitada por SENIAT · faltan documentos', alert: 'Inspección física · packing list incompleta' },
  ],
};

function ModuleSENIAT({ goTo }) {
  const D = window.ERPData;
  const U = window.ERPUI;
  const [tab, setTab] = _xUseState('queue');
  const [selected, setSelected] = _xUseState(null);

  const shipments = _seniatData.shipments;
  const inProcess = shipments.filter(s => s.status !== 'liberado').length;
  const cleared = shipments.filter(s => s.status === 'liberado').length;
  const totalDuty = shipments.reduce((a, s) => a + s.totalDuty + s.taxes + s.iva + s.agentFee, 0);
  const withAlert = shipments.filter(s => s.alert).length;

  const statusTone = { 'liberación': 'info', 'en revisión': 'warning', 'observación': 'danger', 'liberado': 'success', 'pagado': 'success' };

  return (
    <div>
      <U.PageHeader
        title="Aduana SENIAT · Workflow"
        subtitle="Trámite aduanero por embarque · DUA, agente aduanal, aranceles, IVA, IGTF. Checklist documental y tracking de liberación."
        actions={
          <>
            <U.Btn variant="secondary" icon={window.Icon.download(14)}>Reporte SENIAT</U.Btn>
            <U.Btn variant="primary" icon={window.Icon.plus(14)}>Nuevo trámite</U.Btn>
          </>
        }
      />

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 'var(--s-5)' }}>
        <U.KPI label="En trámite" value={inProcess} delta="esperando liberación" tone="warning" icon={window.Icon.clock(18)} />
        <U.KPI label="Liberados YTD" value={cleared} delta="completados" tone="success" icon={window.Icon.check(18)} />
        <U.KPI label="Impuestos pagados" value={`$${(totalDuty/1000).toFixed(0)}K`} sub="aranceles + IVA + agente" tone="wine" icon={window.Icon.invoice(18)} />
        <U.KPI label="Con alertas" value={withAlert} delta={withAlert > 0 ? 'requieren atención' : 'todos OK'} tone={withAlert > 0 ? 'danger' : 'success'} icon={window.Icon.warn(18)} />
      </div>

      <U.Tabs value={tab} onChange={setTab} items={[
        { value: 'queue',   label: 'Cola activa',  count: inProcess },
        { value: 'cleared', label: 'Liberados',    count: cleared },
        { value: 'agents',  label: 'Agentes aduanales' },
        { value: 'tax',     label: 'Aranceles & impuestos' },
      ]} style={{ marginBottom: 'var(--s-5)' }} />

      {/* Queue / Cleared list */}
      {(tab === 'queue' || tab === 'cleared') && (
        <U.Card padded={false}>
          {shipments.filter(s => tab === 'queue' ? s.status !== 'liberado' : s.status === 'liberado').map((s, i) => {
            const docsComplete = Object.values(s.docs).filter(Boolean).length;
            const docsTotal = Object.values(s.docs).length;
            const docsPct = (docsComplete / docsTotal) * 100;
            return (
              <button key={s.id} onClick={() => setSelected(s)} style={{
                display: 'grid', gridTemplateColumns: '130px 1fr 100px 100px 100px 130px',
                gap: 14, padding: '14px 18px', alignItems: 'center',
                width: '100%', textAlign: 'left',
                borderTop: i > 0 ? '1px solid var(--border)' : 0, cursor: 'pointer',
                background: s.alert ? 'rgba(168,50,62,0.04)' : 'transparent',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-elevated)'}
              onMouseLeave={(e) => e.currentTarget.style.background = s.alert ? 'rgba(168,50,62,0.04)' : 'transparent'}
              >
                <div>
                  <code style={{ font: '800 12px/1 var(--f-mono)', color: 'var(--wine)' }}>{s.id}</code>
                  <div style={{ font: '600 10.5px/1.2 var(--f-mono)', color: 'var(--ink-mute)', marginTop: 4 }}>{s.dua}</div>
                </div>
                <div>
                  <div style={{ font: '700 13px/1.2 var(--f-sans)' }}>{s.client}</div>
                  <div style={{ font: '500 11px/1.2 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 3 }}>
                    {s.alert ? <span style={{ color: 'var(--danger)' }}>⚠ {s.alert}</span> : s.observations}
                  </div>
                </div>
                <U.Badge tone="info" size="sm">{s.port}</U.Badge>
                <div>
                  <div style={{ font: '700 9.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Docs</div>
                  <div style={{ font: '800 14px/1 var(--f-mono)', color: docsPct === 100 ? 'var(--success)' : 'var(--warning)', marginTop: 4 }}>{docsComplete}/{docsTotal}</div>
                  <div style={{ marginTop: 4, height: 3, background: 'var(--bg-elevated)', borderRadius: 999 }}>
                    <div style={{ width: `${docsPct}%`, height: '100%', background: docsPct === 100 ? 'var(--success)' : 'var(--warning)', borderRadius: 999 }} />
                  </div>
                </div>
                <span className="mono" style={{ font: '700 13px/1 var(--f-mono)', color: 'var(--ink)', textAlign: 'right' }}>${(s.total/1000).toFixed(1)}K</span>
                <U.Badge tone={statusTone[s.status]} size="md" dot>{s.status}</U.Badge>
              </button>
            );
          })}
        </U.Card>
      )}

      {tab === 'agents' && <AgentsTab agents={_seniatData.agents} />}
      {tab === 'tax'    && <TaxTab shipments={shipments} />}

      <CustomsDetail shipment={selected} onClose={() => setSelected(null)} goTo={goTo} agents={_seniatData.agents} />
    </div>
  );
}

// ── Customs detail drawer ───────────────────────────────────
function CustomsDetail({ shipment: s, onClose, goTo, agents }) {
  const D = window.ERPData;
  const U = window.ERPUI;
  if (!s) return null;
  const agent = agents.find(a => a.id === s.agent);
  const docs = [
    { k: 'commercial', l: 'Factura comercial',     required: true },
    { k: 'packing',    l: 'Packing list',           required: true },
    { k: 'bl',         l: 'Bill of Lading (BL)',    required: true },
    { k: 'certOrigin', l: 'Certificado de origen',  required: true },
    { k: 'sanitary',   l: 'Permiso sanitario',      required: false },
    { k: 'dua',        l: 'DUA firmada',             required: true },
    { k: 'payment',    l: 'Comprobante pago aranceles', required: true },
  ];

  return (
    <U.Drawer
      open={!!s}
      onClose={onClose}
      title={`${s.id} · Aduana ${s.port}`}
      subtitle={`${s.client} · DUA ${s.dua}`}
      width={700}
      actions={
        <>
          <U.Btn variant="secondary" icon={window.Icon.download(13)}>Imprimir DUA</U.Btn>
          <U.Btn variant="secondary" icon={window.Icon.mail(13)}>Contactar agente</U.Btn>
          <U.Btn variant="primary" icon={window.Icon.check(13)}>Marcar liberado</U.Btn>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        {/* Alert if any */}
        {s.alert && (
          <div style={{ padding: '12px 14px', background: 'var(--danger-bg)', borderLeft: '3px solid var(--danger)', borderRadius: 'var(--r-md)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ color: 'var(--danger)' }}>{window.Icon.warn(15)}</span>
              <div>
                <div style={{ font: '800 13px/1.2 var(--f-display)', color: 'var(--ink)' }}>Alerta SENIAT</div>
                <div style={{ font: '500 12.5px/1.4 var(--f-sans)', color: 'var(--ink)', marginTop: 3 }}>{s.alert}</div>
              </div>
            </div>
          </div>
        )}

        {/* Cost breakdown */}
        <div>
          <div className="eyebrow eyebrow-wine" style={{ marginBottom: 14 }}>DESGLOSE DE COSTOS ADUANALES</div>
          <U.Card padded style={{ background: 'var(--ink)', color: '#fff', border: 0 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 14 }}>
              <CostMini label="Arancel" value={s.totalDuty} />
              <CostMini label="IGTF 3%" value={s.taxes} />
              <CostMini label="IVA 16%" value={s.iva} />
              <CostMini label="Agente" value={s.agentFee} />
            </div>
            <div style={{ paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <div style={{ font: '700 11px/1 var(--f-sans)', color: 'var(--wine-soft)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>TOTAL A PAGAR SENIAT</div>
              <code style={{ font: '900 22px/1 var(--f-mono)', color: '#fff' }}>${s.total.toLocaleString()}</code>
            </div>
          </U.Card>
        </div>

        {/* Documents checklist */}
        <div>
          <div className="eyebrow eyebrow-wine" style={{ marginBottom: 12 }}>CHECKLIST DOCUMENTAL</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {docs.map(d => {
              const ok = s.docs[d.k];
              return (
                <div key={d.k} style={{
                  display: 'grid', gridTemplateColumns: '24px 1fr 90px 80px',
                  gap: 12, alignItems: 'center',
                  padding: '10px 12px',
                  background: ok ? 'var(--success-bg)' : d.required ? 'var(--danger-bg)' : 'var(--bg-elevated)',
                  borderRadius: 'var(--r-md)',
                  borderLeft: `3px solid ${ok ? 'var(--success)' : d.required ? 'var(--danger)' : 'var(--border-strong)'}`,
                }}>
                  <span style={{ color: ok ? 'var(--success)' : d.required ? 'var(--danger)' : 'var(--ink-mute)' }}>
                    {ok ? window.Icon.check(14) : window.Icon.close(14)}
                  </span>
                  <span style={{ font: '600 12.5px/1 var(--f-sans)', color: 'var(--ink)' }}>{d.l}</span>
                  {d.required
                    ? <U.Badge tone={ok ? 'success' : 'danger'} size="sm">{ok ? 'OK' : 'falta'}</U.Badge>
                    : <U.Badge tone="neutral" size="sm">opcional</U.Badge>
                  }
                  <U.Btn variant="ghost" size="sm" icon={ok ? window.Icon.eye(11) : window.Icon.upload(11)}>{ok ? 'Ver' : 'Subir'}</U.Btn>
                </div>
              );
            })}
          </div>
        </div>

        {/* HS codes */}
        <div>
          <div className="eyebrow eyebrow-wine" style={{ marginBottom: 10 }}>HS CODES DECLARADOS</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {s.hsCodes.map(c => <U.Badge key={c} tone="wine" size="md">{c}</U.Badge>)}
          </div>
        </div>

        {/* Agent */}
        {agent && (
          <div>
            <div className="eyebrow eyebrow-wine" style={{ marginBottom: 12 }}>AGENTE ADUANAL ASIGNADO</div>
            <U.Card padded>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <U.Avatar initials={agent.name.split(' ').map(w=>w[0]).slice(0,2).join('')} size={44} color="wine" />
                <div style={{ flex: 1 }}>
                  <div style={{ font: '800 14px/1.2 var(--f-display)', color: 'var(--ink)' }}>{agent.name}</div>
                  <div style={{ font: '500 11.5px/1.3 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 4 }}>{agent.contact} · ★ {agent.rating}</div>
                  <code style={{ font: '600 11.5px/1.2 var(--f-mono)', color: 'var(--ink-soft)', display: 'block', marginTop: 4 }}>{agent.phone} · RIF {agent.rif}</code>
                </div>
              </div>
            </U.Card>
          </div>
        )}

        {/* Timeline */}
        <div>
          <div className="eyebrow eyebrow-wine" style={{ marginBottom: 12 }}>TIMELINE SENIAT</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {[
              { date: s.arrived, e: 'Arribo a puerto', done: true, m: `${s.port} · contenedor descargado` },
              { date: '—',       e: 'DUA presentada',  done: true, m: `${s.dua} · presentada por ${agent?.name}` },
              { date: '—',       e: 'Revisión documental', done: s.status !== 'observación', m: s.status === 'observación' ? 'En observación' : 'OK' },
              { date: '—',       e: 'Inspección física',   done: s.status === 'liberación' || s.status === 'liberado', m: s.status === 'observación' ? 'Solicitada por SENIAT' : 'No requerida o aprobada' },
              { date: '—',       e: 'Pago aranceles',      done: s.docs.payment, m: s.docs.payment ? `$${s.total.toLocaleString()}` : 'Pendiente' },
              { date: s.cleared || '—', e: 'Liberación',    done: s.status === 'liberado', m: s.status === 'liberado' ? 'Liberado · listo retiro' : 'Esperando' },
            ].map((t, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '90px 22px 1fr 100px', gap: 10, padding: '8px 0', borderTop: i > 0 ? '1px solid var(--border)' : 0, alignItems: 'center' }}>
                <span style={{ font: '600 11px/1 var(--f-mono)', color: 'var(--ink-mute)' }}>{t.date}</span>
                <span style={{
                  width: 18, height: 18, borderRadius: '50%',
                  background: t.done ? 'var(--success)' : 'var(--bg-elevated)',
                  color: t.done ? '#fff' : 'var(--ink-mute)',
                  border: `2px solid ${t.done ? 'var(--success)' : 'var(--border-strong)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  font: '700 9px/1 var(--f-sans)',
                }}>{t.done ? '✓' : ''}</span>
                <div>
                  <div style={{ font: `${t.done ? '700' : '500'} 12.5px/1.2 var(--f-sans)`, color: t.done ? 'var(--ink)' : 'var(--ink-soft)' }}>{t.e}</div>
                  <div style={{ font: '500 11px/1.3 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 2 }}>{t.m}</div>
                </div>
                <button onClick={() => goTo?.('shipments', s.id, 'detail')} style={{ font: '600 11px/1 var(--f-sans)', color: 'var(--wine)', textAlign: 'right' }}>Ver embarque →</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </U.Drawer>
  );
}

function CostMini({ label, value }) {
  return (
    <div>
      <div style={{ font: '700 10px/1 var(--f-sans)', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>{label}</div>
      <code style={{ font: '800 14px/1 var(--f-mono)', color: '#fff', display: 'block', marginTop: 6 }}>${value.toLocaleString()}</code>
    </div>
  );
}

// ── Agents tab ──────────────────────────────────────────────
function AgentsTab({ agents }) {
  const U = window.ERPUI;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
      {agents.map(a => (
        <U.Card key={a.id} padded hoverable
          onClick={() => window.open(`nuevo/pantallas/agente-perfil.html?id=${a.id}`, '_blank')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <U.Avatar initials={a.contact.split(' ').map(w=>w[0]).slice(0,2).join('')} size={40} color="wine" />
            <div style={{ flex: 1 }}>
              <div style={{ font: '900 14px/1.1 var(--f-display)', color: 'var(--ink)' }}>{a.name}</div>
              <div style={{ font: '500 11px/1.2 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 3 }}>{a.contact}</div>
            </div>
            <U.Badge tone="wine" size="sm">{a.port}</U.Badge>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
            <div>
              <div style={{ font: '700 9.5px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>RIF</div>
              <code style={{ font: '700 11.5px/1 var(--f-mono)', color: 'var(--ink)', marginTop: 4, display: 'block' }}>{a.rif}</code>
            </div>
            <div>
              <div style={{ font: '700 9.5px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Teléfono</div>
              <code style={{ font: '700 11.5px/1 var(--f-mono)', color: 'var(--ink)', marginTop: 4, display: 'block' }}>{a.phone}</code>
            </div>
            <div>
              <div style={{ font: '700 9.5px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Trámites</div>
              <div style={{ font: '800 14px/1 var(--f-mono)', color: 'var(--ink)', marginTop: 4 }}>{a.shipments}</div>
            </div>
            <div>
              <div style={{ font: '700 9.5px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Rating</div>
              <div style={{ font: '800 14px/1 var(--f-mono)', color: 'var(--wine)', marginTop: 4 }}>★ {a.rating}</div>
            </div>
          </div>
        </U.Card>
      ))}
    </div>
  );
}

// ── Tax tab ────────────────────────────────────────────────
function TaxTab({ shipments }) {
  const U = window.ERPUI;
  const totalDuty = shipments.reduce((a, s) => a + s.totalDuty, 0);
  const totalTax = shipments.reduce((a, s) => a + s.taxes, 0);
  const totalIva = shipments.reduce((a, s) => a + s.iva, 0);
  const totalAgent = shipments.reduce((a, s) => a + s.agentFee, 0);
  const grand = totalDuty + totalTax + totalIva + totalAgent;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <U.Card padded>
        <div className="eyebrow eyebrow-wine" style={{ marginBottom: 14 }}>RESUMEN YTD 2026</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { l: 'Aranceles de importación', v: totalDuty, c: 'var(--wine)' },
            { l: 'IGTF 3%',                  v: totalTax,  c: 'var(--warning)' },
            { l: 'IVA 16%',                  v: totalIva,  c: 'var(--info)' },
            { l: 'Honorarios agente aduanal',v: totalAgent,c: 'var(--success)' },
          ].map(t => (
            <div key={t.l}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ font: '600 13px/1 var(--f-sans)', color: 'var(--ink)' }}>{t.l}</span>
                <span style={{ font: '800 14px/1 var(--f-mono)', color: t.c }}>${t.v.toLocaleString()}</span>
              </div>
              <div style={{ height: 8, background: 'var(--bg-elevated)', borderRadius: 999 }}>
                <div style={{ width: `${(t.v / grand) * 100}%`, height: '100%', background: t.c, borderRadius: 999 }} />
              </div>
            </div>
          ))}
          <div style={{ paddingTop: 14, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            <span style={{ font: '900 14px/1 var(--f-display)', color: 'var(--ink)' }}>TOTAL PAGADO SENIAT</span>
            <code style={{ font: '900 18px/1 var(--f-mono)', color: 'var(--wine)' }}>${grand.toLocaleString()}</code>
          </div>
        </div>
      </U.Card>
    </div>
  );
}

window.ModuleSENIAT = ModuleSENIAT;
