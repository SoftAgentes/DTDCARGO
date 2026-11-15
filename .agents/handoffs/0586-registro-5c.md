# Handoff · SDD-0586 · El registro del 5c y el cierre de la espera de la 0542

- **Rama:** `claude/docs-puerta5c-registro`, desde `origin/main` `9377e3081` (la fusión de la #577). Worktree `.claude/worktrees/docs-puerta5c-registro`.
- **Quién:** Worker de documentación, por encargo del Subdirector de Chatwoot (datos del DG, 2026-11-15).
- **Spec:** ninguna; no hace falta SDD. Es un runbook, un handoff y el retiro de una espera ya aplicada (SDD-0546), que no toca el `.sql`.

## Qué cambia

1. **El 5c, de EN CURSO a HECHO** (`docs/runbooks/chatwoot-portal-p4-puertas.md`: la tabla «Registro de las puertas», la nota de estado de la puerta 5, el sub-paso 5c y «Lo que falta»). Con lo que informó el DG:
   - Sam lo autorizó a las 08:21Z («Autorizo el smoke») y los conteos también («Autorizo los conteos»); lo hizo con su propia cuenta de cliente.
   - Se probó: el mensaje llegó a la bandeja 10; la respuesta del agente volvió al portal y Sam recibió el push; en `/studio/bandeja` la tarjeta no muestra alertas; en `/studio/conversaciones` el hilo se ve en solo lectura.
   - Sam confirmó que llegó (entre 08:26Z y 08:32Z, sin minuto exacto) y respondió que sí, todo bien, a las 08:42Z. Está parafraseado, sin comillas nuevas.
   - Conteos de la cola, misma consulta (md5 `99f7536ecb22`), en solo lectura con rollback: 08:26:12Z `cargado=78`, 26/26/26, rezagados 0/0; 08:32:43Z `cargado=78` y `enviado=1` (`max_intentos` 1), 27/27/27, el corte no cambió, rezagados 0/0. El cron `chatwoot-reintentos` corrió 6 veces en 30 minutos, con 0 líneas de error.
   - Evidencia: registro del DG, sin archivo en el VPS. Sin datos del cliente.
   - El handoff anterior (`0586-registro-puerta5.md`) apunta a este en sus dos líneas del 5c.
2. **El cierre de la espera de la 0542** (`docs/runbooks/aplicar-migraciones-prod.md` §6, SDD-0546). La 0542 se aplicó en producción el 2026-11-15 a las 08:09:18Z con COMMIT, y la #574 se fusionó a las 08:09:21Z. Pasos:
   - `node infra/ops/migraciones/retirar-espera.mjs 0542_is_platform_admin_execute_authenticated --md5 e6f1c9b137ba7eda3e7ca79e0b144da7`. El `--md5` es el `blob_md5=` de `IDENTIDAD.txt` en la evidencia del apply (`/srv/ops/evidencias/apply-0542-dtd-cargo-20261115T080917Z`), que el DG copió tal cual: la verificación contra el ledger dio código 0. Coincide con el md5 del archivo local, y el script lo exige.
   - `node scripts/migrations-lock.mjs`: 523 selladas (la mayor, la 0542), 5 esperas sin sellar, 0 nuevas sin sellar.
   - Resultado: `supabase/migrations-baseline.json` pierde solo la entrada de la 0542, y `supabase/migrations.lock.json` suma su sello (sha256 `9c4a8402…040c`, md5 `e6f1c9b1…4da7`, 6855 bytes, ledger 2026-11-15, forma exacta). Declaraciones de símbolos que quitar: 0.

## Comprobaciones

| Comprobación | Resultado |
|---|---|
| Huella de las líneas «OK nominal» (`grep 'OK nominal' <archivo> \| md5sum \| cut -c1-8`) | PASÓ: runbook `79131b41` y guion `693fb4f3`, iguales antes y después. `copia-columnas.tsv` sin tocar (md5 `cc1534a8a223e37ab9485451d5ee922c`) |
| `docs:check` | PASÓ |
| `sdd:check` | PASÓ |
| El candado de migraciones (`scripts/migrations-lock.mjs`) | PASÓ, exit 0 |
| Su prueba (`node --test scripts/tests/migrations-lock.node.mjs`) | PASÓ: 23 de 23 |
| El gate de símbolos (`scripts/check-pending-migration-symbols.mjs`) | PASÓ: 0 ROJO, 3 AMARILLO declarados (las esperas que siguen) |
| El `.sql` de la 0542 | Sin tocar: md5 `e6f1c9b137ba7eda3e7ca79e0b144da7`, 6855 bytes |
| Las otras esperas (0528, 0538, 0539, 0540, 0541) | Intactas en el baseline |
| Pruebas que afirmen la espera de la 0542 | Ninguna: `retirar-espera.mjs` no marcó nada para revisar a mano |
| `pnpm verify`, vitest, build, Docker | NO EJECUTADO (la PC está justa; las pruebas de producto no aplican a un cambio de runbook y de metadatos de migraciones) |
| La gate `migrations-applied` | NO EJECUTADO: necesita las credenciales de producción. La mide el CI de la PR |

## Pendientes de esta tarea

- La revisión y la fusión de la PR, que hace el DG. Esta PR toca `supabase/`, así que su CI corre más que el de una PR solo de documentación.

## FUERA DE ALCANCE DETECTADO

- La cabecera «NO APLICADA A PRODUCCIÓN» del `.sql` de la 0542 se conserva a propósito (§6, punto 2): el ledger guarda el texto exacto.
- La spec 0633 sigue en `in-progress`, que es la norma para una spec fusionada. No se tocó.
- Las pruebas pendientes de la #567 (G8, R4 y los restos tras un KILL) siguen para una PR de pruebas (ver `0586-desarme-ensayo.md`).

## Impacto documental

- Cambian el runbook de las puertas (el 5c y «Lo que falta») y el handoff `0586-registro-puerta5.md` (dos líneas). `docs/runbooks/aplicar-migraciones-prod.md` se siguió tal cual, sin cambios.
- No hay conocimiento nuevo que proponer: el procedimiento de la huella de los «OK nominal» ya quedó anotado en `0586-registro-puerta5.md`.
