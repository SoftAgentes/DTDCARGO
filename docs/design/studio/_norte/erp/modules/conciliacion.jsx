/* global React */
/* ── DTD ERP · Conciliación Bancaria (v1.1) ─────────────────── */
/* Flow: subir extracto → revisar matches auto-sugeridos →      */
/* confirmar/corregir → exportar reporte.                       */

const RECONCILE_LS_KEY = 'dtd_reconcile_v1';

// ── Mock seed: un extracto bancario procesado ─────────────────
const SEED_STATEMENT = window.ERPData.BANK_STATEMENTS;

const STATUS_TONE_REC = {
  pending:    'warning',
  matched:    'success',
  manual:     'info',
  rejected:   'danger',
  flagged:    'danger',
};

const CONFIDENCE_TONE = {
  high:   'success',
  medium: 'warning',
  low:    'danger',
};

// ── Hook de persistencia ──────────────────────────────────────
function useReconciliation() {
  const [state, setState] = React.useState(() => {
    try {
      const raw = localStorage.getItem(RECONCILE_LS_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    // Initialize: all movements with auto-match start as 'pending', no-match as 'manual'
    return {
      statement: SEED_STATEMENT,
      decisions: SEED_STATEMENT.movements.reduce((acc, m) => {
        acc[m.id] = { status: m.status || 'pending', note: '' };
        return acc;
      }, {}),
    };
  });
  React.useEffect(() => {
    try { localStorage.setItem(RECONCILE_LS_KEY, JSON.stringify(state)); } catch (e) {}
  }, [state]);
  return [state, setState];
}

// ════════════════════════════════════════════════════════════════
function ModuleConciliacion({ goTo }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const [state, setState] = useReconciliation();
  const [tab, setTab] = React.useState('review');
  const [detail, setDetail] = React.useState(null);

  const { statement, decisions } = state;
  const BANK_COA = '1.04.01'; // Banesco USD

  const setDecision = (id, patch) => {
    setState(s => ({
      ...s,
      decisions: { ...s.decisions, [id]: { ...s.decisions[id], ...patch } },
    }));
  };

  // Confirmar match → liga/postea/crea el asiento en el mayor
  const confirmMatch = (m, extra) => {
    const C = window.ContabilidadData;
    let ledger = null;
    if (C && C.reconcileBankMovement) {
      const existing = C.findEntryByRef(m.ref);
      const needsMutation = !existing || existing.status === 'borrador';
      const unlocked = C.isUnlocked ? C.isUnlocked() : false;
      if (needsMutation && !unlocked) {
        ledger = { mode: existing ? 'needs-post' : 'needs-create' };
      } else {
        ledger = C.reconcileBankMovement(m, BANK_COA);
      }
    }
    setDecision(m.id, { status: 'matched', ...(extra || {}), ledger });
  };
  // Reintentar la contabilización (cuando hacía falta desbloquear)
  const postToLedger = (m) => {
    const C = window.ContabilidadData;
    if (!C || !C.reconcileBankMovement) return;
    if (C.isUnlocked && !C.isUnlocked()) { alert('Activa "Edición abierta" en Contabilidad (header del módulo) para contabilizar.'); return; }
    const ledger = C.reconcileBankMovement(m, BANK_COA);
    setDecision(m.id, { ledger });
  };

  const movs = statement.movements.map(m => ({ ...m, decision: decisions[m.id] || { status: 'pending' } }));

  const groups = {
    review:   movs.filter(m => m.decision.status === 'pending'),
    matched:  movs.filter(m => m.decision.status === 'matched'),
    manual:   movs.filter(m => m.decision.status === 'manual'),
    rejected: movs.filter(m => m.decision.status === 'rejected'),
    all:      movs,
  };

  const totalCredit = movs.filter(m => m.kind === 'credit').reduce((s, m) => s + m.amount, 0);
  const totalDebit  = movs.filter(m => m.kind === 'debit').reduce((s, m) => s + m.amount, 0);
  const reconciledPct = Math.round((groups.matched.length / movs.length) * 100);

  return (
    <div>
      <U.PageHeader
        eyebrow={`EXTRACTO · ${statement.period}`}
        title="Conciliación bancaria"
        subtitle={`${statement.bank} · cuenta ${statement.account} · ${movs.length} movimientos importados · subido por ${statement.uploadedBy}`}
        actions={
          <>
            <U.Btn variant="secondary" icon={I.download(14)}>Exportar reporte</U.Btn>
            <U.Btn variant="primary" icon={I.upload(14)}>Subir nuevo extracto</U.Btn>
          </>
        }
      />

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 'var(--s-6)' }}>
        <U.KPI label="Movimientos importados" value={movs.length} delta={statement.fileName} tone="wine" icon={I.invoice(18)} />
        <U.KPI label="Conciliados"            value={groups.matched.length}  delta={`${reconciledPct}% del extracto`} tone="success" icon={I.check(18)} />
        <U.KPI label="Pendientes revisión"    value={groups.review.length}   delta={groups.review.length > 0 ? 'requieren acción' : 'todos al día'} tone={groups.review.length > 0 ? 'warning' : 'success'} icon={I.warn(18)} />
        <U.KPI label="Total reconciliado"     value={`$${(groups.matched.reduce((s, m) => s + m.amount, 0) / 1000).toFixed(1)}K`} delta={`+$${(totalCredit / 1000).toFixed(0)}K · −$${(totalDebit / 1000).toFixed(0)}K`} tone="info" icon={I.chart(18)} />
      </div>

      <div style={{ marginBottom: 14 }}>
        <U.Tabs
          value={tab}
          onChange={(v) => { setTab(v); setDetail(null); }}
          items={[
            { value: 'review',   label: 'A revisar',    count: groups.review.length },
            { value: 'matched',  label: 'Conciliados',  count: groups.matched.length },
            { value: 'manual',   label: 'Sin sugerencia', count: groups.manual.length },
            { value: 'rejected', label: 'Rechazados',   count: groups.rejected.length },
            { value: 'all',      label: 'Todo el extracto', count: movs.length },
          ]}
        />
      </div>

      <BalanceStrip statement={statement} totalCredit={totalCredit} totalDebit={totalDebit} />

      <div style={{ display: 'grid', gridTemplateColumns: detail ? '1fr 420px' : '1fr', gap: 16, marginTop: 16 }}>
        <div>
          {groups[tab].length === 0 ? (
            <U.EmptyState
              icon={I.check(24)}
              title={tab === 'review' ? '¡Todo conciliado!' : 'Sin movimientos en esta vista'}
              body={tab === 'review' ? 'Todos los movimientos del extracto fueron revisados. Puedes exportar el reporte cuando quieras.' : 'Prueba con otra pestaña.'}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {groups[tab].map(m => (
                <MovementRow
                  key={m.id}
                  m={m}
                  active={detail === m.id}
                  onClick={() => setDetail(m.id === detail ? null : m.id)}
                  onMatch={() => confirmMatch(m)}
                  onReject={() => setDecision(m.id, { status: 'rejected' })}
                  onManual={() => setDecision(m.id, { status: 'manual' })}
                  onPostLedger={() => postToLedger(m)}
                />
              ))}
            </div>
          )}
        </div>
        {detail && (() => {
          const mv = movs.find(x => x.id === detail);
          if (!mv) return null;
          return <MovementDetail
            m={mv}
            onClose={() => setDetail(null)}
            setDecision={(patch) => setDecision(mv.id, patch)}
            confirmMatch={(extra) => confirmMatch(mv, extra)}
            postToLedger={() => postToLedger(mv)}
          />;
        })()}
      </div>
    </div>
  );
}

// ── Balance strip (opening, totals, closing) ─────────────────
function BalanceStrip({ statement, totalCredit, totalDebit }) {
  const U = window.ERPUI;
  const expectedClosing = statement.openingBalance + totalCredit - totalDebit;
  const diff = statement.closingBalance - expectedClosing;
  return (
    <U.Card padded style={{ background: 'var(--bg-sidebar)', color: '#fff', border: 0 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 24, alignItems: 'center' }}>
        {[
          { label: 'Saldo inicial',          v: statement.openingBalance, c: 'rgba(255,255,255,0.7)' },
          { label: 'Créditos (entradas)',    v: totalCredit,             c: 'var(--success)', sign: '+' },
          { label: 'Débitos (salidas)',      v: totalDebit,              c: 'var(--wine-soft)', sign: '−' },
          { label: 'Saldo final',            v: statement.closingBalance, c: '#fff' },
          { label: 'Diferencia',             v: diff,                    c: diff === 0 ? 'var(--success)' : 'var(--warning)', sign: diff >= 0 ? '+' : '' },
        ].map((b, i, arr) => (
          <div key={b.label} style={{
            borderRight: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.08)' : 0,
            paddingRight: i < arr.length - 1 ? 16 : 0,
          }}>
            <div style={{ font: '700 10.5px/1 var(--f-sans)', color: 'rgba(255,255,255,0.55)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>{b.label}</div>
            <div style={{ font: '900 18px/1 var(--f-display)', color: b.c, letterSpacing: '-0.01em' }}>
              {b.sign || ''}${Math.abs(b.v).toLocaleString('es-VE')}
            </div>
          </div>
        ))}
      </div>
    </U.Card>
  );
}

// ── Movement row ─────────────────────────────────────────────
function MovementRow({ m, active, onClick, onMatch, onReject, onManual, onPostLedger }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const sug = m.suggested;
  const dec = m.decision;
  const isPending = dec.status === 'pending';
  const isMatched = dec.status === 'matched';
  const ledger = dec.ledger;
  const ledgerLabel = ledger && (ledger.mode === 'linked' ? 'ligado' : ledger.mode === 'created' ? 'asiento creado' : ledger.mode === 'posted-draft' ? 'borrador posteado' : null);

  return (
    <div
      onClick={onClick}
      style={{
        background: active ? 'var(--wine-tint)' : 'var(--bg-surface)',
        border: `1px solid ${active ? 'var(--wine)' : 'var(--border)'}`,
        borderRadius: 'var(--r-lg)', padding: '14px 18px',
        cursor: 'pointer',
        transition: 'background var(--dur-fast) var(--ease), border-color var(--dur-fast) var(--ease)',
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--bg-elevated)'; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'var(--bg-surface)'; }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 1fr 130px 140px', gap: 14, alignItems: 'center' }}>
        {/* Date + ref */}
        <div>
          <div style={{ font: '700 11.5px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>{m.date.slice(5)}</div>
          <code style={{ font: '500 10px/1 var(--f-mono)', color: 'var(--ink-mute)', marginTop: 4, display: 'inline-block' }}>{m.ref}</code>
        </div>

        {/* Bank movement description */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <U.Badge tone={m.kind === 'credit' ? 'success' : 'wine'} size="sm" dot>
              {m.kind === 'credit' ? 'crédito' : 'débito'}
            </U.Badge>
            {m.flagged && <U.Badge tone="danger" size="sm">FLAGGED</U.Badge>}
          </div>
          <div style={{ font: '600 12.5px/1.3 var(--f-sans)', color: 'var(--ink)' }}>{m.desc}</div>
        </div>

        {/* Suggested match */}
        <div>
          {sug ? (
            <div style={{
              padding: '8px 10px',
              background: `var(--${CONFIDENCE_TONE[sug.confidence]}-bg)`,
              borderLeft: `3px solid var(--${CONFIDENCE_TONE[sug.confidence]})`,
              borderRadius: 'var(--r-sm)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                <span style={{ font: '700 9.5px/1 var(--f-sans)', color: `var(--${CONFIDENCE_TONE[sug.confidence]})`, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  {sug.confidence === 'high' ? '✓ Match seguro' : sug.confidence === 'medium' ? '~ Match probable' : '? Match dudoso'}
                </span>
                {sug.partial && <U.Badge tone="info" size="sm">parcial</U.Badge>}
              </div>
              <code style={{ font: '700 12px/1 var(--f-mono)', color: 'var(--ink)' }}>{sug.ref}</code>
              <div style={{ font: '500 11px/1.3 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 3 }}>{sug.client || sug.vendor}</div>
            </div>
          ) : (
            <div style={{ font: '500 11.5px/1.4 var(--f-sans)', color: 'var(--ink-mute)', fontStyle: 'italic' }}>
              Sin sugerencia automática · matchear manual
            </div>
          )}
        </div>

        {/* Amount */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ font: '900 18px/1 var(--f-display)', color: m.kind === 'credit' ? 'var(--success)' : 'var(--ink)' }}>
            {m.kind === 'credit' ? '+' : '−'}${m.amount.toLocaleString('es-VE')}
          </div>
          <div style={{ font: '600 10px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.1em', marginTop: 4 }}>USD</div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }} onClick={(e) => e.stopPropagation()}>
          {isPending && sug && (
            <U.Btn size="sm" variant="primary" icon={I.check(11)} onClick={onMatch}>Confirmar</U.Btn>
          )}
          {isPending && !sug && (
            <U.Btn size="sm" variant="secondary" onClick={onClick}>Buscar match</U.Btn>
          )}
          {isMatched && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
              <U.Badge tone="success" dot>✓ conciliado</U.Badge>
              {ledgerLabel && <code style={{ font: '600 9.5px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>→ {ledger.entryId} · {ledgerLabel}</code>}
              {ledger && (ledger.mode === 'needs-create' || ledger.mode === 'needs-post') && (
                <U.Btn size="sm" variant="secondary" icon={I.check(11)} onClick={onPostLedger}>Contabilizar al mayor</U.Btn>
              )}
            </div>
          )}
          {dec.status === 'rejected' && (
            <U.Badge tone="danger" dot>rechazado</U.Badge>
          )}
          {dec.status === 'manual' && (
            <U.Badge tone="info" dot>manual</U.Badge>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Movement detail panel ────────────────────────────────────
function MovementDetail({ m, onClose, setDecision, confirmMatch, postToLedger }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const D = window.ERPData;
  const [search, setSearch] = React.useState('');
  const candidates = (D.INVOICES || [])
    .filter(inv => !search || inv.id.toLowerCase().includes(search.toLowerCase()) || inv.clientName?.toLowerCase().includes(search.toLowerCase()))
    .slice(0, 5);

  return (
    <aside style={{
      background: 'var(--bg-surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--r-lg)', position: 'sticky', top: 76,
      maxHeight: 'calc(100vh - 100px)', overflowY: 'auto',
      display: 'flex', flexDirection: 'column',
    }}>
      <header style={{ padding: '16px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div className="eyebrow eyebrow-wine">MOVIMIENTO {m.id}</div>
          <div style={{ font: '900 16px/1 var(--f-display)', color: 'var(--ink)', marginTop: 6 }}>${m.amount.toLocaleString('es-VE')} · {m.kind}</div>
        </div>
        <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 'var(--r-md)', color: 'var(--ink-soft)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{I.close(14)}</button>
      </header>

      <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>DESCRIPCIÓN BANCARIA</div>
          <div style={{ padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', font: '500 12.5px/1.4 var(--f-mono)', color: 'var(--ink)' }}>{m.desc}</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <U.Field label="Fecha" value={m.date} mono />
          <U.Field label="Ref. bancaria" value={m.ref} mono />
        </div>

        {m.suggested && (
          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>SUGERENCIA AUTOMÁTICA</div>
            <div style={{
              padding: '12px 14px',
              background: `var(--${CONFIDENCE_TONE[m.suggested.confidence]}-bg)`,
              borderLeft: `4px solid var(--${CONFIDENCE_TONE[m.suggested.confidence]})`,
              borderRadius: 'var(--r-md)',
            }}>
              <div style={{ font: '700 11px/1 var(--f-sans)', color: `var(--${CONFIDENCE_TONE[m.suggested.confidence]})`, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
                {m.suggested.confidence === 'high' ? 'CONFIANZA ALTA · 96%' : m.suggested.confidence === 'medium' ? 'CONFIANZA MEDIA · 72%' : 'CONFIANZA BAJA · 48%'}
              </div>
              <code style={{ font: '900 14px/1 var(--f-mono)', color: 'var(--ink)' }}>{m.suggested.ref}</code>
              <div style={{ font: '600 12.5px/1.3 var(--f-sans)', color: 'var(--ink)', marginTop: 6 }}>{m.suggested.client || m.suggested.vendor}</div>
              <div style={{ font: '500 11px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 6 }}>
                Match basado en: monto exacto · cliente identificado en descripción · fecha dentro de ventana de 7 días.
              </div>
            </div>
          </div>
        )}

        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>BUSCAR MATCH MANUAL</div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar factura por ID o cliente…"
            style={{
              width: '100%', height: 36, padding: '0 12px',
              background: 'var(--bg-base)', border: '1px solid var(--border)',
              borderRadius: 'var(--r-md)', outline: 'none',
              font: '500 12.5px/1 var(--f-sans)', color: 'var(--ink)',
              marginBottom: 10,
            }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
            {candidates.map(inv => (
              <button key={inv.id} onClick={() => confirmMatch({ manualMatch: inv.id })} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 10px', borderRadius: 'var(--r-md)',
                background: 'var(--bg-elevated)', textAlign: 'left',
                border: '1px solid transparent',
                transition: 'background var(--dur-fast) var(--ease), border-color var(--dur-fast) var(--ease)',
              }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--wine)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'transparent'; }}
              >
                <code style={{ font: '700 11px/1 var(--f-mono)', color: 'var(--wine)', minWidth: 90 }}>{inv.id}</code>
                <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <div style={{ font: '600 11.5px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{inv.clientName}</div>
                  <div style={{ font: '500 10.5px/1 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 3 }}>${(inv.amount || 0).toLocaleString('es-VE')} · {inv.status}</div>
                </div>
              </button>
            ))}
            {candidates.length === 0 && (
              <div style={{ font: '500 12px/1.4 var(--f-sans)', color: 'var(--ink-mute)', textAlign: 'center', padding: '10px 0' }}>
                Sin resultados.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action footer */}
      <footer style={{ padding: '14px 18px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--bg-base)' }}>
        {m.decision.ledger && m.decision.ledger.entryId && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: 'var(--success-bg)', borderRadius: 'var(--r-md)' }}>
            <span style={{ font: '600 11px/1.2 var(--f-sans)', color: 'var(--ink)' }}>Asiento en el mayor</span>
            <code style={{ font: '700 11px/1 var(--f-mono)', color: 'var(--success)' }}>{m.decision.ledger.entryId}</code>
          </div>
        )}
        {m.decision.ledger && (m.decision.ledger.mode === 'needs-create' || m.decision.ledger.mode === 'needs-post') && (
          <U.Btn variant="secondary" full icon={I.check(13)} onClick={postToLedger}>Contabilizar al mayor</U.Btn>
        )}
        {m.suggested && m.decision.status === 'pending' && (
          <U.Btn variant="primary" full icon={I.check(13)} onClick={() => confirmMatch()}>Confirmar sugerencia</U.Btn>
        )}
        <U.Btn variant="secondary" full onClick={() => setDecision({ status: 'manual' })}>Marcar como manual</U.Btn>
        <U.Btn variant="ghost" full style={{ color: 'var(--danger)' }} onClick={() => setDecision({ status: 'rejected' })}>Rechazar movimiento</U.Btn>
      </footer>
    </aside>
  );
}

window.ModuleConciliacion = ModuleConciliacion;
