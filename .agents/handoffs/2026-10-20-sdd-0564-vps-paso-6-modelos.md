# Handoff · SDD-0564 — paso 6: modelos y llaves

| Campo | Valor |
|---|---|
| Task ID | `2026-10-20-sdd-0564-vps-paso-6-modelos` |
| Owner / sesión | Worker «Oficina Paperclip» (Claude Code) · claim `oficina-paperclip` |
| Worktree / rama | `DTD-worktrees/oficina-paperclip-vps-paso-6` · `codex/oficina-paperclip-vps-paso-6` desde `origin/main` `5af1e933` |
| SDD | [0564](../../docs/specs/0564-instalacion-piloto-paperclip-hermes/spec.md), §D5, §D6 y §D9 paso 6 |
| Estado | parcial: Codex conectado; Claude pendiente de que Sam inicie sesión; Hermes sin modelo que funcione |

## Autorizaciones y decisiones de Sam (literales)

- Arranque: «Sí, arranca el paso 6 de la SDD-0564: guíame para crear y cargar yo mismo las llaves de Z.AI (GLM) y de Anthropic con límite, y configura los topes de gasto.»
- **Cambio de A2:** «Ahora sí vamos a trabajar con Claude Code, prefiero que sea con la suscripción y no con la API.»
- **Hermes con Z.AI:** «Deseo trabajar con Hermes con z.ai. ¿Qué podemos hacer para que Hermes trabaje con z.ai? Ya tengo a alguien, un amigo que lo está haciendo, que dice que él trabaja con z.ai.»
- **OpenAI:** «Quiero conectar OpenAI. Ábreme lo mismo que hicimos ahorita con la suscripción. Tengo OpenAI.»
- **Orden:** «Por ahora solo Codex; Claude lo conecto después.»

## Qué quedó hecho

| Pieza | Estado |
|---|---|
| Cargador de llaves | `/usr/local/sbin/dtd-cargar-llave` (root, 755): Sam pega la llave a ciegas; queda en `~agentes/.config/llaves/<proveedor>.env` (600). El cargador solo imprime una huella sha256 corta |
| Llave de Z.AI | La cargó Sam (huella `9d0f8af0`, la segunda; la primera era `b9d70b1a`). Plan de Sam: «GLM Coding Pro-Quarterly», **válido** hasta 2027-01-19 |
| Llave de Anthropic | La cargó Sam (huella `60d6824c`); **válida** (`/v1/models` respondió 200 sin costo). Después de que Sam eligiera la suscripción ya no se usa |
| Claude Code | 2.1.304, fijado, para `agentes` (npm global en `~/.local`; los scripts de instalación quedaron bloqueados) |
| Codex CLI | 0.163.0, fijado, para `agentes` |
| **Codex conectado** | Con la suscripción de ChatGPT de Sam, por el flujo de Paperclip: `ai-local-logins/<id>/auth.json` (600); `codex login status` responde «Logged in using ChatGPT» |
| Hermes | `model.provider: zai`, `model.default: glm-5.3`, entrada `coding/paas/v4`, `agent.reasoning_effort: low`, y los auxiliares de títulos y compresión en `glm-5.3-flash` sobre la misma entrada |

## Lo que no funcionó

- **Z.AI con Hermes y en llamadas directas:** error **1113** («Insufficient balance or no resource
  package») con las dos llaves, en `coding/paas/v4`, `paas/v4`, `anthropic` y el sitio chino. La FAQ
  oficial de Z.AI dice que el plan **solo se usa en herramientas soportadas, con la dirección
  configurada para cada una**, y que fuera de eso no hay llamadas. No se intentó disfrazar a Hermes
  de otra herramienta: iría contra las condiciones de Z.AI.
- **GLM desde Claude Code 2.1.304:** rechaza los nombres de modelo `glm-*`
  (`claude-code:unrecognized_model`). Quedó en suspenso cuando Sam eligió la suscripción de Claude.

## Pendientes

- **Claude con la suscripción:** Sam inicia sesión desde «Connect a model» de Paperclip cuando quiera.
- **Hermes con Z.AI:** Sam le pide a su amigo la dirección, el modelo, el tipo de llave y el plan que
  usa (sin su llave). Mientras tanto, Hermes no tiene modelo que funcione.
- **Llave de Anthropic sin uso:** recomendar a Sam revocarla en la consola; con su OK se borra
  `anthropic.env` del VPS.
- **Topes de gasto:** con suscripciones, el límite es el de cada plan. El tope de Paperclip
  (100 USD con parada dura, por empresa y por agente) se configura al crear la empresa y los agentes
  en el paso 8. **NO VERIFICADO** cómo cuenta Paperclip el costo de una suscripción.
- **Codex en el paso 8:** crear sus agentes con `dangerouslyBypassApprovalsAndSandbox` apagado.
  Advertido a Sam: el aviso GHSA-gqqj-85qm-8qhf trata de los conectores de ChatGPT que hereda Codex;
  revisar que la cuenta no tenga Gmail ni otros conectados.
- **La SDD-0564 cambia:** A2 y A2-b pasan de «llave de API con límite» y «GLM principal» a
  «suscripciones de Claude y de ChatGPT (Codex)», con GLM en suspenso. Lo actualiza la spec con el
  OK del Director.

## Handoff al Director

- Sin secretos: solo huellas cortas y nombres de variables.
- Cambio de decisión con su literal de Sam, para que lo refleje la SDD-0564.
