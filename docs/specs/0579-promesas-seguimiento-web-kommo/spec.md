---
sdd: "0579"
title: "Promesas de seguimiento coherentes en FAQ y fuentes locales"
status: done
author: "Codex"
created: 2026-10-23
updated: 2026-10-23
supersedes: null
superseded_by: null
related: ["0062","0514","0521","0528"]
confidencialidad: interno
---

# SDD-0579 — Promesas de seguimiento coherentes

## Objetivo y autorización

Sam autorizó el 2026-10-23: «empieza por las promesas de seguimiento con un Worker aislado. Déjalo implementado y probado localmente, sin push, merge, despliegue ni cambios en la cuenta de Kommo».

Continúa P1 del plan local del 23-oct y las SDD-0514/0521/0528. No activa el seguimiento. Con `TRACKING_EN_CONSTRUCCION = true`, cinco FAQ dejan de prometer eventos disponibles en el Portal. Con `false`, recuperan exactamente sus respuestas anteriores. Preguntas, categorías, widgets, anclas y consumidores conservan su contrato.

«Te avisaremos apenas esté activo» reutiliza la aprobación explícita de SDD-0521; no define canal o fecha ni autoriza automatización o envío. Privacidad describe una consulta existente al equipo, sin alterar la fecha de vigencia, finalidades, tratamiento histórico, retención, base jurídica o derechos.

## Matriz antes / después

| Fuente / lugar | Antes | En construcción |
|---|---|---|
| FAQ registro | acceso al «portal de seguimiento» | «portal del cliente»; seguimiento en construcción; consulta por WhatsApp y frase aprobada |
| FAQ acceso al Portal | «envíos y pre-alertas paso a paso» | «compras y pre-alertas»; demás funciones/acceso conservados; aviso y consulta |
| FAQ salidas | etapas de cada envío actualizadas en Portal | salida cada 15–21 días conservada; aviso y consulta por WhatsApp |
| FAQ seguimiento | eventos «en vivo», BL/DTDU en Portal | estado mediante nuestro equipo por WhatsApp, con Shipping Mark o número de envío |
| FAQ código proveedor | para seguir con DTD entrar al Portal | courier chino hasta Yiwu conservado; estado DTD con el equipo y aviso |
| KB §3 tránsito | registro para seguir paso a paso | aviso, WhatsApp y frase aprobada, tránsito intacto |
| KB §11 tracking | Portal con compras/envíos y «muy pronto» | consulta al asesor conservada; aviso sin plazo; nota interna sobre capacidad desactivada |
| KB §21 continuación newsletter | «portal de seguimiento» | portal para compras/pre-alertas, sin corregir newsletter |
| KB §28 dirección Alibaba | seguir compra en Portal en vez de preguntar | compra registrada en Portal desde el primer día |
| Privacidad, fila Seguimiento de envío | código introducido en consulta pública retirada | Shipping Mark/número de envío indicado al consultar al equipo |
| Fuente infografía, beneficio 3 | ver estado «en todo momento» | compra registrada en Portal desde el primer día |

Las cuatro cláusulas de KB son equivalentes por capacidad a las cinco FAQ, no copias literales. KB e infografía son fuentes estáticas: no cambian al apagar la bandera; futura revisión/carga separadas. La fuente Kommo queda preparada localmente / subida NO EJECUTADA. No se genera DOCX ni imagen/PDF de infografía.

## Alcance exacto

- `lib/faqs.ts`: import del interruptor existente y únicamente las cinco respuestas indicadas.
- `app/privacidad/page.tsx`: únicamente descripción factual de fila Seguimiento de envío.
- `docs/specs/0062-crm-erp-cierres-automaticos/assets/faq-knowledge-base.md`: cuatro cláusulas anteriores y notas de capacidad/fuente local.
- `docs/marketing/servicios-infografias/prealerta-compra.md`: únicamente beneficio 3.
- `app/__tests__/faq-seguimiento-coherente.test.tsx`: contrato nuevo.
- Esta spec; `docs/specs/0579-promesas-seguimiento-web-kommo/qa.md`.
- Assets de esta spec: `01-faq-local.png`, `02-shipping-mark-local.png`, `03-privacidad-local.png`, `offline-network-guard.cjs` y `local-ui-check.mjs`.
- `docs/specs/README.md`: índice generado.
- `docs/marketing/README.md` y `docs/marketing/seo.md`: notas mínimas de continuación y estado local.
- `.agents/handoffs/0579-promesas-seguimiento-web-kommo.md`.

Fuera de alcance: P2 móvil/P3 Ads, cambiar bandera, activar funciones, rutas/API/DB/migraciones/datos clientes, alta/aprobación de cuenta, otras FAQ, newsletter, `llms.txt`, manifest, tabla de PuertaAPuerta, notificaciones, publicación de campañas, carga de Kommo y cualquier push/PR/merge/deploy.

## Aceptación local

1. Las cinco FAQ en construcción describen la limitación y canal real, sin eventos en vivo ni fecha de activación.
2. `/faq` presenta respuestas coherentes en DOM y FAQPage JSON-LD; `/shipping-mark` mantiene su selección completa y la respuesta de registro corregida; `/puerta-a-puerta` mantiene sus seis FAQ y equivalencia DOM/JSON-LD.
3. Se prueban ambas posiciones de la bandera; `false` conserva exactamente las cinco respuestas previas. Las demás FAQ y propiedades son invariantes; bandera real sigue `true`.
4. KB sin promesas retiradas, con nota local y sin carga; fuente de infografía alineada.
5. Privacidad cambia sólo la descripción factual indicada y conserva el resto.
6. Capturas y revisión local de FAQ, Shipping Mark y privacidad sin formularios ni mensajes reales.
7. Pruebas focales y cierre canónico `pnpm verify` (o entry directo documentado), distinguiendo PASÓ/FALLÓ/NO EJECUTADO/NO DISPONIBLE y SKIPs. El ledger productivo se omite sin consulta.
8. Diff/allowlist, documentación y handoff revisados; commits locales; sin publicación.

## Validación y aislamiento

Antes de pruebas, build y páginas: worktree sin `.env` reales, variables sensibles retiradas del entorno, endpoints sintéticos en loopback y medición apagada. Guard de red Node heredado por subprocesos más bloqueo de navegador; salidas remotas se deniegan antes de conectar y se registran sin payloads/tokens. Ningún bloqueo se convierte en permiso para consultar un servicio real. Las herramientas nativas con red requieren control adicional o se omiten explícitamente.

Detalle reproducible y resultados en [qa.md](qa.md). Gobernanza Studio: no aplica (copy público sin cambios de componente, acción o flujo); gates ejecutables conservados. Datos personales: no captura, mueve ni borra datos, ni consulta filas; corrección de texto fijo.

## Estado

Implementación y aceptación local completadas: cinco FAQ, fuentes estáticas y privacidad, pruebas focales, render/JSON-LD y build de release. El gate canónico conserva FALLÓ/INCOMPLETO por incompatibilidades del auxiliar de ensayo, corregidas y recheckeadas focalmente, y cinco omisiones explícitas. No equivale a un gate global verde ni aprobación de release. Sin integración ni publicación. Conocimiento con capas pendientes declaradas. Cierre y evidencia en el [handoff](../../../.agents/handoffs/0579-promesas-seguimiento-web-kommo.md).
