# Handoff del Director · traspaso a Codex · 2026-10-20

| Campo | Valor |
|---|---|
| Quién lo deja | Director (Claude Code). Sesión del 2026-10-18 al 20 |
| Quién lo toma | Codex, como Director de DTD Cargo |
| Por qué | A Sam se le acaba el saldo de Claude |
| main al cerrar | `8e9e0f50` (#305) |
| Copia fuera del repo | `C:/tmp/director-traspaso-20261020/` (scripts y paquete de la 0495) |

> Este archivo es el estado al cierre. **Antes de actuar, compara cada SHA con `gh pr view` y `git fetch`.** Git, las PR y las SDD mandan sobre este texto.

## 0. Qué leer primero, en este orden

1. `AGENTS.md`: las reglas del repo, el rol Director/Worker y las fronteras de producción.
2. `.agents/skills/director/SKILL.md` y `docs/runbooks/codex-engineering.md`: el procedimiento del Director.
3. `docs/audits/2026-10-18-contabilidad-diagnostico-y-plan.md`: **el plan contable maestro**. Lee el §8 (fases) y el §9 (decisiones). En el §9 están:
   - «Decisiones de Sam del 2026-10-19»;
   - sus respuestas a las cuatro decisiones;
   - **«Decisiones tomadas por recomendación (2026-10-20)»**, que Sam le delegó al Director.
4. `docs/runbooks/aplicar-migraciones-prod.md`: **cómo se aplica una migración en producción** (servidor propio). Es obligatorio.
5. `docs/runbooks/backup-restore-servidor.md`: los respaldos (§2 corregido el 2026-10-20).
6. Este handoff, completo.

Hay dos documentos en Claude Docs que **Codex no puede abrir**. Sam los ve:
- «Plan contable: avance y pendientes»: https://claude.ai/code/artifact/48fb0aef-6e1f-4268-b065-2525a69b20ad. Su contenido está copiado en el §4.
- «Preguntas para la contadora»: https://claude.ai/code/artifact/d80e4c94-c7f9-4f8b-a769-a385e0c545f8. Sus respuestas están en el §9 del plan.

## 1. Reglas que no se negocian

- **Producción es real.** Aplicar una migración exige el **OK nominal de Sam con el nombre exacto de la migración**. Un «ok», «avanza» o «sí» suelto no alcanza. La delegación del 2026-10-20 **no** cubre migraciones ni borrado de datos.
  - El texto literal de Sam va en un archivo de autorización (`--autorizacion`).
- **No leas filas de negocio ni PII de producción.** Solo catálogo (`pg_proc`, `pg_policies`, `information_schema`), conteos autorizados y radiografías con la autorización escrita de Sam.
- **Una sola corrida pesada a la vez en la máquina de Sam:** verify, vitest completo, Docker o build. El Director da el turno. Si dos sesiones corren a la vez, salen rojos falsos por CPU.
- **El Director no programa producto.** Asigna a Workers, revisa e integra. Excepción: las PR de cierre (sellos de migración y docs).
- **PR es la frontera.** El Worker no fusiona; fusiona el Director, con el CI verde y CLEAN.
- **Nunca** `git add -A`, force push ni reset sobre historia ajena.
- Escribe a Sam en **español venezolano neutro, con tuteo y sin voseo**. Lenguaje simple: Sam no es técnico.
- **Fusionar a main publica sola la web en el VPS** en unos 5 minutos (SDD-0541).

## 2. Herramientas del Director

### 2.1 Integrar una PR (traer main) y fusionar en verde

Los scripts están en `C:/tmp/director-traspaso-20261020/`:

| Script | Qué hace |
|---|---|
| `integrar-pr.sh <pr>` | Crea o reusa `DTD-worktrees/director-integra-<pr>`, hace `git merge origin/main`, resuelve solo el índice `docs/specs/README.md`, corre docs:check y sdd:check, y empuja a la rama de la PR. Sale con 2 si hay otro conflicto (lo resuelve el Worker) |
| `merge-cuando-verde.sh <pr> <sha40> <rama>` | Espera el run «Calidad continua» de ese SHA. Fusiona solo con `completed success`, la cabeza igual y el estado CLEAN, usando `gh pr merge --merge --match-head-commit`. **Exige que la salida traiga la línea `MERGED … merge=<sha>`**: un exit 0 solo no prueba nada |
| `aplicar-0494-y-fusionar.sh` | Plantilla del apply automático con guardas: CI verde, cabeza igual al paquete, CLEAN, ledger sin la migración, apply y merge enseguida. Cambia SHA, nombres y PR antes de usarla |

- **El check obligatorio es «Calidad local sin secretos»** (workflow «Calidad continua»), y solo corre contra main. Tiene que estar al día con main: cada merge deja BEHIND a las demás PR.
- **Fusiona de una en una.** Prioriza las PR con migración: el apply y el merge tienen que ir seguidos.
- **No armes el vigilante de una PR que tenga que esperar.** En Windows, `TaskStop` no mata al script hijo: el 2026-10-20 se coló una fusión así. Para matarlo:

```powershell
Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'cuando-verde\.sh' } | Stop-Process
```

### 2.2 Aplicar una migración (resumen del runbook)

1. **Previa de catálogo.** Mide en producción el md5 del `prosrc` de cada función que la migración reemplaza o exige, CRLF→LF y sin espacios. Pásaselo al Worker antes de cerrar el preflight. Hoy hubo **deriva** en tres casos, todos solo de comentarios o tildes; el preflight de la migración acepta los dos cuerpos:
   - triggers de la 0133;
   - `accredit_referral_on_first_invoice`;
   - `resolve_price_book`.
2. **Revisión de seguridad.** Lanza un revisor de solo lectura sobre la cabeza. Las migraciones de hoy tuvieron bloqueantes reales; nunca se aplica sin revisión.
3. **Preparar el paquete:**

```bash
node infra/ops/migraciones/preparar.mjs --sha <40> --migracion <NNNN_nombre> --sdd <NNNN> --salida <carpeta> [--acepta-deriva esquema.funcion]
```

4. **Previa en el servidor:**

```bash
MIGRACIONES_SSH=/c/Windows/System32/OpenSSH/ssh.exe MIGRACIONES_SCP=/c/Windows/System32/OpenSSH/scp.exe \
  bash infra/ops/migraciones/aplicar-remoto.sh --host root@217.216.54.70 --proyecto dtd-cargo --confirm dtd-cargo \
  --paso previa --esperada <NNNN_nombre> --paquete <carpeta>
```

   No exportes `MSYS_NO_PATHCONV`.
5. **OK nominal de Sam.** Guarda su texto literal en un archivo y anótalo en el handoff.
6. **Apply y merge seguidos.** Corre `--paso aplicar --autorizacion <archivo>` y enseguida `gh pr merge <pr> --merge --match-head-commit <sha del paquete>`. Si la PR estaba en borrador, primero `gh pr ready`.
7. **Publicación y smoke.** Vigila en el VPS: `ls -1t /srv/ops/evidencias | grep publicar-<sha8>` y `salida.txt` con `PUBLICADA` y `RESUMEN: 14 PASÓ`. Después, smoke en el Studio real con la sesión de Sam (navegador integrado), **solo mirando**.
8. **Sello.** Abre una PR de cierre desde main con:

```bash
node infra/ops/migraciones/retirar-espera.mjs <NNNN_nombre> --md5 <blob_md5 de IDENTIDAD.txt>
node scripts/migrations-lock.mjs
```

   Ajusta la prueba que afirmaba la espera (lista en `revisarAMano`) y agrega «CIERRE DEL DIRECTOR» al handoff de la SDD. Ejemplos: #289, #297 y #303.

### 2.3 VPS

- **Acceso:** `217.216.54.70`, por SSH como root, con el agente de Windows: `/c/Windows/System32/OpenSSH/ssh.exe`.
- **Contenedores:** la base es `dtd-cargo-db-1` (`docker exec dtd-cargo-db-1 psql -U postgres -d postgres -Atc "…"`) y la web es `dtd-cargo-web-1`.
- **Rutas:** las evidencias están en `/srv/ops/evidencias/` y los scripts instalados en `/srv/ops/migraciones/`.
- **Ledger:** `supabase_migrations.schema_migrations`. Tiene 498 filas; la última es la 0494.

## 3. Estado al cierre

### 3.1 En producción (todo publicado con smoke 14/0)

| SDD | Qué | Migración | PR |
|---|---|---|---|
| 0555 | El borrador conserva el embarque | — | #277 |
| 0556 | El portal no muestra las anuladas como deuda | — | #280 |
| 0557 | Reportes con una cifra de ingreso | — | #283 |
| 0558 | Saldo único por cliente y cabecera | 0492 | #286 |
| 0559 | Radiografía de integridad | — | #284 |
| 0560 | Asistente de borrado, con el arreglo de la carrera | — | #279 y #292 |
| 0562 | «Por contabilizar» alineado | — | #287 |
| 0563 | Sin conversión y sin borradores | — | #288 |
| 0565 | Cuenta padre obligatoria | — | #291 |
| 0566 | Cierre contable con superclave | 0493 (sellada, #297) | #293 |
| 0567 | Candado del crédito de referido | 0494 (sellada, #303) | #298 |
| 0568 | Ficha del cliente eliminado | — | #300 |

También en main: #299 (respaldos), #302 (tope del CI a 60 min), #305 (decisiones delegadas) y #285/#294/#295/#296 (oficina Paperclip).

### 3.2 BLOQUEO ACTIVO: GitHub Actions sin pago

- Desde las 15:33Z del 2026-10-20 cada job falla en 3 s con «recent account payments have failed or your spending limit needs to be increased». **Nada se fusiona ni se publica.**
- Sam tiene que pagar en la cuenta `hailuwaycom-sketch` (Settings › Billing).
- **Después:** relanza los runs fallidos (`gh run rerun <id>`), los de main incluidos, por ejemplo 39450648099, 39453056471 y 39453056216. Luego integra y fusiona según el §3.4.

### 3.3 PR abiertas y trabajo en curso

| PR / rama | SDD | Estado | Próximo paso |
|---|---|---|---|
| **#301** `codex/sdd-0569-conversor-usd-tasas` @ `3d0c9028` | 0569, tasa única. **Migración 0495** | Revisión de seguridad corregida (2 bloqueantes, 5 importantes y 7 menores), verify aceptado y previa PASÓ el 2026-10-20 a las 14:57Z sobre `3d0c9028` (blob `eb07813a`, md5 `409aca3756233d41afaf831b96394657`). Está BEHIND con main | **Pedir a Sam el OK nominal:** «autorizo aplicar la migración 0495_fx_rates_conversor_usd en producción». Después: integrar, rearmar el paquete desde la cabeza nueva (mismo blob), repetir la previa, aplicar y fusionar enseguida. Smoke: Contabilidad › Tasas de cambio abre, y un borrador VES sin tasa muestra el error sin guardarse. Al final, el sello |
| **#307** `claude/peaceful-franklin-a3831e` @ `a81dbbd7` | 0571, tarifa congelada (carril del embarque). **Migración 0496** | Revisión de seguridad hecha y sus 8 hallazgos corregidos; el verify final corría sobre `a81dbbd7` (ver el §3.6). La cabeza publicada ya es `a81dbbd7` | Lee la tabla del verify en el handoff `0571-…`. Revisa la diferencia de las correcciones, haz la previa (`resolve_price_book` con deriva aceptada por su preflight), pide el OK nominal de la 0496, aplica y fusiona. Smoke: Almacén CN, columna «Tarifa · a facturar» |
| `codex/sdd-0573-reverso-al-anular` @ `89f15a5d` (sin PR) | 0573, reverso al anular. **Migración 0497** | Implementada. La revisión de seguridad dio 1 bloqueante (B1: anular desde el libro diario rompe el par) y 4 importantes (I1: tenant en la DEFINER; I2: descuadre entre meses; I3: carrera emitir/anular; I4: verify). El Worker los estaba corrigiendo: **mira su handoff para ver qué quedó** | Que el Worker termine las correcciones, corra el verify y publique la PR en borrador. Después: una revisión corta de la diferencia, la previa (`void_invoice_with_audit_reason` vivo md5 `76644e17876d0caaa46e727de5946138`, sin espacios `c76c80e7…`, INVOKER, `search_path=""`), el OK de Sam, el apply y el merge |
| `codex/sdd-0572-conversor-usd-reemplazos` | 0572, los 13 reemplazos del conversor | Diseño aprobado con 5 decisiones. **La 0572-a está casi implementada pero SIN COMMIT** (ver el §3.6) y apilada sobre la #301 | Reescribir las ~23 pruebas, corriendo un archivo a la vez, y la PR cuando la #301 esté en main. La 0572-b lleva migración: pedir número |
| `codex/sdd-0575-asientos-sin-fallos-silenciosos` @ `3f5b7bdc` | **0575 = 2.2**, asientos sin fallos silenciosos | Diseño publicado (solo docs, con `docs:check`/`sdd:check` en verde). Corrige al plan: `journal_entries` ya tiene `receipt_id`, `bill_id` y `supplier_payment_id`. Un candado en `next_entry_code` no sirve | **Decide por delegación las 5 preguntas de la spec.** Recomendación del Director anterior:
1. RPC atómica en la base, que falle cerrado.
2. Período cerrado: bloquear y que aparezca en las excepciones de la 0566; nada de asentar en silencio en otro período.
3. Sección dentro de «Por contabilizar».
4. Sí a tres PR, con el número de migración de `next-number.mjs`.
5. Sí: el gasto entra en la RPC.

Registra las decisiones en la spec |
| 0574 (reserva) | 4.5, «Embarques sin facturar» | Diseño en lectura | Seguir con el Worker del embarque |
| **#304** `codex/pglite-snapshot-esquema` @ `59e8491b` | 0570, plantilla PGlite (solo test-infra) | CI verde sobre `8a13412c`; sobre `e6311891` falló por facturación | Relanzar el run 39453136909, integrar y fusionar. El A/B local está pendiente |
| **#306** `codex/oficina-hermes-diseno` @ `033eea50` | 0564, D11 de la oficina de agentes | Revisada, solo docs | Integrar y fusionar |
| #262 | 0543, contenedores 60 y 64 | Borrador | Espera los Excel del 60 y del 64 y el costo de HR. No tocar |

**Números en uso:**
- SDD hasta la 0575 (0575 = 2.2): la 0570 es PGlite, la 0571 la tarifa, la 0572 los reemplazos, la 0573 el reverso y la 0574 la 4.5.
- Migraciones hasta la 0497: la 0495 es la #301, la 0496 la #307 y la 0497 la 0573.
- Antes de asignar números corre `node scripts/next-number.mjs`. El script no deja saltar números.

### 3.3-bis Inventario verificado de ramas al cierre (2026-10-20 17:05Z)

El Director lo comprobó con `git fetch`, `git worktree list` y `gh pr list`. **Vuelve a medirlo antes de actuar.**

| Rama | Worktree | Cabeza local | En origin | Estado al cierre |
|---|---|---|---|---|
| `codex/sdd-0569-conversor-usd-tasas` (#301) | `DTD-worktrees/sdd-0569-conversor-usd-tasas` | `3d0c9028` | igual | Limpia. BEHIND con main |
| `claude/peaceful-franklin-a3831e` (#307) | `DTDCARGO/.claude/worktrees/peaceful-franklin-a3831e` | `a81dbbd7` | `a81dbbd7`; **el Director empujó los 5 commits de las correcciones de seguridad** (`38198401`..`a81dbbd7`, con `2e94bccc` incluido) | **Su `pnpm verify` final corría desde las 16:49Z** (PID 48200) sobre `a81dbbd7`. El Worker anota el resultado en el handoff `0571-…` y empuja. Si la sesión murió sin anotarlo, el verify es NO VERIFICADO: repítelo con turno |
| `codex/sdd-0573-reverso-al-anular` @ `89f15a5d` (sin PR) | `DTD-worktrees/sdd-0573-reverso-al-anular` | `89f15a5d` | `89f15a5d`; **el Director empujó los 3 commits de la implementación** | Implementada. **Confirmado por el Worker: NINGÚN hallazgo de la revisión está corregido** (B1, I1–I4 y M1–M9). Tampoco corrió typecheck, eslint ni verify. Lo siguiente es un Worker que corrija todos contra el informe del handoff `0573-…` |
| `codex/sdd-0572-conversor-usd-reemplazos` (sin PR) | `DTD-worktrees/sdd-0572-conversor-usd-reemplazos` | `9c864da5` (merge de la #301) | `0c06d482` (13 commits detrás) | **Actualizado a las 17:30Z.**

- **La 0572-a tiene el código terminado** en `4f24a1db`, **empujado por el Director**. Reglas A–F aplicadas; la G queda diferida a la 2.3. Pasaron 31 archivos de prueba, corridos uno por uno.
- **Falta, con turno:** tsc, eslint, verify y mutantes.
- **Cambio de fixture:** `ingreso-fixture` con F6 y F9. Lo esperado: 3000 en total, 3 facturas, 2 sin convertir y 4 en otra moneda.
- **Rendición:** bloquea también con una factura local sin tasa, y el texto no es literal de la spec. **Recomendación:** aceptar el texto del Worker.
- El respaldo viejo en `C:/tmp/.../respaldo-0572/` ya no hace falta. |
| `codex/sdd-0574-embarques-sin-facturar` | `DTD-worktrees/sdd-0574-embarques-sin-facturar` | `18edcd81` | igual | Diseño publicado, sin PR. Su claim ya está liberado |
| `codex/pglite-snapshot-esquema` (#304) | `DTD-worktrees/pglite-snapshot-esquema` | `59e8491b` | igual | Borrador. Criterios 1–8 medidos en el CI: el job baja de 41,6 a 29,3 min. Hay que relanzar el run 39453136909 cuando se pague, sacar la PR de borrador y fusionarla. El A/B local de 34 archivos queda para cuando haya turno |
| `codex/oficina-hermes-diseno` (#306) | — | `033eea50` | igual | Solo docs, revisada |

**Respuestas de las sesiones a la pausa:**
- **«Revisar el tope de 45 min del CI de calidad»:** cumplió. La #302 está en main y la #304 es lo de arriba. No tiene nada más pendiente.
- **«Oficina Paperclip»:** cumplió y no tocó más el VPS. Detalle en el §5.
- **«Carril del embarque»:** dejó el verify en curso. Ver la fila de la #307.
- **«Contabilidad»:** **no había pausado.** Estaba reescribiendo las pruebas de la 0572-a y corrió un `tsc` completo sin turno.
  - Aplicó las reglas A–F; la G queda diferida a la 2.3. Faltan unos 23 archivos de prueba.
  - Al nuevo Director le toca confirmar con `git ls-remote` que la rama subió.

### 3.4 Orden de integración recomendado (cuando GitHub vuelva)

1. **#301 (0495)**, en cuanto llegue el OK de Sam.
2. #304 y #306 (docs y test).
3. #307 (0496), con su OK.
4. La 0573 (0497), con su OK.
5. Los sellos de cada migración, cada uno en su PR.

### 3.5 Cola del Worker «Contabilidad» (en orden, una tarea a la vez)

Ya asignada:
1. 0569 (cierre).
2. 0572, los reemplazos.
3. **La hora de Caracas** (siguiente SDD libre), unificando `todayCaracasISO`, `diaDeCaracas` y la copia de la 0568.
4. 2.5 = 0573.
5. 2.2.
6. 2.6, cobro en cualquier moneda.
7. 2.3, moneda del mayor: USD, con Bs solo en reportes.
8. 2.7, el reporte de pago crea el recibo. **Antes hay que aplicar la 0422 y la 0423**, con su previa y el OK de Sam.
9. 2.8, NC y ND.
10. 2.4, candado del mayor, incluido el grant de `accounts`.
11. 2.9, factura emitida inmutable.
12. 2.10, paquete de la contadora.
13. Conciliación bancaria en el ERP.
14. 3.9, arranque contable: «abrir cuentas nuevas a todos».
15. 5.4, permisos de la contadora.

El carril del embarque va en paralelo: 4.1 = 0571, después la 4.5 = 0574 y la 4.2.

## 4. Copia del checklist «Plan contable: avance y pendientes»

- **Avance:** de las 36 tareas vivas del plan, 6 están hechas (toda la fase 1 y la 2.11), 1 en curso y 29 pendientes. Hay 5 extras hechas (0562, 0563, 0565, 0566 y 0568).
- **En pausa o fuera del plan:**
  - impuestos (3.2, la posición de IVA de 3.4 y 3.7);
  - QuickBooks (fase 6 y 7.1).
- **Para poner en marcha la contabilidad en el ERP:** son las 15 tareas del §3.5, más 4 pasos de Sam:
  - definir la superclave del cierre;
  - cargar las tasas BCV cuando entre la 0569;
  - decidir si se borran los datos de prueba de producción;
  - poner la primera fecha de cierre.
- **Decisiones tomadas por recomendación** (detalle en el §9 del plan): 6 y 8, 9, 10, 11 (la contadora la revisa antes de la 4.7), 14, 15 (segunda aprobación de más de 1.000 USD), 16, 17, 18 (borrador de más de 200 USD) y la tasa oficial del BCV con carga diaria. Más las decisiones de diseño aprobadas en las specs 0571, 0572 y 0573.
- **Verificaciones periódicas:**
  - la radiografía mensual, con la autorización de Sam;
  - «Por contabilizar» en cero;
  - el subdiario contra el mayor;
  - las excepciones al cierre;
  - los respaldos cada semana (la de hoy pasó);
  - el **restore de prueba del 21 y el 22 de octubre**;
  - los ocho cuadres al cierre de mes.

## 5. Oficina Paperclip (VPS de agentes `13.140.227.228`)

- **Lo que está andando:** 8 agentes Hermes activos, aprobados por Sam, con el tope de 100 USD y `requireBoardApprovalForNewAgents=true`.
- **Aislamiento:** las CLI corren como `agentes-run`, que no puede leer los secretos de `agentes`. Hay una copia filtrada del repo en `/srv/oficina/repo`.
- **Llave de Junta `hermes-director`:** vence el **2026-10-27T13:37:35Z**. **Riesgo:** un agente con una llave de Junta puede aprobar sus propias contrataciones. Se revoca al terminar la configuración, sin esperar al vencimiento. La suelta `e619f8d0` ya está revocada.
- **Contrataciones pausadas:** 4 de ALFRED sin `hermesCommand` (sin aislamiento). Nunca corrieron.
- **Pausa del 2026-10-20:**
  - Sin cambios en el VPS.
  - Servicio nuevo `dtd-hermes-telegram`, activo, con el perfil `telegram`, sin llave de Junta y solo con el ID de Sam.
  - El anexo está fuera de Git, en `C:/tmp/handoff-oficina-telegram-2026-10-20.md`. Hay que llevarlo a una PR nueva, con su línea en la D11.
  - Pausados: las 4 contrataciones de ALFRED, prueba-opencode, prueba-hermes y el ALFRED viejo `claude_local`.
- **Pendientes de Sam:**
  - probar el bot (`/sethome`);
  - revocar la llave de Anthropic que no se usa;
  - en Kommo §29, el seguro va como «próximamente»;
  - decidir si borra los agentes pausados.
- **Pendientes técnicos:**
  - Tailscale en la PC de Sam, que choca con CyberGhost;
  - cerrar el puerto 22, con la consola VNC confirmada y OK de Sam;
  - el reporte privado a los mantenedores de Paperclip sobre la fuga de variables de entorno. El borrador está en `C:/tmp/reporte-paperclip-fuga-env.md` y lo envía Sam.

## 6. Fechas

| Fecha | Qué |
|---|---|
| 21-22 oct | Restore de prueba mensual (`infra/ops/backup/restore-test.sh`) |
| 27 oct | Vence la llave `hermes-director` |
| 28 oct | Pausar Supabase Cloud si se cumplen las 4 condiciones del handoff `plan-retiro-vercel-supabase-20261016.md`. **No** cancelar planes: Loop3D depende de ellos |
| 30 oct | Dominio de Vercel |
| 27 nov | Borrar Cloud |

## 7. Primera hora del nuevo Director (lista de arranque)

1. `git fetch --prune`, `gh pr list --state open` y `git worktree list`. Compara contra el §3.3 y el §3.3-bis.
2. Comprueba si sigue vivo el `pnpm verify` de la #307:
   - corre `Get-CimInstance Win32_Process -Filter "Name='node.exe'"` y busca `verify`;
   - **si sigue vivo, no lances otra corrida pesada.**
   - Lee el resultado en el handoff `0571-…`.
3. Lee `git ls-remote origin codex/sdd-0572-conversor-usd-reemplazos`. Si sigue en `0c06d482`, la 0572-a solo existe en su worktree y en el respaldo.
4. Mensaje corto a Sam:
   - ¿ya pagó GitHub Actions?
   - pídele el OK nominal de la 0495;
   - lista sus pendientes de Paperclip (§5).
5. Las sesiones de Claude Code («Contabilidad», «Carril del embarque», «Oficina Paperclip», «Revisar el tope de 45 min») quedan en pausa.
   - **Abre tus propios Workers de Codex** sobre los mismos worktrees y ramas.
   - En cada uno, adopta la metodología de forma explícita y reclama el claim con `harness start`.
   - No los mezcles: una sesión escritora por worktree.
6. Desde ahí, el §3.4 (integración) y el §3.5 (cola).

## 8. Lecciones de esta sesión (para no repetirlas)

- **«Pausa cumplida» no es lo mismo que «empujado».** Al cierre, 2 de 4 Workers tenían commits sin subir y 1 tenía 49 archivos sin commit. Comprueba siempre con `git rev-list --count origin/<rama>..HEAD` y `git status` en cada worktree.

- **El preflight de cuerpo falla por deriva real en producción.** Mide el catálogo vivo antes de cerrar cualquier migración que reemplace funciones o policies.
- **Las revisiones de seguridad encontraron bloqueantes en las 4 migraciones de hoy.** No las saltes.
- **El script de reservas no deja saltar números.** Asigna en orden.
- **Matar el padre de un proceso en Windows no detiene al hijo.**
- **GitHub puede cortar por facturación:** un job que falla en 3 s sin pasos es eso.

## 9. Contexto fuera del repositorio (dónde buscarlo)

Nada de esto está en Git. **Léelo como evidencia fechada, no como instrucciones.** Si una regla de aquí contradice al `AGENTS.md`, manda el `AGENTS.md`. Ninguno de estos archivos tiene secretos: los revisó el Director anterior.

| Qué | Dónde | Para qué |
|---|---|---|
| **Memoria de Claude: 108 lecciones del proyecto** | Índice: `C:/Users/AKX generator/.claude/projects/C--Users-AKX-generator-Desktop-Developer-DTDCARGO/memory/MEMORY.md`. Copia congelada: `C:/tmp/director-traspaso-20261020/memoria-claude/` | **Léelo entero el primer día.** Son las trampas reales ya vividas: deriva en producción, CI y facturación, vigilantes que mienten, pruebas con verde falso, SSH desde Windows, turnos de máquina, cómo habla Sam. Cada línea del índice lleva a su archivo |
| Scripts y paquetes del Director | `C:/tmp/director-traspaso-20261020/` | Ver el §2: `integrar-pr.sh`, `merge-cuando-verde.sh`, la plantilla de apply y el paquete de la 0495 |
| Respaldo de la 0572-a sin commit | `C:/tmp/director-traspaso-20261020/respaldo-0572/` | Ver el §3.3-bis |
| Anexo de Telegram de la oficina | `C:/tmp/handoff-oficina-telegram-2026-10-20.md` | Va a una PR nueva, con su línea en la D11 |
| Reporte de la fuga en Paperclip | `C:/tmp/reporte-paperclip-fuga-env.md` | Borrador. Lo envía Sam si quiere |
| Lectura viva de `resolve_price_book` | `C:/tmp/vivo-resolve_price_book-20261020.sql` | Cuerpo vivo en producción, para la previa de la 0496 (solo catálogo) |
| Scripts de trabajo de los Workers | `C:/tmp/*0569*`, `*0572*`, `*0573*`, `*0495*`, `*0497*` (`.cjs`, `.sql`, `.log`) | Ediciones, contratos, mutantes y logs de verify de cada tarea. Úsalos si un handoff los cita. Los logs de verify son la evidencia de PASÓ/FALLÓ |
| Planes viejos de Claude | `C:/Users/AKX generator/.claude/plans/` | Servidor Contabo, GoHighLevel y la 0543. Son históricos y no hacen falta para la contabilidad |
| Transcripciones completas (JSONL) | Director: `C:/Users/AKX generator/.claude/projects/C--Users-AKX-generator-Desktop-Developer-DTDCARGO/267f5ded-5bbc-4289-a807-7248e4322009.jsonl`. Contabilidad: `…/C--Users-AKX-generator-Desktop-Developer-DTDCARGO--claude-worktrees-quizzical-lehmann-d70032/fe1cdefd-….jsonl`. Embarque: `…--claude-worktrees-peaceful-franklin-a3831e/e35a16e7-….jsonl`. Paperclip: `…--claude-worktrees-upbeat-sutherland-4cb3a5/32688be0-….jsonl`. Tope del CI: `…--claude-worktrees-sharp-ellis-7c6126/d29b2730-….jsonl` | Solo si un handoff no alcanza. Son muy grandes: busca con `rg` y no los leas enteros |
| Configuración de Claude en el repo | `.claude/agents`, `.claude/commands` y `.claude/skills` **sí están en Git**. `.claude/settings.local.json` está ignorado y solo tiene permisos locales | Codex usa `.agents/skills/` (director/worker). Las skills de `.claude/skills/` (`revisar-datos-ve`, `ui-pro`) siguen siendo normativas, según el AGENTS |
| Docs de Sam en Claude Docs | Checklist: https://claude.ai/code/artifact/48fb0aef-6e1f-4268-b065-2525a69b20ad · Contadora: https://claude.ai/code/artifact/d80e4c94-c7f9-4f8b-a769-a385e0c545f8 | Codex no los abre. Su contenido está en el §4 y en el §9 del plan |
