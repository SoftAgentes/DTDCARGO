# Rutas móviles estructuradas · SDD-0431 · evidencia local

Fecha: 2026-09-04

Alcance: subscribe, unsubscribe y resubscribe de Web Push móvil, más ping GPS TMS

Fuera de alcance: suscripciones, ubicaciones o sesiones reales, permisos, RLS,
migraciones, Cloud, push, `main`, despliegues y limpieza

## Resultado

Las cuatro rutas crean ahora el logger desde la petición y devuelven el mismo
`x-request-id` en todas sus respuestas. Se retiraron cinco `console.*` libres;
los nuevos eventos no incluyen endpoints de Push, coordenadas, tenant, operario,
usuario, driver o camión. Auth, validación, persistencia, rate limit y cuerpos de
respuesta permanecen iguales, salvo “pedile” por “pídele” en el error del ping.

## Evidencia ejecutada

- RED: 13/13 fallos confirmaron logs, falta de correlación y voseo.
- GREEN focal: 13/13 pruebas en un archivo.
- Suite completa: 7.459/7.459 pruebas en 597 archivos.
- TypeScript y ESLint: correctos.
- Gobernanza: 28 políticas aprobadas y cápsula vigente.
- Componentes: cinco fuentes, agregado reproducible y cero rutas rotas.
- Build de producción: compilación y generación correctas, 158 rutas.

El build mostró los avisos esperados por ausencia de variables públicas de
Supabase en este entorno local y terminó con código 0. Las pruebas no crearon
suscripciones ni ubicaciones y no consultaron o modificaron datos reales.

## Estado

- SDD-0431: **done local**.
- Logs retirados en este slice: **5**.
- Checklist general: **59/106 (55,7 %)**; la casilla agregada permanece abierta
  por módulos legacy fuera de los alcances cerrados.
- Migraciones: ninguna nueva; 0401–0444 siguen preparadas y no aplicadas.
- Publicación/producción: **NO VERIFICABLE**; no hubo push ni despliegue.
