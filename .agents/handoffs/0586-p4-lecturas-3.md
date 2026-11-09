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
