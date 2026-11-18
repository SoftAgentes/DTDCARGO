# Handoff · SDD-0586 · Worker 10.5 · la PR chica después del tren #499

**Rama:** `codex/0586-sistema-n1-n4`, sacada de `main` `3c14dde83`, con el tren #499 ya en main (#480, #478 y #479).
**Worktree:** `DTD-worktrees/0586-sistema-n1-n4`.
**Encargo:** el del Subdirector Chatwoot del 2026-11-11, que recoge los no bloqueantes de la revisión del DG de la #480 en `a0c32c9cc`.

## Qué trae

1. **El piso de portal-historial,** de 129 a **139** (`infra/ops/tests/pruebas-linux.sh`).
   - El 139 es el conteo real del verde de la #480 en `a0c32c9cc`: Calidad 42975327123, job 130372971294, leído con `gh api …/jobs/130372971294/logs`.
   - Esta PR suma 6 líneas PASÓ, así que el conteo esperado es 145. El piso queda en el último verde medido, 139, y se sube al conteo nuevo cuando el CI lo dé.
2. **N1:** un `SISTEMA=` vacío y exportado pasaba la guarda del entorno (`[ -z "${SISTEMA:-}" ]`).
   - **El problema:** seguía exportado, y el valor que después se lee del archivo quedaba en el entorno de los hijos (docker, psql), visible en `/proc/<pid>/environ`.
   - **El arreglo:** `unset SISTEMA` justo después de la guarda (`# guarda:sistema_unset`).
   - **La prueba:** el docker falso guarda `${SISTEMA-__sin_sistema__}` en `FALSO_ENV`. `caso_sistema_no_exportado` corre con `SISTEMA=` vacío y exige que docker no vea la variable, y que el valor no esté ahí.
   - **El mutante:** sin el `unset`, cae.
   - **En local:** con Git Bash, sin `unset` el hijo ve el valor (`9`) y con `unset` no lo ve.
3. **N2:** `contrato_solo_en_prueba`, un contrato estático en awk sobre `deshacer-vinculos.sh`.
   - **Qué exige:** que `DESHACER_SISTEMA_SHA` y `DESHACER_SISTEMA_UID` solo aparezcan dentro del `if [ "${DESHACER_PRUEBA:-}" = 1 ]; then … fi`, al menos dos veces adentro y ninguna afuera.
   - **Su mutante:** una copia con `SISTEMA_UID="${DESHACER_SISTEMA_UID:-0}"` al final, fuera del `if`.
   - **En local:** el contrato pasa con el guion real, rechaza la copia mutada y rechaza una copia sin esas variables (no pasa vacío).
   - **`limpiar.sh` no entra:** por decisión del Subdirector, ahí basta la guarda `sistema_fijo`.
4. **N4:** las marcas y los mutantes de dos guardas.
   - `# guarda:sistema_entorno` en la guarda del entorno. Su mutante cae en `caso_sistema_en_el_entorno`.
   - El 0600 de `leer_sistema` sale a su propia línea, `# guarda:sistema_0600`, para que el mutante quite solo esa condición. Cae en `caso_sistema_abierto`.

El bucle de mutantes del desarme pasa de 12 a 15 (`sistema_entorno`, `sistema_0600` y `sistema_unset`). Todos siguen la regla de base limpia de `probar_mutante`: su caso pasa primero con el guion real.

## Evidencia

- **Local, liviano:**
  - `bash -n` de `deshacer-vinculos.sh`, `prueba-portal-historial.sh` y `pruebas-linux.sh`;
  - cada marca nueva está una sola vez;
  - el contrato N2 contra el real, el mutante y la copia vacía;
  - el comportamiento de `unset` con hijos de bash.
- **No ejecutado en local:** `prueba-portal-historial.sh` entera, porque pide `/dev/shm` y la PC no tiene Docker. La corre «Calidad continua».

## Pendientes de esta tarea

- El verde del CI, y subir el piso de 139 al conteo nuevo (se espera 145) en el cierre o en la siguiente PR que toque el runner.

## FUERA DE ALCANCE DETECTADO

- **El mismo patrón de N1 y N2 en `deshacer.sh`** (#478, `:111` y `:220`): lo hace E5 en su propia PR, para no tener dos escritores en el mismo archivo.
- **Un resto en disco de `DTD-worktrees/0586-p4-lecturas-3`,** por «Filename too long» al hacer `git worktree remove`. Ya está desregistrado y su rama local borrada; está anotado en `registro-limpieza-worktrees.md`. Lo purga el Subdirector.
- **El runbook de puertas** (el orden 2→1 y los «por confirmar») espera la decisión del DG. Esta PR no lo toca.
