/* global React */
/* ── DTD ERP · Fidelización & Referidos · v1.9.1 ────────────── */
/* Motor de niveles + programa de referidos.                     */
/* Dashboard · Niveles · Referidos · Clientes (loyalty).         */

function ModuleFidelizacion({ goTo }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const F = window.FidelizacionData;
  const [tab, setTab] = React.useState('dashboard');
  const st = F.programStats();

  return (
    <div>
      <U.PageHeader
        eyebrow="COMERCIAL · LEALTAD"
        title="Fidelización & Referidos"
        subtitle="Construyendo confianza cliente a cliente, contenedor a contenedor. Niveles por facturación + programa de referidos con créditos."
        actions={<U.Btn variant="primary" icon={I.plus(14)} onClick={() => setTab('referidos')}>Registrar referido</U.Btn>}
      />

      <U.Tabs
        value={tab}
        onChange={setTab}
        items={[
          { value: 'dashboard', label: 'Dashboard' },
          { value: 'niveles',   label: 'Niveles' },
          { value: 'referidos', label: 'Referidos', count: F.REFERRALS.length },
          { value: 'clientes',  label: 'Clientes' },
        ]}
        style={{ marginBottom: 'var(--s-5)' }}
      />

      {tab === 'dashboard' && <DashboardTab goTo={goTo} setTab={setTab} />}
      {tab === 'niveles'   && <NivelesTab />}
      {tab === 'referidos' && <ReferidosTab goTo={goTo} />}
      {tab === 'clientes'  && <ClientesTab goTo={goTo} />}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Dashboard
// ════════════════════════════════════════════════════════════════
function DashboardTab({ goTo, setTab }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const F = window.FidelizacionData;
  const R = window.ERPRates;
  const st = F.programStats();
  const counts = F.tierCounts();
  const totalClients = counts.reduce((s, c) => s + c.count, 0);
  const top = F.topReferrers(5);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
        <U.KPI label="Clientes activos" value={totalClients} delta={`${counts.find(c => c.tier.id === 'platinum')?.count || 0} Platinum · ${counts.find(c => c.tier.id === 'gold')?.count || 0} Gold`} tone="wine" icon={I.star(18)} />
        <U.KPI label="Referidos activos" value={st.activos} delta={`${st.total} en el programa`} tone="info" icon={I.users(18)} />
        <U.KPI label="Créditos emitidos" value={R.fmtUsd(st.creditsIssued)} delta={`${st.acreditados} acreditados`} tone="success" icon={I.spark(18)} />
        <U.KPI label="Tasa de conversión" value={`${st.convRate.toFixed(0)}%`} delta="referido → primer embarque" tone="warning" icon={I.chart(18)} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Distribución por nivel */}
        <U.Card padded>
          <div className="eyebrow eyebrow-wine" style={{ marginBottom: 14 }}>DISTRIBUCIÓN POR NIVEL</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {counts.map(({ tier, count }) => {
              const pct = totalClients ? (count / totalClients) * 100 : 0;
              return (
                <div key={tier.id} onClick={() => setTab('niveles')} style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 3, background: tier.color }} />
                      <span style={{ font: '700 13px/1 var(--f-sans)', color: 'var(--ink)' }}>{tier.label}</span>
                    </div>
                    <span style={{ font: '800 13px/1 var(--f-mono)', color: 'var(--ink)' }}>{count}</span>
                  </div>
                  <div style={{ height: 8, background: 'var(--bg-elevated)', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: tier.color, borderRadius: 999, transition: 'width var(--dur-slow) var(--ease)' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </U.Card>

        {/* Top referrers */}
        <U.Card padded={false}>
          <div style={{ padding: '16px 20px 14px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="eyebrow eyebrow-wine">EMBAJADORES · TOP REFERIDORES</div>
            <button onClick={() => setTab('referidos')} style={{ font: '600 12px/1 var(--f-sans)', color: 'var(--wine)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>Ver todos {I.arrowR(11)}</button>
          </div>
          <div>
            {top.map((t, i) => {
              const tier = t.client ? F.tierOf(t.client.billed) : null;
              return (
                <div key={t.markbox} onClick={() => goTo('clients', t.markbox)} style={{
                  display: 'grid', gridTemplateColumns: '28px 1fr auto auto', gap: 12, alignItems: 'center',
                  padding: '12px 20px', borderTop: i > 0 ? '1px solid var(--border)' : 0, cursor: 'pointer',
                }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-elevated)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <span style={{ font: '900 14px/1 var(--f-display)', color: i === 0 ? 'var(--wine)' : 'var(--ink-mute)' }}>{i + 1}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ font: '600 12.5px/1.2 var(--f-sans)', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.client?.company || t.markbox}</div>
                    <code style={{ font: '500 10.5px/1 var(--f-mono)', color: 'var(--ink-mute)' }}>{t.markbox}</code>
                  </div>
                  {tier && <U.Badge tone={tier.tone} size="sm">{tier.label}</U.Badge>}
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ font: '800 13px/1 var(--f-mono)', color: 'var(--ink)' }}>{t.acreditados}<span style={{ font: '500 10px var(--f-sans)', color: 'var(--ink-mute)' }}>/{t.total}</span></div>
                    <div style={{ font: '500 9.5px/1 var(--f-sans)', color: 'var(--success)', marginTop: 2 }}>{window.ERPRates.fmtUsd(t.credits)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </U.Card>
      </div>

      {/* Cómo funciona */}
      <U.Card padded>
        <div className="eyebrow eyebrow-wine" style={{ marginBottom: 14 }}>CÓMO FUNCIONA EL PROGRAMA</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {[
            { n: '1', t: 'El cliente comparte su código', d: 'Cada MARKBOX tiene un código de referido único (ej. REF-5452) que comparte por WhatsApp o el portal.' },
            { n: '2', t: 'El referido importa', d: `Al registrarse y hacer su primer embarque, el referido recibe ${window.ERPRates.fmtUsd(F.REFERRAL_RULES.referredReward)} de descuento.` },
            { n: '3', t: 'Ambos ganan', d: `Quien refiere recibe ${window.ERPRates.fmtUsd(F.REFERRAL_RULES.referrerReward)} de crédito acreditado a su próxima factura.` },
          ].map(s => (
            <div key={s.n} style={{ padding: '16px 18px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)' }}>
              <span style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--wine)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', font: '800 13px/1 var(--f-display)', marginBottom: 10 }}>{s.n}</span>
              <div style={{ font: '700 13px/1.3 var(--f-sans)', color: 'var(--ink)', marginBottom: 5 }}>{s.t}</div>
              <div style={{ font: '500 11.5px/1.5 var(--f-sans)', color: 'var(--ink-soft)' }}>{s.d}</div>
            </div>
          ))}
        </div>
      </U.Card>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Niveles (tiers)
// ════════════════════════════════════════════════════════════════
function NivelesTab() {
  const U = window.ERPUI;
  const I = window.Icon;
  const F = window.FidelizacionData;
  const R = window.ERPRates;
  const counts = F.tierCounts();

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
      {F.TIERS.map(t => {
        const count = counts.find(c => c.tier.id === t.id)?.count || 0;
        return (
          <U.Card key={t.id} padded style={{ borderTop: `3px solid ${t.color}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ font: '900 20px/1 var(--f-display)', color: t.color }}>{t.label}</span>
              <U.Badge tone={t.tone} size="sm">{count} {count === 1 ? 'cliente' : 'clientes'}</U.Badge>
            </div>
            <div style={{ font: '500 12px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginBottom: 14 }}>
              {t.min === 0 ? 'Hasta ' + R.fmtUsd(F.TIERS[1].min) : 'Desde ' + R.fmtUsd(t.min)} <span style={{ color: 'var(--ink-mute)' }}>· facturación anual</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {t.benefits.map((b, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <span style={{ color: t.color, flexShrink: 0, marginTop: 1 }}>{I.check(13)}</span>
                  <span style={{ font: '500 12.5px/1.4 var(--f-sans)', color: 'var(--ink)' }}>{b}</span>
                </div>
              ))}
            </div>
          </U.Card>
        );
      })}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Referidos
// ════════════════════════════════════════════════════════════════
function ReferidosTab({ goTo }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const F = window.FidelizacionData;
  const R = window.ERPRates;
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [selected, setSelected] = React.useState(null);
  const clients = window.ERPData?.CLIENTS || [];

  const filtered = F.REFERRALS.filter(r => statusFilter === 'all' || r.status === statusFilter)
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div>
      <U.Toolbar
        filters={
          <U.Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} options={[
            { value: 'all', label: 'Todos los estados' },
            ...F.REFERRAL_STEPS.map(s => ({ value: s, label: F.REFERRAL_STATUS[s].label })),
          ]} style={{ minWidth: 200 }} />
        }
        actions={<U.Btn variant="primary" size="sm" icon={I.plus(12)}>Registrar referido</U.Btn>}
      />

      <U.Card padded={false}>
        <div style={{
          display: 'grid', gridTemplateColumns: '110px 1fr 1fr 110px 130px 110px', gap: 14,
          padding: '10px 18px', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)',
          font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase',
        }}>
          <span>Referido</span>
          <span>Quien refiere</span>
          <span>Nuevo cliente</span>
          <span>Fecha</span>
          <span>Estado</span>
          <span style={{ textAlign: 'right' }}>Crédito</span>
        </div>
        {filtered.map((r, i) => {
          const referrer = clients.find(c => c.markbox === r.referrer);
          const stt = F.REFERRAL_STATUS[r.status];
          const isSel = selected === r.id;
          return (
            <div key={r.id} onClick={() => setSelected(r.id)} style={{
              display: 'grid', gridTemplateColumns: '110px 1fr 1fr 110px 130px 110px', gap: 14, alignItems: 'center',
              padding: '12px 18px', cursor: 'pointer', borderTop: i > 0 ? '1px solid var(--border)' : 0,
              background: isSel ? 'var(--wine-tint)' : 'transparent', transition: 'background var(--dur-fast) var(--ease)',
            }}
              onMouseEnter={(e) => { if (!isSel) e.currentTarget.style.background = 'var(--bg-elevated)'; }}
              onMouseLeave={(e) => { if (!isSel) e.currentTarget.style.background = 'transparent'; }}
            >
              <code style={{ font: '700 11.5px/1 var(--f-mono)', color: 'var(--ink)' }}>{r.id}</code>
              <div style={{ minWidth: 0 }}>
                <div style={{ font: '600 12.5px/1.2 var(--f-sans)', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{referrer?.company || r.referrer}</div>
                <code style={{ font: '500 10.5px/1 var(--f-mono)', color: 'var(--wine)' }}>{F.referralCode(r.referrer)}</code>
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ font: '600 12.5px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{r.referredName}</div>
                <div style={{ font: '500 10.5px/1.3 var(--f-sans)', color: 'var(--ink-mute)' }}>{r.referredCompany}</div>
              </div>
              <div style={{ font: '500 11px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>{r.date.slice(5)}</div>
              <U.Badge tone={stt.tone} size="sm" dot>{stt.label}</U.Badge>
              <div style={{ textAlign: 'right', font: '700 12px/1 var(--f-mono)', color: r.status === 'acreditado' ? 'var(--success)' : 'var(--ink-mute)' }}>
                {r.status === 'acreditado' ? R.fmtUsd(r.rewardUsd) : '—'}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div style={{ padding: '40px 20px', textAlign: 'center', font: '500 13px/1.5 var(--f-sans)', color: 'var(--ink-mute)' }}>Sin referidos con ese estado.</div>
        )}
      </U.Card>

      <ReferralDrawer
        ref0={selected ? F.REFERRALS.find(r => r.id === selected) : null}
        onClose={() => setSelected(null)}
        goTo={goTo}
      />
    </div>
  );
}

function ReferralDrawer({ ref0, onClose, goTo }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const F = window.FidelizacionData;
  const R = window.ERPRates;
  if (!ref0) return null;
  const clients = window.ERPData?.CLIENTS || [];
  const referrer = clients.find(c => c.markbox === ref0.referrer);
  const stt = F.REFERRAL_STATUS[ref0.status];

  return (
    <U.Drawer
      open={!!ref0}
      onClose={onClose}
      title={ref0.id}
      subtitle={`${ref0.referredName} · referido por ${referrer?.company || ref0.referrer}`}
      width={620}
      actions={
        <>
          {ref0.lead && <U.Btn variant="secondary" icon={I.spark(13)} onClick={() => goTo('leads')}>Ver en CRM</U.Btn>}
          {ref0.status === 'primer-embarque' && <U.Btn variant="primary" icon={I.check(13)}>Acreditar {R.fmtUsd(F.REFERRAL_RULES.referrerReward)}</U.Btn>}
          {ref0.status !== 'primer-embarque' && <U.Btn variant="primary" onClick={onClose}>Cerrar</U.Btn>}
        </>
      }
    >
      {/* Timeline */}
      <U.Card padded style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {F.REFERRAL_STEPS.map((s, i) => {
            const done = i <= stt.step;
            const meta = F.REFERRAL_STATUS[s];
            return (
              <React.Fragment key={s}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, flexShrink: 0, width: 64 }}>
                  <span style={{ width: 28, height: 28, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: done ? 'var(--wine)' : 'var(--bg-elevated)', color: done ? '#fff' : 'var(--ink-mute)', border: done ? 'none' : '1px solid var(--border)' }}>
                    {done ? I.check(14) : <span style={{ font: '700 11px/1 var(--f-sans)' }}>{i + 1}</span>}
                  </span>
                  <span style={{ font: `${i === stt.step ? '700' : '500'} 10px/1.2 var(--f-sans)`, color: i === stt.step ? 'var(--wine)' : done ? 'var(--ink)' : 'var(--ink-mute)', textAlign: 'center' }}>{meta.label}</span>
                </div>
                {i < F.REFERRAL_STEPS.length - 1 && <div style={{ flex: 1, height: 2, background: i < stt.step ? 'var(--wine)' : 'var(--border)', marginBottom: 18 }} />}
              </React.Fragment>
            );
          })}
        </div>
      </U.Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 }}>
        <U.Field label="Quien refiere" value={referrer?.company || ref0.referrer} />
        <U.Field label="Código usado" value={F.referralCode(ref0.referrer)} mono />
        <U.Field label="Nuevo cliente" value={ref0.referredName} />
        <U.Field label="Empresa" value={ref0.referredCompany} />
        <U.Field label="Fecha" value={ref0.date} mono />
        <U.Field label="Estado" value={<U.Badge tone={stt.tone} dot>{stt.label}</U.Badge>} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ padding: '14px 16px', background: 'var(--success-bg)', borderRadius: 'var(--r-md)' }}>
          <div style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--success)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Crédito a quien refiere</div>
          <div style={{ font: '900 20px/1 var(--f-display)', color: 'var(--ink)' }}>{R.fmtUsd(F.REFERRAL_RULES.referrerReward)}</div>
          <div style={{ font: '500 10.5px/1.3 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 4 }}>{ref0.status === 'acreditado' ? 'Acreditado ✓' : 'Al primer embarque del referido'}</div>
        </div>
        <div style={{ padding: '14px 16px', background: 'var(--info-bg)', borderRadius: 'var(--r-md)' }}>
          <div style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--info)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Descuento al referido</div>
          <div style={{ font: '900 20px/1 var(--f-display)', color: 'var(--ink)' }}>{R.fmtUsd(F.REFERRAL_RULES.referredReward)}</div>
          <div style={{ font: '500 10.5px/1.3 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 4 }}>En su primer embarque DDP</div>
        </div>
      </div>
    </U.Drawer>
  );
}

// ════════════════════════════════════════════════════════════════
// Clientes (loyalty)
// ════════════════════════════════════════════════════════════════
function ClientesTab({ goTo }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const F = window.FidelizacionData;
  const R = window.ERPRates;
  const [search, setSearch] = React.useState('');

  const rows = F.clientsWithTier()
    .filter(c => !search || c.company.toLowerCase().includes(search.toLowerCase()) || c.markbox.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => b.billed - a.billed);

  return (
    <div>
      <U.Toolbar search={search} onSearchChange={setSearch} searchPlaceholder="Buscar cliente o MARKBOX…" />

      <U.Card padded={false}>
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 110px 130px 1.2fr 130px 90px', gap: 14,
          padding: '10px 18px', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)',
          font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase',
        }}>
          <span>Cliente</span>
          <span>Nivel</span>
          <span style={{ textAlign: 'right' }}>Facturado</span>
          <span>Progreso al siguiente</span>
          <span style={{ textAlign: 'right' }}>Créditos</span>
          <span style={{ textAlign: 'right' }}>Referidos</span>
        </div>
        {rows.map((c, i) => {
          const prog = F.tierProgress(c.billed);
          const credits = F.creditsEarned(c.markbox);
          const refs = F.referralsByReferrer(c.markbox).length;
          return (
            <div key={c.markbox} onClick={() => goTo('clients', c.markbox)} style={{
              display: 'grid', gridTemplateColumns: '1fr 110px 130px 1.2fr 130px 90px', gap: 14, alignItems: 'center',
              padding: '12px 18px', cursor: 'pointer', borderTop: i > 0 ? '1px solid var(--border)' : 0,
            }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-elevated)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ font: '600 12.5px/1.2 var(--f-sans)', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.company}</div>
                <code style={{ font: '500 10.5px/1 var(--f-mono)', color: 'var(--ink-mute)' }}>{c.markbox}</code>
              </div>
              <U.Badge tone={c.tier.tone} size="sm">{c.tier.label}</U.Badge>
              <div style={{ textAlign: 'right', font: '700 12px/1 var(--f-mono)', color: 'var(--ink)' }}>{R.fmtUsd(c.billed)}</div>
              <div>
                {prog.next ? (
                  <>
                    <div style={{ height: 6, background: 'var(--bg-elevated)', borderRadius: 999, overflow: 'hidden', marginBottom: 4 }}>
                      <div style={{ height: '100%', width: `${prog.pct}%`, background: prog.next.color, borderRadius: 999 }} />
                    </div>
                    <div style={{ font: '500 9.5px/1 var(--f-sans)', color: 'var(--ink-mute)' }}>{R.fmtUsd(prog.toNext)} para {prog.next.label}</div>
                  </>
                ) : (
                  <U.Badge tone="wine" size="sm">Nivel máximo</U.Badge>
                )}
              </div>
              <div style={{ textAlign: 'right', font: '700 12px/1 var(--f-mono)', color: credits > 0 ? 'var(--success)' : 'var(--ink-mute)' }}>{credits > 0 ? R.fmtUsd(credits) : '—'}</div>
              <div style={{ textAlign: 'right', font: '700 12px/1 var(--f-mono)', color: refs > 0 ? 'var(--wine)' : 'var(--ink-mute)' }}>{refs || '—'}</div>
            </div>
          );
        })}
      </U.Card>
    </div>
  );
}

window.ModuleFidelizacion = ModuleFidelizacion;
