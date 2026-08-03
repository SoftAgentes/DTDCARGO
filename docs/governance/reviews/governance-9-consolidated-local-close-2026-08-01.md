# REV-SGE-052 — Cierre local consolidado de Gobernanza 9

| Control | Valor |
|---|---|
| Fecha | 2026-08-01 |
| Base normativa | `origin/main@67250c35de8e967562f7cfd90a578204b6173f53` |
| Carril | `codex/governance-9-checklist-audit` |
| Worktree | `DTD-worktrees/governance-9-checklist-audit` |
| Alcance | Gobernanza 9, SDD-0226, SDD-0235, PLG-01, E5 y cobertura v2 |
| Mutación externa | ninguna |
| Resultado | paquete local consolidado; publicación y gates productivos separados |

## 1. Resultado consolidado

- PLG-01 quedó sincronizado con 27 políticas, cuatro componentes y
  `readOnly=true`; la caché instalada no se editó manualmente.
- LB-SGE-105 y REV-SGE-050 fijan el universo correcto de 57 módulos: 30 `VA`,
  19 `BE` y ocho `NA+BE`. `VA` acredita sólo un flujo acotado, no el módulo.
- SDD-0226 quedó reconciliado con su gate histórico
  `0316_nomina_settlement_void_governance`; Nómina conserva `BE` hasta obtener
  evidencia productiva y runtime.
- SDD-0235 quedó consolidado con una sola implementación canónica. Se adoptó
  la cobertura conductual del carril `codex/sdd-0235-continuity` y se preservó
  la prueba adicional de autorización VE del presente carril.
- E5 se revalidó metadata-only: cero tenants y cero eventos elegibles en ambas
  clases; por diseño no se creó un lote vacío ni se abrió el segundo actor.
- La evidencia CBM de Mobile Safari para SDD-0061 quedó registrada sin cambiar
  producto.

## 2. Estado de 0325–0329

| Migración | Objeto o cambio | Consumidor principal | Sin la migración |
|---|---|---|---|
| `0325_operario_pin_login_hardening` | tabla/índice `operario_pin_attempts` y nueva firma server-only de `verify_operario_pin` | `lib/auth/operario-session.ts` | la firma nueva no existe y el login falla cerrado; consta aplicada en Producción |
| `0326_public_tracking_privacy_throttle` | reemplaza `public_track_shipment(text,text)`, hashea origen, limita intentos y minimiza POD/notas | `lib/public/tracking-queries.ts` | la firma histórica sigue respondiendo; no rompe la pantalla, pero conserva la brecha de privacidad y throttle |
| `0327_internal_function_grants` | revoca `EXECUTE` público de tres funciones internas de trigger | triggers de almacén CN y estiba, sin llamada directa de aplicación | los triggers siguen operando; permanece exposición ejecutable innecesaria |
| `0328_camionero_dispatch_assignment` | endurece `camionero_advance_od` contra tenant, rol, región y `driver_id` asignado | `app/m/ve/camionero/actions.ts` | la firma histórica sigue respondiendo; la UI no cae, pero un camionero conserva alcance excesivo |
| `0329_user_profiles_tenant_scope` | reemplaza la policy SELECT global por perfil propio o tenant activo compartido | consultas de Studio, Portal y móvil sobre `user_profiles` | las lecturas siguen funcionando; persiste visibilidad transversal indebida |

El verificador contra el ledger productivo confirmó como ausentes únicamente
`0316` y `0326`–`0329`. No se agregó ninguna a excepciones del cutoff y no se
aplicó ninguna. Cada basename conserva un gate productivo nominal individual.

## 3. Evidencia local fresca

| Gate | Resultado |
|---|---|
| Vitest consolidado | 383 archivos; 4.543/4.543 pruebas verdes |
| ESLint | verde |
| TypeScript | verde |
| Build Next.js | verde; 155 páginas estáticas |
| Contratos SQL | 65/65; rollback total |
| Schema rebuild | 327 migraciones; 310 aplicadas y 17 sólo-ledger |
| Aislamiento schema | 219 tablas; dos tenants de fixture |
| E2E no Tier-3 | 72 casos verdes |
| E2E Tier-3 | 12 omitidos: falta branch efímera, seed y credenciales |
| Gobernanza | 27 políticas; verde |
| Componentes | cuatro componentes; verde |
| PLG-01 | check verde; 7/7 pruebas; `readOnly=true` |
| Docs y whitespace | verdes |

La corrida E2E completa enumeró 72 casos exitosos y 12 omisiones Tier-3 al usar
sólo URL y anon key públicas. Playwright no terminó el teardown automático del
servidor preconstruido y fue necesario detener exclusivamente los procesos que
esa corrida había creado; no hubo casos fallidos. El otro carril reprodujo la
misma cobertura no Tier-3 sobre servidor estable: 72 verdes y nueve omisiones
antes de incorporar Nómina.

## 4. Allowlist reconciliada

El diff contra la base contiene 50 archivos antes de este recibo y se divide en
seis grupos explícitos:

1. PLG-01: registry distribuido y `docs/governance/README.md`.
2. Cobertura: LB-SGE-105, REV-SGE-050 y mapa módulo↔SDD.
3. SDD-0226: spec/recibos, acción y UI de Nómina, pruebas unitarias, E2E,
   migración 0316 y su contrato SQL.
4. SDD-0235: spec/runbook/evaluación, `.env.example`, auth/RBAC, Portal,
   rutas Studio, JSON-LD, rrweb, gate de adjuntos, migraciones 0326–0329 y sus
   contratos SQL.
5. SDD-0061: spec, allowlist y evidencia CBM documental.
6. E5: REV-AUD-052 metadata-only.

No hay cambios de producto ajenos a SDD-0226/0235, correlativos nuevos,
limpieza de worktrees, push, integración a `main`, deploy ni mutaciones Cloud.

## 5. Límites que permanecen

- Las 19 filas `BE` y ocho `NA+BE` son adopción futura por slices y no un
  defecto transversal que autorice un barrido.
- E5 está operativo y fail-closed; no tiene eventos elegibles que ejecutar.
- Tier-3 necesita una branch Supabase efímera con costo confirmado, seed
  controlado y credenciales de prueba; no puede resolverse simulando Producción.
- Adjuntos continúa apagado hasta contratar/configurar proveedor externo,
  antivirus, evidencia de retención inmutable y restore drill byte-idéntico.
- Los worktrees históricos se conservan. Este recibo no autoriza retirarlos.
- Publicar este paquete no aplica migraciones ni demuestra comportamiento
  productivo; esos gates continúan separados y nominales.
