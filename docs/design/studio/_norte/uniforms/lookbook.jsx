/* global React, ReactDOM, window */
/* ── DTD-Cargo · Uniformes · Lookbook lifestyle ───────────────────
   Galería de slots de foto reales (image-slot) con callouts de
   posición de logo. Modo Demo = referencia de encuadre por slot
   (marcas de recorte + regla de tercios + brief de toma). El brief
   se oculta solo cuando el usuario arrastra una foto real.          */

/* ════════════════════════════════════════════════════════════════
   TODO · PENDIENTE POR TERMINAR (pausado 2026-06-16 · pedido usuario)
   ----------------------------------------------------------------
   Falta lo INTERACTIVO de verdad. Lo que se quiere:
   1. El usuario carga su foto en el slot.
   2. Sobre la foto aparece el ISÓLOGO real (no la etiqueta de texto):
      por defecto en el pecho izquierdo.
   3. El isólogo se puede ARRASTRAR para posicionarlo a mano sobre la
      prenda, y redimensionar (mm). Se elige variante automática según
      el fondo (navy→reverse / claro→primario) con opción de cambiarla.
   4. Guardar posición+tamaño+variante por slot (persistir).
   Estado actual: los `callout` son etiquetas FIJAS de referencia, NO
   un logo movible. Eso es lo que falta construir.
   ════════════════════════════════════════════════════════════════ */

const { useTweaks, TweaksPanel, TweakSection, TweakRadio, TweakToggle } = window;

const NAVY = '#0F1E3D';
const CREMA = '#C2747F';

// 8 tomas lifestyle/lookbook
const SHOTS = [
  { id: 'uni-almacen', ar: 'ar-1610', sc: 'Acción · almacén', ti: 'Estiba y carga de container', sp: 'Camiseta navy · serigrafía',
    pos: 'PECHO IZQ · 70 mm', col: 'NAVY · REVERSE', dot: NAVY, bg: 'navy', ph: 'Foto: estiba cargando un container',
    fr: 'Plano medio · operario de espaldas estibando, container abierto al fondo. Luz natural.' },
  { id: 'uni-entrega', ar: 'ar-45', sc: 'Confianza · cliente', ti: 'Entrega puerta a puerta', sp: 'Polo piqué · bordado',
    pos: 'PECHO IZQ · 70 mm', col: 'NAVY · REVERSE', dot: NAVY, bg: 'navy', ph: 'Foto: entrega / contacto con el cliente',
    fr: 'Plano americano · entrega del paquete al cliente, contacto visual y sonrisa.' },
  { id: 'uni-equipo', ar: 'ar-169', sc: 'Equipo', ti: 'Foto grupal · Valencia', sp: 'Línea completa · navy + crema',
    pos: 'PECHO + ESPALDA', col: 'NAVY / CREMA', dot: CREMA, bg: 'crema', ph: 'Foto grupal del equipo DTD',
    fr: 'Plano general · 4 a 6 personas en fila, fondo neutro, logos al frente legibles.' },
  { id: 'uni-gorra', ar: 'ar-45', sc: 'Operario', ti: 'Gorra · 6 gajos', sp: 'Gabardina · bordado frontal',
    pos: 'FRONTAL · 70 mm', col: 'NAVY · REVERSE', dot: NAVY, bg: 'navy', ph: 'Operario con gorra',
    fr: 'Primer plano 3/4 · rostro y gorra, bordado frontal nítido y centrado.' },
  { id: 'uni-chaleco', ar: 'ar-11', sc: 'Alta visibilidad', ti: 'Chaleco logístico', sp: 'Ripstop · serigrafía',
    pos: 'ESPALDA · 260 mm', col: 'NAVY · REVERSE', dot: NAVY, bg: 'navy', ph: 'Operario con chaleco alta visibilidad',
    fr: 'Plano entero de espaldas · bandas reflectivas y logo grande de espalda visibles.' },
  { id: 'uni-china', ar: 'ar-32', sc: 'Equipo China · 中国', ti: 'Inspección en fábrica', sp: 'Camiseta · variante bilingüe',
    pos: 'ESPALDA · 门到门', col: 'NAVY · REVERSE', dot: NAVY, bg: 'navy', ph: 'Equipo China inspeccionando en fábrica',
    fr: 'Plano medio · inspección de mercancía en almacén o feria, etiqueta bilingüe a cuadro.' },
  { id: 'uni-estudio-f', ar: 'ar-45', sc: 'Lookbook · estudio', ti: 'Frente · isólogo al pecho', sp: 'Fondo limpio · catálogo',
    pos: 'PECHO IZQ · 70 mm', col: 'NAVY · REVERSE', dot: NAVY, bg: 'navy', ph: 'Lookbook estudio · frente',
    fr: 'Busto frontal · fondo limpio gris/crema, logo al pecho centrado en el cuadro.' },
  { id: 'uni-estudio-b', ar: 'ar-45', sc: 'Lookbook · estudio', ti: 'Espalda · isólogo grande', sp: 'Fondo limpio · catálogo',
    pos: 'ESPALDA · 220 mm', col: 'NAVY · REVERSE', dot: NAVY, bg: 'navy', ph: 'Lookbook estudio · espalda',
    fr: 'Busto de espaldas · fondo limpio, isólogo grande centrado entre los omóplatos.' },
];

// 3 detalles macro
const DETAILS = [
  { id: 'uni-det-bordado', ti: 'Macro · bordado pecho', sp: 'Isólogo 70 mm · hilo crema', bg: 'navy', ph: 'Macro del bordado en el pecho',
    sc: 'Detalle', fr: 'Macro 1:1 · puntada al hilo con luz rasante, textura de la tela visible.' },
  { id: 'uni-det-etiqueta', ti: 'Etiqueta interior · cuello', sp: 'Talla · RIF · dominio', bg: 'crema', ph: 'Etiqueta interior del cuello',
    sc: 'Detalle', fr: 'Cuello volteado · etiqueta tejida legible: talla, RIF y dominio.' },
  { id: 'uni-det-puno', ti: 'Puño / costura', sp: 'Pespunte doble · refuerzo', bg: 'navy', ph: 'Detalle de puño y costura',
    sc: 'Detalle', fr: 'Macro · doble pespunte y refuerzo de costura, calidad de confección.' },
];

const ALL_IDS = SHOTS.concat(DETAILS).map((s) => s.id);

// Referencia de encuadre — sólo en modo demo. Se oculta solo cuando
// el image-slot recibe una foto real (data-filled).
function Brief({ s, det }) {
  return (
    <div className={'brief' + (s.bg === 'crema' ? ' crema' : '')} aria-hidden="true">
      <span className="crop tl"></span><span className="crop tr"></span>
      <span className="crop bl"></span><span className="crop br"></span>
      <div className="thirds"></div>
      <div className="brief-body">
        <span className="brief-tag">{det ? 'Referencia · detalle' : 'Referencia de encuadre'}</span>
        <span className="brief-ti">{s.ti}</span>
        <p className="brief-fr">{s.fr}</p>
      </div>
    </div>
  );
}

function Shot({ s, callouts, demo }) {
  return (
    <div className="gcard">
      <div className={'frame' + (demo ? ' demo' : '')}>
        <image-slot id={s.id} class={s.ar} shape="rounded" radius="10" placeholder={s.ph}></image-slot>
        {demo && <Brief s={s} />}
        {callouts && (
          <React.Fragment>
            <span className="callout pos"><span className="sq"></span>{s.pos}</span>
            <span className="callout col"><span className="dt" style={{ background: s.dot }}></span>{s.col}</span>
          </React.Fragment>
        )}
      </div>
      <div className="cap">
        <span className="sc">{s.sc}</span>
        <span className="ti">{s.ti}</span>
        <span className="sp">{s.sp}</span>
      </div>
    </div>
  );
}

function Detail({ d, demo }) {
  return (
    <div className="gcard">
      <div className={'frame' + (demo ? ' demo' : '')}>
        <image-slot id={d.id} class="ar-11" shape="rounded" radius="10" placeholder={d.ph}></image-slot>
        {demo && <Brief s={d} det />}
        <span className="callout det">DETALLE</span>
      </div>
      <div className="cap">
        <span className="ti">{d.ti}</span>
        <span className="sp">{d.sp}</span>
      </div>
    </div>
  );
}

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "layout": "editorial",
  "callouts": true,
  "demo": false,
  "dark": false
}/*EDITMODE-END*/;

const LAYOUTS = { 'Editorial': 'editorial', 'Hero + grid': 'hero', 'Masonry': 'masonry' };

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  React.useEffect(() => {
    document.documentElement.dataset.theme = t.dark ? 'dark' : 'light';
  }, [t.dark]);

  const layoutLabel = Object.keys(LAYOUTS).find((k) => LAYOUTS[k] === t.layout) || 'Editorial';

  return (
    <React.Fragment>
      <div className="toolbar">
        <button className={'demobtn' + (t.demo ? ' on' : '')} onClick={() => setTweak('demo', !t.demo)}>
          <span className="dt"></span>{t.demo ? 'Quitar referencias' : 'Ver demo · referencias de encuadre'}
        </button>
        <span className="toolnote">{t.demo
          ? 'Cada recuadro muestra la dirección de la toma y dónde va el logo. Arrastrá una foto real y la referencia se reemplaza sola.'
          : 'Previsualizá cada slot con su guía de encuadre y posición de logo, sin cargar fotos todavía.'}</span>
      </div>

      <div className="section-bar">
        <h2>Lookbook · el uniforme en contexto</h2>
        <span className="sub">8 tomas: acción en almacén, entrega al cliente, equipo, alta visibilidad, China y estudio.</span>
      </div>
      <div className="gallery" data-layout={t.layout}>
        {SHOTS.map((s) => <Shot key={s.id} s={s} callouts={t.callouts} demo={t.demo} />)}
      </div>

      <div className="section-bar">
        <h2>Detalle · bordado y terminación</h2>
        <span className="sub">Tomas cerradas que prueban la calidad de aplicación del logo.</span>
      </div>
      <div className="details">
        {DETAILS.map((d) => <Detail key={d.id} d={d} demo={t.demo} />)}
      </div>

      <div className="section-bar">
        <h2>Pautas de aplicación</h2>
        <span className="sub">Cómo fotografiar y aplicar el uniforme sin romper la marca.</span>
      </div>
      <div className="pautas">
        <div className="pcard">
          <span className="pn">01</span>
          <h3>Posición del logo</h3>
          <p>El isólogo va en el <b>pecho izquierdo</b> — el lado del corazón, punto focal natural. El pecho derecho y las mangas quedan para nombre, área o insignias secundarias. En espalda, isólogo grande centrado.</p>
          <div className="chips">
            <span className="chip">Pecho izq · 70 mm</span>
            <span className="chip">Espalda · 220 mm</span>
            <span className="chip">Manga · nombre</span>
          </div>
        </div>
        <div className="pcard">
          <span className="pn">02</span>
          <h3>Coherencia de color</h3>
          <p>La prenda respeta la paleta del manual. Sobre navy se usa el isólogo <b>reverse</b> (cream); sobre blanco o crema, el <b>primario</b>. Nunca el primario sobre fondo navy — desaparece.</p>
          <div className="chips">
            <span className="chip ok">Navy → reverse</span>
            <span className="chip ok">Crema → primario</span>
            <span className="chip no">Primario sobre navy</span>
          </div>
        </div>
        <div className="pcard">
          <span className="pn">03</span>
          <h3>Lifestyle &gt; render</h3>
          <p>Tomas del equipo real en acción o de interacción con el cliente generan confianza inmediata. El estudio con fondo limpio queda para catálogo y detalle. Encuadre a la altura del torso para que el logo se lea.</p>
          <div className="chips">
            <span className="chip ok">Acción / lifestyle</span>
            <span className="chip ok">Estudio para detalle</span>
            <span className="chip no">Maqueta genérica</span>
          </div>
        </div>
      </div>

      <TweaksPanel>
        <TweakSection label="Demo" />
        <TweakToggle label="Referencias de encuadre" value={t.demo}
          onChange={(v) => setTweak('demo', v)} />
        <TweakSection label="Composición" />
        <TweakRadio label="Layout" value={layoutLabel}
          options={Object.keys(LAYOUTS)}
          onChange={(v) => setTweak('layout', LAYOUTS[v])} />
        <TweakToggle label="Callouts de logo" value={t.callouts}
          onChange={(v) => setTweak('callouts', v)} />
        <TweakSection label="Tema" />
        <TweakToggle label="Modo oscuro" value={t.dark}
          onChange={(v) => setTweak('dark', v)} />
      </TweaksPanel>
    </React.Fragment>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
