import { openToken, sealToken, type SealOptions } from "@/lib/shared/signed-token";

const SEAL: SealOptions = {
  version: "o2",
  aad: "dtd-operario-session-v2",
};

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;
const CLOCK_SKEW_SECONDS = 60;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type WirePayload = {
  o: string;
  t: string;
  iat: number;
  exp: number;
};

export type OperarioSessionIdentity = {
  operarioId: string;
  tenantId: string;
};

export function isOperarioSessionSecretUsable(
  secret: string | null | undefined,
): secret is string {
  return typeof secret === "string" && secret.length >= 32;
}

export function createOperarioSessionToken(
  identity: OperarioSessionIdentity,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): string {
  if (!isOperarioSessionSecretUsable(secret)) {
    throw new Error("El secreto de sesión de operario debe tener al menos 32 caracteres.");
  }
  if (!UUID_PATTERN.test(identity.operarioId) || !UUID_PATTERN.test(identity.tenantId)) {
    throw new Error("La identidad de sesión de operario no contiene UUID válidos.");
  }

  return sealToken(
    {
      o: identity.operarioId,
      t: identity.tenantId,
      iat: nowSeconds,
      exp: nowSeconds + SESSION_MAX_AGE_SECONDS,
    } satisfies WirePayload,
    secret,
    SEAL,
  );
}

export function readOperarioSessionToken(
  token: string | null | undefined,
  secret: string | null | undefined,
  nowSeconds = Math.floor(Date.now() / 1000),
): OperarioSessionIdentity | null {
  if (!isOperarioSessionSecretUsable(secret)) return null;

  const payload = openToken<WirePayload>(token, secret, SEAL);
  if (
    !payload ||
    !UUID_PATTERN.test(payload.o) ||
    !UUID_PATTERN.test(payload.t) ||
    !Number.isInteger(payload.iat) ||
    !Number.isInteger(payload.exp) ||
    payload.iat > nowSeconds + CLOCK_SKEW_SECONDS ||
    payload.exp <= nowSeconds ||
    payload.exp - payload.iat > SESSION_MAX_AGE_SECONDS ||
    payload.exp <= payload.iat
  ) {
    return null;
  }

  return {
    operarioId: payload.o,
    tenantId: payload.t,
  };
}
