/* @iife */ (function(){
/* global React */
/* ── AI Copilot · asistente conversacional del ERP ───────────── */
/* Responde sobre embarques, clientes, facturas usando datos reales.  */
/* Usa window.claude.complete (claude-haiku-4-5). Wiring al ERP: TODO. */

const { useState: cpState, useRef: cpRef, useEffect: cpEffect } = React;

// ── Snapshot compacto de datos para fundamentar respuestas ────
function buildContext(D) {
  const ships = D.SHIPMENTS.map(s => `${s.id} | ${s.clientName} | ${s.type} | ${s.origin}→${s.destination} | ${s.cbm}CBM | estado:${s.status} | ETA:${s.eta || '—'} | $${s.value}`).join('\n');
  const inv = D.INVOICES.map(i => `${i.id} | ${i.clientName} | $${i.amount} | vence:${i.due} | estado:${i.status}`).join('\n');
  const cli = D.CLIENTS.map(c => `${c.markbox} | ${c.name} | ${c.company} | ${c.city} | ${c.shipments} envíos | facturado:$${c.billed} | ${c.status}`).join('\n');
  const quotes = D.ESTIMADOS.map(q => `${q.id} | ${q.clientName} | ${q.type} | $${q.totalUSD} | estado:${q.status} | agente:${q.agent}`).join('\n');
  return `Sos el Copilot de DTD-Cargo, un asistente operativo dentro del ERP de una empresa de logística China→Venezuela.
Respondé SOLO con base en los datos de abajo. Si te preguntan algo que no está en los datos, decilo claramente. Sé conciso, directo y usa castellano rioplatense/venezolano neutro (voseo). Para códigos (DTDU-, DTD-, F-) escribilos entre backticks. Para montos usa $ y miles con K cuando ayude. Nunca inventes números que no estén en los datos.

=== EMBARQUES ===
${ships}

=== FACTURAS ===
${inv}

=== CLIENTES (Shipping Mark) ===
${cli}

=== ESTIMADOS ===
${quotes}

Hoy es sábado 31 de mayo de 2026.`;
}

const SUGGESTIONS = [
  '¿Qué embarques están en aduana VE ahora?',
  '¿Cuánto nos debe Acindar y desde cuándo?',
  '¿Qué cliente factura más este mes?',
  'Resumime los embarques que requieren acción',
  '¿Qué estimados siguen sin respuesta?',
];

// Mini-markdown → HTML (bold, code, line breaks)
function mdToHtml(t) {
  let h = t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  h = h.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  h = h.replace(/`([^`]+)`/g, '<code>$1</code>');
  h = h.replace(/\n/g, '<br>');
  return h;
}

function Copilot() {
  const D = window.ERPData;
  const U = window.ERPUI;
  const I = window.Icon;

  const context = React.useMemo(() => buildContext(D), []);
  const [messages, setMessages] = cpState([
    { role: 'assistant', content: '¡Hola! Soy tu **Copilot de DTD-Cargo**. Puedo responderte sobre embarques, clientes, facturas y estimados — todo en vivo desde el ERP. Preguntame lo que necesites o toca una sugerencia abajo.' },
  ]);
  const [input, setInput] = cpState('');
  const [loading, setLoading] = cpState(false);
  const scrollRef = cpRef(null);

  cpEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages, loading]);

  const send = async (text) => {
    const q = (text != null ? text : input).trim();
    if (!q || loading) return;
    const nextMsgs = [...messages, { role: 'user', content: q }];
    setMessages(nextMsgs);
    setInput('');
    setLoading(true);
    try {
      const convo = nextMsgs.filter(m => m.role !== 'system').map(m => `${m.role === 'user' ? 'Usuario' : 'Copilot'}: ${m.content}`).join('\n\n');
      const reply = await window.claude.complete({
        messages: [
          { role: 'user', content: `${context}\n\n=== CONVERSACIÓN ===\n${convo}\n\nRespondé como Copilot al último mensaje del usuario. Solo tu respuesta, sin prefijo "Copilot:".` },
        ],
      });
      setMessages(m => [...m, { role: 'assistant', content: (reply || '').trim() || 'No pude generar una respuesta. Prueba reformular la pregunta.' }]);
    } catch (e) {
      setMessages(m => [...m, { role: 'assistant', content: 'Hubo un problema al consultar. Reintentá en unos segundos.', error: true }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', flexDirection: 'column' }}>
      <TopBar onReset={() => setMessages(messages.slice(0, 1))} />

      <div style={{ flex: 1, maxWidth: 760, width: '100%', margin: '0 auto', padding: '20px 24px 0', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {/* Messages */}
        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 16 }}>
          {messages.map((m, i) => <Bubble key={i} m={m} />)}
          {loading && <TypingBubble />}
        </div>

        {/* Suggestions (only at start) */}
        {messages.length <= 1 && !loading && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingBottom: 14 }}>
            {SUGGESTIONS.map((s, i) => (
              <button key={i} onClick={() => send(s)} style={{
                padding: '8px 13px', background: 'var(--bg-surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--r-pill)', font: '600 12px/1 var(--f-sans)', color: 'var(--ink-soft)', cursor: 'pointer',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--wine)'; e.currentTarget.style.color = 'var(--wine)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--ink-soft)'; }}
              >{s}</button>
            ))}
          </div>
        )}

        {/* Composer */}
        <div style={{ position: 'sticky', bottom: 0, background: 'linear-gradient(transparent, var(--bg-base) 18%)', paddingBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '10px 10px 10px 16px', boxShadow: 'var(--shadow-sm)' }}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Preguntá sobre embarques, clientes, facturas…"
              rows={1}
              style={{ flex: 1, border: 0, outline: 'none', resize: 'none', background: 'transparent', color: 'var(--ink)', font: '500 14px/1.5 var(--f-sans)', maxHeight: 120, paddingTop: 6 }}
            />
            <button onClick={() => send()} disabled={!input.trim() || loading} style={{
              width: 38, height: 38, borderRadius: 'var(--r-md)', border: 0, flexShrink: 0,
              background: (!input.trim() || loading) ? 'var(--bg-elevated)' : 'var(--wine)',
              color: (!input.trim() || loading) ? 'var(--ink-mute)' : '#fff',
              cursor: (!input.trim() || loading) ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{I.arrowR ? I.arrowR(16) : '→'}</button>
          </div>
          <div style={{ textAlign: 'center', font: '500 10.5px/1 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 8 }}>
            El Copilot responde con datos del ERP · puede equivocarse, verifica lo crítico.
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Top bar ──────────────────────────────────────────────────
function TopBar({ onReset }) {
  const I = window.Icon;
  return (
    <header style={{ position: 'sticky', top: 0, zIndex: 40, background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 14 }}>
      <a href="../DTD Studio · ERP.html" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, font: '600 12px/1 var(--f-sans)', color: 'var(--ink-soft)', textDecoration: 'none' }}>{I.arrowL(13)} ERP</a>
      <span style={{ color: 'var(--ink-mute)' }}>/</span>
      <span style={{ width: 26, height: 26, borderRadius: 'var(--r-sm)', background: 'var(--wine)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{I.spark ? I.spark(14) : '✦'}</span>
      <span style={{ font: '800 14px/1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.01em' }}>Copilot</span>
      <span style={{ font: '500 11px/1 var(--f-sans)', color: 'var(--ink-mute)' }}>· claude-haiku</span>
      <div style={{ flex: 1 }} />
      <button onClick={onReset} style={{ font: '600 12px/1 var(--f-sans)', color: 'var(--ink-soft)', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '7px 12px', cursor: 'pointer' }}>Nueva conversación</button>
    </header>
  );
}

// ── Message bubble ───────────────────────────────────────────
function Bubble({ m }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const isUser = m.role === 'user';
  if (isUser) {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end', animation: 'cp-rise .3s var(--ease) both' }}>
        <div style={{ maxWidth: '78%', padding: '11px 15px', background: 'var(--wine)', color: '#fff', borderRadius: '14px 14px 4px 14px', font: '500 14px/1.6 var(--f-sans)' }}>{m.content}</div>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', gap: 11, animation: 'cp-rise .3s var(--ease) both' }}>
      <span style={{ width: 30, height: 30, borderRadius: 'var(--r-sm)', background: m.error ? 'var(--danger-bg)' : 'var(--wine-tint)', color: m.error ? 'var(--danger)' : 'var(--wine)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{I.spark ? I.spark(15) : '✦'}</span>
      <div className="cp-msg" style={{ maxWidth: '88%', padding: '11px 15px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '14px 14px 14px 4px', font: '500 14px/1.65 var(--f-sans)', color: 'var(--ink)' }} dangerouslySetInnerHTML={{ __html: mdToHtml(m.content) }} />
    </div>
  );
}

function TypingBubble() {
  const I = window.Icon;
  return (
    <div style={{ display: 'flex', gap: 11 }}>
      <span style={{ width: 30, height: 30, borderRadius: 'var(--r-sm)', background: 'var(--wine-tint)', color: 'var(--wine)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{I.spark ? I.spark(15) : '✦'}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '14px 16px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '14px 14px 14px 4px' }}>
        <span className="cp-dot" style={{ animationDelay: '0s' }} />
        <span className="cp-dot" style={{ animationDelay: '0.2s' }} />
        <span className="cp-dot" style={{ animationDelay: '0.4s' }} />
      </div>
    </div>
  );
}

window.Copilot = Copilot;

})();
