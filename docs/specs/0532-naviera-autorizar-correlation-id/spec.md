---
sdd: "0532"
title: "Autorizar una consolidación de Naviera deja de fallar siempre: correlation_id dentro de los 128 del writer AUD-01"
status: in-progress
author: "Sam (founder) + Claude Opus 5.5 (Worker)"
created: 2026-10-15
updated: 2026-10-15
supersedes: null
superseded_by: null
related: ["0166", "0187", "0232", "0530"]
confidencialidad: interno
---

# SDD-0532 — Autorizar una consolidación de Naviera deja de fallar siempre

> «Autorizar» una solicitud de consolidación en Naviera (SDD-0232) falla siempre:
> la referencia que arma la pantalla hace un `correlation_id` de 174 caracteres y
> el writer de auditoría admite 128. La autorización se revierte entera con
> 22023. La migración 0482 arma el `correlation_id` con el md5 de la referencia:
> mide 97 siempre, para cualquier referencia que la RPC acepte.

## 1. Hallazgo y reproducción

Lo anotó como FUERA DE ALCANCE, sin verificar, el Worker de la SDD-0530
(`.agents/handoffs/0530-naviera-zarpado-avisa.md` en la rama
`codex/naviera-zarpado-avisa`, commit `f2dcd876`). Esta SDD lo reprodujo.

**La cadena, con archivo y línea sobre `a8d99acf` (origin/main):**

1. La pantalla arma la referencia al abrir el diálogo:
   `naviera-consolidation-authorization:${c.id}:${crypto.randomUUID()}`
   (`app/studio/(app)/naviera/_components/NavieraClient.tsx:706-707`). Sus tres
   partes tienen largo fijo: 36 + 36 + 1 + 36 = **109 caracteres siempre**. No
   depende del código de contenedor ni de otro dato variable.
2. La Server Action la valida con `^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$`
   (`lib/studio/naviera/types.ts:510`) y la RPC con la misma regex
   (`0322:137-141`): pasa.
3. La RPC bloquea, reserva el correlativo, transiciona y recién después arma
   `consolidation-authorization:<id>:<referencia>` (`0322:232-234`):
   28 + 36 + 1 + 109 = **174 caracteres**.
4. El writer real es `append_audit_event` (0294), que delega en
   `append_audit_event_v1`, el cuerpo de 0267. Ese cuerpo rechaza un
   `correlation_id` que no cumpla `^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$`, o sea
   128 como máximo (`0267:542-545`), y la tabla tiene el mismo CHECK
   (`entity_audit_log_correlation_id_check`, `0267:318-322`). Ninguna migración
   posterior redefine el writer ni la RPC (búsqueda en `supabase/migrations` y
   en todas las ramas `origin/codex/*` y `origin/claude/*`).
5. El writer levanta `22023 audit: correlation_id inválido` y la transacción
   entera se revierte. La Server Action no reconoce 22023 y responde
   «No se pudo autorizar. Referencia: …» (`app/studio/(app)/naviera/actions.ts:653`).

**Por qué no lo vio el contrato de la 0232:** su `append_audit_event` es un doble
que inserta sin validar (`supabase/tests/0322_…test.sql:55-78`) y sus referencias
son cortas (`'naviera-auth-0001'`, 17 caracteres).

**Reproducción con el writer real (PGlite 0.5.8, PostgreSQL 18.3):** el preludio
del contrato de la 0267, las migraciones reales 0267, 0294 y 0322, y la
fixture Naviera del contrato 0322, sin su writer simulado.

| Referencia | `correlation_id` con 0322 | Resultado con 0322 |
|---|---|---|
| `naviera-auth-0001` (17) | 82 | autoriza |
| la de la pantalla (109) | 174 | **22023 `audit: correlation_id inválido`**; la solicitud sigue `solicitada`, sin correlativo y sin AUD-01 |

Con ese prefijo, **cualquier referencia de más de 63 caracteres falla**, aunque
la RPC acepte hasta 128. La reproducción quedó como contrato permanente
(`supabase/tests/0482_naviera_autorizar_correlation_id.test.sql`): sin 0482
cae con ese error, y ése es su control rojo.

**Producción: NO VERIFICADO.** Según REV-SGE-048
(`docs/governance/reviews/governance-r3-0318-0324-production-close-2026-08-01.md`),
la 0322 está aplicada desde el 2026-08-01 (ledger `20260801130411`). Si el cuerpo
vivo de la RPC y del writer son los del repo, «Autorizar» no ha funcionado nunca
desde la pantalla en producción. No se leyó el catálogo ni filas de producción:
la lectura de catálogo necesita el OK del Director y no hizo falta para
reproducir. Contar autorizaciones exitosas exigiría leer filas de negocio y queda
fuera de esta tarea.

## 2. Decisión: dónde se corrige

**En la RPC, con una migración nueva.** El defecto es de la RPC, no de la
pantalla. Su validación acepta referencias de hasta 128 caracteres y, con
cualquiera de más de 63, la RPC falla sola contra su propio writer. La pantalla
respeta el contrato que la RPC declara.

`v_correlation` pasa a ser
`consolidation-authorization:<id>:<md5(referencia)>`, de 28 + 36 + 1 + 32 =
**97 caracteres**, para cualquier referencia que la RPC acepte.

- **Determinista:** la misma referencia da el mismo `correlation_id`. AUD-02
  pide conectar feedback, mutación y eventos por `correlation_id`, y se logra
  calculando `md5(referencia)` o buscando `payload.request_ref`.
- **Conserva el espacio de nombres de la 0322**: prefijo y id de la solicitud.
  Dos módulos que reciban la misma referencia no se mezclan.
- **Distingue referencias que comparten un prefijo largo.** Truncar a 128 no lo
  hace: con la referencia de la pantalla se perdería el UUID aleatorio.
- **La referencia completa sigue en `payload.request_ref`**, que es la llave de
  idempotencia (índice único de `0322:40-47`). El replay no cambia.
- **md5 y no sha256:** el hex de sha256 son 64 caracteres y el `correlation_id`
  quedaría en 129. Está probado como mutante. El md5 no cumple aquí una función
  de seguridad: no es llave única ni secreto.

**Alternativas descartadas:**

- *Acortar la referencia en la pantalla.* Arregla esta pantalla, pero deja la
  trampa en la RPC para cualquier otro llamador. Además, cada pantalla hermana
  tendría que acordarse del límite (ver §7).
- *Usar la referencia sola como `correlation_id`.* Cabe siempre, porque las dos
  regex son iguales, pero pierde el espacio de nombres: el mismo
  `naviera-auth-0001` en otro módulo agruparía eventos ajenos.
- *Ampliar el writer o el CHECK.* Es el contrato AUD-01 (SDD-0166) y lo usan
  todos los dominios. No se cambia por un llamador.
- *Patrón existente en el repo:* no hay uno para `correlation_id` largos.
  0316/0340 usan `txid_current()`, 0475 usa un UUID nuevo y 0427 pasa un UUID.
  Ninguno incluye una referencia del cliente.

## 3. Alcance

La 0482 reemplaza sólo el cuerpo de `authorize_consolidation_governed`:

- La única línea que cambia es la de `v_correlation`, más un comentario. Una
  prueba de texto mide que el resto es el de 0322 byte a byte.
- Misma firma y mismo `SECURITY DEFINER`, `search_path` vacío, owner y ACL.
  `CREATE OR REPLACE` los conserva y no se reafirman: si producción los tiene
  distintos, el postflight aborta.
- **La app no cambia.** El orden respecto del despliegue es indiferente: basta
  aplicarla para que «Autorizar» funcione.

**Preflight:**

- Exige el md5 del `prosrc` de 0322, con CRLF→LF
  (`e65455c17974c8b3ec78044085bca67e`) o sin espacios
  (`18176835d747fcf8fb49a639579b27f3`).
- Exige `SECURITY DEFINER` y `search_path=""`.
- Otro cuerpo aborta sin cambiar nada.

**Postflight:**

- Exige el cuerpo de 0482 (`0f32f8450b38871530ae75e388f04c00`), `DEFINER`,
  `search_path`, owner `postgres` y EXECUTE sólo para `authenticated`.

**No se toca:** el contrato de la 0322, su writer simulado, las demás RPC del
lote R3 (§7) ni el mapeo de errores de la Server Action.

## 4. Políticas

| Política | Resultado |
|---|---|
| AUD-01 | cumplimiento: el AUD-01 de la autorización vuelve a escribirse; actor, motivo, request ref y resultado siguen atómicos |
| AUD-02 | cumplimiento: el `correlation_id` es derivable de la referencia (`md5`) y la referencia completa está en `payload.request_ref` |
| SGE-00 | cumplimiento: correlativo, estado, actor y auditoría siguen cambiando juntos; sin cambios en el lock ni en la transición |
| MP-01 | no aplica: rol, tenant y lock no cambian (cuerpo de 0322 byte a byte salvo `v_correlation`) |
| ERR-01 | no aplica: los mensajes públicos no cambian; ver §7 sobre 22023 |
| BTN-01, HTD-01, FRM-01, LOD-01, A11Y-01 | no aplica: la pantalla no cambia |

## 5. Allowlist

- `supabase/migrations/0482_naviera_autorizar_correlation_id.sql`
- `supabase/tests/0482_naviera_autorizar_correlation_id.test.sql`
- `app/studio/(app)/naviera/__tests__/autorizar-correlation-id.migration.test.ts`
- `supabase/migrations-baseline.json` (espera `0482_naviera_autorizar_correlation_id`)
- `docs/specs/0532-naviera-autorizar-correlation-id/spec.md`
- `docs/specs/README.md`
- `.agents/handoffs/0532-naviera-autorizar-correlation-id.md`

## 6. Aceptación y evidencia

- [x] Reproducido con el writer real, no simulado: 109 → 174 → 22023 y reversión
      completa. Una referencia corta autoriza.
- [x] Con 0482, la referencia de la pantalla (109), la del umbral (64, la más
      corta que fallaba) y la máxima (128) autorizan. Cada una deja un AUD-01 con
      `correlation_id = consolidation-authorization:<id>:<md5(ref)>`, de 97
      caracteres, con la referencia completa en `payload.request_ref`. El replay
      no escribe otro evento.
- [x] Control rojo: el contrato sin 0482 cae con `audit: correlation_id inválido`.
- [x] Mutantes coherentes (con el md5 de su propio cuerpo en el postflight):
      referencia cruda, sha256, truncar a 128, sin el id, md5 de todo, md5 en el
      payload y sin comentario. Cada uno muere en la aserción esperada.
- [x] Preflight y postflight: deriva de cuerpo, de `DEFINER`, de `search_path`,
      de owner y de ACL (anon, service_role, authenticated revocado), y una 0482
      alterada en tránsito. Todos abortan. Una deriva sólo de espacios se acepta.
- [x] Texto: el cuerpo es el de 0322 salvo `v_correlation`. Las huellas son las
      de esos cuerpos. La fixture es la del contrato 0322 y la referencia, la de
      la pantalla.
- [x] Barrido de mutantes externos sobre los guardas de la 0482 (§8).
- [ ] Aplicada a producción con OK nominal de Sam: **pendiente**, gate externo.
- [ ] Smoke en producción: autorizar una solicitud real desde Naviera.
      **Pendiente** después de aplicar.

## 7. Fuera de alcance detectado

**Las otras siete RPC del lote R3 tienen el mismo defecto.** Todas arman
`<prefijo>:<id>:<request_ref>`, validan la referencia con la regex de 128 y
pasan el resultado al mismo writer. Ninguna fue redefinida después. Con la
referencia que manda cada pantalla:

| Migración · RPC | Pantalla | Referencia | `correlation_id` | Referencia máxima que cabe |
|---|---|---|---|---|
| 0317 · `mark_claim_offset_paid_in_china_governed` | `financiero-china/_components/ClaimOffsetsTab.tsx:62` | 95 | 154 | 69 |
| 0318 · `clear_customs_filing_governed` | `seniat/_components/FilingDetailDrawer.tsx:119` | 91 | 146 | 73 |
| 0319 · `pay_claim_indemnity_governed` | `reclamos/_components/ReclamosClient.tsx:513` | 97 | 158 | 67 |
| 0320 · `complete_tms_route_governed` | `tms/_components/RoutesTab.tsx:30` | 94 | 152 | 70 |
| 0321 · `complete_ve_delivery_governed` | `ve/_components/VeRowActions.tsx:160` | 95 | 154 | 69 |
| 0323 · `retire_inspection_report_governed` | `inspecciones/_components/InspeccionesClient.tsx:506` | 102 | 168 | 62 |
| 0324 · `cancel_dispatch_order_governed` | `despacho/_components/CancelOdDrawer.tsx:32` | 101 | 166 | 63 |

- **INFERENCIA por aritmética sobre el código, NO REPRODUCIDA.** La aritmética es
  la misma que se reprodujo para la 0322. Según REV-SGE-048, las siete están
  aplicadas en producción desde el 2026-08-01.
- Si es así, marcar pagado un claim en China, liberar aduana, pagar una
  indemnización, completar una ruta TMS, entregar en Almacén VE, retirar un
  reporte de inspección y cancelar una OD fallan siempre desde la pantalla.
- La 0336 (`camionero_pod_v2`) arma el mismo patrón, pero ninguna pantalla la
  llama hoy: la app usa `camionero_pod`.
- **Corrección propuesta:** el mismo patrón de esta SDD, una RPC por migración
  o una migración por lote, con su contrato sobre el writer real. Queda para una
  tarea propia.

**La Server Action no reconoce 22023.** El fallo se ve como «No se pudo
autorizar. Referencia: …» y nada lo distingue de un error transitorio. Con 0482
ya no ocurre por esta causa. No se cambia aquí.

**El contrato de la 0322 sigue con su writer simulado.** El contrato nuevo
cubre la RPC con el writer real; el viejo se conserva como estaba.

## 8. Validación

Ver `.agents/handoffs/0532-naviera-autorizar-correlation-id.md` para comandos,
resultados y lo que no se ejecutó.

## 9. Gates externos

La 0482 queda preparada y validada sólo en local, como espera declarada en
`supabase/migrations-baseline.json`. Para aplicarla a producción hace falta:

- **OK nominal de Sam** con el name exacto
  `0482_naviera_autorizar_correlation_id`, siguiendo
  `docs/runbooks/aplicar-migraciones-prod.md`.
- **Lectura de catálogo previa, READ ONLY, por el Director:** md5 de `prosrc`,
  `prosecdef`, `proconfig`, owner y ACL de la RPC.

Fusionar la PR no autoriza aplicarla. Los merges están congelados hasta después
del corte de Vercel al servidor propio (2026-10-15, noche de Caracas).
