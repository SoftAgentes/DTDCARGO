# Handoff · SDD-0687 fases 1 y 2 · Entrada de cifras 1.234,50

**Owner:** Worker `local_sdd0687-f12-385f77c3` · **Rama:** `claude/sdd-0687-fases-1-2-entrada-8b27e2` ·
**Worktree:** `.claude/worktrees/plan-de-prueba-71bd60` · **Coordina:** Dir_DTD · **Carril:** revisión previa (toca montos).

**Pedido de Sam, textual:** «Rebrand: arranca las fases 1 y 2 de las cifras 1.234,50 apenas entren mis decisiones».
**Decisiones que aplican, textual:** «Cifras 2 cbm: A punto o coma · Cifras 5 tasa: B 2 a 4 · Cifras 6 punto: A acepta».
La spec (`docs/specs/0687-rebrand-cifras-formato-ve/spec.md`) está en la PR #769, todavía sin fusionar: la allowlist
va en el cuerpo de la PR de esta tarea.

## Qué cambia

- `lib/shared/cifras.ts` (nuevo): `parseNumero(texto, modo)` y los atajos `parseDinero`, `parseTasa`,
  `parsePorcentaje` y `parseMedida`; `interpretarLiteral` para el analizador de expresiones. El modo es obligatorio y
  uno desconocido lanza un error. Decimales máximos: dinero 2, tasa 8, porcentaje 2 (0 a 100), medida 4, y cada
  campo puede declarar los suyos.
  - Dinero: un separador único con tres cifras (`1.234`, `1,234`, `10,000`) se rechaza con `pedirAclarar`.
    `12.5` y `12.50` se aceptan (6 A).
  - Tasa: `36,500` = 36,5; `36.500` se pide aclarar; el noveno decimal se rechaza.
  - Medida: punto o coma decimal (2 A).
  - `1,234.50` y `1,234,567` se rechazan en todos los modos.
- `lib/studio/util/parse-numeric-expression.ts`: recibe el modo y reutiliza `interpretarLiteral` en cada operando.
  Un resultado con más decimales que el campo se rechaza, y un porcentaje fuera de 0 a 100 también.
- `NumericInput`: prop `modo` (con `type="decimal"` el compilador la exige) y `decimales`. El eco sale en `es-VE`
  («= 1.234,50»); la tasa, con 2 a 4 decimales (5 B); la medida muestra todos los decimales que se teclearon.
  Al confirmar, el campo deja la coma decimal sin miles. **Un texto rechazado emite `null` y vacía el hidden**, para
  que `1.23` → `1.234` no deje vivo 1,23. El eco ya no es región viva (ERR-01).
- Adopción del modo: 13 campos `type="decimal"` y los de `ParametrosPanel`. CBM del embarque con `decimales={3}`
  (regla de la RPC) y ft³ de la tarifa con `decimales={4}`.
- Fase 2: los conversores pasan a `parseNumero`: el reporte de pago del Portal, la tasa de cambio (servidor y
  pantalla, con mensaje en el campo), el monto cotizado, el descuento y el $/CBM del aliado, el reclamo al
  proveedor, el congelado de tarifa, las tarifas de transportistas (ft³ con 4) y las medidas de la cotización.
- NUM-01 v1.2, README de gobernanza, `numeric-input.json` y registros generados.

## Validación (con el turno de PC de Dir_DTD, 2026-11-23)

- Merge de origin/main con regeneración de los dos generados: PASÓ.
- `pnpm install --frozen-lockfile`: PASÓ.
- tsc: PASÓ (el único error era `TruckDrawer`, nuevo en main; ya declara modo).
- eslint de los archivos tocados: PASÓ.
- vitest de 144 archivos afectados: PASÓ (2.218 pruebas).
- Mutantes (9 de 9 rompen pruebas): `1.250` como 1,25; `1,234.50`; `1,234` y `10,000`; `36.500` en tasa;
  redondeo en silencio; ambigüedad relajada; medida rechaza `1.234`; el rechazo no vacía el valor; el Portal
  vuelve a `replace`.
- `governance:check` y `components:check`: PASÓ.
- `pnpm verify` completo y prueba manual de §8: NO EJECUTADOS.

**PR:** #790 · carril: revisión previa.

## Pendientes de esta tarea

- Revisión independiente específica de cifras (la lanza Dir_DTD) y CI verde sobre la cabeza exacta.
- Prueba manual de §8 en la imagen de prueba.
- Confirmar con Sam la línea de aprobación de NUM-01 v1.2 en la PR.

## Conversores que NO se tocaron (motivo)

- `lib/public/estimado-web.ts`, `lib/studio/prealertas/packlist-form.ts`: reciben números ya calculados por el
  cliente; se revisan con la fase 6.
- `lib/studio/medidas-embarque.ts` (`leerNumero`): también lo usa `admin/ia` (SDD-0704, fuera de alcance §5.2).
- `lib/studio/ia/pantalla.ts`, `lib/studio/oficina/despachador-config.ts`: son de otras sesiones.
- `lib/studio/global-search/classify.ts`: es una búsqueda y no guarda nada; queda para el contrato de entrada.
- `lib/calculadora.ts`, `components/document-import/DocumentEditor.tsx`, `lib/shared/document-import.ts`,
  `app/p/[token]/PackingListFormSection.tsx`: son de la fase 6.
- Lectores de terceros (`bcv-parser`, `statement-parser`, `document-import/extract`): son excepción en la spec.
- `scripts/`: no son entrada de personas.

## FUERA DE ALCANCE DETECTADO

- `ShipmentDataPanel` usa `noValidate`: con un texto rechazado envía el campo vacío en lugar de bloquear.
  Conviene quitar `noValidate` o validar antes de enviar, en su propia tarea.
- La #778 (SDD-0688) también toca `docs/governance/README.md` y la cápsula: el segundo en fusionar regenera.

## Impacto documental

NUM-01 sube a v1.2 (§4.1 de la spec). La enmienda de la spec con la allowlist exacta queda para cuando la #769 esté
en `main`; mientras tanto vive en el cuerpo de la PR.
