# Motor de reglas de correo · SDD-0437 · evidencia local

Fecha: 2026-09-04

Alcance: lectura de reglas, resolución de plantillas/destinatarios, envío y
actualización de métricas en `fireMailEvent`

Fuera de alcance: reglas, plantillas, destinatarios, correos o datos reales,
Resend, Cloud, migraciones, push, `main`, despliegues y limpieza

## Resultado

El motor crea un logger canónico por invocación. Sus seis logs libres se
reemplazaron por eventos con correlador, operación, etapa, modo, estado y error
saneado cuando corresponde. Los eventos no incluyen tenant, ID de regla,
destinatario, email, variables, fuente o payload.

La resolución de reglas y destinatarios, el envío, el conteo de disparos y la
semántica best-effort permanecen iguales: un fallo de correo no rompe al caller.

## Evidencia ejecutada

- RED: 9/9 fallos confirmaron logs, logger y eventos ausentes.
- GREEN focal: 9/9 pruebas del contrato estructurado.
- Suite completa: 7.526/7.526 pruebas en 603 archivos.
- TypeScript y ESLint: correctos.
- Gobernanza: 28 políticas aprobadas y cápsula vigente.
- Componentes: cinco fuentes, agregado reproducible y cero rutas rotas.
- Build de producción: código 0, TypeScript y 158 rutas generadas.

El build usó una URL Supabase sintética cerrada en localhost; sus avisos de
fetch eran esperados. No leyó reglas reales ni envió correos.

## Estado

- SDD-0437: **done local**.
- Logs retirados en este slice: **6**.
- Inventario legacy medido: **153** logs libres en `lib/studio`, `app/studio`,
  `app/api/studio` y `app/api/m`, excluyendo pruebas.
- Checklist general: **60/106 (56,6 %)**; la casilla de logs permanece abierta.
- Migraciones: ninguna nueva; 0401–0444 siguen preparadas y no aplicadas.
- Publicación/producción: no ejecutadas; el worktree se conserva.
