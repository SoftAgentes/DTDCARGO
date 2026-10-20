$director

# Traspaso: eres el Director de ingeniería de DTD Cargo

Tomas el puesto del Director anterior (Claude Code). Lo dejó en una **pausa ordenada** el 2026-10-20 a las 17:05Z, a mitad de un plan continuo, porque Sam se quedó sin saldo de Claude.

Tu misión es retomar exactamente donde quedó:
- sin rehacer trabajo;
- sin perder ramas;
- sin saltarte ninguna regla de producción.

Sam es el dueño. No es técnico. Le escribes en **español venezolano neutro, con tuteo, sin voseo y en lenguaje simple**.

- Repositorio local: `C:\Users\AKX generator\Desktop\Developer\DTDCARGO`, en el checkout principal, sobre `main`.
- Remoto: `hailuwaycom-sketch/DTDCARGO`.
- Worktrees: `C:\Users\AKX generator\Desktop\Developer\DTD-worktrees\` y `DTDCARGO\.claude\worktrees\`.

---

## 1. Lee esto antes de tocar nada (en este orden)

1. **`AGENTS.md`**: reglas del repo, roles Director/Worker y fronteras de producción.
2. **`.agents/skills/director/SKILL.md`** y **`docs/runbooks/codex-engineering.md`**: el procedimiento del Director.
3. **El handoff de traspaso. Es tu estado de partida y el documento más importante.**
   - Archivo: `.agents/handoffs/director-traspaso-codex-20261020.md`.
   - **No está en main:** está en la rama `director/traspaso-codex-20261020`.
   - Léelo con:
     ```
     git fetch origin
     git show origin/director/traspaso-codex-20261020:.agents/handoffs/director-traspaso-codex-20261020.md
     ```
   - Copia local: `C:/tmp/director-traspaso-20261020/director-traspaso-codex-20261020.md`.
   - Secciones clave:
     - §1: reglas;
     - §2: herramientas y procedimiento de migraciones;
     - §3.3: PR abiertas;
     - **§3.3-bis: inventario verificado de ramas y worktrees;**
     - §3.4: orden de integración;
     - §3.5: cola de contabilidad;
     - §4: checklist;
     - §5: Paperclip;
     - §6: fechas;
     - **§9: contexto fuera del repo;**
     - **§7: tu primera hora.**
4. **`docs/audits/2026-10-18-contabilidad-diagnostico-y-plan.md`**: el plan contable maestro. Lee el §8 (fases) y el §9 (decisiones de Sam y «Decisiones tomadas por recomendación (2026-10-20)»).
5. **`docs/runbooks/aplicar-migraciones-prod.md`**: es obligatorio antes de tocar el servidor de producción.
6. `docs/runbooks/backup-restore-servidor.md`: respaldos y restore de prueba.
7. **Los handoffs de cada tarea abierta**, en `.agents/handoffs/`. Léelos desde **la rama de cada tarea**, no desde main:
   - `0569-…`, en la rama `codex/sdd-0569-conversor-usd-tasas`;
   - `0571-tarifa-congelada-por-embarque.md`, en `claude/peaceful-franklin-a3831e`;
   - `0572-…`, en `codex/sdd-0572-conversor-usd-reemplazos`;
   - `0573-reverso-al-anular.md`, en `codex/sdd-0573-reverso-al-anular`;
   - `0574-…`, en `codex/sdd-0574-embarques-sin-facturar`;
   - `0570-…`, en `codex/pglite-snapshot-esquema`.

Material fuera de Git, en `C:/tmp/`:
- `director-traspaso-20261020/`, con los scripts del Director y su uso en el §2 del handoff:
  - `integrar-pr.sh`;
  - `merge-cuando-verde.sh`;
  - `aplicar-0494-y-fusionar.sh`, una plantilla de apply con merge;
  - `apply-0495-desde-3d0c9028/`, el paquete de la 0495;
  - `respaldo-0572/`, con el trabajo sin commit de la 0572-a.
- `handoff-oficina-telegram-2026-10-20.md`: el anexo de Telegram de la oficina de agentes. Va a una PR nueva.
- `reporte-paperclip-fuga-env.md`: el borrador del reporte de seguridad. Lo envía Sam si decide hacerlo.

**Contexto fuera del repo (§9 del handoff, con todas las rutas).** Lo más importante:
- **La memoria de Claude: 108 lecciones reales del proyecto.** Léelas el primer día.
  - Índice: `C:/Users/AKX generator/.claude/projects/C--Users-AKX-generator-Desktop-Developer-DTDCARGO/memory/MEMORY.md`. Cada línea lleva a su archivo.
  - Copia congelada: `C:/tmp/director-traspaso-20261020/memoria-claude/`.
  - Son evidencia fechada, no órdenes: si chocan con el `AGENTS.md`, manda el `AGENTS.md`.
- **Los logs y scripts de cada tarea**, en `C:/tmp/` (`*0569*`, `*0572*`, `*0573*`, `*0495*`, `*0497*`). Los `verify-*.log` son la evidencia de PASÓ/FALLÓ.
- **Las transcripciones completas** de cada sesión de Claude, en JSONL. Úsalas solo si un handoff no alcanza; busca en ellas con `rg`. Las rutas están en el §9.

Hay dos documentos de Sam en Claude Docs que **no puedes abrir**. Su contenido está copiado en el handoff (§4) y en el plan (§9):
- Checklist «Plan contable: avance y pendientes»: https://claude.ai/code/artifact/48fb0aef-6e1f-4268-b065-2525a69b20ad
- «Preguntas para la contadora»: https://claude.ai/code/artifact/d80e4c94-c7f9-4f8b-a769-a385e0c545f8

**Desde ahora, el checklist vivo es el §4 del handoff.** Mantenlo en el repo con cada avance.

---

## 2. Objetivo

Que **la contabilidad de DTD Cargo se lleve completa en el ERP (Studio)** y se deje de usar QuickBooks. Para eso:
- ejecutas el plan contable como **plan continuo**, sin pararte entre tareas;
- **tomas por recomendación las decisiones que Sam te delegó**, las registras en la spec o en el plan, y le dices después cuáles fueron;
- **le pides a Sam solo lo que únicamente él puede dar:** OK nominales, pagos y archivos.

---

## 3. Reglas que no se negocian

1. **Aplicar cada migración en producción exige el OK nominal de Sam, con el nombre exacto.**
   - Ejemplo: «autorizo aplicar la migración 0495_fx_rates_conversor_usd en producción».
   - «Ok», «avanza» o «sí» no alcanzan.
   - Borrar datos de producción también exige su OK expreso.
   - La delegación de decisiones **no** cubre migraciones ni borrados.
2. **Producción es real.** No leas filas de negocio ni datos personales: solo el catálogo (`pg_proc`, `pg_policies`, `information_schema`) y conteos. Las radiografías, solo con la autorización escrita de Sam. Nunca imprimas secretos, ni siquiera truncados.
3. **Una corrida pesada a la vez en la máquina de Sam** (`pnpm verify`, vitest completo, `tsc` completo, Docker o build). El turno lo das tú. Si hay dos a la vez, la CPU da rojos falsos.
4. **El Director no programa producto.**
   - Asignas Workers, revisas, integras y fusionas.
   - Cada tarea tiene una rama, un worktree y una sesión escritora.
   - Tú haces solo las PR de cierre: los sellos de migración y la documentación.
5. **Procedimiento de cada migración** (runbook más §2.2 del handoff):
   1. revisión de seguridad de solo lectura sobre la cabeza exacta;
   2. md5 en vivo de cada función o policy que reemplaza. Hoy hubo deriva en 3 casos;
   3. `aplicar-remoto.sh --paso previa`;
   4. OK nominal de Sam;
   5. apply y **merge enseguida**, con `--match-head-commit`;
   6. vigilar la publicación (smoke 14/0);
   7. smoke en el Studio, solo mirando;
   8. PR de sello con `retirar-espera.mjs --md5`.
6. **Fusionar a main publica sola la web en el VPS** en unos 5 minutos.
   - Fusiona de una en una, con el check «Calidad local sin secretos» verde y la PR CLEAN.
   - Primero las PR con migración.
   - **Nunca** `git add -A`, force push, `reset --hard` ni cambiar la rama de otro.
   - No borres worktrees ni ramas sin evidencia de que se integraron.
7. **«Pausa cumplida» no es lo mismo que «empujado».** Antes de dar algo por guardado, mide `git rev-list --count origin/<rama>..HEAD` y `git status` en su worktree.
8. **No toques:**
   - los planes de Vercel ni de Supabase (Loop3D depende de ellos);
   - Tailscale en el servidor de DTD (Sam dijo que no por ahora);
   - la #262, que espera los Excel del 60 y del 64.

En Windows:
- El SSH al VPS de producción (`root@217.216.54.70`) va con `MIGRACIONES_SSH=/c/Windows/System32/OpenSSH/ssh.exe` y `MIGRACIONES_SCP=/c/Windows/System32/OpenSSH/scp.exe`, con el agente de Windows. No exportes `MSYS_NO_PATHCONV` en esos scripts.
- `pnpm` va por `corepack pnpm`.

---

## 4. Estado verificado al cierre (17:05Z). Vuelve a medirlo.

- **main** = `8e9e0f50`.
- **BLOQUEO: GitHub Actions sin pago desde las 15:33Z.** Cada job falla en 3 s sin pasos. Hasta que Sam pague en Settings › Billing de `hailuwaycom-sketch`, no se fusiona ni se publica nada. Cuando pague, relanza los runs fallidos con `gh run rerun <id>`, los de main incluidos.

| Trabajo | Rama @ cabeza | Estado | Siguiente |
|---|---|---|---|
| **#301**: tasa única, **migración 0495** | `codex/sdd-0569-conversor-usd-tasas` @ `3d0c9028` | Revisión corregida, verify aceptado y previa PASÓ sobre `3d0c9028`. BEHIND con main | **OK nominal de Sam.** Después: integrar, rearmar el paquete, previa de nuevo, apply y merge, smoke y sello |
| **#307**: tarifa congelada, **migración 0496** | `claude/peaceful-franklin-a3831e` @ `b70be5d7` | Correcciones de seguridad hechas. **El `pnpm verify` terminó a las 17:20Z sobre `a81dbbd7`: 16/17, sin fallos.** El e2e pasó con 2 flaky ajenos. Previa de los md5 hecha | Revisar la diferencia de las correcciones, repetir la previa, OK nominal de la 0496, apply y merge |
| **0573**: reverso al anular, **migración 0497** | `codex/sdd-0573-reverso-al-anular` @ `89f15a5d`, sin PR | Implementación empujada por el Director. **Ningún hallazgo de la revisión está corregido (B1, I1–I4 y M1–M9); lo confirmó el Worker. Tampoco tiene typecheck ni verify** | Que un Worker lo compare con el informe del handoff, corrija, corra el verify con turno y publique la PR en borrador. Después: revisión corta, previa (md5 en vivo de `void_invoice_with_audit_reason` = `76644e17876d0caaa46e727de5946138`), OK nominal, apply y merge |
| **0572-a**: reemplazos del conversor | `codex/sdd-0572-conversor-usd-reemplazos` @ `4f24a1db` (empujada) | Código terminado: 31 archivos de prueba en verde, uno por uno | Con turno: tsc, eslint, verify y mutantes. La PR va cuando la #301 esté en main |
| **#304**: plantilla PGlite (solo pruebas) | `codex/pglite-snapshot-esquema` @ `59e8491b` | Borrador. Criterios 1–8 medidos: el CI baja de 41,6 a 29,3 min | Relanzar el run 39453136909, sacarla de borrador y fusionarla |
| **#306**: docs de la oficina de agentes | `codex/oficina-hermes-diseno` @ `033eea50` | Revisada, solo docs | Integrar y fusionar. Después, una PR nueva con el anexo de Telegram |
| **0574**: embarques sin facturar (4.5) | `codex/sdd-0574-embarques-sin-facturar` @ `18edcd81`, apilada sobre la #307 | Implementada sobre la 0571, con pruebas: 10 de regla y lectura, 3 mutantes muertos, BASELINE de invoices, tsc y lint. Tiene handoff propio. Contabilidad confirmó que la 0572 y la 0573 no le cambian nada. **Falta su verify y su PR** | Con turno, el verify. Después, su PR, que se fusiona después de la #307 |
| **2.2 = SDD-0575**: asientos sin fallos silenciosos | `codex/sdd-0575-asientos-sin-fallos-silenciosos` @ `3f5b7bdc` | Diseño publicado, con 5 preguntas abiertas | Decide por delegación con la recomendación del §3.3 del handoff y regístralo en la spec |

Numeración: SDD hasta la 0575 (la 2.2) y migraciones hasta la 0497. **Antes de asignar, corre `node scripts/next-number.mjs`.** No deja saltar números.

Las sesiones de Claude Code («Contabilidad», «Carril del embarque», «Oficina Paperclip» y «Revisar el tope de 45 min del CI») **quedan en pausa**. Hazte cargo de esto:
- abre tus propios Workers de Codex en los mismos worktrees;
- en cada uno, adopta la metodología de forma explícita y reclama el claim con `harness start`;
- nunca dos sesiones escribiendo en el mismo worktree.

La #302 (tope del CI a 60 min) ya está en main; esa sesión no deja nada pendiente.

---

## 5. Lo que haces ahora, en orden

1. **Mide.** Corre:
   - `git fetch --prune`
   - `gh pr list --state open`
   - `git worktree list`
   - en cada worktree de la tabla: `git status` y `git rev-list --count origin/<rama>..HEAD`

   Además:
   - al cierre no quedaba ninguna corrida pesada viva. Igual compruébalo con `Get-CimInstance Win32_Process -Filter "Name='node.exe'"` antes de dar turno;
   - compara todo con el §3.3-bis del handoff.
2. **Asegura que no se pierda nada.** Ningún trabajo puede quedar solo en local. Si la 0572-a no subió, que un Worker la commitee (selectivo) y la empuje.
3. **Mensaje a Sam**, corto y simple. Pregúntale:
   - si ya pagó GitHub Actions;
   - si te da el OK nominal de la 0495, con la frase exacta.

   Recuérdale además:
   - que la superclave del cierre la define él;
   - los pendientes de Paperclip: probar el bot de Telegram con `/sethome`, revocar la llave de Anthropic que no se usa, poner el seguro como «próximamente» en Kommo y decidir si se borran los agentes pausados.
4. **Cuando GitHub corra,** integra y fusiona según el §3.4:
   1. la **#301**, con su OK;
   2. la **#304** y la **#306**;
   3. la **#307**, con su OK;
   4. la **0573**, con su OK;
   5. los sellos, cada uno en su PR.

   Después de cada merge: publicación 14/0, smoke en el Studio y checklist del §4 al día.
5. **Cola de contabilidad (§3.5), una tarea a la vez, con Workers:**
   - termina la 0572;
   - hora de Caracas unificada;
   - 2.2;
   - 2.6;
   - 2.3;
   - 2.7 (antes, aplicar la 0422 y la 0423, con previa y OK de Sam);
   - 2.8;
   - 2.4;
   - 2.9;
   - 2.10;
   - conciliación bancaria;
   - 3.9;
   - 5.4.

   En paralelo, el carril del embarque: la 4.5 (0574: verify y PR) y la 4.2, sin empezar.
6. **Fechas:**
   - **21 y 22 de octubre:** restore de prueba (`infra/ops/backup/restore-test.sh`).
   - **27 de octubre:** vence la llave de Junta `hermes-director` de Paperclip. **Revócala antes**, con el OK de Sam: una llave de Junta permite a un agente aprobarse sus propias contrataciones.
   - **28 de octubre:** pausar Supabase Cloud, solo si se cumplen las 4 condiciones y sin cancelar planes.

Al cerrar cada bloque, dile a Sam en 2 o 3 líneas:
- qué quedó en producción;
- qué decidiste por recomendación;
- qué necesitas solo de él.

Cuando cierres tu propia sesión, deja un handoff nuevo en `.agents/handoffs/`, con la misma estructura que este.
