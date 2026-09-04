# Productores internos de avisos · SDD-0429 · evidencia local

Fecha: 2026-09-04

Alcance: productores de avisos de Bitácora y solicitudes de cambio

Fuera de alcance: contenido, canales o entregas reales, permisos, RLS,
migraciones, Cloud, push, `main`, despliegues y limpieza

## Resultado

Los dos productores usan ahora el logger canónico con operación, etapa y error
saneado. Se retiraron cuatro `console.*` libres y el mismo correlador se propaga
por las primitivas in-app, push, Telegram y por los drains que ya lo aceptaban.
Tareas, diferencias de datos, mensajes, rutas e identificadores no se agregaron
a los eventos.

## Evidencia ejecutada

- RED: 5/5 fallos confirmaron cuatro logs libres y ausencia de propagación.
- GREEN focal: 44/44 pruebas en cuatro archivos.
- Suite completa: 7.431/7.431 pruebas en 595 archivos.
- TypeScript y ESLint: correctos.
- Gobernanza: 28 políticas aprobadas y cápsula vigente.
- Componentes: cinco fuentes, agregado reproducible y cero rutas rotas.
- Build de producción: compilación y generación correctas, 158 rutas.

El build mostró los avisos esperados por ausencia de variables públicas de
Supabase en este entorno local y terminó con código 0. Las pruebas usaron dobles;
no se enviaron avisos ni se consultaron o modificaron datos reales.

## Estado

- SDD-0429: **done local**.
- Logs retirados en este slice: **4**.
- Checklist general: **59/106 (55,7 %)**; la casilla agregada permanece abierta
  por módulos legacy fuera del Portal.
- Migraciones: ninguna nueva; 0401–0444 siguen preparadas y no aplicadas.
- Publicación/producción: **NO VERIFICABLE**; no hubo push ni despliegue.
