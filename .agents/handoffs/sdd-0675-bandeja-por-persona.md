# Handoff · SDD-0675 — Bandeja como acceso adicional por persona

Fecha: 2026-11-18 · Rama `claude/sdd-0675-bandeja-por-persona` · PR #686 · Reserva `refs/dtd/reservations/0675` ·
Migración asignada: 0565 (en espera; `pendingBelowCutoff`).

## Hecho

- Decisiones de Sam registradas literal (spec §0 y §5): «Leads y Clientes» (opción D de la SDD-0671) y
  «Sí, siempre las dos». La pregunta 2 («ver y editar») sigue sin respuesta; se aplica la recomendación: el
  administrador elige el nivel al conceder.
- F0: `supabase/migrations/0565_bandeja_concedible_por_persona.sql` suma `bandeja` a los 8 módulos de la 0538.
  - El preflight aborta si falta la 0538 o si se reaplica.
  - El postflight exige los 8 módulos de la 0538, uno por uno, más `bandeja`, con `admin` y `users` fuera y
    los privilegios iguales.
  - El desarme está en `supabase/desarmes/0565_desarme.sql`.
- F1: `bandeja` en `COVERED` (`lib/studio/user-module-grants.ts`).
- F2: el ciclo de agentes lee los accesos de `bandeja`. Si esa lectura falla, el ciclo se omite y no da de baja
  a nadie.
- F3: la matriz da Leads y Clientes a quien entra por acceso (`destinosDe(..., porAcceso)`). `porAcceso` solo
  viaja cuando es verdadero.
- F4: «Agentes vinculados» y `altaAgente` cuentan el acceso.
- F5: conceder o revocar `bandeja` en Usuarios sincroniza a esa persona con Chatwoot.

## Evidencia (2026-11-18, turno de PC del DG)

- Vitest acotado, `--pool=forks`: **PASÓ**, 8 de 8 archivos y 173 de 173 pruebas.
  - `matriz`, `agentes-ciclo`, `alta-agente`, `acceso-bandeja-chatwoot`, `user-module-grants-bandeja`,
    `user-module-grants.migration`, `bandeja-concedible.migration` y `crm-acceso`.
  - La primera corrida falló en 3 pruebas. Dos esperaban agentes sin `porAcceso`; se corrigió el código, no las
    pruebas. La tercera era el mutante «pierde un módulo de la 0538», que no caía porque el postflight solo
    revisaba `kommo`: se endureció el postflight.
- ESLint de los 15 archivos `.ts`/`.tsx` del diff: **PASÓ**.
- Gate `pending-migration-symbols`: **PASÓ** (0 rojo, 0 amarillo).
- `pnpm verify`: **NO EJECUTADO** (sin turno; el portón es la CI de GitHub).

### Revisión de la #686 (APPROVED en 3ae205ef3, con 7 puntos)

1. Si falla la lectura de accesos, el ciclo aplica igual las bajas `desactivado` y `fuera_del_tenant`. Deja en
   espera las `sin_bandeja` (`sinBandejaEnEspera`), no corre la matriz y levanta la alerta de salud
   `accesos_no_leidos` (textos en es-VE y zh-CN).
2. Al conceder o revocar `bandeja`, si Chatwoot no queda al día, la acción guarda y devuelve «Guardado;
   Chatwoot quedó pendiente hasta el próximo ciclo.». La pestaña Acceso lo muestra. `sincronizarAgenteDeUsuario`
   ahora devuelve `boolean` (`quedoAlDia`).
3. El preflight revisa los 8 módulos de la 0538, uno por uno, y que la función no tenga ningún literal de más.
4. El postflight comprueba también EXECUTE de `service_role`.
5. El postflight rechaza cualquier módulo de más, comparando los literales del cuerpo.
6. El mutante «pierde un módulo» ya no acepta la alternativa `|TEST 0565`. Se suman los mutantes «módulo de
   más» y «sin EXECUTE de service_role», y dos pruebas de preflight.
7. El desarme va entre `begin` y `commit`. Además se ensaya en PGlite: aborta con un acceso vigente y devuelve
   la lista de la 0538 sin accesos.

Además:
- `AccesoPanel.test.tsx` tenía el contrato viejo de la 0622 («Bandeja no se puede dar»); se enmendó.
- «Todo Comercial» ya no suma la Bandeja; el DG lo aceptó.

Evidencia, con turno de PC (2026-11-18):
- Vitest de 9 archivos (los 8 de antes más `AccesoPanel.test.tsx`): **PASÓ**, 208 de 208.
- `AgentesBandeja` y `UserDetailDrawer`: **PASÓ**, 13 de 13.
- ESLint de los 20 archivos `.ts`/`.tsx` del diff: **PASÓ**.
- `tsc --noEmit`: falló solo en `next.config.ts:226` (`agentRules`). **Corrección:** la causa era el
  `node_modules` viejo de este worktree (next 16.2.11 contra 16.4.6 del lockfile), no el código. Se reinstaló
  con `pnpm install --frozen-lockfile` y se repitió más abajo.
- No se leyeron ni escribieron datos de producción.

### Re-revisión de 714e9cf24 (bloqueante y un punto nuevo)

- `agentes-usuario.test.ts` esperaba `undefined`; ahora espera `false`. Se suman pruebas directas de
  `quedoAlDia`, una por cada causa de «pendiente».
- **Absorbe la SDD-0677** (decisión del DG). Si falla la lectura de `user_tenants` o de
  `studio_role_module_overrides`, el ciclo no aplica ninguna baja ni la matriz y devuelve `sinEstado`. Levanta la
  alerta `miembros_no_leidos` (código fijo, sin PII). Antes, un mapa vacío habría dado de baja a todos como
  `fuera_del_tenant`. Las pruebas usan dobles que devuelven un error real y un control con el estado leído.
- El ensayo del desarme sin accesos revisa los 8 módulos de la 0538.

Evidencia, con turno de PC y `node_modules` reinstalado (next 16.4.6):
- Vitest de 11 archivos (los 9 de antes, más `agentes-usuario` y `AgentesBandeja`): **PASÓ**, 236 de 236.

## Pendiente de esta tarea

- CI de GitHub y revisión independiente de la #686.
- Respuesta de Sam a la pregunta 2 de la spec §5.
- Aplicar la 0565 en producción solo con el OK nominal de Sam para ese archivo y el runbook, a través del DG.

## FUERA DE ALCANCE DETECTADO

- Un desvío por rol que da `bandeja` a un rol sin bandejas en la matriz deja a esas personas en Chatwoot sin
  bandejas (spec §3, última fila).
- Un comercial que necesita también Clientes no se resuelve con «siempre las dos»: hace falta la elección por
  persona.
