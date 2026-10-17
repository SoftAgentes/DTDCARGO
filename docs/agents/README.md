# Agentes y Skills · guía operativa

> SDD-0020 · Plataforma agentic del Studio. Doc mínima viable —
> los detalles de arquitectura viven en `docs/specs/0020-agentes-y-skills/spec.md`.

---

## TL;DR

```
Skill (definida en código)
  └── tools_required (claves de tools del registry global)
        └── Tool handlers (read-only V1, reusan queries existentes)

Agent (instancia por tenant)
  └── instala una Skill con name + model + budget + tool grants
  └── status: off / paused / active
  └── spend_usd_mtd con auto-pause si excede budget

Run (audit append-only por ejecución)
  └── trigger: manual / cron / webhook / event
  └── input → loop tool-use (LLM + tools del registry) → output
  └── tokens, cost, latency registrados
```

---

## Estructura del código

```
lib/studio/agents/
├── runtime/
│   ├── types.ts                # ToolDef, SkillDef, LLMClient interface
│   ├── errors.ts               # AgentNotFound/Active/Budget/...
│   ├── registry.ts             # Map<tool_key, ToolDef> global
│   ├── audit.ts                # startRun / finishRun (service_role)
│   ├── policy-gates.ts         # assertToolGranted / assertBudget
│   ├── orchestrator.ts         # runAgent() end-to-end
│   ├── llm-client-anthropic.ts # Wrapper Claude real con prompt caching
│   ├── llm-client-mock.ts      # Mock determinístico (sin gastar tokens)
│   └── llm-client-factory.ts   # Switch automático mock/real
├── tools/
│   └── shipment-tools.ts       # 4 tools read-only V1
└── skills/
    └── tracking-concierge.ts   # Skill piloto + SKILLS_BY_SLUG registry

app/api/studio/agents/run/route.ts   # Endpoint POST del orchestrator
app/studio/(app)/admin/agentes/      # UI completa (catálogo + instalados + runs)
scripts/seed-agents.ts               # UPSERT skills DB ← código
```

---

## Cómo correr el orchestrator localmente

### Requisitos

`.env.local` debe tener:

```
# Servidor propio desde el corte del 2026-10-14; Cloud (xpfuzqombmjmxvprjgmi) quedó congelado.
NEXT_PUBLIC_SUPABASE_URL=https://supabase.dtdcargo.com
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...           # necesario para audit
ANTHROPIC_API_KEY=sk-ant-...            # opcional — sin esto cae al mock
LLM_FORCE_MOCK=                         # set a "1" para forzar mock
```

### Pasos

```bash
pnpm dev                       # arranca Next en :3000
# (otra terminal)
pnpm seed                      # sincroniza skills DB con código
```

Después en el browser:

1. Abrí `/studio/admin/agentes` → tab Catálogo → click skill → Instalar
2. Volvé a tab Instalados → click "Activar"
3. Click "Ejecutar" → JSON input → submit → ver output + métricas

Si todo OK, el run queda en tab Runs con tokens/cost/latency.

### Sin Anthropic key

El runtime cae al MockLLMClient: detecta códigos `S-YYYY-NNNN` o
MARKBOX `DTD-NNNN` en el campo `query` del input, invoca las tools
reales (consulta Supabase), y devuelve un mensaje hardcoded con
citations. Métricas mock con pricing de Sonnet.

Útil para desarrollar UI o validar el loop sin gastar tokens.

---

## Cómo agregar una skill nueva

### 1. Definir la skill

Crear archivo en `lib/studio/agents/skills/<slug>.ts`:

```ts
import type { SkillDef } from "../runtime/types";

export const miSkill: SkillDef = {
  slug: "mi-skill",
  name: "Mi Skill",
  description: "Qué hace, en una línea.",
  category: "tracking",                          // libre, agrupa en UI
  icon: "spark",                                  // resuelto por SkillCard
  default_model: "claude-sonnet-4-6",
  tools_required: ["tool_a", "tool_b"],          // tool_keys del registry
  input_schema: {
    type: "object",
    properties: {
      query: { type: "string", description: "..." },
    },
    required: ["query"],
  },
  output_schema: {
    type: "object",
    properties: {
      message: { type: "string" },
      citations: { type: "array", items: { type: "string" } },
    },
    required: ["message", "citations"],
  },
  system_prompt: `Sos ...

REGLAS:
- ...

FORMATO DE OUTPUT:
Devolveme un JSON con shape del output_schema.
`,
  cost_estimate_usd: 0.015,
  version: "0.1.0",
};
```

### 2. Registrarla

En el mismo archivo o en un index:

```ts
export const SKILLS_BY_SLUG: Record<string, SkillDef> = {
  [trackingConcierge.slug]: trackingConcierge,
  [miSkill.slug]: miSkill,
};
```

> V1 está hardcoded en `tracking-concierge.ts`. Cuando haya 2+ skills,
> refactorizar a `lib/studio/agents/skills/index.ts` con un map central.

### 3. Si requiere tools nuevas

Crear handlers en `lib/studio/agents/tools/<nombre>-tools.ts`:

```ts
import type { ToolDef } from "../runtime/types";

const miToolA: ToolDef<{ x: string }, { y: number }> = {
  key: "tool_a",
  description: "Qué hace y cuándo invocarla. El LLM lee esto.",
  input_schema: { type: "object", properties: { x: { type: "string" } }, required: ["x"] },
  handler: async (ctx, input) => {
    // ctx.supabase tiene RLS por tenant del operador
    const { data } = await ctx.supabase.from("...").select("...").eq("...", input.x);
    return { y: data?.length ?? 0 };
  },
};

export const MIS_TOOLS = [miToolA];
```

Agregarlas al registry en `lib/studio/agents/runtime/registry.ts`:

```ts
import { MIS_TOOLS } from "../tools/mis-tools";

const ALL_TOOLS: AnyToolDef[] = [
  ...SHIPMENT_TOOLS,
  ...(MIS_TOOLS as AnyToolDef[]),
];
```

### 4. Sembrar a DB

```bash
pnpm seed
```

La skill aparece en `/studio/admin/agentes` tab Catálogo.

---

## Cómo debuggear un run que falló

### 1. UI

Abrí `/studio/admin/agentes?tab=runs` → click en el run → ves:

- Status badge (error / timeout / needs_approval)
- Banner de error con el mensaje exacto
- Input que se mandó
- Tool calls ejecutadas (con `error: ...` por tool si una falló)

### 2. SQL directo

```sql
select id, agent_id, status, error, tool_calls, input, output,
       tokens_in, tokens_out, cost_usd, latency_ms, created_at
from agent_runs
where status in ('error', 'timeout')
order by created_at desc
limit 20;
```

### 3. Logs del server

El endpoint loggea errors no manejados a `console.error`:

```
[/api/studio/agents/run] runtime error: ...
```

Visible en `pnpm dev` stdout o en logs del deploy (Vercel/etc).

### 4. Errores comunes

| Síntoma | Causa probable |
|---|---|
| `permission denied for table agent_runs` | Falta migración 0016 (GRANT a service_role) |
| `Tool 'X' no está autorizada` | Falta row en `agent_tool_grants` para ese agent |
| `Presupuesto mensual excedido` | `spend_usd_mtd >= budget_usd_monthly`. El agent se pauseó solo. Bajar budget o reset manual. |
| `Skill 'X' registrada en DB pero no encontrada en código` | DB tiene una skill que `SKILLS_BY_SLUG` no expone. Re-sembrar o actualizar el registry de código. |
| `ANTHROPIC_API_KEY no está configurada` | Setear en `.env.local` o `LLM_FORCE_MOCK=1` para usar el mock |

---

## Seguridad

- **service_role solo para audit.** Las tools usan el cliente con JWT
  del operador — RLS preserva tenant boundaries.
- **Anti prompt-injection.** Input del usuario se envuelve en
  `<untrusted_content>` antes de mandar al LLM. El system prompt
  instruye a tratar eso como dato, no instrucción.
- **Tools read-only V1.** Aun con prompt injection exitoso, el blast
  radius máximo es revelar info de shipments (que ya es consultable
  en `/track/[code]` público). Tools de escritura llegan en SDD-0021
  con `agent_approvals` obligatorio.
- **Budget enforcement.** Cada run llama `update_agent_spend` RPC →
  auto-pause si excede budget mensual.
- **Idempotency.** Cada run puede declarar `idempotency_key`
  (UNIQUE en `agent_runs`). Webhooks que reintenten no duplican runs.

---

## Referencias

- Spec completa: [`docs/specs/0020-agentes-y-skills/spec.md`](../specs/0020-agentes-y-skills/spec.md)
- Migración base: [`supabase/migrations/0015_agents.sql`](../../supabase/migrations/0015_agents.sql)
- Fix GRANT post-validación: [`supabase/migrations/0016_agent_runs_service_role_grants.sql`](../../supabase/migrations/0016_agent_runs_service_role_grants.sql)
