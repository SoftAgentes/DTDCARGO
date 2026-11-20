import type { ReactNode } from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clarityIdFromEnv } from "@/lib/clarity";

/**
 * Microsoft Clarity · fase 1 (código apagado). Mide:
 *  · la variable de entorno: ausente, vacía, espacios, `off` o con forma
 *    inválida ⇒ nada; sin ID de respaldo;
 *  · la guarda: la de GA + `/registro`, `/entrar`, `/abrir`;
 *  · el snippet: respeta la guarda en el momento de ejecutarse y encola la
 *    señal de consentimiento leída de la cookie exacta;
 *  · el consentimiento en caliente (`consentv2` al aceptar, `consent false` al
 *    revocar);
 *  · el corte de frontera público → privado (clic y red de seguridad).
 *
 * `CLARITY_ID` se calcula al importar el módulo: cada caso fija el entorno y
 * vuelve a importar `./Clarity` desde cero.
 */

const nav = vi.hoisted(() => ({ pathname: "/servicios", search: "" }));

vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(nav.search),
}));

vi.mock("next/script", () => ({
  default: ({ id, children }: { id?: string; children?: ReactNode }) => (
    <span data-clarity-script="true" id={id}>
      {children}
    </span>
  ),
}));

const FAKE_ID = "synthetic00";

async function cargar(id: string | undefined) {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_CLARITY_ID", id);
  return import("./Clarity");
}

function irA(path: string) {
  const url = new URL(path, window.location.origin);
  nav.pathname = url.pathname;
  nav.search = url.search;
  window.history.replaceState({}, "", path);
}

function borrarCookies() {
  for (const cookie of document.cookie.split(";")) {
    const name = cookie.split("=")[0]?.trim();
    if (name) document.cookie = `${name}=; path=/; max-age=0`;
  }
}

let originalPush: History["pushState"];
let originalReplace: History["replaceState"];

beforeEach(() => {
  originalPush = window.history.pushState;
  originalReplace = window.history.replaceState;
  borrarCookies();
  irA("/servicios");
  delete window.clarity;
  delete window.__dtdClarityAllowed;
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  window.history.pushState = originalPush;
  window.history.replaceState = originalReplace;
  document.querySelectorAll("script[src*='clarity.ms']").forEach((el) => el.remove());
  borrarCookies();
  delete window.clarity;
  delete window.__dtdClarityAllowed;
});

describe("NEXT_PUBLIC_CLARITY_ID", () => {
  it.each([
    ["ausente", undefined],
    ["vacía", ""],
    ["solo espacios", "   "],
    ["off", "off"],
    ["OFF", "OFF"],
    [" off con espacios", "  off "],
    ["con comillas", "abc123'</script>"],
    ["demasiado corta", "abc"],
    ["con guiones", "abc-123-def"],
  ])("%s ⇒ apagado", (_caso, raw) => {
    expect(clarityIdFromEnv(raw)).toBe("");
  });

  it("un ID con forma válida se conserva (recortado)", () => {
    expect(clarityIdFromEnv(`  ${FAKE_ID} `)).toBe(FAKE_ID);
  });

  it.each([undefined, "", "   ", "off"])(
    "con %j no se renderiza nada ni se instala ningún listener",
    async (raw) => {
      const { Clarity } = await cargar(raw);
      const { container } = render(<Clarity />);
      expect(container.innerHTML).toBe("");
      expect(window.history.pushState).toBe(originalPush);
      expect(window.__dtdClarityAllowed).toBeUndefined();
    },
  );

  it("el código no trae un ID de respaldo", async () => {
    const fs = await import("node:fs");
    const source = fs.readFileSync("components/Clarity.tsx", "utf8");
    // La única fuente del ID es la variable de entorno.
    expect(source).toMatch(/clarityIdFromEnv\(process\.env\.NEXT_PUBLIC_CLARITY_ID\)/);
    expect(source).not.toMatch(/NEXT_PUBLIC_CLARITY_ID\s*(\?\?|\|\|)/);
  });
});

describe("guarda de rutas", () => {
  it.each([
    "/",
    "/servicios",
    "/tarifas",
    "/fcl",
    "/noticias/algo",
    "/track",
    "/servicios?utm_source=ig&utm_campaign=nov",
    "/marcas",
    "/portales",
  ])("%s es pública", async (path) => {
    const { isClarityExcludedHref } = await cargar(FAKE_ID);
    expect(isClarityExcludedHref(path, "https://dtdcargo.com")).toBe(false);
  });

  it.each([
    "/portal",
    "/portal/envios/DTD-0001",
    "/studio",
    "/m",
    "/m/erp",
    "/back",
    "/invitar/tok",
    "/acceso/tok",
    "/entrar",
    "/entrar/codigo",
    "/abrir?token_hash=SYNTHETIC&type=magiclink",
    "/registro",
    "/registro/link/tok",
    "/registro/correo/tok",
    "/cotizador",
    "/cotizador?utm_source=ig",
    "/cotizador/algo",
    "/verificar?c=ABC",
    "/p/tok",
    "/interno",
    "/marca",
    "/tarifas/embed",
    "/fcl/embed",
    "/track/DTD-0001",
    "/servicios?email=SYNTHETIC",
    "/servicios?est=EST-1",
    "/servicios#access_token=SYNTHETIC",
  ])("%s está excluida", async (path) => {
    const { isClarityExcludedHref } = await cargar(FAKE_ID);
    expect(isClarityExcludedHref(path, "https://dtdcargo.com")).toBe(true);
  });

  it("una URL ilegible cuenta como excluida", async () => {
    const { isClarityExcludedHref } = await cargar(FAKE_ID);
    expect(isClarityExcludedHref("")).toBe(true);
    expect(isClarityExcludedHref("no es una url")).toBe(true);
  });
});

describe("render (carga sin cookies hasta el consentimiento)", () => {
  it.each([
    ["sin decisión", null],
    ["con denied", "dtd_cookie_consent=denied"],
    ["con granted", "dtd_cookie_consent=granted"],
  ])("en una página pública %s carga el snippet con el ID", async (_caso, cookie) => {
    if (cookie) document.cookie = `${cookie}; path=/`;
    const { Clarity } = await cargar(FAKE_ID);
    const { container } = render(<Clarity />);
    const script = container.querySelector("[data-clarity-script]");
    expect(script?.id).toBe("clarity-init");
    expect(script?.textContent).toContain(`'${FAKE_ID}'`);
    expect(script?.textContent).not.toContain("identify");
  });

  it.each(["/portal", "/registro", "/entrar", "/cotizador", "/abrir?token_hash=SYNTHETIC", "/servicios?email=x"])(
    "en %s no carga nada aunque haya granted",
    async (path) => {
      document.cookie = "dtd_cookie_consent=granted; path=/";
      irA(path);
      const { Clarity } = await cargar(FAKE_ID);
      const { container } = render(<Clarity />);
      expect(container.querySelector("[data-clarity-script]")).toBeNull();
    },
  );

  it("con un fragmento sensible no carga nada", async () => {
    window.history.replaceState({}, "", "/servicios#access_token=SYNTHETIC");
    const { Clarity } = await cargar(FAKE_ID);
    const { container } = render(<Clarity />);
    expect(container.querySelector("[data-clarity-script]")).toBeNull();
  });
});

describe("snippet", () => {
  function ejecutar(snippet: string) {
    // Un <script> previo: el snippet oficial inserta la etiqueta antes del primero.
    if (!document.querySelector("script")) document.head.append(document.createElement("script"));
    new Function(snippet)();
  }

  it("sin permiso de la guarda no define clarity ni inserta la etiqueta", async () => {
    const { buildClaritySnippet } = await cargar(FAKE_ID);
    window.__dtdClarityAllowed = () => false;
    ejecutar(buildClaritySnippet(FAKE_ID));
    expect(window.clarity).toBeUndefined();
    expect(document.querySelector("script[src*='clarity.ms']")).toBeNull();
  });

  it("sin la función de guarda tampoco hace nada (falla cerrado)", async () => {
    const { buildClaritySnippet } = await cargar(FAKE_ID);
    ejecutar(buildClaritySnippet(FAKE_ID));
    expect(window.clarity).toBeUndefined();
  });

  it("sin decisión encola consentv2 denegado (sin cookies) y carga la etiqueta del ID", async () => {
    const { buildClaritySnippet, CLARITY_DENIED } = await cargar(FAKE_ID);
    window.__dtdClarityAllowed = () => true;
    ejecutar(buildClaritySnippet(FAKE_ID));
    expect(Array.from(window.clarity!.q![0] as ArrayLike<unknown>)).toEqual(["consentv2", CLARITY_DENIED]);
    expect(document.querySelector("script[src*='clarity.ms']")?.getAttribute("src")).toBe(
      `https://www.clarity.ms/tag/${FAKE_ID}`,
    );
  });

  it("con granted exacto encola analítica concedida y publicidad denegada", async () => {
    const { buildClaritySnippet, CLARITY_GRANTED } = await cargar(FAKE_ID);
    document.cookie = "dtd_cookie_consent=granted; path=/";
    window.__dtdClarityAllowed = () => true;
    ejecutar(buildClaritySnippet(FAKE_ID));
    expect(Array.from(window.clarity!.q![0] as ArrayLike<unknown>)).toEqual(["consentv2", CLARITY_GRANTED]);
    expect(CLARITY_GRANTED.ad_Storage).toBe("denied");
  });

  it.each([
    ["denied", ["dtd_cookie_consent=denied"]],
    ["un sufijo", ["dtd_cookie_consent=granted-x"]],
    ["una cookie ajena con prefijo", ["other_dtd_cookie_consent=granted"]],
  ])("con %s no concede", async (_caso, cookies) => {
    const { buildClaritySnippet, CLARITY_DENIED } = await cargar(FAKE_ID);
    for (const c of cookies) document.cookie = `${c}; path=/`;
    window.__dtdClarityAllowed = () => true;
    ejecutar(buildClaritySnippet(FAKE_ID));
    expect(Array.from(window.clarity!.q![0] as ArrayLike<unknown>)).toEqual(["consentv2", CLARITY_DENIED]);
  });

  it("un ID inválido no produce snippet", async () => {
    const { buildClaritySnippet } = await cargar(FAKE_ID);
    expect(buildClaritySnippet("x');alert(1);//")).toBe("");
  });

  it("con el build apagado no produce snippet", async () => {
    const { buildClaritySnippet } = await cargar("off");
    expect(buildClaritySnippet(FAKE_ID)).toBe("");
  });
});

describe("guarda en ejecución (__dtdClarityAllowed)", () => {
  it.each([
    ["/servicios", true],
    ["/tarifas?utm_source=ig", true],
    ["/portal", false],
    ["/registro", false],
    ["/servicios?email=x", false],
    ["/servicios#access_token=x", false],
  ])("%s ⇒ %s", async (path, esperado) => {
    const { Clarity } = await cargar(FAKE_ID);
    render(<Clarity />);
    originalReplace.call(window.history, {}, "", path);
    expect(window.__dtdClarityAllowed?.()).toBe(esperado);
  });
});

describe("consentimiento en caliente (etiqueta ya cargada)", () => {
  it("aceptar llama a consentv2; revocar llama a consent false", async () => {
    const { Clarity, CLARITY_GRANTED } = await cargar(FAKE_ID);
    const { writeCookieConsent } = await import("@/lib/cookie-consent");
    const clarity = vi.fn<(...args: unknown[]) => void>();
    window.clarity = clarity;
    render(<Clarity />);
    expect(clarity).not.toHaveBeenCalled();

    act(() => writeCookieConsent("granted"));
    expect(clarity).toHaveBeenLastCalledWith("consentv2", CLARITY_GRANTED);

    act(() => writeCookieConsent("denied"));
    expect(clarity).toHaveBeenLastCalledWith("consent", false);
    expect(clarity).toHaveBeenCalledTimes(2);
  });

  it("rechazar sin haber aceptado no llama a nada (ya corría sin cookies)", async () => {
    const { Clarity } = await cargar(FAKE_ID);
    const { writeCookieConsent } = await import("@/lib/cookie-consent");
    const clarity = vi.fn<(...args: unknown[]) => void>();
    window.clarity = clarity;
    render(<Clarity />);
    act(() => writeCookieConsent("denied"));
    expect(clarity).not.toHaveBeenCalled();
  });
});

describe("corte de frontera público → privado", () => {
  function enlace(href: string, attrs: Record<string, string> = {}) {
    const a = document.createElement("a");
    a.href = href;
    a.textContent = "ir";
    for (const [k, v] of Object.entries(attrs)) a.setAttribute(k, v);
    document.body.append(a);
    return a;
  }

  function clic(el: Element, init: MouseEventInit = {}) {
    const event = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, ...init });
    el.dispatchEvent(event);
    return event;
  }

  it("clic a /portal con Clarity vivo: cancela la navegación cliente, corta y navega completo", async () => {
    const mod = await cargar(FAKE_ID);
    const assign = vi.spyOn(mod.clarityNavigation, "assign").mockImplementation(() => {});
    const clarity = vi.fn<(...args: unknown[]) => void>();
    window.clarity = clarity;
    render(<mod.Clarity />);
    const a = enlace("/portal");
    const reactLike = vi.fn();
    a.addEventListener("click", reactLike);

    const event = clic(a);
    expect(event.defaultPrevented).toBe(true);
    expect(reactLike).not.toHaveBeenCalled();
    expect(clarity).toHaveBeenCalledWith("consent", false);
    expect(assign).toHaveBeenCalledWith(`${window.location.origin}/portal`);
    a.remove();
  });

  it.each(["/registro", "/entrar", "/servicios?email=x"])("clic a %s también corta", async (href) => {
    const mod = await cargar(FAKE_ID);
    const assign = vi.spyOn(mod.clarityNavigation, "assign").mockImplementation(() => {});
    window.clarity = vi.fn<(...args: unknown[]) => void>();
    render(<mod.Clarity />);
    const a = enlace(href);
    expect(clic(a).defaultPrevented).toBe(true);
    expect(assign).toHaveBeenCalledOnce();
    a.remove();
  });

  it("clic a otra página pública no se toca", async () => {
    const mod = await cargar(FAKE_ID);
    const assign = vi.spyOn(mod.clarityNavigation, "assign").mockImplementation(() => {});
    const clarity = vi.fn<(...args: unknown[]) => void>();
    window.clarity = clarity;
    render(<mod.Clarity />);
    const a = enlace("/tarifas");
    a.addEventListener("click", (e) => e.preventDefault());
    clic(a);
    expect(clarity).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
    a.remove();
  });

  it("sin Clarity cargado el clic a /portal sigue siendo navegación cliente", async () => {
    const mod = await cargar(FAKE_ID);
    const assign = vi.spyOn(mod.clarityNavigation, "assign").mockImplementation(() => {});
    render(<mod.Clarity />);
    const a = enlace("/portal");
    a.addEventListener("click", (e) => e.preventDefault());
    clic(a);
    expect(assign).not.toHaveBeenCalled();
    a.remove();
  });

  it("ctrl+clic o target=_blank los resuelve el navegador (pestaña nueva, documento propio)", async () => {
    const mod = await cargar(FAKE_ID);
    const assign = vi.spyOn(mod.clarityNavigation, "assign").mockImplementation(() => {});
    window.clarity = vi.fn<(...args: unknown[]) => void>();
    render(<mod.Clarity />);
    const a = enlace("/portal");
    const b = enlace("/portal", { target: "_blank" });
    for (const el of [a, b]) el.addEventListener("click", (e) => e.preventDefault());
    clic(a, { ctrlKey: true });
    clic(b);
    expect(assign).not.toHaveBeenCalled();
    a.remove();
    b.remove();
  });

  it("red de seguridad: pushState a /portal con Clarity vivo corta y recarga", async () => {
    const mod = await cargar(FAKE_ID);
    const reload = vi.spyOn(mod.clarityNavigation, "reload").mockImplementation(() => {});
    const clarity = vi.fn<(...args: unknown[]) => void>();
    window.clarity = clarity;
    render(<mod.Clarity />);
    window.history.pushState({}, "", "/portal");
    expect(clarity).toHaveBeenCalledWith("consent", false);
    expect(reload).toHaveBeenCalledOnce();
  });

  it("red de seguridad: pushState entre páginas públicas no recarga", async () => {
    const mod = await cargar(FAKE_ID);
    const reload = vi.spyOn(mod.clarityNavigation, "reload").mockImplementation(() => {});
    window.clarity = vi.fn<(...args: unknown[]) => void>();
    render(<mod.Clarity />);
    window.history.pushState({}, "", "/tarifas");
    expect(reload).not.toHaveBeenCalled();
  });

  it("red de seguridad: atrás/adelante hacia una URL privada corta y recarga", async () => {
    const mod = await cargar(FAKE_ID);
    const reload = vi.spyOn(mod.clarityNavigation, "reload").mockImplementation(() => {});
    const clarity = vi.fn<(...args: unknown[]) => void>();
    window.clarity = clarity;
    render(<mod.Clarity />);
    originalReplace.call(window.history, {}, "", "/portal");
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(clarity).toHaveBeenCalledWith("consent", false);
    expect(reload).toHaveBeenCalledOnce();
  });

  it("al desmontar restaura history", async () => {
    const { Clarity } = await cargar(FAKE_ID);
    const { unmount } = render(<Clarity />);
    expect(window.history.pushState).not.toBe(originalPush);
    unmount();
    expect(window.history.pushState).toBe(originalPush);
  });
});
