/* global React */
/* ── DTD ERP · Almacén CN (recepción & consolidación) ───────── */

// ── Diccionario CN → ES para suppliers y términos frecuentes ──
const CN_DICT = {
  'Yiwu Standard Co':       { cn: '义乌标准贸易', es: 'Yiwu Comercial Estándar' },
  'Shenzhen Lights Ltd':    { cn: '深圳灯具有限', es: 'Iluminación Shenzhen SL' },
  'Shanghai Tech Corp':     { cn: '上海科技集团', es: 'Tecnología Shanghai Corp' },
  'Guangzhou Textile':      { cn: '广州纺织',     es: 'Textiles Guangzhou' },
  'Yiwu Trade Mall':        { cn: '义乌商城',     es: 'Centro Comercial Yiwu' },
  'Shenzhen Beauty':        { cn: '深圳美妆',     es: 'Belleza Shenzhen' },
  'Industrial CN Grp':      { cn: '中国工业集团', es: 'Grupo Industrial CN' },
};

function ModuleCN({ goTo, view, setView, selectedId, setSelectedId, currentUser }) {
  const D = window.ERPData;
  const U = window.ERPUI;
  const [search, setSearch] = React.useState('');
  const [warehouseFilter, setWarehouseFilter] = React.useState('all');
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [drawerKind, setDrawerKind] = React.useState(null);
  const [lang, setLang] = React.useState('original'); // 'original' | 'cn' | 'es'
  const [consolidateOpen, setConsolidateOpen] = React.useState(false);

  React.useEffect(() => { if (view === 'create') setDrawerKind('create'); }, [view]);

  const filtered = React.useMemo(() => {
    const u = currentUser || window.__currentUser;
    let rows = D.WAREHOUSE_CN;
    // Apply user scope (if scoped role)
    if (u?.scope?.type === 'scoped' && u.scope.hubs.length > 0) {
      rows = rows.filter(r => u.scope.hubs.includes(r.warehouse));
    }
    if (warehouseFilter !== 'all') rows = rows.filter(r => r.warehouse.startsWith(warehouseFilter));
    if (statusFilter !== 'all') rows = rows.filter(r => r.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(r => r.id.toLowerCase().includes(q) || r.clientName.toLowerCase().includes(q) || r.supplier.toLowerCase().includes(q));
    }
    return rows;
  }, [search, warehouseFilter, statusFilter, currentUser]);

  const pendingCount = D.WAREHOUSE_CN.filter(r => r.status === 'pendiente consolidación').length;
  const totalCBM = D.WAREHOUSE_CN.filter(r => !r.shipment).reduce((s, r) => s + r.cbm, 0);

  const statusTone = { 'pendiente consolidación': 'warning', 'consolidado': 'success', 'incidencia': 'danger' };

  const columns = [
    { label: 'Recepción', key: 'id', render: (r) => <code style={{ font: '800 11.5px/1 var(--f-mono)' }}>{r.id}</code>, width: 130 },
    { label: 'Cliente', key: 'clientName', render: (r) => (
      <button onClick={(e) => { e.stopPropagation(); goTo('clients', r.client, 'detail'); }} style={{ textAlign: 'left', padding: 0 }}>
        <div style={{ font: '600 12.5px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{r.clientName}</div>
        <code style={{ font: '600 11px/1 var(--f-mono)', color: 'var(--wine)' }}>{r.client}</code>
      </button>
    )},
    { label: 'Proveedor CN', key: 'supplier', render: (r) => {
      const d = CN_DICT[r.supplier];
      const main = lang === 'cn' && d ? d.cn : lang === 'es' && d ? d.es : r.supplier;
      const sub  = lang === 'cn' && d ? d.es : lang === 'es' && d ? d.cn : d ? d.cn : null;
      return (
        <div>
          <div style={{ font: `500 12.5px/1.3 ${lang === 'cn' ? '"Noto Sans SC", var(--f-sans)' : 'var(--f-sans)'}`, color: 'var(--ink)' }}>{main}</div>
          {sub && lang !== 'original' && (
            <div style={{ font: `500 10.5px/1.3 ${lang === 'cn' ? 'var(--f-sans)' : '"Noto Sans SC", var(--f-sans)'}`, color: 'var(--ink-mute)', marginTop: 2 }}>{sub}</div>
          )}
        </div>
      );
    } },
    { label: 'Almacén', key: 'warehouse', render: (r) => <U.Badge tone="info" size="sm">{r.warehouse}</U.Badge>, width: 80 },
    { label: 'Cajas', key: 'boxes', align: 'right', render: (r) => <span className="mono">{r.boxes}</span>, width: 60 },
    { label: 'CBM', key: 'cbm', align: 'right', render: (r) => <span className="mono" style={{ font: '700 12.5px/1 var(--f-mono)' }}>{r.cbm}</span>, width: 60 },
    { label: 'Peso', key: 'weight', align: 'right', render: (r) => <span className="mono">{r.weight}kg</span>, width: 80 },
    { label: 'HS Code', key: 'hsCode', render: (r) => <code style={{ font: '600 11.5px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>{r.hsCode}</code>, width: 90 },
    { label: 'Recibido', key: 'received', render: (r) => <span className="mono" style={{ font: '500 11.5px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>{r.received}</span>, width: 95 },
    { label: 'Estado', key: 'status', render: (r) => <U.Badge tone={statusTone[r.status]} size="sm" dot>{r.status}</U.Badge>, width: 180 },
  ];

  return (
    <div>
      <U.PageHeader
        title="Almacén CN · 中国"
        subtitle="Recepción de mercadería en hubs Yiwu · Guangzhou · Shenzhen · Shanghai. Consolidación previa a zarpe."
        actions={
          <>
            <LangToggle value={lang} onChange={setLang} />
            <U.Btn variant="secondary" icon={window.Icon.upload(14)}>Importar Excel</U.Btn>
            <U.Btn variant="primary" icon={window.Icon.plus(14)} onClick={() => { setView('create'); setDrawerKind('create'); }}>Nueva recepción</U.Btn>
          </>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 'var(--s-5)' }}>
        <U.KPI label="Recepciones del mes" value={D.WAREHOUSE_CN.length} delta="+8 esta sem" tone="wine" icon={window.Icon.warehouse(18)} />
        <U.KPI label="Pendientes consolidar" value={pendingCount} delta="ready to ship" tone="warning" icon={window.Icon.clock(18)} />
        <U.KPI label="CBM en bodega" value={totalCBM.toFixed(1)} sub="metros cúbicos" tone="neutral" icon={window.Icon.box(18)} />
        <U.KPI label="Incidencias" value={D.WAREHOUSE_CN.filter(r=>r.status==='incidencia').length} delta="requiere atención" tone="danger" icon={window.Icon.warn(18)} />
      </div>

      <U.Toolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar por ID, cliente o proveedor…"
        filters={
          <>
            <U.Select value={warehouseFilter} onChange={(e)=>setWarehouseFilter(e.target.value)} style={{ width: 160 }} options={[
              { value: 'all', label: 'Todos los hubs' },
              { value: 'YIW', label: 'Yiwu · 义乌' },
              { value: 'CAN', label: 'Guangzhou · 广州' },
              { value: 'SZX', label: 'Shenzhen · 深圳' },
              { value: 'SHA', label: 'Shanghai · 上海' },
            ]} />
            <U.Select value={statusFilter} onChange={(e)=>setStatusFilter(e.target.value)} style={{ width: 200 }} options={[
              { value: 'all', label: 'Todos los estados' },
              'pendiente consolidación', 'consolidado', 'incidencia',
            ]} />
          </>
        }
        actions={pendingCount > 0 ? (
          <U.Btn variant="primary" size="sm" icon={window.Icon.box(13)} onClick={() => setConsolidateOpen(true)}>Consolidar {pendingCount}</U.Btn>
        ) : null}
      />

      {/* Consolidation drawer */}
      <U.Drawer
        open={consolidateOpen}
        onClose={() => setConsolidateOpen(false)}
        title={`Consolidar ${pendingCount} recepciones`}
        subtitle="Agrupar recepciones pendientes en un embarque consolidado"
        width={780}
        actions={null}
      >
        <ConsolidationFlow onClose={() => setConsolidateOpen(false)} />
      </U.Drawer>

      {filtered.length === 0
        ? <U.EmptyState icon={window.Icon.warehouse(22)} title="Sin recepciones" body="Las cajas recibidas en Yiwu, Guangzhou, Shenzhen y Shanghai aparecen acá." />
        : <U.Table columns={columns} rows={filtered} />
      }

      <U.Drawer
        open={drawerKind === 'create'}
        onClose={() => { setDrawerKind(null); setView('list'); }}
        title="Nueva recepción CN"
        subtitle="Registro de mercadería recibida en almacén origen"
        width={620}
        actions={
          <>
            <U.Btn variant="ghost" onClick={() => { setDrawerKind(null); setView('list'); }}>Cancelar</U.Btn>
            <U.Btn variant="primary">Registrar recepción</U.Btn>
          </>
        }
      >
        <ReceptionForm />
      </U.Drawer>
    </div>
  );
}

// ── Reception form with photo/file upload + orphan box mode ──
function ReceptionForm() {
  const D = window.ERPData;
  const U = window.ERPUI;
  const [isOrphan, setIsOrphan] = React.useState(false);
  const [client, setClient] = React.useState('');
  const [marks, setMarks] = React.useState('');
  const [photos, setPhotos] = React.useState([
    { id: 'ph-01', name: 'caja-frente-yiwu.jpg',  size: '2.4 MB', kind: 'photo', preview: 'box-front' },
    { id: 'ph-02', name: 'etiqueta-supplier.jpg', size: '1.2 MB', kind: 'photo', preview: 'label' },
  ]);
  const [files, setFiles] = React.useState([
    { id: 'f-01', name: 'invoice-supplier-2842.pdf', size: '184 KB', kind: 'pdf' },
  ]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <U.Select label="Almacén" options={[
        { value: 'YIW-A1', label: 'Yiwu · A1 (义乌港二期 · directo)' },
        { value: 'YIW-A2', label: 'Yiwu · A2 (义乌港二期 · transferencia)' },
        { value: 'CAN-C1', label: 'Guangzhou · C1 (南沙)' },
        { value: 'SZX-A2', label: 'Shenzhen · A2 (盐田)' },
        { value: 'SHA-A1', label: 'Shanghai · A1 (浦东)' },
      ]} />

      {/* Client (with discreet orphan toggle) */}
      <div>
        {!isOrphan && (
          <>
            <U.Select label="Cliente · MARKBOX" value={client} onChange={(e)=>setClient(e.target.value)} options={[
              { value: '', label: 'Seleccioná cliente…' },
              ...D.CLIENTS.map(c => ({ value: c.markbox, label: `${c.markbox} · ${c.company}` })),
            ]} />
            <button onClick={() => setIsOrphan(true)} style={{
              marginTop: 6, font: '600 11px/1.3 var(--f-sans)',
              color: 'var(--ink-mute)', display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '2px 0',
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--wine)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--ink-mute)'}
            >📦 ¿Sin código MARKBOX? · marcar como caja huérfana</button>
          </>
        )}

        {isOrphan && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 12px',
            background: 'var(--warning-bg)',
            border: '1px solid var(--warning)',
            borderRadius: 'var(--r-md)',
            marginBottom: 10,
          }}>
            <span style={{ color: 'var(--warning)', fontSize: 14 }}>📦</span>
            <div style={{ flex: 1, font: '700 12px/1.3 var(--f-sans)', color: 'var(--ink)' }}>
              Caja huérfana <span style={{ font: '500 11px/1.3 var(--f-sans)', color: 'var(--ink-soft)', marginLeft: 4 }}>· se asignará <code style={{ font: '700 11px/1 var(--f-mono)', color: 'var(--warning)' }}>SIN-CODIGO-NNNN</code></span>
            </div>
            <button onClick={() => setIsOrphan(false)} style={{
              font: '600 11px/1 var(--f-sans)', color: 'var(--ink-soft)',
              padding: '4px 8px', borderRadius: 'var(--r-sm)',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.05)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >Desactivar</button>
          </div>
        )}
      </div>

      {/* Orphan-specific fields (only when activated) */}
      {isOrphan && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <U.Input
            label="Marcas / identificación visible en la caja"
            value={marks}
            onChange={(e) => setMarks(e.target.value)}
            placeholder="Ej: ACINDAR-VLN-04 · ⌂ rojo · etiqueta china"
            hint="Cualquier texto, color, símbolo o marca visible. Sirve para reclamarla después."
          />
          <U.Input label="¿Quién la trajo? (chofer/courier)" placeholder="Nombre + transportista" />
          <U.Input label="Posible cliente (sospecha)" placeholder="Si tenés idea de a quién pertenece…" />
        </div>
      )}

      <SupplierInputWithTranslate />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <U.Input label="Cajas" placeholder="0" mono />
        <U.Input label="CBM" placeholder="0.0" mono suffix="m³" />
        <U.Input label="Peso" placeholder="0" mono suffix="kg" />
      </div>

      <U.Input label="HS Code" placeholder="0000.00" mono />

      {/* ── Photos & files upload ───────────────────── */}
      <div>
        <div className="eyebrow eyebrow-wine" style={{ marginBottom: 10 }}>FOTOS DE LA CAJA</div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
          {photos.map(p => (
            <div key={p.id} style={{
              position: 'relative', aspectRatio: '4/3',
              background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)',
              border: '1px solid var(--border)', overflow: 'hidden',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <PhotoThumb kind={p.preview} />
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                padding: '4px 6px', background: 'rgba(15,30,61,0.85)', color: '#fff',
                font: '600 9px/1.2 var(--f-mono)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{p.name}</div>
              <button onClick={() => setPhotos(photos.filter(x => x.id !== p.id))} style={{
                position: 'absolute', top: 4, right: 4,
                width: 22, height: 22, borderRadius: '50%',
                background: 'rgba(168,50,62,0.92)', color: '#fff',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}>{window.Icon.close(11)}</button>
            </div>
          ))}
          <label style={{
            aspectRatio: '4/3', cursor: 'pointer',
            background: 'var(--bg-surface)',
            border: '2px dashed var(--border-strong)',
            borderRadius: 'var(--r-md)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
            color: 'var(--ink-soft)',
            transition: 'border-color var(--dur-fast), color var(--dur-fast)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--wine)'; e.currentTarget.style.color = 'var(--wine)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.color = 'var(--ink-soft)'; }}
          >
            {window.Icon.upload(18)}
            <span style={{ font: '700 10.5px/1 var(--f-sans)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>+ Foto</span>
            <input type="file" accept="image/*" multiple style={{ display: 'none' }} />
          </label>
        </div>

        <div style={{ marginTop: 8, font: '500 11px/1.4 var(--f-sans)', color: 'var(--ink-mute)' }}>
          Subí fotos de la caja, etiqueta del supplier, posibles daños o marcas visibles. JPG/PNG hasta 10 MB cada una.
        </div>
      </div>

      {/* Files */}
      <div>
        <div className="eyebrow eyebrow-wine" style={{ marginBottom: 10 }}>AUTO-DETECTAR HS · DESDE IMAGEN</div>
        <HsDetector photoCount={photos.length} />
      </div>

      {/* Files */}
      <div>
        <div className="eyebrow eyebrow-wine" style={{ marginBottom: 10 }}>ARCHIVOS ADJUNTOS</div>        {files.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
            {files.map(f => (
              <div key={f.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px',
                background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)',
              }}>
                <span style={{
                  width: 30, height: 30, borderRadius: 'var(--r-sm)',
                  background: 'var(--wine-tint)', color: 'var(--wine)',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>{window.Icon.doc(14)}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: '700 12.5px/1.2 var(--f-mono)', color: 'var(--ink)' }}>{f.name}</div>
                  <div style={{ font: '500 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 3 }}>{f.size}</div>
                </div>
                <button onClick={() => setFiles(files.filter(x => x.id !== f.id))} style={{ width: 26, height: 26, color: 'var(--ink-soft)' }}>{window.Icon.trash(13)}</button>
              </div>
            ))}
          </div>
        )}

        <label style={{
          display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center',
          padding: '12px 14px', cursor: 'pointer',
          background: 'var(--bg-surface)',
          border: '2px dashed var(--border-strong)',
          borderRadius: 'var(--r-md)',
          color: 'var(--ink-soft)',
          font: '600 12.5px/1 var(--f-sans)',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--wine)'; e.currentTarget.style.color = 'var(--wine)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.color = 'var(--ink-soft)'; }}
        >
          {window.Icon.upload(14)} + Adjuntar archivo (PDF, Excel, factura, packing list)
          <input type="file" multiple style={{ display: 'none' }} />
        </label>
      </div>

      <U.Input label="Notas internas" placeholder="Estado de la mercadería, observaciones, daños visibles…" />
    </div>
  );
}
// ── Supplier input with auto-translate CN ↔ ES ──────────────
function SupplierInputWithTranslate() {
  const U = window.ERPUI;
  const [value, setValue] = React.useState('');
  const [translation, setTranslation] = React.useState(null);
  const [translating, setTranslating] = React.useState(false);

  const hasChinese = /[\u4e00-\u9fff]/.test(value);
  const hasLatin = /[a-zA-ZáéíóúñÁÉÍÓÚÑ]/.test(value);
  const direction = hasChinese ? 'CN → ES' : hasLatin ? 'ES → CN' : null;

  const translate = () => {
    setTranslating(true);
    setTimeout(() => {
      setTranslating(false);
      if (hasChinese) {
        setTranslation({ from: value, to: 'Comercial Yiwu Estándar', dir: 'CN → ES' });
      } else {
        setTranslation({ from: value, to: '义乌标准贸易公司', dir: 'ES → CN' });
      }
    }, 900);
  };

  const applyTranslation = () => {
    setValue(translation.to);
    setTranslation(null);
  };

  return (
    <div>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ font: '600 11px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Proveedor chino</span>
          {direction && (
            <button onClick={translate} disabled={translating} style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '4px 9px', borderRadius: 'var(--r-sm)',
              background: 'var(--wine-tint)', color: 'var(--wine)',
              font: '700 10.5px/1 var(--f-sans)', letterSpacing: '0.04em',
              opacity: translating ? 0.5 : 1,
            }}>
              {translating
                ? <><span style={{ display: 'inline-flex', animation: 'erp-fade 0.6s infinite alternate' }}>{window.Icon.refresh(10)}</span> Traduciendo…</>
                : <>{window.Icon.globe(10)} Traducir {direction}</>
              }
            </button>
          )}
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          height: 38, padding: '0 12px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r-md)',
        }}>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Nombre del supplier · 中文 o español"
            style={{
              flex: 1, height: '100%', border: 0, outline: 'none', background: 'transparent',
              font: `500 13.5px/1 ${hasChinese ? '"Noto Sans SC", var(--f-sans)' : 'var(--f-sans)'}`,
              color: 'var(--ink)',
            }}
          />
        </div>
      </label>

      {translation && (
        <div style={{
          marginTop: 8, padding: '10px 14px',
          background: 'var(--success-bg)',
          border: '1px solid var(--success)',
          borderRadius: 'var(--r-md)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ color: 'var(--success)' }}>{window.Icon.check(13)}</span>
          <div style={{ flex: 1 }}>
            <div style={{ font: '700 10px/1 var(--f-sans)', color: 'var(--success)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>{translation.dir}</div>
            <div style={{ font: `700 13.5px/1.3 ${translation.dir.startsWith('ES') ? '"Noto Sans SC", var(--f-sans)' : 'var(--f-sans)'}`, color: 'var(--ink)' }}>{translation.to}</div>
          </div>
          <U.Btn variant="primary" size="sm" onClick={applyTranslation}>Aplicar</U.Btn>
          <button onClick={() => setTranslation(null)} style={{ width: 26, height: 26, color: 'var(--ink-soft)' }}>{window.Icon.close(12)}</button>
        </div>
      )}
      {!translation && (
        <div style={{ marginTop: 5, font: '500 11px/1.3 var(--f-sans)', color: 'var(--ink-mute)' }}>
          {hasChinese ? 'Texto en chino detectado · click "Traducir" para ver en español.' : hasLatin ? 'Click "Traducir" para enviar el nombre en chino al supplier.' : 'Podés escribir en chino o español · te traducimos al otro idioma con un click.'}
        </div>
      )}
    </div>
  );
}

// ── HS Code AI detector ─────────────────────────────────────
function HsDetector({ photoCount }) {
  const U = window.ERPUI;
  const [state, setState] = React.useState('idle');
  const [results, setResults] = React.useState([]);

  const mockResults = [
    { code: '8517.12.10', desc: 'Teléfonos móviles GSM',     confidence: 92, source: 'visual + label OCR' },
    { code: '8517.12.20', desc: 'Teléfonos móviles · gen.',   confidence: 76, source: 'visual' },
    { code: '8517.62.00', desc: 'Aparatos transmisión datos', confidence: 41, source: 'shape only' },
  ];

  const scan = () => {
    setState('scanning');
    setResults([]);
    setTimeout(() => { setState('found'); setResults(mockResults); }, 1600);
  };

  if (state === 'idle') {
    return (
      <div style={{
        padding: '18px 20px',
        background: photoCount > 0 ? 'var(--bg-elevated)' : 'var(--bg-surface)',
        border: `1.5px ${photoCount > 0 ? 'solid' : 'dashed'} ${photoCount > 0 ? 'var(--wine)' : 'var(--border-strong)'}`,
        borderRadius: 'var(--r-md)',
        display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <div style={{ width: 44, height: 44, borderRadius: 'var(--r-md)', background: photoCount > 0 ? 'var(--wine)' : 'var(--bg-elevated)', color: photoCount > 0 ? '#fff' : 'var(--ink-mute)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{window.Icon.radar(20)}</div>
        <div style={{ flex: 1 }}>
          <div style={{ font: '800 14px/1.2 var(--f-display)', color: 'var(--ink)' }}>Detección IA del código HS</div>
          <div style={{ font: '500 12px/1.5 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 4 }}>
            {photoCount > 0
              ? `Analizamos las ${photoCount} fotos para sugerirte códigos HS posibles. Útil como segunda opinión sobre lo que dijo el supplier.`
              : 'Subí al menos una foto arriba para activar la detección automática.'}
          </div>
        </div>
        <U.Btn variant="primary" icon={window.Icon.radar(13)} onClick={scan} disabled={photoCount === 0}>Detectar HS</U.Btn>
      </div>
    );
  }

  if (state === 'scanning') {
    return (
      <div style={{ padding: '20px 22px', background: 'linear-gradient(135deg, var(--ink) 0%, #1F3055 100%)', borderRadius: 'var(--r-md)', color: '#fff', display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.10)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', animation: 'erp-fade 1s infinite alternate' }}>{window.Icon.radar(22)}</div>
        <div style={{ flex: 1 }}>
          <div style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--wine-soft)', letterSpacing: '0.16em', textTransform: 'uppercase' }}>ANALIZANDO IMÁGENES…</div>
          <div style={{ font: '900 16px/1.2 var(--f-display)', color: '#fff', marginTop: 6 }}>OCR de etiquetas + reconocimiento visual</div>
          <div style={{ marginTop: 10, height: 4, background: 'rgba(255,255,255,0.10)', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ height: '100%', background: 'var(--wine-soft)', width: '60%', borderRadius: 999, animation: 'erp-shimmer 1.4s infinite linear' }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ padding: '14px 18px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 36, height: 36, borderRadius: 'var(--r-md)', background: 'var(--success-bg)', color: 'var(--success)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{window.Icon.check(18)}</div>
        <div style={{ flex: 1 }}>
          <div style={{ font: '800 13px/1.2 var(--f-display)', color: 'var(--ink)' }}>{results.length} sugerencias encontradas</div>
          <div style={{ font: '500 11.5px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 3 }}>Comparalas con el HS code que cargó el supplier arriba. Click en una para copiar.</div>
        </div>
        <U.Btn variant="secondary" size="sm" icon={window.Icon.refresh(12)} onClick={scan}>Volver a escanear</U.Btn>
      </div>

      {results.map((r, i) => {
        const tone = r.confidence >= 85 ? 'success' : r.confidence >= 60 ? 'info' : 'warning';
        const barColor = `var(--${tone})`;
        return (
          <div key={i} style={{
            display: 'grid', gridTemplateColumns: '140px 1fr 110px 110px',
            gap: 14, alignItems: 'center', padding: '12px 14px',
            background: 'var(--bg-surface)',
            border: `1px solid ${i === 0 ? 'var(--success)' : 'var(--border)'}`,
            borderLeft: `3px solid ${barColor}`,
            borderRadius: 'var(--r-md)',
          }}>
            <div>
              <code style={{ font: '800 13.5px/1 var(--f-mono)', color: 'var(--wine)' }}>{r.code}</code>
              {i === 0 && <div style={{ marginTop: 4, font: '700 9.5px/1 var(--f-sans)', color: 'var(--success)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>★ Mejor match</div>}
            </div>
            <span style={{ font: '500 12.5px/1.4 var(--f-sans)', color: 'var(--ink)' }}>{r.desc}</span>
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ font: '800 15px/1 var(--f-mono)', color: barColor }}>{r.confidence}%</span>
                <span style={{ font: '600 9.5px/1 var(--f-sans)', color: 'var(--ink-mute)' }}>conf.</span>
              </div>
              <div style={{ marginTop: 5, height: 4, background: 'var(--bg-elevated)', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${r.confidence}%`, background: barColor, borderRadius: 999 }} />
              </div>
              <div style={{ marginTop: 4, font: '500 10px/1 var(--f-sans)', color: 'var(--ink-mute)' }}>{r.source}</div>
            </div>
            <U.Btn variant={i === 0 ? 'primary' : 'secondary'} size="sm" icon={window.Icon.arrowR(11)} full>Usar este</U.Btn>
          </div>
        );
      })}
    </div>
  );
}

function PhotoThumb({ kind }) {
  if (kind === 'box-front') return (
    <svg viewBox="0 0 120 90" style={{ width: '70%', height: '70%' }}>
      <rect x="20" y="20" width="80" height="55" fill="#C9A77F" stroke="#8B6F4E" strokeWidth="1.5" />
      <line x1="60" y1="20" x2="60" y2="75" stroke="#8B6F4E" strokeWidth="1" />
      <rect x="38" y="35" width="44" height="14" fill="#FFFFFF" stroke="#8B6F4E" strokeWidth="0.5" />
      <text x="60" y="44" fontFamily="Archivo" fontSize="6" fontWeight="700" fill="#7F0F1A" textAnchor="middle">DTD-5452</text>
      <text x="60" y="55" fontFamily="Archivo" fontSize="4" fill="#6B6B6B" textAnchor="middle">CAJA 8/12</text>
    </svg>
  );
  if (kind === 'label') return (
    <svg viewBox="0 0 120 90" style={{ width: '70%', height: '70%' }}>
      <rect x="15" y="20" width="90" height="50" fill="#fff" stroke="#0F1E3D" strokeWidth="1.5" rx="3" />
      <rect x="22" y="28" width="76" height="8" fill="#0F1E3D" />
      <text x="60" y="34" fontFamily="Archivo" fontSize="5" fontWeight="700" fill="#fff" textAnchor="middle" letterSpacing="0.5">SHIPPING LABEL</text>
      <rect x="22" y="42" width="34" height="3" fill="#6B6B6B" />
      <rect x="22" y="48" width="50" height="3" fill="#6B6B6B" />
      <rect x="22" y="54" width="28" height="3" fill="#6B6B6B" />
      <g transform="translate(75, 42)">
        {Array.from({length: 8}).map((_, i) => <rect key={i} x={i*2.5} y="0" width={1 + (i%2)} height="20" fill="#0F1E3D" />)}
      </g>
    </svg>
  );
  return null;
}

window.ModuleCN = ModuleCN;

// ── Consolidation flow (multi-step wizard) ───────────────────
function ConsolidationFlow({ onClose }) {
  const D = window.ERPData;
  const U = window.ERPUI;
  const pending = D.WAREHOUSE_CN.filter(r => r.status === 'pendiente consolidación');
  const [step, setStep] = React.useState(1);
  const [selectedIds, setSelectedIds] = React.useState(pending.map(p => p.id));
  const [container, setContainer] = React.useState('auto');
  const [destination, setDestination] = React.useState('PBL');
  const [vessel, setVessel] = React.useState('');
  const [etd, setEtd] = React.useState('2026-05-30');
  const [done, setDone] = React.useState(false);

  // Filters for selection step
  const [search, setSearch] = React.useState('');
  const [sortBy, setSortBy] = React.useState('date-asc');     // date-asc (FIFO) | date-desc | cbm-desc | weight-desc | boxes-desc
  const [showFilter, setShowFilter] = React.useState('all');  // all | selected | unselected
  const [warehouseFilter, setWarehouseFilter] = React.useState('all');

  // Partial splits per reception { [id]: { boxes, cbm } }  meaning: how many go in THIS shipment
  const [partials, setPartials] = React.useState({});
  const [expandedPartial, setExpandedPartial] = React.useState(null);

  const setPartial = (id, full, boxes, cbm) => {
    if (boxes >= full.boxes) {
      setPartials(p => { const n = { ...p }; delete n[id]; return n; });
    } else {
      setPartials(p => ({ ...p, [id]: { boxes, cbm } }));
    }
  };

  const selected = pending.filter(p => selectedIds.includes(p.id));
  // Effective values (apply partials)
  const eff = (r) => partials[r.id] ? { ...r, boxes: partials[r.id].boxes, cbm: partials[r.id].cbm, weight: Math.round(r.weight * (partials[r.id].cbm / r.cbm)), partial: true } : r;
  const selectedEff = selected.map(eff);
  const totalCBM    = selectedEff.reduce((s, r) => s + r.cbm, 0);
  const totalWeight = selectedEff.reduce((s, r) => s + r.weight, 0);
  const totalBoxes  = selectedEff.reduce((s, r) => s + r.boxes, 0);
  const partialCount = Object.keys(partials).length;
  const uniqueClients = [...new Set(selected.map(r => r.client))];

  // Container recommendation based on CBM
  const recommended = totalCBM < 15 ? 'LCL DDP' : totalCBM <= 28 ? "FCL 20'" : totalCBM <= 60 ? "FCL 40'" : "FCL 40'HC";
  const usage = totalCBM / (recommended === "FCL 20'" ? 28 : recommended === "FCL 40'" ? 56 : recommended === "FCL 40'HC" ? 68 : 30);

  const toggle = (id) => setSelectedIds(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  if (done) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center' }}>
        <div style={{ width: 72, height: 72, margin: '0 auto 18px', borderRadius: '50%', background: 'var(--success-bg)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{window.Icon.check(28)}</div>
        <div style={{ font: '900 22px/1.2 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em' }}>Consolidación creada</div>
        <div style={{ marginTop: 10, font: '500 13px/1.6 var(--f-sans)', color: 'var(--ink-soft)', maxWidth: '40ch', margin: '10px auto 0' }}>
          Se creó el embarque <code style={{ font: '800 13px/1 var(--f-mono)', color: 'var(--wine)' }}>DTDU-472819</code> consolidando <b>{selected.length} recepciones</b> ({totalCBM.toFixed(1)} CBM). Las cajas en almacén ahora muestran "consolidado".
        </div>
        <div style={{ marginTop: 24, display: 'flex', gap: 8, justifyContent: 'center' }}>
          <U.Btn variant="ghost" onClick={onClose}>Cerrar</U.Btn>
          <U.Btn variant="primary" iconRight={window.Icon.arrowR(13)}>Ver embarque</U.Btn>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Stepper */}
      <Stepper step={step} labels={['Seleccionar', 'Contenedor', 'Ruta & zarpe', 'Confirmar']} />

      {/* ── Step 1: Select receptions ────────────────── */}
      {step === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{
            padding: '12px 16px', background: 'var(--bg-elevated)',
            borderRadius: 'var(--r-md)',
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16,
          }}>
            <ConsoStat label="Recepciones" value={selected.length} sub={`de ${pending.length} disponibles`} />
            <ConsoStat label="Total CBM"   value={totalCBM.toFixed(1)} mono />
            <ConsoStat label="Peso total" value={`${totalWeight.toLocaleString()} kg`} mono />
            <ConsoStat label="Clientes"    value={uniqueClients.length} sub={uniqueClients.length > 1 ? 'consolidación multi-cliente' : '1 solo cliente'} />
          </div>

          {/* Filter toolbar */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
            padding: '10px 12px', background: 'var(--bg-surface)',
            border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
          }}>
            {/* Search */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              flex: '1 1 200px', minWidth: 180,
              height: 32, padding: '0 10px',
              background: 'var(--bg-elevated)', borderRadius: 'var(--r-sm)',
            }}>
              <span style={{ color: 'var(--ink-mute)' }}>{window.Icon.search(13)}</span>
              <input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Buscar ID, cliente o supplier…"
                style={{ flex: 1, height: '100%', border: 0, outline: 'none', background: 'transparent', font: '500 12px/1 var(--f-sans)', color: 'var(--ink)' }}
              />
            </div>

            {/* Sort */}
            <select value={sortBy} onChange={(e)=>setSortBy(e.target.value)} style={{
              height: 32, padding: '0 28px 0 10px', borderRadius: 'var(--r-sm)',
              border: '1px solid var(--border)', background: 'var(--bg-surface)',
              font: '600 11.5px/1 var(--f-sans)', color: 'var(--ink)',
              appearance: 'none', cursor: 'pointer',
              backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path d='M1 1l4 4 4-4' stroke='%236B6B6B' stroke-width='1.6' fill='none' stroke-linecap='round'/></svg>\")",
              backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
            }}>
              <option value="date-asc">📅 Más antiguas primero · FIFO</option>
              <option value="date-desc">📅 Más recientes primero</option>
              <option value="cbm-desc">📦 Mayor CBM primero</option>
              <option value="cbm-asc">📦 Menor CBM primero</option>
              <option value="weight-desc">⚖️ Mayor peso primero</option>
              <option value="boxes-desc">🧰 Más cajas primero</option>
            </select>

            {/* Warehouse */}
            <select value={warehouseFilter} onChange={(e)=>setWarehouseFilter(e.target.value)} style={{
              height: 32, padding: '0 28px 0 10px', borderRadius: 'var(--r-sm)',
              border: '1px solid var(--border)', background: 'var(--bg-surface)',
              font: '600 11.5px/1 var(--f-sans)', color: 'var(--ink)',
              appearance: 'none', cursor: 'pointer',
              backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path d='M1 1l4 4 4-4' stroke='%236B6B6B' stroke-width='1.6' fill='none' stroke-linecap='round'/></svg>\")",
              backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
            }}>
              <option value="all">Todos los hubs</option>
              <option value="YIW">Yiwu</option>
              <option value="CAN">Guangzhou</option>
              <option value="SZX">Shenzhen</option>
              <option value="SHA">Shanghai</option>
            </select>

            {/* Selection chips */}
            <div style={{ display: 'flex', padding: 2, background: 'var(--bg-elevated)', borderRadius: 'var(--r-sm)', gap: 2 }}>
              {[
                { v: 'all',         l: `Todas (${pending.length})` },
                { v: 'selected',    l: `Selec. (${selectedIds.length})` },
                { v: 'unselected',  l: `Sin selec. (${pending.length - selectedIds.length})` },
              ].map(o => {
                const a = showFilter === o.v;
                return (
                  <button key={o.v} onClick={() => setShowFilter(o.v)} style={{
                    padding: '5px 10px', borderRadius: 3,
                    background: a ? 'var(--bg-surface)' : 'transparent',
                    color: a ? 'var(--ink)' : 'var(--ink-soft)',
                    font: `${a ? '700' : '500'} 11.5px/1 var(--f-sans)`,
                    boxShadow: a ? 'var(--shadow-xs)' : 'none',
                  }}>{o.l}</button>
                );
              })}
            </div>

            {/* Bulk select */}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              <button onClick={() => setSelectedIds(pending.map(p => p.id))} style={{ font: '700 11.5px/1 var(--f-sans)', color: 'var(--wine)', padding: '6px 8px' }}>Marcar todas</button>
              <span style={{ color: 'var(--border-strong)' }}>·</span>
              <button onClick={() => setSelectedIds([])} style={{ font: '700 11.5px/1 var(--f-sans)', color: 'var(--ink-soft)', padding: '6px 8px' }}>Limpiar</button>
            </div>
          </div>

          {/* Filtered list */}
          {(() => {
            let rows = [...pending];
            if (warehouseFilter !== 'all') rows = rows.filter(r => r.warehouse.startsWith(warehouseFilter));
            if (showFilter === 'selected') rows = rows.filter(r => selectedIds.includes(r.id));
            if (showFilter === 'unselected') rows = rows.filter(r => !selectedIds.includes(r.id));
            if (search) {
              const q = search.toLowerCase();
              rows = rows.filter(r => r.id.toLowerCase().includes(q) || r.clientName.toLowerCase().includes(q) || r.supplier.toLowerCase().includes(q));
            }
            const compare = {
              'date-asc':    (a, b) => a.received.localeCompare(b.received),
              'date-desc':   (a, b) => b.received.localeCompare(a.received),
              'cbm-desc':    (a, b) => b.cbm - a.cbm,
              'cbm-asc':     (a, b) => a.cbm - b.cbm,
              'weight-desc': (a, b) => b.weight - a.weight,
              'boxes-desc':  (a, b) => b.boxes - a.boxes,
            }[sortBy];
            rows.sort(compare);

            // Days waiting (FIFO age) calculation
            const today = new Date('2026-05-23');
            const daysWaiting = (d) => Math.round((today - new Date(d)) / 86400000);

            return rows.length === 0 ? (
              <div style={{
                padding: '30px 20px', textAlign: 'center',
                background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)',
                font: '500 12px/1.5 var(--f-sans)', color: 'var(--ink-mute)',
              }}>
                Sin recepciones con esos filtros.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {rows.map(r => {
                  const isSel = selectedIds.includes(r.id);
                  const days = daysWaiting(r.received);
                  const isOld = days >= 5;
                  const p = partials[r.id];
                  const isPartial = !!p;
                  const displayBoxes = isPartial ? p.boxes : r.boxes;
                  const displayCbm   = isPartial ? p.cbm   : r.cbm;
                  const isExpanded = expandedPartial === r.id;
                  return (
                    <div key={r.id} style={{
                      background: isSel ? (isPartial ? '#fff5f0' : 'var(--wine-tint)') : 'var(--bg-surface)',
                      border: `1px solid ${isPartial ? 'var(--warning)' : isSel ? 'var(--wine)' : 'var(--border)'}`,
                      borderRadius: 'var(--r-md)', overflow: 'hidden',
                    }}>
                      <label style={{
                        display: 'grid', gridTemplateColumns: '24px 130px 1fr 90px 80px 60px 70px',
                        gap: 14, alignItems: 'center', padding: '12px 14px', cursor: 'pointer',
                      }}>
                        <input type="checkbox" checked={isSel} onChange={() => toggle(r.id)} style={{ accentColor: 'var(--wine)', width: 16, height: 16 }} />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <code style={{ font: '800 11px/1 var(--f-mono)', color: 'var(--ink)' }}>{r.id}{isPartial && <span style={{ color: 'var(--warning)' }}>-P1</span>}</code>
                          {isPartial && <U.Badge tone="warning" size="sm">P1 de 2</U.Badge>}
                        </div>
                        <div>
                          <div style={{ font: '700 12.5px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{r.clientName}</div>
                          <div style={{ font: '500 11px/1.2 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 2 }}>{r.supplier} · <U.Badge tone="info" size="sm">{r.warehouse}</U.Badge></div>
                        </div>
                        <div>
                          <div className="mono" style={{ font: '500 11.5px/1 var(--f-mono)', color: 'var(--ink-mute)' }}>{r.received}</div>
                          <div style={{ font: '700 10px/1 var(--f-sans)', color: isOld ? 'var(--warning)' : 'var(--ink-mute)', marginTop: 4, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                            {isOld && '⚠ '}{days}d esperando
                          </div>
                        </div>
                        <span className="mono" style={{ font: '700 12px/1 var(--f-mono)', color: 'var(--ink-soft)', textAlign: 'right' }}>{r.weight.toLocaleString()} kg</span>
                        <span className="mono" style={{ font: '700 12.5px/1 var(--f-mono)', color: isPartial ? 'var(--warning)' : 'var(--ink)', textAlign: 'right' }}>
                          {displayBoxes}{isPartial && <span style={{ color: 'var(--ink-mute)', fontSize: '85%' }}>/{r.boxes}</span>}cj
                        </span>
                        <span className="mono" style={{ font: '800 13px/1 var(--f-mono)', color: isPartial ? 'var(--warning)' : 'var(--wine)', textAlign: 'right' }}>{displayCbm} CBM</span>
                      </label>
                      {isSel && (
                        <div style={{ padding: '0 14px 10px 38px', display: 'flex', alignItems: 'center', gap: 10 }}>
                          <button onClick={() => setExpandedPartial(isExpanded ? null : r.id)} style={{
                            font: '700 11px/1 var(--f-sans)', color: isPartial ? 'var(--warning)' : 'var(--wine)',
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                            padding: '4px 8px', borderRadius: 'var(--r-sm)',
                            background: isPartial ? 'var(--warning-bg)' : 'var(--wine-tint)',
                          }}>
                            {window.Icon.box(11)} {isPartial ? `Editar parcial · ${p.boxes}/${r.boxes} cajas` : 'Hacer parcial · partir envío'}
                          </button>
                          {isPartial && (
                            <span style={{ font: '500 11px/1.3 var(--f-sans)', color: 'var(--ink-soft)' }}>
                              ↪ Restantes <b style={{ color: 'var(--ink)' }}>{r.boxes - p.boxes} cajas · {(r.cbm - p.cbm).toFixed(1)} CBM</b> quedan como <code style={{ font: '700 11px/1 var(--f-mono)', color: 'var(--warning)' }}>{r.id}-P2</code> para próximo embarque
                            </span>
                          )}
                          {isPartial && (
                            <button onClick={() => setPartial(r.id, r, r.boxes, r.cbm)} style={{ font: '600 11px/1 var(--f-sans)', color: 'var(--ink-mute)', marginLeft: 'auto' }}>Quitar parcial</button>
                          )}
                        </div>
                      )}
                      {isExpanded && (
                        <PartialEditor reception={r} initial={p} onSave={(b, c) => { setPartial(r.id, r, b, c); setExpandedPartial(null); }} onClose={() => setExpandedPartial(null)} />
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {partialCount > 0 && (
            <div style={{ padding: '10px 14px', background: 'var(--warning-bg)', borderRadius: 'var(--r-md)', borderLeft: '3px solid var(--warning)', display: 'flex', gap: 10 }}>
              <span style={{ color: 'var(--warning)' }}>{window.Icon.box(13)}</span>
              <div style={{ font: '500 12px/1.5 var(--f-sans)', color: 'var(--ink)' }}>
                <b>{partialCount} envío{partialCount > 1 ? 's' : ''} partido{partialCount > 1 ? 's' : ''}.</b> Las cajas restantes van a quedar como <code style={{ font: '700 11.5px/1 var(--f-mono)', color: 'var(--warning)' }}>-P2</code> esperando próximo embarque. Quedan trackeadas al mismo MARKBOX del cliente.
              </div>
            </div>
          )}

          {uniqueClients.length > 1 && (
            <div style={{ padding: '10px 14px', background: 'var(--warning-bg)', borderRadius: 'var(--r-md)', display: 'flex', gap: 10 }}>
              <span style={{ color: 'var(--warning)' }}>{window.Icon.warn(13)}</span>
              <div style={{ font: '500 12px/1.5 var(--f-sans)', color: 'var(--ink)' }}>
                Estás consolidando carga de <b>{uniqueClients.length} clientes distintos</b>. Conviene si comparten ruta y se factura por separado. Solo recomendado para LCL.
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Step 2: Container choice ────────────────── */}
      {step === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{
            padding: '16px 18px', background: 'var(--ink)', color: '#fff',
            borderRadius: 'var(--r-md)',
          }}>
            <div style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--wine-soft)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>RECOMENDADO PARA {totalCBM.toFixed(1)} CBM</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 10 }}>
              <div style={{ font: '900 26px/1 var(--f-display)', color: '#fff', letterSpacing: '-0.02em' }}>{recommended}</div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ font: '700 10px/1 var(--f-sans)', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.1em' }}>OCUPACIÓN</div>
                <div style={{ font: '800 18px/1 var(--f-mono)', color: '#fff', marginTop: 6 }}>{(usage * 100).toFixed(0)}%</div>
              </div>
            </div>
            <div style={{ marginTop: 10, height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(100, usage*100)}%`, height: '100%', background: usage > 0.85 ? 'var(--warning)' : 'var(--wine-soft)' }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {[
              { v: 'LCL DDP',   cap: 30, rate: '$800/CBM' },
              { v: "FCL 20'",   cap: 28, rate: '$3,200/ctr' },
              { v: "FCL 40'",   cap: 56, rate: '$5,400/ctr' },
              { v: "FCL 40'HC", cap: 68, rate: '$5,800/ctr' },
            ].map(c => {
              const active = container === c.v || (container === 'auto' && c.v === recommended);
              return (
                <button key={c.v} onClick={() => setContainer(c.v)} style={{
                  padding: 12, textAlign: 'left',
                  background: active ? 'var(--wine-tint)' : 'var(--bg-surface)',
                  border: `1.5px solid ${active ? 'var(--wine)' : 'var(--border)'}`,
                  borderRadius: 'var(--r-md)',
                }}>
                  <div style={{ font: '800 13px/1.2 var(--f-display)', color: 'var(--ink)' }}>{c.v}</div>
                  <div style={{ font: '600 11px/1.3 var(--f-mono)', color: 'var(--ink-soft)', marginTop: 4 }}>hasta {c.cap} CBM</div>
                  <div style={{ font: '700 12px/1 var(--f-mono)', color: 'var(--wine)', marginTop: 6 }}>{c.rate}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Step 3: Route + vessel ──────────────────── */}
      {step === 3 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <U.Select label="Puerto destino" value={destination} onChange={(e)=>setDestination(e.target.value)}
            options={D.DESTINATIONS.map(d => ({ value: d.code, label: `${d.name}, ${d.state}` }))} />
          <U.Select label="Naviera" value={vessel} onChange={(e)=>setVessel(e.target.value)} options={[
            { value: '', label: 'Seleccioná naviera…' },
            'COSCO PISCES', 'MSC TIANSHAN', 'CMA CGM JUPITER', 'EVERGREEN ACE', 'ONE COMMITMENT', 'YANG MING WORTH'
          ]} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <U.Input label="ETD · fecha de zarpe" type="date" value={etd} onChange={(e)=>setEtd(e.target.value)} mono />
            <U.Input label="ETA estimada" value="2026-06-28" mono hint="Calculada según ruta y naviera" />
          </div>

          <U.Card padded style={{ background: 'var(--bg-elevated)', border: 0 }}>
            <div className="eyebrow eyebrow-wine" style={{ marginBottom: 8 }}>RESUMEN DE RUTA</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, alignItems: 'center' }}>
              <div>
                <div style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>ORIGEN CN</div>
                <div style={{ font: '800 14px/1.2 var(--f-display)', color: 'var(--ink)', marginTop: 5 }}>Yiwu · Ningbo</div>
              </div>
              <div style={{ textAlign: 'center', color: 'var(--wine)', font: '800 18px/1 var(--f-display)' }}>→</div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>DESTINO VE</div>
                <div style={{ font: '800 14px/1.2 var(--f-display)', color: 'var(--ink)', marginTop: 5 }}>{D.dest(destination).name}</div>
              </div>
            </div>
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              <ConsoStat label="Tránsito estimado" value="38 días" mono />
              <ConsoStat label="Costo flete" value="$31,400" mono />
              <ConsoStat label="Costo / CBM real" value={`$${(31400/totalCBM).toFixed(0)}`} mono />
            </div>
          </U.Card>
        </div>
      )}

      {/* ── Step 4: Confirm ─────────────────────────── */}
      {step === 4 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <U.Card padded style={{ background: 'linear-gradient(135deg, var(--ink) 0%, #1F3055 100%)', color: '#fff', border: 0 }}>
            <div style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--wine-soft)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>NUEVO EMBARQUE</div>
            <code style={{ font: '900 26px/1 var(--f-mono)', color: '#fff', display: 'block', marginTop: 10 }}>DTDU-472819</code>
            <div style={{ marginTop: 10, font: '500 12.5px/1.5 var(--f-sans)', color: 'rgba(255,255,255,0.65)' }}>
              {container === 'auto' ? recommended : container} · {selected.length} recepciones · {totalCBM.toFixed(1)} CBM · {uniqueClients.length} cliente{uniqueClients.length > 1 ? 's' : ''}
            </div>
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.1)', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
              <div>
                <div style={{ font: '700 10px/1 var(--f-sans)', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>RUTA</div>
                <div style={{ font: '700 13px/1.3 var(--f-sans)', color: '#fff', marginTop: 5 }}>Yiwu → {D.dest(destination).name}</div>
              </div>
              <div>
                <div style={{ font: '700 10px/1 var(--f-sans)', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>ETD · ETA</div>
                <div style={{ font: '700 13px/1.3 var(--f-mono)', color: '#fff', marginTop: 5 }}>{etd} → 28 jun</div>
              </div>
              <div>
                <div style={{ font: '700 10px/1 var(--f-sans)', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>NAVIERA</div>
                <div style={{ font: '700 13px/1.3 var(--f-sans)', color: '#fff', marginTop: 5 }}>{vessel || 'Sin asignar'}</div>
              </div>
            </div>
          </U.Card>

          <div style={{ padding: '12px 14px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)' }}>
            <div className="eyebrow eyebrow-wine" style={{ marginBottom: 10 }}>ACCIONES AUTOMÁTICAS AL CONFIRMAR</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, font: '500 12.5px/1.6 var(--f-sans)', color: 'var(--ink)' }}>
              <div>{window.Icon.check(11)} Se crea el embarque <code style={{ font: '700 12px/1 var(--f-mono)', color: 'var(--wine)' }}>DTDU-472819</code> en estado <b>consolidado</b></div>
              <div>{window.Icon.check(11)} Las {selected.length} recepciones cambian a estado <b>consolidado</b> y quedan linkeadas al embarque</div>
              <div>{window.Icon.check(11)} Se notifica a {uniqueClients.length} cliente{uniqueClients.length > 1 ? 's' : ''} con template <b>"Embarque confirmado"</b> (Mailing)</div>
              <div>{window.Icon.check(11)} Se genera <b>BL borrador</b> y <b>Packing List consolidado</b> automáticos</div>
              <div>{window.Icon.check(11)} Aparece en el calendario operativo con ETD {etd}</div>
            </div>
          </div>
        </div>
      )}

      {/* Step nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 14, borderTop: '1px solid var(--border)', marginTop: 4 }}>
        <U.Btn variant="ghost" onClick={onClose}>Cancelar</U.Btn>
        <div style={{ display: 'flex', gap: 8 }}>
          {step > 1 && <U.Btn variant="secondary" icon={window.Icon.arrowL(13)} onClick={() => setStep(step - 1)}>Atrás</U.Btn>}
          {step < 4 && <U.Btn variant="primary" iconRight={window.Icon.arrowR(13)} onClick={() => setStep(step + 1)} disabled={step === 1 && selectedIds.length === 0}>Siguiente</U.Btn>}
          {step === 4 && <U.Btn variant="primary" icon={window.Icon.check(13)} onClick={() => setDone(true)}>Confirmar consolidación</U.Btn>}
        </div>
      </div>
    </div>
  );
}

// ── Partial editor (inline) ─────────────────────────────────
function PartialEditor({ reception, initial, onSave, onClose }) {
  const U = window.ERPUI;
  const [boxes, setBoxes] = React.useState(initial?.boxes ?? Math.floor(reception.boxes / 2));
  const cbm = +(reception.cbm * (boxes / reception.boxes)).toFixed(2);
  const remainingBoxes = reception.boxes - boxes;
  const remainingCbm = +(reception.cbm - cbm).toFixed(2);

  return (
    <div style={{ padding: '14px 18px 16px', background: 'var(--bg-elevated)', borderTop: '1px solid var(--border)' }}>
      <div className="eyebrow eyebrow-wine" style={{ marginBottom: 10 }}>PARTIR ENVÍO · ¿CUÁNTAS CAJAS VAN EN ESTE CONSOLIDADO?</div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: 16, alignItems: 'center', marginBottom: 12 }}>
        <div>
          <input type="range" min="1" max={reception.boxes - 1} value={boxes}
            onChange={(e) => setBoxes(+e.target.value)}
            style={{ width: '100%', accentColor: 'var(--wine)' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', font: '600 10.5px/1 var(--f-mono)', color: 'var(--ink-mute)', marginTop: 4 }}>
            <span>1 caja</span>
            <span>{reception.boxes - 1} cajas</span>
          </div>
        </div>
        <U.Input value={boxes} onChange={(e) => setBoxes(Math.min(reception.boxes - 1, Math.max(1, +e.target.value || 1)))} suffix={`/${reception.boxes}cj`} mono style={{ margin: 0 }} />
      </div>

      {/* Side-by-side preview */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 24px 1fr', gap: 12, alignItems: 'center' }}>
        <div style={{
          padding: 12,
          background: 'var(--bg-surface)',
          border: '1.5px solid var(--warning)',
          borderRadius: 'var(--r-md)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <U.Badge tone="warning" size="sm">P1 de 2 · EN ESTE EMBARQUE</U.Badge>
          </div>
          <code style={{ font: '800 12px/1 var(--f-mono)', color: 'var(--ink)' }}>{reception.id}-P1</code>
          <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            <Mini label="Cajas" value={boxes} />
            <Mini label="CBM" value={cbm} accent />
            <Mini label="Peso" value={`${Math.round(reception.weight * (boxes / reception.boxes)).toLocaleString()}kg`} />
          </div>
        </div>

        <div style={{ font: '900 22px/1 var(--f-display)', color: 'var(--ink-mute)', textAlign: 'center' }}>+</div>

        <div style={{
          padding: 12,
          background: 'var(--bg-surface)',
          border: '1px dashed var(--border-strong)',
          borderRadius: 'var(--r-md)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <U.Badge tone="neutral" size="sm">P2 de 2 · PRÓXIMO EMBARQUE</U.Badge>
          </div>
          <code style={{ font: '800 12px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>{reception.id}-P2</code>
          <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            <Mini label="Cajas" value={remainingBoxes} muted />
            <Mini label="CBM" value={remainingCbm} muted />
            <Mini label="Peso" value={`${Math.round(reception.weight - reception.weight * (boxes / reception.boxes)).toLocaleString()}kg`} muted />
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
        <span style={{ font: '500 11.5px/1.4 var(--f-sans)', color: 'var(--ink-soft)' }}>
          Mismo MARKBOX <code style={{ font: '700 11.5px/1 var(--f-mono)', color: 'var(--wine)' }}>{reception.client}</code> · trackeo unificado
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <U.Btn variant="ghost" size="sm" onClick={onClose}>Cancelar</U.Btn>
          <U.Btn variant="primary" size="sm" icon={window.Icon.check(11)} onClick={() => onSave(boxes, cbm)}>Aplicar parcial</U.Btn>
        </div>
      </div>
    </div>
  );
}

function Mini({ label, value, accent, muted }) {
  return (
    <div>
      <div style={{ font: '700 9px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ font: '800 13px/1 var(--f-mono)', color: muted ? 'var(--ink-soft)' : accent ? 'var(--warning)' : 'var(--ink)', marginTop: 4 }}>{value}</div>
    </div>
  );
}

function Stepper({ step, labels }) {  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${labels.length}, 1fr)`, gap: 4 }}>
      {labels.map((l, i) => {
        const n = i + 1;
        const active = step === n;
        const passed = step > n;
        return (
          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px',
            background: active ? 'var(--wine-tint)' : passed ? 'var(--success-bg)' : 'var(--bg-elevated)',
            borderRadius: 'var(--r-sm)',
            borderBottom: `2px solid ${active ? 'var(--wine)' : passed ? 'var(--success)' : 'var(--border)'}`,
          }}>
            <span style={{
              width: 20, height: 20, borderRadius: '50%',
              background: active ? 'var(--wine)' : passed ? 'var(--success)' : 'var(--bg-surface)',
              color: active || passed ? '#fff' : 'var(--ink-mute)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              font: '800 11px/1 var(--f-mono)', flexShrink: 0,
            }}>{passed ? '✓' : n}</span>
            <span style={{ font: `${active ? '800' : '600'} 11.5px/1.2 var(--f-sans)`, color: active ? 'var(--wine)' : passed ? 'var(--success)' : 'var(--ink-soft)' }}>{l}</span>
          </div>
        );
      })}
    </div>
  );
}

function ConsoStat({ label, value, sub, mono }) {
  return (
    <div>
      <div style={{ font: '700 10px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ font: `800 16px/1 ${mono ? 'var(--f-mono)' : 'var(--f-display)'}`, color: 'var(--ink)', marginTop: 6, letterSpacing: '-0.01em' }}>{value}</div>
      {sub && <div style={{ font: '500 10.5px/1 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

// ── 中文 ⇄ ES translation toggle ────────────────────────────
function LangToggle({ value, onChange }) {
  const opts = [
    { v: 'original', l: 'Original', flag: '🌐' },
    { v: 'cn',       l: '中文',      flag: '🇨🇳' },
    { v: 'es',       l: 'Español',  flag: '🇻🇪' },
  ];
  return (
    <div style={{ display: 'inline-flex', padding: 3, background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', alignItems: 'center', gap: 4 }}>
      {opts.map(o => {
        const a = value === o.v;
        return (
          <button key={o.v} onClick={() => onChange(o.v)} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 11px', borderRadius: 'var(--r-sm)',
            background: a ? 'var(--bg-surface)' : 'transparent',
            color: a ? 'var(--ink)' : 'var(--ink-soft)',
            font: `${a ? '700' : '500'} 12px/1 ${o.v === 'cn' ? '"Noto Sans SC", var(--f-sans)' : 'var(--f-sans)'}`,
            boxShadow: a ? 'var(--shadow-xs)' : 'none',
            transition: 'all var(--dur-fast) var(--ease)',
          }} title={`Mostrar en ${o.l}`}>
            <span style={{ fontSize: 13 }}>{o.flag}</span>
            <span>{o.l}</span>
          </button>
        );
      })}
    </div>
  );
}
