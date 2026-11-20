# Pedido a Cloud Design — Azul de acción en web, Portal y ERP (BD-076) · 2026-11-20

> Para el proyecto de branding/Norte en Cloud Design. Es un **cambio normativo** decidido por Sam: el color de acción deja de ser el vino y pasa a un azul nuevo. Ya está registrado en el repo como **BD-076** (`docs/design/studio/_norte/BRAND-DECISIONS.md`) y en `BRAND.md`; falta llevarlo a la fuente de la marca. Spec de producto: SDD-0686.

## Qué decidió Sam (literal, 2026-11-20)

- Problema: «El rojo que tenemos, el vino tinto, visualmente la gente lo ve como algo negativo o como borrar.»
- Decisión, vistas cinco opciones con su contraste: «opcion 2  Completamente todo el proyecto web, portal y ERP; todo el sistema completo.»
- Alcance de marca: «Si hay que cambiar el branding completo, se puede cambiar. Si hay que eliminar algo que nos pueda dar errores adentro del brand.md, hay que cambiarlo.»
- No cubre el logo: las 4 variantes y el «DTD» del wordmark siguen en vino.

## La regla nueva

1. **Azul = acción:** botón principal, enlaces, foco, acento de «esto se oprime».
2. **Rojo = peligro y error.** Es el único rojo de la interfaz.
3. **Vino = identidad:** logo, wordmark «DTD», sello, documentos de marca. No pinta botones, enlaces ni cifras.
4. **Tinta = selección** (pestaña, filtro; BD-037) **y cifras** (saldos, KPI, montos).
5. Un estado nunca se comunica solo con color: el peligro conserva icono y verbo.

**Por qué (medido):** `--wine` `#7F0F1A` y `--danger` `#A8323E` comparten tono (354°) y contrastan 1,61:1 entre sí; en oscuro `--wine` es `#A8323E`, el mismo hex que `--danger` del tema claro.

## Tokens nuevos (valores propuestos; Sam fija el tono exacto viéndolo en pantalla)

| Token | Claro | Oscuro | Para qué |
|---|---|---|---|
| `--accion` | `#1F4FA8` | `#7FAAF0` | Relleno del botón principal; acento de acción |
| `--accion-hover` | `#183E86` | `#9BBDF4` | Hover del relleno |
| `--on-accion` | `#FFFFFF` | `#0F1E3D` | Texto e icono sobre el relleno (en oscuro, navy: blanco mide 2,36:1) |
| `--accion-text` | `#1F4FA8` | `#7FAAF0` | Acción como texto: enlaces |
| `--accion-tint` | `rgba(31,79,168,0.08)` | `rgba(127,170,240,0.14)` | Fondo suave de acción |
| `--accion-soft` | `#7FAAF0` | `#7FAAF0` | Foco sobre superficies siempre oscuras (menú lateral) |

Misma familia de tono que el navy de la marca (219° frente a 220° de `--ink`). En web y Portal los pares se llaman `--color-accion*`. Al imprimir, vuelven al valor claro.

**Contraste** (WCAG, verificado por el contrato `color-accion-contract.test.ts` del repo):

| Par | Claro | Oscuro | Mínimo |
|---|---|---|---|
| `--on-accion` sobre `--accion` | 7,66 | 7,00 | 4,5 |
| `--on-accion` sobre `--accion-hover` | 10,13 | 8,62 | 4,5 |
| `--accion` contra `--bg-surface` | 7,66 | 6,32 | 3 |
| `--accion` contra `--bg-elevated` | 6,73 | 5,53 | 3 |
| `--accion-text` sobre `--bg-base` | 7,34 | 7,78 | 4,5 |
| `--accion-text` sobre `--accion-tint` (sobre la tarjeta) | 6,76 | 4,88 | 4,5 |
| `--accion-soft` contra `--bg-sidebar` | 7,00 | 8,23 | 3 |
| Distancia de tono `--accion` ↔ `--danger` | ≥ 90° | ≥ 90° | 90° |

**Límite conocido:** azul y rojo tienen luminosidad parecida (1,16:1 en claro); se distinguen por tono. Por eso la regla 5 es obligatoria.

## Qué NO cambia

- `--wine`, `--wine-deep`, `--wine-soft`, `--wine-text`, `--wine-tint` **se conservan** como tokens de identidad. Ningún valor existente cambia; solo cambia su uso.
- Logo, isólogo, wordmark y sus 4 variantes.
- Los semánticos (`--success`, `--warning`, `--danger`, `--info`) y los fondos.
- Selección en tinta (BD-037), elevación y contornos de SDD-0603.

## Qué pedimos actualizar en el Norte

1. **Brand Book (`Brand Book DTD v4.6.html` → v4.7 o la que corresponda):** sección de color y sección del ERP. Paleta con el azul de acción; el vino descrito como identidad; ejemplos de botón principal y enlace en azul; tabla de contraste con los pares de arriba.
2. **`erp/tokens.css`:** los seis tokens en claro y oscuro; comentario de `--wine` («Acento primario · CTAs · links») → identidad.
3. **`erp/components.jsx`:** `<Btn variant="primary">` con `--accion` / `--on-accion`; foco con `--accion`.
4. **`CLAUDE.md` del Norte:** §Sistema de color (comentario de `--wine`, tabla «Marca»), §Contraste (relleno + texto, rol de `--wine`, foco visible) y el aviso de que los azules prohibidos son **para alertas**, no para la acción.
5. **`Accesibilidad de Color · DTD-Cargo.html`:** la matriz con los pares nuevos.
6. **Registro:** BD-076 ya existe en el repo con este número; usar el mismo para no chocar (BD-071, BD-074 y BD-075 ya están reclamadas; BD-072 y BD-073 son huecos que no se reutilizan).

## Pendientes de decisión de Sam (no los resuelvan solos)

- ~~Tono exacto del azul.~~ Sam lo fijó el 2026-11-20 al elegir la opción B entre tres: `#1F4FA8` en claro y `#7FAAF0` en oscuro, los valores de la tabla de arriba.
- ~~Color del Shipping Mark.~~ Decidido el 2026-11-20 (BD-076, regla 6). Todo dato va en tinta. Va en azul con subrayado fino solo cuando ese dato, él solo, lleva a otro lugar. Si toda la fila se abre al tocarla, en impresión o sin destino, va en tinta. Sustituye `--wine-text` para el Shipping Mark en §Contraste del `CLAUDE.md` del Norte.
- ~~Badge tono `wine`.~~ Decidido el 2026-11-20 (BD-076, regla 7): el tono se retira. Cada badge toma el tono de lo que dice: `neutral` si informa, `success` si confirma, tinta si cuenta una selección. En `erp/components.jsx` (`<Badge>`) y en el Brand Book, el tono `wine` sale de la lista.
- Correos, PDF de factura y estado de cuenta, etiquetas: conservan el vino salvo decisión contraria.
- La variante `mono-light` del logo dice «sobre wine, CTAs»: con CTAs azules, confirmar si aplica igual sobre el azul.

## Estado en el repo

- Fase 0 (documentos) y fase 1 (tokens y botón principal del Studio) escritas en la rama de SDD-0686; contratos en verde. Sin fusionar ni publicar todavía: la fase 1 no se publica sola (SDD-0686 §8.1).
- Cuando el Norte vuelva con la versión nueva del Brand Book, se aplica por NORTE-SYNC sin reinterpretar.
