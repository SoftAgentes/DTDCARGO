# Salud e integraciones estructuradas · SDD-0417 · evidencia local

Fecha: 2026-09-04

Alcance: `alta-health`, `mail-health`, `kommo-contact-status`, `ceo-brief`,
`rate-expiry-alert` y `searates-refresh`

Fuera de alcance: logs internos legacy, Edge Functions, ejecución alojada,
proveedores, Cloud, push, `main`, despliegue, datos y limpieza

## Resultado

Los 17/17 handlers cron del repositorio tienen ahora correlación. Este último
slice reemplazó los logs con objetos de negocio de los seis monitores por
eventos JSON con métricas agregadas:

- Alta y correo: tenants, casos revisados/encontrados y avisos intentados.
- Kommo: vinculados, encolados, con saldo/tránsito, inertes y truncados.
- CEO y tarifas: resultados enviados o fallidos, sin destinatarios ni previews.
- SeaRates: rutas solicitadas, consultadas, con tarifa/sin tarifa/fallidas,
  salud y número de tenants notificados.

Todas las respuestas llevan `x-request-id`. Los fallos de lectura usan
`cron.read_failed`; una excepción del refresco de SeaRates usa
`cron.refresh_failed`; las demás excepciones quedan contenidas como
`cron.run_failed`, siempre con respuesta genérica.

## Evidencia ejecutada

- RED: 18/18 pruebas fallaron antes del cambio.
- GREEN directo: 22/22 entre las seis rutas y el logger.
- Suite completa: 7.358/7.358 pruebas en 582 archivos.
- TypeScript y ESLint: correctos.
- Build de producción: 158 rutas, compilación y generación correctas.
- Fallos sintéticos incluyeron Bearer, correo, tenant/ruta y mensaje crudo;
  ninguno apareció en logs o respuestas.
- El nombre `emailSent` activó correctamente la redacción por defecto; la métrica
  se renombró a `mailSent` en vez de debilitar la política.

## Límites y seguridad operativa

Todas las dependencias de Supabase, IA, correo, Telegram, Kommo y SeaRates se
reemplazaron por dobles; no se realizó ninguna llamada ni escritura externa.
Los modos dry-run y los gates existentes no se modificaron.

El inventario posterior confirma 17/17 rutas adoptadas y cero `console.*` en
`app/api/cron/**/route.ts`. Esto no cierra todavía la casilla global: quedan
logs internos legacy y cuatro Edge Functions de Kommo.

## Estado

- SDD-0417: **done local**.
- Cron HTTP adoptados: **17/17**.
- Checklist general: **59/106 (55,7 %)**; la casilla agregada sigue abierta.
- Migraciones: ninguna nueva; 0401–0444 siguen preparadas y no aplicadas.
- Publicación/producción: **NO VERIFICABLE**; no hubo push ni despliegue.
