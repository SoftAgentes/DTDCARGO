# Cierre técnico · SDD-0336 marca del Portal por principal autenticado

Fecha: 2026-09-02

Rol: worker

Estado: CERRADO LOCALMENTE · MIGRACIÓN NO APLICADA

## Identidad

- Repositorio: `https://github.com/hailuwaycom-sketch/DTDCARGO.git`
- Worktree: `C:\Users\Trabajo\Desktop\Developer\software\DTD-worktrees\codex-saneamiento-integral`
- Rama: `codex/saneamiento-integral`
- Base del slice: `d0ec0e478e3de595123d9bb73144e68555767441`
- Spec: `docs/specs/0336-marca-portal-por-principal/spec.md`
- Migración preparada: `0401_portal_brand_por_principal.sql`

## Resultado

- Se creó `get_portal_brand()` sin parámetros. La identidad se deriva de
  `auth.uid()` y de una fila activa de `client_users`.
- La RPC devuelve sólo los ocho campos públicos que necesita el contexto de
  marca; no expone ids, tenant, acuerdos ni valores internos del aliado.
- `PUBLIC`, `anon` y `service_role` no pueden ejecutarla; únicamente
  `authenticated` tiene `EXECUTE`.
- Etiquetas y comprobantes consumen la RPC con la sesión del Portal. La página
  de comprobante dejó de construir un cliente elevado; etiquetas conserva un
  único uso distinto para firmar el documento de prealerta.
- El inventario congelado bajó de 11 rutas / 23 construcciones a 10 rutas / 21.

## Evidencia ejecutada

- Vitest focal: 2 archivos / 5 pruebas, verde.
- Vitest completo: 512 archivos / 5.902 pruebas, verde.
- Contratos SQL: 142, verde y con rollback total.
- Reconstrucción: 398 migraciones; 380 aplicadas desde cero + 18 sólo-ledger;
  aislamiento de 219 tablas y 2 tenants, verde.
- TypeScript, ESLint focal, `docs:check`, `governance:check`,
  `components:check` y `git diff --check`: verdes.
- Cierre canónico: 14/15 gates ejecutados y ninguno falló; sólo
  `migrations-applied` quedó sin medir por falta deliberada de credenciales.
- E2E: 150 pasaron, 18 Tier 3 se omitieron y cero pruebas fallaron. Un worker de
  WebKit agotó 300 s al cerrar en Windows y fue clasificado como aviso conocido.
- Build de producción: verde, con 158 páginas estáticas generadas.

## Gates externos preservados

- No se aplicó la migración 0401 a Cloud o Producción.
- No se hizo push, integración a `main` ni deploy.
- La página de etiquetas aún usa `service_role` para un flujo diferente de
  firmado; su retiro requiere otro slice y otro contrato.

## Cierre seguro

La migración debe aplicarse de forma individual y únicamente tras una
autorización que nombre `0401_portal_brand_por_principal.sql`, siguiendo
`docs/runbooks/aplicar-migraciones-prod.md`. El worktree no se retira hasta que
el commit esté publicado e integrado/contenido en `origin/main`.
