# SDD-0583 paso 1.6 bis: alarmas de WhatsApp (puerta 7 de 4.9) e Instagram, handoff del Worker

- **Owner / sesión:** Worker Claude, claim `claude-jolly-tesla-0583-alarmas`. Encargo del Subdirector de Chatwoot (sesión `local_535053f4-40c2-4124-a280-63f4fc882820`), por orden de prioridades del Director General, 2026-11-06.
- **Ruta / rama:** `.claude/worktrees/jolly-tesla-14031c`, rama `claude/jolly-tesla-14031c`, PR en borrador contra `main`.
- **SDD:** [0583](../../docs/specs/0583-chatwoot-vps-e1/spec.md), paso **1.6 bis**, decisiones E1-D11 y E1-D12. No hizo falta SDD nueva.
- **Permisos del encargo:** rama, PR en borrador y CI. **No cubre:** fusionar, instalar en el VPS, tocar Meta ni el Chatwoot de producción, ni usar Docker en la PC. El VPS no se tocó.

## Qué es la puerta 7

Está escrita, y sin ambigüedad, en el handoff [`0582-e4-meta.md`](0582-e4-meta.md), §«Puerta 7: especificación de la alarma (para E1 / 0583)». Es la alarma del cupo de 1.000 mensajes de servicio por número de la fila 4.9:

- `down` si una bandeja de WhatsApp llega a **800 salientes en el mes**, con el motivo «WhatsApp bandeja N: S de 1.000 en el mes»;
- `down` si hay **1 `failed` o más en 24 h**, con el motivo «WhatsApp bandeja N: F fallas en 24 h»;
- `down` si `psql` falla («cupo WhatsApp sin lectura»);
- lectura con `psql` en el contenedor de postgres, sin `rails`; dos columnas nuevas en el CSV, con `--resumen`; solo conteos e IDs de bandeja.

El tercer punto de 4.9, el escalado del tope inicial de mensajes que inicia DTD, **queda fuera de esta alarma por la misma especificación**. Es NV: `messaging_limit_tier` no tiene valor mientras el nombre visible esté en `PENDING_REVIEW`, y se lee por la API de Meta con `leer-clientes-0582.sh`. No se inventó una alarma para eso.

## Qué se entrega

| Archivo | Qué hace |
|---|---|
| `infra/chatwoot/vigilar-whatsapp.sql` | La consulta de la puerta 7, en su propio archivo: transacción de solo lectura con `statement_timeout` de 15 s, una fila `id\|salientes_mes\|fallas_24h` por bandeja de WhatsApp. `vigilar.sh` la pasa por stdin a psql, y la prueba de PGlite corre ese mismo archivo |
| `infra/chatwoot/vigilar.sh` | Dos controles nuevos (WhatsApp e Instagram), tres columnas nuevas en el CSV (`wa_salientes_max`, `wa_fallas_24h`, `ig_dias`), `--resumen` con sus líneas, `--estado-instagram`, y `VIGILAR_PROC` (solo para la prueba). Un CSV con la cabecera vieja se renombra a `…csv.hasta-<fecha>` y se empieza otro. Todo lo anterior queda igual |
| `infra/chatwoot/renovar-instagram.sh` | `Channel::Instagram.find_each(&:access_token)` en el contenedor de rails, canal por canal, con `expires_at` antes y después. Escribe el estado (clave=valor) de forma atómica en `/var/lib/chatwoot-vigilancia/instagram-token.estado` y sale 0 solo si es `ok` |
| `infra/chatwoot/systemd/chatwoot-instagram-token.{service,timer}` | Diario a las 07:15 UTC (`Persistent=true`), después de los dos respaldos; `Nice=10` e I/O `idle` |
| `docs/runbooks/chatwoot-vigilancia.md` | §2 con los umbrales nuevos y sus límites, §2 bis (token) y §2 ter (receta de instalación en orden) |
| `infra/ops/tests/prueba-vigilar-chatwoot.sh` | Prueba bash con dobles, control rojo y 45 mutantes; la corre el CI desde `pruebas-linux.sh` |
| `infra/ops/tests/vigilar-whatsapp.test.mjs` | La consulta en PGlite, con reloj fijo y tres zonas de sesión, y 13 mutantes de SQL; corre en el paso «Unitarios» del CI |

### Decisiones que el Director General tiene que mirar

1. **Los días del token se miden al renovar, no contra la hora actual (E1-D11).** Lo acordado fue una «alarma si a `expires_at` le quedan menos de 10 días». Chatwoot renueva justo cuando faltan menos de 10 días. Con una corrida diaria, un token sano baja hasta ~9 días entre dos corridas, así que medirlo contra la hora actual haría sonar la alarma hasta 24 h en cada ciclo de ~50 días. `vigilar.sh` toma los días que le quedaban **al terminar la última renovación**, que es cuando tuvo su oportunidad de renovarse. Lo complementa con `resultado=falla` y con «sin renovar hace más de 26 h». La prueba lo fija: renovado hace 23 h con 10,2 días, hoy le quedan 9 y sigue `up`. El mutante «días medidos contra la hora actual» muere ahí. Cambiarlo es una línea.
2. **Una renovación fallida no sale como error.** Leído en el código de v4.19.1: `Instagram::RefreshOauthTokenService#attempt_token_refresh` tiene `rescue StandardError` y devuelve el token viejo. Por eso `renovar-instagram.sh` marca `falla` si después de intentarlo a algún canal le quedan menos de 10 días. Lo mismo vale si leer el token lanzó una excepción, si rails no corre, si `rails runner` sale distinto de 0 o si el resumen no cuadra.
3. **La consulta usa `now()` pasado a UTC también en la ventana de 24 h (E1-D12).** La del handoff de 4.9 hacía `m.created_at >= now() - interval '24 hours'`. `created_at` es timestamp sin zona en UTC, así que con la sesión de Postgres en otra zona el resultado cambia: con la sesión en Caracas, una falla de hace 25 h contaba. Hoy la sesión del contenedor está en UTC por omisión de la imagen (I, no medido en el VPS), así que en la práctica daba lo mismo. La prueba tiene ese mutante y lo mata.
4. **Cero bandejas de WhatsApp es `down`** («ninguna bandeja de WhatsApp»). DTD tiene dos, la 1 de prueba y la 2 de Clientes, así que cero filas significa una lectura rota, por ejemplo otro `channel_type` tras una versión. La especificación no lo decía; va en la misma línea de «un hueco no cuenta como verde». **Desde el 2026-11-11, cero canales de Instagram también es `down`** («ningún canal de Instagram»). DTD tiene uno, la bandeja 5. Antes de ese ajuste quedaba en verde, y lo marcó la revisión del DG.
5. **El mismo monitor Push** («Chatwoot · recursos del host», #7) recibe los dos controles nuevos en `MOTIVOS`, como permitía la especificación. Si Sam prefiere un monitor propio para WhatsApp o para Instagram, lo crea él en Uptime Kuma y el guion necesita un segundo latido.

### Privacidad

- WhatsApp: la consulta no lee contenido, teléfonos ni nombres. La prueba de PGlite revisa el texto que se ejecuta, y en el CSV y en el latido solo van conteos e IDs de bandeja.
- Instagram: el Ruby imprime solo `canal=<id> antes=<epoch> despues=<epoch> error=<0|1>` y un resumen; ni el token ni el mensaje del error. La salida cruda de `rails runner`, con los logs de Rails, se queda en memoria y no se imprime ni se guarda. La prueba siembra un «token» en los logs de mentira y comprueba que no aparezca en ninguna salida ni en ningún estado. El mutante que imprime la salida cruda muere.

## Validación

| Comprobación | Resultado |
|---|---|
| `bash infra/ops/tests/prueba-vigilar-chatwoot.sh --suite`, en Git Bash local, sobre el código final | PASÓ: 51 PASÓ · 0 FALLÓ, exit 0 (~5 min en Git Bash). Una línea NO DISPONIBLE: el Ruby real, sin ruby en la PC |
| Primera corrida local de la suite | 50 PASÓ y 1 FALLÓ, del propio guion de prueba: un caso de exactamente 9 días caía en 8 por los segundos de la corrida. Arreglado con 9,5 días y un reloj fresco por caso |
| `MUTANTES_SECO=1 … --mutantes` (cada texto aparece una sola vez, el mutante cambia el guion y pasa `bash -n`) | PASÓ: 45 de 45 armados |
| Control rojo y 2 mutantes en local (`MUTANTES_SOLO="cupo con >\|sin rails cuenta"`) | PASÓ: los dos controles rojos y los dos mutantes caen (38 s) |
| Ruby real contra un `Channel::Instagram` de mentira | NO DISPONIBLE en la PC (sin ruby). En el CI corre y, si falta ruby con `CI=true`, es FALLÓ |
| Los 45 mutantes y el control rojo completos | se corren en el CI (`pruebas-linux.sh`), no en la PC, por la regla de una corrida pesada a la vez |
| `vitest run infra/ops/tests/vigilar-whatsapp.test.mjs scripts/__tests__/ci-workflow-contract.test.mjs` | PASÓ, 71 de 71 (23 de PGlite, con 13 mutantes de SQL muertos, y el contrato del CI con la prueba nueva clasificada) |
| `node scripts/build-docs-index.mjs --check` · `node scripts/check-numbering.mjs` · `git diff --check` | PASÓ |
| `pnpm verify` | NO EJECUTADO: es un cambio de infraestructura y documentación, sin producto. El CI de la PR corre lint, typecheck, unitarios, bash de operaciones, docs y build |
| CI de la PR sobre `a91585e5f` (2026-11-06) | PASÓ, job 128076393935. `prueba-vigilar-chatwoot.sh`: 101 PASÓ en 62 s, es decir 54 de la suite (Ruby real incluido), 2 controles rojos y 45 mutantes muertos. `vigilar-whatsapp.test.mjs`: 23 tests |
| CI de la PR sobre `e462324de`, con `main` fusionado (2026-11-11) | PASÓ, Calidad 130667128558, de 16:49:57Z a 17:35:44Z. `prueba-vigilar-chatwoot.sh`: 101 PASÓ contra el piso de 101, en 45 s; las 11 pruebas bash en verde. `vigilar-whatsapp.test.mjs`: 23 tests |
| El ajuste en local (2026-11-11, Git Bash, un proceso) | PASÓ. Con `PRUEBA_SECCIONES="vigilar e2e"`: 36 PASÓ · 0 FALLÓ, con el caso de cero canales en verde sobre el guion real. Con `MUTANTES_SOLO="cero canales de Instagram"`: los 2 controles rojos y el mutante caen, y el mutante cae justo en ese caso («vigilar: up · ok»). En seco, los 46 mutantes están bien armados. `bash -n`, `docs:check` y `git diff --check` pasaron |
| CI del ajuste de la revisión (2026-11-11) | NO DISPONIBLE: GitHub Actions está bloqueado por facturación desde las 17:24Z, según el Subdirector. El conteo esperado es 102: la suite no cambia de tamaño, porque el caso de cero canales se reescribió, y se suma un mutante |

## Integración con `main` (2026-11-11)

- Encargo del DG, por el Subdirector: traer `main` (`e1fd0e2be`, con la #403, la #420 y la #510) con merge, sin rebase. Merge `e462324de`.
- `merge-tree` mostró un solo choque, en `infra/ops/tests/pruebas-linux.sh`. Se conservaron la lista y los pisos de `main` (#480 N4: portal-historial 139 y respaldo-storage 90). Se sumó `prueba-vigilar-chatwoot.sh` con piso 101, el conteo medido en el job 128076393935. El diff contra `main` en ese archivo son esas dos líneas.
- Se subió con el orden de la 0621: push con la PR en borrador (16:46:43Z), `skipped` terminado (16:47:03Z) y `gh pr ready` (16:48:00Z). La corrida real no se canceló.
- El DG aprobó `e462324de`: datos personales, fallo cerrado, el choque de `pruebas-linux.sh`, los mutantes y que no haya instalación automática.

## Ajustes de la revisión del DG (2026-11-11, un commit)

- (a) `vigilar.sh`: cero canales de Instagram pasa a `down` («token Instagram: ningún canal de Instagram»), igual que cero bandejas de WhatsApp. El caso de la prueba se reescribió: antes exigía `up`, y ahora exige `down` con ese motivo y `ig_dias` vacío. Se agregó el mutante «cero canales de Instagram cuenta como verde». Base limpia: el caso pasa con el guion real y cae con el mutante. El piso sube a 102.
- (b) Runbook §2 ter: la instalación en producción necesita el OK nominal de Sam. Desde el 2026-12-20, cada corrida llama a `graph.instagram.com/refresh_access_token` hasta que el token se renueva.
- (c) SDD-0583, allowlist: `pruebas-linux.sh` lleva dos líneas (la ruta y el piso).

## Pendientes de esta tarea

- Que el CI corra sobre la cabeza del ajuste cuando se levante el bloqueo de facturación, y que `prueba-vigilar-chatwoot.sh` dé 102 PASÓ contra su piso.
- **Instalación en el VPS: la revisa y la corre el Director General**, en el orden del runbook §2 ter: primero la renovación y su estado, después `vigilar.sh`. No se instaló nada.
- Filas del checklist de la SDD-0582: 4.9 (puerta 7 hecha en PR, sin instalar), 4.5 y 8.2 (la condición queda cumplida al instalar) y 4.6 (el cron del token y su alarma, antes del 2026-12-20). No las toqué: son filas largas que otras sesiones editan, y el estado real cambia al instalar. Las actualiza el Subdirector o el Director General al integrar.

## FUERA DE ALCANCE DETECTADO

- Si la carga del historial de Kommo (E5) deja mensajes salientes con `created_at` del mes en curso, el conteo del cupo se infla. Habría que revisar las fechas al cargar o excluir los importados (por `source_id` o `additional_attributes`, NV).
- ESLint ignora `infra/ops/tests/vigilar-whatsapp.test.mjs` cuando corre dentro de este worktree. El aviso es «File ignored because of a matching ignore pattern», probablemente por la ruta `.claude/` (I). En el CI la ruta es otra.
- El escalado del tope inicial de mensajes iniciados por DTD (fila 4.9) sigue sin vigilancia automática; depende de la API de Meta.

## Impacto documental

- Actualizados: runbook `chatwoot-vigilancia.md` (§2, §2 bis y §2 ter), SDD-0583 (alcance 1.6 bis, E1-D11, E1-D12, allowlist y seguimiento) y `infra/chatwoot/README.md`.
- Sin cambios en el checklist de la SDD-0582 (ver pendientes).
- Graphify, Archify y Obsidian: NO EJECUTADO en la rama; los publica el Director desde `main` integrado.

## Handoff al Director General

Rama `claude/jolly-tesla-14031c`, PR #402 lista. `e462324de` está aprobada por el DG. El delta del ajuste (a, b, c) va en un solo commit y lo revisa él. Para instalar: runbook §2 ter, en orden, con el OK nominal de Sam para producción.
