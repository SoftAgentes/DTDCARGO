# Internals de Conversaciones · SDD-0432 · evidencia local

Fecha: 2026-09-04

Alcance: push de respuesta, aviso inbound, digest mensual, extractor IA y enlace
del correlador desde el cron de conversaciones

Fuera de alcance: mensajes, resúmenes, entregas o datos reales, prompts, modelos,
permisos, RLS, migraciones, Cloud, push, `main`, despliegues y limpieza

## Resultado

Los cuatro internals usan ahora el logger canónico con operación, etapa y error
saneado. Se retiraron nueve `console.*` libres. El correlador del cron mensual
llega al runner y al extractor IA; los productores lo propagan a Telegram y Push.
Los eventos no incluyen IDs de conversación/cliente, períodos, nombres de modelo,
transcripciones, cuerpos de mensaje ni texto libre del proveedor.

Asignación, anti-spam, contenidos, generación de resumen y comportamiento
best-effort permanecen iguales.

## Evidencia ejecutada

- RED: 9/9 fallos confirmaron logs, logger ausente y correlación incompleta.
- GREEN focal: 26/26 pruebas en tres archivos.
- Suite completa: 7.468/7.468 pruebas en 598 archivos.
- TypeScript y ESLint: correctos.
- Gobernanza: 28 políticas aprobadas y cápsula vigente.
- Componentes: cinco fuentes, agregado reproducible y cero rutas rotas.
- Build de producción: compilación y generación correctas, 158 rutas.

El build mostró los avisos esperados por ausencia de variables públicas de
Supabase en este entorno local y terminó con código 0. El extractor usó su mock;
no llamó al proveedor IA ni consultó o modificó mensajes o datos reales.

## Estado

- SDD-0432: **done local**.
- Logs retirados en este slice: **9**.
- Checklist general: **59/106 (55,7 %)**; la casilla agregada permanece abierta
  por módulos legacy fuera de los alcances cerrados.
- Migraciones: ninguna nueva; 0401–0444 siguen preparadas y no aplicadas.
- Publicación/producción: **NO VERIFICABLE**; no hubo push ni despliegue.
