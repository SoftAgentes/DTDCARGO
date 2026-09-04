# Jobs programados estructurados · SDD-0416 · evidencia local

Fecha: 2026-09-04

Alcance: `bitacora-digest`, `conversation-digests`, `mail-scheduled` y
`portal-cold-reminder`

Fuera de alcance: seis cron de salud/integraciones, Edge Functions, ejecución de
jobs, proveedores externos, Cloud, push, `main`, despliegue, datos y limpieza

## Resultado

Los cuatro jobs reutilizan ahora el contexto común del cron y devuelven
`x-request-id` en rechazo, éxito y fallo. Los logs de terminación contienen sólo
agregados:

- Bitácora: tenants, personas, push, omitidos y tenants con error.
- Conversaciones: tenants, conversaciones procesadas, generadas y omitidas.
- Correo programado: procesados, enviados y fallidos.
- Recordatorio frío: procesados, enviados, fallidos, omitidos y buzones quemados.

Un fallo al abrir la cola o listar tenants produce `cron.read_failed`, respuesta
500 genérica y el mismo ID de correlación. El gate
`PORTAL_COLD_REMINDER !== on` continúa saliendo sin tocar la base y queda
observable como modo `disabled`.

## Evidencia ejecutada

- RED: 12/12 pruebas fallaron antes del cambio por ausencia de header/eventos.
- GREEN directo: 16/16 entre las cuatro rutas y el logger.
- Suite completa: 7.340/7.340 pruebas en 581 archivos.
- TypeScript y ESLint: correctos.
- Build de producción: 158 rutas, compilación y generación correctas.
- Fallos de lectura sintéticos incluyeron Bearer, correo, tenant/ruta y mensaje
  crudo; ninguno apareció en logs o respuestas.

## Límites y seguridad operativa

Las consultas devolvieron tenants y colas sintéticas o vacías, y las funciones
de digest/correo fueron dobles locales. No se llamó Supabase, IA, Resend,
Telegram ni Web Push; tampoco se activó el gate alojado del recordatorio.

Los módulos internos llamados por estos jobs conservan sus propios logs legacy.
La casilla general no se cerrará hasta migrar también esos bordes y las Edge
Functions; esta acta sólo certifica los cuatro handlers HTTP.

## Estado

- SDD-0416: **done local**.
- Cron adoptados acumulados: 11/17; quedan 6 y luego las Edge Functions.
- Checklist general: **59/106 (55,7 %)**; la casilla agregada sigue abierta.
- Migraciones: ninguna nueva; 0401–0444 siguen preparadas y no aplicadas.
- Publicación/producción: **NO VERIFICABLE**; no hubo push ni despliegue.
