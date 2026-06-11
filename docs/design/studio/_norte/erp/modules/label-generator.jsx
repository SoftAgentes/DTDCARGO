/* global React */
/* ── DTD ERP · Generador de etiquetas para suppliers CN ──────── */
/*                                                                  */
/* Genera planchas PDF con Shipping Mark + Box X/Y bilingüe ES/中文      */
/* para que el cliente DTD-Cargo (o el admin) las mande al supplier */
/* chino. El supplier las pega en cada caja antes del despacho a   */
/* nuestro almacén CN.                                              */
/*                                                                  */
/* Nomenclatura oficial: ver CLAUDE.md.                             */
/* Etiqueta visual de referencia: portal/registro.jsx (Step 4 Guide)*/
/* ────────────────────────────────────────────────────────────── */

(function () {
  const { useState, useMemo, useRef } = React;

  // ── Almacenes CN (destino de las cajas) ──────────────────────
  const WAREHOUSES_CN = [
    {
      id: 'yiw-a1', code: 'YIW-A1', city: 'Yiwu', cityCn: '义乌',
      address: '义乌市国际商贸城三区 5楼 218号 · DTD-Cargo',
      addressEs: 'Yiwu Intl Trade Mall, Distrito 3, piso 5, oficina 218',
      contactCn: '王亮 Wang Liang', phone: '+86 137 5028 9114',
      wechat: 'DTD_CARGO_YIW',
    },
    {
      id: 'gz-b2', code: 'GZ-B2', city: 'Guangzhou', cityCn: '广州',
      address: '广州市番禺区市桥工业园 12号 B栋 · DTD-Cargo',
      addressEs: 'Guangzhou Panyu Industrial Park, edif. 12 B, Shiqiao',
      contactCn: '陈伟 Chen Wei', phone: '+86 188 2266 9988',
      wechat: 'DTD_CARGO_GZ',
    },
    {
      id: 'sz-c1', code: 'SZ-C1', city: 'Shenzhen', cityCn: '深圳',
      address: '深圳市宝安区福永街道工业区 8栋 · DTD-Cargo',
      addressEs: 'Shenzhen Bao\'an Fuyong Industrial Zone, edif. 8',
      contactCn: '张敏 Zhang Min', phone: '+86 159 8842 1107',
      wechat: 'DTD_CARGO_SZ',
    },
  ];

  // Mapa ciudad supplier → warehouse default
  function warehouseForSupplier(sup) {
    if (!sup) return WAREHOUSES_CN[0];
    if (sup.city === 'Yiwu') return WAREHOUSES_CN[0];
    if (sup.city === 'Guangzhou') return WAREHOUSES_CN[1];
    if (sup.city === 'Shenzhen') return WAREHOUSES_CN[2];
    if (sup.city === 'Shanghai') return WAREHOUSES_CN[1];
    return WAREHOUSES_CN[0];
  }

  // ── Formatos de etiqueta disponibles ─────────────────────────
  // Dimensiones reales en mm para que el @page funcione bien en PDF
  const FORMATS = [
    {
      id: 'a4-8up',
      label: 'A4 · 8 etiquetas',
      desc: '99 × 67,7 mm · plancha estándar (Avery L7165)',
      page: { w: 210, h: 297, marginX: 6, marginY: 14.5 },
      cell: { w: 99, h: 67.7, cols: 2, rows: 4, gutterX: 0, gutterY: 0 },
      perPage: 8,
    },
    {
      id: 'a4-4up',
      label: 'A4 · 4 etiquetas grandes',
      desc: '99 × 139 mm · más grandes, mejor lectura',
      page: { w: 210, h: 297, marginX: 6, marginY: 9.5 },
      cell: { w: 99, h: 139, cols: 2, rows: 2, gutterX: 0, gutterY: 0 },
      perPage: 4,
    },
    {
      id: 'thermal-100x150',
      label: 'Térmico 100 × 150 mm',
      desc: 'Impresora Zebra / Brother · 1 por página',
      page: { w: 100, h: 150, marginX: 0, marginY: 0 },
      cell: { w: 100, h: 150, cols: 1, rows: 1, gutterX: 0, gutterY: 0 },
      perPage: 1,
    },
    {
      id: 'thermal-100x100',
      label: 'Térmico 100 × 100 mm',
      desc: 'Térmica cuadrada · 1 por página',
      page: { w: 100, h: 100, marginX: 0, marginY: 0 },
      cell: { w: 100, h: 100, cols: 1, rows: 1, gutterX: 0, gutterY: 0 },
      perPage: 1,
    },
  ];

  // ── QR mock determinista (no escaneable real) ────────────────
  // Generado a partir del Shipping Mark + box index. Visual de un QR.
  function hashStr(s) {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
    return h >>> 0;
  }
  function QRMock({ value, size = 64 }) {
    const grid = 21;
    const cell = size / grid;
    const seed = hashStr(value);
    // PRNG simple basada en seed
    let s = seed;
    const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    const cells = [];
    for (let r = 0; r < grid; r++) {
      for (let c = 0; c < grid; c++) {
        // Tres "finder patterns" en esquinas
        const inFinder =
          (r < 7 && c < 7) ||
          (r < 7 && c > grid - 8) ||
          (r > grid - 8 && c < 7);
        if (inFinder) {
          const lr = r < 7 ? r : grid - 1 - r;
          const lc = c < 7 ? c : (c > grid - 8 ? grid - 1 - c : c);
          // anillo: borde exterior + cuadro interior
          const onRing = (lr === 0 || lr === 6 || lc === 0 || lc === 6);
          const inSquare = (lr >= 2 && lr <= 4 && lc >= 2 && lc <= 4);
          if (onRing || inSquare) cells.push([c, r]);
          continue;
        }
        // separador blanco junto a los finders
        const nextToFinder =
          (r === 7 && c < 8) || (c === 7 && r < 8) ||
          (r === 7 && c > grid - 9) || (c === grid - 8 && r < 8) ||
          (r === grid - 8 && c < 8) || (c === 7 && r > grid - 9);
        if (nextToFinder) continue;
        if (rnd() > 0.52) cells.push([c, r]);
      }
    }
    return (
      <svg width={size} height={size} viewBox={`0 0 ${grid} ${grid}`} shapeRendering="crispEdges" style={{ display: 'block' }}>
        <rect x="0" y="0" width={grid} height={grid} fill="#fff" />
        {cells.map(([c, r], i) => (
          <rect key={i} x={c} y={r} width="1" height="1" fill="#0F1E3D" />
        ))}
      </svg>
    );
  }

  // ── Componente etiqueta individual ───────────────────────────
  function Label({ format, client, supplier, warehouse, boxIndex, totalBoxes, dense, qr }) {
    // Escala el contenido al tamaño físico de la etiqueta
    // base 99×67.7 → factor para otros tamaños
    const isCompact = format.cell.h < 80; // A4-8up · térmica 100x100
    const padding = isCompact ? '7px 9px' : '11px 13px';
    const codeFs = isCompact ? 26 : 36;
    const qrSize = isCompact ? 54 : 78;

    return (
      <div
        className="dtd-label"
        style={{
          width: `${format.cell.w}mm`,
          height: `${format.cell.h}mm`,
          padding,
          background: '#fff',
          color: '#0F1E3D',
          border: '1.2px solid #0F1E3D',
          borderRadius: 2,
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          gap: isCompact ? 4 : 7,
          overflow: 'hidden',
          fontFamily: 'Archivo, system-ui, sans-serif',
          position: 'relative',
          pageBreakInside: 'avoid',
          breakInside: 'avoid',
        }}
      >
        {/* Header bilingüe · dirección del warehouse CN (lo pega el proveedor) */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, borderBottom: '1px dashed #0F1E3D', paddingBottom: isCompact ? 4 : 6 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ font: `900 ${isCompact ? 11 : 13}px/1 'Archivo Black', Archivo, sans-serif`, letterSpacing: '0.02em' }}>SHIP TO · 寄至</div>
            <div style={{ font: `700 ${isCompact ? 8.5 : 10}px/1.25 'Noto Sans SC', Archivo, sans-serif`, color: '#0F1E3D', marginTop: 2 }}>{warehouse.address}</div>
            <div style={{ font: `500 ${isCompact ? 8 : 9}px/1.2 Archivo, sans-serif`, color: '#6B6B6B', marginTop: 1 }}>{warehouse.addressEs}</div>
          </div>
          <div style={{
            background: '#7F0F1A', color: '#fff',
            padding: isCompact ? '3px 6px' : '4px 8px',
            font: `900 ${isCompact ? 9 : 10.5}px/1 'Archivo Black', sans-serif`,
            letterSpacing: '0.08em',
            borderRadius: 2,
            flexShrink: 0,
          }}>{warehouse.code}</div>
        </div>

        {/* Cuerpo: código grande + QR grande (sin datos del cliente) */}
        <div style={{ display: 'flex', gap: isCompact ? 8 : 14, alignItems: 'center', flex: 1, minHeight: 0 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ font: `700 ${isCompact ? 8 : 9}px/1 Archivo, sans-serif`, color: '#6B6B6B', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 3 }}>
              CÓDIGO · 货主代码
            </div>
            <div style={{
              font: `900 ${codeFs * 1.5}px/1 'JetBrains Mono', ui-monospace, monospace`,
              color: '#7F0F1A', letterSpacing: '-0.01em',
            }}>{client.markbox}</div>
          </div>

          {qr && (
            <div style={{ flexShrink: 0, textAlign: 'center' }}>
              <QRMock value={`DTD:${boxIndex}/${totalBoxes}:${hashStr(client.markbox + boxIndex)}`} size={Math.round(qrSize * 1.35)} />
            </div>
          )}
        </div>

        {/* Box X/Y bilingüe */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: isCompact ? '4px 8px' : '6px 10px',
          background: '#0F1E3D', color: '#fff',
          borderRadius: 2,
        }}>
          <div>
            <span style={{ font: `700 ${isCompact ? 8 : 9.5}px/1 Archivo, sans-serif`, opacity: 0.8, letterSpacing: '0.1em', textTransform: 'uppercase' }}>BOX · 箱号</span>
          </div>
          <div style={{ font: `900 ${isCompact ? 15 : 19}px/1 'JetBrains Mono', monospace`, letterSpacing: '-0.01em' }}>
            {boxIndex} <span style={{ opacity: 0.55 }}>/</span> {totalBoxes}
          </div>
        </div>

        {/* Footer: address CN warehouse */}
        {!isCompact && (
          <div style={{ marginTop: 'auto', paddingTop: 4, borderTop: '1px dashed #E8E6E2' }}>
            <div style={{ font: '600 8px/1.3 "Noto Sans SC", Archivo, sans-serif', color: '#0F1E3D' }}>
              收货地址：{warehouse.address}
            </div>
            <div style={{ font: '500 7.5px/1.3 Archivo, sans-serif', color: '#6B6B6B', marginTop: 1 }}>
              联系 / Contacto: {warehouse.contactCn} · {warehouse.phone} · WeChat {warehouse.wechat}
            </div>
          </div>
        )}
        {isCompact && (
          <div style={{ marginTop: 'auto', font: '600 7px/1.2 "Noto Sans SC", Archivo, sans-serif', color: '#6B6B6B', textAlign: 'center' }}>
            {warehouse.cityCn} · WeChat {warehouse.wechat}
          </div>
        )}
      </div>
    );
  }

  // ── Sheet de previsualización (paginado) ─────────────────────
  function Sheet({ format, labels, client, supplier, warehouse, qr, totalBoxes }) {
    const pages = useMemo(() => {
      const out = [];
      for (let i = 0; i < labels.length; i += format.perPage) {
        out.push(labels.slice(i, i + format.perPage));
      }
      return out;
    }, [labels, format]);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {pages.map((page, pi) => (
          <div
            key={pi}
            className="dtd-sheet"
            style={{
              width: `${format.page.w}mm`,
              height: `${format.page.h}mm`,
              padding: `${format.page.marginY}mm ${format.page.marginX}mm`,
              background: '#fff',
              boxShadow: '0 2px 10px rgba(15,30,61,0.10), 0 0 0 1px rgba(15,30,61,0.06)',
              display: 'grid',
              gridTemplateColumns: `repeat(${format.cell.cols}, ${format.cell.w}mm)`,
              gridAutoRows: `${format.cell.h}mm`,
              columnGap: `${format.cell.gutterX}mm`,
              rowGap: `${format.cell.gutterY}mm`,
              justifyContent: 'center',
              alignContent: 'flex-start',
              boxSizing: 'border-box',
              position: 'relative',
              pageBreakAfter: 'always',
              breakAfter: 'page',
            }}
          >
            {page.map((idx, li) => (
              <Label
                key={`${pi}-${li}`}
                format={format}
                client={client}
                supplier={supplier}
                warehouse={warehouse}
                boxIndex={idx}
                totalBoxes={totalBoxes}
                qr={qr}
              />
            ))}
            {/* Page number — invisible en print */}
            <div className="dtd-pagenum" style={{
              position: 'absolute', right: 10, bottom: 6,
              font: '600 9px/1 Archivo, sans-serif', color: 'var(--ink-mute)',
            }}>Página {pi + 1} de {pages.length}</div>
          </div>
        ))}
      </div>
    );
  }

  // ── Modal mensaje WeChat / Email para el supplier ────────────
  function SupplierMessageModal({ open, onClose, client, supplier, warehouse, totalBoxes, copiesPerBox, totalLabels }) {
    const U = window.ERPUI;
    const I = window.Icon;
    const [copied, setCopied] = useState('');
    if (!open) return null;

    const copiesNote = copiesPerBox > 1 ? ` (${copiesPerBox} etiquetas por caja, pega una en cada cara para que no se pierda la trazabilidad si una se tapa o maltrata)` : '';
    const copiesNoteCn = copiesPerBox > 1 ? `（每个箱子贴 ${copiesPerBox} 张标签，在不同面上各贴一张，防止装卸时贴纸被遮挡或损坏）` : '';

    const msgEs = `Hola ${supplier?.contactName || 'equipo'},\n\nAdjunto te paso ${totalLabels} etiquetas DTD-Cargo para ${totalBoxes} cajas${copiesNote}. Pegalas antes del despacho a nuestro almacén ${warehouse.code} (${warehouse.city}).\n\nShipping Mark del cliente: ${client.markbox}\nCliente: ${client.name}${client.company ? ' · ' + client.company : ''}\nTotal cajas: ${totalBoxes}\nEtiquetas por caja: ${copiesPerBox}\n\nCualquier duda escribime por WeChat: ${warehouse.wechat}\n\nGracias!\nDTD-Cargo`;

    const msgCn = `${supplier?.contactCn ? supplier.contactCn + '您好' : '您好'}：\n\n附件是 ${totalLabels} 张 DTD-Cargo 标签，用于 ${totalBoxes} 个箱子${copiesNoteCn}。请在发到我们仓库 ${warehouse.code}（${warehouse.cityCn}）之前贴好。\n\n客户编号 (Shipping Mark): ${client.markbox}\n客户名称: ${client.name}\n总箱数: ${totalBoxes}\n每箱标签数: ${copiesPerBox}\n\n如有疑问请微信联系: ${warehouse.wechat}\n\n谢谢！\nDTD-Cargo 国际货运`;

    function copy(text, label) {
      navigator.clipboard?.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(''), 1800);
    }

    return (
      <U.Modal open={open} onClose={onClose} title="Mensaje para el supplier" width={620}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ font: '500 12.5px/1.5 var(--f-sans)', color: 'var(--ink-soft)' }}>
            Copia uno de los dos mensajes y mandalo por WeChat o email junto con el PDF de etiquetas.
          </div>

          <MsgBlock
            title="Mensaje en español"
            text={msgEs}
            onCopy={() => copy(msgEs, 'es')}
            copied={copied === 'es'}
          />

          <MsgBlock
            title="中文消息"
            text={msgCn}
            onCopy={() => copy(msgCn, 'cn')}
            copied={copied === 'cn'}
            mono="cn"
          />

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <U.Btn variant="ghost" onClick={onClose}>Cerrar</U.Btn>
            <U.Btn variant="primary" icon={I.mail(14)} onClick={() => {
              window.openQuickEmail?.({
                to: supplier?.email || '',
                subject: `DTD-Cargo · ${totalBoxes} etiquetas · Shipping Mark ${client.markbox}`,
                body: msgEs + '\n\n— — —\n\n' + msgCn,
              });
              onClose();
            }}>Abrir en Compose</U.Btn>
          </div>
        </div>
      </U.Modal>
    );
  }

  function MsgBlock({ title, text, onCopy, copied, mono }) {
    const I = window.Icon;
    return (
      <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
        <div style={{
          padding: '8px 12px', background: 'var(--bg-elevated)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: '1px solid var(--border)',
        }}>
          <div style={{ font: '700 11px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{title}</div>
          <button onClick={onCopy} style={{
            font: '700 11.5px/1 var(--f-sans)',
            color: copied ? 'var(--success)' : 'var(--wine)',
            display: 'inline-flex', alignItems: 'center', gap: 5,
          }}>
            {copied ? I.check(13) : I.copy(13)}
            {copied ? 'Copiado' : 'Copiar'}
          </button>
        </div>
        <pre style={{
          margin: 0, padding: 12,
          font: `500 12px/1.55 ${mono === 'cn' ? "'Noto Sans SC', Archivo" : 'var(--f-sans)'}`,
          color: 'var(--ink)', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          background: 'var(--bg-surface)', maxHeight: 220, overflow: 'auto',
        }}>{text}</pre>
      </div>
    );
  }

  // ── Módulo principal ─────────────────────────────────────────
  function ModuleLabelGenerator({ selectedId }) {
    const D = window.ERPData;
    const U = window.ERPUI;
    const I = window.Icon;

    const [clientMarkbox, setClientMarkbox] = useState(selectedId || D.CLIENTS[0].markbox);
    const [supplierId, setSupplierId] = useState('');
    const [warehouseId, setWarehouseId] = useState('yiw-a1');
    const [totalBoxes, setTotalBoxes] = useState(12);
    const [startBox, setStartBox] = useState(1);
    const [copiesPerBox, setCopiesPerBox] = useState(2);
    const [formatId, setFormatId] = useState('a4-8up');
    const [qr, setQr] = useState(true);
    const [msgOpen, setMsgOpen] = useState(false);

    const client = D.CLIENTS.find(c => c.markbox === clientMarkbox) || D.CLIENTS[0];
    const supplier = D.SUPPLIERS.find(s => s.id === supplierId);
    const format = FORMATS.find(f => f.id === formatId);
    // Cuando se elige supplier, sugerimos warehouse default
    React.useEffect(() => {
      if (supplier) setWarehouseId(warehouseForSupplier(supplier).id);
    }, [supplierId]);
    const warehouse = WAREHOUSES_CN.find(w => w.id === warehouseId) || WAREHOUSES_CN[0];

    // labels = secuencia de números de caja, repetidos N veces por copies
    // (todas las copias son IDÉNTICAS · el supplier las pega en distintas caras
    // de la misma caja para asegurar trazabilidad si una se tapa o maltrata)
    const labels = useMemo(() => {
      const total = Math.max(1, Math.min(200, +totalBoxes || 1));
      const start = Math.max(1, Math.min(total, +startBox || 1));
      const copies = Math.max(1, Math.min(4, +copiesPerBox || 1));
      const arr = [];
      for (let i = start; i <= total; i++) {
        for (let k = 0; k < copies; k++) arr.push(i);
      }
      return arr;
    }, [totalBoxes, startBox, copiesPerBox]);
    const boxesInRange = Math.max(0, (Math.max(1, Math.min(200, +totalBoxes || 1))) - (Math.max(1, Math.min(+totalBoxes || 1, +startBox || 1))) + 1);

    const pages = Math.ceil(labels.length / format.perPage);

    function handlePrint() {
      window.print();
    }

    return (
      <div>
        <U.PageHeader
          title="Etiquetas para suppliers CN"
          subtitle="Plancha PDF bilingüe ES / 中文 · Shipping Mark + Box X/Y"
          right={
            <div style={{ display: 'flex', gap: 8 }}>
              <U.Btn variant="ghost" icon={I.mail(14)} onClick={() => setMsgOpen(true)}>
                Mensaje al supplier
              </U.Btn>
              <U.Btn variant="primary" icon={I.download(14)} onClick={handlePrint}>
                Imprimir / Guardar PDF
              </U.Btn>
            </div>
          }
        />

        <div className="dtd-labelgen-grid" style={{
          display: 'grid', gridTemplateColumns: '360px 1fr', gap: 20, alignItems: 'flex-start',
        }}>
          {/* ── Panel config ── */}
          <div className="dtd-labelgen-config" style={{ display: 'flex', flexDirection: 'column', gap: 14, position: 'sticky', top: 16 }}>
            <U.Card padded>
              <div className="eyebrow eyebrow-wine" style={{ marginBottom: 10 }}>CLIENTE · Shipping Mark</div>
              <U.Select
                label="Cliente"
                value={clientMarkbox}
                onChange={(e) => setClientMarkbox(e.target.value)}
                options={D.CLIENTS.map(c => ({ value: c.markbox, label: `${c.markbox} · ${c.name}` }))}
              />
              <div style={{
                marginTop: 10, padding: '10px 12px',
                background: 'var(--wine-tint)', border: '1px solid var(--wine)',
                borderRadius: 'var(--r-sm)',
              }}>
                <div style={{ font: '700 9px/1 var(--f-sans)', color: 'var(--wine)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 4 }}>Shipping Mark</div>
                <code style={{ font: '900 20px/1 var(--f-mono)', color: 'var(--wine)' }}>{client.markbox}</code>
                <div style={{ font: '600 11.5px/1.3 var(--f-sans)', color: 'var(--ink)', marginTop: 4 }}>
                  {client.name}{client.company ? ` · ${client.company}` : ''}
                </div>
              </div>
            </U.Card>

            <U.Card padded>
              <div className="eyebrow eyebrow-wine" style={{ marginBottom: 10 }}>PROVEEDOR · OPCIONAL</div>
              <U.Select
                label="Supplier chino"
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                options={[
                  { value: '', label: '— Sin asignar —' },
                  ...D.SUPPLIERS.map(s => ({ value: s.id, label: `${s.city} · ${s.name}` })),
                ]}
              />
              {supplier && (
                <div style={{ marginTop: 8, font: '500 11.5px/1.4 var(--f-sans)', color: 'var(--ink-soft)' }}>
                  Contacto: <b style={{ color: 'var(--ink)' }}>{supplier.contactName}</b> · {supplier.contactCn}
                  <br />
                  <span style={{ font: '600 11px/1.4 var(--f-mono)', color: 'var(--ink-mute)' }}>
                    WeChat {supplier.wechat} · {supplier.phone}
                  </span>
                </div>
              )}
              <U.Select
                style={{ marginTop: 10 }}
                label="Almacén CN destino"
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                options={WAREHOUSES_CN.map(w => ({ value: w.id, label: `${w.code} · ${w.city} · ${w.cityCn}` }))}
              />
            </U.Card>

            <U.Card padded>
              <div className="eyebrow eyebrow-wine" style={{ marginBottom: 10 }}>CAJAS · BOX X/Y</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <U.Input
                  label="Box inicial (X)"
                  type="number"
                  value={startBox}
                  onChange={(e) => setStartBox(e.target.value)}
                  mono
                />
                <U.Input
                  label="Total cajas (Y)"
                  type="number"
                  value={totalBoxes}
                  onChange={(e) => setTotalBoxes(e.target.value)}
                  mono
                />
              </div>

              <div style={{ marginTop: 14 }}>
                <div style={{ font: '700 11px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.06em', marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>Etiquetas por caja</span>
                  <span style={{ font: '500 10.5px/1 var(--f-sans)', color: 'var(--ink-mute)', textTransform: 'none', letterSpacing: 0 }}>recomendado · 2</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                  {[1, 2, 3, 4].map(n => (
                    <button
                      key={n}
                      onClick={() => setCopiesPerBox(n)}
                      style={{
                        padding: '10px 6px',
                        borderRadius: 'var(--r-sm)',
                        border: `1px solid ${copiesPerBox === n ? 'var(--wine)' : 'var(--border)'}`,
                        background: copiesPerBox === n ? 'var(--wine)' : 'var(--bg-surface)',
                        color: copiesPerBox === n ? '#fff' : 'var(--ink)',
                        font: `900 16px/1 'JetBrains Mono', monospace`,
                        cursor: 'pointer',
                        transition: 'all var(--dur) var(--ease)',
                      }}
                    >
                      ×{n}
                    </button>
                  ))}
                </div>
                <div style={{ marginTop: 6, font: '500 11px/1.4 var(--f-sans)', color: 'var(--ink-mute)' }}>
                  Imprimí la misma etiqueta {copiesPerBox} {copiesPerBox === 1 ? 'vez' : 'veces'} por caja para pegar en {copiesPerBox === 1 ? 'una cara' : copiesPerBox === 2 ? 'dos caras' : copiesPerBox === 3 ? 'tres caras' : 'cuatro caras'} · si una se tapa o maltrata, las otras mantienen la trazabilidad.
                </div>
              </div>

              <div style={{
                marginTop: 12, padding: '10px 12px',
                background: 'var(--bg-elevated)', borderRadius: 'var(--r-sm)',
                font: '500 11.5px/1.5 var(--f-sans)', color: 'var(--ink-soft)',
              }}>
                Genera <b style={{ color: 'var(--ink)' }}>{labels.length}</b> etiqueta{labels.length !== 1 ? 's' : ''} · <b style={{ color: 'var(--ink)' }}>{boxesInRange}</b> caja{boxesInRange !== 1 ? 's' : ''} × <b style={{ color: 'var(--ink)' }}>{copiesPerBox}</b> {copiesPerBox === 1 ? 'copia' : 'copias'}
                <div style={{ marginTop: 4, font: '600 11px/1 var(--f-mono)', color: 'var(--wine)' }}>{startBox}/{totalBoxes} → {totalBoxes}/{totalBoxes}</div>
              </div>
            </U.Card>

            <U.Card padded>
              <div className="eyebrow eyebrow-wine" style={{ marginBottom: 10 }}>FORMATO DE PAPEL</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {FORMATS.map(f => (
                  <button
                    key={f.id}
                    onClick={() => setFormatId(f.id)}
                    style={{
                      textAlign: 'left',
                      padding: '10px 12px',
                      borderRadius: 'var(--r-sm)',
                      border: `1px solid ${formatId === f.id ? 'var(--wine)' : 'var(--border)'}`,
                      background: formatId === f.id ? 'var(--wine-tint)' : 'var(--bg-surface)',
                      boxShadow: formatId === f.id ? '0 0 0 3px var(--wine-tint)' : 'none',
                    }}
                  >
                    <div style={{ font: '700 12.5px/1.2 var(--f-sans)', color: formatId === f.id ? 'var(--wine)' : 'var(--ink)' }}>{f.label}</div>
                    <div style={{ font: '500 11px/1.3 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 2 }}>{f.desc}</div>
                  </button>
                ))}
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, font: '600 12px/1 var(--f-sans)', color: 'var(--ink-soft)', cursor: 'pointer' }}>
                <input type="checkbox" checked={qr} onChange={(e) => setQr(e.target.checked)} style={{ accentColor: 'var(--wine)' }} />
                Incluir código QR (escaneable en bodega CN)
              </label>
            </U.Card>

            <div style={{
              padding: '10px 12px',
              background: 'var(--info-bg)', color: 'var(--info)',
              borderRadius: 'var(--r-sm)',
              font: '500 11.5px/1.5 var(--f-sans)',
              display: 'flex', alignItems: 'flex-start', gap: 8,
            }}>
              <span style={{ marginTop: 1, flexShrink: 0 }}>{I.info(13)}</span>
              <span>Al hacer <b>Imprimir / Guardar PDF</b>, el navegador abre el diálogo de impresión. Elige <b>"Guardar como PDF"</b> como destino. Tamaño de papel: <b>{format.page.w}×{format.page.h} mm</b>.</span>
            </div>
          </div>

          {/* ── Preview ── */}
          <div className="dtd-labelgen-preview">
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 12,
            }}>
              <div>
                <div style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>PREVIEW</div>
                <div style={{ font: '900 18px/1.1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em', marginTop: 4 }}>
                  {labels.length} etiquetas · {pages} página{pages !== 1 ? 's' : ''}
                </div>
                <div style={{ font: '500 11.5px/1 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 4 }}>
                  {boxesInRange} caja{boxesInRange !== 1 ? 's' : ''} × {copiesPerBox} {copiesPerBox === 1 ? 'copia' : 'copias'}
                </div>
              </div>
              <U.Badge tone="wine" size="md">{format.label}</U.Badge>
            </div>

            <div style={{
              padding: 24,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-md)',
              overflow: 'auto',
              maxHeight: 'calc(100vh - 220px)',
            }}>
              <div id="dtd-print-target" style={{ display: 'flex', justifyContent: 'center' }}>
                <Sheet
                  format={format}
                  labels={labels}
                  client={client}
                  supplier={supplier}
                  warehouse={warehouse}
                  qr={qr}
                  totalBoxes={totalBoxes}
                />
              </div>
            </div>
          </div>
        </div>

        <SupplierMessageModal
          open={msgOpen}
          onClose={() => setMsgOpen(false)}
          client={client}
          supplier={supplier}
          warehouse={warehouse}
          totalBoxes={totalBoxes}
          copiesPerBox={copiesPerBox}
          totalLabels={labels.length}
        />

        {/* Print stylesheet */}
        <style>{`
          @media print {
            @page { size: ${format.page.w}mm ${format.page.h}mm; margin: 0; }
            body * { visibility: hidden !important; }
            #dtd-print-target, #dtd-print-target * { visibility: visible !important; }
            #dtd-print-target {
              position: absolute !important;
              left: 0 !important; top: 0 !important;
              width: 100% !important;
              padding: 0 !important; margin: 0 !important;
              background: #fff !important;
            }
            .dtd-sheet {
              box-shadow: none !important;
              page-break-after: always;
              break-after: page;
            }
            .dtd-sheet:last-child { page-break-after: auto; }
            .dtd-pagenum { display: none !important; }
          }
        `}</style>
      </div>
    );
  }

  window.ModuleLabelGenerator = ModuleLabelGenerator;
})();
