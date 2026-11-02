# Handoff — SDD-0600 · Un correo no se compara como patrón

Fecha: 2026-11-02. Task ID: `sdd-0600-ilike-correo-literal`.
Owner / sesión escritora: `ilike-correo-literal-sad-jones` (Worker Claude Code, la misma sesión de la SDD-0597).

Estado: **PR en borrador. No se integra sin orden del Director General.** Falta `verify` y la medición contra PostgREST real, los dos con su aviso.

- **Worktree:** `DTD-worktrees/ilike-correo-literal`, con `node_modules` enlazado por junction al de `sad-jones-d0695e`. **No correr `pnpm` aquí:** usar `node node_modules/vitest/vitest.mjs`. Al limpiar, quitar la junction con `cmd /c rmdir`.
- **Rama:** `codex/ilike-correo-literal`, sobre la reserva `0c80f82b2`, cuyo padre es `7be2ed9e5` (`origin/main`).
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
| Tres sitios, `email-literal`, `coincide-ilike` y ruta del correo entrante, con `--maxWorkers=1` | PASÓ: 128 pruebas en 9 archivos |
| Mutantes | PASÓ: 10 de 11 mueren, sobre un commit y con `git status` limpio al final. El otro es equivalente: el `.update` repite el filtro de tenant. Quitando los dos filtros, muere |
| `eslint` de lo tocado, `docs:check`, `sdd:check`, `git diff --check` | PASÓ |
| `git merge-tree` con la #361 (`eae277a35`) y la #358 (`cf81cbf30`) | PASÓ: limpio, solo a nivel de texto |
| `pnpm verify`, incluido `tsc` | NO EJECUTADO: pide turno al Director General |
| El escape contra PostgREST v14.17 real | NO EJECUTADO: va en la corrida de la #361. **Condición de integrar** |
| `pnpm knowledge:status` | NO EJECUTADO en este worktree: no corre `pnpm` por la junction, y dio NO DISPONIBLE en el de la #361 |

## COMMITS

Los SHA quedan en la PR. Un commit por daño, para poder revisarlos y separarlos:

1. `chore(sdd): reserva SDD-0600 — ilike-correo-literal`
2. `fix(studio): SDD-0600 — un From parecido no entra al hilo de otro cliente`
3. `fix(web): SDD-0600 — la invitación no enlaza la ficha de nómina de un parecido`
4. `fix(web): SDD-0600 — la baja de marketing no alcanza a un parecido`
5. `docs(sdd): SDD-0600 — spec, revisión de datos personales y handoff`

## PR / BRANCH

- Rama: `codex/ilike-correo-literal`.
- PR en borrador contra `main`, retenida.

## PENDIENTES DE ESTA TAREA

- [ ] `pnpm verify`, con aviso del Director General. Pide `tsc`: las lecturas nuevas de la baja y la invitación solo pasaron `eslint`.
- [ ] Medición del escape contra PostgREST real, en la corrida de la #361.
- [ ] Merge de prueba con la #361 y la #358, y pruebas sobre el resultado, cuando estén listas.
- [ ] `status` de la spec: queda en `in-progress` hasta tener lo anterior.

## FUERA DE ALCANCE DETECTADO

- **¿Ya pasó en producción?** No se sabe. Propuesta para Sam: un conteo, sin imprimir datos, de fichas cuyo `auth_user_id` apunta a una cuenta con otro correo. Si da más de cero, alguien pudo ver recibos ajenos. Necesita su autorización: no se hizo.
- **El remitente sin cliente queda en el log en texto plano** (`app/api/conversaciones/email/route.ts:146`, `:151`), y este cambio manda ahí a los parecidos.
- **La baja no deja cuándo se retiró el consentimiento** (`unsubscribe-request.ts:120`). Arreglarlo pide migración.
- **Qué autentica el `From`:** no encontré SPF ni DKIM en el código. Quien falsifique el `From` exacto de un cliente no queda cubierto.
- **`.ilike` en búsquedas del Studio con sesión:** no se revisaron uno por uno.
- **`coincideIlike`** está también dentro de la prueba de la #361; se puede unificar cuando las dos estén en `main`.

## HANDOFF AL DIRECTOR

- **Reporto al Director General.** Número y límites, suyos. No arranco `verify` ni Docker sin su aviso.
- **Retenida:** no se integra antes de publicar, por su decisión. Sam pidió hacer el trabajo; integrarlo sigue siendo decisión del Director General.
- **Para que decida o se lo presente a Sam:** el conteo de fichas de arriba. Es el dato que dice si esto es un riesgo o un incidente.
- **Impacto documental:** ninguno en runbooks. La spec y este handoff.
- **Conocimiento:** Graphify y Archify no se regeneraron. Queda pendiente para la integración.
