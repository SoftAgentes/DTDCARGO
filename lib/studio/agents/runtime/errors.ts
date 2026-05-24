/**
 * Errores tipados del runtime de Agentes (SDD-0020).
 *
 * Cada error mapea a un status HTTP en el endpoint /api/studio/agents/run:
 *   AgentNotFoundError    → 404
 *   AgentNotActiveError   → 409
 *   BudgetExceededError   → 409
 *   ToolNotGrantedError   → 403
 *   SkillNotFoundError    → 500 (skill instalada en DB pero no registrada en código)
 *   TimeoutError          → 504
 */

export class AgentRuntimeError extends Error {
  readonly httpStatus: number;
  constructor(message: string, httpStatus = 500) {
    super(message);
    this.name = this.constructor.name;
    this.httpStatus = httpStatus;
  }
}

export class AgentNotFoundError extends AgentRuntimeError {
  constructor(agentId: string) {
    super(`Agent no encontrado: ${agentId}`, 404);
  }
}

export class AgentNotActiveError extends AgentRuntimeError {
  constructor(currentStatus: string) {
    super(
      `El agent no está activo (status='${currentStatus}'). Activalo antes de ejecutar.`,
      409,
    );
  }
}

export class BudgetExceededError extends AgentRuntimeError {
  constructor(spendMtd: number, budget: number) {
    super(
      `Presupuesto mensual excedido: $${spendMtd.toFixed(4)} / $${budget.toFixed(2)}. El agent se pausó automáticamente.`,
      409,
    );
  }
}

export class ToolNotGrantedError extends AgentRuntimeError {
  constructor(toolKey: string, agentId: string) {
    super(
      `Tool '${toolKey}' no está autorizada para el agent ${agentId}.`,
      403,
    );
  }
}

export class SkillNotFoundError extends AgentRuntimeError {
  constructor(slug: string) {
    super(
      `Skill '${slug}' registrada en DB pero no encontrada en el código (lib/studio/agents/skills/).`,
      500,
    );
  }
}

export class TimeoutError extends AgentRuntimeError {
  constructor(ms: number) {
    super(`Run excedió el timeout de ${ms}ms.`, 504);
  }
}
