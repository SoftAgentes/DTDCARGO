# Edge Functions Kommo estructuradas · SDD-0418 · evidencia local

Fecha: 2026-09-04

Alcance: `kommo-sync`, `kommo-webhook`, `kommo-writeback` y
`kommo-push-client`

Fuera de alcance: despliegue de funciones, Kommo/Supabase alojados, datos
reales, Cloud, migraciones, push, `main`, despliegue web y limpieza

## Resultado

Las 4/4 Edge Functions de Kommo crean un contexto por solicitud y devuelven
`x-request-id`. El helper Edge emite una línea JSON estable por evento y sólo
admite métricas operativas allowlisted.

Se retiraron doce logs libres. En particular, el dry-run de write-back dejó de
imprimir la ruta y el payload completos; push-client ya no registra IDs ni la
forma de los campos del cliente; webhook conserva sólo conteos agregados; y las
lecturas truncadas del sync quedan correlacionadas sin identidad.

Los errores de base de datos, Vault y proveedores se resumen a nombre/código en
el log estructurado. El texto detallado que ya se guardaba en `sync_logs` o
`last_error` permanece privado para operación, mientras la respuesta externa
usa un mensaje genérico. En el `207` del sync también se omite el texto crudo y
se conserva la entidad fallida.

## Evidencia ejecutada

- RED: el helper faltaba y 8 contratos fuente fallaron; una novena comprobación
  ya era verde porque el entrypoint de sync no tenía `console.*` libre.
- GREEN directo: 38/38 entre logger, contrato fuente y handler real de webhook.
- Suite completa: 7.371/7.371 pruebas en 584 archivos.
- Edge Functions: 4/4 entradas aprobadas por `deno check`.
- TypeScript, ESLint, documentación, gobernanza y componentes: correctos.
- Build de producción: compilación y generación correctas, 158 rutas.
- Inventario posterior: cero `console.*` en los cuatro entrypoints y
  `kommo-sync/sync.ts`; las únicas emisiones del slice viven en el helper y
  pasan por redacción.

## Incidencia de regresión cerrada

La primera suite completa descubrió que el arnés del webhook no conocía el
nuevo módulo. Sus 25 contratos fallaron antes de ejecutar el handler. Se añadió
un doble I/O explícito del logger y una aserción del header de correlación; los
25 contratos volvieron a verde sin relajar estados, carreras ni efectos.

## Límites y seguridad operativa

No se invocó ninguna Edge Function, no se consultó Kommo/Supabase, no se
leyeron filas reales y no se habilitó ningún gate de escritura. Todo el trabajo
fue código y pruebas locales.

## Estado

- SDD-0418: **done local**.
- Edge Functions adoptadas: **4/4**.
- Rutas cron adoptadas acumuladas: **17/17**.
- Checklist general: **59/106 (55,7 %)**; la casilla agregada sigue abierta por
  logs internos legacy fuera de estos bordes.
- Migraciones: ninguna nueva; 0401–0444 siguen preparadas y no aplicadas.
- Publicación/producción: **NO VERIFICABLE**; no hubo push ni despliegue.
