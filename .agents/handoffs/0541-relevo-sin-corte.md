# Handoff — SDD-0541 · Relevo sin corte al publicar la web (enmienda 2026-11-06)

Fecha: 2026-11-06. Task ID: `0541-relevo-sin-corte`.
Owner / sesión escritora: `local_d3ee839a-corte-web` (Worker Claude Code), por encargo del Subdirector `local_61442abe-3b66-423e-9af4-8008d5457aa3`, prioridad 1 del Director General.

- **Worktree:** `DTD-worktrees/corte-web-al-publicar`.
- **Rama:** `codex/corte-web-al-publicar`, desde `origin/main` `3d17292a4`.
- **SDD:** enmienda dentro de la 0541 (`docs/specs/0541-publicacion-automatica-vps/spec.md`, § Enmienda 2026-11-06). Es el mismo publicador, así que no lleva número nuevo.

## OBJETIVO ORIGINAL

En las tandas D y E del 2026-11-06, la prueba rápida de `publicar-web.sh` dio entre 5 y 7 páginas en 404 en el primer intento, justo después de `healthy`. El reintento pasó. El encargo:

1. Medir la causa con archivo:línea.
2. Arreglarlo sin corte o, si no se puede, que la prueba rápida espere de verdad.
3. Una prueba roja sin el arreglo y verde con él, y un mutante.
4. PR contra `main`. Publicarla está autorizado; fusionarla, no.

## CAUSA (del código, en `main` `3d17292a4`)

1. **`infra/ops/web/publicar-web.sh:463`:** `up -d --no-deps web`. La configuración del web cambia (`DTD_WEB_IMAGE`), así que compose **recrea** el contenedor: baja el viejo y después crea el nuevo. Desde ese momento no hay web detrás de Traefik.
2. **`Dockerfile:143`:** `HEALTHCHECK --interval=30s --start-period=40s`. El nuevo pasa unos 30 s en `starting` antes del primer chequeo.
3. **Traefik `v3.7.14` (`infra/ops/traefik/compose.yml:23`, proveedor Docker en `:37-38`):** no enruta a un contenedor `starting` ni `unhealthy`; lo filtra. Sin otro contenedor, la regla del host desaparece y Traefik responde **404**. Además aplica los cambios con el *throttle* por defecto de 2 s, que no se cambia en `:31-56`. *(Que filtre los contenedores no sanos y el throttle de 2 s son conducta documentada de Traefik, no medida aquí.)*
4. **`publicar-web.sh:466` → `:467`:** `esperar_web` vuelve apenas Docker dice `healthy` (sondeo cada 3 s, `:82`) y la prueba rápida arranca enseguida. Traefik todavía no sumó el contenedor, así que las primeras páginas dan 404 y las siguientes ya pasan. Eso es lo que se vio: 5 a 7 de 14. El reintento a los 15 s (`:468`) pasa.

**Consecuencia:** no es solo un falso rojo de la prueba. Los usuarios ven 404 durante **~30 s o más** en cada publicación: desde que compose baja el viejo hasta que Traefik toma el nuevo.

### Para confirmarlo en el VPS (solo lectura; lo pide el Subdirector)

```bash
# 1. Lo que dejó cada publicación de las tandas D y E
for d in /srv/ops/evidencias/publicar-web-20261106T*-publicar-*; do echo "== $d"; grep -h 'healthy a los\|prueba rápida\|compose' "$d/salida.txt"; done
# 2. ¿Los 404 son de Traefik (sin router) o de Next? En el log de acceso JSON de Traefik, un 404 sin RouterName es «sin router»
docker logs --since 2026-11-06T00:00:00Z ops-traefik-traefik-1 2>&1 | grep '"RequestHost":"dtdcargo.com"' | grep '"DownstreamStatus":404' | grep -c '"RouterName":""'
# 3. Cuánto tardó el healthcheck del web que corre ahora
docker inspect --format '{{.State.StartedAt}} {{range .State.Health.Log}}{{.Start}} {{.ExitCode}}; {{end}}' "$(docker ps -q --filter label=com.docker.compose.project=dtd-cargo --filter label=com.docker.compose.service=web)"
```

El nombre `ops-traefik-traefik-1` se deduce de `name: ops-traefik` (`infra/ops/traefik/compose.yml:19`): **NO VERIFICADO**. Si no existe, se busca con `docker ps --filter label=com.docker.compose.project=ops-traefik`.

## COMPLETADO

`publicar-web.sh`:

- **`relevar()` (nuevo):**
  1. `up -d --no-deps --no-recreate --scale web=2 web` levanta el nuevo al lado del que sirve.
  2. Espera a que **ese** contenedor quede healthy.
  3. Espera `PUBLICAR_ESPERA_TRAEFIK` (5 s, más que el throttle de 2 s) para que Traefik lo sume.
  4. Retira el viejo con `docker stop -t PUBLICAR_GRACIA_WEB` (20 s) y `docker rm -f`.
  5. Otra espera igual para que Traefik saque al viejo.
  6. Comprueba que quede un solo web, y recién entonces corre la prueba rápida.
- **Si el nuevo no queda healthy:** se retira el nuevo y el viejo nunca dejó de servir. La vuelta atrás ve que ya corre la anterior y no levanta otra.
- **Si `compose up` falla a mitad:** se retira lo que haya creado.
- **Vuelta atrás después del relevo:** también es un relevo, sin corte.
- **`contenedores()`** lista todos los web. `contenedor()` sigue devolviendo uno.

Pruebas y docs:

- **`prueba-publicar-web.sh`:**
  - **Doble de Docker:** modela dos web (`cont/web` y `cont/web.2`), `stop` y `rm`. Con `traefik-lag`, Traefik tarda en sumar y en sacar contenedores. Cada vez que la web queda sin un contenedor enrutado, lo anota en `corte.log`. Si compose recrea el web sin relevo, también lo anota.
  - **Doble de la prueba rápida:** da 404 mientras Traefik no enruta solo al nuevo, como en producción.
  - **Sección «relevo sin corte»:** seis casos.
  - **Mutantes nuevos:** seis.
- **Docs:** runbook `publicacion-automatica-web.md` (§ Relevo sin corte) y enmienda en la spec 0541.

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| Sección «relevo sin corte», copia recortada (dobles + la sección) en Git Bash con shims de `flock` e `install -d` | **PASÓ**: 6 PASÓ · 0 FALLÓ |
| La misma sección contra `publicar-web.sh` de `origin/main` (control rojo) | **FALLÓ como se esperaba**: 1 PASÓ · 5 FALLÓ. «compose recreó el web: bajó el viejo antes de que el nuevo estuviera healthy» y la prueba rápida en 404. El que pasa es el control del doble |
| Mutante «retira el viejo sin esperar a Traefik», sobre la copia recortada | **MUERTO**: 4 PASÓ · 2 FALLÓ |
| Mutante «retira el viejo aunque el nuevo no quede healthy», sobre la copia recortada | **MUERTO**: 3 PASÓ · 3 FALLÓ |
| `prueba-publicar-web.sh` completa | **NO DISPONIBLE en local**: en Git Bash pasa de 40 min y sus chequeos de permisos (`stat -c %a`) son de Linux. La cubre el CI Linux de la PR («Pruebas bash de operaciones», ~75 s), o Docker con turno del Director General: Docker lo tiene ahora el Subdirector de Chatwoot |
| `--mutantes` completo (los 6 nuevos y los de antes) | **NO EJECUTADO**: corrida pesada, pide turno. `MUTANTES_SOLO="relevo|Traefik|healthy|retira"`: 6 mutantes, ~6 × 75 s en Linux |
| `bash -n` | **PASÓ** |

## RIESGOS Y LÍMITES

- **Dos web al mismo tiempo durante el relevo:** el tope es de 2 GB cada uno, `infra/dtd-cargo/compose.yml`, en `deploy.resources`. Antes de la primera publicación con esto, mirar la memoria libre del VPS (`free -m`): Chatwoot vive en la misma máquina.
- **Pedidos en vuelo al retirar el viejo:** los que Traefik todavía le mande en los ~2 s posteriores al `docker stop` pueden dar 502. El corte de antes era de ~30 s con 404 seguros. Para cerrar también esa ventana, el *health check* activo de Traefik en las etiquetas del web pide cambiar `compose.yml`, y eso frena la publicación hasta sincronizarlo en el servidor (`BLOQUEAN`). Queda como propuesta, no se hizo.
- **El nombre del contenedor cambia:** pasa a `dtd-cargo-web-2`, `-3`… Los scripts lo buscan por etiqueta. Los runbooks que dicen `docker inspect dtd-cargo-web-1` en prosa quedan viejos (FUERA DE ALCANCE).
- **Instalación:** este script se instala en el VPS con el procedimiento de solo script del runbook (sesión de Contabo, con el OK del Director General). Fusionar no lo instala.

## FUERA DE ALCANCE DETECTADO

- Runbooks con `dtd-cargo-web-1` en prosa: `publicacion-automatica-web.md` § V1 y otros.
- Health check activo de Traefik para cerrar la ventana de ~2 s, que requiere cambiar `compose.yml` y sincronizarlo en el servidor.
