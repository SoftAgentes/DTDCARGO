/* global React */
/* ── ERPUI.SearchSelect · selector estándar buscable + "Agregar nuevo" ──
   Estándar DTD para todo selector (embarque / cliente / producto / proveedor):
   · Escribir = filtra en vivo.  · ↑/↓ + Enter para navegar.
   · Siempre "+ Agregar nuevo" arriba (crea sin salir del formulario).
   · options: [{ value, label, sub, group, indent }]
   Uso: <ERPUI.SearchSelect value=… onChange=(v)=>… options=… onCreate=()=>… createLabel="Agregar a Cliente" placeholder="Seleccioná…" /> */
(function () {
  const { useState, useRef, useEffect } = React;

  function ClienteQuickForm({ name, onClose, onSave }) {
    const U = window.ERPUI;
    const [dn, setDn] = useState(name || '');
    const [rs, setRs] = useState('');
    const [em, setEm] = useState('');
    const [ph, setPh] = useState('');
    const [note, setNote] = useState('');
    useEffect(() => {setDn(name || '');}, [name]);
    const code = 'DTD-' + Math.floor(1000 + Math.random() * 9000);
    return (
      <U.Drawer open onClose={onClose} width={460} title="Crear nuevo cliente" subtitle="Sin salir de donde estabas"
      actions={<React.Fragment><U.Btn variant="ghost" onClick={onClose}>Cancelar</U.Btn><U.Btn variant="primary" icon={window.Icon.check(14)} disabled={!dn.trim()} onClick={() => onSave({ value: code, label: dn + ' (' + code + ')', sub: 'Cliente nuevo' })}>Guardar y usar</U.Btn></React.Fragment>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <U.Input label="Nombre para mostrar" value={dn} onChange={(e) => setDn(e.target.value)} />
          <U.Input label="Razón social" value={rs} onChange={(e) => setRs(e.target.value)} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <U.Input label="Email" value={em} onChange={(e) => setEm(e.target.value)} />
            <U.Input label="Teléfono" value={ph} onChange={(e) => setPh(e.target.value)} />
          </div>
          <div>
            <div style={{ font: '700 10px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Nota</div>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Notas internas del cliente (opcional)" style={{ width: '100%', padding: '9px 11px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--ink)', font: '500 12.5px/1.4 var(--f-sans)', resize: 'vertical' }} />
          </div>
          <div style={{ font: '500 11.5px/1.5 var(--f-sans)', color: 'var(--ink-mute)' }}>Se asigna MARKBOX <code style={{ font: '700 11px/1 var(--f-mono)', color: 'var(--wine)' }}>{code}</code>. Al guardar, vuelve a la factura con el cliente ya seleccionado.</div>
        </div>
      </U.Drawer>);

  }

  function SearchSelect({ value, onChange, options = [], onCreate, createLabel = 'Agregar nuevo', placeholder = 'Buscá o seleccioná…', label, quickCreateClient }) {
    const [open, setOpen] = useState(false);
    const [q, setQ] = useState('');
    const [hi, setHi] = useState(0);
    const [iVal, setIVal] = useState(value);
    const [extra, setExtra] = useState([]);
    const [creating, setCreating] = useState(null);
    const ref = useRef(null);
    const inputRef = useRef(null);

    const cur = value !== undefined ? value : iVal;
    const opts = extra.length ? options.concat(extra) : options;
    const sel = opts.find((o) => o.value === cur);
    const filtered = opts.filter((o) => (o.label + ' ' + (o.sub || '')).toLowerCase().includes(q.toLowerCase()));
    const showCreate = onCreate || quickCreateClient;
    // índice 0 reservado para "Agregar nuevo" cuando se puede crear
    const rows = showCreate ? [{ __create: true }, ...filtered] : filtered;

    useEffect(() => {setHi(q && filtered.length ? showCreate ? 1 : 0 : 0);}, [q, open]);
    useEffect(() => {
      const onDoc = (e) => {if (ref.current && !ref.current.contains(e.target)) {setOpen(false);setQ('');}};
      document.addEventListener('mousedown', onDoc);
      return () => document.removeEventListener('mousedown', onDoc);
    }, []);

    const choose = (row) => {
      if (!row) return;
      if (row.__create) {setOpen(false);setQ('');if (quickCreateClient) {setCreating(q || '');} else {onCreate && onCreate(q);}return;}
      setIVal(row.value);
      onChange && onChange(row.value, row);
      setOpen(false);setQ('');
    };
    const onKey = (e) => {
      if (e.key === 'ArrowDown') {e.preventDefault();setOpen(true);setHi((h) => Math.min(h + 1, rows.length - 1));} else
      if (e.key === 'ArrowUp') {e.preventDefault();setHi((h) => Math.max(h - 1, 0));} else
      if (e.key === 'Enter') {e.preventDefault();choose(rows[hi]);} else
      if (e.key === 'Escape') {setOpen(false);setQ('');}
    };

    const fieldH = 38;
    return (
      <div ref={ref} style={{ position: 'relative', width: '100%' }}>
        {label && <div style={{ font: '700 10px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>}
        <button type="button" onClick={() => {setOpen((o) => !o);setTimeout(() => inputRef.current && inputRef.current.focus(), 0);}}
        style={{
          width: '100%', height: fieldH, padding: '0 10px', display: 'flex', alignItems: 'center', gap: 8,
          border: '1px solid ' + (open ? 'var(--wine)' : 'var(--border)'), borderRadius: 'var(--r-md)',
          background: 'var(--bg-surface)', cursor: 'pointer', textAlign: 'left',
          boxShadow: open ? '0 0 0 3px var(--wine-tint)' : 'none'
        }}>
          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', font: '500 13px/1.3 var(--f-sans)', color: sel ? 'var(--ink)' : 'var(--ink-mute)' }}>
            {sel ? sel.label : placeholder}
          </span>
          <span style={{ color: 'var(--ink-mute)', display: 'inline-flex', flexShrink: 0 }}>{window.Icon.chevD(14)}</span>
        </button>

        {open &&
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 90,
          background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
          boxShadow: 'var(--shadow-lg)', overflow: 'hidden'
        }}>
            <div style={{ padding: 8, borderBottom: '1px solid var(--border)' }}>
              <input ref={inputRef} value={q} onChange={(e) => {setQ(e.target.value);setOpen(true);}} onKeyDown={onKey}
            placeholder={'Buscá…'} style={{
              width: '100%', height: 34, padding: '0 10px', border: '1px solid var(--border)',
              borderRadius: 'var(--r-sm)', background: 'var(--bg-base)', color: 'var(--ink)',
              font: '500 13px/1 var(--f-sans)', outline: 'none'
            }} autoFocus data-comment-anchor="a16885ca78-input-98-15" />
            </div>
            <div style={{ maxHeight: 256, overflowY: 'auto', padding: 4 }}>
              {rows.length === 0 &&
            <div style={{ padding: '12px 10px', font: '500 12px/1.4 var(--f-sans)', color: 'var(--ink-mute)' }}>Sin coincidencias para “{q}”.</div>
            }
              {rows.map((row, idx) => {
              const on = idx === hi;
              if (row.__create) {
                return (
                  <div key="__create" onMouseEnter={() => setHi(idx)} onMouseDown={(e) => {e.preventDefault();choose(row);}}
                  style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 10px', borderRadius: 'var(--r-sm)', cursor: 'pointer', background: on ? 'var(--wine-tint)' : 'transparent', borderBottom: '1px solid var(--border)', marginBottom: 2 }}>
                      <span style={{ color: 'var(--wine)', display: 'inline-flex' }}>{window.Icon.plus(15)}</span>
                      <span style={{ font: '700 12.5px/1.2 var(--f-sans)', color: 'var(--wine)' }}>{createLabel}{q ? ` “${q}”` : ''}</span>
                    </div>);

              }
              return (
                <div key={row.value} onMouseEnter={() => setHi(idx)} onMouseDown={(e) => {e.preventDefault();choose(row);}}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', paddingLeft: 10 + (row.indent ? 18 : 0), borderRadius: 'var(--r-sm)', cursor: 'pointer', background: on ? 'var(--wine-tint)' : row.value === cur ? 'var(--bg-elevated)' : 'transparent' }}>
                    <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', font: `${row.value === cur ? '700' : '500'} 12.5px/1.3 var(--f-sans)`, color: on ? 'var(--wine)' : 'var(--ink)' }}>{row.label}</span>
                    {row.sub && <span style={{ font: 'italic 500 11px/1.2 var(--f-sans)', color: 'var(--ink-mute)', flexShrink: 0, maxWidth: '45%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.sub}</span>}
                  </div>);

            })}
            </div>
          </div>
        }
        {creating !== null && <ClienteQuickForm name={creating} onClose={() => setCreating(null)} onSave={(c) => {setExtra((x) => [...x, c]);setIVal(c.value);onChange && onChange(c.value, c);setCreating(null);}} />}
      </div>);

  }

  window.ERPUI = window.ERPUI || {};
  window.ERPUI.SearchSelect = SearchSelect;
})();