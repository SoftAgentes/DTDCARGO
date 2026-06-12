/* global React */
/* ── DTD · Operario · Centro de Avisos · v2.0 ───────────────── */
/* Bandeja de notificaciones del operario móvil. Bilingüe ES/中文. */
/* Eventos: cierre de contenedor (50 CBM) · OD del admin · incidencia */
/* · QR listo · mensaje del admin · sincronización. Read-state en      */
/* localStorage (dtd-op-avisos-read). Diseñado para clonar a VE/Bodega.*/
/* Expone window.OperarioAvisos = { Sheet, Bell, useUnread, seed }.    */

(function () {
  const { useState, useEffect, useCallback } = React;
  const I = window.Icon;
  const READ_KEY = 'dtd-op-avisos-read';

  // ── Tipos de aviso · color + ícono del sistema (sin emoji) ──
  const KIND = {
    cierre:     { tone: 'var(--warning)', bg: 'var(--warning-bg)', icon: 'ship',    group: 'op',  es: 'Cierre de contenedor', cn: '集装箱关闭' },
    od:         { tone: 'var(--info)',    bg: 'var(--info-bg)',    icon: 'truck',   group: 'op',  es: 'Orden de despacho',    cn: '发货单' },
    incidencia: { tone: 'var(--danger)',  bg: 'var(--danger-bg)',  icon: 'warn',    group: 'op',  es: 'Incidencia',           cn: '事故' },
    qr:         { tone: 'var(--wine)',    bg: 'var(--wine-tint)',  icon: 'tag',     group: 'op',  es: 'Impresión QR',         cn: 'QR打印' },
    mensaje:    { tone: 'var(--ink)',     bg: 'var(--bg-elevated)',icon: 'chat',    group: 'sys', es: 'Mensaje',              cn: '消息' },
    sync:       { tone: 'var(--success)', bg: 'var(--success-bg)', icon: 'check',   group: 'sys', es: 'Sincronización',       cn: '同步' },
  };

  // ── Seed realista DTD-Cargo (YIW-A1) ────────────────────────
  const seed = (t) => ([
    { id: 'av-09', kind: 'cierre', day: 'hoy', time: '09:38', tref: '08:38',
      title: t('Contenedor YIW-2026-08 al 92% · cierra pronto', '集装箱 YIW-2026-08 已达92% · 请尽快关闭'),
      body: t('46.2 / 50 CBM consolidados. Faltan ~3.8 CBM para el cierre y zarpe.', '已合并 46.2 / 50 CBM。距关闭发运还差约 3.8 CBM。'),
      code: 'YIW-2026-08', cta: t('Ir a modo despacho', '前往发货模式'), act: 'dispatch' },
    { id: 'av-08', kind: 'incidencia', day: 'hoy', time: '09:12', tref: '09:12',
      title: t('Caja dañada reportada · DTD-5452', '箱子损坏报告 · DTD-5452'),
      body: t('Acindar · 1 de 12 cajas con golpe lateral. Foto adjunta · esperando validación de oficina.', 'Acindar · 12箱中1箱侧面受损。已附照片 · 等待办公室核验。'),
      code: 'DTD-5452' },
    { id: 'av-07', kind: 'od', day: 'hoy', time: '08:50', tref: '08:50',
      title: t('OD-472816 recibida desde admin', '已从管理员接收 OD-472816'),
      body: t('Valencia · ZI Acindar · 4 paradas · ~18 CBM. Asigna camión cuando esté lista la bodega.', 'Valencia · ZI Acindar · 4站 · 约18 CBM。仓库就绪后分配卡车。'),
      code: 'DTDU-472816' },
    { id: 'av-06', kind: 'qr', day: 'hoy', time: '08:21', tref: '08:21',
      title: t('Etiquetas QR listas · Imp. Pereira', 'QR标签就绪 · Imp. Pereira'),
      body: t('8 etiquetas DTD-5418 enviadas a la cola de impresión de oficina.', '8张 DTD-5418 标签已发送至办公室打印队列。'),
      code: 'DTD-5418', cta: t('Ver impresión QR', '查看QR打印'), act: 'print' },
    { id: 'av-05', kind: 'mensaje', day: 'hoy', time: '07:55', tref: '07:55',
      title: t('Mensaje de Coordinación · Liang', '协调部消息 · Liang'),
      body: t('“Para el contenedor 08 priorizá BriceñoTex, el cliente pidió adelanto.”', '"08号柜请优先 BriceñoTex，客户要求提前。"'),
      from: 'Liang Wei · 梁伟' },
    { id: 'av-04', kind: 'sync', day: 'hoy', time: '07:40', tref: '07:40',
      title: t('3 recepciones sincronizadas al ERP', '3条接收已同步至ERP'),
      body: t('CN-2026-2842 · 2841 · 2840 confirmadas. Visibles para el cliente en el portal.', 'CN-2026-2842 · 2841 · 2840 已确认。客户可在门户查看。') },
    { id: 'av-03', kind: 'od', day: 'ayer', time: '18:10', tref: '昨天 18:10',
      title: t('OD-419032 cerrada y en ruta', 'OD-419032 已关闭并在途'),
      body: t('Industrias Polar · Caracas · 80 cajas · 28.4 CBM despachadas.', 'Industrias Polar · Caracas · 80箱 · 28.4 CBM 已发货。'),
      code: 'DTDU-419032' },
    { id: 'av-02', kind: 'qr', day: 'ayer', time: '16:32', tref: '昨天 16:32',
      title: t('Etiquetas QR impresas · Dist. Andina', 'QR标签已打印 · Dist. Andina'),
      body: t('14 etiquetas DTD-5340 retiradas de la cola.', '14张 DTD-5340 标签已从队列取出。'),
      code: 'DTD-5340' },
    { id: 'av-01', kind: 'sync', day: 'ayer', time: '15:05', tref: '昨天 15:05',
      title: t('Cierre de jornada sincronizado', '工作日结算已同步'),
      body: t('18 cajas · 12.4 CBM del día reportados a almacén central.', '当日 18箱 · 12.4 CBM 已报至中央仓库。') },
  ]);

  // ── Read-state helpers (localStorage) ───────────────────────
  function loadRead() {
    try { return JSON.parse(localStorage.getItem(READ_KEY) || '[]'); } catch (e) { return []; }
  }
  function saveRead(ids) {
    try { localStorage.setItem(READ_KEY, JSON.stringify(ids)); } catch (e) {}
    window.dispatchEvent(new Event('dtd-avisos-changed'));
  }

  function useUnread(items) {
    const [read, setRead] = useState(loadRead);
    useEffect(() => {
      const h = () => setRead(loadRead());
      window.addEventListener('dtd-avisos-changed', h);
      window.addEventListener('storage', h);
      return () => { window.removeEventListener('dtd-avisos-changed', h); window.removeEventListener('storage', h); };
    }, []);
    const unread = items.filter(a => !read.includes(a.id)).length;
    return { read, unread, setRead };
  }

  // ── Campana del header · badge de no-leídos ─────────────────
  function Bell({ items, onOpen }) {
    const { unread } = useUnread(items);
    return (
      <button onClick={onOpen} aria-label="Avisos" style={{
        position: 'relative', width: 44, height: 44, borderRadius: 'var(--r-md)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--ink-soft)', background: 'transparent', border: 0, cursor: 'pointer',
      }}>
        {I.bell(20)}
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: 7, right: 7, minWidth: 17, height: 17, padding: '0 4px',
            borderRadius: 999, background: 'var(--wine)', color: '#fff',
            font: '800 10px/17px var(--f-mono)', textAlign: 'center',
            border: '2px solid var(--bg-surface)', boxSizing: 'content-box',
          }}>{unread > 9 ? '9+' : unread}</span>
        )}
      </button>
    );
  }

  // ── Item de aviso ───────────────────────────────────────────
  function Row({ a, isRead, t, onTap }) {
    const k = KIND[a.kind];
    return (
      <button onClick={() => onTap(a)} style={{
        width: '100%', display: 'grid', gridTemplateColumns: '40px 1fr', gap: 12,
        padding: '14px 14px', textAlign: 'left', cursor: 'pointer',
        background: isRead ? 'transparent' : 'var(--bg-surface)',
        border: '1px solid', borderColor: isRead ? 'var(--border)' : k.tone + '55',
        borderRadius: 'var(--r-md)', position: 'relative',
      }}>
        <span style={{
          width: 40, height: 40, borderRadius: 'var(--r-md)', flexShrink: 0,
          background: k.bg, color: k.tone, display: 'grid', placeItems: 'center',
        }}>{I[k.icon](19)}</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
            <span style={{ font: '700 9px/1 var(--f-sans)', letterSpacing: '0.1em', textTransform: 'uppercase', color: k.tone }}>{t(k.es, k.cn)}</span>
            <span style={{ marginLeft: 'auto', font: '600 10px/1 var(--f-mono)', color: 'var(--ink-mute)' }}>{a.day === 'ayer' ? (a.tref) : a.time}</span>
            {!isRead && <span style={{ width: 8, height: 8, borderRadius: 999, background: k.tone, flexShrink: 0 }} />}
          </div>
          <div style={{ font: `${isRead ? 600 : 800} 13.5px/1.3 var(--f-sans)`, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{a.title}</div>
          <div style={{ font: '500 11.5px/1.45 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 4 }}>{a.body}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: a.code || a.from || a.cta ? 8 : 0, flexWrap: 'wrap' }}>
            {a.code && <code style={{ font: '700 10.5px/1 var(--f-mono)', color: k.tone, background: k.bg, padding: '4px 7px', borderRadius: 'var(--r-sm)' }}>{a.code}</code>}
            {a.from && <span style={{ font: '600 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)' }}>{a.from}</span>}
            {a.cta && <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4, font: '800 11.5px/1 var(--f-sans)', color: k.tone }}>{a.cta} {I.chevR(13)}</span>}
          </div>
        </div>
      </button>
    );
  }

  // ── Panel · bottom-sheet de avisos ──────────────────────────
  function Sheet({ open, onClose, t, lang, items, onAction }) {
    const [filter, setFilter] = useState('todos'); // todos · unread · op · sys
    const { read, unread, setRead } = useUnread(items);

    const markRead = useCallback((id) => {
      const next = Array.from(new Set([...loadRead(), id]));
      saveRead(next); setRead(next);
    }, [setRead]);
    const markAll = useCallback(() => {
      const next = Array.from(new Set([...loadRead(), ...items.map(a => a.id)]));
      saveRead(next); setRead(next);
    }, [items, setRead]);

    if (!open) return null;

    const pass = (a) => filter === 'todos' ? true
      : filter === 'unread' ? !read.includes(a.id)
      : KIND[a.kind].group === filter;
    const shown = items.filter(pass);
    const groups = [['hoy', t('Hoy', '今天')], ['ayer', t('Ayer', '昨天')]];

    const onTap = (a) => {
      markRead(a.id);
      if (a.act && onAction) { onClose(); onAction(a.act); }
    };

    const FILTERS = [
      ['todos', t('Todos', '全部')],
      ['unread', t('Sin leer', '未读') + (unread ? ` · ${unread}` : '')],
      ['op', t('Operación', '操作')],
      ['sys', t('Sistema', '系统')],
    ];

    return (
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,30,61,0.45)', zIndex: 70, display: 'flex', alignItems: 'flex-end', animation: 'erp-fade 0.16s ease' }}>
        <div onClick={(e) => e.stopPropagation()} style={{
          width: '100%', maxWidth: 480, margin: '0 auto', background: 'var(--bg-base)',
          borderRadius: '20px 20px 0 0', maxHeight: '90vh', display: 'flex', flexDirection: 'column',
          animation: 'erp-pop 0.2s ease',
        }}>
          {/* Handle + header */}
          <div style={{ padding: '12px 18px 0' }}>
            <div style={{ width: 40, height: 4, background: 'var(--border-strong)', borderRadius: 999, margin: '0 auto 14px' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <span style={{ width: 36, height: 36, borderRadius: 'var(--r-md)', background: 'var(--wine-tint)', color: 'var(--wine)', display: 'grid', placeItems: 'center' }}>{I.bell(18)}</span>
              <div style={{ flex: 1 }}>
                <div style={{ font: '900 17px/1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.01em' }}>{t('Avisos', '通知')}</div>
                <div style={{ font: '500 11px/1.2 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 3 }}>
                  {unread > 0 ? t(`${unread} sin leer`, `${unread} 条未读`) : t('Todo al día', '全部已读')}
                </div>
              </div>
              {unread > 0 && (
                <button onClick={markAll} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '8px 11px', borderRadius: 'var(--r-md)', background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--ink)', font: '700 11.5px/1 var(--f-sans)', cursor: 'pointer' }}>
                  {I.check(13)} {t('Marcar leído', '标记已读')}
                </button>
              )}
              <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: 'var(--r-md)', color: 'var(--ink-soft)', background: 'transparent', border: 0, cursor: 'pointer', display: 'grid', placeItems: 'center' }}>{I.close(16)}</button>
            </div>
            {/* Filtros */}
            <div style={{ display: 'flex', gap: 7, overflowX: 'auto', paddingBottom: 12, margin: '0 -18px', padding: '0 18px 12px' }}>
              {FILTERS.map(([k, l]) => (
                <button key={k} onClick={() => setFilter(k)} style={{
                  flexShrink: 0, padding: '8px 13px', borderRadius: 'var(--r-pill)',
                  background: filter === k ? 'var(--wine)' : 'var(--bg-elevated)',
                  color: filter === k ? '#fff' : 'var(--ink-soft)',
                  border: filter === k ? 0 : '1px solid var(--border)',
                  font: '700 12px/1 var(--f-sans)', cursor: 'pointer', whiteSpace: 'nowrap',
                }}>{l}</button>
              ))}
            </div>
          </div>

          {/* Lista */}
          <div style={{ overflowY: 'auto', padding: '4px 18px 0', WebkitOverflowScrolling: 'touch' }}>
            {shown.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 24px 56px' }}>
                <div style={{ width: 56, height: 56, margin: '0 auto 14px', borderRadius: '50%', background: 'var(--bg-elevated)', color: 'var(--ink-mute)', display: 'grid', placeItems: 'center' }}>{I.check(24)}</div>
                <div style={{ font: '800 15px/1.2 var(--f-display)', color: 'var(--ink)' }}>{t('Nada por acá', '这里没有内容')}</div>
                <div style={{ font: '500 12.5px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 6, maxWidth: '28ch', margin: '6px auto 0' }}>{t('No hay avisos con este filtro.', '此筛选下没有通知。')}</div>
              </div>
            ) : groups.map(([g, label]) => {
              const rows = shown.filter(a => a.day === g);
              if (!rows.length) return null;
              return (
                <div key={g} style={{ marginBottom: 16 }}>
                  <div style={{ font: '700 10px/1 var(--f-sans)', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-mute)', margin: '8px 2px 10px' }}>{label}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {rows.map(a => <Row key={a.id} a={a} isRead={read.includes(a.id)} t={t} onTap={onTap} />)}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ height: 'env(safe-area-inset-bottom)', minHeight: 12, flexShrink: 0 }} />
        </div>
      </div>
    );
  }

  window.OperarioAvisos = { KIND, seed, loadRead, saveRead, useUnread, Bell, Sheet };
})();

/* ── Seeds por rol (Spanish-only para VE/Bodega/Camión) ──────── */
(function () {
  const A = window.OperarioAvisos;
  // Chofer VE · entregas, POD, ruta
  A.seedVE = () => ([
    { id: 've-05', kind: 'od', day: 'hoy', time: '09:30',
      title: 'Ruta R-2026-0142 asignada · Acindar', body: 'PBL → Valencia · ZI Acindar · 168 km · ETA 14:30 · 12 cajas · 6.4 CBM.', code: 'DTDU-472816', cta: 'Iniciar ruta', act: 'route' },
    { id: 've-04', kind: 'incidencia', day: 'hoy', time: '09:05',
      title: 'GPS apagado en la última parada', body: 'Reactivá la ubicación para que el cliente y la oficina vean tu posición en vivo.' },
    { id: 've-03', kind: 'mensaje', day: 'hoy', time: '08:40',
      title: 'Mensaje de Despacho · Yusneidy', body: '"Pasá primero por Vargas & Asoc, el cliente sale a las 13h."', from: 'Yusneidy Pérez' },
    { id: 've-02', kind: 'sync', day: 'hoy', time: '08:10',
      title: 'POD sincronizado · Imp. Pereira', body: 'Entrega de Caracas confirmada. El cliente recibió el email con la firma.', code: 'DTDU-388157' },
    { id: 've-01', kind: 'qr', day: 'ayer', time: '17:25',
      title: 'Documentos de ruta listos', body: 'Guías y packing list de las 2 rutas de hoy descargados al dispositivo.' },
  ]);
  // Bodeguero VE · contenedores por recibir, camiones por armar
  A.seedBodega = () => ([
    { id: 'bo-05', kind: 'cierre', day: 'hoy', time: '08:55',
      title: '2 contenedores por recibir hoy', body: 'YIW-2026-06 y CAN-2026-03 arriban a Puerto Cabello. Preparáte para descarga.', code: 'YIW-2026-06' },
    { id: 'bo-04', kind: 'od', day: 'hoy', time: '08:30',
      title: '3 camiones por armar', body: 'Acindar, Industrias Polar y Vargas & Asoc esperan despacho. Ocupación sugerida 90%+.' },
    { id: 'bo-03', kind: 'incidencia', day: 'hoy', time: '08:02',
      title: 'Carga parcial pendiente de motivo', body: 'DTD-5392 quedó en parcial sin razón registrada. Completa antes de despachar.', code: 'DTD-5392' },
    { id: 'bo-02', kind: 'mensaje', day: 'hoy', time: '07:35',
      title: 'Mensaje de Operaciones', body: '"Priorizá Industrias Polar, el cliente reclama demora de 12 días."', from: 'Coordinación VE' },
    { id: 'bo-01', kind: 'sync', day: 'ayer', time: '18:20',
      title: 'Cierre de jornada · 142 cajas', body: '68.4 CBM movidos · 0 incidencias reportadas al almacén central.' },
  ]);
  // Camionero · gemelo del chofer VE, foco en ruta activa
  A.seedCamion = () => ([
    { id: 'ca-05', kind: 'od', day: 'hoy', time: '09:30',
      title: 'Ruta del día · 4 entregas', body: 'Valencia · ZI Acindar como destino principal. Salida estimada 07:30.', code: 'DTDU-472816' },
    { id: 'ca-04', kind: 'incidencia', day: 'hoy', time: '09:05',
      title: 'GPS apagado', body: 'Reactivá la ubicación: sin GPS la oficina no puede confirmar tus entregas.' },
    { id: 'ca-03', kind: 'mensaje', day: 'hoy', time: '08:40',
      title: 'WhatsApp del almacenista', body: '"Camión cargado y listo. Te paso ubicación de la primera parada."', from: 'Yusneidy Pérez' },
    { id: 'ca-02', kind: 'sync', day: 'hoy', time: '08:10',
      title: 'POD de ayer sincronizado', body: 'Última entrega confirmada al ERP. Cliente notificado por email.', code: 'DTDU-388157' },
    { id: 'ca-01', kind: 'qr', day: 'ayer', time: '17:25',
      title: 'Documentos cargados', body: 'Guías de las entregas de hoy disponibles offline en el dispositivo.' },
  ]);
})();
