/* global React */
/* ── DTD ERP · Mailing · Reglas automáticas ─────────────────── */

function MailingRules() {
  const D = window.ERPData;
  const U = window.ERPUI;
  const [audience, setAudience] = React.useState('client'); // 'client' | 'internal'

  const rulesClient = [
    { trigger: 'Cotización · creada y enviada',         action: '"Cotización enviada"',         channel: 'email',    delay: 'inmediato', active: true },
    { trigger: 'Embarque · estado → "zarpado"',          action: '"Embarque confirmado"',         channel: 'email',    delay: 'inmediato', active: true },
    { trigger: 'Embarque · ETA estimada se atrasa +1d', action: '"ETA en riesgo"',               channel: 'email+wa', delay: 'inmediato', active: true },
    { trigger: 'Embarque · estado → "entregado" / POD',  action: '"POD firmado"',                 channel: 'email',    delay: 'inmediato', active: true },
    { trigger: 'Cliente · alta nueva (MARKBOX asign.)',  action: '"Bienvenida MARKBOX"',          channel: 'email',    delay: 'inmediato', active: true },
    { trigger: 'Factura · vence en 3 días sin pago',    action: '"Recordatorio de pago" suave',  channel: 'email',    delay: '08:00 AM',  active: true },
    { trigger: 'Factura · 7 días vencida',              action: '"Recordatorio de pago" firme + cc agente', channel: 'email+wa', delay: '09:00 AM', active: true },
    { trigger: 'Embarque · paso por hito (Canal, etc.)', action: 'Aviso ETA · WhatsApp',          channel: 'wa',       delay: 'inmediato', active: true },
  ];

  const rulesInternal = [
    { trigger: 'Lead · creado (web/cotizador)',          action: 'Notificar al owner asignado',    channel: 'inapp+email', delay: 'inmediato', active: true },
    { trigger: 'Lead · sin contacto > 7 días',           action: 'Recordatorio al owner + Slack',  channel: 'inapp+slack', delay: '09:00 AM',  active: true },
    { trigger: 'Cotización · aceptada',                  action: 'Crear embarque + notificar ops', channel: 'inapp',       delay: 'inmediato', active: true },
    { trigger: 'Embarque · alerta ETA',                  action: 'Notificar a Operaciones VE',     channel: 'inapp+email', delay: 'inmediato', active: true },
    { trigger: 'Almacén CN · incidencia',                action: 'Alerta a Op. CN + admin',         channel: 'inapp+wa',    delay: 'inmediato', active: true },
    { trigger: 'Factura · 7+ días vencida',              action: 'Notificar a Contabilidad + comercial', channel: 'inapp+email', delay: '09:00 AM', active: true },
    { trigger: 'Usuario · login fallido x5',             action: 'Alertar admin (seguridad)',      channel: 'inapp+email', delay: 'inmediato', active: true },
    { trigger: 'Reporte diario · 18:00',                 action: 'Resumen operativo a Dirección',   channel: 'email',        delay: '18:00 PM',  active: true },
  ];

  const rules = audience === 'client' ? rulesClient : rulesInternal;
  const channelBadge = (c) => {
    const parts = c.split('+').map(p => p.trim());
    const map = { email: { l: 'Email', t: 'info' }, wa: { l: 'WhatsApp', t: 'success' }, inapp: { l: 'In-app', t: 'wine' }, slack: { l: 'Slack', t: 'neutral' } };
    return (
      <div style={{ display: 'inline-flex', gap: 4 }}>
        {parts.map((p, i) => <U.Badge key={i} tone={map[p]?.t || 'neutral'} size="sm">{map[p]?.l || p}</U.Badge>)}
      </div>
    );
  };

  return (
    <div>
      {/* Audience split */}
      <U.Card padded style={{ marginBottom: 'var(--s-5)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button onClick={() => setAudience('client')} style={{
            padding: 16, textAlign: 'left', borderRadius: 'var(--r-md)',
            background: audience === 'client' ? 'var(--wine-tint)' : 'transparent',
            border: `1px solid ${audience === 'client' ? 'var(--wine)' : 'var(--border)'}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ color: audience === 'client' ? 'var(--wine)' : 'var(--ink-soft)' }}>{window.Icon.users(18)}</span>
              <div style={{ font: '800 14px/1 var(--f-display)', color: 'var(--ink)' }}>Avisos al cliente externo</div>
              <U.Badge tone="wine" size="sm">{rulesClient.length}</U.Badge>
            </div>
            <div style={{ font: '500 12px/1.5 var(--f-sans)', color: 'var(--ink-soft)' }}>
              Notificaciones que reciben los clientes sobre sus envíos, cotizaciones y facturas. Email + WhatsApp.
            </div>
          </button>
          <button onClick={() => setAudience('internal')} style={{
            padding: 16, textAlign: 'left', borderRadius: 'var(--r-md)',
            background: audience === 'internal' ? 'var(--wine-tint)' : 'transparent',
            border: `1px solid ${audience === 'internal' ? 'var(--wine)' : 'var(--border)'}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ color: audience === 'internal' ? 'var(--wine)' : 'var(--ink-soft)' }}>{window.Icon.shield(18)}</span>
              <div style={{ font: '800 14px/1 var(--f-display)', color: 'var(--ink)' }}>Notificaciones al equipo interno</div>
              <U.Badge tone="info" size="sm">{rulesInternal.length}</U.Badge>
            </div>
            <div style={{ font: '500 12px/1.5 var(--f-sans)', color: 'var(--ink-soft)' }}>
              Alertas que reciben los empleados del ERP (campana, email, WhatsApp, Slack). Configurables por rol.
            </div>
          </button>
        </div>
      </U.Card>

      {/* Rules list */}
      <U.Card padded={false}>
        <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="eyebrow eyebrow-wine">{audience === 'client' ? 'CLIENTE' : 'INTERNO'} · {rules.length} REGLAS</div>
          <U.Btn variant="ghost" size="sm" icon={window.Icon.plus(13)}>Agregar</U.Btn>
        </div>
        <div>
          {rules.map((r, i) => (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '40px 1.4fr 1.6fr 130px 110px 90px',
              gap: 16, padding: '14px 18px',
              borderTop: i > 0 ? '1px solid var(--border)' : 0,
              alignItems: 'center',
            }}>
              <label style={{ display: 'inline-flex' }}>
                <input type="checkbox" defaultChecked={r.active} style={{ accentColor: 'var(--wine)', width: 16, height: 16, cursor: 'pointer' }} />
              </label>
              <div>
                <div style={{ font: '700 10px/1 var(--f-sans)', color: 'var(--wine)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>CUANDO</div>
                <div style={{ font: '600 13px/1.3 var(--f-sans)', color: 'var(--ink)', marginTop: 4 }}>{r.trigger}</div>
              </div>
              <div>
                <div style={{ font: '700 10px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>ENTONCES</div>
                <div style={{ font: '500 13px/1.3 var(--f-sans)', color: 'var(--ink)', marginTop: 4 }}>{r.action}</div>
              </div>
              <div>{channelBadge(r.channel)}</div>
              <div style={{ font: '600 11.5px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>{r.delay}</div>
              <U.Badge tone={r.active ? 'success' : 'neutral'} size="sm" dot>{r.active ? 'activa' : 'pausada'}</U.Badge>
            </div>
          ))}
        </div>
      </U.Card>
    </div>
  );
}

window.MailingRules = MailingRules;
