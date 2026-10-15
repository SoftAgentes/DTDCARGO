---
sdd: "0534"
title: "Siete acciones R3 del Studio dejan de fallar siempre: correlation_id dentro de los 128 del writer AUD-01"
status: in-progress
author: "Sam (founder) + Claude Opus 5.5 (Worker)"
created: 2026-10-15
updated: 2026-10-15
supersedes: null
superseded_by: null
related: ["0166", "0187", "0227", "0228", "0229", "0230", "0231", "0233", "0234", "0532"]
confidencialidad: interno
---

# SDD-0534 — Siete acciones R3 del Studio dejan de fallar siempre

> Siete acciones gobernadas del Studio (lote R3, SDD-0227 a SDD-0234 salvo
> Naviera) fallan siempre desde su pantalla: la referencia que arma cada
> pantalla hace un `correlation_id` de 146 a 168 caracteres y el writer de
> auditoría admite 128. La acción se revierte entera con 22023. Es el mismo
> defecto que la SDD-0532 corrigió para Naviera (migración 0482). Las
> migraciones 0483–0489, una por RPC, arman el `correlation_id` con el md5 de
> la referencia: mide entre 87 y 98 para cualquier referencia que la RPC acepte.

## 1. Hallazgo y reproducción

Lo anotó como FUERA DE ALCANCE el Worker de la SDD-0532
(`docs/specs/0532-naviera-autorizar-correlation-id/spec.md` §7 y
`.agents/handoffs/0532-naviera-autorizar-correlation-id.md` en la rama
`claude/nervous-leakey-ff74c7`, PR #235), con la aritmética sobre el código y
**sin reproducir**. Esta SDD lo reprodujo para las siete.

**La cadena, igual en las siete (sobre `f3651f24`, origin/main):**

1. La pantalla arma la referencia como `<prefijo>:${id}:${crypto.randomUUID()}`.
   El prefijo es el mismo que la RPC usa para el `correlation_id`. Las tres
   partes tienen largo fijo, así que la referencia mide siempre lo mismo.
2. La Server Action la valida con `^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$`
   (por ejemplo `lib/studio/tms-types.ts:338`) y la pasa sin cambios a la RPC
   (`p_request_ref: input.requestRef`), que la valida con la misma regex: pasa.
3. La RPC hace su trabajo (estado, timeline, asiento, recursos) y al final arma
   `<prefijo>:<id>:<referencia>` y llama al writer.
4. El writer real es `append_audit_event` (0294), que delega en
   `append_audit_event_v1`, el cuerpo de 0267. Ese cuerpo rechaza un
   `correlation_id` de más de 128 caracteres (`0267:542-545`) y la tabla tiene
   el mismo CHECK (`entity_audit_log_correlation_id_check`, `0267:318-322`).
5. El writer levanta `22023 audit: correlation_id inválido` y la transacción
   entera se revierte.

Ninguna migración posterior redefine el writer ni estas siete RPC. Lo revisé en
`supabase/migrations`, en las 157 refs remotas (ramas `origin/*` y PRs abiertas
en `refs/dtd/pr/*`), en las ramas locales y en los 27 worktrees de la máquina.

| Migración · RPC | Pantalla | Referencia | `correlation_id` con 03NN | Máxima que cabía |
|---|---|---|---|---|
| 0317 · `mark_claim_offset_paid_in_china_governed` | `financiero-china/_components/ClaimOffsetsTab.tsx:62` | 95 | 154 | 69 |
| 0318 · `clear_customs_filing_governed` | `seniat/_components/FilingDetailDrawer.tsx:119` | 91 | 146 | 73 |
| 0319 · `pay_claim_indemnity_governed` | `reclamos/_components/ReclamosClient.tsx:513` | 97 | 158 | 67 |
| 0320 · `complete_tms_route_governed` | `tms/_components/RoutesTab.tsx:30` | 94 | 152 | 70 |
| 0321 · `complete_ve_delivery_governed` | `ve/_components/VeRowActions.tsx:160` | 95 | 154 | 69 |
| 0323 · `retire_inspection_report_governed` | `inspecciones/_components/InspeccionesClient.tsx:506` | 102 | 168 | 62 |
| 0324 · `cancel_dispatch_order_governed` | `despacho/_components/CancelOdDrawer.tsx:32` | 101 | 166 | 63 |

Las pantallas están en `app/studio/(app)/`.

**Reproducción con el writer real (PGlite 0.5.8):** la plataforma mínima que el
preflight de 0267 exige (el preludio del contrato 0482), las migraciones reales
0267 y 0294, la fixture del contrato de cada 03NN sin su writer simulado, y la
03NN. Resultado, igual en las siete:

| Referencia | Resultado con la 03NN |
|---|---|
| corta (17 caracteres) | transiciona |
| la más larga que cabe (de 62 a 73 según el prefijo) | transiciona |
| la de la pantalla (de 91 a 102) | **22023 `audit: correlation_id inválido`** |
| la más corta que se pasa (de 63 a 74) | **22023 `audit: correlation_id inválido`** |

Después del fallo la entidad queda intacta y sin AUD-01:

| RPC | Estado después del fallo |
|---|---|
| 0317 | el cruce sigue `reconocido_proveedor`, sin fecha de recepción |
| 0318 | el trámite sigue `pagado`, el embarque `in_customs`, 0 eventos de timeline |
| 0319 | el reclamo sigue `aprobado`, 0 asientos |
| 0320 | ruta, camión y chofer siguen `en_ruta`, el embarque `out_for_delivery`, 0 eventos |
| 0321 | el embarque sigue `out_for_delivery`, sin receptor, 0 eventos |
| 0323 | el reporte sigue vivo con su foto |
| 0324 | la OD sigue `lista`, sin motivo ni actor de cancelación |

La reproducción quedó como contrato permanente: sin su 04NN, cada contrato
`supabase/tests/048N_*.test.sql` cae con ese error, y ése es su control rojo.

**Por qué no lo vieron los contratos de 0317–0324:** su `append_audit_event` es un
doble que inserta sin validar y sus referencias son cortas (de 14 a 22
caracteres).

**Producción: NO VERIFICADO.** Según REV-SGE-047 (0317, ledger
`20260801123849`) y REV-SGE-048 (0318–0324, ledgers `20260801125818` a
`20260801130632`), las siete se aplicaron el 2026-08-01, cuando producción era
Supabase Cloud. No se leyó el catálogo del servidor propio ni filas de negocio.
Si los cuerpos vivos son los del repo, estas siete acciones no han funcionado
nunca desde su pantalla.

## 2. Decisión: dónde se corrige y cómo se parte

**En cada RPC, con el patrón de la 0482.** El defecto es de la RPC: acepta
referencias de hasta 128 caracteres y con cualquiera de más de 62 a 73 falla sola
contra su propio writer. Las pantallas respetan el contrato que la RPC declara.

`v_correlation` pasa a ser `<prefijo>:<id>:<md5(referencia)>`:

| Migración | RPC | `correlation_id` |
|---|---|---|
| 0483 | 0317 `mark_claim_offset_paid_in_china_governed` | 22 + 36 + 1 + 32 = **91** |
| 0484 | 0318 `clear_customs_filing_governed` | 18 + 36 + 1 + 32 = **87** |
| 0485 | 0319 `pay_claim_indemnity_governed` | 24 + 36 + 1 + 32 = **93** |
| 0486 | 0320 `complete_tms_route_governed` | 21 + 36 + 1 + 32 = **90** |
| 0487 | 0321 `complete_ve_delivery_governed` | 22 + 36 + 1 + 32 = **91** |
| 0488 | 0323 `retire_inspection_report_governed` | 29 + 36 + 1 + 32 = **98** |
| 0489 | 0324 `cancel_dispatch_order_governed` | 28 + 36 + 1 + 32 = **97** |

El encargo hablaba de «97 caracteres o menos». La 0488 mide 98 porque su prefijo
(`inspection-report-retirement:`) tiene un carácter más que el de la 0482. Sigue
lejos de 128.

Las razones son las de la SDD-0532 §2:

- **Determinista:** la misma referencia da el mismo `correlation_id`.
- **Conserva el espacio de nombres** de cada 03NN: prefijo e id.
- **Distingue referencias que comparten un prefijo largo.** Truncar no lo hace.
- **La referencia completa sigue en `payload.request_ref`**, que es la llave de
  idempotencia (índice único de cada 03NN). El replay no cambia.

**md5 y no sha256.** Con sha256 (64 hex) el `correlation_id` mediría 130 en la
0488 y 129 en la 0489, y no cabría. En las otras cinco mediría entre 119 y 125 y
cabría. Se usa md5 en las siete para que las ocho RPC del lote tengan el mismo
formato. El hash no cumple aquí una función de seguridad: no es llave única ni
secreto. El mutante de sha256 está en el envoltorio de cada migración: en la
0488 y la 0489 cae en el writer y en las otras cinco cae en la aserción del valor.

**Una migración por RPC (0483–0489).** El runbook pide aplicar de a una. Si una
RPC tiene deriva en producción, sólo su migración aborta y las otras seis se
aplican. Es una **propuesta del Worker, sin confirmar por el Director** (§9). El
Worker de la SDD-0532 la respaldó como recomendación técnica, sin carácter de
confirmación; su texto está en el handoff. El inventario de `sdd:next` (refs,
PRs abiertas y worktrees) dio 0483 como la siguiente libre.

**Alternativas descartadas:** las de la SDD-0532 §2 (acortar la referencia en la
pantalla, usar la referencia sola, ampliar el writer o el CHECK) por las mismas
razones. Una migración por lote se descartó porque una sola deriva bloquearía
las siete.

## 3. Alcance

Cada migración reemplaza sólo el cuerpo de su RPC:

- La única línea que cambia es la de `v_correlation`, más un comentario. Una
  prueba de texto mide que el resto es el de la 03NN byte a byte.
- Misma firma y mismo `SECURITY DEFINER`, `search_path` vacío, owner y ACL.
  `CREATE OR REPLACE` los conserva y no se reafirman: si producción los tiene
  distintos, el postflight aborta.
- El comentario de la función conserva el de la 03NN y suma la SDD-0534.
- **La app no cambia.** El orden respecto del despliegue y entre las siete es
  indiferente: basta aplicar cada una para que su acción funcione.

**Preflight** (md5 del `prosrc` de la 03NN con CRLF→LF, o sin `\s`; las dos
huellas medidas también en PostgreSQL sobre el `prosrc` real), más
`prosecdef` y `proconfig = {search_path=""}`. **Postflight:** el cuerpo de la
04NN, `DEFINER`, `search_path`, owner `postgres` y EXECUTE sólo para
`authenticated`.

| Migración | Preflight: md5 03NN (LF) | Preflight: sin espacios | Postflight: md5 04NN |
|---|---|---|---|
| 0483 | `0f44f6f05886263f7212442c1a96500b` | `ed3b2a4ac99aa45e531938b5b0074876` | `e2cc61b5c1c69d2ecc6f595000b58c18` |
| 0484 | `6e56e6e9ca817d63664f875a86872c02` | `1a72ff4fd1ca2dbc1a670fbf5ab787f6` | `04d5cf691b31bfa0fc3976b6a143b46b` |
| 0485 | `c236f0e1701a2e46d7c7bc67a1f50288` | `701ea78b498e7f081fc6f6d25abd3ff6` | `c09dd95160a6925af110759a5a0b379f` |
| 0486 | `a58ed097b0310dae2d5ff3ea479b592a` | `de4989211e73ca507756752a3bc04528` | `8f72f0e10f86b079b2cb345289f02ee5` |
| 0487 | `1335070f1b5c27a3b8bbb1b6d643185b` | `1a8b93451720fffcd7772c92decd3407` | `651252cda7e8354058ecb83b8cc0e324` |
| 0488 | `e8cb95d832168e566e322660af36b2b0` | `1543780f3991b0de237071aacbecd679` | `88adc4feacfce491ddee40309a744e99` |
| 0489 | `3f048cb52ae5a8f34675671828230eef` | `ada23b5b799a03eb16a4ace7d633f793` | `ad6c86c0c76ae02c5a45a67154b20347` |

**No se toca:** los contratos de 0317–0324 y su writer simulado, la 0336
(`camionero_pod_v2`, §7), la 0482 de la SDD-0532 ni el mapeo de errores de las
Server Actions (§7).

## 4. Políticas

| Política | Resultado |
|---|---|
| AUD-01 | cumplimiento: el AUD-01 de las siete acciones vuelve a escribirse; actor, motivo, request ref y resultado siguen atómicos con la mutación |
| AUD-02 | cumplimiento: el `correlation_id` es derivable de la referencia (`md5`) y la referencia completa está en `payload.request_ref` |
| SGE-00 | cumplimiento: estado, timeline, asiento, recursos y auditoría siguen cambiando juntos; sin cambios en locks ni en transiciones |
| MP-01 | no aplica: rol, tenant y locks no cambian (cuerpo de cada 03NN byte a byte salvo `v_correlation`) |
| ERR-01 | no aplica: los mensajes públicos no cambian; ver §7 sobre 22023 |
| BTN-01, HTD-01, FRM-01, LOD-01, A11Y-01 | no aplica: las pantallas no cambian |

## 5. Allowlist

- `supabase/migrations/0483_financiero_china_pago_correlation_id.sql`
- `supabase/migrations/0484_seniat_liberar_correlation_id.sql`
- `supabase/migrations/0485_reclamos_pagar_indemnizacion_correlation_id.sql`
- `supabase/migrations/0486_tms_completar_ruta_correlation_id.sql`
- `supabase/migrations/0487_ve_confirmar_entrega_correlation_id.sql`
- `supabase/migrations/0488_inspecciones_retirar_reporte_correlation_id.sql`
- `supabase/migrations/0489_despacho_cancelar_od_correlation_id.sql`
- `supabase/tests/_audit-writer-real.sql` (preludio compartido con el writer real)
- `supabase/tests/0483_…` a `supabase/tests/0489_…` `.test.sql` (los siete contratos)
- `lib/studio/__tests__/r3-correlation-contract.ts` (envoltorio compartido)
- `lib/studio/__tests__/{financiero-china-pago,seniat-liberar,reclamos-pagar-indemnizacion,tms-completar-ruta,ve-confirmar-entrega,inspecciones-retirar-reporte,despacho-cancelar-od}-correlation-id.migration.test.ts`
- `supabase/migrations-baseline.json` (siete esperas)
- `docs/specs/0534-lote-r3-correlation-id/spec.md`
- `docs/specs/README.md`
- `.agents/handoffs/0534-lote-r3-correlation-id.md`

## 6. Aceptación y evidencia

- [x] Reproducido con el writer real, no simulado, en las siete: la referencia
      de la pantalla cae con 22023 y la entidad queda intacta y sin AUD-01. Una
      referencia corta y la más larga que cabe transicionan.
- [x] Con su 04NN, cada contrato transiciona la referencia de la pantalla, la
      del umbral (la más corta que fallaba) y la máxima (128). Cada una deja un
      AUD-01 con `correlation_id = <prefijo>:<id>:<md5(ref)>` del largo de §2 y
      la referencia completa en `payload.request_ref`. El replay no escribe otro
      evento. 26 aserciones por contrato.
- [x] Control rojo: cada contrato sin su 04NN cae con `audit: correlation_id
      inválido`.
- [x] Mutantes coherentes por migración (con el md5 de su propio cuerpo en el
      postflight): referencia cruda, sha256, truncar a 128, sin el id, md5 de
      todo, md5 en el payload y sin comentario. Cada uno muere en la aserción
      esperada.
- [x] Preflight y postflight por migración: deriva de cuerpo, de `DEFINER`, de
      `search_path`, de owner y de ACL (anon, service_role, authenticated
      revocado), y una 04NN alterada en tránsito. Todos abortan. Una deriva sólo
      de espacios se acepta.
- [x] Texto: el cuerpo es el de la 03NN salvo `v_correlation`, las huellas son
      las de esos cuerpos, la fixture y los grants son los del contrato 03NN, el
      contrato no define su propio writer y la referencia es la de la pantalla.
- [x] Barrido de mutantes externos sobre los guardas de las siete (handoff).
- [ ] Partición y números confirmados por el Director: **pendiente** (§9).
- [ ] Aplicadas a producción con OK nominal de Sam, de a una: **pendiente**,
      gate externo.
- [ ] Smoke en producción de las siete acciones: **pendiente** después de
      aplicar.

## 7. Fuera de alcance detectado

**Tres Server Actions muestran un mensaje engañoso con 22023.** Financiero China
(`app/studio/(app)/financiero-china/actions.ts:529`) responde «Revisa el motivo y
la fecha efectiva.», SENIAT (`seniat/actions.ts:278`) «Revisa los documentos, el
motivo y la fecha efectiva.» y Reclamos (`reclamos/actions.ts:304-305`) «Revisa
el monto, el medio, el motivo y la fecha efectiva.». Con este defecto el usuario
corregía datos que estaban bien. Las otras cuatro muestran «No se pudo … Referencia:
…» (`despacho/actions.ts:298`, `inspecciones/actions.ts:269`,
`tms/actions.ts:336`, `ve/actions.ts:172`). Con 0483–0489 ya no ocurre por esta
causa. No se cambia aquí.

**La 0336 (`camionero_pod_v2`) arma el mismo patrón** (`0336_pod_closes_shipment.sql:248-250`),
pero ninguna pantalla la llama: la app usa `camionero_pod`. Se registra y no se
corrige, como pidió el encargo.

**Los contratos de 0317–0324 siguen con su writer simulado.** Los nuevos cubren
las RPC con el writer real; los viejos se conservan como estaban.

**La huella LF del preflight es redundante con la huella sin espacios.** Si
coincide el md5 con CRLF→LF, coincide también el md5 sin `\s`. Se conserva por
paridad con la 0482 y porque es la huella que se compara en la lectura de
catálogo. En el barrido, el mutante que la ignora sobrevive y es equivalente.
Lo mismo vale para la 0482.

**Conflicto textual esperado con la PR #235.** Las dos agregan esperas al final
de `pendingBelowCutoff` y regeneran el índice de specs. La que se integre
segunda tiene que conservar las dos esperas y regenerar el índice.

## 8. Validación

Ver `.agents/handoffs/0534-lote-r3-correlation-id.md` para comandos, resultados y
lo que no se ejecutó.

## 9. Gates externos

Las siete migraciones quedan preparadas y validadas sólo en local, como esperas
declaradas en `supabase/migrations-baseline.json`. Para aplicarlas a producción
hace falta:

- **Confirmación del Director** de la partición (una por RPC) y de los números
  0483–0489.
- **Lectura de catálogo previa, READ ONLY, por el Director:** md5 de `prosrc`,
  `prosecdef`, `proconfig`, owner y ACL de cada RPC (consulta en el handoff).
- **OK nominal de Sam** por cada migración, con su name exacto, siguiendo
  `docs/runbooks/aplicar-migraciones-prod.md`, de a una.

Fusionar la PR no autoriza aplicarlas. Los merges están congelados hasta después
del corte de Vercel al servidor propio (2026-10-15, noche de Caracas).
