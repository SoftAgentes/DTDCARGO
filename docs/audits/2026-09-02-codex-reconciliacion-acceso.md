---
title: "Codex: reconciliación del dominio de acceso sin falsos cierres"
tipo: auditoria-operativa
autor: Codex
estado: verificado-local-y-git
created: 2026-09-02
updated: 2026-09-02
review-by: 2026-09-09
confidencialidad: interno
---

# Acceso · código integrado, validación operativa pendiente

Este lote revisa dos specs antiguas y fortalece sus pruebas, sin volver a
implementar las correcciones ni marcar como terminada la validación que falta.
SDD-0299 y SDD-0302 permanecen `in-progress`: el inventario sigue en 353 specs,
262 `done`, 1 `superseded` y 90 sin cierre documental.

## Evidencia de Git y decisión

Ambos `git merge-base --is-ancestor <commit> origin/main` terminaron en 0,
contra `origin/main@2a2e81bf554dbe7bd4f05170847e8f02e988d320`. El diff entre
main y checkout estaba vacío para proxy, actions, traductor y contratos previos.

| Spec | Código ya integrado | Evidencia adicional de este lote | Lo que impide cerrarla |
|---|---|---|---|
| 0299 | `f23557dd` | 30 pruebas de las cinco actions y adaptador reales; doble sólo en RPC, guard y caché | Ver el error en el drawer y comprobar que no cierra ni declara éxito |
| 0302 | `8020e847` | 22 pruebas de matcher/proxy/Next reales; doble sólo en Auth | Navegación real con sesión vencida y refresh válido, incluida la siguiente petición |

También se leyó completa SDD-0291. Sigue abierta: requiere evidencia de entrega
del aviso del cron real; no se forzó el cron ni se mandaron correos/Telegram.
Las mediciones del proveedor y fechas de su documento son históricas, no una
nueva verificación del estado del servicio. SDD-0289 sólo fue leída; no se
declara revisado ni cerrado su contrato de exportación.

## Qué prueban y qué no prueban los dobles

- La prueba de empresa deja reales `executeD1Operation`, `D1OperationError`,
  traductor, validadores y las cinco actions. El error llega a `CompanyActionState`
  sin `ok`; no comprueba RLS, permisos reales ni render del componente.
- La prueba del proxy deja reales matcher, request, response y proxy. Comprueba
  la actualización del request y la respuesta de cookies con chunks/opciones;
  no comprueba la renovación JWT dentro del SDK ni un navegador conectado.
- `fetch` se sustituye por una función que falla ante cualquier llamada y se
  exige que no haya llamadas. Sólo se usan fixtures sintéticos en memoria.
- No se cambian runtime, políticas, componentes, dependencias, configuración,
  datos de negocio, secretos o sesiones. No se ejecuta SQL ni se crea migración.
- Son regresiones adicionales de código ya corregido. Las mutaciones de las
  specs originales son evidencia histórica, no ejecuciones de esta tanda.

La [guía oficial SSR de Supabase](https://supabase.com/docs/guides/auth/server-side/nextjs)
distingue la propagación de cookies hacia el servidor y hacia el navegador;
la prueba verifica ambos lados del código instalado, sin migrar su API. Se
consultó también el changelog; no se adoptó una actualización de dependencias.

## Verificación ejecutada

- Focal: `pnpm exec vitest run app/__tests__/proxy-refresh.test.ts app/__tests__/proxy-matcher-contract.test.ts "app/studio/(app)/admin/__tests__/company-actions.test.ts" lib/studio/__tests__/company-error-message.test.ts`:
  **61/61 en cuatro archivos** (52 nuevas + 9 existentes).
- Suite completa: **529 archivos / 6.013 pruebas aprobadas**, sin pruebas
  omitidas; `pnpm test` terminó en 120,75 s.
- ESLint de ambos archivos y `pnpm typecheck`: aprobados.
- `docs:index`, `docs:check`, `sdd:check`, `governance:check`,
  `components:check` y `git diff --check`: aprobados. Inventario: 353 specs,
  414 migraciones, 28 políticas y cinco fuentes de componentes.
- El CI de base `d4a63115`, run `33667880574`, terminó **success** el
  2026-09-02 a las 18:47:15 UTC, incluido build. Es independiente del nuevo lote:
  el CI de su commit debe consultarse en el PR después de publicarlo.
- No se repiten SQL/rebuild/E2E: no cambian sus entradas ni el runtime. Se
  conservan los baselines y omisiones del handoff integral, sin atribuirles
  ejecución nueva. El build del CI anterior no sustituye el CI del nuevo SHA.

## Checklist de cierre restante

- [ ] 0299: fixture de navegador no productivo o escenario explícitamente
  autorizado; rechazo visible, drawer abierto, valores conservados y sin éxito.
- [ ] 0302: entorno Auth no productivo reproducible, usuario sintético y sesión
  vencida; validar navegación y siguiente petición en los prefijos afectados.
- [ ] 0302: para afirmar estado de producción, smoke autorizado con sesión
  real; la prueba local no sustituye configuración/cookies del despliegue.
- [ ] 0291: confirmar recepción ya producida por el cron con evidencia
  autorizada; no disparar una comunicación como parte del saneamiento.

## Allowlist exacta

- `app/__tests__/proxy-refresh.test.ts`
- `app/studio/(app)/admin/__tests__/company-actions.test.ts`
- `docs/specs/0299-el-error-dice-su-causa/spec.md`
- `docs/specs/0302-el-refresco-que-nunca-aterrizo/spec.md`
- `docs/specs/README.md` (sólo si la regeneración produce cambios)
- `docs/audits/2026-09-02-codex-reconciliacion-acceso.md`
- `docs/audits/2026-09-02-codex-arranque-checklist.md`
- `.agents/handoffs/2026-09-02-reconciliacion-acceso-close.md`
- `.agents/handoffs/2026-09-02-saneamiento-integral-close.md`

Gobernanza: cumplimiento del estado de error y preservación del primer gate
en las pruebas; no aplica cambio de comportamiento, componente o política.
No se crea una SDD duplicada para probar correcciones existentes. El cierre de
este lote de pruebas no cierra las specs ni el objetivo integral.
