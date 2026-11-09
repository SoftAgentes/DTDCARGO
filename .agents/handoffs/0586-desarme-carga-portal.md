# Handoff · SDD-0586 10.7 — deshacer en Studio la carga P4 (sub-paso 4.6b)

- **Owner:** Claude Worker «10.5», en la sesión que inició el Subdirector de Chatwoot (`local_535053f4-40c2-4124-a280-63f4fc882820`).
- **Claim:** `worker-10.5-desarme`.
- **Ruta y rama:** `DTD-worktrees/0586-desarme-carga-portal`, rama `codex/0586-desarme-carga-portal`, desde `main` en `33c286e01`.
- **SDD:** [0586](../../docs/specs/0586-chatwoot-enrutamiento-segmento-e10/spec.md), §10.5.10, «10.7 · Deshacer la carga en Studio».

## Lo que decidió el DG, por el Subdirector, el 2026-11-08

- **La vuelta atrás dirigida es la principal de 4.6:** la mitad de Chatwoot la hace E5, en la 2c, y la mitad de Studio está en esta PR.
- **Es un borrado permanente:** lo corre Sam y el DG lo ensaya con `rollback`.
- **Tiene que estar en `main` y ensayado antes de que el DG pida la puerta 4.**
- **Dónde va:** `supabase/cargas/portal-historial-deshacer/`. Contratos SQL monta solo `supabase/`, y es la convención de los guiones de una sola vez.
- **Los contactos no se borran:** se vacían sus ids, salvo los conservados del archivo de E5.
- **El corte queda siempre en nulo.**
- **Se suma la guarda de entorno** de la carga de Kommo.

## Lo hecho

- **`supabase/cargas/portal-historial-deshacer/deshacer-vinculos.sql`:** `pg_temp.deshacer_vinculos()`.
  - **Las guardas,** que abortan sin escribir:
    - el entorno;
    - los parámetros;
    - el flag y su auditoría en `entity_audit_log`;
    - una salida que no está `cargado`;
    - un trigger no interno en las cinco tablas;
    - los conteos esperados y la bandeja;
    - el archivo de E5: la cabecera, el conteo y los contactos.
  - **Las escrituras:** las salidas `cargado`, el espejo, los hilos, el corte y `cargado_at`, y los ids de los contactos no conservados.
  - **La verificación,** con `raise`. `entity_audit_log` tiene que dar el mismo número antes y después.
  - **La salida:** solo `HECHO`.
- **`deshacer-vinculos.sh`:**
  - acepta solo la carpeta fija;
  - valida `MODO`, `ENTORNO`, `SISTEMA`, el tenant y los números;
  - carga el archivo de E5 por `COPY`, y lo acepta sin salto de línea final;
  - cierra con `rollback` en `MODO=ensayo` o `commit` en `MODO=aplicar`.
- **El README de la carpeta.**
- **El contrato `supabase/tests/deshacer_vinculos_portal.test.sql`:**
  - las migraciones reales;
  - una carga con las funciones reales;
  - 16 guardas, cada una sin escribir;
  - el camino feliz, con el contacto conservado;
  - la cola, que no manda nada después;
  - la reserva, que se reusa.
- **El envoltorio `lib/studio/__tests__/deshacer-vinculos-portal.test.ts`:** control rojo, 13 mutantes y la prueba estática de que no deja objetos.
- **`infra/ops/tests/prueba-portal-historial.sh`:** 9 casos del `.sh`, con el `docker` falso.
- **La spec:** el diseño, con la carpeta y el contrato.

## La revisión de la #469 sobre `9d8d8f047` (CHANGES_REQUESTED, 2026-11-08)

Contratos SQL ya había pasado en `9d8d8f047`. Lo que pidió la revisión va en un commit encima.

- **B1:** `deshacer-vinculos.sh` pone `\set VERBOSITY terse`, como `crm-kommo/correr.sh`, para que un error o un deadlock no imprima DETAIL ni CONTEXT. La prueba del `.sh` exige esa línea.
- **B2:** un caso con la marca `copia` solo en la sesión, que da «solo en la sesión», con su mutante.
- **B3:** el contrato siembra lo ajeno, que el desarme no puede tocar.
  - **Lo sembrado:** una carga vinculada completa en T2, y un espejo de otra bandeja en T1, sin hilo.
  - **La comprobación:** `pg_temp.huella_ajena()` saca su md5 antes y lo compara después de las guardas, del camino feliz y de la segunda carga.
  - **Los tres mutantes nuevos:** el borrado de salidas sin el tenant, el espejo sin el cruce con los hilos y los hilos sin el tenant.
  - **El rojo previo,** con un script suelto en PGlite: **los tres sobreviven contra el contrato de `9d8d8f047`** («GREEN: 32 aserciones») y **caen con el contrato nuevo** («la verificación no cuadra»).
  - **La huella, probada como detector** (pedido del Subdirector). Los tres de B3 caen en la verificación, así que hace falta un mutante que solo la huella pueda ver: **«borra además las salidas de otro tenant, sin contarlas»**. Es un `delete … where s.tenant_id <> p.tenant` después del `get diagnostics`, así que no mueve ningún conteo del tenant. **Cae en «no toca otro tenant (T2, con su carga vinculada) ni el espejo de otra bandeja de T1».**
    - **El combinado** tal como se propuso primero (sin la verificación, y las salidas de todos los tenants) no sirve para esto. Cae antes, en «deshace e informa solo conteos», porque el `HECHO` dice `salida=4` y no `salida=3`.
- **N1:** `for update` sobre la fila del flag, al principio.
- **N2:** la carga es ahora `pg_temp.cargar()`, y corre una segunda vez después de deshacer: da 2/2/3, y el contacto conservado mantiene su id.
- **N3:** cinco mutantes más: los parámetros, el entorno `otro`, la cabecera, «una sola cabecera» y el conteo de los conservados.
  - **Dos van sin mutante propio, a propósito:** el bloque de verificación y la igualdad de `entity_audit_log`. Sin otro defecto en el guion no se disparan, y la guarda de los triggers impide el único camino que movería la auditoría.
  - **La verificación sí queda probada:** dos mutantes caen justo en ella, «no deja el corte en nulo» e «ignora el archivo de E5», y también los tres de B3.
- **N4:** los casos del `.sh` para `numero_invalido` y `barra_invertida_en_los_conservados`.
- **N5:** el README dice que un encendido por SQL directo no deja auditoría y que la guarda de la salida lo cubre solo en parte. También explica el `for update`.

## Validación

| Comprobación | Estado |
|---|---|
| `docs:check` | PASÓ |
| `bash -n` del `.sh` y de la prueba | PASÓ |
| `prueba-portal-historial.sh` en una copia apuntada a una carpeta temporal (Git Bash) | Los 9 casos nuevos PASÓ. Los 3 FALLÓ de siempre son los permisos y el enlace, que NTFS no emula. Se mide en Calidad |
| El control C4 cubre `supabase/cargas/` | Sí: `scripts/ci-sql-tests-control.sh:117` copia la carpeta entera |
| El envoltorio (turno del Subdirector, 1 worker, reporter por defecto) | PASÓ: 16 de 16, exit 0. El contrato, el control rojo, los 13 mutantes (cada uno cae en la aserción de su regex) y la prueba estática. La primera corrida cayó entera por un `\set` sin la barra en la línea 1 del contrato, que el `node -e` de Git Bash se comió. Corregido |
| `tsc --noEmit` y ESLint sobre el envoltorio | PASÓ: exit 0 los dos |
| **Revisión de la #469:** el rojo previo de B3 (`rojo-b3.mjs`, en el scratchpad) | Los 3 mutantes SOBREVIVEN contra el contrato de `9d8d8f047`, y CAEN contra el nuevo |
| **Revisión de la #469:** el envoltorio con el contrato nuevo (turno del Subdirector, 1 worker) | PASÓ: 26 de 26, exit 0. El contrato, el control rojo, 23 mutantes, con el de la huella, y la prueba estática |
| **Revisión de la #469:** `tsc --noEmit` y ESLint | PASÓ: exit 0 los dos |
| **Revisión de la #469:** `prueba-portal-historial.sh` en una copia temporal | 53 PASÓ. Los 3 FALLÓ de siempre son los de NTFS. Los 3 casos nuevos del `.sh` pasan |
| `spec-migration-refs.test.ts` y el gate | PASÓ: 5 de 5, y 0 rojos y 0 amarillos |
| El contrato en Postgres 17 (Contratos SQL) | En Actions, con la PR |
| `pnpm verify` | NO EJECUTADO, por la regla de la máquina |

## Pendientes de esta tarea

- **El visto bueno del DG** sobre el cambio. Después, el push aparte y la PR en borrador.
- **El runbook (3.0 y 4.6b)** ya apunta a la carpeta, en el commit `bebf4d119` de su rama.

## FUERA DE ALCANCE DETECTADO

- **Deshacer después de encender:** no hay marca para distinguir lo que vinculó la cola de lo que vinculó la carga. El guion se niega.
