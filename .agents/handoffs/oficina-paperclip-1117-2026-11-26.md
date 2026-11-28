# Paperclip 2026.1117.0 · handoff documental

Fecha 2026-11-26 · Base `d26a2e7879d155a87ab3fb0ba9c2d90ea256d02c`. Referencia existente [SDD-0564](../../docs/specs/0564-instalacion-piloto-paperclip-hermes/spec.md) y [PR #409](https://github.com/SoftAgentes/DTDCARGO/pull/409). El encargo es documental y reutiliza el SDD existente.

## OBJETIVO ORIGINAL

Dejar a Sam un guion revisable para pasar la Oficina a Paperclip 2026.1117.0, con rutas condicionadas al origen real, medidas de continuidad y vuelta atrás.

## COMPLETADO

- [Anexo de evaluación](../../docs/organizacion/oficina-agentes/actualizacion-paperclip-hermes.md) con ocho cruces, rutas 1012 y 1106, evidencia y decisión por cruce.
- [Runbook 1117](../../docs/runbooks/oficina-paperclip-1117.md) con T-15, copia en frío durable, pin explícito, unidad manual, readiness, permisos, smoke, parada, retorno y decisiones de Sam.
- [Tag exacto](https://github.com/paperclipai/paperclip/releases/tag/v2026.1117.0) en `c0f132898d2a2677312d8c72096187b27a3d9a38`. El diario de ese tag contiene 450 entradas. El delta 0375–0451 contiene 77 y el corte desde 0306 inclusive, 146.

## VALIDACIÓN

| Comprobación | Resultado |
| --- | --- |
| `pnpm run docs:check` | PASÓ, 697 specs |
| `pnpm run governance:check` | PASÓ, cápsula de 29 políticas vigente |
| `pnpm run sdd:check` | PASÓ, 697 specs y 556 migraciones, avisos históricos conservados |
| Sintaxis Bash y rutas relativas | PASÓ, siete bloques y sus comandos de Bash anidados |
| Puerta de disponibilidad y estabilidad | PASÓ, 11/11 casos locales sobre los bloques del guion con dobles de `systemctl`, tiempo y HTTP. Incluye respuesta con 200 en stdout y exit 18 tanto en arranque como en cierre. El contraste histórico reprodujo el falso positivo del cierre en `ea7ed5e1a`. |
| Restauración de la copia durable, preservación del destino fallido, barreras de trabajo y permisos | NO EJECUTADO. El runbook exige comprobaciones y recibos antes de la intervención y reapertura. |
| `git diff --check` | PASÓ |
| `paperclipai update --help` en instalación de la Oficina | NO EJECUTADO. Los switches están confirmados por código del tag y el guion incluye su lectura antes y después. |
| Línea base de la Oficina | [MEDIDO] NO EJECUTADO |
| Revisión independiente / CI | Pendientes en cabeza exacta |

La invocación predeterminada de pnpm 12 inició comprobación de dependencias y enlaces de su caché en este hijo. Se interrumpió y se ejecutaron los tres scripts con `PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false` limitado al proceso, sin alterar configuración o lockfile. Se cotejaron también las tres entradas Node directas, exit 0.

## COMMITS

El borrador `8bbbc51cd97d82fd9ec3a3e0b2a31e0c051fee2e` recibió CHANGES_REQUESTED de OrKita. `ea7ed5e1a736c8cb6a5b11c2980a092b6aac1e35` delimitó T-15, añadió comprobaciones de restauración y arranque y cotejó el entorno por adaptador. OrKita reportó dos bloqueos adicionales sobre ese SHA. El commit de seguimiento exige exit 0 además de HTTP 200 en el cierre y distingue la preservación de un destino fallido mediante prueba de aislamiento y ausencia de escritores del cierre limpio obligatorio del origen. El alcance acumulado sigue limitado a los mismos tres documentos.

## PR / BRANCH

`docs/oficina-paperclip-1117`, local. Autorización de push y PR pendiente.

## PENDIENTES

Revisión técnica independiente del SHA, publicación de la rama y CI si Sam los autoriza. Antes de programar la ventana, falta la línea base de la Oficina, verificar el alcance frío de la copia, determinar los valores que realmente aplican y obtener los OK nominales de lectura e intervención.

## FUERA DE ALCANCE DETECTADO

Acceso al VPS, instalación, migración, cambios al puente, envoltorios o producción, y actualización de Hermes. El inventario del VPS de DTD Cargo es un encargo distinto.

## HANDOFF AL DIRECTOR

Enviar a OrKita el SHA exacto y ambos documentos para revisión de stack. El destino final es una PR documental con CI y dictamen técnico. Sam decide la ventana aparte.
