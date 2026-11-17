# Handoff — SDD-0653 · Reglas de nómina al día con la ley y estante de ley pública para Faro

- Rama: `claude/0653-nomina-ley-faro-0b4370` · PR #631 · Worker 0653 · 2026-11-17
- Spec: `docs/specs/0653-nomina-reglas-ley-y-faro/spec.md` (`in-progress`).
- Migración reservada por el DG: **0556** (no creada; es de la fase A2b).

## Instrucción de Sam que amplió el encargo (2026-11-16)

Implementar en las reglas; lo no verificado se implementa con una nota simple («no está verificado, consultar con
un abogado»); la versión muestra su fecha de actualización; lo no verificado lleva un asterisco con algo llamativo
al tocarlo; y volver a comprobar las dudas contra las Gacetas.

## Decisiones aprobadas (2026-11-17)

Sam aprobó las decisiones recomendadas. Literal, en el chat del Director General, a «¿Apruebas las decisiones
recomendadas de nómina (#631) y de la Vista simple (#633)?»: «Sí, ambas». Lo transmitió el DG; esta sesión no lo
presenció. Quedan decididas D1, D2, D3a, D3b y D4 a D10 con la opción (a). No autoriza producción ni arranca fases.

## Hecho

- Spec: tabla regla / sistema / ley / fuente, diseño del estante «Ley» de Faro, fases, migración propuesta,
  allowlist, decisiones (D1 a D10, con D3 partida en D3a y D3b) y clasificación de gobernanza (§7 bis).
- Fase A2a, sin migración ni cambio de cálculo:
  - `lib/studio/nomina/ley/parametros.ts`: 21 normas con valor, fuente, vigencia, grado, alcance y dónde se
    comprobó.
  - `ReglasTab.tsx`: pestaña Reglas nueva (sale de `NominaClient.tsx`).
  - `PistaLey.tsx`: pista «según la ley» bajo cada grupo del formulario (`ReglasDrawer.tsx`).
- Comprobación contra las Gacetas oficiales (spec §2.2).

## Revisión independiente del DG sobre e5ad95c72 (CHANGES REQUESTED) y qué se hizo

| Hallazgo | Corrección |
|---|---|
| Cestaticket de USD 40 atribuido a la G.O. 6.746 | Fuente «Anuncio del Ejecutivo», Gaceta nula, vigencia nula; la 6.746 queda en el detalle como último monto conocido |
| IMI sin aclarar el alcance | El texto dice que el aumento es del sector público y que al privado se le exhortó |
| INCES, RPE, IVSS marcados verificados sin Gaceta leída | Pasan a «por confirmar». «Verificado» ahora exige Gaceta con número y fecha, fecha de vigencia y lectura en la Gaceta; quedan 8 verificados y 13 con asterisco |
| Vigencias nulas sin marcar | La ficha dice «Vigencia: por confirmar» y una prueba impide que algo sin vigencia sea verificado |
| Spec con dos grados y V laxo | Leyenda V, A, O, R, N alineada con los tres grados del código |
| Pruebas débiles | Pruebas de qué significa cada grado, de obligaciones frente a referencias, de `PistaLey` y de movimiento |
| MOT-01 | Solo `--dur-fast`, `--dur`, `--dur-slow` y `--ease`; se quitó el pulso infinito |
| `<span aria-label>` sin rol | Asterisco oculto al lector y texto con `studio-sr-only` |
| Faro §3.3 | Prohibidos OpenRouter y cualquier agregador; la regla se cita como SDD-0639 D-2; la prueba de B1 permite solo `import type` |
| D3 y D1 | D3a (cestaticket: obliga, falta la Gaceta del monto) y D3b (bono e IMI: referencia); D1 dice que esta PR ya implementa (a) |
| Barra «Al día con la ley» | Ahora «Obligaciones al día»: no cuenta anuncios ni lo que no obliga a DTD; esas filas llevan la pastilla «Referencia» y tienen su filtro |

## Evidencia

Se llena al cerrar esta ronda (ver la descripción de la PR): pruebas del módulo, contratos del Studio, typecheck,
ESLint, `docs:check`, `sdd:check`, `governance:check` y `components:check`.

- `pnpm verify` completo: NO EJECUTADO en local (el worktree no tiene `node_modules`); lo cubre el CI de la PR.
- Pantalla dentro del Studio con sesión real: NO EJECUTADO; se revisó con capturas de una vista estática.
- No se leyó producción. No hay PII ni montos de empleados en el diff.

## Pendiente de esta tarea

- Asignación del DG para las fases siguientes; ninguna empieza sin ella.
- A2b (migración 0556: vigencia, moneda de los montos, aportes patronales, escalas), A3 (tope del motor), A4 (carga
  en producción con OK nominal), B1 y B2 (Faro; B2 depende del motor de la SDD-0637).
- Probar la pestaña dentro del Studio con sesión real (prueba o local con Supabase).
- Novedad y guía de Faro para la pestaña Reglas (D-10 de la 0637): `novedades/` todavía no existe en `main` y
  `nomina` no tiene guía; queda para cuando exista ese estante.
- Confirmar con el contador o un abogado lo marcado «por confirmar» o «solo anuncio»: IVSS, RPE, FAOV, INCES, el
  monto del cestaticket y si el bono obliga al sector privado.

## FUERA DE ALCANCE DETECTADO

- `lib/studio/nomina/payroll-run-types.ts:327-339`: el tope de SSO/RPE mezcla Bs (`min_salary`) con USD (sueldo del
  período) y compara un tope mensual con períodos quincenales o semanales. Es la D6 / fase A3.
- La siembra demo de `0162:121` rotula en Bs montos que parecen dólares (cestaticket 40, bono 90).
- El sitio de la Imprenta Nacional no publica 68 Gacetas Extraordinarias de 2026 y su búsqueda por texto no
  funciona; cualquier vigilancia automática de Gacetas tiene que recorrer sumarios.

## Impacto documental

- Al implementar A2b: actualizar la §8 de la spec 0103 si cambian columnas.
