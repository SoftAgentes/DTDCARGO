/* global React */
/* ── Academia DTD · Portal del alumno · APP ───────────────────────
   7 pantallas mobile-first: Gate (no-miembro), Inicio, Detalle de
   curso, Reproductor, Mis diplomas, Cursos/Cohortes, Club (sketch).
   Reusa tokens + window.Icon + window.ERPUI.Progress. window.PortalAcademia. */
(function () {
  'use strict';
  const { useState } = React;
  const A = () => window.AcademiaData;
  const I = () => window.Icon;
  const U = () => window.ERPUI;
  let INSETS = { top: 0, bottom: 0 };

  // WhatsApp asesor (con etiqueta de origen para CRM)
  const WA = '584124545325';
  function waLink(origen, msg) {
    return 'https://wa.me/' + WA + '?text=' + encodeURIComponent((msg || 'Hola DTD-Cargo, quiero info de la Academia.') + '\n\n(Vía: portal-academia · ' + origen + ')');
  }

  // ── primitives ─────────────────────────────────────────────────
  function Eyebrow({ children, tone }) {
    return <div style={{ font: '700 10px/1 var(--f-sans)', letterSpacing: '0.16em', textTransform: 'uppercase', color: tone || 'var(--wine)' }}>{children}</div>;
  }
  function LevelChip({ level, free }) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 'var(--r-pill)', background: free ? 'var(--success-bg)' : 'var(--bg-elevated)', color: free ? 'var(--success)' : 'var(--ink-soft)', font: '700 9.5px/1 var(--f-sans)', letterSpacing: '0.06em', textTransform: 'uppercase', flexShrink: 0 }}>
        {free ? 'Gratis' : 'Nivel ' + level}
      </span>);
  }
  function ProgressBar({ pct, tone }) {
    return (
      <div style={{ height: 6, borderRadius: 'var(--r-pill)', background: 'var(--bg-elevated)', overflow: 'hidden' }}>
        <div style={{ width: pct + '%', height: '100%', borderRadius: 'var(--r-pill)', background: tone || 'var(--wine)', transition: 'width var(--dur) var(--ease)' }} />
      </div>);
  }
  // Faux QR (verificación) — patrón monocromo simple, no es un QR real
  function FauxQR({ size }) {
    const s = size || 34, n = 7;
    const seed = [1,0,1,1,0,1,1, 0,1,1,0,1,0,1, 1,1,0,1,1,0,0, 1,0,1,0,0,1,1, 0,1,1,0,1,1,0, 1,0,0,1,0,1,1, 1,1,0,1,1,0,1];
    return (
      <svg width={s} height={s} viewBox="0 0 7 7" shapeRendering="crispEdges" aria-hidden="true">
        <rect width="7" height="7" fill="#fff" />
        {seed.map((v, i) => v ? <rect key={i} x={i % n} y={Math.floor(i / n)} width="1" height="1" fill="var(--ink)" /> : null)}
      </svg>);
  }

  // Mini representación visual de cada variante de diploma (A/B/C/D)
  function DiplomaMini({ variant }) {
    const base = { position: 'relative', width: '100%', aspectRatio: '1.41/1', background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', overflow: 'hidden', boxShadow: 'var(--shadow-xs)' };
    const line = (w, c, h) => <div style={{ height: h || 4, width: w, borderRadius: 2, background: c || 'var(--border-strong)' }} />;
    if (variant === 'C') {
      return (
        <div style={base}>
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '26%', background: 'var(--ink)' }} />
          <div style={{ position: 'absolute', left: '34%', right: '12%', top: 0, bottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6 }}>
            {line('70%', 'var(--ink)', 7)}{line('100%')}{line('85%')}{line('40%', 'var(--wine)', 5)}
          </div>
        </div>);
    }
    if (variant === 'B') {
      return (
        <div style={base}>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid var(--wine)' }} />
            {line('60%', 'var(--ink)', 7)}{line('80%')}{line('50%', 'var(--wine)', 5)}
          </div>
        </div>);
    }
    if (variant === 'D') {
      return (
        <div style={base}>
          <div style={{ position: 'absolute', inset: 6, border: '1.5px solid var(--wine-soft)', borderRadius: 2 }} />
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            {line('50%', 'var(--ink)', 7)}{line('72%')}{line('72%')}
          </div>
        </div>);
    }
    // A · minimal asimétrico
    return (
      <div style={base}>
        <div style={{ position: 'absolute', left: '12%', right: '40%', top: 0, bottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6 }}>
          {line('100%', 'var(--wine)', 5)}{line('80%', 'var(--ink)', 7)}{line('100%')}{line('60%')}
        </div>
        <div style={{ position: 'absolute', right: '10%', bottom: '16%', width: 14, height: 14, borderRadius: '50%', background: 'var(--wine-tint)', border: '1px solid var(--wine)' }} />
      </div>);
  }

  // Botón puente al servicio DTD (sutil, navy)
  function ServiceBridge({ go, origen }) {
    return (
      <div style={{ background: 'linear-gradient(135deg, var(--ink), #1F3055)', color: '#fff', borderRadius: 'var(--r-lg)', padding: 'var(--s-5)', position: 'relative', overflow: 'hidden' }}>
        <Eyebrow tone="var(--wine-soft)">Cuando estés listo</Eyebrow>
        <div style={{ font: '800 17px/1.25 var(--f-display)', marginTop: 8, maxWidth: '20ch' }}>¿Listo para importar de verdad? DTD te trae la carga.</div>
        <div style={{ font: '500 12.5px/1.5 var(--f-sans)', color: 'rgba(255,255,255,0.72)', marginTop: 6, maxWidth: '30ch' }}>Lo que aprendes acá, nosotros lo ejecutamos: puerta a puerta, China → Venezuela.</div>
        <button onClick={() => go({ tab: 'home', service: true })} style={{ marginTop: 14, display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--wine)', color: '#fff', border: 0, borderRadius: 'var(--r-md)', padding: '11px 16px', font: '800 13px/1 var(--f-sans)', cursor: 'pointer' }}>
          Cotizar mi importación {I().arrowR(13)}
        </button>
      </div>);
  }

  // ════════════════════════════════════════════════════════════════
  // 1 · GATE (no-miembro)
  // ════════════════════════════════════════════════════════════════
  function GateScreen() {
    const d = A();
    return (
      <div style={{ paddingBottom: 24 }}>
        <div style={{ background: 'linear-gradient(135deg, var(--ink), #1F3055)', color: '#fff', padding: '28px 20px 26px', borderBottomLeftRadius: 'var(--r-xl)', borderBottomRightRadius: 'var(--r-xl)' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 10px', borderRadius: 'var(--r-pill)', background: 'rgba(255,255,255,0.1)', font: '800 10px/1 var(--f-display)', letterSpacing: '0.12em' }}>
            <span style={{ width: 18, height: 18, borderRadius: 4, background: 'var(--wine)', display: 'grid', placeItems: 'center', font: '900 8px/1 var(--f-display)' }}>DTD</span>
            ACADEMIA DTD
          </div>
          <div style={{ font: '900 26px/1.1 var(--f-display)', letterSpacing: '-0.02em', marginTop: 18, textWrap: 'balance' }}>Aún no eres miembro de la Academia DTD</div>
          <div style={{ font: '500 14px/1.55 var(--f-sans)', color: 'rgba(255,255,255,0.78)', marginTop: 10, maxWidth: '34ch' }}>Aprende a importar de China con la operación real de DTD detrás. De tu primer pedido a tu primer contenedor.</div>
          <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
            <button style={{ flex: 1, minWidth: 130, background: 'var(--wine)', color: '#fff', border: 0, borderRadius: 'var(--r-md)', padding: '13px', font: '800 14px/1 var(--f-sans)', cursor: 'pointer' }}>Inscribirme</button>
            <a href={waLink('gate', 'Hola DTD-Cargo, quiero info de la Academia para empezar a importar.')} target="_blank" rel="noopener" style={{ flex: 1, minWidth: 130, textAlign: 'center', background: 'rgba(255,255,255,0.12)', color: '#fff', borderRadius: 'var(--r-md)', padding: '13px', font: '700 14px/1 var(--f-sans)', textDecoration: 'none' }}>Hablar con asesor</a>
          </div>
        </div>

        <div style={{ padding: '22px 20px 0' }}>
          <Eyebrow>Lo que vas a lograr</Eyebrow>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
            {[
              { ic: 'box', t: 'Comprar sin intermediarios', s: 'Proveedores, MOQ, muestras y precio real.' },
              { ic: 'truck', t: 'Traer puerta a puerta', s: 'CBM, consolidación, aduana VE sin sustos.' },
              { ic: 'shield', t: 'Hacerlo con respaldo', s: 'La operación real de DTD detrás de cada paso.' }
            ].map((x, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '14px 16px' }}>
                <span style={{ width: 36, height: 36, borderRadius: 'var(--r-md)', background: 'var(--wine-tint)', color: 'var(--wine)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>{I()[x.ic](18)}</span>
                <div><div style={{ font: '800 13.5px/1.2 var(--f-display)', color: 'var(--ink)' }}>{x.t}</div><div style={{ font: '500 12px/1.45 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 3 }}>{x.s}</div></div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 22 }}><Eyebrow>Próximos cursos</Eyebrow></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
            {d.COURSES.map((c) => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '13px 15px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}><LevelChip level={c.level} free={c.free} /></div>
                  <div style={{ font: '800 14px/1.25 var(--f-display)', color: 'var(--ink)' }}>{c.title}</div>
                  <div style={{ font: '500 11.5px/1.3 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 3 }}>{c.hours} h · {c.modules.reduce((a, m) => a + m.lessons.length, 0)} lecciones</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>);
  }

  // ════════════════════════════════════════════════════════════════
  // 2 · INICIO (miembro)
  // ════════════════════════════════════════════════════════════════
  function HomeScreen({ go }) {
    const d = A();
    const prog = d.inProgress();
    const rec = d.recommended();
    const recP = d.courseProgress(rec);
    return (
      <div style={{ padding: '8px 20px 24px' }}>
        <Eyebrow>Tu Academia</Eyebrow>
        <div style={{ font: '900 26px/1.1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em', margin: '6px 0 2px' }}>Hola {d.member.name.split(' ')[0]}.</div>
        <div style={{ font: '500 13px/1.5 var(--f-sans)', color: 'var(--ink-soft)' }}>{prog.length ? 'Sigue donde quedaste.' : 'Empieza tu primer curso.'}</div>

        {prog.length > 0 && (
          <div style={{ marginTop: 22 }}>
            <Eyebrow>Mis cursos en progreso</Eyebrow>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
              {prog.map(({ c, p }) => (
                <button key={c.id} onClick={() => go({ stack: { type: 'course', id: c.id } })} style={{ textAlign: 'left', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '15px 16px', cursor: 'pointer', boxShadow: 'var(--shadow-xs)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <LevelChip level={c.level} free={c.free} />
                    <span style={{ font: '800 12px/1 var(--f-mono)', color: 'var(--wine)' }}>{p.pct}%</span>
                  </div>
                  <div style={{ font: '800 15px/1.25 var(--f-display)', color: 'var(--ink)', margin: '10px 0 4px' }}>{c.title}</div>
                  <div style={{ font: '500 11.5px/1.3 var(--f-sans)', color: 'var(--ink-mute)', marginBottom: 12 }}>{p.done} de {p.total} lecciones</div>
                  <ProgressBar pct={p.pct} />
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 12, color: 'var(--wine)', font: '800 13px/1 var(--f-sans)' }}>Continuar {I().arrowR(13)}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ marginTop: 24 }}>
          <Eyebrow>Siguiente recomendado</Eyebrow>
          <button onClick={() => go({ stack: { type: 'course', id: rec.id } })} style={{ width: '100%', textAlign: 'left', marginTop: 12, background: 'var(--wine-tint)', border: '1px solid var(--wine)', borderRadius: 'var(--r-lg)', padding: '16px', cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><LevelChip level={rec.level} free={rec.free} />{rec.flagship && <span style={{ font: '700 9.5px/1 var(--f-sans)', color: 'var(--wine)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>· Insignia</span>}</div>
            <div style={{ font: '800 16px/1.25 var(--f-display)', color: 'var(--ink)', margin: '10px 0 4px' }}>{rec.title}</div>
            <div style={{ font: '500 12.5px/1.5 var(--f-sans)', color: 'var(--ink-soft)' }}>{rec.tagline}</div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 12, color: 'var(--wine)', font: '800 13px/1 var(--f-sans)' }}>{d.isEnrolled(rec.id) ? (recP.pct > 0 ? 'Continuar' : 'Empezar') : 'Ver curso'} {I().arrowR(13)}</div>
          </button>
        </div>

        <div style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Eyebrow>Mis diplomas</Eyebrow>
            <button onClick={() => go({ tab: 'diplomas' })} style={{ background: 'none', border: 0, font: '700 12px/1 var(--f-sans)', color: 'var(--wine)', cursor: 'pointer' }}>Ver todos</button>
          </div>
          {d.diplomas.length ? (
            <div style={{ display: 'flex', gap: 12, marginTop: 12, overflowX: 'auto', paddingBottom: 4 }}>
              {d.diplomas.map((dp) => (
                <button key={dp.folio} onClick={() => go({ tab: 'diplomas' })} style={{ flex: '0 0 140px', textAlign: 'left', background: 'transparent', border: 0, padding: 0, cursor: 'pointer' }}>
                  <DiplomaMini variant={dp.variant} />
                  <div style={{ font: '700 11.5px/1.2 var(--f-sans)', color: 'var(--ink)', marginTop: 7 }}>{d.course(dp.courseId).title}</div>
                  <code style={{ font: '600 9.5px/1 var(--f-mono)', color: 'var(--ink-mute)' }}>{dp.folio}</code>
                </button>
              ))}
            </div>
          ) : (
            <div style={{ marginTop: 12, padding: '16px', border: '1px dashed var(--border-strong)', borderRadius: 'var(--r-lg)', font: '500 12.5px/1.5 var(--f-sans)', color: 'var(--ink-mute)', textAlign: 'center' }}>Completa un curso para ganar tu primer diploma.</div>
          )}
        </div>

        <div style={{ marginTop: 24 }}><ServiceBridge go={go} origen="home" /></div>
      </div>);
  }

  // ════════════════════════════════════════════════════════════════
  // 3 · DETALLE DE CURSO
  // ════════════════════════════════════════════════════════════════
  function CourseScreen({ courseId, go, onBack }) {
    const d = A();
    const c = d.course(courseId);
    const p = d.courseProgress(c);
    const enrolled = d.isEnrolled(c.id);
    const nl = d.nextLesson(c);
    const [open, setOpen] = useState(c.modules.map((m) => m.id)); // todos abiertos
    const toggleMod = (id) => setOpen((o) => o.includes(id) ? o.filter((x) => x !== id) : [...o, id]);

    return (
      <div style={{ paddingBottom: enrolled ? 88 : 24 }}>
        <div style={{ background: 'linear-gradient(135deg, var(--ink), #1F3055)', color: '#fff', padding: '14px 20px 22px' }}>
          <button onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 0, color: 'rgba(255,255,255,0.8)', font: '600 13px/1 var(--f-sans)', cursor: 'pointer', padding: '6px 0', marginBottom: 8 }}>{I().arrowL(15)} Volver</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><LevelChip level={c.level} free={c.free} />{c.flagship && <span style={{ font: '700 9.5px/1 var(--f-sans)', color: 'var(--wine-soft)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>· Programa insignia</span>}</div>
          <div style={{ font: '900 23px/1.15 var(--f-display)', letterSpacing: '-0.02em', margin: '12px 0 6px', textWrap: 'balance' }}>{c.title}</div>
          <div style={{ font: '500 13px/1.5 var(--f-sans)', color: 'rgba(255,255,255,0.75)' }}>{c.tagline}</div>
          <div style={{ display: 'flex', gap: 16, marginTop: 16, font: '600 11.5px/1 var(--f-sans)', color: 'rgba(255,255,255,0.6)' }}>
            <span>{c.hours} horas</span><span>{d.lessonCount(c)} lecciones</span><span>{c.modules.length} módulos</span>
          </div>
          {enrolled && (
            <div style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', font: '600 11px/1 var(--f-sans)', color: 'rgba(255,255,255,0.7)', marginBottom: 7 }}><span>Tu progreso</span><span style={{ fontFamily: 'var(--f-mono)' }}>{p.pct}%</span></div>
              <div style={{ height: 6, borderRadius: 'var(--r-pill)', background: 'rgba(255,255,255,0.15)', overflow: 'hidden' }}><div style={{ width: p.pct + '%', height: '100%', background: 'var(--wine-soft)', borderRadius: 'var(--r-pill)' }} /></div>
            </div>
          )}
        </div>

        <div style={{ padding: '20px' }}>
          {!enrolled && (
            <button style={{ width: '100%', background: 'var(--wine)', color: '#fff', border: 0, borderRadius: 'var(--r-md)', padding: '14px', font: '800 14px/1 var(--f-sans)', cursor: 'pointer', marginBottom: 20 }}>Inscribirme {c.free ? '· gratis' : ''}</button>
          )}
          <Eyebrow>Contenido</Eyebrow>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
            {c.modules.map((m, mi) => {
              const isOpen = open.includes(m.id);
              return (
                <div key={m.id} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
                  <button onClick={() => toggleMod(m.id)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '13px 15px', background: 'none', border: 0, cursor: 'pointer', textAlign: 'left' }}>
                    <span style={{ width: 24, height: 24, borderRadius: 'var(--r-sm)', background: 'var(--bg-elevated)', color: 'var(--ink-soft)', display: 'grid', placeItems: 'center', font: '800 11px/1 var(--f-display)', flexShrink: 0 }}>{mi + 1}</span>
                    <span style={{ flex: 1, font: '800 13px/1.3 var(--f-display)', color: 'var(--ink)' }}>{m.title}</span>
                    <span style={{ color: 'var(--ink-mute)', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform var(--dur) var(--ease)', display: 'inline-flex' }}>{I().chevD(14)}</span>
                  </button>
                  {isOpen && (
                    <div style={{ borderTop: '1px solid var(--border)' }}>
                      {m.lessons.map((l) => {
                        const done = d.isDone(c.id, l.id);
                        const locked = !enrolled && !l.free;
                        return (
                          <button key={l.id} disabled={locked} onClick={() => !locked && go({ stack: { type: 'lesson', courseId: c.id, lessonId: l.id } })} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 11, padding: '12px 15px', background: 'none', border: 0, borderTop: '1px solid var(--border)', cursor: locked ? 'default' : 'pointer', textAlign: 'left', opacity: locked ? 0.55 : 1 }}>
                            <span style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center', background: done ? 'var(--success)' : 'transparent', border: done ? 0 : '1.5px solid var(--border-strong)', color: '#fff' }}>{done ? I().check(12) : locked ? <span style={{ color: 'var(--ink-mute)' }}>{I().shield(11)}</span> : <span style={{ color: 'var(--wine)' }}>{I().chevR ? I().chevR(11) : I().arrowR(10)}</span>}</span>
                            <span style={{ flex: 1, font: '600 12.5px/1.3 var(--f-sans)', color: 'var(--ink)' }}>{l.title}</span>
                            {l.free && !enrolled && <span style={{ font: '700 8.5px/1 var(--f-sans)', color: 'var(--success)', letterSpacing: '0.06em', textTransform: 'uppercase', background: 'var(--success-bg)', padding: '3px 6px', borderRadius: 'var(--r-pill)' }}>Preview</span>}
                            <span style={{ font: '600 10.5px/1 var(--f-mono)', color: 'var(--ink-mute)', flexShrink: 0 }}>{l.min}m</span>
                          </button>);
                      })}
                    </div>
                  )}
                </div>);
            })}
          </div>

          <div style={{ marginTop: 22 }}><Eyebrow>Recursos descargables</Eyebrow></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
            {c.resources.map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '11px 14px', opacity: enrolled ? 1 : 0.6 }}>
                <span style={{ color: 'var(--wine)' }}>{I().doc(15)}</span>
                <span style={{ flex: 1, font: '600 12.5px/1.3 var(--f-sans)', color: 'var(--ink)' }}>{r}</span>
                <span style={{ color: enrolled ? 'var(--wine)' : 'var(--ink-mute)' }}>{enrolled ? I().download(14) : I().shield(13)}</span>
              </div>
            ))}
          </div>
        </div>

        {enrolled && (
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: `12px 20px ${12 + INSETS.bottom}px`, background: 'color-mix(in srgb, var(--bg-base) 90%, transparent)', backdropFilter: 'blur(8px)', borderTop: '1px solid var(--border)' }}>
            <button onClick={() => go({ stack: { type: 'lesson', courseId: c.id, lessonId: nl.id } })} style={{ width: '100%', background: 'var(--wine)', color: '#fff', border: 0, borderRadius: 'var(--r-md)', padding: '14px', font: '800 14px/1 var(--f-sans)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {p.pct > 0 ? 'Continuar donde quedaste' : 'Empezar curso'} {I().arrowR(14)}
            </button>
          </div>
        )}
      </div>);
  }

  // ════════════════════════════════════════════════════════════════
  // 4 · REPRODUCTOR DE LECCIÓN
  // ════════════════════════════════════════════════════════════════
  function LessonScreen({ courseId, lessonId, go, onBack, onCelebrate }) {
    const d = A();
    const c = d.course(courseId);
    const lessons = d.allLessons(c);
    const idx = lessons.findIndex((l) => l.id === lessonId);
    const l = lessons[idx];
    const [, force] = useState(0);
    const done = d.isDone(c.id, l.id);
    const [showList, setShowList] = useState(false);
    const [notes, setNotes] = useState('');

    const complete = () => {
      const res = d.toggleLesson(c.id, l.id, true);
      force((n) => n + 1);
      if (res.justFinished) onCelebrate(res.course, d.diplomas[d.diplomas.length - 1]);
      else if (idx < lessons.length - 1) go({ stack: { type: 'lesson', courseId: c.id, lessonId: lessons[idx + 1].id } });
    };
    const goRel = (delta) => { const t = lessons[idx + delta]; if (t) go({ stack: { type: 'lesson', courseId: c.id, lessonId: t.id } }); };

    return (
      <div style={{ paddingBottom: 24 }}>
        {/* Video */}
        <div style={{ position: 'relative', background: 'var(--ink)', aspectRatio: '16/9', display: 'grid', placeItems: 'center' }}>
          <button onClick={onBack} style={{ position: 'absolute', top: 12, left: 14, zIndex: 2, width: 34, height: 34, borderRadius: '50%', background: 'rgba(0,0,0,0.4)', border: 0, color: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>{I().arrowL(16)}</button>
          <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'var(--wine)', display: 'grid', placeItems: 'center', boxShadow: '0 6px 20px rgba(0,0,0,0.4)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff"><path d="M7 5v14l12-7z" /></svg>
          </div>
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, background: 'rgba(255,255,255,0.2)' }}><div style={{ width: done ? '100%' : '12%', height: '100%', background: 'var(--wine-soft)' }} /></div>
        </div>

        <div style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <Eyebrow>{c.title}</Eyebrow>
            <button onClick={() => setShowList((s) => !s)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 0, font: '700 12px/1 var(--f-sans)', color: 'var(--wine)', cursor: 'pointer' }}>Lección {idx + 1}/{lessons.length} {I().chevD(12)}</button>
          </div>
          <div style={{ font: '900 20px/1.2 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.01em', margin: '8px 0 0', textWrap: 'balance' }}>{l.title}</div>
          <div style={{ font: '600 11.5px/1 var(--f-mono)', color: 'var(--ink-mute)', marginTop: 7 }}>{l.min} min</div>

          {showList && (
            <div style={{ marginTop: 14, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
              {lessons.map((ll, i) => {
                const dn = d.isDone(c.id, ll.id), cur = ll.id === l.id;
                return (
                  <button key={ll.id} onClick={() => { setShowList(false); go({ stack: { type: 'lesson', courseId: c.id, lessonId: ll.id } }); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', background: cur ? 'var(--wine-tint)' : 'none', border: 0, borderTop: i > 0 ? '1px solid var(--border)' : 0, cursor: 'pointer', textAlign: 'left' }}>
                    <span style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center', background: dn ? 'var(--success)' : 'transparent', border: dn ? 0 : '1.5px solid var(--border-strong)', color: '#fff', font: '700 9px/1 var(--f-mono)' }}>{dn ? I().check(11) : i + 1}</span>
                    <span style={{ flex: 1, font: cur ? '800 12px/1.3 var(--f-sans)' : '600 12px/1.3 var(--f-sans)', color: cur ? 'var(--wine)' : 'var(--ink)' }}>{ll.title}</span>
                    <span style={{ font: '600 10px/1 var(--f-mono)', color: 'var(--ink-mute)' }}>{ll.min}m</span>
                  </button>);
              })}
            </div>
          )}

          <button onClick={complete} style={{ width: '100%', marginTop: 18, background: done ? 'var(--success-bg)' : 'var(--wine)', color: done ? 'var(--success)' : '#fff', border: done ? '1px solid var(--success)' : 0, borderRadius: 'var(--r-md)', padding: '14px', font: '800 14px/1 var(--f-sans)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {done ? <>{I().check(15)} Completada</> : <>Marcar como completada</>}
          </button>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
            <button onClick={() => goRel(-1)} disabled={idx === 0} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '11px', font: '700 12.5px/1 var(--f-sans)', color: 'var(--ink)', cursor: idx === 0 ? 'default' : 'pointer', opacity: idx === 0 ? 0.45 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>{I().arrowL(13)} Anterior</button>
            <button onClick={() => goRel(1)} disabled={idx === lessons.length - 1} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '11px', font: '700 12.5px/1 var(--f-sans)', color: 'var(--ink)', cursor: idx === lessons.length - 1 ? 'default' : 'pointer', opacity: idx === lessons.length - 1 ? 0.45 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>Siguiente {I().arrowR(13)}</button>
          </div>

          <div style={{ marginTop: 22 }}><Eyebrow>Recursos de la lección</Eyebrow></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '11px 14px' }}>
            <span style={{ color: 'var(--wine)' }}>{I().doc(15)}</span><span style={{ flex: 1, font: '600 12.5px/1.3 var(--f-sans)', color: 'var(--ink)' }}>Material de apoyo · {l.title}</span><span style={{ color: 'var(--wine)' }}>{I().download(14)}</span>
          </div>

          <div style={{ marginTop: 22 }}><Eyebrow>Mis notas</Eyebrow></div>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Escribe lo que no quieres olvidar de esta lección…" style={{ width: '100%', marginTop: 10, minHeight: 84, resize: 'vertical', boxSizing: 'border-box', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '12px 14px', font: '500 13px/1.5 var(--f-sans)', color: 'var(--ink)', background: 'var(--bg-surface)', outline: 'none' }} onFocus={(e) => e.target.style.borderColor = 'var(--wine)'} onBlur={(e) => e.target.style.borderColor = 'var(--border)'} />
        </div>
      </div>);
  }

  // ════════════════════════════════════════════════════════════════
  // 5 · MIS DIPLOMAS
  // ════════════════════════════════════════════════════════════════
  function DiplomasScreen({ go }) {
    const d = A();
    return (
      <div style={{ padding: '8px 20px 24px' }}>
        <Eyebrow>Vitrina de logros</Eyebrow>
        <div style={{ font: '900 24px/1.1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em', margin: '6px 0 2px' }}>Mis diplomas</div>
        <div style={{ font: '500 13px/1.5 var(--f-sans)', color: 'var(--ink-soft)' }}>{d.diplomas.length} de {d.COURSES.length} cursos completados.</div>

        {d.diplomas.length === 0 ? (
          <div style={{ marginTop: 24, padding: '28px 20px', border: '1px dashed var(--border-strong)', borderRadius: 'var(--r-lg)', textAlign: 'center' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--bg-elevated)', color: 'var(--ink-mute)', display: 'grid', placeItems: 'center', margin: '0 auto 12px' }}>{I().shield(22)}</div>
            <div style={{ font: '800 14px/1.3 var(--f-display)', color: 'var(--ink)' }}>Aún no tienes diplomas</div>
            <div style={{ font: '500 12.5px/1.5 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 6 }}>Completa tu primer curso y aparecerá aquí, listo para descargar y verificar.</div>
            <button onClick={() => go({ tab: 'inicio' })} style={{ marginTop: 16, background: 'var(--wine)', color: '#fff', border: 0, borderRadius: 'var(--r-md)', padding: '11px 18px', font: '800 13px/1 var(--f-sans)', cursor: 'pointer' }}>Ir a mis cursos</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 18 }}>
            {d.diplomas.map((dp) => {
              const c = d.course(dp.courseId);
              return (
                <div key={dp.folio} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
                  <div style={{ padding: 16, background: 'var(--bg-elevated)' }}><DiplomaMini variant={dp.variant} /></div>
                  <div style={{ padding: '16px' }}>
                    <Eyebrow>Diploma · Academia DTD</Eyebrow>
                    <div style={{ font: '800 15px/1.25 var(--f-display)', color: 'var(--ink)', margin: '8px 0 8px' }}>{c.title}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <FauxQR size={40} />
                      <div style={{ flex: 1 }}>
                        <div style={{ font: '500 10.5px/1.3 var(--f-sans)', color: 'var(--ink-mute)' }}>Folio</div>
                        <code style={{ font: '700 12px/1.3 var(--f-mono)', color: 'var(--wine)' }}>{dp.folio}</code>
                        <div style={{ font: '500 10.5px/1.4 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 4 }}>Emitido {d.fmtDate(dp.dateISO)} · dtdcargo.com/verificar</div>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 14 }}>
                      <a href="diplomas/Diploma · DTD-Cargo.html" target="_blank" rel="noopener" style={{ textAlign: 'center', background: 'var(--wine)', color: '#fff', borderRadius: 'var(--r-md)', padding: '11px', font: '800 12.5px/1 var(--f-sans)', textDecoration: 'none' }}>Descargar PDF</a>
                      <a href="https://dtdcargo.com/verificar" target="_blank" rel="noopener" style={{ textAlign: 'center', background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--ink)', borderRadius: 'var(--r-md)', padding: '11px', font: '700 12.5px/1 var(--f-sans)', textDecoration: 'none' }}>Verificar</a>
                    </div>
                    <button style={{ width: '100%', marginTop: 8, background: 'none', border: 0, color: 'var(--ink-soft)', font: '700 12px/1 var(--f-sans)', padding: '8px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>{I().share ? I().share(13) : I().external(13)} Compartir</button>
                  </div>
                </div>);
            })}
          </div>
        )}
      </div>);
  }

  // ════════════════════════════════════════════════════════════════
  // 6 · CURSOS / COHORTES
  // ════════════════════════════════════════════════════════════════
  function CoursesScreen({ go }) {
    const d = A();
    return (
      <div style={{ padding: '8px 20px 24px' }}>
        <Eyebrow>Catálogo</Eyebrow>
        <div style={{ font: '900 24px/1.1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em', margin: '6px 0 2px' }}>Cursos</div>
        <div style={{ font: '500 13px/1.5 var(--f-sans)', color: 'var(--ink-soft)' }}>De tu primer pedido a tu primer contenedor.</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 18 }}>
          {d.COURSES.map((c) => {
            const enrolled = d.isEnrolled(c.id), p = d.courseProgress(c), done = p.pct === 100;
            return (
              <button key={c.id} onClick={() => go({ stack: { type: 'course', id: c.id } })} style={{ textAlign: 'left', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '15px 16px', cursor: 'pointer', boxShadow: 'var(--shadow-xs)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><LevelChip level={c.level} free={c.free} />{c.flagship && <span style={{ font: '700 9.5px/1 var(--f-sans)', color: 'var(--wine)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Insignia</span>}</div>
                  {done ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, font: '700 10px/1 var(--f-sans)', color: 'var(--success)' }}>{I().check(12)} Completado</span> : enrolled ? <span style={{ font: '800 11px/1 var(--f-mono)', color: 'var(--wine)' }}>{p.pct}%</span> : null}
                </div>
                <div style={{ font: '800 15px/1.25 var(--f-display)', color: 'var(--ink)', margin: '10px 0 4px' }}>{c.title}</div>
                <div style={{ font: '500 12px/1.45 var(--f-sans)', color: 'var(--ink-soft)' }}>{c.tagline}</div>
                <div style={{ font: '600 11px/1 var(--f-mono)', color: 'var(--ink-mute)', marginTop: 10 }}>{c.hours} h · {d.lessonCount(c)} lecciones</div>
                {enrolled && p.pct > 0 && <div style={{ marginTop: 10 }}><ProgressBar pct={p.pct} /></div>}
              </button>);
          })}
        </div>

        <div style={{ marginTop: 26 }}><Eyebrow>Cohortes en vivo</Eyebrow></div>
        <div style={{ font: '500 12px/1.45 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 4 }}>Aprende en grupo, con fechas fijas y acompañamiento.</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
          {d.COHORTS.map((co, i) => {
            const c = d.course(co.courseId);
            const left = co.seats - co.taken;
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 13, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '13px 15px' }}>
                <div style={{ width: 46, flexShrink: 0, textAlign: 'center', background: 'var(--wine-tint)', borderRadius: 'var(--r-md)', padding: '7px 0' }}>
                  <div style={{ font: '900 18px/1 var(--f-display)', color: 'var(--wine)' }}>{co.dateISO.slice(8)}</div>
                  <div style={{ font: '700 8.5px/1 var(--f-sans)', color: 'var(--wine)', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 3 }}>{['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'][+co.dateISO.slice(5,7)-1]}</div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: '800 13px/1.25 var(--f-display)', color: 'var(--ink)' }}>{c.title}</div>
                  <div style={{ font: '500 11px/1.3 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 3 }}>{co.mode} · quedan {left} cupos</div>
                </div>
                <button style={{ flexShrink: 0, background: 'var(--ink)', color: '#fff', border: 0, borderRadius: 'var(--r-pill)', padding: '8px 13px', font: '700 11.5px/1 var(--f-sans)', cursor: 'pointer' }}>Inscribirme</button>
              </div>);
          })}
        </div>
        <div style={{ marginTop: 14, font: '500 11px/1.5 var(--f-sans)', color: 'var(--ink-mute)', textAlign: 'center' }}>Los precios se anuncian cuando se abra cada cohorte.</div>
      </div>);
  }

  // ════════════════════════════════════════════════════════════════
  // 7 · CLUB DTD (sketch · fase 2)
  // ════════════════════════════════════════════════════════════════
  function ClubScreen() {
    return (
      <div style={{ padding: '8px 20px 24px' }}>
        <div style={{ background: 'linear-gradient(135deg, var(--ink), #1F3055)', color: '#fff', borderRadius: 'var(--r-xl)', padding: '24px 20px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '4px 10px', borderRadius: 'var(--r-pill)', background: 'rgba(255,255,255,0.12)', font: '700 9.5px/1 var(--f-sans)', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--wine-soft)' }}>Próximamente · Fase 2</div>
          <div style={{ font: '900 24px/1.15 var(--f-display)', letterSpacing: '-0.02em', marginTop: 14 }}>Club DTD</div>
          <div style={{ font: '500 13.5px/1.55 var(--f-sans)', color: 'rgba(255,255,255,0.78)', marginTop: 8, maxWidth: '32ch' }}>La comunidad de importadores DTD. Donde aprender se vuelve hacer, en grupo.</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
          {[
            { ic: 'box', t: 'Compra grupal', s: 'Junta volumen con otros miembros y baja el costo por CBM.' },
            { ic: 'users', t: 'Eventos y cohortes', s: 'Encuentros en vivo, ferias y sesiones con el equipo DTD.' },
            { ic: 'star', t: 'Proveedor del mes', s: 'Fábricas verificadas y recomendadas por la comunidad.' }
          ].map((x, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '15px 16px', opacity: 0.96 }}>
              <span style={{ width: 36, height: 36, borderRadius: 'var(--r-md)', background: 'var(--bg-elevated)', color: 'var(--ink-soft)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>{I()[x.ic] ? I()[x.ic](18) : I().box(18)}</span>
              <div><div style={{ font: '800 13.5px/1.2 var(--f-display)', color: 'var(--ink)' }}>{x.t}</div><div style={{ font: '500 12px/1.45 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 3 }}>{x.s}</div></div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 16, padding: '14px 16px', background: 'var(--wine-tint)', border: '1px solid var(--wine)', borderRadius: 'var(--r-lg)', textAlign: 'center' }}>
          <div style={{ font: '700 12.5px/1.5 var(--f-sans)', color: 'var(--ink)' }}>Te avisamos cuando abra. Por ahora, sigue sumando cursos y diplomas.</div>
        </div>
      </div>);
  }

  // ── Celebración + diploma ──────────────────────────────────────
  function Celebration({ course, diploma, onClose, go }) {
    return (
      <div style={{ position: 'absolute', inset: 0, zIndex: 50, background: 'rgba(11,20,40,0.55)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'flex-end' }}>
        <div style={{ width: '100%', background: 'var(--bg-base)', borderTopLeftRadius: 'var(--r-xl)', borderTopRightRadius: 'var(--r-xl)', padding: `24px 20px ${24 + INSETS.bottom}px`, animation: 'aca-rise 320ms var(--ease) both' }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--border-strong)', margin: '0 auto 18px' }} />
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--success)', color: '#fff', display: 'grid', placeItems: 'center', margin: '0 auto' }}>{I().check(28)}</div>
          <div style={{ font: '900 21px/1.2 var(--f-display)', color: 'var(--ink)', textAlign: 'center', marginTop: 14, letterSpacing: '-0.01em' }}>Curso completado</div>
          <div style={{ font: '500 13px/1.5 var(--f-sans)', color: 'var(--ink-soft)', textAlign: 'center', marginTop: 6, maxWidth: '30ch', marginInline: 'auto' }}>Ganaste tu diploma de <b style={{ color: 'var(--ink)' }}>{course.title}</b>. Quedó guardado en tu vitrina.</div>
          <div style={{ width: 150, margin: '18px auto 0' }}><DiplomaMini variant={diploma.variant} /></div>
          <code style={{ display: 'block', textAlign: 'center', font: '600 10.5px/1 var(--f-mono)', color: 'var(--ink-mute)', marginTop: 8 }}>{diploma.folio}</code>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 18 }}>
            <button onClick={() => { onClose(); go({ tab: 'diplomas', stack: null }); }} style={{ background: 'var(--wine)', color: '#fff', border: 0, borderRadius: 'var(--r-md)', padding: '13px', font: '800 13px/1 var(--f-sans)', cursor: 'pointer' }}>Ver mi diploma</button>
            <button onClick={onClose} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--ink)', borderRadius: 'var(--r-md)', padding: '13px', font: '700 13px/1 var(--f-sans)', cursor: 'pointer' }}>Seguir</button>
          </div>
        </div>
      </div>);
  }

  // ── Bottom nav ─────────────────────────────────────────────────
  function BottomNav({ tab, go }) {
    const items = [
      { v: 'inicio', l: 'Inicio', ic: 'dashboard' },
      { v: 'cursos', l: 'Cursos', ic: 'box' },
      { v: 'diplomas', l: 'Diplomas', ic: 'shield' },
      { v: 'club', l: 'Club', ic: 'star' }
    ];
    return (
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, display: 'flex', background: 'color-mix(in srgb, var(--bg-surface) 92%, transparent)', backdropFilter: 'blur(10px)', borderTop: '1px solid var(--border)', paddingBottom: INSETS.bottom }}>
        {items.map((it) => {
          const on = tab === it.v;
          return (
            <button key={it.v} onClick={() => go({ tab: it.v, stack: null })} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '9px 0 10px', background: 'none', border: 0, cursor: 'pointer', color: on ? 'var(--wine)' : 'var(--ink-mute)' }}>
              {I()[it.ic] ? I()[it.ic](20) : I().box(20)}
              <span style={{ font: (on ? '800' : '600') + ' 9.5px/1 var(--f-sans)' }}>{it.l}</span>
            </button>);
        })}
      </div>);
  }

  // ── App root ───────────────────────────────────────────────────
  function PortalAcademia({ gate, topInset = 0, bottomInset = 0 }) {
    INSETS = { top: topInset, bottom: bottomInset };
    const [tab, setTab] = useState('inicio');
    const [stack, setStack] = useState(null);
    const [celebrate, setCelebrate] = useState(null);

    const go = (next) => {
      if (next.tab !== undefined) setTab(next.tab);
      if (next.stack !== undefined) setStack(next.stack);
      else if (next.tab !== undefined) setStack(null);
    };
    const isMember = !gate && A().isMember();
    const immersive = stack && stack.type === 'lesson';

    let screen;
    if (!isMember) screen = <GateScreen />;
    else if (stack && stack.type === 'course') screen = <CourseScreen courseId={stack.id} go={go} onBack={() => setStack(null)} />;
    else if (stack && stack.type === 'lesson') screen = <LessonScreen courseId={stack.courseId} lessonId={stack.lessonId} go={go} onBack={() => setStack(stack.from || { type: 'course', id: stack.courseId })} onCelebrate={(course, diploma) => setCelebrate({ course, diploma })} />;
    else if (tab === 'inicio') screen = <HomeScreen go={go} />;
    else if (tab === 'cursos') screen = <CoursesScreen go={go} />;
    else if (tab === 'diplomas') screen = <DiplomasScreen go={go} />;
    else if (tab === 'club') screen = <ClubScreen />;

    return (
      <div style={{ position: 'absolute', inset: 0, background: 'var(--bg-base)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <style>{'@keyframes aca-rise{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:none}} .aca-scroll{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch}'}</style>
        <div className="aca-scroll" style={{ paddingTop: INSETS.top, paddingBottom: (isMember && !immersive ? 64 : 0) + (immersive ? INSETS.bottom : 0) }}>
          {screen}
        </div>
        {isMember && !immersive && <BottomNav tab={tab} go={go} />}
        {celebrate && <Celebration course={celebrate.course} diploma={celebrate.diploma} go={go} onClose={() => setCelebrate(null)} />}
      </div>);
  }

  window.PortalAcademia = PortalAcademia;
})();
