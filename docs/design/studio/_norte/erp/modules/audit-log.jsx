/* global React */
/* ── DTD ERP · Audit log de cambios en reglas y ODs ───────────── */
(function () {
  const { useState, useMemo, useEffect } = React;

  const SEED_LOGS = [
    { ts: '2026-05-24 09:42', user: 'admin@dtd',     module: 'Reglas',  action: 'Cambió peso FIFO de 15 a 20',                  entity: 'rules' },
    { ts: '2026-05-24 09:15', user: 'admin@dtd',     module: 'OD',      action: 'Canceló OD-2026-0140 · motivo: chofer faltó',  entity: 'OD-2026-0140' },
    { ts: '2026-05-24 08:32', user: 'admin@dtd',     module: 'Rutas',   action: 'Editó R-002 · radio Maracay 20km → 25km',      entity: 'R-002' },
    { ts: '2026-05-23 17:18', user: 'yusneidy@dtd',  module: 'Despacho',action: 'Cerró carga OD-2026-0142 · 11 paquetes',       entity: 'OD-2026-0142' },
    { ts: '2026-05-23 16:50', user: 'luis@dtd',      module: 'POD',     action: 'Entregó DTD-2026-0151 a Luis Fernández',        entity: 'OD-2026-0142' },
    { ts: '2026-05-23 14:22', user: 'admin@dtd',     module: 'Política',action: 'Cambió Pago primero · Estricto → Hold hasta 2026-06-15', entity: 'rules' },
    { ts: '2026-05-23 11:08', user: 'admin@dtd',     module: 'Clientes',action: 'Promovió Polar a Platinum',                     entity: 'DTD-5392' },
    { ts: '2026-05-22 18:45', user: 'admin@dtd',     module: 'Rutas',   action: 'Creó R-004 · Valencia → Maracaibo + 2 ciudades', entity: 'R-004' },
  ];

  function ModuleAuditLog() {
    const U = window.ERPUI;
    const I = window.Icon;
    const [filter, setFilter] = useState('all');
    const logs = filter === 'all' ? SEED_LOGS : SEED_LOGS.filter(l => l.module.toLowerCase() === filter);

    const modules = ['Reglas', 'OD', 'Rutas', 'Despacho', 'POD', 'Política', 'Clientes'];

    return (
      <div>
        <U.PageHeader
          eyebrow="SISTEMA · AUDITORÍA"
          title="Audit log"
          subtitle="Historial completo de cambios. Todo lo que se modifica en reglas, rutas, ODs y clientes queda registrado con timestamp y usuario."
          actions={
            <U.Select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ width: 180 }} options={[
              { value: 'all', label: 'Todos los módulos' },
              ...modules.map(m => ({ value: m.toLowerCase(), label: m })),
            ]} />
          }
        />

        <U.Card padded={false}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-elevated)' }}>
                <th style={th({ w: 160 })}>Timestamp</th>
                <th style={th({ w: 180 })}>Usuario</th>
                <th style={th({ w: 120 })}>Módulo</th>
                <th style={th({})}>Acción</th>
                <th style={th({ w: 160 })}>Entidad</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l, i) => (
                <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={td()} className="mono"><code style={{ font: '500 11.5px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>{l.ts}</code></td>
                  <td style={td()}>{l.user}</td>
                  <td style={td()}><U.Badge tone="neutral" size="sm">{l.module}</U.Badge></td>
                  <td style={td()}>{l.action}</td>
                  <td style={td()}><code style={{ font: '600 11.5px/1 var(--f-mono)', color: 'var(--wine)' }}>{l.entity}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </U.Card>
      </div>
    );
  }

  function th({ w }) {
    return { padding: '12px 14px', textAlign: 'left', font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase', borderBottom: '1px solid var(--border)', width: w, whiteSpace: 'nowrap' };
  }
  function td() {
    return { padding: '12px 14px', font: '500 13px/1.4 var(--f-sans)', color: 'var(--ink)' };
  }

  window.ModuleAuditLog = ModuleAuditLog;
})();
