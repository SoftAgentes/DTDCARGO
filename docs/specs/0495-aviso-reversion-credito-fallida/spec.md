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

5. **«La reversión falló» no es un solo caso: hay uno parcial, y ya existe.**
   `revertReferralCreditsForInvoice` recorre los créditos de la factura de a
   uno: suma a `reverted` los que salen bien y junta el resto en `failures`, y
   sólo al final decide `ok`. Con **dos créditos en la misma factura**, uno
   liberado y otro no, devuelve `ok: false` con `reverted > 0`. No hay que
   esperar a que la reversión se mude a SQL: es alcanzable hoy.

   Decir «el crédito no se pudo liberar» en ese caso es **falso**, y manda a
   alguien a arreglar algo que en parte ya está bien. La premisa la aportó el
   Director el 2026-09-20, traída de la sesión que está moviendo la reversión a
   SQL; se verificó contra el código actual antes de tomarla.

6. **Un módulo `"use server"` sólo puede exportar funciones async.** El texto
   del aviso lo necesitan los dos lados (la action que lo devuelve y el banner
   que lo pinta), así que no puede ser un `export const` dentro de `actions.ts`:
   rompe el build de Next, y **no lo ven `typecheck` ni `eslint`**: sale sólo en
   el `build` que corre dentro de `verify`. Medido sobre el repo entero: hay
   **116** `actions.ts` con `"use server"`, y **los 116** exportan únicamente
   `async function`, `type` o `interface` —las dos últimas se borran al
   compilar—. **Cero** `export const`, `let`, `var`, `function` no-async o
   `class` en todo el conjunto. Por eso el copy vive en un módulo neutro, que
   además deja que el banner lo importe sin importar la action.

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

6. **Hay DOS avisos, y los elige `reverted`, no `error`.** Por la premisa 5:
   `reverted === 0` ⇒ «el crédito no se pudo liberar»; `reverted > 0` ⇒ «parte
   se liberó, pero no todos», que además remite al listado durable de la misma
   factura, donde están exactamente cuáles quedaron. El título del banner sigue
   al cuerpo, anclado en la constante y no en comparar el texto.

   **Los avisos durables no necesitan la distinción**: derivan del estado y
   listan sólo los que quedaron varados, así que no pueden mentir por más
   créditos que haya. Es otra razón por la que el durable es la mitad que
   importa.

7. **No se agrega ninguna server action.** Las dos superficies son lecturas de
   páginas que ya existen, así que el candado que les toca es el
   `requireModuleView` que esas páginas ya tienen. Se verificó que exista en
   ambas (ver Gobernanza). Una action nueva habría necesitado su propio
   `moduleViewDenial`/`moduleEditDenial`; no hay ninguna.

## Alcance

### Qué cambia

1. **`voidInvoice` informa** (`app/studio/(app)/facturacion/actions.ts`). El
   tipo de retorno suma `warning?: string`, elegido con
   `voidReferralRevertWarning(revert.reverted)`. En el fallo se revalida además
   `/studio/fidelizacion`, porque su pantalla pasa a tener algo que mostrar.

2. **El copy vive aparte**
   (`lib/studio/fidelizacion/referral-revert-notice.ts`, nuevo): los dos textos,
   los dos títulos y los dos selectores. Por la premisa 6 no puede estar en el
   módulo `"use server"`, y así el banner lo importa sin importar la action.

3. **Aviso inmediato** (`InvoiceDetailClient.tsx`). Estado `voidWarning` y banner
   `--warning` con `role="alert"`, calcado del banner `legalAck` que ya vive en
   ese archivo (SDD-0054). No pasa por `setError`: la anulación no falló.

4. **Aviso durable en la factura anulada** (`facturacion/[code]/page.tsx`).
   Server component: si la factura está `anulada`, lista sus créditos varados.
   Se deriva en cada carga, así que no se desvanece y no depende de que alguien
   estuviera mirando.

5. **Aviso durable en Fidelización** (`fidelizacion/page.tsx` +
   `FidelizacionClient.tsx`). Banner **arriba de los tabs**, no dentro de
   «Referidos»: el aviso tiene que encontrarse sin buscarlo, y quien abre
   Fidelización para otra cosa es exactamente quien hoy no se entera.

6. **Dos queries nuevas** (`lib/studio/fidelizacion/referral-credit-queries.ts`):
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
  retorno y el import del copy)
- `lib/studio/fidelizacion/referral-revert-notice.ts` (nuevo)
- `lib/studio/fidelizacion/__tests__/referral-revert-notice.test.ts` (nuevo)
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
3. **`voidInvoice` con la reversión a medias** (`ok: false`, `reverted > 0`):
   el aviso es el PARCIAL y **no** el total; dice que parte se liberó y que el
   resto se lista en la factura; sigue siendo anulación exitosa; tampoco filtra
   el error crudo. Y el copy en sí: el selector cambia en `reverted > 0` (no en
   `> 1`), el título sigue al cuerpo, y los cuatro textos pasan el control de
   voseo —normalizado a NFC, para que el patrón pueda fallar de verdad— y el de
   jerga técnica.
4. **Lo que se rechaza antes** (sin permiso, motivo corto, factura pagada, RPC
   en error, RPC sin cambios) no llega a pedir la reversión.
5. **`strandedReferralCredits`** lista el `aplicado` sobre una factura
   `anulada`, y deja afuera: el que está sobre una factura viva, el ya liberado
   sobre la misma factura anulada, el borrado, y el que no tiene factura. Dos
   créditos sobre la misma factura salen los dos. Coacciona `reward_usd` string.
6. **La proyección de Fidelización no lleva factura**: ni el código ni el id
   cruzan; de `invoices` sólo se pide `id`.
7. **`strandedCreditsForInvoice`** no lee ni devuelve referidor ni referido, e
   ignora liberados y borrados.
8. **Lectura truncada**: devuelve `complete: false` en vez de presentar un
   conteo parcial como total, y la pantalla dice «Al menos N». La segunda
   lectura no puede truncar, y esa premisa —que vive en otro módulo— se afirma
   en vez de guardarse con una condición inalcanzable.
9. **Mutantes**: cada filtro, la agrupación y la proyección, quitados de a uno,
   hacen fallar su prueba. Incluido el mutante que reintroduce el defecto
   original (`return { ok: true }`).
10. `pnpm verify` como cierre canónico.

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
- **Pruebas nuevas (vitest)** — 55 de 55 ✓: 18 de `voidInvoice`, 17 de las
  queries, 20 del copy. Vecindario completo (19 archivos de fidelización,
  contabilidad y facturación): 236 de 236 ✓.
- **Mutantes — 19 de 19 caen. Sin sobrevivientes.** Cada uno en su prueba, con
  los fuentes restituidos después de cada corrida y el árbol comprobado limpio
  al final:

  | Mutante | Lo que se quita | Resultado |
  |---|---|---|
  | M1 | `voidInvoice` vuelve a `return { ok: true }` (el defecto original) | MUERTO |
  | M2 | la revalidación de Fidelización en el fallo | MUERTO |
  | M3 | el filtro `status = 'aplicado'` (tenant) | MUERTO |
  | M4 | el filtro `deleted_at is null` | MUERTO |
  | M5 | la exigencia de que la factura esté `anulada` | MUERTO |
  | M6 | la agrupación deja de devolver dos créditos de una misma factura | MUERTO |
  | M7 | la proyección de Fidelización filtra el id de factura | MUERTO |
  | M8 | `strandedCreditsForInvoice` deja de filtrar los ya liberados | MUERTO |
  | M9 | el `select` de `strandedCreditsForInvoice` se ensancha | MUERTO |
  | M10 | se pierde el `complete` de la primera lectura | MUERTO |
  | M11 | `voidInvoice` ignora `reverted` y manda siempre el aviso total | MUERTO |
  | M12 | el selector apaga la distinción parcial/total | MUERTO |
  | M13 | el corte se corre a `reverted > 1` (con 1 liberado, miente) | MUERTO |
  | M14 | el título deja de seguir al cuerpo | MUERTO |
  | M15 | el copy se escribe en voseo (`coordinálo`) | MUERTO |
  | M16 | el copy filtra el nombre de una tabla | MUERTO |
  | M17 | el copy deja de decir que no se arregla desde la pantalla | MUERTO |
  | M18 | un voseo (`revisá`) que la aserción positiva NO vería | MUERTO |
  | M19 | (módulo ajeno, restituido) `IDS_POR_LOTE` sube por encima de `PAGE_SIZE` | MUERTO |

- **El `&& voidedComplete` que antes sobrevivía era código muerto, y se quitó.**
  En la primera versión se conservaba «por si acaso» y ningún caso podía hacerlo
  valer: `fetchAllByIds` parte los ids en lotes de `IDS_POR_LOTE` (500) y pagina
  de a `PAGE_SIZE` (1.000), así que un lote **nunca llena una página** y la
  segunda lectura no puede quedarse corta. Tampoco lo distinguía un fixture:
  `opts` va a las dos lecturas y la de facturas nunca tiene más filas que la de
  referidos, de modo que si truncara la segunda ya truncó la primera.

  Lo que sí era real es que esa premisa **vive en otro módulo**. Así que en vez
  de una guarda que nadie puede ejercitar, la premisa quedó **afirmada**:
  `expect(IDS_POR_LOTE).toBeLessThanOrEqual(PAGE_SIZE)`. M19 la mutila en
  `lib/db/paginate.ts` y la prueba se pone roja, apuntando al sitio donde habría
  que volver a propagar el `complete`. Una invariante que falla vale más que un
  `&&` que no.

- **El control de voseo está probado vivo.** El patrón tenía dos formas de
  quedar muerto en silencio —sin fallar: dejando de encontrar—: escrito en NFD
  contra texto normalizado a NFC, y con `\b` después de vocal acentuada, que
  nunca matchea porque `\b` es frontera ASCII y `á` no es carácter de palabra.
  Las dos estaban en la primera versión. Ahora el patrón se prueba contra una
  frase de control, y M18 mete un voseo que la aserción positiva
  (`toContain("coordínalo")`) no vería: si el patrón vuelve a morir, M18
  sobrevive y se nota.

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
   Exige migración. **Ya está asignada a otra sesión**, que conserva el nombre y
   la forma `{ ok, reverted, error? }` y sólo cambia la firma a
   `(supabase, tenantId, invoiceId, referralId?)` porque su RPC es INVOKER. El
   punto de instrumentación de esta SDD no se mueve, y el aviso parcial ya está
   diseñado para el contrato que viene. Detalle en el handoff.
3. **Promover un `AdvisoryBanner` canónico** al registro de componentes. Hoy el
   patrón de banner de aviso está copiado en varios módulos; una promoción CMP no
   la aprueba un script.
4. **`listReferrals` lee con `.limit(500)` sin paginar** (`queries.ts:171`), así
   que la pestaña «Referidos» y `programStats` pueden estar truncando en silencio
   —justo lo que `lib/db/paginate.ts` describe—. No se tocó: está fuera de la
   allowlist y cambia KPIs. El aviso de esta SDD **no** hereda el problema: usa
   su propia lectura paginada.
