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

## Validación

| Comprobación | Estado |
|---|---|
| `docs:check` | PASÓ |
| `bash -n` del `.sh` y de la prueba | PASÓ |
| `prueba-portal-historial.sh` en una copia apuntada a una carpeta temporal (Git Bash) | Los 9 casos nuevos PASÓ. Los 3 FALLÓ de siempre son los permisos y el enlace, que NTFS no emula. Se mide en Calidad |
| El control C4 cubre `supabase/cargas/` | Sí: `scripts/ci-sql-tests-control.sh:117` copia la carpeta entera |
| El envoltorio (turno del Subdirector, 1 worker, reporter por defecto) | PASÓ: 16 de 16, exit 0. El contrato, el control rojo, los 13 mutantes (cada uno cae en la aserción de su regex) y la prueba estática. La primera corrida cayó entera por un `\set` sin la barra en la línea 1 del contrato, que el `node -e` de Git Bash se comió. Corregido |
| `tsc --noEmit` y ESLint sobre el envoltorio | PASÓ: exit 0 los dos |
| `spec-migration-refs.test.ts` y el gate | PASÓ: 5 de 5, y 0 rojos y 0 amarillos |
| El contrato en Postgres 17 (Contratos SQL) | En Actions, con la PR |
| `pnpm verify` | NO EJECUTADO, por la regla de la máquina |

## Pendientes de esta tarea

- **El visto bueno del DG** sobre el cambio. Después, el push aparte y la PR en borrador.
- **El runbook (3.0 y 4.6b)** ya apunta a la carpeta, en el commit `bebf4d119` de su rama.

## FUERA DE ALCANCE DETECTADO

- **Deshacer después de encender:** no hay marca para distinguir lo que vinculó la cola de lo que vinculó la carga. El guion se niega.
