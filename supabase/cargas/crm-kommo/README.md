# supabase/cargas/crm-kommo — carga de la 6.5: Kommo al CRM propio

Diseño y decisiones: la SDD hija de la 6.5 del programa SDD-0582 (E6). Contrato del CRM: SDD-0587 §5 y §7.

**No es una migración.** `carga.sql` define `pg_temp.crm_carga_kommo(tenant, corte, días, entorno)`, que muere con la
sesión, y no deja objetos en la base. Lee el espejo `kommo_*` de Studio y escribe solo `crm_tarjetas`,
`crm_historial_etapas`, `crm_tareas` y `crm_ids_externos`. **No llama a Kommo, a Chatwoot ni a Meta**, y la
salida son solo conteos.

## Uso

```sh
# Archivo de servicio de libpq en tmpfs, 0600, con la sección [dtd] (host, port, dbname, user, password).

# En la copia efímera, después de restaurar y antes de nada: la marca que el cargador compara con --entorno.
psql -X -c "alter database <copia> set dtd.entorno = 'copia'"
correr.sh seco   --entorno copia --servicio /dev/shm/dtd-pg.conf --tenant <uuid> --corte 2026-12-01T03:00:00Z
correr.sh cargar --entorno copia --servicio /dev/shm/dtd-pg.conf --tenant <uuid> --corte 2026-12-01T03:00:00Z --confirmo-ok-de-sam

# En producción no hay marca, y nadie la escribe. Además se identifica en positivo: --sistema es el
# system_identifier que trae el runbook, y la función lo compara con pg_control_system().
correr.sh seco   --entorno produccion --sistema <del runbook> --servicio /dev/shm/dtd-pg.conf --tenant <uuid> --corte 2026-12-01T03:00:00Z
rm -f /dev/shm/dtd-pg.conf
```

`--entorno` es obligatorio, y con `produccion` también `--sistema`. Si no coinciden con la base, la función aborta
antes de leer nada. Si el rol no puede leer `pg_control_system()`, también aborta. psql
corre con `\set VERBOSITY terse`: un error sale sin DETAIL ni CONTEXT, que podrían traer valores de una fila.

| Modo | Termina en | Para qué |
|---|---|---|
| `seco` | `rollback` | Los mismos conteos que la carga, sin dejar nada |
| `cargar` | `commit` | La carga. **En producción, solo con el OK nominal de Sam** y después del respaldo |

Repetir `cargar` con el mismo corte no cambia nada: es idempotente por `crm_ids_externos`. Una tarea nueva en un
lead ya migrado entra en la corrida siguiente.

**Cada corrida contra una base con datos reales pide su OK**, también el seco (lee producción): L1, ensayo en
copia efímera, seco y carga, en ese orden (SDD de la 6.5, §9).

## Pruebas

- `supabase/tests/crm_carga_kommo.test.sql`: contrato con las migraciones reales y datos inventados. Corre en
  Postgres 17 en Actions (`.github/workflows/sql-tests.yml`) y en `pnpm verify`.
- `lib/studio/__tests__/crm-carga-kommo.migration.test.ts`: el mismo contrato en PGlite, control rojo,
  mutantes y una prueba estática (sin llamadas afuera, sin escrituras fuera de `crm_*`, sin objetos que queden).
