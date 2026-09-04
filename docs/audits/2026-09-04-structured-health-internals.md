# Internals de salud estructurados · SDD-0419 · evidencia local

Fecha: 2026-09-04

Alcance: altas sin acceso, ruteo Telegram, salud de correo, salud SeaRates y
generación/envío del brief ejecutivo

Fuera de alcance: workers drain, otros módulos legacy, proveedores/Cloud,
datos reales, migraciones, push, `main`, despliegue y limpieza

## Resultado

Los cuatro crons de salud propagan ahora el mismo logger correlacionado hacia
sus dependencias. Si una lectura, el LLM o un canal best-effort falla, el evento
conserva etapa y conteos operativos sin registrar tenant, destinatario, chat ID,
texto del aviso ni mensaje crudo del proveedor.

Se añadió `createComponentLogger` para los mismos módulos cuando se llaman fuera
de un request. Ese camino genera su propio correlador y usa exactamente la misma
allowlist/redacción que el logger HTTP; no reaparece un `console.*` alterno.

El ruteo Telegram mantiene deduplicación, fallback, envío por chat y semántica
best-effort. La información que sí debe llegar por correo/Telegram no cambió;
solamente cambió la telemetría técnica que se genera cuando algo falla.

## Evidencia ejecutada

- RED: 9 fallos confirmaron la falta del logger interno, cinco módulos con logs
  libres y tres handlers sin propagación; SeaRates ya mencionaba `cron.logger`
  por otro evento, por lo que el contrato se endureció a la llamada exacta.
- GREEN focal: 54/54 pruebas; repetición de contrato/rutas: 45/45.
- Suite completa: 7.381/7.381 pruebas en 585 archivos.
- TypeScript y ESLint: correctos.
- Build de producción: compilación y generación correctas, 158 rutas.
- Inventario del alcance: 0 `console.*` libre en los cinco módulos.
- Inventario general medido: 212 llamadas legacy fuera del logger canónico.

## Límites y seguridad operativa

Todos los envíos y proveedores se sustituyeron por dobles durante las pruebas.
No se mandaron correos ni Telegram, no se consultó Supabase/Anthropic/SeaRates y
no se usaron datos de negocio.

## Estado

- SDD-0419: **done local**.
- Logs internos retirados en este slice: **14**.
- Checklist general: **59/106 (55,7 %)**; la casilla agregada permanece abierta
  por workers y otros módulos internos legacy.
- Migraciones: ninguna nueva; 0401–0444 siguen preparadas y no aplicadas.
- Publicación/producción: **NO VERIFICABLE**; no hubo push ni despliegue.
