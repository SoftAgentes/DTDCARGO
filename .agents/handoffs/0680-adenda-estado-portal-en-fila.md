# Handoff · SDD-0680 adenda (b): el estado del chat del portal sube a la fila de la Bandeja

- Owner: Worker (Claude), encargo de Dir_DTD con pedido directo de Sam · Rama: `claude/clever-morse-17db57` · Base: `main` 9e9c5a274.
- Pedido de Sam (2026-11-23): la tarjeta de abajo de la Bandeja «se ve muy mal»; hacerla más estética e informativa, arriba. Se le dibujaron A/B/C y eligió «Va la A» (pastilla en la fila).

## COMPLETADO
- `PortalChatwoot.tsx`: de tarjeta a pastilla en la fila (al día, apagado, N sin llegar, N atascados; con icono y texto), «Reintentar los atascados» en la fila con atascados, detalle al clic (`role="dialog"`, Escape y clic afuera, foco de vuelta).
- `BandejaClient.tsx`: solo cambia dónde se monta (en la fila, también sin vínculo, como antes).
- Textos es-VE y zh-CN: título «Chat del portal», ayuda que explica qué es, cuatro claves `bandeja.portal.pill.*`; sale `bandeja.portal.atascados_estado`. La ayuda ya no nombra la bandeja «Conversaciones del portal» (deja de ser clase A′ de la SDD-0707).
- Pruebas: `PortalChatwoot.test.tsx` reescrita (estados, detalle, Escape, clic afuera, reintento y error). `kpi-cifra-en-tinta-contract.test.tsx`: sale el caso de mutante de la cifra de 20 px, que ya no existe (no debilita el contrato: la regla general sigue barriendo todo el Studio).
- Spec 0680: adenda (b) al final, con gobernanza y allowlist.

## VALIDACIÓN
- vitest, tipos, lint y build locales: NO EJECUTADO (el worktree no tiene `node_modules`; instalar es una corrida pesada que necesita turno de Dir_DTD). El portón es el CI de la PR.
- `/ui-check`: revisión manual del diff contra BTN-01, A11Y-01 y VIS-01 (en la spec). Sin captura en navegador real: NO EJECUTADO.

## PENDIENTES DE ESTA TAREA
- CI verde y revisión independiente (la lanza Dir_DTD).
- Cruce con la PR #793 (misma carpeta): ver «Cruce» en la PR; los dos tocan `BandejaClient.tsx`, `bandeja.ts` y la spec 0680 en zonas distintas.

## FUERA DE ALCANCE DETECTADO
- Colores de los íconos de canal dentro de Chatwoot (WhatsApp verde, Messenger azul, Instagram): propuesta dibujada a Sam, esperando su elección; va por `DASHBOARD_SCRIPTS` con OK nominal.
- Renombrar la bandeja «Conversaciones del portal» en Chatwoot: fase 5 de la SDD-0707 (primero el cruce por ID en `cargar.sh`/`ensayo-portal.sh`).
- La sección «Eventos descartados» del admin sigue debajo del panel con el mismo problema de visibilidad.
