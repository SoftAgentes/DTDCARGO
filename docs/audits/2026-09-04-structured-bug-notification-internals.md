# Notificaciones de bugs estructuradas · SDD-0421 · evidencia local

Fecha: 2026-09-04

Alcance: notificador multicanal de bugs, outbox de reintentos email/Telegram y
la ruta cron que lo drena

Fuera de alcance: escritor in-app, otros productores/módulos legacy, envíos o
filas reales, Cloud, migraciones, push, `main`, despliegues y limpieza

## Resultado

El cron de bugs propaga ahora su logger correlacionado al outbox completo. Las
escrituras de éxito/fallo, reintentos de email y reintentos de Telegram quedan
bajo el mismo identificador de ejecución.

Los tres eventos del notificador —creación crítica, cambio de estado y nueva
respuesta— usan el logger canónico para preferencias, destinatarios, correo,
push y Telegram. Las llamadas fuera del cron crean un correlador local con la
misma allowlist de redacción.

Se retiraron doce `console.*` libres. La telemetría conserva sólo evento, etapa,
operación y conteos; no incluye folio, título, mensaje, destinatario, chat,
payload, URL ni texto crudo devuelto por proveedores.

## Evidencia ejecutada

- RED: 3/3 fallos confirmaron los dos módulos con logs libres y la ruta sin
  propagación del correlador.
- GREEN focal: 39/39 pruebas en cuatro archivos.
- Suite completa: 7.392/7.392 pruebas en 587 archivos.
- TypeScript y ESLint: correctos.
- Gobernanza: 28 políticas aprobadas y cápsula vigente.
- Componentes: cinco fuentes, agregado reproducible y cero rutas rotas.
- Build de producción: compilación y generación correctas, 158 rutas.
- Inventario del alcance: cero `console.*` libre en los dos módulos.

El build mostró los avisos esperados por ausencia de variables públicas de
Supabase en este entorno local y terminó con código 0. Todos los proveedores y
accesos de datos de las pruebas fueron dobles locales.

## Estado

- SDD-0421: **done local**.
- Logs internos retirados en este slice: **12**.
- Ruta cron con correlación propagada: **1/1**.
- Checklist general: **59/106 (55,7 %)**; la casilla agregada permanece abierta
  porque otros módulos internos todavía conservan telemetría legacy.
- Migraciones: ninguna nueva; 0401–0444 siguen preparadas y no aplicadas.
- Publicación/producción: **NO VERIFICABLE**; no hubo push ni despliegue.
