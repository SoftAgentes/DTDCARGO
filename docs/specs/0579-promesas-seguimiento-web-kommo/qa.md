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
- Verify canónico: **FALLÓ e INCOMPLETO**, exit 1; 12 de 17 pasos ejecutados. Primera pasada harness: 216/237 pruebas pasaron y 21 fallaron: 20 por bloquear el `origin` local de los fixtures de numeración y una aserción del watchdog de corte de árbol. El guard se acotó a esos temporales, con `GIT_ALLOW_PROTOCOL=file`, y la reejecución de **numeración PASÓ 21/21**. No se modifica harness ni sus aserciones.
- Suite general canónica, primera pasada: **FALLÓ**, 859 archivos pasaron, 2 fallaron y 1 se omitió; **12.284 pruebas pasaron, 4 fallaron y 1 se omitió**, en 630,97 s. Los fallos fueron una expectativa de URL canónica de email mockeado (runner imponía SITE_URL local) y tres pruebas de puerto local (guard trató `dns.lookup('0.0.0.0')` de bind como DNS remoto). Se corrigieron sólo auxiliares propios: default de SITE_URL en verify y excepción de lookup de IP literal para bind; `Socket.connect` a ese host continúa denegado. Rechecks: **actions PASÓ 17/17**, **puertos PASÓ 12/12**. El probe negativo posterior denegó conexiones a `0.0.0.0` y `example.invalid` antes de red.
- El gate arrancó automáticamente su retry completo del paso test con el entorno anterior. Para evitar repetir 10 minutos de una comprobación ya clasificada, Director indicó interrumpir **sólo ese árbol Vitest**: PID 23556 verificado como hijo de verify 64196 y comando exacto de Vitest. Verify/runner siguieron activos y registraron `test FALLÓ (exit 1)`. No hubo otra suite general manual; el resultado original se conserva.
- Watchdog: el primer recheck reprodujo el fallo. Se identificó otra incompatibilidad del **guard propio**: su wrapper de `execFile` perdía `util.promisify.custom`; el inventario esperaba `{stdout,stderr}` y recibía un string. Se preservó ese contrato y `promise.child` pasando siempre por los controles del wrapper. **Recheck final PASÓ 15/15**. Probe: stdout/child correctos y fetch remoto desde hijo denegado. No se atribuye este fallo al producto ni a flakiness del harness.
- **PASÓ en el gate original:** lint, frontera RSC, tipos, docs:check, numbering, seis constantes, componentes, cápsula de 28 políticas, símbolos de migraciones pendientes (0 rojo; 1 amarillo preexistente) y **build de producción completo + postbuild Norte**. El build restauró `tsconfig.json` y retiró `.next-verify`; no queda cambio ajeno al alcance.
- **NO EJECUTADO / SKIP en el gate:** Edge (sin herramienta/red autorizada), migrations-applied (sin service-role; no consultó ledger), SQL y schema (sin ejecutar Docker/DB), E2E general (sin route guard propio). La prueba browser acotada descrita arriba complementa, sin sustituir cobertura general ni pruebas de DB. El resumen global continúa FALLÓ/INCOMPLETO pese a los rechecks.
- Log canónico ignorado `.codex/qa/verify.log`: SHA-256 `eb84c19073e809fa7e653ff7546e928dacd93549aeffad6901d72bea7437ee90`. Logs focales y fixtures en el mismo directorio, sin datos de negocio.
- Producción, filas DB/PII, migraciones, Ads/Analytics real y carga/cambio de Kommo: **NO EJECUTADO**, excluidos del encargo.

## Límites de contenido

Privacidad conserva fecha, finalidades, retención y derechos; sólo cambia la descripción del código indicado al equipo. Alta/aprobación y newsletter en KB son hallazgos ajenos conservados sin validarlos. Las fuentes estáticas KB/infografía no cambian al apagar la bandera. No se promete fecha ni canal nuevo de aviso.

## Conocimiento local

Graphify 0.9.61 regeneró estructura en este worktree: 43.778 nodos y 79.870 relaciones. Conserva advertencias de extracción parcial en dos fuentes de Studio legal ajenas al slice. Tras editar QA/handoff fuera del piloto, su estructura queda PENDING; por indicación del Director no se regenera globalmente otra vez sólo por esos documentos.

El README de marketing se leyó completo y se preparó un fragmento semántico local (9 nodos, 8 relaciones, afirmaciones fechadas, YAML inexistente revisado): `graphify-out/sdd0579-marketing.fragment.json` y su review. Importación `--check`: **RECHAZADA**, «structural graph must be current before importing semantic output»; no se forzó ni se certificó el piloto. Recibo del README, cobertura semántica piloto/global e integración siguen pendientes para Director.

Archify 2.16.0 utilizó únicamente copia local del ZIP oficial con hash fijado `4c59fa6557a2385beaaef8c7219cc414573acc9f0c30a932d5053b0b20689a46`. Build local: **PASÓ**, nueve checks, once fuentes, artefacto CURRENT en la revisión observada `206728c5a`; informa `graphStructural=PENDING` y `graphSemantic=PENDING` sin certificarlos. Recibos locales en `.codex/qa/knowledge-visual-*.json`. La revisión final de documentos puede dejar derivados pendientes otra vez; no se declara actualizada la bóveda compartida ni revisión visible en Obsidian.

El check posterior de Archify también **PASÓ / CURRENT** sobre esa misma revisión. Exportación de Obsidian `publish --preview`: **CANCELADA** por `SOURCE_CHANGED` al actualizar QA/spec durante la exportación; el control rechazó una instantánea que ya había cambiado. Preview queda **PENDING**, sin forzar ni certificar contenido parcial. No se repitieron refrescos globales ni exportaciones pesadas por el cierre documental, por indicación del Director. Publicación compartida y apertura visible de Obsidian: **NO EJECUTADO**.
