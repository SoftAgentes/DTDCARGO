/* global React, window */
/* ── DTD · Guía del Mapa de Proceso (referencia del equipo) ──── */

const { useState } = React;

const LANE_DOC = [
{ label: 'Comercial', tone: 'info', icon: 'spark', resp: 'Ventas · CRM', desc: 'Capta el lead, cotiza puerta a puerta (DDP) y convierte al cliente con su MARKBOX. Cierra y, al final del ciclo, fideliza.' },
{ label: 'Operatividad', tone: 'wine', icon: 'ship', resp: 'Operaciones · Almacenes', desc: 'Mueve la carga de China a Venezuela: orden de pedido, recepción en CN, consolidación, zarpe, tránsito, aduana, almacén VE y última milla.' },
{ label: 'Contabilidad', tone: 'success', icon: 'invoice', resp: 'Finanzas', desc: 'Factura lo que llega, cobra el anticipo y el saldo, registra las CxP (naviera, aduana, transportes) y concilia el cierre del embarque.' },
{ label: 'Servicio al cliente', tone: 'warning', icon: 'chat', resp: 'Soporte · CX', desc: 'Atiende conversaciones (WhatsApp, correo, portal), gestiona reclamos e incidencias y cierra los casos midiendo la satisfacción (CSAT).' }];


const READ_DOC = [
{ icon: 'flow', title: 'Flujo del departamento', text: 'Las flechas sólidas conectan los pasos dentro de un mismo carril: el orden en que el trabajo avanza puertas adentro.' },
{ icon: 'spark', title: 'Enlace entre departamentos', text: 'Las líneas punteadas wine son los handoffs: el punto exacto donde un departamento le pasa el trabajo al siguiente.' },
{ icon: 'bell', title: 'Badges en vivo', text: 'El número rojo sobre cada nodo cuenta lo que está pendiente ahí ahora (leído de los datos del ERP). Sin pendientes, el nodo queda en gris.' },
{ icon: 'users', title: 'Foco por carril', text: 'Tocá un carril (o su chip) y los demás se compactan: el elegido se expande mostrando cada paso como tarjeta con su detalle en vivo.' },
{ icon: 'chart', title: 'Panel de resumen', text: 'Al tocar un nodo se abre a la derecha un resumen propio: 2 indicadores, 3-4 registros clickeables y una acción (ej. enviar la factura al cliente).' }];


const USE_DOC = [
['Activar', 'Botón "Automatizaciones" en la cabecera. El mapa entra en modo regla: las líneas con automatización se encienden y muestran su chip ⚡.'],
['Activar / desactivar', 'Cada regla tiene un switch. Activa = se dispara sola y su línea fluye; inactiva = queda gris y se ejecuta a mano.'],
['Crear', '"+ Nueva regla": elegís disparador (nodo) → acción (nodo) → condiciones y canales. La línea se dibuja sola en el mapa.'],
['Condiciones', 'Una regla puede correr solo si se cumple algo: Monto, Tier del cliente, Tipo de servicio o Destino.'],
['Ejecutar ahora', 'Simula un disparo: genera el documento (factura, CxP, orden…), lo agrega al Registro en vivo y avisa por el canal.'],
['Registro', 'Pestaña "Registro": historial cronológico de cada ejecución con el documento generado y el momento.'],
['Persistencia', 'Tus reglas, ediciones y el estado on/off se guardan en este equipo. "Restablecer" vuelve a las del sistema.']];


const CH = { app: 'App móvil', portal: 'Portal', correo: 'Correo', whatsapp: 'WhatsApp' };
const COND_LABEL = { monto: 'Monto', tier: 'Tier del cliente', servicio: 'Tipo de servicio', destino: 'Destino' };
const fmtCond = (c) => `${COND_LABEL[c.field] || c.field} ${c.op} ${c.field === 'monto' ? '$' + Number(c.value).toLocaleString('en-US') : c.value}`;

function GuideApp() {
  const I = window.Icon;
  const [theme, setTheme] = useState('light');
  const rules = window.FlowRules?.LIST || [];
  const cats = [];rules.forEach((r) => {if (!cats.includes(r.category)) cats.push(r.category);});
  const active = rules.filter((r) => r.auto).length;

  React.useEffect(() => {document.documentElement.setAttribute('data-theme', theme);}, [theme]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', color: 'var(--ink)' }}>
      {/* Cabecera */}
      <header style={{ maxWidth: 920, margin: '0 auto', padding: '40px var(--s-8) 24px' }} className="g-head">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 280 }}>
            <div className="eyebrow eyebrow-wine" style={{ marginBottom: 10 }}>GUÍA DE REFERENCIA · DTD-CARGO</div>
            <h1 style={{ margin: 0, font: '800 30px/1.05 var(--f-display)', letterSpacing: '-0.02em' }}>Mapa de Proceso · cómo funciona</h1>
            <p style={{ margin: '10px 0 0', font: '500 14px/1.6 var(--f-sans)', color: 'var(--ink-soft)', maxWidth: 640 }}>
              El flujo de trabajo de extremo a extremo: las cuatro líneas de negocio, los enlaces que las atan y el motor de
              automatizaciones. Con confianza, de China a tu puerta.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }} className="g-noprint">
            <button onClick={() => setTheme((t) => t === 'dark' ? 'light' : 'dark')} title="Cambiar tema" style={btnIcon}>{theme === 'dark' ? I.sun(16) : I.moon(16)}</button>
            <button onClick={() => window.print()} style={{ ...btnGhost, display: 'inline-flex', alignItems: 'center', gap: 8 }}>{I.doc?.(14) || I.invoice(14)} Imprimir / PDF</button>
            <a href="Mapa de Proceso.html" style={{ ...btnWine, display: 'inline-flex', alignItems: 'center', gap: 8 }}>{I.arrowR(14)} Abrir el mapa</a>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 920, margin: '0 auto', padding: '0 var(--s-8) 64px', display: 'flex', flexDirection: 'column', gap: 38 }}>
        {/* 4 líneas */}
        <section>
          <SecTitle n="01" title="Las cuatro líneas de negocio" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }} className="g-grid2">
            {LANE_DOC.map((l) =>
            <div key={l.label} style={{ ...card, borderTop: `3px solid var(--${l.tone})` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span style={{ width: 34, height: 34, borderRadius: 'var(--r-md)', background: `var(--${l.tone}-bg)`, color: `var(--${l.tone})`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{I[l.icon]?.(18)}</span>
                  <div>
                    <div style={{ font: '800 15px/1.1 var(--f-display)' }}>{l.label}</div>
                    <div style={{ font: '600 10.5px/1 var(--f-sans)', color: `var(--${l.tone})`, marginTop: 3 }}>{l.resp}</div>
                  </div>
                </div>
                <div style={{ font: '500 12.5px/1.55 var(--f-sans)', color: 'var(--ink-soft)' }}>{l.desc}</div>
              </div>
            )}
          </div>
        </section>

        {/* Cómo leer */}
        <section>
          <SecTitle n="02" title="Cómo leer el mapa" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {READ_DOC.map((r) =>
            <div key={r.title} style={{ ...card, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <span style={{ width: 30, height: 30, borderRadius: 'var(--r-sm)', background: 'var(--bg-elevated)', color: 'var(--wine)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{I[r.icon]?.(16)}</span>
                <div>
                  <div style={{ font: '700 13px/1.3 var(--f-sans)' }}>{r.title}</div>
                  <div style={{ font: '500 12.5px/1.5 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 3 }}>{r.text}</div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Reglas */}
        <section>
          <SecTitle n="03" title="Reglas de automatización" extra={`${active} activas · ${rules.length} en total`} />
          <p style={{ margin: '0 0 16px', font: '500 13px/1.6 var(--f-sans)', color: 'var(--ink-soft)' }}>
            Cada regla viaja sobre un enlace entre departamentos: <b>cuando</b> ocurre algo en un paso, <b>entonces</b> se dispara una
            acción en otro, atada a los módulos internos del ERP.
          </p>
          {cats.map((cat) =>
          <div key={cat} style={{ marginBottom: 18 }}>
              <div style={{ font: '700 10px/1 var(--f-sans)', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-mute)', marginBottom: 9 }}>{cat}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {rules.filter((r) => r.category === cat).map((r) =>
              <div key={r.id} style={card}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <span style={{ font: '700 10px/1 var(--f-mono)', color: 'var(--wine)' }}>{r.id}</span>
                      <span style={{ padding: '2px 8px', borderRadius: 'var(--r-pill)', background: r.auto ? 'var(--success-bg)' : 'var(--neutral-bg)', color: r.auto ? 'var(--success)' : 'var(--ink-mute)', font: '700 9px/1.5 var(--f-sans)' }}>{r.auto ? 'Activa por defecto' : 'Manual'}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                      <Line tone="info" label="Cuando" text={r.trigger} />
                      <Line tone="wine" label="Entonces" text={r.action} />
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 11, alignItems: 'center' }}>
                      {(r.modules || []).map((m, k) =>
                  <span key={k} style={chip}>{I.box(10)} {m}</span>
                  )}
                      {(r.conditions || []).map((c, k) =>
                  <span key={'c' + k} style={{ ...chip, background: 'var(--info-bg)', color: 'var(--info)', borderColor: 'transparent' }}>{I.info(10)} {fmtCond(c)}</span>
                  )}
                      {(r.channels || []).map((c) =>
                  <span key={c} style={{ ...chip, background: 'var(--wine-bg)', color: 'var(--wine)', borderColor: 'transparent' }}>{CH[c] || c}</span>
                  )}
                    </div>
                  </div>
              )}
              </div>
            </div>
          )}
        </section>

        {/* Cómo usar */}
        <section>
          <SecTitle n="04" title="Cómo usar Automatizaciones" />
          <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
            {USE_DOC.map(([k, v], i) =>
            <div key={k} style={{ display: 'flex', gap: 14, padding: '12px 16px', borderTop: i ? '1px solid var(--border)' : 'none' }}>
                <div style={{ width: 130, flexShrink: 0, font: '700 12.5px/1.4 var(--f-sans)', color: 'var(--wine)' }}>{k}</div>
                <div style={{ font: '500 12.5px/1.5 var(--f-sans)', color: 'var(--ink-soft)' }}>{v}</div>
              </div>
            )}
          </div>
        </section>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 18, font: '600 11px/1.5 var(--f-sans)', color: 'var(--ink-mute)' }}>
          DTD-Cargo · Mapa de Proceso — Construyendo confianza cliente a cliente, contenedor a contenedor.
        </div>
      </main>
    </div>);

}

function SecTitle({ n, title, extra }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 14, paddingBottom: 10, borderBottom: '2px solid var(--ink)' }}>
      <span style={{ font: '800 13px/1 var(--f-mono)', color: 'var(--wine)' }}>{n}</span>
      <h2 style={{ margin: 0, font: '800 19px/1.1 var(--f-display)', letterSpacing: '-0.01em', flex: 1 }}>{title}</h2>
      {extra && <span style={{ font: '700 11px/1 var(--f-sans)', color: 'var(--ink-mute)' }}>{extra}</span>}
    </div>);

}

function Line({ tone, label, text }) {
  const I = window.Icon;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
      <span style={{ minWidth: 64, font: '700 9px/1.5 var(--f-sans)', letterSpacing: '0.06em', textTransform: 'uppercase', color: `var(--${tone})`, flexShrink: 0, paddingTop: 1 }}>{label}</span>
      <span style={{ font: '600 12.5px/1.45 var(--f-sans)', color: 'var(--ink)' }}>{text}</span>
    </div>);

}

const card = { background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '14px 16px', boxShadow: 'var(--shadow-xs)' };
const chip = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 'var(--r-pill)', background: 'var(--bg-elevated)', border: '1px solid var(--border)', font: '600 10px/1.3 var(--f-sans)', color: 'var(--ink-soft)' };
const btnIcon = { width: 38, height: 38, borderRadius: 'var(--r-md)', border: '1px solid var(--border)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-soft)', background: 'var(--bg-surface)' };
const btnGhost = { height: 38, padding: '0 14px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', font: '700 12.5px/1 var(--f-sans)', color: 'var(--ink)', background: 'var(--bg-surface)' };
const btnWine = { height: 38, padding: '0 15px', borderRadius: 'var(--r-md)', display: 'inline-flex', alignItems: 'center', font: '700 12.5px/1 var(--f-sans)', color: '#fff', background: 'var(--wine)' };

window.GuideApp = GuideApp;
