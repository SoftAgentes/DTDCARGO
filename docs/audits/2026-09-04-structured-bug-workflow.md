# Flujo de bugs · SDD-0433 · evidencia local

Fecha: 2026-09-04

Alcance: tomar bug, cambiar estado, subir/leer replay, listar/publicar mensajes
y efectos best-effort de las Server Actions

Fuera de alcance: bugs, mensajes, replays o datos reales, permisos, RLS,
migraciones, Cloud, push, `main`, despliegues y limpieza

## Resultado

Las cuatro rutas crean un logger desde la petición y devuelven el correlador en
todas sus respuestas. Las Server Actions crean un logger por invocación. Los
nueve `console.*` libres se reemplazaron por eventos con operación, etapa y
error saneado, y el correlador se propaga a las notificaciones internas.

Los eventos no incluyen IDs de bug/usuario, cuerpo del mensaje, storage key ni
texto libre del proveedor. El fallo de upload ya no devuelve el mensaje de
Storage y el fallo al insertar mensajes ya no devuelve el detalle PostgREST.
Estados, permisos, RLS, replay, timeline y semántica best-effort permanecen
iguales.

## Evidencia ejecutada

- RED: 16/16 fallos confirmaron logs, logger/correlación ausentes, detalle crudo
  y propagación incompleta.
- GREEN focal: 16/16 pruebas.
- Suite completa: 7.484/7.484 pruebas en 599 archivos.
- TypeScript y ESLint: correctos.
- Gobernanza: 28 políticas aprobadas y cápsula vigente.
- Componentes: cinco fuentes, agregado reproducible y cero rutas rotas.
- Build de producción: compilación y generación correctas, 158 rutas.

El build mostró los avisos esperados por ausencia de variables públicas de
Supabase en este entorno local y terminó con código 0. No consultó ni modificó
bugs, mensajes, replays o datos reales.

## Estado

- SDD-0433: **done local**.
- Logs retirados en este slice: **9**.
- Inventario legacy medido: **174** logs libres en `lib/studio`, `app/studio`,
  `app/api/studio` y `app/api/m`, excluyendo pruebas.
- Checklist general: **59/106 (55,7 %)**; la casilla agregada permanece abierta
  por módulos legacy fuera de los alcances cerrados.
- Migraciones: ninguna nueva; 0401–0444 siguen preparadas y no aplicadas.
- Publicación/producción: **NO VERIFICABLE**; no hubo push ni despliegue.
