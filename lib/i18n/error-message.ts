/**
 * lib/i18n/error-message.ts · Resuelve errorCode → mensaje traducido.
 *
 * Es el contrato cliente-servidor:
 *   - Server: devuelve `{ errorCode, errorParams? }` en el ActionState.
 *   - Client: lee `state.errorCode` y llama a `resolveErrorMessage(t,
 *     state)` que devuelve el string traducido (o el legacy `state.error`
 *     como fallback si el módulo todavía no migró).
 */

import { ERROR_CODE_KEY, isErrorCode, type ErrorCode } from "./error-codes";
import type { I18nKey } from "./dict";

/**
 * Shape mínimo que esperamos del ActionState.
 *
 * Compatible con todos los ActionStates del Studio:
 *   - UserActionState (legacy: solo error)
 *   - WarehouseReceiptActionState (post-migración: errorCode + error fallback)
 *   - BugActionState
 *   - cualquier action que extienda con `errorCode`/`errorParams`
 */
export interface ActionStateWithError {
  error?: string;
  errorCode?: ErrorCode | string;
  errorParams?: Record<string, string | number>;
}

/**
 * Devuelve el mensaje traducido para mostrar al usuario.
 *
 *   const t = useT();
 *   const msg = resolveErrorMessage(t, state);
 *   if (msg) {<div role="alert">{msg}</div>}
 *
 * Prioridad:
 *   1. `errorCode` válido → t(ERROR_CODE_KEY[code], errorParams)
 *   2. `error` legacy (string ya formateado) → mostrar tal cual
 *   3. null si no hay error
 */
export function resolveErrorMessage(
  t: (key: I18nKey, params?: Record<string, string | number>) => string,
  state: ActionStateWithError | null | undefined,
): string | null {
  if (!state) return null;

  if (state.errorCode && isErrorCode(state.errorCode)) {
    return t(ERROR_CODE_KEY[state.errorCode], state.errorParams);
  }

  if (state.error) return state.error;

  return null;
}
