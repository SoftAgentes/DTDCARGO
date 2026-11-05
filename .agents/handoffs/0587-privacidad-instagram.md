# SDD-0587: `/privacidad` nombra Instagram (handoff)

Rama `codex/0587-privacidad-instagram`, worktree `DTD-worktrees/0587-privacidad-instagram`. Encargo del Director General, 2026-11-05, con el texto que aprobó Sam. La evidencia y la revisión de datos están en la spec, sección «2026-11-05 · `/privacidad` nombra Instagram».

## Autorización

Sam, por el selector, en el chat del Director General; lo registra el Subdirector:

- A «/privacidad no nombra Instagram y ya entran datos de clientes por ahí. ¿Apruebas este cambio de texto?»: «Apruebo este texto (Recommended)». La opción decía: «Entra a main con estas palabras y se publica con la tanda C, con la fecha de actualización nueva.»
- A «Instagram ya recibe clientes reales sin la revisión de Meta. ¿Cómo queda?»: «Dejarlo conectado (Recommended)». Nada que hacer en Meta ni en Chatwoot.

Cubre estas palabras. Si cambia una, se le vuelve a preguntar. No cubre aplicar nada en producción: publica el Director General, con la tanda C.

## Qué cambió

- `app/privacidad/page.tsx`: los dos textos, `UPDATED` y un comentario de código que no se muestra.
- `app/__tests__/privacidad-chat.test.ts`: fija los dos textos completos y la fecha.
- `app/__tests__/faq-seguimiento-coherente.test.tsx`: la fecha.
- `docs/legal/privacidad/inventario-terceros.md`: la fila de Meta, con Instagram activo y Messenger pendiente, y la frase «Hoy no tiene datos reales», que ya no era cierta.
- `docs/specs/0587-chatwoot-contrato-sistema-maestro/spec.md`: allowlist y sección del cambio.

## Orden de integración

Lo dio el Director General: primero #340 y #341, y esta después, de a una. La rama queda lista y se publica cuando entre la #341, para no gastar un CI. Antes de publicar, traer `main` y repetir las comprobaciones. Con esta entra la tanda C completa, y la publica él.

## Pendiente de esta tarea

- La respuesta del Director General sobre las inexactitudes del texto. Se le llevaron cinco, listadas en el punto 7 de la revisión. No se corrigió ninguna.
- Traer `main`, publicar la rama y abrir la PR, cuando entre la #341.
- Si la tanda C no sale el 2026-11-05, preguntar si se mueve la fecha.

## Impacto documental

- Spec e inventario: en esta rama.
- La fila 4.6 y P6 de `0582-e4-canales.md`: van en la próxima PR de documentos, por orden del Director General, junto con «Dejarlo conectado».
- Graphify y Obsidian: los revisa el Director General al cierre.

## FUERA DE ALCANCE DETECTADO

- **Datos del perfil de Instagram en Chatwoot.** Chatwoot pide y guarda foto, seguidores y banderas de seguimiento que Studio no usa. Limitarlos necesita un `zz_dtd_*` con SDD propia.
- **Texto del mensaje en el log de Rails** si falla un envío a Instagram (`app/services/instagram/base_send_service.rb:65`, imagen 4.19.1). La redacción de logs no lo tapa.
- **Retención dentro de Chatwoot:** sigue sin definir (spec, §14.3, punto 8).
- **`inventario-terceros.md`, sección 2 bis:** su título todavía dice «en preparación, 2026-10-29».
