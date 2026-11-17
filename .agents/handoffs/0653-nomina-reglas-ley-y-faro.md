# Handoff — SDD-0653 · Reglas de nómina al día con la ley y estante de ley pública para Faro

- Rama: `claude/0653-nomina-ley-faro-0b4370` · PR #631 (borrador) · Worker 0653 · 2026-11-17
- Spec: `docs/specs/0653-nomina-reglas-ley-y-faro/spec.md` (`proposed`).
- Migración reservada por el DG: **0556** (no creada; es de la fase A2b).

## Instrucción de Sam que amplió el encargo (2026-11-16)

Implementar en las reglas; lo no verificado se implementa con una nota simple («no está verificado, consultar con
un abogado»); la versión muestra su fecha de actualización; lo no verificado lleva un asterisco con algo llamativo
al tocarlo; y volver a comprobar las dudas contra las Gacetas.

## Hecho

- Spec: tabla regla / sistema / ley / fuente, diseño del estante «Ley» de Faro, fases, migración propuesta,
  allowlist y D1-D10.
- Fase A2a, sin migración ni cambio de cálculo:
  - `lib/studio/nomina/ley/parametros.ts`: 21 normas con valor, fuente, vigencia, grado y dónde se comprobó.
  - `app/studio/(app)/nomina/_components/ReglasTab.tsx`: pestaña Reglas nueva (sale de `NominaClient.tsx`).
  - `ReglasDrawer.tsx`: pista «según la ley» bajo cada grupo del formulario.
- Comprobación contra las Gacetas oficiales (spec §2.2): salario mínimo, Ley de Pensiones, Decreto 4.952 y LOTTT
  leídos en el texto de la Gaceta; IVSS en su página oficial; RPE en reproducción.

## Evidencia

| Comprobación | Resultado |
|---|---|
| Pruebas del módulo (`app/studio/(app)/nomina`, `lib/studio/nomina/ley`, `payroll-rules-types`) | PASÓ |
| Contratos del Studio (`app/studio/_components/__tests__`, `app/studio/(app)/__tests__`) | PASÓ (355 pruebas, antes del ajuste de `/ui-check`; avisos y claridad se repitieron después: PASÓ) |
| `tsc --noEmit` | PASÓ |
| ESLint sobre los archivos tocados | PASÓ |
| `docs:check` y `sdd:check` | PASÓ |
| `/ui-check` | Hecho; cuatro ajustes aplicados (`Aviso`, iconos del sistema, área táctil de 32 px, valores sin partirse) |
| Revisión visual | Capturas con Chrome sin ventana de una vista estática (claro, oscuro y ficha abierta). No se abrió dentro del Studio con sesión real |
| `pnpm verify` completo | NO EJECUTADO: el worktree no tiene `node_modules`; se usaron los binarios del checkout principal, archivo por archivo. Lo cubre el CI de la PR |

No se leyó producción. No hay PII ni montos de empleados en el diff.

## Pendiente de esta tarea

- Respuestas de Sam a D1-D10.
- A2b (migración 0556: vigencia, moneda de los montos, aportes patronales, escalas), A3 (tope del motor), A4 (carga
  en producción con OK nominal), B1 y B2 (Faro; B2 depende del motor de la SDD-0637).
- Probar la pestaña dentro del Studio con sesión real (prueba o local con Supabase).
- Novedad y guía de Faro para la pestaña Reglas (D-10 de la 0637): `novedades/` todavía no existe en `main` y
  `nomina` no tiene guía; queda para cuando exista ese estante.
- Confirmar con el contador o un abogado: FAOV (base y tasas en fuente oficial) y si el bono y el cestaticket
  obligan al sector privado.

## FUERA DE ALCANCE DETECTADO

- `lib/studio/nomina/payroll-run-types.ts:327-339`: el tope de SSO/RPE mezcla Bs (`min_salary`) con USD (sueldo del
  período) y compara un tope mensual con períodos quincenales o semanales. Es la D6 / fase A3.
- La siembra demo de `0162:121` rotula en Bs montos que parecen dólares (cestaticket 40, bono 90).
- El sitio de la Imprenta Nacional no publica 68 Gacetas Extraordinarias de 2026 y su búsqueda por texto no
  funciona; cualquier vigilancia automática de Gacetas tiene que recorrer sumarios.

## Impacto documental

- Al implementar A2b: actualizar la §8 de la spec 0103 si cambian columnas.
