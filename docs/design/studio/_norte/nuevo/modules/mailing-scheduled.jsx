/* global React */
/* ── DTD ERP · Mailing · Cola de programados ────────────────── */
/* Lee window.__scheduledEmails (lo llena el Compose al "Programar"). */

function MailingScheduled() {
  const U = window.ERPUI;
  const I = window.Icon;
  const [tick, setTick] = React.useState(0);

  React.useEffect(() => {
    const fn = () => setTick(t => t + 1);
    window.addEventListener('dtd-scheduled-changed', fn);
    return () => window.removeEventListener('dtd-scheduled-changed', fn);
  }, []);

  const list = window.__scheduledEmails || [];

  const cancel = (id) => {
    window.__scheduledEmails = (window.__scheduledEmails || []).filter(x => x.id !== id);
    try { window.dispatchEvent(new CustomEvent('dtd-scheduled-changed')); } catch (e) {}
  };
  const sendNow = (id) => {
    const item = (window.__scheduledEmails || []).find(x => x.id === id);
    if (item) item.status = 'sent';
    setTick(t => t + 1);
  };

  if (list.length === 0) {
    return <U.EmptyState icon={I.clock(22)} title="Sin envíos programados" body="Cuando programés un correo desde Envío manual, aparece acá en cola hasta su fecha de envío." />;
  }

  const toneFor = (s) => s === 'sent' ? 'success' : 'wine';
  const labelFor = (s) => s === 'sent' ? 'enviado' : 'en cola';

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 'var(--s-5)' }}>
        <U.KPI label="En cola" value={String(list.filter(x => x.status === 'queued').length)} tone="wine" icon={I.clock(18)} />
        <U.KPI label="Programados (total)" value={String(list.length)} tone="info" icon={I.mail(18)} />
      </div>

      <U.Card padded={false}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
          <div className="eyebrow eyebrow-wine">COLA DE ENVÍOS · {list.length}</div>
        </div>
        <div>
          {list.map((it, i) => (
            <div key={it.id} style={{
              display: 'grid', gridTemplateColumns: 'auto 1fr auto auto', gap: 14, alignItems: 'center',
              padding: '14px 18px', borderTop: i > 0 ? '1px solid var(--border)' : 0,
            }}>
              <span style={{ width: 36, height: 36, borderRadius: 'var(--r-md)', background: 'var(--wine-tint)', color: 'var(--wine)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{it.channel === 'whatsapp' ? I.globe(16) : I.mail(16)}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ font: '600 13.5px/1.3 var(--f-sans)', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.subject}</div>
                <div style={{ font: '500 11.5px/1.3 var(--f-mono)', color: 'var(--ink-soft)', marginTop: 3 }}>{it.to}{it.attachments > 0 ? ` · ${it.attachments} adj.` : ''}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ font: '700 12px/1 var(--f-mono)', color: 'var(--ink)' }}>{it.date}</div>
                <div style={{ font: '500 11px/1 var(--f-mono)', color: 'var(--ink-soft)', marginTop: 4 }}>{it.time} · {it.tz}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <U.Badge tone={toneFor(it.status)} size="sm" dot>{labelFor(it.status)}</U.Badge>
                {it.status === 'queued' && (
                  <>
                    <U.Btn variant="secondary" size="sm" onClick={() => sendNow(it.id)}>Enviar ya</U.Btn>
                    <button onClick={() => cancel(it.id)} title="Cancelar" style={{ width: 30, height: 30, borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--danger)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{I.trash ? I.trash(13) : '×'}</button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </U.Card>
    </div>
  );
}

window.MailingScheduled = MailingScheduled;
