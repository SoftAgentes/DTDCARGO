# Cierre local · SDD-0330 · retiro de Nominatim

Fecha: 2026-09-02
Rama: `codex/saneamiento-integral`
Base remota medida: `origin/main` en `2a2e81bf554dbe7bd4f05170847e8f02e988d320`

## Resultado

Se retiró el geocodificado automático que enviaba la dirección completa de un
cliente al servicio público de Nominatim. El drawer conserva la captura GPS
explícita del navegador, los campos manuales de latitud/longitud y la acción de
limpieza. No se configuró un proveedor sustituto ni se tocó Cloud o Producción.

## Motivo

- El inventario vivo de privacidad ya clasificaba Nominatim como un tercero sin
  contrato que recibía domicilios.
- La política pública consultada el 2026-09-02 pide no enviar datos personales o
  confidenciales, además de exigir un máximo absoluto de 1 solicitud por segundo
  y caché según el uso.
- Añadir sólo throttle, caché y timeout habría dejado abierta la transferencia
  no aprobada de un dato que puede identificar a una persona.

Fuente: <https://operations.osmfoundation.org/policies/nominatim/>

## Cambios

- Eliminado `lib/studio/geocoding.ts`.
- Eliminada `geocodeClientAddressAction` y su import.
- Retirado el botón «Buscar desde dirección» y su estado asociado.
- Añadido contrato que impide el host público de Nominatim en código ejecutable
  de `app/` y `lib/`, y que confirma que la captura GPS local continúa.
- Actualizado el inventario de terceros, el registro de tratamiento y el mapa de
  borrado para separar el estado actual del histórico externo no verificable.
- Añadida SDD-0330 con allowlist exacta y estado `done`.

## Verificación local

- Contratos focales: 2 archivos, 8 tests, todos verdes.
- TypeScript: verde.
- ESLint focal: verde.
- `docs:check`: verde; índice en 322 specs.
- `governance:check`: verde; 28 políticas aprobadas y cápsula vigente.
- `components:check`: verde; 5 fuentes y cero rutas rotas.
- `git diff --check`: verde.
- Revisión visual liviana: sin tokens, estilos o componentes nuevos; el botón
  restante conserva variante canónica, estado ocupado y copy vigente.
- Gate canónico acumulado: lint, frontera RSC, TypeScript, 4 Edge Functions,
  512 archivos/5.947 tests unitarios, documentación, numeración, constantes,
  componentes, gobernanza, 141 contratos SQL y reconstrucción de 379
  migraciones ejecutables quedaron verdes.
- E2E: los 150 casos ejecutables terminaron verdes y 18 Tier 3 se omitieron por
  diseño; la corrida fue interrumpida manualmente durante el teardown conocido
  de WebKit antes de que Playwright devolviera su código final. Se verificaron y
  limpiaron el puerto 3601, `tsconfig.json` y `.next-verify-e2e`.
- Build de producción aislado: verde, 158 páginas estáticas; `tsconfig.json`
  restaurado por el harness.
- `migrations-applied`: omitido por falta de credenciales; no se midió Cloud.

## Gates externos

- Ninguno requerido para que el código deje de enviar nuevas direcciones: el
  corte se vuelve operativo al publicar/desplegar este commit.
- La retención de solicitudes históricas en infraestructura de Nominatim sigue
  siendo `NO VERIFICABLE` desde el repositorio.
- Un proveedor futuro exige decisión, evaluación de privacidad y SDD separada.
