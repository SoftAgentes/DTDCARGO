# Handoff — La tarifa de $850 en la guía de peso y en marketing

- Fecha: 2026-09-18. Estado de la tarea: **lista para revisión** (PR draft). Sin SDD, por decisión
  del Director: es texto con fecha y el origen del cambio de precio es la SDD-0475.
- Owner/sesión: `worker-marketing-tarifa-850-dtdcargo-2e-20260918` (Claude Opus 5, Worker, sesión
  `dtdcargo-2e`). Asignó el Director `dtdcargo-18`.
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/marketing-tarifa-850`.
- Rama: `codex/marketing-tarifa-850`, desde `origin/main` = `78410913`.
- Aislamiento comprobado antes de editar: `guard` → `Guard OK`, claim adquirido con el owner de arriba.
- Permisos: commits en esta rama, push de la rama propia y PR **draft** contra `main`, reportando
  al Director antes de abrirla. No merge, no producción.

## OBJETIVO ORIGINAL

`public/interno/guia-peso.html` y los materiales de marketing seguían con $800 (pendiente abierto
en `docs/marketing/README.md:224-228`, y FUERA DE ALCANCE de la SDD-0475). La tarifa pública es
$850 desde el 2026-09-04.

## COMPLETADO

Revisión uno por uno, con la clasificación que aprobó el Director:

| Documento | Qué había | Qué se hizo |
| --- | --- | --- |
| `public/interno/guia-peso.html` | 14 cifras encadenadas a $800: tres diálogos y la tabla de maquinaria | Recalculadas a $850, con la fecha visible «al 2026-09-18» y SDD-0475 como origen. **Solo texto**: el Director descartó leer `/api/public/cbm-rate`, porque la guía enseña la fórmula del peso y un JS la copiaría |
| `docs/marketing/manual-vendedores-peso.md` | Tarifa «de referencia hoy» y dos bloques de ejemplos a $800 | Recalculados a $850 con fecha |
| `docs/marketing/calculadora-explicada.html` | Pie «Números vigentes al 5 de agosto» y 6 ejemplos a $800 | Recalculados y el pie fechado el 2026-09-18. Además, el **mínimo en cajas pasa de 3 a 2** (lo que muestra hoy la calculadora), con el gráfico ajustado (quiebre en 0,0588 m³). **Baterías: se quedan en ×1,3 y el pie las marca «en revisión».** Primero las pasé a ×1,5, como dice el ERP, y el Director retiró esa aprobación: `535aa0ec` (Sam, 2026-08-05) fijaba ×1,3 y el 1,5 se editó a mano después, sin saberse si fue decisión. La reversión va en `46706db5`; el ejemplo con baterías solo actualiza la base por la tarifa: $1.700 × 1,3 = $2.210 (+$510) |
| `docs/marketing/competencia-precios.md` §5 y `docs/marketing/adquisicion.md` | Foto comparativa del 2026-08-01 | **Nota fechada**, sin retocar la foto: la ventaja baja de 13 % a 7,6 % contra AsiaVen, y el piso deja de morder en 2 cajas |
| `conversacion-crm.md:333`, `equipo-crm/07-como-conversar.md:286`, `manual-asesor/01-diagnostico.md:169` y `:370` | Ejemplo del «precio desnudo» | **No se tocan**: el error que enseñan es no preguntar, no el número |
| `docs/marketing/README.md` | Pendiente abierto | Cerrado con el detalle de arriba |

## VALIDACIÓN

| Comprobación | Resultado |
| --- | --- |
| **Cada cifra, en el motor real.** `calcularEnvioLCL` de `lib/calculadora.ts` con la configuración y las ciudades públicas de producción (props de `dtdcargo.com/tarifas`, bajadas el 2026-09-18 05:12 UTC) y la tarifa de `/api/public/cbm-rate` (`{"per_cbm":850,"min_charge":50,"valid_until":"2026-11-29"}`) | **PASÓ en los 22 casos sin baterías**: son los mismos números que quedaron escritos. Guía: 3.400; 1.700 → 2.500; 15.300 y 12.600 → 2.700 menos; 425, 6.800, 10.200, 3.700, 5.550. Explicativo: 1.700; 2.900; 2.920,80 a Puerto Ordaz; caja 25,50 → 50 con ajuste 24,50; 25.500; asesor a 12 m³ y 9.500 kg; 1.650. Manual: 2.550; 2.850; 3.700; 10.200; 25.500; asesor a 5 m³ y 10.000 kg. **El caso con baterías no coincide a propósito**: el motor con la configuración viva da ×1,5 = $2.550, y el documento conserva ×1,3 = $2.210 mientras Sam decide. La prueba fue temporal, en `test-results/` (ignorado), y se borró |
| Mínimo en cajas | **PASÓ** — `components/CalculadoraForm.tsx:262` calcula `piso ÷ tarifa` y `cajasParaCbm`: con 50/850 = 0,0588 m³ el cliente ve hoy «Nuestro mínimo son 2 cajas de 40×30×25 cm» |
| Gráfico del mínimo | **PASÓ** — se renderizó el SVG viejo y el nuevo lado a lado: misma composición, quiebre movido a 0,0588 m³ |
| `git diff --check` | **PASÓ** |
| `vitest run lib/studio/marketing` (el lector de marketing del Studio empaqueta `adquisicion.md` y `manual-vendedores-peso.md`) | **PASÓ** — 3 archivos, 21 casos |
| `pnpm verify` | **NO EJECUTADO** — son texto de Markdown y de un HTML estático sin JS. La máquina estaba saturada, con el `verify` de la SDD-0478 corriendo al mismo tiempo. El build de producción lo corre el check obligatorio de la PR |
| Merge de `origin/main` (`56fa2ae0`, PR #136) → `60089f1b` | **PASÓ** — sin conflictos; ningún archivo de esta rama coincide con los de la #136 |
| CI alojado de la PR | Se reporta al Director por mensaje |

## COMMITS

| Commit | Propósito |
| --- | --- |
| `ba9be13d` | `fix(marketing)`: la tarifa de $850 en la guía de peso y en marketing, con fecha |
| `46706db5` | `fix(marketing)`: las baterías vuelven a ×1,3, en revisión hasta que Sam decida |
| `60089f1b` | merge de `origin/main` (`56fa2ae0`), sin rebase |
| el commit que contiene este documento | `docs(handoff)`: este handoff |

## PR / BRANCH

- Rama `codex/marketing-tarifa-850`, base `main`. PR draft después de reportar al Director.

## PENDIENTES DE ESTA TAREA

1. **Baterías**: si Sam confirma ×1,5, un commit de cuatro líneas (ver FUERA DE ALCANCE nº 4). Si
   confirma ×1,3, basta con quitar la marca «en revisión».
2. **Recibo semántico de `docs/marketing/README.md`**, que es una de las 16 fuentes del piloto (ver
   Impacto documental). Lo aplica el Director en `main` después de integrar, con el fragmento ya
   revisado que dejé.
3. Revisión e integración del Director. Ojo: `public/interno/guia-peso.html` se sirve en
   producción, así que el merge dispara deploy. El `ignoreCommand` de Vercel solo se salta el build
   cuando cambian únicamente `docs/**` o Markdown.

## FUERA DE ALCANCE DETECTADO

1. **La guía dice que «Máquina grande · 12 m³ · 10.000 kg» cobra al instante, y no es así.** El
   motor devuelve `peso_envio_excedido` (más de 9.000 kg y densa, 833 kg/m³ → asesor), igual que
   dicen `manual-vendedores-peso.md:29` y el explicativo. Ya estaba mal con $800. Se recalculó el
   número ($10.200), pero la fila sigue prometiendo algo que la calculadora no hace. Arreglo
   sugerido: bajar el peso a 8.000 kg (como el manual) o marcarla «Asesor». Lo decide el Director.
2. **«Nunca bajo el mínimo ($380)»** en `guia-peso.html:365` y `manual-vendedores-peso.md:32/86`.
   El mínimo cobrable de producción es $50 (`/api/public/cbm-rate`). El $380 parece el
   `min_charge` del seed de 2026-05 (`0005_rates.sql`). No es de los $800 y no se tocó.
3. **La columna DTD de `competencia-precios.md` §5** también tiene densidad 500 kg/m³ y $1/kg,
   mientras la calculadora cobra hoy con 1.000 kg/m³ y $2/kg. Ojo: los 1.000 son una excepción
   vigente y la regla de la casa son 500 (SDD-0474), así que corregirlo necesita la decisión de
   Sam sobre qué se compara.
4. **El recargo de baterías no se sabe cuál es**: el ERP dice ×1,5, pero `CONFIG` en
   `lib/calculadora.ts:142` y `535aa0ec` (Sam, 2026-08-05) dicen ×1,3. Un dato más para Sam:
   `competencia-precios.md` §5 (la foto del 2026-08-01, que no toqué) ya decía «DTD · Baterías ×
   1,5». El Director se lo pregunta a Sam. Si confirma ×1,5, cambian tres líneas de
   `calculadora-explicada.html` y una del README de marketing.
5. **Comentario viejo en `public/guias/comprar-en-alibaba.html:440-441`**: dice que la tarifa
   «vuelve a 800 el 5-oct si nadie lo renueva». Con la 0458 aplicada ya no pasa (la RPC sirve la
   vencida) y la vigencia es hasta el 2026-11-29. Es un comentario de código, no texto visible.

## IMPACTO DOCUMENTAL

- Canónicos actualizados: cuatro documentos de `docs/marketing/` (manual de vendedores,
  calculadora explicada, competencia y adquisición), su `README.md` (pendiente cerrado) y
  `public/interno/guia-peso.html`.
- No aplica: specs (sin SDD, por decisión del Director), `BRAND.md` (sin cambios visuales: la nota
  nueva usa las clases y tokens que ya tenía la guía), gobernanza.
- **`docs/marketing/README.md` es una de las 16 fuentes del piloto semántico
  (`canonical-16-2026-09-16`)**, y esta tarea lo cambia (cierre del pendiente, L223-L235). Hasta
  que haya recibo, el piloto en `main` va a quedar en 15/16.
  - **El recibo NO se pudo emitir en el worktree.** `graphify update .` corrió sobre `60089f1b`
    (0 pendientes, 0 faltantes), pero la estructura sigue PENDING por dos nodos virtuales de
    módulos externos (`react`, `@testing-library/react`) en `structural.deleted`. Es el mismo
    estado que registró la 0475 y el que tiene hoy el checkout principal. Por eso
    `knowledge-semantic-apply.py --check` responde `REJECTED: structural graph must be current before
    importing semantic output`. No se «reparó»: el runbook prohíbe descartar rutas externas sin
    investigarlas. Igual, el recibo vive en `graphify-out` de cada árbol y no viajaría con la PR.
  - **Lo que sí queda listo es el fragmento revisado**, para que el Director lo aplique en `main`
    al integrar. Toma los 16 nodos y 15 aristas de la extracción vigente del piloto (la del grafo
    del checkout principal), ajusta el bloque de pendientes (L186-L235), agrega el nodo
    `docs_marketing_readme_tarifa_850_revision` y dos aristas `references`: 17 nodos y 17 aristas.
    Revisé el documento completo (235 líneas, sin YAML inicial).
    Archivos: `graphify-out/lote-readme-marketing.json` (sha256 `3fb0ef4c07ed…`) y
    `lote-readme-marketing.review.json` de este worktree, con copia en el scratchpad de la sesión.
    En `main` hay que regenerar la revisión con el `head` de `main`: el sha256 del README
    (`720205cb3a1d…`) no cambia al integrar.
- **Semántica global:** PENDING (1.092), que es el backlog de siempre.
- **Archify:** NO DISPONIBLE (`ARCHIFY_RUNTIME_MISSING` en el worktree).
- **Obsidian:** `knowledge:publish --preview` → `ok: true` en `60089f1b`, 0 conflictos y 39 avisos
  de enlaces, todos ajenos a esta rama (los mismos que registró la 0475). La bóveda compartida no se
  tocó.

## HANDOFF AL DIRECTOR

- **Siguiente acción:** revisar la PR draft. Decidir el punto 1 de FUERA DE ALCANCE antes de
  integrar si no quieres una guía que recalcula bien una fila que igual es falsa.
- **Cambios compartidos:** ninguno. Comprobado con `gh pr view --json files` el 2026-09-18: la
  única PR abierta (#114) no toca estos archivos, ni tampoco la #136, ya integrada.
- **Sesiones consumidoras:** ninguna. El claim se libera al terminar la escritura; worktree y rama
  se conservan.
