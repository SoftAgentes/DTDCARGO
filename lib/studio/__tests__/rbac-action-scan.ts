/**
 * Analizador de gates por ACCIÓN — SDD-0500.
 *
 * El anti-drift de RBAC (`rbac-actions-guard.test.ts`) comprobaba
 * `src.includes("moduleEditDenial")` sobre el archivo entero. Eso falla en tres
 * sentidos y los tres son independientes:
 *
 *   1. **Por archivo, no por acción.** Un archivo con siete acciones gateadas y
 *      una abierta pasa en verde: así `contabilidad/actions.ts` estuvo bien
 *      mientras `setClosingDateAction` no tenía candado (SDD-0498).
 *   2. **Sólo abría `actions.ts` exacto.** Los `<algo>-actions.ts` no los miraba
 *      nadie; ahí vivía el borrado sin gate de `document-actions.ts`.
 *   3. **Guard EN el archivo, no ANTES de la escritura.** Un `moduleEditDenial`
 *      en la acción de al lado ya daba verde.
 *
 * El (3) no se cierra con un grep por fino que sea: hace falta el AST y una
 * noción de dominancia. Este módulo la implementa de forma **conservadora**:
 * un guard sólo cuenta si está en una posición del cuerpo que se ejecuta SÍ O SÍ
 * antes del primer acceso a datos. Un guard dentro de un `if`, de un `try`, de
 * una rama de `?:`, del lado derecho de un `&&` o dentro de un callback NO
 * cuenta — porque no domina. La asimetría es deliberada: los guards se cuentan
 * sólo donde son incondicionales, los accesos se cuentan en todas partes.
 *
 * Vive en `__tests__/` porque es maquinaria de contrato, no producto: nada de
 * `app/` ni de `lib/studio/` lo importa en runtime.
 */

import ts from "typescript";

/**
 * Guards de `rbac-guard.ts` que valen como candado de EDICIÓN. Todos resuelven
 * el rol por `getStudioAccess`, o sea con el filtro `disabled_at` de la 0200.
 *
 * `moduleViewDenial` va aparte, en `VIEW_GUARDS`: alcanza para una acción que
 * sólo LEE —es el gate que SDD-0497 le puso a los lectores del Studio— pero no
 * habilita una escritura. Una acción que lee con gate de vista y después muta
 * necesita igual el de edición antes de la mutación.
 */
export const EDIT_GUARDS = [
  "moduleEditDenial",
  "moduleEditGate",
  "tenantAdminGate",
  "capabilityDenial",
] as const;

/** Gates de VISTA: suficientes para una acción de sólo lectura, nunca para mutar. */
export const VIEW_GUARDS = ["moduleViewDenial"] as const;

const EDIT_SET: ReadonlySet<string> = new Set(EDIT_GUARDS);
const VIEW_SET: ReadonlySet<string> = new Set(VIEW_GUARDS);

/** Métodos de PostgREST que escriben. `rpc` va aparte y también cuenta como escritura. */
const TABLE_WRITE: ReadonlySet<string> = new Set(["insert", "update", "upsert", "delete"]);
/** Métodos de PostgREST que sólo leen. */
const TABLE_READ: ReadonlySet<string> = new Set(["select"]);

/** Métodos del Storage que mutan el bucket. `remove` no es borrado lógico. */
const STORAGE_WRITE: ReadonlySet<string> = new Set([
  "upload",
  "uploadToSignedUrl",
  "update",
  "remove",
  "move",
  "copy",
  "createSignedUploadUrl",
  "empty",
]);
const STORAGE_READ: ReadonlySet<string> = new Set([
  "download",
  "list",
  "createSignedUrl",
  "createSignedUrls",
  "getPublicUrl",
  "info",
  "exists",
]);

/**
 * Objetos del lenguaje con un `.from()` que NO es la base de datos. Sin esta
 * lista, `Array.from(...)` contaría como acceso y el contrato mentiría en la
 * dirección cara: marcaría en rojo a una acción gateada.
 */
const NOT_A_TABLE: ReadonlySet<string> = new Set([
  "Array",
  "Buffer",
  "Object",
  "Date",
  "Number",
  "String",
  "Set",
  "Map",
  "WeakMap",
  "WeakSet",
  "Promise",
  "Uint8Array",
  "Int8Array",
  "Float64Array",
  "BigInt",
  "Blob",
]);

/**
 * Operaciones de `auth` sobre la sesión de QUIEN LLAMA: no son datos de negocio
 * y el propio guard hace `getUser()` por dentro. Todo lo demás bajo `auth`
 * —`updateUser`, `admin.*`— sí muta y cuenta como escritura.
 */
const AUTH_SESSION: ReadonlySet<string> = new Set([
  "getUser",
  "getSession",
  "getClaims",
  "refreshSession",
  "signOut",
]);

export type AccessKind = "read" | "write";

export interface DataAccess {
  kind: AccessKind;
  /** Texto corto para el mensaje de error, p. ej. `supabase.from(…).insert`. */
  label: string;
  line: number;
  /** Offset en el archivo. La comparación va por acá y NO por `line`: un guard
   *  y un acceso pueden compartir línea, y ahí «después» sólo lo dice el offset. */
  pos: number;
}

export interface GuardCall {
  name: string;
  /** `edit` habilita mutaciones; `view` sólo lecturas. */
  clase: GuardClass;
  line: number;
  /** Offset en el archivo; ver `DataAccess.pos`. */
  pos: number;
  /** El guard llega a través de un helper local del archivo (p. ej. `resolveTenantAdmin`). */
  viaHelper: string | null;
}

export interface ActionReport {
  name: string;
  line: number;
  /** Primer guard INCONDICIONAL del cuerpo (de cualquier clase), o null. */
  guard: GuardCall | null;
  /** Primer guard INCONDICIONAL de clase `edit`, o null. */
  editGuard: GuardCall | null;
  /** Primer acceso a datos del cuerpo, o null si no se detectó ninguno. */
  firstAccess: DataAccess | null;
  /** Primera ESCRITURA del cuerpo, o null si la acción sólo lee. */
  firstWrite: DataAccess | null;
  /** El guard domina el primer acceso (o no hay acceso y sí hay guard). */
  gated: boolean;
  /** Por qué NO está gateada, en es-VE. `null` si lo está. */
  problem: string | null;
}

type FnLike = ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression;

const lineOf = (sf: ts.SourceFile, node: ts.Node): number =>
  sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;

const posOf = (sf: ts.SourceFile, node: ts.Node): number => node.getStart(sf);

/** ¿El nodo lleva ese modificador? (`export`, `async`, …) */
function hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
  const mods = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
  return (mods ?? []).some((m) => m.kind === kind);
}

/** Nombre del identificador más a la izquierda de una cadena `a.b.c(...)`. */
function leftmostName(expr: ts.Expression): string | null {
  let node: ts.Node = expr;
  while (true) {
    if (ts.isIdentifier(node)) return node.text;
    if (ts.isPropertyAccessExpression(node)) node = node.expression;
    else if (ts.isCallExpression(node)) node = node.expression;
    else if (ts.isAwaitExpression(node)) node = node.expression;
    else if (ts.isParenthesizedExpression(node)) node = node.expression;
    else if (ts.isNonNullExpression(node)) node = node.expression;
    else return null;
  }
}

/** ¿La cadena `a.b.c` contiene ese nombre como propiedad o como raíz? */
function chainHas(expr: ts.Expression, name: string): boolean {
  let node: ts.Node = expr;
  while (true) {
    if (ts.isIdentifier(node)) return node.text === name;
    if (ts.isPropertyAccessExpression(node)) {
      if (node.name.text === name) return true;
      node = node.expression;
    } else if (ts.isCallExpression(node)) node = node.expression;
    else if (ts.isAwaitExpression(node)) node = node.expression;
    else if (ts.isParenthesizedExpression(node)) node = node.expression;
    else if (ts.isNonNullExpression(node)) node = node.expression;
    else return false;
  }
}

/**
 * Clasifica un `X.from(tabla)` mirando el método encadenado hacia AFUERA:
 * `supabase.from("t").select()` es lectura, `.insert()` escritura. Sin método
 * reconocible se asume escritura — ante la duda, el criterio más restrictivo.
 */
function kindOfTableChain(fromCall: ts.CallExpression): { kind: AccessKind; method: string } {
  let node: ts.Node = fromCall;
  // Sube por `.metodo` / `.metodo(...)` mientras el nodo actual sea el receptor.
  for (let hops = 0; hops < 12; hops++) {
    const parent: ts.Node | undefined = node.parent;
    if (!parent || !ts.isPropertyAccessExpression(parent) || parent.expression !== node) break;
    const method = parent.name.text;
    if (TABLE_WRITE.has(method)) return { kind: "write", method };
    if (TABLE_READ.has(method)) return { kind: "read", method };
    node = parent;
    const call: ts.Node | undefined = node.parent;
    if (call && ts.isCallExpression(call) && call.expression === node) node = call;
  }
  return { kind: "write", method: "?" };
}

/**
 * ¿Esta llamada es un acceso a datos? Devuelve su clase, o null si no lo es.
 * Sólo mira llamadas DIRECTAS al cliente de Supabase; los helpers locales del
 * archivo los resuelve `scanFunction`, y los de otros módulos son el límite
 * declarado del analizador (ver la spec).
 */
function accessOfCall(call: ts.CallExpression, sf: ts.SourceFile): DataAccess | null {
  const callee = call.expression;
  if (!ts.isPropertyAccessExpression(callee)) return null;
  const method = callee.name.text;
  const receiver = callee.expression;
  const line = lineOf(sf, call);
  const pos = posOf(sf, call);

  // `supabase.storage.from(bucket).upload(...)` — el acceso es el método del
  // bucket, no el `.from` que sólo devuelve el handle.
  if (chainHas(callee, "storage")) {
    if (method === "from") return null;
    if (STORAGE_WRITE.has(method)) return { kind: "write", label: `storage…${method}`, line, pos };
    if (STORAGE_READ.has(method)) return { kind: "read", label: `storage…${method}`, line, pos };
    return null;
  }

  if (method === "from") {
    const root = leftmostName(receiver);
    if (root && NOT_A_TABLE.has(root)) return null;
    const { kind, method: chained } = kindOfTableChain(call);
    const tabla = call.arguments[0];
    const nombre = tabla && ts.isStringLiteralLike(tabla) ? tabla.text : "…";
    return { kind, label: `from("${nombre}").${chained}`, line, pos };
  }

  // Una RPC puede escribir; se cuenta como escritura por conservadurismo.
  if (method === "rpc") {
    const arg = call.arguments[0];
    const nombre = arg && ts.isStringLiteralLike(arg) ? arg.text : "…";
    return { kind: "write", label: `rpc("${nombre}")`, line, pos };
  }

  // Bajo `auth`, la sesión propia no es negocio y todo lo demás sí muta:
  // `admin.*` administra usuarios y `updateUser` cambia credenciales. El default
  // es escritura a propósito — la lista de exentas es la que hay que defender,
  // no al revés.
  if (chainHas(callee, "auth")) {
    if (AUTH_SESSION.has(method)) return null;
    const prefijo = chainHas(callee, "admin") ? "auth.admin" : "auth";
    return { kind: "write", label: `${prefijo}.${method}`, line, pos };
  }

  return null;
}

export type GuardClass = "edit" | "view";

/**
 * ¿Esta llamada es a un guard de `rbac-guard.ts`, y de qué clase?
 * Acepta `moduleEditDenial(...)` y `guards.moduleEditDenial(...)`.
 */
function guardOfCall(call: ts.CallExpression): { name: string; clase: GuardClass } | null {
  const callee = call.expression;
  const nombre = ts.isIdentifier(callee)
    ? callee.text
    : ts.isPropertyAccessExpression(callee)
      ? callee.name.text
      : null;
  if (!nombre) return null;
  if (EDIT_SET.has(nombre)) return { name: nombre, clase: "edit" };
  if (VIEW_SET.has(nombre)) return { name: nombre, clase: "view" };
  return null;
}

/** Nodos cuyo cuerpo se ejecuta más tarde o sólo a veces: un guard adentro no domina. */
function isFunctionLike(node: ts.Node): boolean {
  return (
    ts.isArrowFunction(node) ||
    ts.isFunctionExpression(node) ||
    ts.isFunctionDeclaration(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isClassDeclaration(node)
  );
}

/**
 * Recorre en orden de fuente visitando SÓLO lo que se ejecuta sí o sí.
 *
 * Se saltan: cuerpos de `if`/`else`, cuerpos de bucles, `switch`, `try` entero,
 * ramas de `?:`, lado derecho de `&&`/`||`/`??` y cualquier cuerpo de función.
 * La CONDICIÓN de un `if` sí se visita: `if (await moduleEditDenial(…)) return`
 * es un candado que domina.
 *
 * `visit` devuelve `true` para cortar el recorrido.
 */
function walkUnconditional(node: ts.Node, visit: (n: ts.Node) => boolean): boolean {
  let stopped = false;
  const step = (child: ts.Node): void => {
    if (stopped) return;
    if (visit(child)) {
      stopped = true;
      return;
    }
    descend(child);
  };

  const descend = (n: ts.Node): void => {
    if (stopped) return;
    if (isFunctionLike(n)) return;
    // El `try` SÍ se recorre: un guard al tope de su bloque domina el resto del
    // bloque igual que en el cuerpo de la función, y es un patrón real del repo
    // (`facturacion/payment-report-actions.ts`). Lo que NO se recorre es el
    // `catch` ni el `finally`: ahí se llega precisamente cuando algo se rompió
    // antes, y el guard pudo no haber terminado.
    if (ts.isTryStatement(n)) {
      step(n.tryBlock);
      return;
    }
    if (ts.isIfStatement(n)) {
      step(n.expression);
      return;
    }
    if (ts.isSwitchStatement(n)) {
      step(n.expression);
      return;
    }
    if (
      ts.isForStatement(n) ||
      ts.isForInStatement(n) ||
      ts.isForOfStatement(n) ||
      ts.isWhileStatement(n) ||
      ts.isDoStatement(n)
    ) {
      return;
    }
    if (ts.isConditionalExpression(n)) {
      step(n.condition);
      return;
    }
    if (ts.isBinaryExpression(n)) {
      const op = n.operatorToken.kind;
      if (
        op === ts.SyntaxKind.AmpersandAmpersandToken ||
        op === ts.SyntaxKind.BarBarToken ||
        op === ts.SyntaxKind.QuestionQuestionToken
      ) {
        step(n.left);
        return;
      }
    }
    ts.forEachChild(n, step);
  };

  descend(node);
  return stopped;
}

/** Recorre TODO el subárbol en orden de fuente, incluidos condicionales y callbacks. */
function walkAll(node: ts.Node, visit: (n: ts.Node) => boolean): boolean {
  let stopped = false;
  const step = (child: ts.Node): void => {
    if (stopped) return;
    if (visit(child)) {
      stopped = true;
      return;
    }
    ts.forEachChild(child, step);
  };
  ts.forEachChild(node, step);
  return stopped;
}

interface Local {
  name: string;
  fn: FnLike;
}

/** Funciones declaradas en el módulo, por nombre — para resolver helpers locales. */
function collectLocals(sf: ts.SourceFile): Map<string, FnLike> {
  const out = new Map<string, FnLike>();
  for (const stmt of sf.statements) {
    if (ts.isFunctionDeclaration(stmt) && stmt.name && stmt.body) {
      out.set(stmt.name.text, stmt);
    } else if (ts.isVariableStatement(stmt)) {
      for (const d of stmt.declarationList.declarations) {
        if (!ts.isIdentifier(d.name) || !d.initializer) continue;
        if (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer)) {
          out.set(d.name.text, d.initializer);
        }
      }
    }
  }
  return out;
}

/** El helper local llamado por esta expresión, si lo hay. */
function localCallee(call: ts.CallExpression, locals: Map<string, FnLike>): Local | null {
  const callee = call.expression;
  if (!ts.isIdentifier(callee)) return null;
  const fn = locals.get(callee.text);
  return fn ? { name: callee.text, fn } : null;
}

/**
 * ¿El helper local tiene un guard incondicional antes de cualquier acceso suyo?
 * Es lo que hace que `resolveTenantAdmin(supabase)` de `carrier-actions.ts`
 * cuente como candado: envuelve a `tenantAdminGate` y corta con su `ok`.
 */
function helperProvidesGuard(
  fn: FnLike,
  locals: Map<string, FnLike>,
  seen: Set<FnLike>,
  clase: GuardClass | null,
): { name: string; clase: GuardClass } | null {
  if (!fn.body || seen.has(fn)) return null;
  seen.add(fn);
  let found: { name: string; clase: GuardClass } | null = null;
  walkUnconditional(fn.body, (n) => {
    if (!ts.isCallExpression(n)) return false;
    const g = guardOfCall(n);
    if (g && (clase === null || g.clase === clase)) {
      found = g;
      return true;
    }
    const local = localCallee(n, locals);
    if (local) {
      const nested = helperProvidesGuard(local.fn, locals, seen, clase);
      if (nested) {
        found = nested;
        return true;
      }
    }
    return false;
  });
  return found;
}

/** ¿El helper local toca datos? (para contar su llamada como acceso). */
function helperAccess(
  fn: FnLike,
  sf: ts.SourceFile,
  locals: Map<string, FnLike>,
  seen: Set<FnLike>,
  soloEscritura: boolean,
): DataAccess | null {
  if (!fn.body || seen.has(fn)) return null;
  seen.add(fn);
  let found: DataAccess | null = null;
  walkAll(fn.body, (n) => {
    if (!ts.isCallExpression(n)) return false;
    const a = accessOfCall(n, sf);
    if (a && (!soloEscritura || a.kind === "write")) {
      found = a;
      return true;
    }
    const local = localCallee(n, locals);
    if (local) {
      const nested = helperAccess(local.fn, sf, locals, seen, soloEscritura);
      if (nested) {
        found = nested;
        return true;
      }
    }
    return false;
  });
  return found;
}

/**
 * Analiza el cuerpo de una acción exportada contra DOS reglas:
 *
 *   A. un guard incondicional de cualquier clase domina el PRIMER acceso;
 *   B. si la acción escribe, un guard de clase `edit` domina la PRIMERA
 *      escritura.
 *
 * Son dos porque fallan por caminos distintos. Con una sola regla «hay guard
 * antes del primer acceso», una acción que lee con `moduleViewDenial` y después
 * muta quedaría en verde: el gate de vista domina la lectura y la escritura no
 * la mira nadie. Y exigir siempre `edit` pondría en rojo a los lectores que
 * SDD-0497 gateó con vista a propósito.
 */
function scanFunction(
  name: string,
  fn: FnLike,
  sf: ts.SourceFile,
  locals: Map<string, FnLike>,
): ActionReport {
  const line = lineOf(sf, fn);
  const base: ActionReport = {
    name,
    line,
    guard: null,
    editGuard: null,
    firstAccess: null,
    firstWrite: null,
    gated: false,
    problem: null,
  };
  if (!fn.body) return { ...base, problem: "no tiene cuerpo" };

  /** Primer guard INCONDICIONAL, directo o a través de un helper local. */
  const buscarGuard = (clase: GuardClass | null): GuardCall | null => {
    let out: GuardCall | null = null;
    walkUnconditional(fn.body!, (n) => {
      if (!ts.isCallExpression(n)) return false;
      const directo = guardOfCall(n);
      if (directo && (clase === null || directo.clase === clase)) {
        out = { ...directo, line: lineOf(sf, n), pos: posOf(sf, n), viaHelper: null };
        return true;
      }
      const local = localCallee(n, locals);
      if (local) {
        const via = helperProvidesGuard(local.fn, locals, new Set(), clase);
        if (via) {
          // La línea es la del CALL SITE: es ahí donde el candado corre. Si se
          // reportara la del helper —que suele estar arriba— el guard parecería
          // anterior a cualquier acceso de cualquier acción del archivo.
          out = { ...via, line: lineOf(sf, n), pos: posOf(sf, n), viaHelper: local.name };
          return true;
        }
      }
      return false;
    });
    return out;
  };

  /** Primer acceso (o primera escritura, con `soloEscritura`), mire donde mire. */
  const buscarAcceso = (soloEscritura: boolean): DataAccess | null => {
    let out: DataAccess | null = null;
    walkAll(fn.body!, (n) => {
      if (!ts.isCallExpression(n)) return false;
      const directo = accessOfCall(n, sf);
      if (directo && (!soloEscritura || directo.kind === "write")) {
        out = directo;
        return true;
      }
      const local = localCallee(n, locals);
      if (local) {
        const via = helperAccess(local.fn, sf, locals, new Set(), soloEscritura);
        if (via) {
          out = { ...via, line: lineOf(sf, n), pos: posOf(sf, n), label: `${local.name}→${via.label}` };
          return true;
        }
      }
      return false;
    });
    return out;
  };

  const guard = buscarGuard(null);
  const editGuard = buscarGuard("edit");
  const firstAccess = buscarAcceso(false);
  const firstWrite = buscarAcceso(true);
  const con = { ...base, guard, editGuard, firstAccess, firstWrite };

  // Regla A — un candado antes de tocar datos.
  if (!guard) {
    return {
      ...con,
      problem: firstAccess
        ? `toca datos (${firstAccess.label}, línea ${firstAccess.line}) sin ningún guard incondicional`
        : "no llama a ningún guard incondicional",
    };
  }
  if (firstAccess && guard.pos > firstAccess.pos) {
    return {
      ...con,
      problem:
        `el guard ${guard.name} está en la línea ${guard.line}, DESPUÉS del primer acceso ` +
        `(${firstAccess.label}, línea ${firstAccess.line}): no lo domina`,
    };
  }

  // Regla B — un candado de EDICIÓN antes de escribir.
  if (firstWrite) {
    if (!editGuard) {
      return {
        ...con,
        problem:
          `escribe (${firstWrite.label}, línea ${firstWrite.line}) con un guard de VISTA ` +
          `(${guard.name}): un gate de vista no habilita una mutación`,
      };
    }
    if (editGuard.pos > firstWrite.pos) {
      return {
        ...con,
        problem:
          `el guard de edición ${editGuard.name} está en la línea ${editGuard.line}, DESPUÉS de la ` +
          `primera escritura (${firstWrite.label}, línea ${firstWrite.line}): no la domina`,
      };
    }
  }

  return { ...con, gated: true };
}

/**
 * Acciones exportadas del archivo, con su veredicto.
 *
 * «Acción» = función `async` exportada del módulo, que es la única forma que un
 * archivo `"use server"` admite (un `export const` ahí rompe `next build`). Se
 * aceptan también las flechas exportadas para que el analizador no dependa de
 * esa regla del framework.
 */
export function scanActionsFile(source: string, fileName = "actions.ts"): ActionReport[] {
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const locals = collectLocals(sf);
  const out: ActionReport[] = [];

  for (const stmt of sf.statements) {
    if (!hasModifier(stmt, ts.SyntaxKind.ExportKeyword)) continue;

    if (ts.isFunctionDeclaration(stmt) && stmt.name && stmt.body) {
      if (!hasModifier(stmt, ts.SyntaxKind.AsyncKeyword)) continue;
      out.push(scanFunction(stmt.name.text, stmt, sf, locals));
      continue;
    }

    if (ts.isVariableStatement(stmt)) {
      for (const d of stmt.declarationList.declarations) {
        if (!ts.isIdentifier(d.name) || !d.initializer) continue;
        const init = d.initializer;
        if (!ts.isArrowFunction(init) && !ts.isFunctionExpression(init)) continue;
        if (!hasModifier(init, ts.SyntaxKind.AsyncKeyword)) continue;
        out.push(scanFunction(d.name.text, init, sf, locals));
      }
    }
  }

  return out;
}
