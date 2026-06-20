/* global React */
/* ── DTD ERP · Detección de ferias con IA + panel de ferias ──── */
/* Motor único para Ferias China y Ferias Venezuela.             */
/* La IA descubre candidatas → bandeja de revisión → aprobación  */
/* humana → recién ahí entran al calendario. Nada se publica solo.*/

const { useState: _fdState, useMemo: _fdMemo } = React;

const _FD_KEY = 'dtd-fair-store';

function _scopeObj() {return { CN: [], VE: [] };}
function _fdEmpty() {
  return {
    approved: { feria: _scopeObj(), feriado: _scopeObj() },
    discarded: { feria: _scopeObj(), feriado: _scopeObj() },
    candidates: { feria: _scopeObj(), feriado: _scopeObj() },
    audit: { feria: _scopeObj(), feriado: _scopeObj() },
    sources: { feria: _scopeObj(), feriado: _scopeObj() },
    meta: { autoSync: true, lastSync: { feria: { CN: null, VE: null }, feriado: { CN: null, VE: null } } } };
}
function _fdLoad() {
  try {
    const raw = JSON.parse(localStorage.getItem(_FD_KEY) || 'null');
    if (!raw) return _fdEmpty();
    const pick = (o) => ({ feria: { CN: o?.feria?.CN || [], VE: o?.feria?.VE || [] }, feriado: { CN: o?.feriado?.CN || [], VE: o?.feriado?.VE || [] } });
    const ls = raw.meta?.lastSync || {};
    return {
      approved: pick(raw.approved),
      discarded: pick(raw.discarded),
      candidates: pick(raw.candidates),
      audit: pick(raw.audit),
      sources: pick(raw.sources),
      meta: { autoSync: raw.meta?.autoSync !== false, lastSync: { feria: { CN: ls.feria?.CN || null, VE: ls.feria?.VE || null }, feriado: { CN: ls.feriado?.CN || null, VE: ls.feriado?.VE || null } } } };

  } catch (e) {return _fdEmpty();}
}
function _fdSave(store) {try {localStorage.setItem(_FD_KEY, JSON.stringify(store));} catch (e) {}}

// Firma para deduplicar: nombre normalizado + mes de inicio
function _fairKey(f) {
  const n = String(f.name || '').toLowerCase().replace(/[^a-z0-9\u00e0-\u00ff]/g, '');
  const m = String(f.start || '').slice(0, 7);
  return n + '|' + m;
}
function _shortName(name) {
  const base = String(name || '').split(' · ')[0].split(' — ')[0].trim();
  if (base.length <= 22) return base;
  return base.split(/\s+/).slice(0, 3).join(' ');
}
// Combina ferias semilla + aprobadas (dedup por firma)
function _mergeApproved(seed, approved) {
  const seen = new Set((seed || []).map(_fairKey));
  const extra = (approved || []).filter((f) => {
    const k = _fairKey(f);
    if (seen.has(k)) return false;
    seen.add(k);return true;
  });
  return [...seed || [], ...extra];
}

function _fdPD(s) {return new Date(String(s).slice(0, 10) + 'T00:00:00');}
function _fdFormatRange(start, end) {
  const s = _fdPD(start),e = _fdPD(end || start);
  const mo = (d) => d.toLocaleDateString('es-VE', { month: 'short' }).replace('.', '');
  if (s.getMonth() === e.getMonth()) return `${s.getDate()}–${e.getDate()} ${mo(e)}`;
  return `${s.getDate()} ${mo(s)} – ${e.getDate()} ${mo(e)}`;
}
function _fairStatus(f, today) {
  const s = _fdPD(f.start),e = _fdPD(f.end || f.start);
  if (today >= s && today <= e) return { label: 'En curso', tone: 'info' };
  if (s > today) return { label: 'Próxima', tone: 'wine' };
  return { label: 'Finalizada', tone: 'neutral' };
}
const _CONF_TONE = { alta: 'success', media: 'warning', baja: 'neutral' };
const _CONF_LABEL = { alta: 'Confianza alta', media: 'Confianza media', baja: 'Confianza baja' };

// ── Prompt + parsing de la IA ───────────────────────────────
function _buildPrompt(kind, country, sources, excludeNames) {
  const place = country === 'CN' ? 'China' : 'Venezuela';
  const sourcesTxt = (sources || []).map((s) => `- ${s.name} (${s.domain})`).join('\n');
  const exclude = excludeNames && excludeNames.length ? excludeNames.join('; ') : 'ninguna';
  if (kind === 'feriado') {
    return (
      `Eres un asistente de research para DTD-Cargo, un courier de carga marítima China→Venezuela.\n` +
      `Lista los feriados oficiales y períodos no laborables de ${place} durante 2026 que afectan la operación logística (almacenes y aduanas que paran).\n` +
      `${country === 'CN' ? 'Incluye los períodos largos como Año Nuevo Chino y Golden Week con su rango completo de días.' : 'Incluye los feriados nacionales decretados.'}\n` +
      `Ten en cuenta fuentes como:\n${sourcesTxt}\n` +
      `Excluye estos que ya están cargados o fueron descartados: ${exclude}.\n\n` +
      `Devuelve entre 5 y 9 feriados como un array JSON. Cada objeto con EXACTAMENTE estos campos:\n` +
      `- "name": nombre del feriado\n` +
      `- "start": fecha inicio "YYYY-MM-DD" en 2026\n` +
      `- "end": fecha fin "YYYY-MM-DD" en 2026 (igual a start si es de un solo día)\n` +
      `- "sourceDomain": dominio de la fuente oficial más probable\n` +
      `- "confidence": "alta" | "media" | "baja". "alta" para feriados fijos y confirmados; "media" si la fecha es móvil o aproximada; "baja" si es incierta. Procura VARIAR el nivel.\n` +
      `- "evidence": una frase corta en español sobre el feriado y su impacto operativo\n\n` +
      `Responde SOLO con el array JSON, sin texto adicional ni markdown.`);

  }
  return (
    `Eres un asistente de research para DTD-Cargo, un courier de carga marítima China→Venezuela.\n` +
    `Busca ferias y expos comerciales en ${place} durante 2026 relevantes para importación, mayorista o logística.\n` +
    `Ten en cuenta fuentes como:\n${sourcesTxt}\n` +
    `Excluye estas ferias (ya cargadas o descartadas): ${exclude}.\n\n` +
    `Devuelve entre 5 y 8 ferias como un array JSON. Cada objeto con EXACTAMENTE estos campos:\n` +
    `- "name": nombre de la feria\n` +
    `- "city": ciudad\n` +
    `- "sector": sector principal, breve\n` +
    `- "start": fecha inicio "YYYY-MM-DD" en 2026\n` +
    `- "end": fecha fin "YYYY-MM-DD" en 2026\n` +
    `- "sourceDomain": dominio de la fuente más probable\n` +
    `- "confidence": "alta" | "media" | "baja". Asigna "alta" solo a ferias reconocidas y recurrentes con fecha confirmada (ej. ferias emblemáticas anuales); "media" si la edición existe pero la fecha es aproximada; "baja" si el evento es incierto o poco documentado. Procura VARIAR el nivel entre las ferias, no pongas todas igual.\n` +
    `- "evidence": una frase corta en español sobre dónde se anuncia o por qué es relevante\n\n` +
    `Responde SOLO con el array JSON, sin texto adicional ni markdown.`);

}
function _parse(raw, country, kind) {
  let txt = String(raw || '').trim().replace(/```json/gi, '').replace(/```/g, '').trim();
  const a = txt.indexOf('['),b = txt.lastIndexOf(']');
  if (a < 0 || b < 0) throw new Error('Respuesta sin JSON');
  const arr = JSON.parse(txt.slice(a, b + 1));
  const isHol = kind === 'feriado';
  return arr.
  filter((o) => o && o.name && o.start).
  map((o, i) => {
    const c = String(o.confidence || '').toLowerCase();
    return {
      id: 'cand-' + kind + '-' + country + '-' + Date.now() + '-' + i,
      country,
      kind,
      name: String(o.name).trim(),
      shortName: _shortName(o.name),
      city: isHol ? '' : o.city || '—',
      sector: isHol ? '' : o.sector || '—',
      start: o.start,
      end: o.end || o.start,
      sourceDomain: o.sourceDomain || '',
      confidence: ['alta', 'media', 'baja'].includes(c) ? c : 'media',
      evidence: o.evidence || '' };

  });
}

// ── Panel completo (tabla + bandeja IA) · Ferias o Feriados ──
function FairsPanel({ country, data, today, store, actions }) {
  const U = window.ERPUI;
  const [kind, setKind] = _fdState('feria');
  const isCN = country === 'CN';
  const isHol = kind === 'feriado';
  const accent = isCN ? 'var(--wine)' : 'var(--success)';
  const noun = isHol ? 'feriados' : 'ferias';
  const fairs = data[kind].merged;
  const sources = (data[kind].baseSources || []).concat(store.sources[kind]?.[country] || []);
  const candidates = store.candidates[kind][country] || [];
  const discarded = store.discarded[kind][country] || [];
  const audit = store.audit[kind][country] || [];
  const sorted = [...fairs].sort((a, b) => new Date(a.start) - new Date(b.start));
  const [busy, setBusy] = _fdState(false);
  const [error, setError] = _fdState(null);

  const runDetection = async () => {
    if (busy) return;
    setBusy(true);setError(null);
    try {
      const prompt = _buildPrompt(kind, country, sources, []);
      const raw = await window.claude.complete(prompt);
      let list = _parse(raw, country, kind);
      const existingKeys = new Set(fairs.map(_fairKey));
      const discardedKeys = new Set(discarded.map((d) => d.key));
      list = list.filter((c) => !existingKeys.has(_fairKey(c)) && !discardedKeys.has(_fairKey(c)));
      if (list.length === 0) setError(`La búsqueda no trajo ${noun} ${isHol ? 'nuevos' : 'nuevas'} (ya están en el calendario o fueron descartad${isHol ? 'os' : 'as'}).`);
      actions.detectInto(kind, country, list);
    } catch (e) {
      setError('No se pudo completar la búsqueda. Prueba de nuevo en unos segundos.');
    }
    setBusy(false);
  };

  const cols = isHol ? '1fr 130px 104px 28px' : '1.7fr 1fr 1.3fr 104px 96px 28px';
  const headers = isHol ? ['Feriado', 'Fechas', 'Estado', ''] : ['Feria', 'Ciudad', 'Sector', 'Fechas', 'Estado', ''];
  const place = isCN ? 'China' : 'Venezuela';

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 14, alignItems: 'flex-start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Switch Ferias | Feriados */}
        <div style={{ display: 'inline-flex', padding: 3, background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', alignSelf: 'flex-start' }}>
          {[{ v: 'feria', l: 'Ferias', i: 'globe' }, { v: 'feriado', l: 'Feriados', i: isCN ? 'cn' : 'flag' }].map((o) => {
            const a = kind === o.v;
            return (
              <button key={o.v} onClick={() => setKind(o.v)} style={{
                display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 14px', borderRadius: 'var(--r-sm)',
                background: a ? 'var(--bg-surface)' : 'transparent', color: a ? 'var(--ink)' : 'var(--ink-soft)',
                font: `${a ? '700' : '500'} 12.5px/1 var(--f-sans)`, boxShadow: a ? 'var(--shadow-xs)' : 'none' }}>
                {window.Icon[o.i](14)} {o.l}
              </button>);

          })}
        </div>

        <FairDetectionQueue
          kind={kind} country={country} noun={noun} isHol={isHol}
          candidates={candidates}
          existingKeys={new Set(fairs.map(_fairKey))}
          busy={busy} error={error} onSearch={runDetection}
          actions={actions} />


        {/* En el calendario */}
        <U.Card padded={false}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
            <span style={{ color: accent, display: 'inline-flex' }}>{isCN ? window.Icon.cn(16) : window.Icon.flag(16)}</span>
            <div style={{ font: '900 15px/1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.01em', flex: 1 }}>
              {isHol ? 'Feriados' : 'Ferias'} en el calendario · {place}
            </div>
            <U.Badge tone="neutral">{fairs.length} {noun}</U.Badge>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 10, padding: '9px 18px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
            {headers.map((h, i) =>
            <div key={i} style={{ font: '700 10px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{h}</div>
            )}
          </div>
          {sorted.map((f, i) => {
            const st = _fairStatus(f, today);
            return (
              <div key={f.id || i} style={{ display: 'grid', gridTemplateColumns: cols, gap: 10, padding: '12px 18px', borderTop: i > 0 ? '1px solid var(--border)' : 0, alignItems: 'center' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ font: '700 12.5px/1.3 var(--f-sans)', color: 'var(--ink)' }}>{f.name.split(' · ')[0]}</span>
                    {f.critical && <U.Badge tone="wine" size="sm">Crítico</U.Badge>}
                    {f.detected && <U.Badge tone="info" size="sm">IA</U.Badge>}
                  </div>
                  {f.cn && <div style={{ font: '500 11px/1.2 var(--f-cn)', color: 'var(--ink-soft)', marginTop: 2 }}>{f.cn}</div>}
                  {f.detected && f.sourceDomain && <div style={{ font: '600 10px/1.2 var(--f-mono)', color: 'var(--ink-mute)', marginTop: 2 }}>{f.sourceDomain}</div>}
                </div>
                {!isHol && <div style={{ font: '500 12px/1.3 var(--f-sans)', color: 'var(--ink)' }}>{f.city}{f.cityCn && <span style={{ font: '500 11px/1 var(--f-cn)', color: 'var(--ink-mute)' }}> · {f.cityCn}</span>}</div>}
                {!isHol && <div style={{ font: '500 11.5px/1.3 var(--f-sans)', color: 'var(--ink-soft)' }}>{f.sector}</div>}
                <div style={{ font: '700 11.5px/1 var(--f-mono)', color: 'var(--ink)' }}>{_fdFormatRange(f.start, f.end)}</div>
                <div><U.Badge tone={st.tone} size="sm">{st.label}</U.Badge></div>
                <div>
                  {f.detected &&
                  <button onClick={() => actions.removeApproved(kind, country, f.id)} title="Quitar del calendario"
                  style={{ width: 24, height: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--r-sm)', color: 'var(--ink-mute)', background: 'transparent' }}
                  onMouseEnter={(e) => {e.currentTarget.style.background = 'var(--bg-elevated)';e.currentTarget.style.color = 'var(--danger)';}}
                  onMouseLeave={(e) => {e.currentTarget.style.background = 'transparent';e.currentTarget.style.color = 'var(--ink-mute)';}}>
                    {window.Icon.trash(13)}
                  </button>}
                </div>
              </div>);

          })}
        </U.Card>

        {/* Historial de descartad@s */}
        {discarded.length > 0 && <DiscardedHistory kind={kind} country={country} discarded={discarded} actions={actions} />}
      </div>

      {/* Sidebar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <SourcesCard kind={kind} country={country} sources={sources} meta={store.meta} busy={busy} onRefresh={runDetection} actions={actions} />
        {audit.length > 0 && <AuditCard audit={audit} />}

        <U.Card padded style={{ background: 'var(--info-bg)', borderColor: 'rgba(42,111,219,0.3)' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span style={{ color: 'var(--info)', flexShrink: 0 }}>{window.Icon.info(14)}</span>
            <div>
              <div style={{ font: '800 12.5px/1.2 var(--f-display)', color: 'var(--ink)' }}>Cómo funciona</div>
              <div style={{ font: '500 11.5px/1.5 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 6 }}>
                La IA propone {noun} con un nivel de confianza. <b style={{ color: 'var(--ink)' }}>Nunca</b> se publican sol{isHol ? 'os' : 'as'}: revisas la bandeja y apruebas. Las fechas de confianza media o baja conviene verificarlas antes.
              </div>
            </div>
          </div>
        </U.Card>
      </div>
    </div>);

}

// ── Bandeja de detección (IA) ───────────────────────────────
function FairDetectionQueue({ kind, country, noun, isHol, candidates, existingKeys, busy, error, onSearch, actions }) {
  const U = window.ERPUI;
  const [confFilter, setConfFilter] = _fdState('all');
  const [sectorFilter, setSectorFilter] = _fdState('all');
  const [q, setQ] = _fdState('');
  const [editing, setEditing] = _fdState(null);

  const sectors = _fdMemo(() => ['all', ...Array.from(new Set(candidates.map((c) => c.sector))).sort()], [candidates]);
  const visible = candidates.filter((c) => {
    if (confFilter !== 'all' && c.confidence !== confFilter) return false;
    if (sectorFilter !== 'all' && c.sector !== sectorFilter) return false;
    if (q && !(`${c.name} ${c.city}`.toLowerCase().includes(q.toLowerCase()))) return false;
    return true;
  });
  const counts = { alta: 0, media: 0, baja: 0 };
  candidates.forEach((c) => counts[c.confidence] !== undefined && counts[c.confidence]++);

  const approveCand = (c, overrides) => actions.approve(kind, country, overrides ? { ...c, ...overrides } : c);

  return (
    <U.Card padded={false}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderBottom: candidates.length ? '1px solid var(--border)' : 0 }}>
        <div style={{ width: 32, height: 32, borderRadius: 'var(--r-md)', background: 'var(--wine-tint)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--wine)', flexShrink: 0 }}>
          {window.Icon.radar(16)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ font: '900 15px/1.1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.01em' }}>Detección automática de {noun}</div>
          <div style={{ font: '500 11.5px/1.3 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 3 }}>
            {candidates.length > 0 ? `${candidates.length} propuesta${candidates.length > 1 ? 's' : ''} para revisar` : `La IA propone ${noun} desde las fuentes. Tú apruebas cuáles entran.`}
          </div>
        </div>
        <U.Btn variant="primary" icon={busy ? null : window.Icon.radar(14)} onClick={onSearch} disabled={busy}>
          {busy ? 'Buscando…' : candidates.length ? 'Buscar de nuevo' : `Buscar ${noun} (IA)`}
        </U.Btn>
      </div>

      {error &&
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '12px 18px', background: 'var(--warning-bg)', borderBottom: candidates.length ? '1px solid var(--border)' : 0 }}>
          <span style={{ color: 'var(--warning)', flexShrink: 0 }}>{window.Icon.warn(14)}</span>
          <span style={{ font: '500 12px/1.4 var(--f-sans)', color: 'var(--ink)' }}>{error}</span>
        </div>
      }

      {busy && candidates.length === 0 &&
      <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[0, 1, 2].map((i) =>
        <div key={i} style={{ height: 54, borderRadius: 'var(--r-md)', background: 'var(--bg-elevated)', opacity: 1 - i * 0.25 }} />
        )}
        </div>
      }

      {candidates.length > 0 &&
      <>
          {/* Filtros + acciones masivas */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
            <div style={{ display: 'inline-flex', padding: 3, background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)' }}>
              {[
            { v: 'alta', l: `Alta ${counts.alta}` },
            { v: 'media', l: `Media ${counts.media}` },
            { v: 'baja', l: `Baja ${counts.baja}` },
            { v: 'all', l: 'Todas' }].
            map((o) => {
              const a = confFilter === o.v;
              return (
                <button key={o.v} onClick={() => setConfFilter(o.v)} style={{
                  padding: '5px 11px', borderRadius: 'var(--r-sm)',
                  background: a ? 'var(--bg-surface)' : 'transparent',
                  color: a ? 'var(--ink)' : 'var(--ink-soft)',
                  font: `${a ? '700' : '500'} 11.5px/1 var(--f-sans)`,
                  boxShadow: a ? 'var(--shadow-xs)' : 'none' }}>{o.l}</button>);

            })}
            </div>
            {!isHol &&
            <select value={sectorFilter} onChange={(e) => setSectorFilter(e.target.value)} style={{
            padding: '7px 10px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)',
            background: 'var(--bg-surface)', color: 'var(--ink)', font: '500 12px/1 var(--f-sans)' }}>
              {sectors.map((s) => <option key={s} value={s}>{s === 'all' ? 'Todos los sectores' : s}</option>)}
            </select>
            }
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={isHol ? 'Buscar feriado…' : 'Buscar feria o ciudad…'} style={{
            flex: 1, minWidth: 140, padding: '7px 11px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)',
            background: 'var(--bg-surface)', color: 'var(--ink)', font: '500 12px/1 var(--f-sans)' }} />
            <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
              <U.Btn variant="ghost" size="sm" onClick={() => actions.discardMany(kind, country, visible)} disabled={!visible.length}>Descartar visibles</U.Btn>
              <U.Btn variant="dark" size="sm" icon={window.Icon.check(13)} onClick={() => actions.approveMany(kind, country, visible)} disabled={!visible.length}>
                Aprobar {visible.length} visible{visible.length !== 1 ? 's' : ''}
              </U.Btn>
            </div>
          </div>

          {/* Lista de candidatas */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {visible.length === 0 ?
          <div style={{ padding: '32px 18px', textAlign: 'center', font: '500 12.5px/1.5 var(--f-sans)', color: 'var(--ink-mute)' }}>
                Ninguna propuesta con estos filtros.
              </div> :

          visible.map((c, i) =>
          <CandidateCard key={c.id} cand={c} first={i === 0} isHol={isHol}
            dup={existingKeys.has(_fairKey(c))}
            onApprove={() => approveCand(c)}
            onDiscard={() => actions.discard(kind, country, c)}
            onEdit={() => setEditing(c)} />
          )
          }
          </div>
        </>
      }

      {editing && <EditFairModal cand={editing} onClose={() => setEditing(null)} onSave={(ov) => {approveCand(editing, ov);setEditing(null);}} />}
    </U.Card>);

}

function CandidateCard({ cand: c, first, dup, isHol, onApprove, onDiscard, onEdit }) {
  const U = window.ERPUI;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, padding: '13px 18px', borderTop: first ? 0 : '1px solid var(--border)', alignItems: 'center' }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ font: '700 13px/1.3 var(--f-sans)', color: 'var(--ink)' }}>{c.name}</span>
          <U.Badge tone={_CONF_TONE[c.confidence]} size="sm" dot>{_CONF_LABEL[c.confidence]}</U.Badge>
          {dup && <U.Badge tone="warning" size="sm">Posible duplicado</U.Badge>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5, font: '500 11.5px/1.3 var(--f-sans)', color: 'var(--ink-soft)', flexWrap: 'wrap' }}>
          {!isHol &&
          <>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>{window.Icon.pin(12)}{c.city}</span>
              <span style={{ color: 'var(--border)' }}>·</span>
              <span>{c.sector}</span>
              <span style={{ color: 'var(--border)' }}>·</span>
            </>
          }
          <span style={{ font: '700 11.5px/1 var(--f-mono)', color: 'var(--ink)' }}>{_fdFormatRange(c.start, c.end)}</span>
        </div>
        {c.evidence &&
        <div style={{ display: 'flex', gap: 7, marginTop: 7, padding: '7px 10px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-sm)' }}>
            <span style={{ color: 'var(--ink-mute)', flexShrink: 0, marginTop: 1 }}>{window.Icon.globe(12)}</span>
            <div style={{ font: '500 11px/1.45 var(--f-sans)', color: 'var(--ink-soft)' }}>
              {c.evidence}{c.sourceDomain && <span style={{ font: '600 10.5px/1 var(--f-mono)', color: 'var(--ink-mute)' }}> · {c.sourceDomain}</span>}
            </div>
          </div>
        }
      </div>
      <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
        <button onClick={onDiscard} title="Descartar" style={{ width: 32, height: 32, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--ink-soft)' }}
        onMouseEnter={(e) => {e.currentTarget.style.color = 'var(--danger)';e.currentTarget.style.borderColor = 'var(--danger)';}}
        onMouseLeave={(e) => {e.currentTarget.style.color = 'var(--ink-soft)';e.currentTarget.style.borderColor = 'var(--border)';}}>
          {window.Icon.close(14)}
        </button>
        <U.Btn variant="ghost" size="sm" icon={window.Icon.edit(13)} onClick={onEdit}>Editar</U.Btn>
        <U.Btn variant="primary" size="sm" icon={window.Icon.check(13)} onClick={onApprove}>Aprobar</U.Btn>
      </div>
    </div>);

}

function EditFairModal({ cand, onClose, onSave }) {
  const U = window.ERPUI;
  const [f, setF] = _fdState({ name: cand.name, city: cand.city, sector: cand.sector, start: cand.start, end: cand.end });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <U.Modal open onClose={onClose} title="Editar antes de aprobar" width={480}
    actions={<><U.Btn variant="ghost" onClick={onClose}>Cancelar</U.Btn><U.Btn variant="primary" icon={window.Icon.check(13)} onClick={() => onSave(f)}>Aprobar feria</U.Btn></>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <U.Input label="Nombre de la feria" value={f.name} onChange={set('name')} />
        {cand.kind !== 'feriado' &&
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <U.Input label="Ciudad" value={f.city} onChange={set('city')} />
          <U.Input label="Sector" value={f.sector} onChange={set('sector')} />
        </div>
        }
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <U.Input label="Inicio (YYYY-MM-DD)" value={f.start} onChange={set('start')} />
          <U.Input label="Fin (YYYY-MM-DD)" value={f.end} onChange={set('end')} />
        </div>
        <div style={{ display: 'flex', gap: 9, padding: '10px 12px', background: 'var(--info-bg)', borderRadius: 'var(--r-md)' }}>
          <span style={{ color: 'var(--info)', flexShrink: 0, marginTop: 1 }}>{window.Icon.info(13)}</span>
          <div style={{ font: '500 11.5px/1.5 var(--f-sans)', color: 'var(--ink)' }}>Corregí lo que detectó la IA y, al aprobar, entra al calendario.</div>
        </div>
      </div>
    </U.Modal>);

}

function DiscardedHistory({ kind, country, discarded, actions }) {
  const U = window.ERPUI;
  const [open, setOpen] = _fdState(false);
  return (
    <U.Card padded={false}>
      <button onClick={() => setOpen(!open)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px', textAlign: 'left', background: 'transparent' }}>
        <span style={{ color: 'var(--ink-soft)', display: 'inline-flex', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform var(--dur-fast) var(--ease)' }}>{window.Icon.arrowR(13)}</span>
        <span style={{ font: '700 12.5px/1 var(--f-sans)', color: 'var(--ink)' }}>Descartadas</span>
        <U.Badge tone="neutral" size="sm">{discarded.length}</U.Badge>
        <span style={{ marginLeft: 'auto', font: '500 11px/1.3 var(--f-sans)', color: 'var(--ink-mute)' }}>No se vuelven a sugerir</span>
      </button>
      {open &&
      <div style={{ display: 'flex', flexDirection: 'column', borderTop: '1px solid var(--border)' }}>
          {discarded.map((d, i) =>
        <div key={d.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px', borderTop: i > 0 ? '1px solid var(--border)' : 0 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: '600 12px/1.3 var(--f-sans)', color: 'var(--ink-soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</div>
                {d.start && <div style={{ font: '600 10.5px/1.2 var(--f-mono)', color: 'var(--ink-mute)', marginTop: 2 }}>{d.start}</div>}
              </div>
              <U.Btn variant="ghost" size="sm" icon={window.Icon.refresh(12)} onClick={() => actions.restore(kind, country, d.key)}>Restaurar</U.Btn>
            </div>
        )}
        </div>
      }
    </U.Card>);

}

function _fdWhen(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('es-VE', { day: '2-digit', month: 'short' }) + ' · ' + d.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
  } catch (e) {return '';}
}

// ── Sidebar: fuentes + sincronización ───────────────────────
function SourcesCard({ kind, country, sources, meta, busy, onRefresh, actions }) {
  const U = window.ERPUI;
  const [adding, setAdding] = _fdState(false);
  const [nm, setNm] = _fdState('');
  const [dm, setDm] = _fdState('');
  const auto = meta?.autoSync !== false;
  const last = meta?.lastSync?.[kind]?.[country];
  const inputStyle = { padding: '7px 10px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--ink)', font: '500 12px/1 var(--f-sans)' };
  const add = () => {
    if (!nm.trim()) return;
    actions.addSource(kind, country, { name: nm.trim(), domain: dm.trim() || '—', cadence: 'Manual' });
    setNm('');setDm('');setAdding(false);
  };
  return (
    <U.Card padded>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div className="eyebrow eyebrow-wine" style={{ flex: 1 }}>FUENTES DE LA IA</div>
        <button onClick={onRefresh} disabled={busy} title="Actualizar ahora" style={{ width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: busy ? 'var(--ink-mute)' : 'var(--wine)' }}>
          {window.Icon.refresh(13)}
        </button>
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', cursor: 'pointer', marginBottom: 10 }}>
        <input type="checkbox" checked={auto} onChange={(e) => actions.setAutoSync(e.target.checked)} style={{ accentColor: 'var(--wine)', width: 14, height: 14, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ font: '700 12px/1.2 var(--f-sans)', color: 'var(--ink)' }}>Sincronización automática</div>
          <div style={{ font: '500 10.5px/1.3 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 2 }}>Cada domingo · y al tocar actualizar</div>
        </div>
      </label>
      <div style={{ display: 'flex', justifyContent: 'space-between', font: '500 10.5px/1.3 var(--f-sans)', color: 'var(--ink-mute)', marginBottom: 12 }}>
        <span>Última: {last ? _fdWhen(last) : '—'}</span>
        <span>Próxima: domingo</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(sources || []).map((s, i) =>
        <div key={i} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 10, alignItems: 'center', padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)' }}>
            <span style={{ color: 'var(--ink-soft)', display: 'inline-flex' }}>{window.Icon.globe(14)}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ font: '700 12px/1.2 var(--f-sans)', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
              <div style={{ font: '600 10.5px/1.2 var(--f-mono)', color: 'var(--ink-soft)', marginTop: 2 }}>{s.domain} · {s.cadence}</div>
            </div>
            <U.Badge tone="success" size="sm" dot>Activa</U.Badge>
          </div>
        )}
      </div>
      {adding ?
      <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)' }}>
          <input value={nm} onChange={(e) => setNm(e.target.value)} placeholder="Nombre de la fuente" style={inputStyle} />
          <input value={dm} onChange={(e) => setDm(e.target.value)} placeholder="dominio.com" style={inputStyle} />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <U.Btn variant="ghost" size="sm" onClick={() => setAdding(false)}>Cancelar</U.Btn>
            <U.Btn variant="primary" size="sm" icon={window.Icon.check(13)} onClick={add}>Agregar</U.Btn>
          </div>
        </div> :

      <button onClick={() => setAdding(true)} style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6, font: '700 11.5px/1 var(--f-sans)', color: 'var(--wine)', background: 'transparent', padding: '6px 2px' }}>
          {window.Icon.link(12)} Añadir fuente
        </button>
      }
    </U.Card>);

}

// ── Sidebar: auditoría de aprobaciones ──────────────────────
function AuditCard({ audit }) {
  const U = window.ERPUI;
  const dot = { 'aprobó': 'var(--success)', 'descartó': 'var(--danger)', 'restauró': 'var(--info)', 'quitó': 'var(--ink-mute)' };
  return (
    <U.Card padded>
      <div className="eyebrow eyebrow-wine" style={{ marginBottom: 10 }}>AUDITORÍA</div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {audit.slice(0, 6).map((a, i) =>
        <div key={i} style={{ display: 'flex', gap: 9, padding: '8px 0', borderTop: i > 0 ? '1px solid var(--border)' : 0 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', marginTop: 6, flexShrink: 0, background: dot[a.action] || 'var(--ink-mute)' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ font: '500 11.5px/1.4 var(--f-sans)', color: 'var(--ink)' }}>
                <b style={{ fontWeight: 700 }}>{a.userName}</b> <span style={{ color: 'var(--ink-soft)' }}>{a.action}</span> {a.fairName}
              </div>
              <div style={{ font: '500 10px/1.2 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 2 }}>
                {a.userRole}{a.origin ? ' · ' + a.origin : ''} · {_fdWhen(a.at)}
              </div>
            </div>
          </div>
        )}
      </div>
    </U.Card>);

}

window.FairDetect = {
  load: _fdLoad,
  save: _fdSave,
  empty: _fdEmpty,
  fairKey: _fairKey,
  mergeApproved: _mergeApproved,
  shortName: _shortName,
  Panel: FairsPanel };