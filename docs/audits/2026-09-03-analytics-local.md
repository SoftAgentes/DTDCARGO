---
title: Analytics - cierre local de las puertas de acceso
tipo: auditoria-tecnica
autor: Codex
created: 2026-09-03
updated: 2026-09-03
confidencialidad: interno
---

# Analytics · SDD-0371 · evidencia local

## Resultado y alcance

SEC-01 se corrigió en el worktree de saneamiento y quedó en el commit local
260384b2. No hubo push ni despliegue. El primer gate y la verificación conjunta
posterior se distinguen para no atribuir resultados a una corrida diferente.
No cambia las 24 migraciones pendientes ni los permisos de main o limpieza.

Los tests independientes reprodujeron 27 fallos de 88: las puertas /acceso y
/entrar cargaban Analytics y los helpers emitían con la URL privada.
Tras el primer fix pasaron 88/88. La revisión independiente reprodujo otros
dos casos: navegación privada sustituida antes del render, de vuelta a otra
ruta pública o a la misma. Se corrigió la sincronización por cada commit React.
Resultado final focal: 90/90, y 100/100 incluyendo el banner de consentimiento.
Lint de los tres archivos: correcto. El gate detectó una anotación faltante de
this en el wrapper de History; corregida como this: History. La repetición
independiente de pnpm typecheck terminó con exit0. El primer gate conserva
su fallo registrado, no se reescribe retroactivamente como verde.

En el primer gate pasaron 6.590 unitarios/541 archivos, 166 contratos SQL y rebuild de 422
migraciones. Lint, frontera RSC, Edge Functions, docs, numeración, componentes
y gobernanza pasaron. migrations-applied se omitió por credenciales; no es
verificación Cloud. Build de 158 páginas pasó. E2E: 149 pasados, uno flaky
(handlers de adjuntos devolvieron500 y pasaron al reintentar), 18 omitidos.
WebKit no cerró en 300s y el runner lo terminó con aviso. No equivale a una
corrida E2E impecable. El gate terminó exit1 por el typecheck inicial, ya
corregido y repetido correctamente antes de iniciar Push.

## Navegador local

Next 16.2.11, puerto3207, caché propia .next/analytics-check, GA sintético.
Supabase deny-only en 13207: rechaza operaciones, sin datos ni proyecto real.
Intercepción de TODAS las solicitudes externas; el loader de Google sólo se
responde con un stub local. No se cargó el código del proveedor ni se enviaron
eventos a Google. Servidores propios detenidos al acabar; se retiraron sólo
las dos entradas de tsconfig que Next añadió para esta prueba.

| Caso | Evidencia observada |
|---|---|
| Carga /acceso/CODEX-SYNTHETIC-ACCESS-0371 | 0 scripts GA/init, gtag undefined, ga-disable GA/Ads true |
| Carga /entrar/CODEX-SYNTHETIC-ENTRY-0371 | 0 scripts GA/init, gtag undefined, flags true |
| Control /servicios hidratado | loader interceptado + init, flags false, page_view público |
| pushState a /entrar/CODEX-SYNTHETIC-SPA-0371 | flags true inmediatamente; ninguna entrada nueva en dataLayer en privado |
| Regreso a /servicios | flags false al confirmar render; page_view público recuperado |
| Paso privado sustituido por público en la misma tanda | flags true durante transición, luego false; ningún evento contiene CODEX-SYNTHETIC |

La primera espera de transición agotó30s. Repetida por etapas, registró los
estados inmediatos y confirmados anteriores. No se oculta como pasada inicial.
Consola: errores esperados de RPC al backend deny-only y avisos de preload CSS
en dev; no se afirma consola completamente limpia ni resultado Lighthouse.
Los scripts insertados antes en público permanecen en el DOM al ir a privado:
el bloqueo de navegación no pretende descargar JavaScript ya ejecutado.

## Revisión de datos acotada

1 CORRECTO técnico y 1 NO VERIFICABLE en este alcance; no es auditoría legal
integral ni asesoría legal. Se aplicó la guía revisar-datos-ve a minimización
y destinatario externo, sin ampliar a datos reales ni redactar políticas.

| Dato | Finalidad en el sistema | Destinatario bajo prueba | Retención/base jurídica |
|---|---|---|---|
| studio_access_tokens.token en /acceso | recuperar acceso Studio, no consumido por GET | antes elegible para Analytics; ahora excluido | no modificada; evaluación jurídica fuera de alcance |
| portal_access_links.code en /entrar | puerta de acceso Portal, consumo por POST | antes elegible para Analytics; ahora excluido | no modificada; evaluación jurídica fuera de alcance |
| pathname/page_location/cta_origin | medición pública | Google, sustituido por stub en pruebas | configuración alojada no inspeccionada |

- CORRECTO: components/Analytics.tsx:49 (PRIVATE_PREFIXES), :85 (sanitizePath),
  :132 (PageViews), :204 (fireWhatsAppSignals), :233 (trackLead) y :264
  (guard History) excluye estas
  puertas y comprueba la ruta actual. Evidencia ejecutable en
  components/Analytics.test.tsx y __tests__/analytics.test.ts.
- NO VERIFICABLE: publicación en producción, configuración de medición
  mejorada y procesamiento interno de GA/Ads. Un observador instalado después
  del guard puede tener su propio orden; el stub no certifica código externo.
  Revisar con proveedor/tag real únicamente en un entorno autorizado y con
  datos sintéticos, sin convertir estos tests en afirmación de cumplimiento.

Referencia técnica primaria: Google documenta el
[bloqueo ga-disable](https://developers.google.com/tag-platform/security/guides/privacy?hl=es)
y que la [medición automática observa History](https://developers.google.com/analytics/devguides/collection/ga4/views?hl=es-419).
La implementación conserva el mecanismo existente y adelanta el bloqueo;
no modifica las preferencias de consentimiento de la persona.

## Continuidad

La verificación conjunta posterior terminó exit 0 con reservas: 6.926 pruebas
en 543 archivos, 167 contratos SQL, rebuild de 422 migraciones y build de
158 páginas correctos. E2E final: 150 aprobados/18 omitidos; dos timeouts
globales de 480 s, no el flaky del primer pase. El arnés continuó con aviso.
migrations-applied omitido: 14/15 medidos, no cierre verde completo.
La evidencia común de los cuatro paquetes se registra en el
[checklist de continuidad](2026-09-02-codex-arranque-checklist.md).
Publicación y comprobación alojada tienen autorización independiente. Una revisión externa
del proveedor real complementaría esta revisión técnica, no la sustituye.
Direcciones Portal ya reprodujo su cruce y pasó 54 aserciones del correctivo
local 0425/SDD-0372. Push/SDD-0373 y verificador/SDD-0374 también tienen
correctivos locales probados, con sus límites en los informes separados.
