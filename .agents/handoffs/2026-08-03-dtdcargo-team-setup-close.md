# Handoff · Cuenta Claude del equipo de oficina (CRM + marketing)

- **Fecha:** 2026-08-03
- **Rama:** `claude/dtdcargo-team-setup-50230d`
- **Worktree:** `C:/Users/Trabajo/Desktop/Claude/DTDCargo/dtdcargo-team-setup-50230d`
- **Rol:** worker
- **Tiempo / tokens:** n/a (la plataforma no los expone)

## Alcance

Configurar la segunda cuenta de Claude —la del personal de oficina, que atiende Kommo y
marketing— y dejarle el contexto de DTD Cargo cargado.

Cuenta: `doortudoorservices@gmail.com` (Plan Pro). Proyecto: `DTD Cargo · CRM y Marketing`.

**Fuera del repo** (hecho vía navegador, no versionable): memoria activada, entrenamiento
de modelos apagado, instrucciones de cuenta y de proyecto, 7 documentos de conocimiento
cargados, 5 skills instaladas. Los conectores (Gmail, Drive, Calendar, Canva) los enlazó
el founder.

## Rutas propias

```
equipo-crm/00-INSTRUCCIONES-PROYECTO.md      (nuevo)
equipo-crm/01-servicios-y-cotizacion.md      (nuevo)
equipo-crm/02-respuestas-CRM.md              (nuevo)
equipo-crm/03-el-ERP-por-dentro.md           (nuevo)
equipo-crm/04-la-web-publica.md              (nuevo)
equipo-crm/05-reglas-y-limites.md            (nuevo)
equipo-crm/06-marca-para-piezas.md           (nuevo)
equipo-crm/README.md                         (nuevo, luego editado)
docs/runbooks/setup-asistente-equipo-crm.md  (nuevo)
```

`equipo-crm/DTDCARGO-baterias-CRM.md` ya existía; no se tocó.

## Verificación

| Qué | Resultado |
|---|---|
| Rutas públicas contra `next.config.ts` | ✅ `/calculadora`, `/estimacion`, `/cotizar` → 301 a `/tarifas`. Los docs de marketing todavía citan las viejas. |
| Servicios contra `lib/shared/shipment-public.ts` | ✅ los 5, con los nombres visibles vigentes |
| Módulos contra `lib/studio/modules.ts` | ✅ 57 (19 + 13 + 12 + 3 + 10) |
| Gate de deploy (comando real de `vercel.json`) | ⚠️ **SÍ despliega** — ver hallazgo abajo |
| Prueba funcional en la cuenta | ✅ caso "DDP 3 m³ a Maracaibo + powerbanks": corrigió el término, no inventó precio, mandó a `/tarifas`, escaló a Operaciones, tuteo correcto |

Sin tests automatizados: el cambio es 100% markdown, no toca código. No se corrió el gate
completo a propósito — hay 31 worktrees activos y correrlo sería desproporcionado.

## Hallazgos

1. 🔴 **El `ignoreCommand` de `vercel.json` excluye `*.md` sólo en la RAÍZ.** El
   `:(glob)` impide que `*` cruce barras, así que un commit 100% markdown **sí despliega**
   si los archivos viven fuera de `docs/`. Verificado con `e6527476` (8 `.md` en
   `equipo-crm/`). Es inofensivo —reconstruye el mismo sitio— pero invalida la intuición
   "doc-only no despliega". Complementa el caso inverso ya documentado en `AGENTS.md`.
2. ⚠️ **Los docs de `docs/marketing/` citan rutas muertas** (`/calculadora`,
   `/estimacion`). Redirigen, así que nada se rompe, pero quien copie de ahí propaga la
   ruta vieja. No se corrigió: fuera del alcance de esta tarea.
3. ⛔ **`pnpm marketing:reader` no se comparte con el equipo.** Embebe los 19 docs de
   `docs/marketing/` sin filtrar, incluidos `manual-vendedores-peso.md` (topes internos),
   `competencia-precios.md` y `prospectos-ancla.md`. Para que el equipo lea marketing ya
   existe **Studio › Marketing › Documentos**, que sí tiene RBAC.
4. ⛔ **Kommo y Higgsfield no tienen conector en claude.ai** (verificado en el directorio).
   Canva, Gmail, Drive y Calendar sí. Para Kommo, la vía sin desarrollo es el módulo
   Kommo del Studio (SDD-0043) con su pestaña Recuperación.
5. ⛔ **No instalar la skill `/brand-guidelines`**: aplica la marca de Anthropic, no la de
   DTD.

## Commits

| Hash | Qué |
|---|---|
| `e6527476` | `docs(equipo-crm): paquete de contexto para la cuenta CRM del equipo` |
| `44e14500` | `docs(runbooks): alta de una persona en el asistente del equipo` |
| `cba1f052` | merge de `origin/main` tras choque non-fast-forward con `crm-mcp-connection` |

## Push

Los tres publicados en `origin/main`. Verificado con `git merge-base --is-ancestor`: los
tres están contenidos, y los 10 archivos aparecen en `git ls-tree origin/main`.

Al cerrar, la rama quedó **2 commits por detrás** de `origin/main` (otras ventanas
empujaron después) y **0 por delante**. No se hizo merge durante el cierre.

## Migraciones / deploy

Ninguna migración. Producción no se tocó: el cambio no altera código de aplicación,
aunque el gate dispare un build.

## Bloqueos

Ninguno para esta tarea.

## Siguiente responsable

**Founder.** Queda un solo paso manual: pasarle al equipo el enlace `dtdcargo.com/marca`.
Quien tenga usuario del Studio entra sin código; para el resto, el código se pone en
**Studio › Marketing › HUB de marca**.

Procedimiento completo de alta en
[`docs/runbooks/setup-asistente-equipo-crm.md`](../../docs/runbooks/setup-asistente-equipo-crm.md).

⚠️ **Mantenimiento:** los 7 documentos derivan de fuentes vivas del repo
(`lib/shared/shipment-public.ts`, `lib/studio/modules.ts`, `next.config.ts`,
`docs/marketing/`). No se sincronizan solos: si cambia un servicio, un módulo o una ruta,
hay que editar el `.md` en `equipo-crm/` y volver a subirlo al proyecto.
