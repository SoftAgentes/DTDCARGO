# Handoff · SDD-0586 §10.5.10 · lecturas, tercera parte (después del tren 10)

- **Rama:** `codex/0586-p4-lecturas-3`, desde `origin/main` `793ee2c17` (con la #477). Worker 10.5, claim `worker-10.5-lecturas-3`.
- **Encargo:** el Subdirector Chatwoot. Trae dos cosas:
  - los 7 puntos de la revisión del DG a la #477;
  - los tres NO VERIFICABLE de la revisión `revisar-datos-ve` de la 2b, que corrió E5, con la medición de root del DG.
- **Plazo:** los puntos 3, 4 y 5 tienen que estar en `main` antes de que el DG le presente a Sam la puerta 3.0.

## Qué trae

### Runbook `docs/runbooks/chatwoot-portal-p4-puertas.md`

1. **La nota de la puerta 3:** ya no dice «la 2b no está escrita». Dice que la 2b es la #473 y que todavía no está en `main`.
2. **Las marcas ‹por confirmar hasta que la #473 esté en `main`›** van también en:
   - las migraciones de la G0, con `MIGRACIONES` y el montaje;
   - la G1 y `TIMEOUT_STOP_MIN_S`;
   - los valores por defecto;
   - las 10 migraciones presentes;
   - los cuatro `zz_dtd_*.rb`.

   Son 7 marcas en total.
3. **El verde del tren 9:** el run del árbol de `main` es el 42542272642, sobre `0b749ac74`. Está `success` y su árbol es idéntico al de `e74cde6fc` (comprobado). El código se cita por símbolo: `bajar_detalle_del_log!` y `DETALLE_DEL_LOG`, que siguen en `cargar-portal.rb` en `793ee2c17`. El run 42533753896 ya no aparece.
4. **El 3.0:**
   - «Qué escribe» lista los cuatro pasos: la carpeta, `migraciones/` con su `install -d` y su `scp`, los dos archivos de deshacer y el `chmod`.
   - El `chmod -R go-rwx` va al final, en un bloque aparte, después de las migraciones.
   - «Para seguir» mira también el modo: `stat` 700 y `find -perm /077` igual a 0.
5. **Los pasos a mano:** suman los cuatro `zz_dtd_*.rb` en `$CHATWOOT_DIR/rails/`, que también exige la G0.
6. **Puerta 1:** dice quién tiene root, con la línea literal del DG del 2026-11-09 ~02:10Z y su detalle sin identificadores. Si eso cambia, se vuelve a medir y aplicaría la PIPL.
7. **Puerta 2, «Para seguir»:** el 0 del equipo de China vale entre los administradores y entre los agentes de la cuenta 1, que es la condición de la #455.
8. **Puerta 3, 3.1:** si el ensayo muere por KILL o sin su `trap`, se corre `--limpiar` y la prueba de borrado antes de cualquier otro paso. Va en «Para seguir» y en la vuelta atrás.

### Prueba `lib/studio/__tests__/portal-historial-lecturas.test.ts`

- **PISO:** `CASOS` 4, `MUTANTES` 4 y `MUTANTES_SIEMBRA` 5.
- **Los mutantes de la siembra** dan exactamente 1 línea.
- **La prueba estática** prohíbe además `commit`, `do`, `read write`, `\!`, `\o` y cualquier llamada `chatwoot_portal_*(`. Esas son las funciones de la carga y de la cola, que escriben.

## Evidencia

| Comprobación | Estado |
|---|---|
| `docs:check` | PASÓ (600 specs) |
| Las tablas del runbook tienen el mismo número de celdas por fila | PASÓ (0 filas mal) |
| Los patrones nuevos sobre las dos lecturas | 0 coincidencias |
| Los 6 casos prohibidos contra los patrones (`commit`, `do`, `read write`, `\!`, `\o`, `chatwoot_portal_tomar(`) | atrapados |
| Huellas o claves en el runbook | 0. Solo aparece el texto «sha256:» que ya estaba. |
| vitest `portal-historial-lecturas.test.ts` (`--maxWorkers=1`, reporter por defecto) | PASÓ: **25/25**, exit 0. Cubre lo de abajo. |
| El PISO (`CASOS` 4, `MUTANTES` 4, `MUTANTES_SIEMBRA` 5) | Se cumple |
| El control rojo | Pasa |
| Los 6 mutantes de la #475 | Caen |
| Los 5 mutantes de la siembra | Sobreviven sin la siembra y caen con ella, con exactamente 1 línea |
| `tsc --noEmit -p .` | PASÓ, exit 0 |
| ESLint del archivo de prueba | PASÓ, exit 0 |
| `pnpm verify` | NO EJECUTADO. El cambio es de docs y de una prueba; el portón es el CI. |
| `sdd:check` | NO EJECUTADO. `pnpm -s sdd:check` solo imprimió «try '--help'», y la spec no se toca. |

## Pendientes de esta tarea

- **Cuando la #473 entre a `main`:** quitar las 7 marcas en la pieza siguiente.
- **Publicar** con el OK, después de mandar el SHA y el `--stat`.

## Impacto documental

- Cambian el runbook de las puertas y la prueba de las lecturas. La spec no se toca, así que `spec-migration-refs` no aplica.

## FUERA DE ALCANCE DETECTADO

- **Un resto en disco** de la limpieza de la #477: `DTD-worktrees/0586-p4-lecturas-2`, por «Filename too long». Ya no está registrado, y su rama se borró local y remota. Lo purga el Subdirector.

## Vuelta de la revisión (CHANGES_REQUESTED en 998bdd6e7), preparada en local

**Bloqueantes:**
1. **El 3.0 entero bajo el OK:**
   - el `scp` literal de `deshacer-vinculos.*`;
   - `supabase/cargas/portal-historial-deshacer/` en «Para seguir»;
   - la pregunta literal del OK;
   - `deshacer.sh` y su `.rb` marcados ‹por confirmar hasta la #478›, fuera de este 3.0;
   - la copia desde un checkout limpio (`git worktree add --detach` y `status --porcelain --ignored` en 0).
2. **Las marcas de la #473:** también en el `trap`, la prueba de borrado, la vuelta atrás de la 1a y el comando, el «Para seguir» y la vuelta atrás de la 3.1. Ahora son 14.
   - El formato de la prueba de borrado ya está corregido: `HECHO limpieza=contenedores=0,volumenes=0,redes=0`.

**No bloqueantes:**
- **Puerta 1:** `ubuntu` no entra con contraseña.
- **Puerta 2 y E.1:** el OK y el «Para seguir» nombran a los agentes.
- **3.1:**
  - lista lo que escribe en el VPS;
  - exige `HECHO limpieza_completa=si` y que `HECHO unidad` no sea `ninguna`;
  - dice «nunca `--limpiar` durante la puerta 4».
- **Las fotos:** «P1 a P3» pasa a «P0, P2 y P3», en las dos menciones.

**La prueba:**
- `toHaveLength(1)` donde había un `[0]` solo.
- La estática pasa a ser la función `prohibiciones()`, con su CONTROL de 15 guiones sintéticos:
  - incluye `end;`, `transaction_read_only`, `set_config(`, `\w`, `\g`, `\gexec`, `\i`, `\o` a mitad de línea, `\!`, `append_audit_event(` y `chatwoot_portal_*(`;
  - comprueba además que no haya nada después del `rollback;` y que el `rollback;` no falte.
- Medido con node, sin vitest: 0 falsos positivos en las dos lecturas y 0 escapes en los 15.

**Falta, antes de correr con turno y publicar una sola vez:** alinear la 3.1 y el formato de `HECHO limpieza` con la cabeza nueva de la #473, cuando esté en verde. Ahí también cambian `--limpiar` con su guarda, A2, la G0 (`correo/views`), y se suman C-10, C-12 y C-13.

### La secuencia del 4.6b, de `0586-p4-2c-orden-4-6b.md` (E5, revisada por el Subdirector)

- **En el runbook,** el 4.6b reemplaza el orden viejo por estas piezas:
  - la tabla de los pasos 1, 1b, 2, 3, 4 y 5, con quién corre cada uno, qué hace, qué exige y qué pasa si falla;
  - los archivos y la copia durable;
  - los comandos literales;
  - la comprobación del flag después del 4, con `cola-y-flag.sql`: tiene que dar `flag_encendido=0`;
  - los OK nominales de Sam para los pasos 3, 4 y 5;
  - y el «Para seguir» con `HECHO cierre_4_6b=ok`.
- **Las marcas:** lo de la #478 va ‹por confirmar hasta la #478›, y lo de la #480, ‹por confirmar hasta la #480›.
- **En la spec,** `:780` resume la secuencia, la regla del DG si falla el 4 y la copia durable. No cita ningún `NNNN_*.sql`: medido sobre el diff, 0.
- **La condición del DG:** la #479 no entra antes que la #478 ni que la #480.

### El destino externo es B2, no R2 (medido por el DG el 2026-11-09, hacia las 04:55Z, sin leer credenciales)

- **`docs/runbooks/backup-restore-servidor.md`:** las 4 apariciones de `r2:dtdcargo-backups/db`, en las líneas 85, 86, 185 y 187, pasan a `b2:dtdcargo-respaldos/db`.
  - Arriba del bloque va una nota con la medición: `rclone.conf` tiene solo `[b2]`, y `backup.sh` usa ese remoto por defecto.
  - **La línea 402,** `r2:dtdcargo-storage` (la copia del storage), **no se toca:** el DG no la midió. Va en FUERA DE ALCANCE.
- **El 4.1 del runbook de las puertas:**
  - Studio corre `backup.sh` y sube a `b2:dtdcargo-respaldos/db`;
  - Chatwoot corre `respaldo.sh` y sube a `b2:dtdcargo-respaldos/chatwoot`;
  - el plan de recuperación es B2 cifrado con age, y el de Contabo no cuenta mientras esté degradado;
  - «Para seguir»: cada respaldo sale con 0, con su archivo local posterior al inicio de la ventana.

**FUERA DE ALCANCE DETECTADO:** la línea de `backup-restore-servidor.md` que hace el `rclone sync r2:dtdcargo-storage …` semanal (era la `:402`; hoy es la `:406`).
- **Su marca:** ‹vencido: el storage de Studio corre en file y no se copia; ver tarea aparte›. Medido por el DG el 2026-11-09 ~05:10Z.
- **Lo que midió:** el storage corre con `STORAGE_BACKEND=file`, no hay remoto `r2`, y nada corre ese `rclone sync`.
- **Lo que no se hace aquí:** en esta PR no se corrige ni se borra. Es un tema de respaldos de producción, fuera de P4, y el DG se lo plantea a Sam como tarea propia.

### La revisión de la #473 (APPROVED), N5 y N3, medida en `2585e945f`

- **N5:** en el runbook ya no queda ningún «P1 a P3». Todas pasaron a «P0, P2 y P3».
- **N3:** «pasan C-1 a C-14» se reemplaza por tres listas debajo de la tabla de la 3.1.
  - **Lo que mide el ensayo,** con los ids que imprime el guion (`PASÓ  V10 — …`): `P0`, `P2`, `P3`, `A1` a `A7`, `S1`, `S2`, `D2`, `O1`, `E0`, `E1`, `E2`, `V10`, `V12`, `V13`, `CA`, `B1`, `B2`, `C1` a `C3` y `K1` a `K3`, con el C-x de la spec que cubre cada uno.
  - **Lo que se comprueba aparte:** C-1 en 4.2. C-10 «uno por cliente», C-13 «con su nota» y la nota de C-2, en el contrato de la 0523.
  - **Lo que queda solo declarado:** C-4, C-5 en producción, la segunda mitad de C-9, C-11 y C-14.
- **La 3.1, alineada con `2585e945f`:**
  - la prueba de borrado lleva `HECHO limpieza=contenedores=0,volumenes=0,redes=0`, `limpieza_carpetas=ausente,ausente` y `limpieza_completa=si`;
  - la guarda de `--limpiar` no toca `/dev/shm/portal-historial` si no hay un ensayo que limpiar;
  - `HECHO unidad` y `postgres:17` se comprobaron.

### La evidencia de la vuelta, con turno del Subdirector (2026-11-09)

| Comprobación | Estado |
|---|---|
| vitest `scripts/__tests__/spec-migration-refs.test.ts` (`--maxWorkers=1`) | PASÓ: 5/5, exit 0 |
| vitest `portal-historial-lecturas.test.ts` (`--maxWorkers=1`, reporter por defecto) | PASÓ: **26/26**, exit 0. Incluye la estática con `prohibiciones()`, su CONTROL de 15 guiones sintéticos (con su piso), «después del rollback» y «sin rollback»; el PISO de 4 / 4 / 5; los 6 + 5 mutantes; el control rojo; y `toHaveLength(1)` en los tres `[0]` |
| `tsc --noEmit -p .` | PASÓ, exit 0 |
| ESLint del archivo de prueba | PASÓ, exit 0 |
| `docs:check` | PASÓ (600 specs). Ninguna tabla del runbook quedó con las celdas mal |
| `pnpm verify` | NO EJECUTADO. El cambio es de docs y de una prueba; el portón es el CI. |

### Merge de `origin/main` `49f15594d`, después de que entró la #482

- **El conflicto:** salió en `docs/runbooks/backup-restore-servidor.md` §5. Me quedé con la versión de la #482, que es el respaldo diario real del Storage (SDD-0620).
- **La marca ‹vencido: el storage de Studio corre en file…›** desaparece con ese bloque, como pidió el Subdirector. El FUERA DE ALCANCE de arriba queda resuelto por la #482.
- **La nota del B2 del §2** (`b2:dtdcargo-respaldos/db`, medido por el DG) sigue tal cual, sin conflicto.
