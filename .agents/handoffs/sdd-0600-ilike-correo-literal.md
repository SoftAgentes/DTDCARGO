# Handoff — SDD-0600 · Un correo no se compara como patrón

Fecha: 2026-11-02. Task ID: `sdd-0600-ilike-correo-literal`.
Owner / sesión escritora: `ilike-correo-literal-sad-jones` (Worker Claude Code, la misma sesión de la SDD-0597).

Estado (2026-11-03): **lista para que el Director General la fusione cuando pase el CI.** PR en borrador. `verify` salió con exit 1, solo por carga en `test`: esos archivos pasan aislados. Ver «VALIDACIÓN».

- **Worktree:** `DTD-worktrees/ilike-correo-literal`, con `node_modules` propio desde el 2026-11-03.
- **Rama:** `codex/ilike-correo-literal`, con `main` en `8feae0e8b` traído por merge.
- **SDD:** `docs/specs/0600-ilike-correo-literal/spec.md`, número asignado por el Director General. `sdd:next --reserve` falló por la red, en el inventario de PR. Se reservó con `prepareReservation` del mismo script: rama `codex/sdd-reserve-0600-ilike-correo-literal` y ref `refs/dtd/reservations/0600`, sin publicar.

## OBJETIVO ORIGINAL

Sam, literal: «Haz esta tarea aquí: "Comodines de .ilike: correo entrante, invitación y baja"».

Comprobar y corregir el mismo patrón de la SDD-0597 en `inbound-email.ts`, `app/invitar/[token]/actions.ts` y `unsubscribe-request.ts`. Con control rojo del daño concreto en cada sitio, y la invitación pasando por `revisar-datos-ve`.

Terminado es: spec con allowlist, PR en borrador contra `main` y handoff. Sin tocar producción ni prueba, sin leer filas y sin fusionar.

## COMPLETADO

- **Reproducido con dobles** que aplican los comodines de verdad:
  - Un `From` parecido entra al hilo de otro cliente, y uno en otro tenant vuelve ambiguo al cliente real.
  - Una invitada queda enlazada a la ficha de nómina de otra persona.
  - La baja de un correo le quita el marketing a un parecido.
- **Corregido en los tres sitios** con `lib/shared/email-literal.ts`, idéntico al de la #361.
- **`coincideIlike`:** la imitación de `ILIKE` para los dobles, comprobada contra Postgres. El doble viejo de `inbound-email.test.ts` comparaba exacto y por eso nunca pudo ver esto.
- **`revisar-datos-ve`, acotada al diff:** en la spec. 5 ENCONTRADO (3 corregidos, 2 sin corregir), 2 CORRECTO, 4 NO VERIFICABLE.

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| Control rojo: las pruebas nuevas contra el código anterior | PASÓ: 19 en rojo. Correo entrante 7, baja 3, invitación 9 |
| Mutantes | PASÓ: 10 de 11 mueren, sobre un commit y con `git status` limpio al final. El otro es equivalente: el `.update` repite el filtro de tenant. Quitando los dos filtros, muere |
| Conteo en producción: ¿alguna ficha enlazada a una cuenta con otro correo? | PASÓ, medido por el Director General el 2026-11-02 a las 18:52Z, con exit 0 y terminando en `rollback`: `por_comodin` = 0, `correo_distinto` = 1. **No es incidente:** hoy no queda huella de este defecto. No prueba que nunca pasó: un enlace ya deshecho no deja rastro, y una ficha que cambió de correo después ya no cuenta en `por_comodin`. Autorización de Sam, literal: «Sí, autorizo el conteo». Los datos no se registran aquí |
| `pnpm knowledge:status` | NO EJECUTADO en este worktree. Dio NO DISPONIBLE en el de la #361 |

**Medición contra PostgREST v14.17 real (2026-11-03):** PASÓ, 28 de 28, con 2 contenedores de 1 GB, puertos en 127.0.0.1, sin OOM y borrados al terminar. La de la #361 no servía: solo probó el patrón en un `select`. Esta cubre las cadenas de los tres caminos, incluidos los `update` por `id`. Son copias de esas cadenas, con una comprobación previa de que siguen escritas así en sus archivos; no es el código de la app corriendo.

**`pnpm verify` sobre `bfc6cc9f0`, exit 1.** 16 de 17 pasos corrieron, de las 20:32Z a las 22:13Z, con 0 pesadas ajenas al lanzar.

| Paso | Resultado |
|---|---|
| `harness`, `lint`, `rsc-boundary`, `typecheck`, `edge-functions` | PASÓ |
| `test` | **FALLÓ por carga, sin relación con este diff.** Primer intento: 13.286 bien, 4 mal en 3 archivos, y 3 errores de workers. Reintento: 13.452 bien, 14 mal en 6 archivos. Hubo tiempos agotados, workers que no arrancaron y búsquedas de texto en pantalla que no llegaron a tiempo, con un mínimo de 0,7 GB libres. Los 9 archivos (`supplier-flow`, `ResetPinDrawer`, `migraciones`, `PackingListProductsStep`, `anon-privilegios-residuales`, `pglite-limpio`, `entorno-prueba-scripts`, `zarpe-avanza-envios`, `client-account`) **aislados sobre el mismo SHA, con un solo worker: PASÓ, 192 de 192 en 10 archivos, en 513 s.** El filtro alcanzó uno más |
| `docs:check`, `numbering`, `feature-constants`, `components:check`, `governance:check`, `pending-migration-symbols` | PASÓ |
| `migrations-applied` | NO EJECUTADO: worktree sin `.env.local`. Esta PR no trae migraciones |
| `sql-tests`, `schema-rebuild` | PASÓ, leído en el log, con Docker arriba |
| `e2e` | PASÓ con aviso, al reintento. Primer intento: falla `company-photo-carousel.spec.ts:93` y `smoke.spec.ts:150` inestable. Reintento: 226 bien, 20 omitidas, 3 inestables (`auth.spec.ts:81`, `company-photo-carousel.spec.ts:93`, `smoke.spec.ts:150`), y salida ≠ 0 por el worker de WebKit, que `verify` absuelve. Ninguna depende de esta spec |
| `build` | PASÓ |

**Docker aguantó todo el `verify`:** con `vigia-0597`, 81 muestras de 81 en `running`, 101 min, y 0 líneas `stopping VM` en su log. Ya está borrado.

**Cierre de la diferencia con `main`, sobre `30099400c`,** con `main` en `8feae0e8b`, ya con la #361 adentro, y un solo worker: 209 pruebas en 13 archivos, `typecheck`, `eslint` de lo tocado, `docs:check` y `sdd:check`, todo PASÓ.

## COMMITS

Los SHA quedan en la PR. Un commit por daño, para poder revisarlos y separarlos:

1. `chore(sdd): reserva SDD-0600 — ilike-correo-literal`
2. `fix(studio): SDD-0600 — un From parecido no entra al hilo de otro cliente`
3. `fix(web): SDD-0600 — la invitación no enlaza la ficha de nómina de un parecido`
4. `fix(web): SDD-0600 — la baja de marketing no alcanza a un parecido`
5. `docs(sdd): SDD-0600 — spec, revisión de datos personales y handoff`
6. Merges de `main`: hasta `bfc6cc9f0` (el que midió `verify`) y `30099400c` (el del cierre)
7. `docs(sdd): SDD-0600 — registra medición, verify y cierre por comprobación`: solo documentación

## PR / BRANCH

- Rama: `codex/ilike-correo-literal`.
- [PR #363](https://github.com/SoftAgentes/DTDCARGO/pull/363) en borrador contra `main`. La fusiona el Director General.

## PENDIENTES DE ESTA TAREA

- [ ] `status` de la spec: queda en `in-progress` hasta que el Director General la integre.

## FUERA DE ALCANCE DETECTADO

- **La ficha del `correo_distinto`:** el conteo dio 1, que no es este defecto. Revisarla necesita otro OK de Sam, y eso lo lleva el Director General. No se investiga desde aquí.
- **Carga de `verify`:** `test` falló en 9 archivos que pasan aislados. Este `verify` dio más rojos que el de la #361, con el mismo método: se lanzó con 3,9 GB libres frente a 4,4, y tuvo un mínimo de 0,7 GB frente a 1,8. Es una correlación de dos corridas, no una causa medida.
- **`company-photo-carousel.spec.ts:93`, `auth.spec.ts:81` y `smoke.spec.ts:150`** fallaron o salieron inestables en el `e2e`. No dependen de esta spec, y no los investigué.
- **El remitente sin cliente queda en el log en texto plano** (`app/api/conversaciones/email/route.ts:146`, `:151`), y este cambio manda ahí a los parecidos.
- **La baja no deja cuándo se retiró el consentimiento** (`unsubscribe-request.ts:120`). Arreglarlo pide migración.
- **Qué autentica el `From`:** no encontré SPF ni DKIM en el código. Quien falsifique el `From` exacto de un cliente no queda cubierto.
- **`.ilike` en búsquedas del Studio con sesión:** no se revisaron uno por uno.
- **`coincideIlike`** está también dentro de la prueba de la #361; se puede unificar cuando las dos estén en `main`.

## HANDOFF AL DIRECTOR

- **Reporto al Director General.** Número y límites, suyos.
- **Medición, `verify` y cierre:** hechos, por comprobación, en «VALIDACIÓN». No se aplicó nada ni se fusionó nada.
- **Para fusionar:** su decisión, leyendo el CI de la cabeza. La PR entra en el mandato de Sam para las fases 2, 3 y 4. Lo único en rojo de `verify` fue `test`, por carga, y esos archivos pasan aislados.
- **Impacto documental:** ninguno en runbooks. La spec y este handoff.
- **Conocimiento:** Graphify y Archify no se regeneraron. Queda pendiente para la integración.
