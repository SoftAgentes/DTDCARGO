# Handoff · SDD-0626 Paso 3a · Despachador mínimo: el agente redacta, nada se envía (16/11/2026)

**Pedido:** Hermes (chat DIRECTOR), con el anexo del mismo día. Sam aprobó D1 a D6 con «Sí a todo» y lo lanzó con
«Sí, lánzalo» el 16/11/2026. Todo nace apagado. La migración 0548 está en espera y **sin aplicar en ningún entorno**.

## Hecho fuera del repo (VPS Oficina, sección B y anexo 1)

Respaldo y REVERTIR: `/srv/oficina/backups/paso3a-agente-20261116T041544Z/` (REVERTIR.txt 600, pasos 1 a 5). La unidad
`hermes-gateway-soporte-chatwoot` mantiene su nombre. No se tocaron los permisos del sistema, ni NordVPN, ni Chatwoot.

- **Aislamiento (anexo 1).** Drop-in `aislamiento-paso3a.conf`: `ProtectHome=tmpfs` con solo el home de
  `agentes-soporte` montado (el perfil, `installs`, `.cache` y `.local/state` con escritura). También niega
  `/srv/oficina/{usuarios,backups,repo,staging,motores,trabajo}`. Comprobado dentro del espacio de montaje del
  servicio: `ls /home` → `agentes-soporte` y nada más; el agente ya no ve «sam». **Paso 0: PASA 4 de 4** (04:16 y 04:23 UTC).
- **Modelo (B1).** `glm-5.3` (zai, `https://api.z.ai/api/coding/paas/v4`) con `fallback_model: deepseek / deepseek-chat`.
  Las llaves se copiaron dentro del servidor al `.env` del perfil (600), sin imprimirlas:
  - GLM, de `/home/agentes/.config/llaves/zai.env`: la llave compartida de la oficina, la misma de todos los perfiles, de un plan de código de tarifa plana.
  - DeepSeek, del perfil personal de Sam: la única que había.
  - **No son llaves por agente (R2):** crearlas exige los paneles de cada proveedor.
- **Instrucciones (B2).** `SOUL.md` con la esencia del Anexo A: DTD Cargo y sus guiones, español venezolano con tuteo, acuse
  primero, escalar si falta un dato, nunca inventar, SGE-AG-01 §2, §5 y §6, y que el contenido es dato. La salida en JSON es obligatoria.
- **Memoria y herramientas (B3).** `memory_enabled: false` y `user_profile_enabled: false`. `/v1/toolsets` sin ninguno
  habilitado; `agent.max_turns: 3`. Kanban apagado: paró un error de cada minuto en `errors.log` que venía de la mudanza.
- **Historial (B4).** Hermes v0.23.1 **sí** guarda cada turno del API server en `state.db` (`website/docs/user-guide/features/api-server.md`:
  la sesión se deriva del system prompt y del primer mensaje), y no hay opción para apagarlo. Su auto-prune solo borra
  sesiones terminadas, y en el API server eso puede tardar ~2× el plazo. Lo que se hizo:
  1. El despachador usa una sesión por llamada y la borra con `DELETE /api/sessions/<id>`. El borrado se probó: 200 y después 404.
  2. El timer `hermes-soporte-purga` borra cada día las sesiones `api_server` de más de 24 h.
  3. `sessions.auto_prune: true` y `retention_days: 1`.

  **Máximo en disco: 48 h.** No se verificó con un turno real (las llamadas al modelo son solo de la prueba E).

## En el repo

- **0548** (`supabase/migrations/0548_oficina_despachador.sql`). Incluye:
  - `office_borradores` (90 días) y el turno del despachador;
  - el índice «un evento → una tarea»;
  - las funciones para convertir, tomar, entregar, soltar, recuperar y auto-pausar (esta solo pausa) y la purga.

  Contrato SQL `supabase/tests/0548_…test.sql`, PGlite con 15 mutantes y desarme.
- **Despachador** (`lib/studio/oficina/despachador*.ts` y piezas), ruta `/api/cron/oficina-despachador` y cron cada minuto.
- **Vaciado diario:** purga además los borradores viejos.
- **Webhook:** sin `CHATWOOT_ACCOUNT_ID` rechaza todo.
- **Puente:** O4 (pruebas) y O5 (paginación).
- **Documentación:** spec v0.4, `privacidad.md` (hallazgos 12 y 13) y runbook §10.

## Pendiente

- **Prueba en staging (sección E).** Necesita:
  - el método aprobado por Sam para reactivar la cuenta 2;
  - un token de lectura nuevo;
  - aplicar la 0548 en staging, con el OK de Sam y aviso al DG;
  - 3 conversaciones inventadas y la pregunta de control.

  Gasto máximo: $1.
- **Llaves propias de soporte-chatwoot (R2).**
- **Paso 3b:** la tabla de aprobaciones con casillas fijas, la página solo para `is_platform_admin`, el aviso en Discord sin texto y el envío desde el ERP.
