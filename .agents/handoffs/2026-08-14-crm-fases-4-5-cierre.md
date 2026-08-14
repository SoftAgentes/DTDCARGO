# SDD-0256 · Fases 4 y 5 — cierre

**Rama:** `feat/sdd-0256-crm-fases-4-5` · **Worktree:**
`DTD-worktrees/crm-fase45` · desde `origin/main@d892be50`.

Todo lo de acá se **midió**. Donde dice un número, hay una consulta o una corrida
detrás; donde no se pudo medir, lo dice explícitamente en vez de omitirlo.

---

## 1. Qué quedó hecho

### Bloque A — cerrar la Fase 4

**A1 · Chequeo optimista** — `kommo_updated_at_at_enqueue` existía desde la 0136
y se guardaba sin que nadie la leyera.

| Pieza | Dónde |
|---|---|
| La comparación (pura) | `supabase/functions/_shared/kommo-writeback-plan.ts:141` (`evaluarChequeoOptimista`) |
| El I/O del drenaje | `supabase/functions/kommo-writeback/index.ts:189` |
| El eco + `skip_code` | `supabase/migrations/0373_kommo_writeback_chequeo_optimista.sql` |
| Lectura para la UI | `lib/studio/kommo-writeback.ts:637` (`getStaleOpsByLead`) |
| El aviso en pantalla | `app/studio/(app)/crm/_components/LeadDrawer.tsx:257` (`AvisoFrenado`) |
| Reintentar | `app/studio/(app)/crm/actions.ts:604` (`retryStaleWritebackAction`) |
| Contrato SQL | `supabase/tests/0373_kommo_writeback_chequeo_optimista.test.sql` |

⭐ **El eco es la parte que no estaba en el pedido y sin la cual el chequeo se
rompe solo.** El snapshot sale del espejo, que se llena por webhook. Cuando el
ERP escribe, Kommo sube el `updated_at`; si el asesor hace dos cosas seguidas
sobre el mismo lead —mover de etapa y después etiquetar— y el webhook de la
primera no volvió, la segunda se saltearía **por un cambio propio**. El drenaje
registra en `kommo_writeback_echo` el `updated_at` que deja cada escritura suya y
el chequeo se lo descuenta. Esa tabla **no es el espejo**: no dice qué es el
lead, dice qué le escribimos nosotros — guardrail 0107 intacto, y hay un test que
falla si alguien mete `kommo_leads` ahí adentro.

Fail-open a propósito en todo lo que no se puede afirmar (sin snapshot, sin
lectura viva, fecha ilegible → se manda). Negar por falta de datos convertiría
cada hipo de red en un verbo que no hace nada.

**A2 · Reasignar asesor** y **A3 · Etiquetas** — los dos tenían servidor completo
y cero superficie desde agosto. Ahora viven en el drawer:
`_components/LeadDrawer.tsx`, abierto desde `_components/LeadActionsButton.tsx`.

- Patrón `DrawerShell`: `<form id="crm-lead-verbo">` en el cuerpo,
  `<button type="submit" form="…">` en el footer. **Sin `requestSubmit()`** —
  medido en vivo: `submitApuntaAlForm: "crm-lead-verbo"`.
- `canEdit` sale de `moduleEditDenial(supabase, "kommo")` en `page.tsx:76` — el
  MISMO predicado que aplica la acción, nunca una regla propia por rol. Hay un
  test que falla si aparece un `role === "admin"` en el componente.
- Etiquetas: `tags_to_add`/`tags_to_delete`, incrementales. Nunca se reemplaza
  `_embedded.tags`.

**A4 · Ver el Tablero** — ver §4: **no pude autenticarme**, pero sí medí los
componentes reales. Capturas entregadas.

### Bloque B — Fase 5

| # | Qué | Dónde |
|---|---|---|
| B1 | `resolveRequest(row) → {path, method, envolverEnArray}` | `_shared/kommo-writeback-plan.ts:58` |
| B2 | Token de idempotencia para POST | `0374_kommo_outbox_post_idempotente.sql` |
| B3 | `add_note` + `add_task` | `actions.ts:498`, `actions.ts:534`; payloads en `lib/studio/kommo-writeback.ts:97` |
| B4 | Estado comercial al contacto | `lib/studio/kommo-contact-status.ts`, `app/api/cron/kommo-contact-status/route.ts`, `0375_…sql` |

**B1** — el método se **deriva de la op**, sin columna `http_method`: así el par
incoherente `(add_note, PATCH)` no se puede ni representar.

**B2** — el token lo genera el drawer al abrirse y **se quema tras cada envío
exitoso**: doble clic = mismo token = una nota; dos notas seguidas = dos tokens =
dos notas.

⚠️ **Una parte del pedido la hice distinto y hay que decirlo.** El pedido era
"arregla el índice parcial: con la fila en `processing` la dedup desaparece".
Para POST lo arreglé (índice del token **sin filtro de status**: un token vale
para siempre, si no un re-submit tardío crearía una segunda nota). **Para PATCH
lo dejé como estaba, a propósito**: extenderlo a `processing` sería un retroceso
—el drenaje ya leyó el payload, fusionar encima descartaría la orden nueva y la
fila saldría `sent` con el valor viejo, que es la pérdida silenciosa que cerró la
0364—. Hoy se abre una fila nueva y Kommo termina en el estado que el asesor pidió
último; repetir un PATCH es inocuo. El hueco real de `processing` era el de POST.
Está razonado en la cabecera de la 0374 y en la spec §5.

**B3** — `complete_till` en epoch de **segundos**. Hay un test que cuenta los
dígitos (10, no 13): en milisegundos el vencimiento cae en el año 57.000, Kommo
lo acepta sin chistar y la tarjeta no se pone roja nunca — falla en la dirección
que nadie mira.

**El reaper falla cerrado: confirmado, no asumido.** Ya estaba probado en
`supabase/tests/0365_kommo_outbox_claim.test.sql:147`, pero **abriendo el CHECK a
mano** porque `add_note` no existía. Ahora existe: el contrato de la 0374 (§9) lo
mide con las ops reales (`add_note` y `add_task` → `error`; `patch_stage` →
`pending`).

### Bloque E — lo que sólo puedes hacer tú

**`docs/marketing/kommo-campos-y-cartera.md`** — los 5 campos comerciales con
nombre literal, tipo y opciones; los 2 campos de contacto de B4; y el reparto de
cartera con la lista concreta. `docs/marketing/checklist-kommo.md` remedido al
2026-08-14.

⭐ **Y ahí apareció algo que contradice el brief.** Se venía diciendo "2 asesores
de 5 tienen carga". Medido: hay **una cuenta genérica** (`DTD CARGO`, 45 de 50
leads), **dos cuentas tuyas duplicadas** (`Sam` con dos correos) y **dos accesos
que parecen externos** (`@solucionessq.com`, `ofidocxxi@gmail.com`). **No hay 5
asesores reales.** Repartir sobre esa lista sería mandarle cartera a cuentas que
quizá nadie usa. El documento pide dos decisiones tuyas antes de repartir.

Dato bueno: **ningún lead activo lleva más de 30 días sin moverse.**

---

## 2. La mutación que validó cada arreglo

18 mutaciones. Cada una se aplicó al código real, se corrió la suite y se
restauró. **Una salió verde y eso destapó un test que no discriminaba** — está
abajo.

### Módulo puro del drenaje (`kommo-writeback-plan.test.ts`, 21 tests)

| # | Mutación | Resultado |
|---|---|---|
| M1 | `resolveRequest` con `method: "PATCH"` fijo (el bug de `index.ts:166`) | 🔴 2 fallos |
| M2 | `esOpReintentable` → `true` siempre (default permisivo) | 🔴 3 fallos |
| M3 | `evaluarChequeoOptimista` → `{pisar:true}` al tope (= el comportamiento de HOY) | 🔴 2 fallos |
| M4 | Se borra la rama del eco | 🔴 1 fallo |
| M5 | `parseIsoASegundos` en milisegundos | 🔴 1 fallo |

### Contratos SQL

| # | Mutación | Resultado |
|---|---|---|
| M6 | 0373: se borra el `where` del upsert del eco | 🟢 **VERDE — no discriminó** |
| M6b | 0373: se borra el `greatest()` **y** el `where` | 🔴 `EL ECO RETROCEDIO a 2026-08-14 11:00` |
| M7 | 0373: no se dropea la firma vieja de `mark_..._skipped` | 🔴 `quedaron 2 versiones… seria ambigua` |
| M8 | 0374: el enqueue ignora el token (= la clave de hoy) | 🔴 `dos notas distintas debian dejar 2 filas, dejaron 1` |
| M9 | 0374: `record_error` no mira la op (= la 0365) | 🔴 `un POST fallido quedo en pending… Kommo terminaria con DOS notas` |
| M10 | 0374: el índice del token filtra por status | 🔴 `no unique or exclusion constraint matching` |
| M10b | 0374: índice **y** on-conflict filtran por status | 🔴 `con la nota YA ENVIADA, el mismo token creo otra fila` |

🔴 **M6 es el hallazgo de proceso de esta sesión.** Borré el `where` del upsert
del eco esperando rojo y salió **verde**. El motivo: el `greatest()` ya impide el
retroceso por sí solo, así que la mutación no cambiaba el comportamiento. Sin
haberla corrido habría reportado "el eco sólo avanza, validado" **sin haber
probado que el test lo mide**. Tuve que mutar el `greatest()` (M6b) para que
discriminara. Es exactamente la categoría "verificar un proxy en vez de la cosa",
metida dentro de la propia herramienta de verificación.

### UI y payloads

| # | Mutación | Resultado |
|---|---|---|
| M11 | Se quita `<LeadActionsButton` de `KommoBoardView` (el error de media milla, otra vez) | 🔴 1 fallo |
| M12 | `buildTaskPayload` en milisegundos | 🔴 2 fallos |
| M13 | `buildNotePayload` sin envolver en `params` | 🔴 1 fallo |
| M14 | El botón se pinta sin permiso de edición | 🔴 1 fallo |

### B4 (`kommo-contact-status.test.ts`, 17 tests)

| # | Mutación | Resultado |
|---|---|---|
| M15 | El `borrador` cuenta como deuda | 🔴 1 fallo |
| M16 | Lo `delivered` cuenta como tránsito | 🔴 1 fallo |
| M17 | Saldo sin redondear a centavos | 🔴 1 fallo (residuo de coma flotante) |
| M18 | Payload vacío en vez de `null` | 🔴 1 fallo |

---

## 3. Migraciones — **preparadas, esperando tu OK**

Ninguna aplicada. Autorizaste "preparadas, aplicar al final, de a una".

| Archivo | Qué hace | Riesgo |
|---|---|---|
| `0373_kommo_writeback_chequeo_optimista.sql` | Tabla `kommo_writeback_echo` + `record_kommo_writeback_echo` + columna `skip_code` + `mark_kommo_writeback_skipped` pasa a 3 args | **Dropea** la firma de 2 args (si no, ambigüedad). Los callers de 2 args siguen andando: hay test |
| `0374_kommo_outbox_post_idempotente.sql` | Ops `add_note`/`add_task`, `dedupe_token` + índice único, `enqueue_kommo_writeback` con token, `record_error` cierra los POST | **Dropea** la firma de 5 args de `enqueue_kommo_writeback` y crea la de 6 con default |
| `0375_kommo_contact_estado_comercial.sql` | Dos columnas de config en `kommo_connections` | Aditiva pura |

**Orden obligatorio: 0373 → 0374 → 0375.** La 0374 usa `skip_code`, que crea la
0373.

⚠️ **Antes de aplicar, comparar la huella de las funciones vivas en prod**
(`enqueue_kommo_writeback`, `record_kommo_writeback_error`,
`mark_kommo_writeback_skipped`): si otra ventana las tocó, estos `create or
replace` la pisan. Runbook: `docs/runbooks/aplicar-migraciones-prod.md`.

⚠️ **El código nuevo NO puede desplegarse antes que las migraciones.** El drenaje
llama a `record_kommo_writeback_echo` y pasa `p_code`/`p_dedupe_token`; contra el
esquema viejo, esas RPC no existen con esa firma. **Migraciones primero, deploy
después.**

---

## 4. Lo que NO se pudo hacer, y por qué

**No pude autenticarme en el Studio.** El `proxy.ts` corta `/studio/**` sin
sesión (matcher `["/studio/:path*", "/back/:path*"]`, sin bypass de dev) y no
tengo credenciales — ni las pedí.

**Lo que sí hice:** un banco de medición (`app/studio/banco-crm/page.tsx`) que
monta los componentes **reales** con datos ficticios, con el proxy parcheado
localmente para esa sola ruta. Medido en el navegador:

- Los 3 botones y los 2 controles de etapa renderizan en las 3 superficies.
- Con `canEdit=false` el botón **no se pinta** (bloque 4 de la captura).
- El drawer abre, las 4 pestañas cambian, el submit está deshabilitado con el
  campo vacío, `form="crm-lead-verbo"` apunta al form del cuerpo, la fecha de la
  tarea sale a hoy+2 con `min` = hoy, y los chips de etiquetas se agregan con
  Enter y vacían el input.
- El aviso ámbar "No se pisó el trabajo del CRM" con su botón **Reintentar**.

**El parche del proxy y el banco se revirtieron** — verificado con `git status`:
`proxy.ts` no aparece modificado y `app/studio/banco-crm/` no existe. Las
capturas están en `.playwright-mcp/crm-{1..4}*.png` (fuera de la rama).

Sigue sin verse **la pantalla real con datos reales**. Eso requiere tu sesión.

**No agregué un feature flag global para B4.** El pedido decía "detrás de un
feature flag apagado". Usé el patrón de inercia que ya tiene el módulo: sin
`contact_saldo_field_id`/`contact_transito_field_id` configurados el job no
encola nada — igual que `markbox_field_id` (0086) y `markbox_contact_field_id`
(0344). Es doble inercia con el gate de la 0136, y evita un tercer interruptor
donde mirar cuando algo no escribe. Agregar la key al catálogo global obligaba a
tocar `feature_flag_catalog()` + el espejo TS + su test de sincronía, por un
interruptor que duplica uno que ya existe. **Si prefieres el flag, se agrega en
una migración chica.**

**No toqué nada del `.limit(5000)`** (objetivo hermano). Encontré uno en el
camino y lo dejo anotado sin tocar: `lib/studio/kommo-writeback.ts:402` —
`getWritebackStatus` lee la outbox con `.limit(5000)` para contar estados. Mismo
patrón de la deuda transversal.

---

## 5. La cobertura real de B4, medida

Contra producción, **2026-08-14**:

| | |
|---|---|
| Clientes vivos | **447** |
| …con `kommo_contact_id` | **32** · 7,2% |
| …con `kommo_lead_id` | **1** |
| Sumables cruzando teléfono (match único) | **+21** |
| Ambiguos (>1 contacto con el mismo teléfono) | 7 |
| **Techo alcanzable** | **53 · 11,9%** |

El brief decía 33/449 y ~61 (13,6%). Hoy es 32/447 y 53 (11,9%).

🔴 **Y el dato que cambia la prioridad:** de los 32 vinculados, **cero** tienen
saldo pendiente o carga en tránsito. En todo el ERP hay **2** clientes con saldo
y **6** con carga navegando — y **ninguno** está vinculado a un contacto de
Kommo. La intersección es 0, verificado con una consulta de control que
descartaba un bug de mi join.

**Traducido: el job de B4, encendido hoy, no le escribiría nada a nadie.** No es
un defecto del job. El cuello es el vínculo cliente↔contacto y está antes que
esto. Por eso nace inerte y por eso el documento del Bloque E dice "vincular
primero, encender después" en vez de vender la feature.

---

## 6. Verificación

- `pnpm typecheck` ✅ · `deno check` (4 funciones) ✅ · contratos SQL ✅ (incluidos
  los 2 nuevos) · `pnpm docs:check` ✅
- Tests nuevos: 21 (plan del drenaje) + 17 (estado comercial) + los agregados a
  `kommo-writeback.test.ts` y `stage-control.test.ts`.
- **18 mutaciones**, 17 rojas y 1 verde que destapó un test que no discriminaba
  (M6 → M6b).
- **Cero filas de prueba contra la outbox de producción.** Todo lo de la cola se
  probó en Postgres desechable y sobre funciones puras: una fila real en esa
  tabla dispara un PATCH a Kommo de verdad.

---

## 7. Lo que sigue

1. **Tu OK para aplicar las migraciones**, de a una y en orden (0373 → 0374 →
   0375).
2. **Tu OK para pushear.** ⚠️ El último commit del push tiene que tocar código,
   no sólo `docs/**` — si no, `vercel.json` cancela el deploy en silencio.
3. **Migraciones antes del deploy** (§3).
4. Los 7 campos de Kommo y el reparto:
   `docs/marketing/kommo-campos-y-cartera.md` (~10 min).
5. Cuando estén los 2 campos de contacto, elegirlos en Studio → CRM → Dirección.
   ⚠️ Con la cobertura de §5, eso hoy no escribe nada.
