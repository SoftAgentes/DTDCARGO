---
sdd: "0593"
title: "Escribir asientos queda para accounting y admin; las cuentas bancarias, por su RPC"
status: in-progress
author: "Sam + Claude Opus 5.5"
created: 2026-11-02
updated: 2026-11-03
supersedes: null
superseded_by: null
related: ["0040", "0120", "0299", "0492", "0566", "0573", "0591"]
confidencialidad: interno
---

# SDD-0593 — Escribir asientos queda para accounting y admin; las cuentas bancarias, por su RPC

> Cierra en la base dos cosas que hoy sólo cierra la app: quién escribe la
> contabilidad y quién cambia el número de cuenta bancaria que sale en las facturas.

## Contexto

Al restringir `public.accounts` (SDD-0591) se midió que otras tablas de dinero
tienen el mismo hueco. Sam pidió, literal, «Haz esta tarea aquí: “Restringir quién
escribe asientos y cuentas bancarias”».

### El hueco (medido en el catálogo de producción, 2026-11-02)

| Tabla | Policy | ACL de `authenticated` |
|---|---|---|
| `journal_entries` | `«journal_entries by tenant»`, FOR ALL | SELECT, INSERT, UPDATE, DELETE |
| `journal_lines` | `«journal_lines by entry tenant»`, FOR ALL | SELECT, INSERT, UPDATE, DELETE |
| `company_bank_accounts` | `«company_bank_accounts by tenant»`, FOR ALL | SELECT, INSERT, UPDATE |

Las tres sólo piden el tenant. **Cualquier miembro activo, de cualquier rol, podía
por PostgREST** crear, asentar, alterar o borrar asientos, y cambiar el número de
cuenta bancaria de las facturas, que es el riesgo de fraude más directo. Hoy hay
miembros activos con roles `marketing` y `warehouse`. **Los clientes del portal no
pasan:** no tienen membresía en `user_tenants`.

Producción tiene 0 asientos desde el 2026-11-02, así que esto se cierra antes de que
haya datos que proteger.

### Inventario de escritores (2026-11-02)

| Camino | Cliente | Quién llega | Tablas |
|---|---|---|---|
| Posting automático (`lib/studio/accounting/*-posting.ts`, `partner-finance/posting.ts`) | admin, `service_role` | el flujo que lo dispara | asientos y líneas |
| `createJournalEntry`, `postEntry`, `softDeleteEntry` (`contabilidad/actions.ts`) | sesión | `accounting`, `admin` | asientos; líneas sólo INSERT |
| `voidEntry`, por `void_journal_entry_with_audit_reason` (0294, INVOKER) | sesión | `accounting`, `admin` | asientos |
| `crear_`, `asentar_`, `anular_asiento_en_cierre`, `eliminar_borrador_en_cierre` (0493) | DEFINER de postgres | candado propio con superclave | asientos y líneas |
| `void_expense_governed`, `void_payroll_settlement_governed`, `pay_claim_indemnity_governed` | DEFINER de postgres | candado propio | asientos |
| `saveBankAccountAction`, `deleteBankAccountAction`, por `audit_d1_execute` | DEFINER de postgres | `admin` | cuentas bancarias |

- El módulo `accounting` es de dinero, en `LOCKED_MODULES`: ningún override lo abre.
- **Los posting automáticos no se afectan.** Usan `service_role`, así que un flujo de
  un rol no financiero, como un gasto de operaciones, sigue asentando. Era el riesgo
  principal de esta tarea.
- Nadie edita ni borra una línea con el cliente de sesión.
- Nadie escribe `company_bank_accounts` directo: el código sólo la lee.
- En ramas sin fusionar, 0499 reescribe `void_expense_governed`, que sigue DEFINER.
  Las demás de 0498 a 0510 no tocan estas tablas.

## Decisiones

- **`journal_entries`: el molde de la 0470 y la 0510.** `_team_select`, y
  `_accounting_insert`, `_update` y `_delete` con `current_studio_role()`. El DELETE
  se queda: `createJournalEntry` borra la cabecera si fallan sus líneas.
- **`journal_lines`: sólo se insertan.** Se revocan UPDATE y DELETE de
  `authenticated`, también para `accounting` y `admin`: nadie los usa, y dejarlos
  permitiría alterar un asiento asentado por PATCH. El borrado en cascada no pasa por
  este permiso, y `service_role` conserva todo.
- **`company_bank_accounts`: de sólo lectura para `authenticated`**, como la frontera
  de la 0422. La escritura sigue por `audit_d1_execute`, que además deja su auditoría.
- **La lectura no se toca.** Sigue siendo de todo el equipo del tenant, la deuda
  deliberada que anotó la 0407.
- **`void_journal_entry_with_audit_reason` no cambia.** Quien no es financiero recibe
  `false`, sin error, porque la RLS de UPDATE no le deja fila. La 0470 agregó un assert
  a sus envolturas; aquí no hace falta para cerrar el hueco, y dejar el cuerpo igual
  evita tocar una función que usa la 0493.
- **La app no cambia.**
- **La 0511 va después de la 0497 en el orden del ledger**, pero no depende de ella:
  no fija cuerpos de la 0497, y la 0497 no toca estas policies.
- **Límites con `set local`, sin `reset`**, como la 0510.

## Qué cambia

`supabase/migrations/0511_rls_escritura_asientos_y_bancos.sql`: preflight, siete
policies en lugar de tres, dos `revoke` y postflight.

## Qué no cambia

Las lecturas, las filas, `service_role`, las RPC, los posting, los triggers de cierre,
de auditoría y de `updated_at`, y la app.

## Allowlist exacta

- `supabase/migrations/0511_rls_escritura_asientos_y_bancos.sql` (nueva)
- `supabase/tests/0511_rls_escritura_asientos_y_bancos.test.sql` (nuevo)
- `lib/studio/__tests__/rls-escritura-asientos-y-bancos.migration.test.ts` (nuevo)
- `supabase/migrations-baseline.json` (sólo la espera de la 0511)
- `docs/specs/0593-guarda-asientos-y-bancos/spec.md` y `docs/specs/README.md`
  (regenerado)
- `.agents/handoffs/0593-guarda-asientos-y-bancos.md`

## Aceptación

1. **El contrato SQL pasa con la 0511 y falla sin ella** (control rojo: el comercial
   crea un asiento). Cubre:
   - que los siete roles activos siguen leyendo las tres tablas;
   - que `accounting` y `admin` hacen lo que hace la app: crear con líneas, asentar,
     anular por la RPC, archivar y borrar la cabecera con su línea en cascada;
   - que los demás roles, un usuario desactivado, uno con dos membresías y un cliente
     del portal no crean asientos ni líneas, no los alteran, no los borran y reciben
     `false` de la RPC, sin que quede rastro;
   - que nadie edita ni borra una línea directo, ni con rol financiero;
   - que otro tenant no cruza, ni con una línea hacia su asiento, y que nadie se lleva
     un asiento a otro tenant;
   - que nadie escribe `company_bank_accounts` directo, ni el admin, y que la RPC
     DEFINER sigue escribiendo para el admin y rechaza a los demás;
   - que `anon` no tiene acceso y que `service_role` sigue escribiendo;
   - que un cambio permitido sigue dejando evento de auditoría;
   - la forma de las policies y la ACL;
   - que no cambia nada más: filas, otras policies, ACL, triggers y funciones.
2. **El mismo contrato en CI**, con PGlite.
3. **Mutantes de la 0511 en la prueba**, sin el postflight propio, y uno con él.
4. `pnpm verify` completo, con la espera declarada.

**Límite de la prueba:** `audit_d1_execute` es un doble con la firma y la forma de
producción, porque la real pide toda la plataforma D1. Lo que prueba es que un DEFINER
del dueño sigue escribiendo después del revoke; el preflight comprueba en producción
que la real es DEFINER de postgres.

Aplicar en producción no es parte de esta aceptación: exige OK de Sam nombrando el
archivo, por `docs/runbooks/aplicar-migraciones-prod.md`.

## Gobernanza

| Política | Clasificación | Evidencia |
|---|---|---|
| SGE-00.05 (permisos y tenant en el servidor) | **cumplimiento** | El rol deja de ser sólo un gate de la app: lo exige la RLS. |
| SGE-00.06 (prevenir antes de informar) | **cumplimiento** | El camino por PostgREST se cierra en la base. |
| MP-01 (permanencia) | **excepción** | `accounting` y `admin` conservan el DELETE físico de asientos, que usa el rollback de `createJournalEntry`. No empeora: hoy lo tiene cualquier rol. |
| AUD-01, AUD-02 (auditoría) | **cumplimiento** | `audit_d2_journal_entries` no cambia; el contrato comprueba el evento de un cambio permitido. |

## Fuera de alcance detectado

1. **`accounting` y `admin` todavía pueden alterar un asiento asentado por PATCH a
   `journal_entries`.** Las reglas de estado viven en la app y en las guardas de la
   0497; un trigger de máquina de estados para asientos manuales es otra tarea.
2. **Hay más tablas con el mismo patrón sin medir.** `company_offices` (0190) es la
   hermana directa. Conviene un barrido por catálogo de todas las policies FOR ALL que
   sólo pidan el tenant, en lugar de ir tabla por tabla.
3. **La lectura de asientos es de todo el equipo**, incluido marketing. Es la deuda
   deliberada de la 0407, y para cerrarla hay que revisar qué módulos consumen agregados.

## 2026-11-03 · La 0511 aplicada en producción: cierre del runbook §6

La 0511 se aplicó hoy. Lo que antes en esta spec dice que no está aplicada es de su fecha. La identidad la pasó el Director General, de la salida del apply. Este cierre no consultó producción. El md5 y los bytes sí se comprobaron contra el archivo. Detalle en `.agents/handoffs/0593-guarda-asientos-y-bancos.md`.

| Dato | Valor |
|---|---|
| COMMIT | 2026-11-03T17:03:14.436Z |
| `version` del ledger | `20261103170314` |
| md5 y bytes | `f9522a5b7550940e1fc96cc3bcba776e`, 16896 |
| Filas del ledger | 503, leído por el Director General |
| Respaldo previo | `dtd-cargo-20261103T170055Z` |
| Evidencia | `/srv/ops/evidencias/apply-0511-dtd-cargo-20261103T170313Z` |
| Ensayo en prueba | `ensayo-0510-0511-prueba-20261103T163820Z`, 6 puntos PASÓ, según el Director General. Guardar, editar y borrar una cuenta bancaria como administrador pasó por pantalla. Punto 5: se puso una cuenta sintética con rol `operations` y se devolvió. Sin ejecutar: asientos por pantalla |
| OK literal de Sam | «Autorizo: prueba y luego producción», en el chat del Director General, a «¿Autorizas aplicar las guardas contables 0510 y 0511 en dtd-cargo y fusionar sus PR #351 y #352?». Condición: primero en prueba, comprobando guardar una cuenta bancaria como administrador; si algo falla en prueba, parar y avisar |
| Merge | Lo hace el Director General después de leer el CI; su hora se registra al fusionar |
| Sello en el candado | sha256 `819e9912e1fb005cfcc1fd52cd3b7178be4a0966bf4d2bd4750154a0f8535be7`, `ledger` exacta |

La 0511 salió de `pendingBelowCutoff`. No tenía declaraciones de símbolos. Su cabecera «NO APLICADA A PRODUCCIÓN» no se corrige: la identidad se prueba por md5. Ninguna prueba afirmaba la espera, así que no cambió ninguna. La web no cambia ni se publica con este cierre.
