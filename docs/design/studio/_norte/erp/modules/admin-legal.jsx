/* global React */
/* ── DTD ERP · Legal · documentos versionados + registro de aceptaciones ── */
/* Repositorio de T&C / Condiciones del Operador (cada uno con versión +     */
/* fecha de vigencia) y bitácora consultable de aceptaciones de clientes.    */
/* Fuente de verdad compartida con el modal del Portal (mismo contenido).    */

(function () {
  const { useState, useMemo } = React;

  // ── Documentos legales · versión vigente + histórico ──────────
  const LEGAL_DOCS = [
    {
      key: 'tyc', name: 'Términos y Condiciones de DTD', audience: 'Cliente',
      current: 'v2.1',
      versions: [
        { version: 'v2.1', effective: '2026-05-01', status: 'vigente',   sections: 11, note: 'Añadidas cláusulas de naturaleza del servicio (comisionista) y subcontratación del operador.' },
        { version: 'v2.0', effective: '2026-01-10', status: 'archivada', sections: 9,  note: 'Reescritura DDP + límite de responsabilidad al flete.' },
        { version: 'v1.0', effective: '2025-08-01', status: 'archivada', sections: 6,  note: 'Versión inicial.' },
      ],
    },
    {
      key: 'operador', name: 'Condiciones del Operador de Consolidación', audience: 'Cliente',
      current: 'v1.4',
      versions: [
        { version: 'v1.4', effective: '2026-04-15', status: 'vigente',   sections: 9, note: 'Añadidas avería gruesa (York-Amberes) e identificación por MarkBox.' },
        { version: 'v1.3', effective: '2025-11-20', status: 'archivada', sections: 7, note: 'Consolidación parcial P1/P2.' },
        { version: 'v1.0', effective: '2025-06-01', status: 'archivada', sections: 5, note: 'Versión inicial.' },
      ],
    },
  ];

  // ── Registro de aceptaciones (bitácora) ───────────────────────
  const ACCEPTANCES = [
    { id: 'AC-2026-0220', client: 'Acindar Comercial', markbox: 'DTD-5452', quote: 'Q-2026-2310', orden: 'OS-2026-2310', cbm: 7.0, weight: 2800, total: 5600, at: '29/05/2026 10:15:33', ip: '190.142.88.214', docs: [['Términos y Condiciones de DTD', 'v2.1'], ['Condiciones del Operador de Consolidación', 'v1.4']], hash: 'sha256:2310e7a14f9d80' },
    { id: 'AC-2026-0214', client: 'Acindar Comercial', markbox: 'DTD-5452', quote: 'Q-2026-0118', orden: 'OS-2026-0118', at: '02/06/2026 09:41:12', ip: '190.142.88.214', docs: [['Términos y Condiciones de DTD', 'v2.1'], ['Condiciones del Operador de Consolidación', 'v1.4']], hash: 'sha256:a1f9c7e2b04d8a' },
    { id: 'AC-2026-0213', client: 'Vargas & Asoc',     markbox: 'DTD-5418', quote: 'Q-2026-0117', orden: 'OS-2026-0117', at: '01/06/2026 17:22:08', ip: '186.92.14.77',   docs: [['Términos y Condiciones de DTD', 'v2.1'], ['Condiciones del Operador de Consolidación', 'v1.4']], hash: 'sha256:7c3e1a9f25b0d4' },
    { id: 'AC-2026-0212', client: 'Imp. Pereira',       markbox: 'DTD-5390', quote: 'Q-2026-0114', orden: 'OS-2026-0114', at: '31/05/2026 11:05:44', ip: '190.202.55.13',  docs: [['Términos y Condiciones de DTD', 'v2.1'], ['Condiciones del Operador de Consolidación', 'v1.4']], hash: 'sha256:e2b0c7a14f9d83' },
    { id: 'AC-2026-0211', client: 'Castro Hermanos',    markbox: 'DTD-5354', quote: 'Q-2026-0109', orden: 'OS-2026-0109', at: '28/05/2026 14:48:30', ip: '201.249.33.92',  docs: [['Términos y Condiciones de DTD', 'v2.1'], ['Condiciones del Operador de Consolidación', 'v1.4']], hash: 'sha256:0d4f8a1c7e2b95' },
    { id: 'AC-2026-0207', client: 'Polar Distribución', markbox: 'DTD-5301', quote: 'Q-2026-0102', orden: 'OS-2026-0102', at: '22/05/2026 08:12:55', ip: '190.142.10.5',   docs: [['Términos y Condiciones de DTD', 'v2.1'], ['Condiciones del Operador de Consolidación', 'v1.4']], hash: 'sha256:b95d4f0a1c7e23' },
    { id: 'AC-2026-0198', client: 'Acindar Comercial',  markbox: 'DTD-5452', quote: 'Q-2026-0094', orden: 'OS-2026-0094', at: '14/05/2026 16:30:19', ip: '190.142.88.214', docs: [['Términos y Condiciones de DTD', 'v2.1'], ['Condiciones del Operador de Consolidación', 'v1.4']], hash: 'sha256:1c7e2b0d4f8a96' },
    { id: 'AC-2026-0185', client: 'Vargas & Asoc',      markbox: 'DTD-5418', quote: 'Q-2026-0081', orden: 'OS-2026-0081', at: '29/04/2026 10:02:41', ip: '186.92.14.77',   docs: [['Términos y Condiciones de DTD', 'v2.0'], ['Condiciones del Operador de Consolidación', 'v1.4']], hash: 'sha256:f8a96b1c7e2b0d' },
    { id: 'AC-2026-0172', client: 'Imp. Pereira',       markbox: 'DTD-5390', quote: 'Q-2026-0068', orden: 'OS-2026-0068', at: '12/04/2026 13:19:07', ip: '190.202.55.13',  docs: [['Términos y Condiciones de DTD', 'v2.0'], ['Condiciones del Operador de Consolidación', 'v1.3']], hash: 'sha256:6b1c7e2b0d4f8a' },
  ];

  window.LegalData = { LEGAL_DOCS, ACCEPTANCES };

  // ── Cuerpo completo de la versión vigente (compartido con el modal del Portal) ──
  const LEGAL_BODY = {
    tyc: [
      ['1. Objeto', 'DTD-Cargo presta servicios de consolidación y transporte puerta a puerta China–Venezuela bajo modalidad DDP. La aceptación de una cotización constituye una orden de servicio en firme sujeta a estos Términos.'],
      ['2. Naturaleza del servicio', 'DTD-Cargo actúa como agente de carga y comisionista mercantil intermediario, no como transportista principal. Coordina servicios de terceros (operador de consolidación, líneas navieras, transportistas terrestres y agentes aduaneros) por cuenta y orden del Cliente. La relación es mercantil entre comerciantes y se rige por el Código de Comercio venezolano.'],
      ['3. Tarifas y vigencia', 'La tarifa cotizada es válida por 7 días corridos desde su emisión y está sujeta a la confirmación de volumen y peso reales en el almacén de origen. Las diferencias de CBM/peso se reliquidan al cierre del contenedor.'],
      ['4. Responsabilidad', 'La responsabilidad de DTD-Cargo, en caso de negligencia grave o dolo propio comprobado, se limita al valor del flete pagado por el envío afectado, y nunca al valor de la mercancía. No cubre lucro cesante ni daños indirectos. DTD-Cargo no responde por pérdida, daño, hurto o demora imputables a terceros (operador de consolidación, naviera o aduana); tales reclamos deben dirigirse al transportista efectivo o a la aseguradora de la carga.'],
      ['5. Seguro', 'El flete NO incluye seguro de carga. El seguro es opcional y se cotiza por separado. Si el Cliente opta por no asegurar, asume todo el riesgo del transporte sin derecho a reclamo contra DTD-Cargo. DTD-Cargo puede gestionar la contratación del seguro como servicio adicional, bajo solicitud expresa del Cliente.'],
      ['6. Plazos', 'Los ETD/ETA son estimados y dependen de itinerarios navieros, congestión portuaria y liberación aduanera. DTD-Cargo no responde por demoras ajenas a su control directo.'],
      ['7. Mercancía prohibida y peligrosa', 'El Cliente declara que la mercancía no incluye artículos prohibidos, mercancía peligrosa no declarada, ni réplicas o falsificaciones. La mercancía peligrosa debe declararse por escrito antes del embarque conforme a la normativa aplicable. La omisión o falsedad traslada la responsabilidad legal y económica al Cliente, quien indemnizará a DTD-Cargo por todo daño, multa o gasto resultante.'],
      ['8. Operador de consolidación y subcontratación', 'DTD-Cargo subcontrata, por cuenta y orden del Cliente, los servicios de consolidación y transporte con operadores independientes. El contrato de transporte se perfecciona entre el Cliente y el transportista efectivo y/o el operador de consolidación, y el Conocimiento de Embarque (B/L) puede emitirse a nombre del operador de consolidación, no de DTD-Cargo ni del Cliente. La mercancía puede consolidarse con carga de otros clientes. Las condiciones aplicables se detallan en el documento "Condiciones del Operador de Consolidación".'],
      ['9. Pagos', 'El Cliente pagará el flete y los servicios conforme a la modalidad acordada (pago anticipado o contra entrega). La mercancía viaja bajo derecho de retención a favor de DTD-Cargo hasta el pago íntegro; no se entrega sin pago completo.'],
      ['10. Aceptación electrónica y versiones', 'Estos Términos se aceptan electrónicamente mediante una casilla de aceptación previa y obligatoria a la confirmación de cada cotización. DTD-Cargo registra como evidencia: identificación del Cliente, cotización, versión del documento, fecha y hora, dirección IP y huella de integridad (hash). Cada operación queda vinculada a la versión vigente al momento de la aceptación.'],
      ['11. Ley aplicable y jurisdicción', 'Estos Términos se rigen por las leyes de la República Bolivariana de Venezuela. Toda controversia se someterá a [mediación o arbitraje, o a los tribunales competentes en Venezuela — definir con abogado].'],
    ],
    operador: [
      ['1. Rol del operador', 'El operador de consolidación agrupa cargas de múltiples clientes en un mismo contenedor (LCL→FCL). El Cliente acepta compartir contenedor, salvo contratación expresa de FCL exclusivo.'],
      ['2. Manipulación', 'La carga puede ser abierta, pesada, fotografiada y reembalada para optimizar el cubicaje. El operador registra evidencia fotográfica en cada etapa.'],
      ['3. Almacenaje', 'Los primeros 15 días de almacenaje en origen son sin cargo. A partir del día 16 se aplica una tarifa diaria por CBM según el tarifario vigente.'],
      ['4. Consolidación parcial', 'Si la carga no entra completa en el contenedor en curso, el operador puede dividirla (P1/P2) y despacharla en embarques sucesivos, notificando al Cliente.'],
      ['5. Identificación de la carga', 'Cada bulto debe rotularse únicamente con el código de identificación asignado (MarkBox), sin nombre, dirección ni datos personales del Cliente. El operador no responde por decomisos, extravíos o confusión de carga derivados de identificación incorrecta o de datos personales colocados en las cajas.'],
      ['6. Mercancía peligrosa', 'No se admite mercancía peligrosa sin declaración previa por escrito y cumplimiento de la normativa aplicable (Código IMDG). La mercancía mal declarada puede ser descargada, neutralizada o destruida a riesgo y costo del Cliente, quien indemnizará por todo daño resultante.'],
      ['7. Responsabilidad del operador', 'El operador de consolidación no es el transportista efectivo ni asegura el valor de la mercancía. Su responsabilidad se limita a la indemnización que el transportista efectivo reconozca, dentro de los límites de responsabilidad del transportista.'],
      ['8. Avería gruesa (General Average)', 'En caso de avería gruesa declarada por la naviera, el Cliente deberá aportar el depósito o la garantía exigida como condición para la liberación de su carga, conforme a las Reglas de York-Amberes.'],
      ['9. Seguro', 'La carga viaja sin seguro salvo contratación expresa. El operador no asegura la mercancía por cuenta del Cliente.'],
    ],
  };

  // Versión vigente de cada doc con su cuerpo, lista para el modal del Portal.
  function currentDocs() {
    return LEGAL_DOCS.map(d => {
      const cur = d.versions.find(v => v.status === 'vigente');
      return { key: d.key, name: d.name, version: cur.version, effective: cur.effective, body: LEGAL_BODY[d.key] };
    });
  }

  window.LegalData = { LEGAL_DOCS, ACCEPTANCES, LEGAL_BODY, currentDocs };

  const fmtDate = (iso) => {
    const [y, m, d] = iso.split('-');
    const MM = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'][parseInt(m) - 1];
    return `${parseInt(d)} ${MM} ${y}`;
  };

  // Detecta placeholders [..] en el cuerpo legal → pendientes de revisión de abogado.
  function legalPlaceholders() {
    const out = [];
    LEGAL_DOCS.forEach(d => {
      (LEGAL_BODY[d.key] || []).forEach(([h, p]) => {
        const ms = (p || '').match(/\[[^\]]+\]/g);
        if (ms) ms.forEach(m => out.push({ doc: d.name, section: h, text: m }));
      });
    });
    return out;
  }

  // ════════════════════════════════════════════════════════════
  // 1 · Repositorio de documentos legales versionados
  // ════════════════════════════════════════════════════════════
  function AdminLegalDocs() {
    const U = window.ERPUI;
    const I = window.Icon;
    const ACC = window.LegalData.ACCEPTANCES;

    // aceptaciones por documento+versión (para el contador)
    const countFor = (name, version) => ACC.filter(a => a.docs.some(([n, v]) => n === name && v === version)).length;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <U.Card padded style={{ background: 'linear-gradient(135deg, var(--ink) 0%, #1F3055 100%)', border: 0, color: '#fff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ width: 44, height: 44, borderRadius: 'var(--r-md)', background: 'rgba(216,154,164,0.2)', color: 'var(--wine-soft)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{I.doc(22)}</span>
            <div style={{ flex: 1 }}>
              <div style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--wine-soft)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>REPOSITORIO LEGAL</div>
              <div style={{ font: '900 18px/1.1 var(--f-display)', color: '#fff', marginTop: 6 }}>Documentos versionados</div>
              <div style={{ marginTop: 8, font: '500 12px/1.5 var(--f-sans)', color: 'rgba(255,255,255,0.65)', maxWidth: '60ch' }}>
                Cada documento tiene una versión vigente con fecha de entrada en vigor. El cliente acepta siempre la <b style={{ color: '#fff' }}>versión vigente</b>, y cada aceptación queda atada a esa versión en el registro.
              </div>
            </div>
          </div>
        </U.Card>

        {LEGAL_DOCS.map(doc => {
          const cur = doc.versions.find(v => v.status === 'vigente');
          return (
            <U.Card key={doc.key} padded>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 16 }}>
                <span style={{ width: 40, height: 40, borderRadius: 'var(--r-md)', background: 'var(--wine-tint)', color: 'var(--wine)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{I.doc(20)}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ font: '800 15px/1.2 var(--f-display)', color: 'var(--ink)' }}>{doc.name}</span>
                    <U.Badge tone="success" size="sm" dot>Vigente {cur.version}</U.Badge>
                  </div>
                  <div style={{ font: '500 12px/1.3 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 5 }}>
                    Audiencia: {doc.audience} · en vigor desde {fmtDate(cur.effective)} · {cur.sections} secciones · {countFor(doc.name, cur.version)} aceptaciones
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <U.Btn variant="secondary" size="sm" icon={I.eye(13)}>Ver</U.Btn>
                  <U.Btn variant="primary" size="sm" icon={I.plus(13)}>Nueva versión</U.Btn>
                </div>
              </div>

              {/* histórico de versiones */}
              <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '90px 130px 1fr 110px', gap: 12, padding: '9px 14px', background: 'var(--bg-elevated)', font: '700 9.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  <span>Versión</span><span>Vigencia</span><span>Cambios</span><span style={{ textAlign: 'right' }}>Estado</span>
                </div>
                {doc.versions.map((v, i) => (
                  <div key={v.version} style={{ display: 'grid', gridTemplateColumns: '90px 130px 1fr 110px', gap: 12, padding: '11px 14px', alignItems: 'center', borderTop: i > 0 ? '1px solid var(--border)' : 0, background: v.status === 'vigente' ? 'var(--wine-tint)' : 'var(--bg-surface)' }}>
                    <code style={{ font: '800 12.5px/1 var(--f-mono)', color: v.status === 'vigente' ? 'var(--wine)' : 'var(--ink)' }}>{v.version}</code>
                    <span style={{ font: '600 11.5px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>{fmtDate(v.effective)}</span>
                    <span style={{ font: '500 11.5px/1.4 var(--f-sans)', color: 'var(--ink-soft)' }}>{v.note}</span>
                    <span style={{ textAlign: 'right' }}>
                      {v.status === 'vigente'
                        ? <U.Badge tone="success" size="sm">Vigente</U.Badge>
                        : <U.Badge tone="neutral" size="sm">Archivada</U.Badge>}
                    </span>
                  </div>
                ))}
              </div>
            </U.Card>
          );
        })}

        {(() => {
          const pend = legalPlaceholders();
          if (!pend.length) return null;
          return (
            <U.Card padded style={{ borderLeft: '3px solid var(--warning)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <span style={{ color: 'var(--warning)', display: 'flex' }}>{I.warn ? I.warn(17) : I.shield(17)}</span>
                <div style={{ font: '800 14px/1.2 var(--f-display)', color: 'var(--ink)', flex: 1 }}>Pendiente de revisión legal</div>
                <U.Badge tone="warning" size="sm">{pend.length}</U.Badge>
              </div>
              <div style={{ font: '500 12px/1.5 var(--f-sans)', color: 'var(--ink-soft)', marginBottom: 12 }}>
                Campos sin definir en el texto vigente. Requieren validación de un abogado antes de publicar la versión final.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {pend.map((p, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', background: 'var(--warning-bg)', borderRadius: 'var(--r-sm)' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ font: '600 11px/1.3 var(--f-sans)', color: 'var(--ink-soft)' }}>{p.doc} · {p.section}</div>
                      <code style={{ font: '600 12px/1.4 var(--f-mono)', color: 'var(--warning)', wordBreak: 'break-word' }}>{p.text}</code>
                    </div>
                  </div>
                ))}
              </div>
            </U.Card>
          );
        })()}

        <div style={{ display: 'flex', gap: 10, padding: '12px 14px', background: 'var(--info-bg)', borderRadius: 'var(--r-md)' }}>
          <span style={{ color: 'var(--info)', display: 'flex', flexShrink: 0, marginTop: 1 }}>{I.shield(15)}</span>
          <div style={{ font: '500 12px/1.5 var(--f-sans)', color: 'var(--ink)' }}>
            Al publicar una <b>nueva versión</b>, las aceptaciones previas conservan su versión histórica (no se reescriben). Las cotizaciones nuevas pedirán aceptar la versión vigente.
          </div>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════
  // 2 · Registro de aceptaciones consultable
  // ════════════════════════════════════════════════════════════
  function AdminAcceptances() {
    const U = window.ERPUI;
    const I = window.Icon;
    const ACC = window.LegalData.ACCEPTANCES;
    const [search, setSearch] = useState('');
    const [docFilter, setDocFilter] = useState('all');
    const [sel, setSel] = useState(null);

    const filtered = useMemo(() => ACC.filter(a => {
      if (docFilter !== 'all' && !a.docs.some(([n]) => n === docFilter)) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = [a.client, a.markbox, a.quote, a.orden, a.id, a.ip].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    }), [search, docFilter]);

    const thisMonth = ACC.filter(a => a.at.startsWith('0') && a.at.slice(3, 5) === '06').length || ACC.filter(a => /\/06\/2026/.test(a.at)).length;
    const onCurrent = ACC.filter(a => a.docs.every(([n, v]) => {
      const d = LEGAL_DOCS.find(x => x.name === n); return d && d.current === v;
    })).length;

    const KPI = ({ label, value, tone }) => (
      <U.Card padded style={{ flex: 1 }}>
        <div style={{ font: '700 9.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{label}</div>
        <div style={{ font: '900 24px/1 var(--f-display)', color: tone, marginTop: 8, letterSpacing: '-0.02em' }}>{value}</div>
      </U.Card>
    );

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <KPI label="Aceptaciones totales" value={ACC.length} tone="var(--ink)" />
          <KPI label="Este mes" value={thisMonth} tone="var(--wine)" />
          <KPI label="En versión vigente" value={`${onCurrent}/${ACC.length}`} tone="var(--success)" />
        </div>

        {/* filtros */}
        <U.Card padded>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <U.Input label="Buscar" placeholder="Cliente, MARKBOX, cotización, orden, IP…" value={search} onChange={(e) => setSearch(e.target.value)} prefix={I.search ? null : null} />
            </div>
            <div style={{ minWidth: 240 }}>
              <U.Select label="Documento" value={docFilter} onChange={(e) => setDocFilter(e.target.value)}
                options={[{ value: 'all', label: 'Todos los documentos' }, ...LEGAL_DOCS.map(d => ({ value: d.name, label: d.name }))]} />
            </div>
          </div>
        </U.Card>

        {/* tabla */}
        <U.Card padded={false}>
          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 130px 150px 150px 40px', gap: 10, padding: '11px 16px', background: 'var(--bg-elevated)', font: '700 9.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            <span>Acuse</span><span>Cliente</span><span>Cotización</span><span>Documentos</span><span>Fecha / hora</span><span></span>
          </div>
          {filtered.map((a, i) => (
            <button key={a.id} onClick={() => setSel(a)} style={{ width: '100%', display: 'grid', gridTemplateColumns: '120px 1fr 130px 150px 150px 40px', gap: 10, padding: '12px 16px', alignItems: 'center', borderTop: '1px solid var(--border)', background: 'var(--bg-surface)', textAlign: 'left', cursor: 'pointer' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-elevated)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-surface)'}>
              <code style={{ font: '700 11.5px/1 var(--f-mono)', color: 'var(--wine)' }}>{a.id}</code>
              <div style={{ minWidth: 0 }}>
                <div style={{ font: '700 12.5px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{a.client}</div>
                <code style={{ font: '500 10.5px/1 var(--f-mono)', color: 'var(--ink-mute)' }}>{a.markbox}</code>
              </div>
              <code style={{ font: '600 11.5px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>{a.quote}</code>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {a.docs.map(([n, v], k) => {
                  const d = LEGAL_DOCS.find(x => x.name === n);
                  const stale = d && d.current !== v;
                  return <U.Badge key={k} tone={stale ? 'warning' : 'neutral'} size="sm">{n.includes('Operador') ? 'Op.' : 'T&C'} {v}</U.Badge>;
                })}
              </div>
              <span style={{ font: '500 11px/1.3 var(--f-mono)', color: 'var(--ink-soft)' }}>{a.at}</span>
              <span style={{ color: 'var(--ink-mute)', display: 'flex', justifyContent: 'flex-end' }}>{I.chevR(15)}</span>
            </button>
          ))}
          {filtered.length === 0 && (
            <div style={{ padding: '28px', textAlign: 'center', font: '500 12.5px/1.4 var(--f-sans)', color: 'var(--ink-mute)', borderTop: '1px solid var(--border)' }}>Sin aceptaciones que coincidan con el filtro.</div>
          )}
        </U.Card>

        {/* detalle de un acuse */}
        <U.Modal open={!!sel} onClose={() => setSel(null)} width={520}
          title={sel ? `Acuse ${sel.id}` : ''}
          actions={<U.Btn variant="primary" full onClick={() => setSel(null)}>Cerrar</U.Btn>}>
          {sel && (() => {
            const Row = ({ k, v }) => (
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '9px 0', borderTop: '1px solid var(--border)' }}>
                <span style={{ font: '500 12px/1.4 var(--f-sans)', color: 'var(--ink-soft)', flexShrink: 0 }}>{k}</span>
                <span style={{ font: '600 12px/1.4 var(--f-mono)', color: 'var(--ink)', textAlign: 'right', wordBreak: 'break-all' }}>{v}</span>
              </div>
            );
            return (
              <div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                  <U.Badge tone="success" size="sm" dot>Aceptación válida</U.Badge>
                  <U.Badge tone="neutral" size="sm">{sel.orden}</U.Badge>
                </div>
                <div style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', padding: '4px 16px 12px' }}>
                  <div style={{ font: '700 9.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.14em', textTransform: 'uppercase', padding: '14px 0 4px' }}>Evidencia</div>
                  <Row k="Cliente" v={`${sel.client} · ${sel.markbox}`} />
                  <Row k="Cotización" v={sel.quote} />
                  <Row k="Orden generada" v={sel.orden} />
                  {sel.docs.map(([n, v], k) => <Row key={k} k={k === 0 ? 'Documentos' : ''} v={`${n} ${v}`} />)}
                  <Row k="Fecha / hora" v={sel.at} />
                  <Row k="IP" v={sel.ip} />
                  <Row k="Hash" v={sel.hash} />
                </div>
              </div>
            );
          })()}
        </U.Modal>
      </div>
    );
  }

  window.AdminLegalDocs = AdminLegalDocs;
  window.AdminAcceptances = AdminAcceptances;
})();
