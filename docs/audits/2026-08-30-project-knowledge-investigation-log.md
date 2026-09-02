# Bitácora de investigación técnica — DTD Cargo

> **Bitácora histórica.** Conserva el proceso y la evidencia del baseline
> `1610d667`. Fue trasladada a `docs/audits/` el 2026-09-01; sus comandos,
> rutas, conteos y conclusiones no deben interpretarse como el estado actual de
> Git, Cloud o Producción. El baseline vigente al traslado era
> `origin/main@2a2e81bf`.

**Estado:** COMPLETADA
**Inicio:** 2026-08-30T20:53:48-04:00
**Modo:** auditoría read-only del sistema; escritura limitada a `project-knowledge/`
**Baseline:** `origin/main` en `1610d667e744baf11b115bb523b5c7c491500d58`
**Worktree:** `C:\\Users\\Trabajo\\Desktop\\Developer\\software\\DTD-worktrees\\project-knowledge-handoff`
**Rama local:** `codex/project-knowledge-handoff-20260830`

## Alcance y reglas

- Reconstruir el know-how técnico necesario para mantener, ejecutar, depurar, modificar, probar y desplegar DTD Cargo.
- Etiquetar las conclusiones como **CONFIRMADO**, **INFERIDO** o **DESCONOCIDO**.
- No cambiar código, dependencias, migraciones, infraestructura, Cloud, producción ni datos.
- No ejecutar seeds ni acciones que puedan escribir contra el Supabase configurado.
- No copiar valores secretos; sólo nombres, ubicación lógica y dependencia.
- Mantener los cambios persistentes exclusivamente bajo `project-knowledge/`.

## Checkpoint 0 — Recepción y aislamiento

### Archivos y fuentes inspeccionados

- `AGENTS.md` (instrucciones entregadas con el repositorio).
- `docs/CODEX_HANDOFF.md` del checkout principal (handoff local fechado 2026-08-28; **no existe en `origin/main`** y sus cifras se tratarán como evidencia no publicada hasta re-medición).
- `C:\\Users\\Trabajo\\Downloads\\know-prompt.txt` (misión delegada por el usuario).
- Skill `project-auditor`, skill `web-quality`, skill `supabase:supabase` y base de amenazas de Forge.

### Comandos relevantes

- `git status --short --branch`
- `git worktree list --porcelain`
- `git fetch origin`
- `git rev-list --left-right --count HEAD...origin/main`
- `git worktree add -b codex/project-knowledge-handoff-20260830 ... origin/main`

### Descubrimientos

- **CONFIRMADO:** el checkout principal estaba 4 commits delante y 1 detrás de `origin/main`, con cambios ajenos en `pnpm-lock.yaml` y `pnpm-workspace.yaml`.
- **CONFIRMADO:** esos archivos no fueron tocados; la investigación se aisló en un worktree nuevo.
- **CONFIRMADO:** el worktree de investigación nació limpio y en `0/0` respecto de `origin/main` (`1610d667`).
- **CONFIRMADO:** `project-knowledge/` no existía en el baseline.
- **CONFIRMADO:** `docs/CODEX_HANDOFF.md` no está presente en `origin/main@1610d667`; el archivo leído pertenece a la rama adelantada del checkout principal.
- **INFERIDO:** el handoff de 2026-08-28 contiene una base valiosa, pero puede haber derivado; cada cifra material se volverá a medir.

### Riesgos y preguntas abiertas

- El proyecto tiene muchos worktrees concurrentes; no se inspeccionarán ni modificarán worktrees ajenos.
- El acceso local configurado puede apuntar a producción; se evitarán seeds y cualquier prueba con efectos laterales.
- La ausencia de evidencia dentro del repo no demostrará ausencia en Cloud/Vercel/DNS; esos puntos se marcarán como desconocidos.

### Siguiente paso

Reconocimiento medido de topología, manifiestos, entrypoints, arquitectura y superficies; luego distribuir dominios técnicos entre investigadores read-only.

## Control de cobertura

- [x] Repository topology
- [x] Backend
- [x] Frontend
- [x] Architecture
- [x] Database — migraciones, contratos y rebuild local; Cloud desconocido
- [x] Authentication
- [x] External integrations — código; estado de proveedores desconocido
- [x] Configuration
- [x] Environment variables — nombres y dependencias, nunca valores secretos
- [x] Local development — bootstrap parcial demostrado
- [x] Docker — PostgreSQL efímero para validación
- [x] Infrastructure — IaC versionada; estado alojado desconocido
- [x] CI/CD — ausencia de CI versionada confirmada
- [x] Testing
- [x] Deployment — procedimiento y límites externos identificados
- [x] Security observations
- [x] Critical workflows
- [x] Developer workflow
- [x] Technical debt
- [x] Final verification

## Registro cronológico

1. **2026-08-30T20:53:48-04:00 — Inicio.** Se leyó la misión, se separó su contenido de la autorización del usuario y se fijó alcance read-only.
2. **2026-08-30T20:53:48-04:00 — Aislamiento.** Se detectó trabajo ajeno en el checkout principal y se creó un worktree limpio desde `origin/main`.
3. **2026-08-30T21:02:00-04:00 — Divergencia documental.** Se comprobó que `docs/CODEX_HANDOFF.md` no forma parte del baseline remoto. Se degradó de fuente del baseline a evidencia local no publicada.
4. **2026-08-30T21:08:00-04:00 — Reconocimiento medido.** Se contaron 4.748 archivos versionados, 182 `page.tsx`, 81 `route.ts`, 394 migraciones, 138 contratos SQL, 305 specs SDD y 4 entrypoints de Edge Functions.
5. **2026-08-30T21:10:00-04:00 — Contradicción documental.** `README.md` todavía declara “Pre-MVP” y “Sin código”, lo que contradice directamente la topología ejecutable. Se clasificó como desactualizado.
6. **2026-08-30T21:15:00-04:00 — Restore reproducible.** `pnpm install --frozen-lockfile` terminó con exit 0 en 47,6 s, añadió 811 paquetes desde caché y no cambió `pnpm-lock.yaml` ni `pnpm-workspace.yaml`.
7. **2026-08-30T21:16:00-04:00 — Gate iniciado.** Se lanzó `node scripts/verify.mjs` sin `.env.local`; cualquier paso dependiente de producción deberá quedar como `SKIP` y no como verde.
8. **2026-08-30T21:26:00-04:00 — Arquitectura trazada.** Se cerró el mapa del monolito modular, sus cinco superficies, 56 módulos Studio, 65 handlers API y ocho flujos end-to-end.
9. **2026-08-30T21:31:00-04:00 — Gate parcial.** Pasaron lint (con 8 warnings), frontera RSC, typecheck, 4 Edge Functions, 5.833 pruebas unitarias, documentación, numeración, constantes, componentes, gobernanza, 138 contratos SQL y reconstrucción desde cero. `migrations-applied` quedó en `SKIP` por ausencia de credenciales.
10. **2026-08-30T21:36:00-04:00 — E2E sin entorno.** Playwright encontró 168 casos, pero las rutas protegidas empezaron a fallar porque faltan `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Se conservará el resultado como evidencia de setup incompleto, no como fallo funcional demostrado.
11. **2026-08-30T21:39:00-04:00 — Riesgos confirmados.** La revisión paralela confirmó deuda de supply chain, accesibilidad, observabilidad/CI y una brecha de separación de funciones: varias tablas con módulos restringidos por RBAC siguen concediendo CRUD al rol `authenticated` con RLS sólo por tenant.
12. **2026-08-30T22:03:00-04:00 — Gate terminado.** `verify` cerró exit 1: 14/15 pasos ejecutados, `migrations-applied` omitido, E2E 135 passed/18 skipped/15 failed + 1 error de worker por falta de URL/anon Supabase, y build de producción OK. Los 15 fallos son cinco contratos protegidos repetidos en tres proyectos de navegador.
13. **2026-08-30 — Configuración reconciliada.** Se construyó una matriz 107/107 de `.env.example`; el scan directo halló 119 nombres referenciados, 34 no declarados —30 propios y 4 del host— y 22 declarados sin referencia literal directa.
14. **2026-08-30 — Cobertura profunda.** Se ejecutaron y revisaron los 15/15 checks automatizables de una threat-db de 77 amenazas; se ampliaron 20 integraciones con auth/retry/timeout, el mapa backend, pooling/transacciones, lifecycle Auth, objetos SQL y workflow real.
15. **2026-08-30 — Segunda pasada.** Dos revisores read-only contrastaron los artefactos con el prompt y el código. Se corrigieron conteos, citas, HailuWay legado, CSP parcial, secretos en query, colas offline, DTD-9017 y preguntas que sí podían responderse desde el repo.
16. **2026-08-30 — Validación final.** Se regeneraron ambos HTML desde los Markdown canónicos. El parser HTML cerró sin excepción, IDs únicos y cierre `</html>`; final conserva 8 Mermaid, score 70 y matriz/20 integraciones, mientras la bitácora refleja COMPLETADA, Checkpoint 5 y 20/20 checks.

## Checkpoint 1 — Reconocimiento general

### Topología y manifiestos

- **CONFIRMADO:** es un único paquete npm/pnpm (`package.json` raíz, sin declaración de workspaces múltiples) y una sola aplicación Next.js desplegable; no hay Dockerfile, Compose, submódulos ni workflow de GitHub versionados.
- **CONFIRMADO:** tecnologías declaradas: Next `16.2.11`, React `19.2.4`, TypeScript `^5` strict, Tailwind `^4`, Supabase JS `^2.106.1`, Vitest `^4.1.7` y Playwright `^1.60.0`.
- **CONFIRMADO:** runtime local observado: Node `v24.15.0`, pnpm `11.1.2`, Git `2.54.0.windows.1`, Docker `29.7.2`.
- **CONFIRMADO:** hay 305 specs SDD: 213 `done`, 76 `in-progress`, 8 `proposed`, 4 `approved`, 3 `draft` y 1 `superseded`.
- **CONFIRMADO:** `node scripts/check-numbering.mjs` sale 0, pero declara 11 colisiones históricas ya aplicadas; `0394` aparece tres veces y no debe renumerarse.
- **CONFIRMADO:** `.github/` sólo contiene una plantilla de issue; el gate de 15 pasos vive en `scripts/verify.mjs` y corre localmente.
- **CONFIRMADO:** `vercel.json` declara 16 cron jobs y un `ignoreCommand` que decide el build mirando sólo el último commit.

### Deriva documental observada

- **CONFIRMADO:** `README.md` describe una web pública pre-MVP separada y “sin código”; el baseline contiene un ERP/portal/PWA/Back sobre Supabase con miles de archivos.
- **CONFIRMADO:** `AGENTS.md` del baseline enumera rutas y redirecciones que ya difieren de `next.config.ts`; el checkout principal tiene una corrección documental no publicada.
- **CONFIRMADO:** la auditoría fechada 2026-08-24 cuenta 385 migraciones, 114 contratos y 50 specs `in-progress`; el baseline re-medido tiene 394, 138 y 76 respectivamente. Es una foto histórica, no estado actual.

### Hipótesis y siguientes pasos

- **INFERIDO:** la arquitectura es un monolito modular multi-superficie, no un monorepo ni microservicios; falta cerrar el trazado de dependencias y flujos.
- Validar el gate completo, los flujos críticos, el modelo de datos, las fronteras de seguridad, la operación local y los unknowns externos.

## Checkpoint 2 — Arquitectura y flujos

### Arquitectura confirmada

- **CONFIRMADO:** un paquete privado `dtdcargo-web`, una aplicación Next.js y un despliegue web principal; no es un monorepo multi-paquete.
- **CONFIRMADO:** el sistema tiene cinco superficies de producto: sitio público (44 páginas públicas/auxiliares), Studio (87), Portal (30), móvil PWA (19) y Back (2).
- **CONFIRMADO:** `app/api/` contiene 65 handlers: 26 Studio, 17 cron, 4 móviles, 3 públicos, 2 Portal, 1 webhook y 12 auxiliares.
- **CONFIRMADO:** el backend se reparte entre Server Components, 89 `app/**/actions.ts` (93 en todo el repo), Route Handlers, RPC/PostgREST y 4 Edge Functions Deno de Kommo.
- **CONFIRMADO:** `lib/studio/modules.ts` registra 56 módulos Studio; la persistencia es Supabase Postgres/Auth/Storage con acceso browser/SSR bajo RLS y un cliente admin que omite RLS.
- **INFERIDO con evidencia fuerte:** la forma real es un **monolito modular multi-superficie con satélites asíncronos**, no microservicios.

### Flujos trazados

1. Calculadora pública → RPC públicas Supabase → cálculo local → WhatsApp → telemetría anónima.
2. Registro express → deduplicación/MARKBOX → `clients`/Auth/`client_users` → correo y Kommo best-effort.
3. Login Studio por password y Portal por magic link/OTP, ambos sobre Supabase Auth y membresías diferentes.
4. Alta de envío Studio → Server Action → `shipments` → eventos/workflow/costing.
5. Detalle Portal → sesión/RLS → envío propio → eventos/documentos → lecturas admin acotadas por IDs validados.
6. Recepción móvil CN → PIN → cookie HTTP-only → RPC → Storage privado → vinculación.
7. CRM → outbox → Edge Function Kommo → proveedor → espejo read-only; estado alojado desconocido.
8. Adjuntos de Gastos → reserva → TUS directo → scan/backup worker → documento descargable sólo si está limpio; estado del piloto desconocido.

### Contradicciones relevantes

- `docs/architecture/stack-tecnico.md` llama “monorepo” al sistema y contiene versiones/conteos obsoletos.
- La documentación enumera cuatro superficies, pero Portal es una quinta superficie real con 30 páginas.
- La documentación afirma HTTP a HailuWay para todo el sitio público; `/tarifas` usa RPCs Supabase anon detrás de `lib/public/`.
- `lib/db/admin.ts` prohíbe por comentario usar `service_role` en Server Components, pero 12 páginas/layouts Portal lo hacen. Los caminos revisados acotan por identidad/tenant/IDs, por lo que se clasifica como contrato arquitectónico frágil, no como exploit confirmado.
- `graphify-out/graph.json` y `.mcp.json` no están versionados en este baseline; el mapa AST anunciado no pudo utilizarse.

### Riesgos técnicos confirmados hasta este punto

- **ALTO — separación de funciones:** RBAC server-side restringe dinero/administración, pero tablas como facturas, mailing y conciliación conceden CRUD a `authenticated`; sus políticas RLS sólo aíslan tenant. Un usuario autenticado del tenant puede omitir la UI/API y hablar directamente con PostgREST. Estado aplicado en Cloud: **DESCONOCIDO**.
- **MEDIO — capability y PII local:** packing-list y colas offline móviles conservan token, fotos, firma, documento, notas/GPS y datos comerciales en `localStorage`; hay caps y borrado tras retry exitoso, pero no TTL, cifrado ni purga de logout demostrados. El impacto depende de XSS, extensiones maliciosas o un dispositivo compartido.
- **ALTO — backups cifrados:** el bucket de backup tiene `Retain`, pero la CMK no; borrar/reemplazar el stack puede retener objetos y programar la eliminación de la clave necesaria para leerlos.
- **ADVISORIES ALTO/MODERADO — supply chain:** la auditoría productiva actual reportó 2 advisories altos, 1 moderado y 1 bajo; el gate no ejecuta auditoría de dependencias y no hay bot de actualización. La explotabilidad y severidad contextual en la aplicación no fueron demostradas.
- **ACCESIBILIDAD:** no hay skip-link global; la PWA bloquea zoom; el `lang` raíz permanece `es` en modo `zh-CN`; se detectaron diálogos, tabs, jerarquías de headings y resultados dinámicos sin contratos accesibles completos.

## Checkpoint 3 — Datos, seguridad e integraciones

- **CONFIRMADO:** las 255 tablas públicas detectadas habilitan RLS; 237 tienen políticas explícitas y 18 quedan deny-by-default sin política.
- **CONFIRMADO:** las migraciones conceden acceso tenant-wide al rol `authenticated` sobre recursos que la aplicación restringe por RBAC; el bypass intra-tenant es comprobable en el modelo versionado. El estado aplicado en Cloud permanece **DESCONOCIDO**.
- **CONFIRMADO:** Supabase aporta Postgres, Auth, Storage, Vault y Edge Functions; Kommo, Resend, Telegram, SeaRates, CNE y el pipeline AWS/R2 son integraciones externas con degradación desigual. De HailuWay sólo quedan health/config legados, sin consumidor funcional hallado.
- **CONFIRMADO:** no se encontraron secretos reales en el árbol ni en los artefactos generados; sólo nombres de configuración, fixtures y patrones de saneamiento.
- **DESCONOCIDO:** proyecto/plan alojado, políticas realmente aplicadas, credenciales vigentes, owners, jobs externos y disponibilidad de proveedores.

## Checkpoint 4 — Infraestructura, calidad y gate

- **CONFIRMADO:** no hay CI versionada; el gate de 15 pasos es responsabilidad local y Vercel puede omitir un build según el último commit.
- **CONFIRMADO:** `pnpm install --frozen-lockfile` terminó correctamente sin modificar manifiestos ni lockfile.
- **CONFIRMADO:** `node scripts/verify.mjs` ejecutó 14/15 pasos: lint, fronteras, tipos, Deno, 5.833 tests Vitest, documentación, numeración, constantes, componentes, gobernanza, 138 contratos SQL, rebuild, E2E y build. `migrations-applied` quedó en `SKIP` por falta de credenciales.
- **CONFIRMADO:** el build terminó correctamente. E2E cerró 135 passed, 18 skipped y 15 failed; los fallos son cinco contratos de login/redirección repetidos en tres navegadores por ausencia de URL/anon key Supabase, no una regresión funcional demostrada.
- **CONFIRMADO:** la auditoría de calidad detectó huecos WCAG, falta de observabilidad central, cobertura asíncrona limitada y ausencia de budgets; SEO, headers, reduced motion y foco visible aportan controles positivos.

## Checkpoint 5 — Consolidación y segunda pasada

- **CONFIRMADO:** se reconciliaron topología, flujos, datos, seguridad, configuración, infraestructura y calidad contra evidencia directa del baseline.
- **CONFIRMADO:** se generaron `final-report.md` y su versión HTML con las 28 secciones exigidas, diagramas, quick start, unknowns y preguntas sólo externas para el equipo anterior.
- **CONFIRMADO:** la secuencia top-level es exactamente 1–28, los 34 fences están balanceados, hay 8 diagramas Mermaid, 25 preguntas y matriz ENV 107/107 sin duplicados/faltantes.
- **CONFIRMADO:** las 78 rutas citadas con línea existen y sus rangos están dentro de archivo; el scan de secretos sobre los artefactos no encontró PAT/JWT/API keys/private keys.
- **CONFIRMADO:** ambos HTML fueron parseados, tienen IDs únicos y paridad en los marcadores críticos; la bitácora HTML contiene 20 checks marcados y el informe HTML contiene score 70, 8 fuentes Mermaid y las 20 integraciones.
- **CONFIRMADO:** un `fetch` final dejó `HEAD == origin/main == 1610d667` (0/0). `git status` sólo muestra los cuatro archivos de `project-knowledge/`; el checkout principal conserva sus 4/1 commits y dos archivos modificados originales.
- **CONFIRMADO:** el checkout principal y los worktrees ajenos permanecieron intactos; los únicos cambios persistentes están bajo `project-knowledge/`.
- **VEREDICTO:** **🟡 Operable con riesgos**. Hay conocimiento suficiente para desarrollo local disciplinado, pero no para asumir operación productiva autónoma sin resolver evidencia alojada, ownership y los riesgos altos confirmados.
