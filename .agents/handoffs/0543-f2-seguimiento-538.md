# Handoff 0543 · F2 · Carga del 63 y seguimiento de la #538

- Fecha: 2026-11-14 (Caracas = UTC − 4)
- Worker: la sesión de la #534 y la #538, abierta por el Subdirector Portal
- Worktree: `.claude/worktrees/0543-f2-seg538`, creado con `git worktree add`
- Rama: `claude/0543-f2-seguimiento-538`, desde `origin/main` en `4c5c39581`
- SDD: [0543](../../docs/specs/0543-consolidados-en-camino/spec.md), sigue `in-progress`; nota en «Seguimiento de la #538»
- Antecedentes: [0543-f2-produccion-61-63](0543-f2-produccion-61-63.md) y [0543-f2-seguimiento-534](0543-f2-seguimiento-534.md)
- Permisos:
  - Push de la rama y PR lista (no borrador), autorizados por el Subdirector el 2026-11-14 con el visto bueno del DG.
  - Sin merge.
  - Nada en producción ni en el VPS. El script del servidor no se reinstala en este encargo.
  - Sin `pnpm verify` local: el portón es el CI de GitHub más la revisión independiente.

## 1 · Carga del 63 (registro; se hizo fuera de esta PR)

Esto reemplaza las notas fuera del repo (`f2-handoff-carga-63-pendientes.md`) y no lleva nombres de clientes ni datos del Excel.

- Paquete **v3** de producción, generado desde `dcd226aad` con `--contenedor 63 --modalidad fcl --dueno DTD-9038 --eta 2026-12-08 --entorno produccion`.
  - LOTE_ID `carga-consolidado:63:e1ebd577`.
  - `SHA256SUMS` con sha256 `28d6a456cbffc546bb3ed0673fee77f74ff6a33b26c0219cae8ba6b5cfb0a149`.
  - `aplicar.sql` con sha256 `1a6728a1ec88fb1df5bcfc5654d9ec9b662638b5709653caeff483e8c8dcd356`.
  - Sin `deshacer.sql` ni `purgar.sql`.
  - La v2 (`…:3639981b`, ETA de octubre) quedó descartada.
- Sam confirmó el dueño el 2026-11-13: «Sí, es DTD-9038».
- Ensayo ad hoc en postgres local, modo producción (2026-11-14 00:34Z a 00:35Z): 503 migraciones, 0 FALLÓ.
  - Pasaron la previa sin el dueño (aborta en el corte), la previa, el simulacro sin filas, aplicar con 0 clientes creados, verificar, el aplicar repetido (lo frena el preflight) y la línea base.
  - Diferencias: carriers +1, ports +0.
- En producción, según el Subdirector: paso 0, previa, simulacro, aplicar y verificar PASÓ; quedó como DTD-CONSOL-0003. Esta sesión no tocó el servidor.

## 2 · OBJETIVO DE ESTA PR

1. `aplicar-lote.sh` rechaza una autorización que sea copia de `resumen.md` (`^# Lote `).
2. Runbook: `docker top dtd-cargo-db-1` en lugar de `ps` dentro del contenedor (la imagen no trae procps); `pg_stat_activity` en producción requiere el OK de Sam.
3. Candado: si el `printf` del pid falla, refuse y salir sin dejar el candado tomado.
4. Pruebas:
   - el orden de los traps;
   - el enlace roto de `deshacer.sql`;
   - el rechazo nuevo;
   - el refuse del pid.
5. Modo producción de `validar-lote-local.sh`, que reemplace al ensayo ad hoc.
6. Este handoff.

## COMPLETADO

- **`infra/ops/consolidados/aplicar-lote.sh`**
  - Rechaza (3) una autorización con una línea que empiece con `# Lote `, es decir una copia de `resumen.md`, igual que las que traen `"nombreExcel"` o `"lote":`. La regla mira solo el principio de línea, así que un OK que menciona «# Lote» a mitad de línea sigue valiendo.
  - Si el `printf` del pid en el candado falla, el guion rechaza (3) sin correr psql. EXIT suelta el candado, porque un pid vacío cuenta como propio.
  - `soltar_candado` hace `rm -f pid; rmdir` sin `&&`.
- **`infra/ops/tests/prueba-aplicar-lote.sh`**: sección 12, con cinco casos.
  - La copia de `resumen.md` se rechaza sin dejar evidencia.
  - «# Lote» a mitad de línea sigue valiendo.
  - Orden de los traps: una prueba estructural comprueba que EXIT y 129/130/143 están antes del `mkdir` del candado y del pid. Las pruebas de señal durante el paso (sección 11) siguen.
  - `deshacer.sql` como enlace roto se rechaza sin tocar docker. Solo corre en Linux.
  - pid sin escribir: rechaza, no llama a docker y suelta el candado. Se fuerza con `ulimit -f 0` y SIGXFSZ ignorada. Solo corre en Linux.
  - El piso de `pruebas-linux.sh` sube de 64 a 69.
- **`infra/ops/consolidados/validar-lote-local.sh --produccion <lote> <marca>[,<marca>…]`** reemplaza al ensayo ad hoc del 63.
  - Secuencia:
    1. la previa sin los dueños aborta;
    2. se siembran clientes sintéticos, uno por marca;
    3. previa;
    4. simulacro, con las 15 tablas sin cambio;
    5. aplicar, con «0 clientes creados»;
    6. verificar, con «verificar: PASÓ»;
    7. un segundo aplicar, que aborta en el preflight;
    8. al final, clientes y aliados sin cambio y consolidations +1. El resto se informa como delta.
  - La evidencia va a `<padre>/ensayos-local/`, fuera del paquete.
  - Las guardas salen con 2 antes de Docker:
    - el modo normal y el cruzado se niegan con un lote de producción;
    - `--produccion` se niega con un lote de prueba;
    - también se niega con un paquete que traiga `deshacer.sql` o `purgar.sql`, aunque sea un enlace;
    - y con marcas inválidas.
- **Runbook**:
  - `docker top dtd-cargo-db-1`;
  - `pg_stat_activity` en producción, solo con el OK de Sam;
  - el rechazo nuevo;
  - el pid sin escribir;
  - una fila para `--produccion`.
- **Spec 0543**: sección «Seguimiento de la #538».
- **Spec 0559**: la cita del bloque `LEDGER_ONLY` pasa de `validar-lote-local.sh:60` a `:95`. El bloque es el mismo; solo se movió hacia abajo.

## VERIFICACIÓN

| Comprobación | Resultado |
|---|---|
| Prueba bash en Linux (Ubuntu 24.04 de WSL) | **PASÓ**: 69 PASÓ · 0 FALLÓ, sin OMITIDAS |
| Prueba bash en Git Bash | **PASÓ**: 65 PASÓ · 0 FALLÓ · 4 OMITIDAS (tres de enlaces y una de `ulimit -f`). Linux cubre las cuatro |
| `bash -n` de los dos guiones | **PASÓ** |
| Guardas de `--produccion` sin Docker, en cuatro casos | **PASÓ**: sale 2 en los cuatro y no crea carpetas |
| `--produccion` sobre la v3 del 63 (`carga-consolidado:63:e1ebd577`, dueño `DTD-9038`), 2026-11-14 06:55Z, con el turno del DG | **PASÓ**: 0 FALLÓ, 503 migraciones. Ver el detalle debajo de la tabla |
| Paquete v3 después del ensayo | **PASÓ**: íntegro, `SHA256SUMS` en `28d6a456…a149`, sin archivos nuevos |
| Docker cerrado | **PASÓ**: loop-3d detenido, `docker desktop stop` y `wsl --shutdown`, sin vmmem |
| `node scripts/build-docs-index.mjs --check` y `node scripts/check-numbering.mjs` | **PASÓ** (613 specs; sin números repetidos) |
| vitest | **NO APLICA**: no hay cambios en TypeScript |
| `pnpm verify` | **NO EJECUTADO** por regla: el portón es el CI más la revisión independiente |

Detalle del ensayo `--produccion` sobre la v3:

- Los pasos de la secuencia salieron como se esperaba: la previa sin dueño abortó, el simulacro no dejó filas, aplicar dijo «0 clientes creados» y el segundo aplicar abortó en el preflight.
- Clientes y aliados sin cambio; consolidations +1.
- Deltas informativos: shipments +1, shipment_events +3, consolidation_items +1, sailings +1 y carriers +1.
- Al terminar, `docker ps -a` y `docker volume ls` dieron 0.

## FUERA DE ALCANCE DETECTADO

- **El 61 y el 62 siguen estacionados.** MG no tiene código conocido en producción, y el nombre de sus envíos lo decide Sam. Después hay que regenerarlos con `--entorno produccion` y validarlos con `--produccion`.
- **El ensayo `--produccion` no corre en el CI.** Pide un paquete real y Docker. Una variante sintética en el CI sería otra tarea; para el modo normal ya quedó anotada en la 0550.
- **El modo normal de `validar-lote-local.sh` deja la evidencia dentro del paquete.** Un `scp -r` la subiría al servidor. Se podría mover a `ensayos-local/`, como en producción.
