---
sdd: "0369"
title: Mantener un único proyecto declarado en la preparación E2E
status: in-progress
author: Codex
created: 2026-09-02
updated: 2026-09-02
supersedes: null
superseded_by: null
related: ["0168", "0320", "0329"]
confidencialidad: interno
---

# SDD-0369 — Frontera del destino E2E

## Problema y alcance

La revisión del pendiente de bootstrap encontró dos condiciones en el arnés:

1. `loadE2EEnvironment` compara sólo el primer segmento del hostname con el
   project ref. No exige el dominio completo de Supabase ni una URL base limpia.
2. `preparePlaywrightRuntime` valida la fixture efímera, pero conserva una
   pareja NEXT_PUBLIC de otro destino si ya está declarada. La llave elevada
   usada por Next tampoco se liga a la fixture; los aliases se mutan antes de
   terminar la validación del resto del entorno.

La reproducción debe usar funciones reales y valores sintéticos con red
bloqueada. No se afirma que una corrida haya escrito en un destino equivocado.
No se leen archivos de secretos, sesiones o filas alojadas para comprobarlo.

La política vigente de `e2e/README.md` exige branches efímeros alojados para
login/escrituras. Este correctivo no cambia esa decisión, no crea un branch,
no ejecuta seeds y no convierte el servidor deny-only en Auth/PostgREST/Storage.
El bootstrap completo sigue pendiente y no se declara resuelto por este guard.
`seed-test-client.mjs` es otro flujo legado que escribe en el proyecto configurado;
no se ejecuta ni se incorpora a este arranque. Su disposición exige revisión aparte.

Numeración: `pnpm sdd:next`, 15 refs; 0369 libre. No hay migración nueva.

## Contrato

- E2E efímero conserva las confirmaciones existentes y la prohibición del ref
  productivo. El ref debe ser una etiqueta DNS minúscula válida, no un dominio.
  La URL debe ser HTTPS, hostname exacto `<ref>.supabase.co`, puerto estándar,
  sin credenciales, path distinto de raíz, query ni fragmento. Barra final y
  puerto HTTPS por defecto son equivalentes. Errores no imprimen URL/keys.
- Si se declaran variables Supabase de Next junto con el modo efímero, deben
  corresponder a la URL/anon/service-role validados. La pareja pública parcial
  sigue fallando. Un flag deny-only incompatible también falla; no se mezclan
  ambos modos ni se corrige silenciosamente un destino contradictorio.
- Sólo si Playwright inicia Next local se derivan las variables ausentes del
  entorno efímero validado. La service-role permanece exclusivamente server-side.
  Un Preview externo no recibe inyección de variables del servidor remoto;
  comparar variables locales NO demuestra la identidad real de ese backend.
- Preparación atómica: ante cualquier error no queda ningún alias ni cambio
  parcial en el objeto de entorno. Una segunda preparación coherente es estable.
- El modo no-efímero conserva configuración completa, fallback local deny-only,
  Preview existente, puertos, límites, proyectos, retries y selección de pruebas.
- No cambiar SDK, autenticación del producto, aplicación, cookies, SQL, permisos,
  seeds, proveedores o configuración alojada. Ningún valor real se persiste.

## Allowlist exacta

- `scripts/e2e/sdd-0168-fixture.ts` — guard y aliases, agente principal.
- `playwright.config.ts` — preparación del arnés, agente principal.
- `scripts/__tests__/e2e-target-boundary.test.ts` — reproducción independiente.
- `e2e/README.md` — contrato operativo del guard, agente principal.
- `docs/specs/0369-e2e-project-boundary/spec.md` — plan y evidencia.
- `docs/specs/README.md` — índice generado.
- `docs/audits/2026-09-02-codex-arranque-checklist.md` — estado sin falso cierre.
- `.agents/handoffs/2026-09-02-saneamiento-integral-close.md` — continuidad.

## Plan y aceptación

- [x] RED causal y GREEN con reproducción independiente: host/ref/URL inválidos y mezcla de
  URL/llaves/deny-only se rechazan sin red ni mutación parcial; controles válidos
  efímeros y no-efímeros conservados, incluida preparación repetida.
- [x] Consumidores existentes y suite unitaria completa, TypeScript/ESLint,
  carga real de Playwright (`--list`) con matriz sintética, selección Tier 3
  intacta, gates documentales y revisión independiente aprobados.
- [ ] Publicación/CI del SHA propio y validación real del entorno efímero
  autorizado; no cerrar el bootstrap ni atribuir un smoke autenticado al --list.

Orden: reproducción → guard → consumidores/carga de config → revisión → commit
selectivo. El SDD del proyecto conserva el contrato y su checklist; no se crea
un segundo backlog. El desarrollo del stack completo no forma parte del fix.

## Verificación prevista

- `pnpm exec vitest run scripts/__tests__/e2e-target-boundary.test.ts scripts/__tests__/sdd-0168-fixture.test.ts scripts/__tests__/playwright-config.test.ts`.
- `pnpm test`, `pnpm typecheck` y ESLint de los archivos TypeScript modificados.
- Playwright `--list` con variables sintéticas del proceso, sin servidor,
  navegador, seed o petición HTTP; deben seguir presentes los 18 Tier 3.
- `pnpm docs:index`, `pnpm docs:check`, `pnpm sdd:check`,
  `pnpm governance:check`, `pnpm components:check`, `git diff --check`.
- SQL/rebuild/advisors no aplican al delta: no cambia ningún objeto de base.
  Los resultados de 0368 no se presentan como nuevas ejecuciones de esta pieza.

## Gobernanza y límites de evidencia

No aplica cambio de componentes, UI, verbos, permanencia o auditoría de negocio:
el delta pertenece al tooling de pruebas, fuera del runtime del Studio.
No conformidad inicial: destino declarado incoherente y preparación parcial.
Cumplimiento exigido: error explícito antes de efectos, pruebas causales,
evidencia local separada de Cloud y autorización de publicación no heredada.
No se captura, mueve ni borra información personal; sólo fixtures en memoria.

Fuentes consultadas: [inicialización de Supabase](https://supabase.com/docs/reference/javascript/initializing)
y [clientes SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client).
El SDK recibe URL y key explícitas; este guard es responsabilidad del arnés.
Changelog consultado; no se actualiza ninguna dependencia ni API.

## Resultado local · 2026-09-02

- Reproducción independiente, repetida por el principal antes de editar:
  **23 fallos causales y 13 controles**. No se crean clientes ni se llama fetch;
  los dos límites de red están bloqueados en las pruebas.
- Tras el correctivo: **62/62 pruebas en 3 archivos**, incluidos los 36 casos
  nuevos y los 26 consumidores existentes. Se conserva la prohibición del ref
  productivo y las confirmaciones explícitas del entorno efímero.
- Suite completa: `pnpm test --reporter=dot`, **6.477 pruebas/539 archivos**,
  exit0. Se conservan avisos de pruebas React/jsdom y logs de negativos; no se
  silencian ni se atribuyen al guard. TypeScript global y ESLint de los tres
  archivos TypeScript modificados: exit0.
- CLI real de Playwright con `--list` y entorno de proceso sintético aislado:
  **18 tests/4 files/3 proyectos**. Segunda carga con service-role incoherente:
  exit no cero en el guard, sin reflejar ninguna de las claves sintéticas.
  Ninguna carga inició Next, navegador, seed ni peticiones a Supabase.
- Numeración: 361 specs/421 migraciones, sin colisiones nuevas; excepciones
  históricas aplicadas preservadas. Gobernanza y componentes aprobados.
  Índice generado, validación documental y `git diff --check` forman parte
  del cierre de este mismo incremento.
- Revisión independiente: **APROBADO, sin Required** sobre las cuatro rutas
  de implementación/test/spec. No certifica el backend de Preview ni datos
  alojados. La aserción unitaria adicional de redacción fue sugerida como
  opcional; el código usa errores constantes y la CLI negativa comprueba que
  los valores de claves no aparecen en su salida.
- No se repiten build de aplicación, navegador autenticado, SQL/rebuild ni
  Deno por un delta exclusivo del tooling E2E, sin runtime de producto, schema
  o Edge modificados. La carga real de configuración sí se ejecutó.

La spec sigue `in-progress` por publicación/CI y validación efímera real
autorizada. **No cambia el avance 51/105 (48,6 %)**: es progreso parcial del
bootstrap existente, no una nueva casilla terminada. No hay migración nueva:
continúan 26 gates nominales de aplicación (0399–0424), sin ejecutar.
