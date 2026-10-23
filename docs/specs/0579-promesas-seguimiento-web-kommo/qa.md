# QA local — SDD-0579

Fecha: 2026-10-23. Worktree/rama en el [handoff](../../../.agents/handoffs/0579-promesas-seguimiento-web-kommo.md). Esta evidencia no acredita producción ni la fuente instalada en Kommo.

## Entorno y barreras

- Dependencias propias: `pnpm install --frozen-lockfile --offline`, PASÓ: 817 paquetes reutilizados y cero descargas; lockfile sin cambios.
- Raíz sin `.env` reales; sólo `.env.example`. El runner borra variables sensibles del entorno, fija URLs sintéticas en loopback y `NEXT_PUBLIC_GA_ID=off`.
- [offline-network-guard.cjs](assets/offline-network-guard.cjs) bloquea fetch, sockets/DNS remotos y UDP antes de conectar. Se hereda por procesos Node, incluso al pasarles otro entorno; bloquea herramientas nativas de red y operaciones remotas de Git. La única excepción Git es el repositorio desechable `dtd-number-test-*` bajo el temporal del sistema, con `GIT_ALLOW_PROTOCOL=file` y rechazo de UNC/file-host; nunca la rama real. Log sólo host/tipo/PID, sin payload o credenciales.
- Probe previo a pruebas/build: fetch a dominio `.invalid`, socket remoto y fetch desde hijo: PASÓ, todos denegados antes de DNS/conexión. El probe detectó y permitió corregir una ruta de preload con separadores Windows antes de continuar.
- [local-ui-check.mjs](assets/local-ui-check.mjs) crea un fixture HTTP sin datos ni persistencia en `127.0.0.1`, lanza sólo el servidor de esta tarea y cierra su árbol al terminar. En navegador añade route guard, bloquea service workers y configura proxy local de respaldo. Cualquier intento remoto inesperado hace fallar el ensayo, aunque la aplicación tuviera fallback.
- Estas barreras son controles del ensayo Node/navegador, **no aislamiento universal del sistema operativo**. No se ejecutan binarios nativos que puedan acceder a producción; Edge/SQL/schema y E2E general sin route guard se omiten con motivo visible. No se cambian verificadores para conseguir verde. La comprobación del ledger productivo no recibe service-role key y debe omitir sin consulta.

## Reproducción

Desde la raíz del worktree, sin `.env` reales:

```powershell
node docs/specs/0579-promesas-seguimiento-web-kommo/assets/local-ui-check.mjs ui
node docs/specs/0579-promesas-seguimiento-web-kommo/assets/local-ui-check.mjs verify
```

El modo `verify` invoca el entry canónico `node scripts/verify.mjs` bajo las mismas barreras. Logs y fixtures quedan ignorados en `.codex/qa/`. No enviar formularios, hacer registros, abrir mensajes ni navegar a servicios externos.

## Resultados

- Focal: PASÓ, **41 pruebas en cuatro archivos**: suite nueva de 10 pruebas; contrato de FAQ; promesas públicas SDD-0521 y restantes SDD-0528. Prueba ambos valores de la bandera sin cambiar el valor real `true`, las 42 FAQ y sus propiedades, DOM/JSON-LD de tres consumidores, KB y privacidad.
- La primera ejecución de la prueba nueva falló por dos expectativas del test: 49 FAQ supuestas en lugar de las 42 comprobadas en la base, y conteo global de `<dt>` que incluía otra tabla. Se corrigió a la base real y se delimitó la sección FAQ; producto sin cambios por esos fallos.
- UI local: **PASÓ**, Chromium 1280 × 900, cuatro rutas: `/faq` (42 entidades FAQPage), `/shipping-mark` (8), `/puerta-a-puerta` (6) y `/privacidad`. Cero intentos remotos inesperados en Node y navegador en la corrida final; fixture de negocio local sin persistencia. Sólo se abrieron acordeones; no se enviaron formularios ni mensajes. Capturas inspeccionadas por Worker y Director: copy legible y completo.
- Capturas: [FAQ](assets/01-faq-local.png), [Shipping Mark](assets/02-shipping-mark-local.png), [privacidad](assets/03-privacidad-local.png).
- Primer ensayo UI: el guard detuvo una consulta automática de versión npm de Next; se añadió un fixture **exacto** para `next/dist-tags`, resuelto en loopback, sin abrir la red. También se corrigió la lista de bypass del proxy del runner (delimitador coma); no se alteró la configuración de la aplicación. El warning local de HMR por origen `127.0.0.1` se conserva, sin afectar el render probado.
- Verify canónico: en ejecución. Primer paso harness FALLÓ: bloqueo del guard a `origin` de fixtures locales y fallo separado de watchdog. El guard se acotó para permitir únicamente el transporte file de esos temporales; reejecución focal de numeración en curso. No se modifica harness ni sus aserciones.
- Producción, filas DB/PII, migraciones, Ads/Analytics real y carga/cambio de Kommo: **NO EJECUTADO**, excluidos del encargo.

## Límites de contenido

Privacidad conserva fecha, finalidades, retención y derechos; sólo cambia la descripción del código indicado al equipo. Alta/aprobación y newsletter en KB son hallazgos ajenos conservados sin validarlos. Las fuentes estáticas KB/infografía no cambian al apagar la bandera. No se promete fecha ni canal nuevo de aviso.
