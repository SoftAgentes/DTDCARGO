---
sdd: "0495"
title: "Una reversión de crédito que falla deja de ser invisible"
status: in-progress
author: "Sam + Claude Opus 5 (Worker)"
created: 2026-09-20
updated: 2026-09-20
supersedes: null
superseded_by: null
related: ["0051", "0085", "0137", "0159", "0465", "0490"]
confidencialidad: interno
---

# SDD-0495 — Una reversión de crédito que falla deja de ser invisible

## Contexto

Es el punto 2 del «Fuera de alcance detectado» de la
[SDD-0490](../0490-reversion-credito-referido/spec.md). Sam lo autorizó el
2026-09-20. El número se reservó en local con `sdd:next --reserve`.

Al anular una factura, `voidInvoice` manda a revertir los créditos de referido
que tenía aplicados (SDD-0137 §3.6): el crédito vuelve a `acreditado`, se baja el
abono no-monetario de la factura y se anula el asiento. Es **best-effort a
propósito**: si falla, la anulación no se deshace.

El defecto no era la reversión: era lo que pasaba cuando fallaba.

```ts
// app/studio/(app)/facturacion/actions.ts — antes
if (!revert.ok) {
  console.error(`[fidelizacion] no se pudieron revertir créditos …`, revert.error);
} else if (revert.reverted > 0) {
  revalidatePath("/studio/fidelizacion");
}
// …
return { ok: true };
```

Un `console.error` y un `{ ok: true }`. Quien anulaba la factura veía un éxito
limpio. El crédito quedaba `aplicado` colgando de una factura anulada: para el
sistema, consumido; para el referido, perdido; para el Studio, invisible. Y no
hay vuelta atrás por la UI —`voidInvoice` no se repite sobre una factura ya
anulada—, así que el aviso llega en el único momento en que alguien puede hacer
algo: cuando todavía se acuerda de qué anuló.

`revertReferralCreditsForInvoice` ya devolvía `{ ok, reverted, error? }`
(`lib/studio/accounting/referral-credit-posting.ts`), así que la información
estaba disponible justo donde se descartaba.

### Premisas medidas (2026-09-20)

1. **El estado inconsistente es consultable, así que esta SDD no lleva
   migración.** Es literalmente «una fila de `referrals` con `status =
   'aplicado'`, `deleted_at is null`, cuyo `applied_invoice_id` apunta a una
   factura con `status = 'anulada'`». Derivarlo en cada carga, en vez de
   persistir una bandera, tiene tres ventajas medibles: no hay segunda verdad
   que se desincronice, no hay que escribir nada justo cuando algo ya está
   fallando, y **alcanza a los casos anteriores a este cambio**, que una columna
   nueva no vería.

2. **Las dos lecturas caen sobre índices que ya existen**: `referrals
   (tenant_id, status) where deleted_at is null` (migr 0098) y `referrals
   (applied_invoice_id)` (migr 0237).

3. **La RLS de `referrals` es sólo por tenant, sin condición de rol** — `using
   (tenant_id = public.get_user_tenant_id() and deleted_at is null)`, migr 0098,
   única policy sobre la tabla en todo `supabase/migrations/`. Es decir: el
   candado real de quién ve esto es el gate de módulo de la aplicación, no la
   base. Por eso la decisión de abajo se toma con la matriz de `rbac.ts` en la
   mano.

4. **Los dos roles que necesitan enterarse NO se solapan.** En
   `lib/studio/rbac.ts`: `invoices: ["accounting"]` y `fidelizacion:
   ["commercial", "support"]` (más `admin`, que siempre ve todo). O sea:

   - quien anula la factura (`accounting`) **no puede abrir Fidelización**;
   - quien lleva el programa de referidos (`commercial`/`support`) **no puede
     abrir la factura**.

   Esto es lo que decide la pregunta «¿dónde se muestra?». Una sola pantalla deja
   ciego a un rol, y el rol que queda ciego cambia según cuál se elija.

## Decisiones

1. **La anulación sigue siendo exitosa.** La reversión no la bloquea. Eso es
   diseño de la SDD-0137 §3.6 y no se toca: una factura mal emitida tiene que
   poder anularse aunque el subsistema de referidos esté teniendo un mal día.

2. **El aviso viaja con el `ok`, no en lugar del `ok`.** `voidInvoice` devuelve
   `{ ok: true, warning }`. No es un `error`: la pantalla no lo pinta rojo ni
   cancela el toast de «Factura anulada».

3. **Se muestra en las DOS pantallas, por la premisa 4.** No es redundancia: es
   que cada mitad es la única que su rol puede abrir.

4. **Cada mitad proyecta sólo lo que su rol ya maneja.** El handle común es el
   `referral_code`, que es lo que los dos lados necesitan para nombrar el mismo
   caso cuando se hablen:

   | Pantalla | Rol | Muestra | **No** muestra |
   |---|---|---|---|
   | Factura anulada | `accounting` (+admin) | `referral_code`, monto | referidor, referido |
   | Fidelización | `commercial`/`support` (+admin) | `referral_code`, referidor, referido, monto | **código e id de factura** |

   El código de factura es dato del módulo de dinero: `listApplicableInvoices`
   ya lo gatea con `moduleEditDenial(supabase, "accounting")` aunque viva en
   Fidelización. La query de Fidelización lo necesita para decidir, pero no lo
   devuelve — no es que la pantalla lo descarte: **no cruza el tipo**.

5. **El aviso no lleva el texto crudo del error.** Quien anula facturas no
   depura PostgREST. El detalle técnico sigue yendo al `console.error`.

6. **No se agrega ninguna server action.** Las dos superficies son lecturas de
   páginas que ya existen, así que el candado que les toca es el
   `requireModuleView` que esas páginas ya tienen. Se verificó que exista en
   ambas (ver Gobernanza). Una action nueva habría necesitado su propio
   `moduleViewDenial`/`moduleEditDenial`; no hay ninguna.

## Alcance

### Qué cambia

1. **`voidInvoice` informa** (`app/studio/(app)/facturacion/actions.ts`). El
   tipo de retorno suma `warning?: string`; la constante exportada
   `VOID_REFERRAL_REVERT_WARNING` es el texto único. En el fallo se revalida
   además `/studio/fidelizacion`, porque su pantalla pasa a tener algo que
   mostrar.

2. **Aviso inmediato** (`InvoiceDetailClient.tsx`). Estado `voidWarning` y banner
   `--warning` con `role="alert"`, calcado del banner `legalAck` que ya vive en
   ese archivo (SDD-0054). No pasa por `setError`: la anulación no falló.

3. **Aviso durable en la factura anulada** (`facturacion/[code]/page.tsx`).
   Server component: si la factura está `anulada`, lista sus créditos varados.
   Se deriva en cada carga, así que no se desvanece y no depende de que alguien
   estuviera mirando.

4. **Aviso durable en Fidelización** (`fidelizacion/page.tsx` +
   `FidelizacionClient.tsx`). Banner **arriba de los tabs**, no dentro de
   «Referidos»: el aviso tiene que encontrarse sin buscarlo, y quien abre
   Fidelización para otra cosa es exactamente quien hoy no se entera.

5. **Dos queries nuevas** (`lib/studio/fidelizacion/referral-credit-queries.ts`):
   `strandedReferralCredits` (tenant, para Fidelización) y
   `strandedCreditsForInvoice` (una factura, para Facturación).

### Qué no cambia

- La reversión misma (`referral-credit-posting.ts`): ni su lógica, ni sus
  reintentos, ni su compensación. Sigue siendo best-effort.
- El gate de `voidInvoice` (`moduleEditDenial(supabase, "invoices")`).
- El estado de los datos: **esta SDD no escribe nada**. Lee y muestra.
- No hay migración, y no se escribe en producción.

### Por qué no hace falta migración (y qué se haría si hiciera falta)

Por la premisa 1. Si en la revisión se concluyera lo contrario, la migración
quedaría **declarada como espera en `supabase/migrations-baseline.json ›
pendingBelowCutoff`** y sin aplicar, porque el OK nominal lo da Sam. No fue el
caso: no se agregó ninguna entrada.

### Allowlist exacta

- `app/studio/(app)/facturacion/actions.ts` (sólo `voidInvoice`, su tipo de
  retorno y la constante del aviso)
- `app/studio/(app)/facturacion/_components/InvoiceDetailClient.tsx` (sólo el
  estado `voidWarning`, su banner y el `onConfirm` de anular)
- `app/studio/(app)/facturacion/[code]/page.tsx` (sólo la lectura condicionada a
  `anulada` y el `StrandedCreditsNotice`)
- `app/studio/(app)/fidelizacion/page.tsx` (sólo la lectura y las dos props)
- `app/studio/(app)/fidelizacion/_components/FidelizacionClient.tsx` (sólo las
  dos props y el `StrandedCreditsBanner`)
- `lib/studio/fidelizacion/referral-credit-queries.ts` (sólo las dos queries
  nuevas, sus tipos y el import de `paginate`)
- `app/studio/(app)/facturacion/__tests__/void-invoice-referral-warning.test.ts`
  (nuevo)
- `lib/studio/fidelizacion/__tests__/stranded-referral-credits.test.ts` (nuevo)
- `docs/specs/0495-aviso-reversion-credito-fallida/spec.md` y
  `docs/specs/README.md` (regenerado)
- `.agents/handoffs/0495-aviso-reversion-credito-fallida.md`

## Aceptación

1. **`voidInvoice` con la reversión fallando**: devuelve `ok: true` **y**
   `warning`; la RPC de anulación corrió igual; el aviso no contiene el texto
   crudo del error ni jerga técnica; el detalle sigue en el log con el código de
   factura; se revalidan las tres rutas, Fidelización incluida.
2. **`voidInvoice` con la reversión OK**: `{ ok: true }` pelado, sin `warning`.
   Sin créditos que revertir, tampoco revalida Fidelización.
3. **Lo que se rechaza antes** (sin permiso, motivo corto, factura pagada, RPC
   en error, RPC sin cambios) no llega a pedir la reversión.
4. **`strandedReferralCredits`** lista el `aplicado` sobre una factura
   `anulada`, y deja afuera: el que está sobre una factura viva, el ya liberado
   sobre la misma factura anulada, el borrado, y el que no tiene factura. Dos
   créditos sobre la misma factura salen los dos. Coacciona `reward_usd` string.
5. **La proyección de Fidelización no lleva factura**: ni el código ni el id
   cruzan; de `invoices` sólo se pide `id`.
6. **`strandedCreditsForInvoice`** no lee ni devuelve referidor ni referido, e
   ignora liberados y borrados.
7. **Lectura truncada**: devuelve `complete: false` en vez de presentar un
   conteo parcial como total, y la pantalla dice «Al menos N».
8. **Mutantes**: cada filtro, la agrupación y la proyección, quitados de a uno,
   hacen fallar su prueba. Incluido el mutante que reintroduce el defecto
   original (`return { ok: true }`).
9. `pnpm verify` como cierre canónico.

## Gobernanza

| Política | Clasificación | Evidencia |
|---|---|---|
| SGE-00.05 (permisos y tenant en el servidor) | **cumplimiento** | No hay action nueva. Las dos lecturas viven en server components ya gateados: `app/studio/(app)/facturacion/layout.tsx` hace `requireModuleView("invoices")` y cubre `[code]`; `app/studio/(app)/fidelizacion/page.tsx` hace `requireModuleView("fidelizacion")`. RLS por tenant en ambas tablas. |
| SGE-00.05 (mínimo privilegio en la proyección) | **cumplimiento** | La query de Fidelización no devuelve código ni id de factura, y de `invoices` sólo pide `id`; la de Facturación no devuelve referidor ni referido y sólo pide `id, referral_code, reward_usd`. Las dos proyecciones tienen prueba, incluido el `select`. |
| SGE-00.06 (prevenir antes de informar) | **excepción justificada** | Acá informar ES el alcance: prevenir de verdad exige llevar aplicación y reversión a una función SQL con la factura `FOR UPDATE` — punto 1 del «Fuera de alcance» de la 0490, que necesita migración y decisión de Sam. La prevención disponible (los reintentos de `REVERT_PAID_MAX_ATTEMPTS`) ya está y no se toca. |
| ERR-01 (lenguaje del error) | **cumplimiento** | Tuteo venezolano, sin voseo. Dice qué pasó, a quién le duele y qué hacer, incluido que no se arregla desde ahí. Sin texto crudo del error. Probado por aserción, no por lectura. |
| AUD-01 / AUD-02 (auditoría) | **no aplica** | La SDD no muta nada: no hay mutación nueva que auditar. La anulación sigue pasando por `void_invoice_with_audit_reason` sin cambios. |
| MP-01 (permanencia) | **no aplica** | No se borra ni se oculta nada; el aviso hace MÁS visible un rastro que ya existía. |
| A11Y-01 | **cumplimiento** | Los tres banners son `role="alert"`; texto real, no sólo color; tokens `--warning`/`--warning-bg` sobre `--ink`/`--ink-soft`. |
| BTN-01 / SGE-00.07 (botones) | **no aplica** | No se agregan botones ni acciones. Los banners son informativos. |
| LOD-01 / PRG-01 | **no aplica** | Los avisos durables son server-rendered con la página; el inmediato sale de una action que ya tenía su `pending`. |
| VIS-01 / VIS-02 | **cumplimiento** | Sólo tokens `var(--*)`; cero rgba inline. El banner inmediato calca el `legalAck` del mismo archivo. |
| CMP-01 (componentes) | **cumplimiento** | El registro generado no tiene primitiva canónica de banner (sólo `action-menu`, `confirm-dialog`, `numeric-input`, `segmented-control`; el único `deprecated` es `llm-mode-toggle`, que no se toca). Se sigue el patrón local ya existente. Promover un `AdvisoryBanner` compartido es una promoción CMP: decisión aparte, anotada en Fuera de alcance. |
| Aplicación y reversión sin transacción común | **no conformidad preexistente** | Heredada de la 0490. Esta SDD no la cierra: la hace visible cuando se materializa. |

## Evidencia

Corridas en el worktree `keen-swirles-62b904`, 2026-09-20.

- **`pnpm typecheck`** — PASÓ (exit 0).
- **`pnpm lint`** — PASÓ (exit 0): 0 errores, 15 warnings, todos preexistentes
  en archivos fuera de la allowlist (`components/document-import/*`,
  `scripts/lib/knowledge-vault.mjs`).
- **Pruebas nuevas (vitest)** — 30 de 30 ✓: 14 de `voidInvoice`, 16 de las
  queries.
- **Mutantes** — 9 de 10 caen, cada uno en su prueba, con los fuentes
  restituidos después de cada corrida:

  | Mutante | Lo que se quita | Resultado |
  |---|---|---|
  | M1 | `voidInvoice` vuelve a `return { ok: true }` (el defecto original) | MUERTO |
  | M2 | la revalidación de Fidelización en el fallo | MUERTO |
  | M3 | el filtro `status = 'aplicado'` (tenant) | MUERTO |
  | M4 | el filtro `deleted_at is null` | MUERTO |
  | M5 | la exigencia de que la factura esté `anulada` | MUERTO |
  | M6 | `&& voidedComplete` | **VIVO** — ver abajo |
  | M7 | la agrupación deja de devolver dos créditos de una misma factura | MUERTO |
  | M8 | la proyección de Fidelización filtra el id de factura | MUERTO |
  | M9 | `strandedCreditsForInvoice` deja de filtrar los ya liberados | MUERTO |
  | M10 | el `select` de `strandedCreditsForInvoice` se ensancha | MUERTO |

- **M6 sobrevive, y es el código el que sobra, no la prueba la que falta.**
  `fetchAllByIds` parte los ids en lotes de 500 y pagina cada lote de a 1.000
  filas: un lote de ≤500 ids no puede devolver más de 500 filas, así que la
  segunda lectura **no puede** quedarse corta. Y ningún fixture lo distingue:
  `opts` va a las dos lecturas y la de facturas nunca tiene más filas que la de
  referidos, de modo que si truncara la segunda ya truncó la primera. Se
  **conserva** igualmente porque `fetchAllByIds` devuelve el campo y tirarlo al
  piso es el error que `lib/db/paginate.ts` describe en su cabecera; queda
  anotado en el código y acá para que el próximo lector no lo re-derive.

- **`pnpm verify`** — ver el handoff: se corre en el turno de máquina del
  Director (una sola corrida pesada a la vez).

## Fuera de alcance detectado

1. **Reintentar la reversión desde la UI.** Hoy no hay camino: `voidInvoice` no
   se repite sobre una factura ya anulada, y `updateReferralStatus` no sirve
   —mueve el estado pero deja `applied_invoice_id`, `applied_entry_id`,
   `applied_at`, el `paid_amount` inflado y el asiento vivo, o sea que dejaría el
   dato **peor**. Un botón «reintentar liberación» es una acción que mueve plata:
   necesita gate de `accounting`, su propia SDD y decisión de Sam.
2. **La no conformidad de fondo**: llevar aplicación y reversión a funciones SQL
   con la factura `FOR UPDATE` (punto 1 del «Fuera de alcance» de la 0490).
   Exige migración.
3. **Promover un `AdvisoryBanner` canónico** al registro de componentes. Hoy el
   patrón de banner de aviso está copiado en varios módulos; una promoción CMP no
   la aprueba un script.
4. **`listReferrals` lee con `.limit(500)` sin paginar** (`queries.ts:171`), así
   que la pestaña «Referidos» y `programStats` pueden estar truncando en silencio
   —justo lo que `lib/db/paginate.ts` describe—. No se tocó: está fuera de la
   allowlist y cambia KPIs. El aviso de esta SDD **no** hereda el problema: usa
   su propia lectura paginada.
