# Cierre local · SDD-0331 · consultas de identidad inseguras

Fecha: 2026-09-02
Rama: `codex/saneamiento-integral`
Base remota medida: `origin/main` en `2a2e81bf554dbe7bd4f05170847e8f02e988d320`

## Resultado

Se retiraron el provider CNE habilitable por entorno, la acción automática y
los enlaces HTTP hacia CNE/SENIAT. El asesor conserva el cotejo visual contra la
foto privada y la marca manual advisory. No se modificaron datos ni Cloud.

## Evidencia

- El provider construía un `GET` con cédula en query params y no exigía HTTPS.
- La tarjeta prellenaba la cédula en un enlace HTTP del CNE y exponía un enlace
  HTTP de SENIAT para empresas.
- No se pudo comprobar desde este entorno un endpoint HTTPS oficial operativo;
  el intento de resolución del host oficial falló y no se asumió equivalencia.
- El inventario del proyecto no acredita proveedor, contrato ni retención para
  esa transferencia.

## Cambios

- Eliminados motor, providers, alerta automática, configuración y tests del
  camino externo.
- Retirados botón automático, enlaces oficiales y prellenado de documento.
- Conservados foto privada, datos históricos y `markIdentityAction` con RBAC y
  filtro de tenant.
- Añadido contrato de privacidad y actualizada la documentación viva.
- Añadida SDD-0331; SDD-0046 conserva su historia y señala la sustitución.

## Verificación local

- Contratos focales: 2 archivos / 5 tests, todos verdes.
- TypeScript y ESLint focal: verdes.
- `docs:check`: verde; índice regenerado en 323 specs.
- `governance:check`: verde; 28 políticas aprobadas y cápsula vigente.
- `components:check`: verde; 5 fuentes y cero rutas rotas.
- `git diff --check`: verde.
- Revisión visual liviana: no se agregaron tokens ni componentes; se redujo la
  tarjeta al `ActionButton` canónico, con estados ocupado/éxito/error y el
  veredicto negativo separado.
- Gate canónico: 14 de 15 pasos ejecutados sin fallos. Lint, RSC, TypeScript, 4
  Edge Functions, 509 archivos/5.890 tests unitarios, documentación,
  numeración, constantes, componentes, gobernanza, 141 contratos SQL,
  reconstrucción de 379 migraciones ejecutables y aislamiento de 219 tablas
  quedaron verdes.
- E2E: 150 casos ejecutables pasaron y 18 Tier 3 se omitieron por diseño. WebKit
  agotó 480 s al cerrar workers en Windows; el harness lo clasificó como aviso,
  no como fallo de tests.
- Build de producción: verde, 158 páginas estáticas.
- `migrations-applied`: omitido por falta de credenciales; Cloud no fue medido.

## Gates externos

- Ninguno para el corte de código.
- Publicación/despliegue siguen sujetos a sus gates independientes.
- Borrado de datos o solicitudes históricas no se ejecutó y sigue no
  verificable.
