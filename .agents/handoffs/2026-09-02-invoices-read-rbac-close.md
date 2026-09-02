# Cierre técnico · SDD-0357 · lectura de facturas por principal

Fecha: 2026-09-02

Rol: worker

Estado: CERRADO LOCALMENTE · MIGRACIÓN Y RELEASE ALOJADOS PENDIENTES

## Resultado

- SELECT interno de `invoices`: accounting/admin activos y tenant coincidente.
- Portal: vínculo activo del principal, cliente vivo y tenant igual en vínculo,
  cliente y factura. La coincidencia aislada de Shipping Mark ya no concede acceso.
- La prueba reproduce primero la lectura cruzada histórica con el mismo código
  en dos tenants y después aplica 0414 para demostrar que queda cerrada.
- El contrato integrado aplica 0411, 0412 y 0413 reales y demuestra que los tres
  facades mínimos siguen funcionando para comercial sin SELECT crudo.
- Se conservan permisos financieros de escritura, históricos, ausencia de
  DELETE físico y procesos explícitos con service_role.
- Inventario AST: 18 archivos / 45 llamadas literales directas; congelado, no
  equivalente a una auditoría de flujo de todas las views/RPCs históricas.

## Allowlist

- `supabase/migrations/0414_invoices_read_rbac.sql`
- `supabase/tests/0414_invoices_read_rbac.test.sql`
- `scripts/__tests__/invoice-read-boundary.test.mjs`
- `docs/specs/0357-invoices-read-rbac/spec.md`
- `docs/specs/README.md`
- `docs/audits/2026-09-02-codex-arranque-checklist.md`
- `.agents/handoffs/2026-09-02-invoices-read-rbac-close.md`
- `.agents/handoffs/2026-09-02-saneamiento-integral-close.md`

## Evidencia ejecutada

- Focal de frontera/búsqueda global: 2 archivos / 16 pruebas.
- Verificador canónico: 14/15 pasos medidos, sin fallos; `migrations-applied`
  quedó SKIP por falta de credenciales. No es un cierre alojado completo.
- ESLint, frontera RSC (1.589 módulos), TypeScript y 4 Edge Functions: OK.
- Vitest: 527 archivos / 5.957 pruebas, todos verdes.
- Docs, numeración (349 specs / 411 migraciones), constantes, componentes y
  gobernanza: OK.
- SQL: 155 contratos con rollback total.
- Rebuild: 411 migraciones; 393 desde cero + 18 sólo-ledger; control estructural
  de 219 tablas y prueba dinámica con 2 tenants sintéticos.
- E2E: 150 pasaron, 18 Tier 3 omitidos, sin fallos ni bloqueo de teardown.
- Build: 158 páginas generadas; compilación y postbuild correctos.
- Next restauró `tsconfig.json`; las salidas aisladas del gate fueron retiradas.
- El arranque E2E sufrió timeouts de Google Fonts; el proveedor respondió 200
  en la comprobación directa y la corrida completó sin cambiar fuentes o tests.

## Gates no cruzados y continuidad

- No hubo push, merge, deploy, migración alojada ni lectura de PII real.
- 0414 requiere RPCs 0411–0413 aplicadas y app consumidora desplegada/verificada;
  el preflight SQL no certifica la versión del frontend.
- Antes del release debe resolverse la combinación alta/restricción de 0410.
- Revisar las otras policies Portal sin tenant por dominio, sin extrapolar el
  resultado de facturas ni ejecutar un barrido masivo.
