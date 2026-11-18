---
sdd: "0594"
title: "restore.sh recrea ensure_rls y compara los event triggers con el dump"
status: in-progress
author: "Claude Worker (Sam)"
created: 2026-11-02
updated: 2026-11-02
supersedes: null
superseded_by: null
related: ["0505", "0540", "0573"]
confidencialidad: interno
---

# DTD-0594 — restore.sh recrea ensure_rls y compara los event triggers con el dump

> Una recuperación de producción dejaba la base sin la RLS automática en tablas nuevas, y nada lo avisaba. Ahora `restore.sh` recrea el trigger o termina en error, y quien revisa no puede ver éxito sin él.

**Etiquetas de evidencia:** **M** medido, con su fecha; **C** código leído; **I** inferencia.

## Contexto

`ensure_rls` es el event trigger que activa RLS en toda tabla nueva de `public` (migración 0277). `pg_restore` no puede crearlo: corre como `supabase_admin`, crea el trigger a su nombre y supautils rechaza que un superusuario dispare `public.rls_auto_enable()`, que es de `postgres`.

- **M, 2026-10-14 y 2026-10-29.** Las dos pruebas reales de restauración (`/srv/ops/evidencias/restore-real-*.txt`) traen estos dos errores y terminan 5 PASÓ · 0 FALLÓ:
  - `Superuser owned event trigger must execute a superuser owned function`
  - `event trigger "ensure_rls" does not exist`
- **M, 2026-11-02.** Un restore sobre `--target postgres` da 2 errores, y la base queda con `ensure_rls` ausente hasta recrearlo con `set role postgres`.
- **M, 2026-11-02.** Producción sí lo tiene: `ensure_rls|postgres|rls_auto_enable()|postgres|O|{"CREATE TABLE","CREATE TABLE AS","SELECT INTO"}`.
- **C.** `restore.sh` lo dejaba como `exit 4` («advertencias») y `restore-test.sh` acepta el 4 sin mirar qué era. Nada comparaba los event triggers.

**Fuente contra lo instalado (M, 2026-11-02, solo lectura).** Los md5 de `restore.sh`, `restore-test.sh`, `restore-real-prueba.sh`, `pg-dump-to-s3.sh` y `lib/acl.sh` en `/srv/ops` son iguales a los de `infra/ops` en `7be2ed9e5`. No difieren.

## Alcance

**Sí:**

1. `restore.sh` lee el índice del dump antes de tocar el destino, restaura sin `ensure_rls`, lo recrea como `postgres` y compara la base contra el índice. Si falta algo sale con un código nuevo, el **9**.
2. `restore-test.sh` falla si faltan event triggers, si `restore.sh` no informó, si el dump trae la función sin el trigger o si una tabla nueva nace sin RLS.
3. Pruebas con dobles y control rojo.
4. Inventario de lo que se pierde igual, en el runbook.

**No:**

- Instalar en el VPS, restaurar en producción o en prueba, ni fusionar.
- Tocar `pg-dump-to-s3.sh`, `import-from-cloud.sh`, migraciones o la base.
- Arreglar `pg_cron` en base nueva: es propio de la prueba, no del DR (ver inventario del runbook).
- Vigilar `ensure_rls` en producción entre restauraciones.

## Diseño

**Sacarlo del índice en vez de tolerar el error.** `pg_restore -L` recibe el índice sin `ensure_rls`. Así un restore limpio sale 0 de verdad y no hay que aprender que «estos dos errores son normales», que es como se escondió el problema. Si el destino ya tiene el trigger se quita antes: sin su entrada en el índice, `--clean` falla al borrar la función.

**Qué se espera sale del dump, no de una lista fija.** El índice dice qué event triggers tenía el origen, con su dueño. Lo fijo es solo `ensure_rls`, con su dueño, función, estado y etiquetas, porque es el único que se recrea a mano. Una prueba compara esa definición con toda migración que lo crea.

**Se exige `ensure_rls` si el dump trae el trigger o su función.** Si solo se mirara el trigger, un origen que ya lo perdió daría respaldos que pasan sin él, y la pérdida se copiaría. Si se exigiera siempre, se rompería cualquier proyecto de la plantilla que no lo usa.

**Sin opción para saltárselo.** `--skip-acl` existe porque los permisos se pueden igualar a mano; aquí un `--skip` sería la forma de volver a ver éxito sin el trigger.

**Códigos.** 8 sigue ganando sobre 9, porque exponer la base es peor, pero se informan los dos. 9 gana sobre 4. `restore-test.sh` lee la línea de `restore.sh` en vez del código, así un 8 no le tapa la falta del trigger.

**La prueba mensual mide el efecto, no solo el catálogo.** Como `postgres`, crea una tabla en `public`, lee `relrowsecurity` y hace rollback. Tiene que ser `postgres` porque supautils no dispara estos triggers para un superusuario (**M**, 2026-11-02: como `supabase_admin`, la tabla nace sin RLS), y necesita un `grant` en la misma transacción porque `postgres` no es dueño de `restore_test`. Solo en `restore-test.sh`, que es desechable; `restore.sh` no hace DDL de prueba en un destino que puede ser real.

## Allowlist

| Archivo | Cambio |
|---|---|
| `infra/ops/backup/restore.sh` | Índice, `-L`, quitar y recrear `ensure_rls`, comparación, código 9 |
| `infra/ops/backup/restore-test.sh` | Comprobaciones nuevas |
| `infra/ops/lib/event-triggers.sh` | Nuevo: SQL y comparación |
| `infra/ops/tests/dobles-restore.sh` | Nuevo: doble de docker |
| `infra/ops/tests/prueba-restore-event-triggers.sh` | Nuevo: la prueba |
| `infra/ops/tests/pruebas-linux.sh` | Agrega la prueba al CI |
| `infra/ops/README.md` | Tabla de piezas y códigos |
| `docs/runbooks/backup-restore-servidor.md` | §3: procedimiento, salida 9 e inventario |
| `docs/specs/0594-restore-event-triggers/spec.md` | Esta spec |
| `docs/specs/README.md` | Índice generado |
| `.agents/handoffs/0594-restore-event-triggers.md` | Handoff |

## Aceptación

1. Con un dump que trae `ensure_rls`, `restore.sh` termina con el trigger exacto, sin errores de `pg_restore` por él, y sale 0.
2. Si no se puede recrear, o queda con otro dueño, sale 9 y dice `FALTAN ensure_rls`. No dice «listo».
3. Si falta otro event trigger del dump, o queda con otro dueño, sale 9 y lo nombra.
4. Restaurar encima de una base que ya lo tiene no falla.
5. Un dump ilegible para antes de tocar el destino.
6. Un dump con la función y sin el trigger: se recrea, se avisa, y `restore-test.sh` da FALLÓ.
7. Un proyecto sin `ensure_rls` ni su función no cambia de comportamiento, salvo la comparación.
8. `restore-test.sh` no puede dar 0 FALLÓ sin el trigger, con cualquier código de `restore.sh`.
9. La prueba con dobles falla sobre el código de antes (control rojo) y corre en el CI.
10. El runbook explica la salida 9 y lista lo que se pierde igual, con lo medido y lo no medido por separado.

## Estado

Implementado en la PR, sin instalar. La validación está en el handoff: `.agents/handoffs/0594-restore-event-triggers.md`.
