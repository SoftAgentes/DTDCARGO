/* global React */
/* ── DTD ERP · Mailing v2 (entry with tabs) ─────────────────── */

function ModuleMailing({ view, setView, goTo }) {
  const D = window.ERPData;
  const U = window.ERPUI;
  const [tab, setTab] = React.useState('templates');

  const tabs = [
    { value: 'templates',  label: 'Templates',     count: D.MAIL_TEMPLATES.length },
    { value: 'signatures', label: 'Firmas',        count: D.SIGNATURES.length },
    { value: 'compose',    label: 'Envío manual' },
    { value: 'scheduled',  label: 'Programados',    count: (window.__scheduledEmails || []).length || undefined },
    { value: 'rules',      label: 'Reglas auto.',  count: 8 },
    { value: 'config',     label: 'Configuración' },
    { value: 'logs',       label: 'Logs' },
  ];

  const headerSubtitle = {
    templates:  'Plantillas de email y WhatsApp · variables dinámicas · multi-idioma · test send.',
    signatures: 'Cada empleado configura su firma. 5 layouts oficiales del Brand Book DTD.',
    compose:    'Envío individual con plantilla + firma. Vista tipo Compose o modal rápido desde cualquier vista.',
    scheduled:  'Correos programados en cola. Se envían automáticamente en su fecha/hora. Puedes adelantarlos o cancelarlos.',
    rules:      'Eventos del ERP que disparan correos automáticos. Configurar destinatario cliente vs interno.',
    config:     'Proveedor de envío (Gmail · Outlook · SMTP · SendGrid · WhatsApp), límites y blacklist.',
    logs:       'Histórico de envíos. Estado de entrega, aperturas y rebotes.',
  }[tab];

  return (
    <div>
      <U.PageHeader
        title="Mailing & Notificaciones"
        subtitle={headerSubtitle}
        actions={<MailingHeaderActions tab={tab} />}
      />
      <U.Tabs value={tab} onChange={setTab} items={tabs} style={{ marginBottom: 'var(--s-5)' }} />
      <div key={tab} style={{ animation: 'erp-route-in 200ms var(--ease)' }}>
        {tab === 'templates'  && window.MailingTemplates   && <window.MailingTemplates />}
        {tab === 'signatures' && window.MailingSignatures  && <window.MailingSignatures />}
        {tab === 'compose'    && window.MailingCompose     && <window.MailingCompose />}
        {tab === 'scheduled'  && window.MailingScheduled   && <window.MailingScheduled />}
        {tab === 'rules'      && window.MailingRules       && <window.MailingRules />}
        {tab === 'config'     && window.MailingConfig      && <window.MailingConfig />}
        {tab === 'logs'        && window.MailingLogs        && <window.MailingLogs goTo={goTo} />}
      </div>
    </div>
  );
}

function MailingHeaderActions({ tab }) {
  const U = window.ERPUI;
  if (tab === 'templates')  return (<><U.Btn variant="secondary" icon={window.Icon.download(14)}>Exportar</U.Btn><U.Btn variant="primary" icon={window.Icon.plus(14)} onClick={() => window.__openMailingEditor?.('template-new')}>Nuevo template</U.Btn></>);
  if (tab === 'signatures') return (<U.Btn variant="primary" icon={window.Icon.plus(14)} onClick={() => window.__openMailingEditor?.('signature-new')}>Editar mi firma</U.Btn>);
  if (tab === 'compose')    return null;
  if (tab === 'scheduled')  return null;
  if (tab === 'rules')      return (<U.Btn variant="primary" icon={window.Icon.plus(14)}>Nueva regla</U.Btn>);
  if (tab === 'config')     return (<U.Btn variant="secondary" icon={window.Icon.refresh(14)}>Test conexión</U.Btn>);
  if (tab === 'logs')       return (<U.Btn variant="secondary" icon={window.Icon.download(14)}>Exportar CSV</U.Btn>);
  return null;
}

window.ModuleMailing = ModuleMailing;
