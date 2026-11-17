# Handoff · SDD-0626 Paso 3b · La revisión de Sam y el envío desde el ERP (16/11/2026)

**Pedido:** Hermes, «PASO 3b» (SDD-0626 · D2 y D4 · AC-1 etapa 1), después de la #598 y de la #602. Todo nace apagado;
solo la bandeja 11. Sin merge propio: portón del DG.

## En el repo (esta PR)

- **A · `office_revisiones` (0549, sin aplicar en ningún entorno):** veredicto, las 5 casillas de eval.md, motivo,
  revisor y hora; solo se agregan filas; una por borrador; la huella del borrador, no su texto.
  `office_conteo_revisiones(etapa)` es la misma consulta para AC-1 (10) y AC-7 (20).
- **B · `/studio/admin/oficina`:** solo `is_platform_admin` (layout con `notFound()` y la base otra vez). Borrador y
  motivo en texto plano, las 5 casillas, Aprobar y Rechazar. Discord: «hay N pendientes», sin el texto.
- **C · `/api/cron/oficina-envio`:** `OFICINA_ENVIO_ACTIVO` apagado por defecto; token de escritura propio
  (`OFICINA_CHATWOOT_TOKEN_ENVIO`); solo la bandeja de prueba; otra vez la pausa y la huella antes de enviar; una vez
  por borrador; nunca a una bandeja del ERP ni a una conversación que alguien ya contestó.
- **D:** enlaces y dominios en el borrador escalan (`enlace`); dinero = prioridad 3 y escalado sin llamar al agente
  (guiones v0.2); la sesión de una llamada abortada se vuelve a borrar en cada tick durante 15 min.
- Pruebas: contrato SQL de la 0549 con 10 mutantes y su desarme (PGlite; el mismo contrato corre en Postgres 17 en CI),
  el despachador y el envío con dobles sobre las funciones reales (incluida la prueba F en miniatura: 3
  conversaciones, 2 aprobadas y 1 rechazada → 2 salientes en la 11), las piezas y las rutas.

## Fuera del repo (VPS Oficina, E · hallazgo 16 A)

- `hermes-soporte-compactar.timer` (domingos 05:10 UTC) → `/usr/local/libexec/hermes-soporte-compactar.sh`: para el
  gateway, `hermes sessions optimize`, vacía el WAL y lo arranca siempre, esperando a que escuche en 8642.
- Probado el 16/11/2026 a las 12:39Z: 0 páginas libres, WAL 0, restos de la marca de E de 1 a 0, `/v1/models` 200 con
  llave y 401 sin ella. REVERTIR: `/srv/oficina/backups/compactar-soporte-20261116T123857Z/REVERTIR.txt`.

## Revisión independiente del DG (16/11/2026, sobre 9bd4857f2: CHANGES) — atendida

- **M1:** el envío separa el POST del cierre. Solo un rechazo seguro de Chatwoot (4xx) es «fallido»; si el mensaje pudo
  haber salido, o el cierre en la base falla después de entregar, queda «enviando» con `envio.incierto` y no se
  reintenta. Runbook §11: qué hacer con un «enviando» atascado.
- **M2:** `crearChatwootEnvio` y `interpretarConversacion` se prueban con la forma real de Chatwoot 4.19.1
  (`envio-chatwoot.test.ts`). Una forma que no se reconoce bloquea el envío (`forma_desconocida`).
- **B3 (hecho):** `office_revisiones.entidad_ref` ata la aprobación a su conversación; la reserva la compara con la de la
  tarea y con la conversación a la que el ERP va a escribir (`conversacion_cambio`).
- **B1 (hecho):** la aprobación vence a las 24 h (`aprobacion_vencida`), y si el cliente escribió después del borrador no
  se envía (`cliente_escribio`). Un bloqueado termina la tarea.
- **B2 (pendiente, antes de la etapa 2):** la base no conoce la bandeja de prueba: `office_reservar_envio` solo anota
  `p_bandeja` y la allowlist vive en el ERP (configuración + GET). Es aceptable porque solo service_role reserva. Antes
  de abrir a bandejas reales, llevar la bandeja permitida a una configuración de la base como segunda capa.
- **B4 (pendiente):** mutantes que faltan en el contrato de la 0549:
  - uno propio para la comparación `v_huella <> v_r.huella_borrador` (hoy la compensa que service_role no tiene
    UPDATE sobre `office_borradores`);
  - que «dos revisiones por borrador» y «authenticated reserva envíos» exijan su código de error, no cualquiera;
  - una prueba de dos envíos realmente simultáneos.

## Pendiente

- Fusionar esta PR (DG). Aplicar la 0549 en staging (OK de Sam con aviso al DG) y, después, en producción (OK nominal
  de Sam en la sesión del DG).
- **Prueba F en staging, con OK de Sam:** 3 conversaciones; Sam aprueba 2 y rechaza 1. Esperado: 2 salientes en la
  bandeja 11, 0 en las demás y las 3 revisiones registradas. Red temporal como en E (opción A). Cierre igual que en E.
- R2: llaves propias del agente en Z.AI y DeepSeek (las crea Sam).
- B2 (antes de la etapa 2) y B4 de la revisión del DG (ver arriba).
