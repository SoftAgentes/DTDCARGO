# Internals de workers estructurados · SDD-0420 · evidencia local

Fecha: 2026-09-04

Alcance: outbox y entrega Web Push de operarios/users, agenda de avisos al
cliente, drain de workflows y sus tres rutas cron

Fuera de alcance: worker de bugs, otros productores/módulos legacy, colas o
datos reales, Cloud, migraciones, push, `main`, despliegues y limpieza

## Resultado

Los crons de push, avisos al cliente y workflows propagan ahora su mismo logger
correlacionado hasta los workers internos. Las llamadas fuera de esos handlers
crean un correlador local con la misma redacción.

Se retiraron trece `console.*` libres. Los fallos de entrega sólo registran
evento, etapa, conteo y código HTTP numérico; no registran endpoints, claves,
IDs de usuario/evento, payloads, destinatarios ni mensajes crudos del proveedor.

La semántica previa se conserva: sólo 404/410 elimina una suscripción; los
fallos transitorios incrementan intentos; las lecturas dudosas mantienen el
comportamiento fail-open; el claim de avisos sigue siendo atómico y los drains
inline siguen siendo best-effort.

## Evidencia ejecutada

- RED: 8/8 fallos confirmaron cinco internals con logs libres y tres rutas sin
  propagación del correlador.
- GREEN focal: 114/114 pruebas en siete archivos.
- Suite completa: 7.389/7.389 pruebas en 586 archivos.
- TypeScript y ESLint: correctos.
- Gobernanza: 28 políticas aprobadas y cápsula vigente.
- Componentes: cinco fuentes, agregado reproducible y cero rutas rotas.
- Build de producción: compilación y generación correctas, 158 rutas.
- Inventario del alcance: cero `console.*` libre en los cinco internals.

El build mostró los avisos esperados por ausencia de variables públicas de
Supabase en este entorno local y terminó con código 0. No se hizo una consulta
al proyecto alojado.

## Estado

- SDD-0420: **done local**.
- Logs internos retirados en este slice: **13**.
- Rutas con correlación propagada en este slice: **3/3**.
- Checklist general: **59/106 (55,7 %)**; la casilla agregada permanece abierta
  porque otros módulos internos todavía conservan telemetría legacy.
- Migraciones: ninguna nueva; 0401–0444 siguen preparadas y no aplicadas.
- Publicación/producción: **NO VERIFICABLE**; no hubo push ni despliegue.
