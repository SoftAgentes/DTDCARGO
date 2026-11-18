import type {ReactNode} from "react";
import {cleanup,render} from "@testing-library/react";
import {afterAll,afterEach,beforeAll,describe,expect,it,vi} from "vitest";
import {readCookieConsent} from "@/lib/cookie-consent";

vi.mock("next/navigation",()=>({usePathname:()=>"/servicios",useSearchParams:()=>new URLSearchParams()}));
vi.mock("next/script",()=>({default:({id,children}:{id?:string;children?:ReactNode})=><span id={id}>{children}</span>}));
let Analytics:typeof import("./Analytics")["Analytics"];
beforeAll(async()=>{vi.stubEnv("NEXT_PUBLIC_GA_ID","G-SYNTHETIC0581");Analytics=(await import("./Analytics")).Analytics;});
afterEach(()=>{cleanup();vi.restoreAllMocks();});afterAll(()=>vi.unstubAllEnvs());

const scenarios:Array<[string,string,"granted"|"denied"|null]>=[
  ["granted válido","dtd_cookie_consent=granted","granted"],
  ["denied válido","dtd_cookie_consent=denied","denied"],
  ["otra cookie con prefijo","other_dtd_cookie_consent=granted",null],
  ["otra cookie con sufijo","dtd_cookie_consent_other=granted",null],
  ["valor ajeno contiene la asignación","other=dtd_cookie_consent=granted",null],
  ["propia denied y ajena granted","dtd_cookie_consent=denied; other_dtd_cookie_consent=granted","denied"],
  ["ajena granted y propia denied","other_dtd_cookie_consent=granted; dtd_cookie_consent=denied","denied"],
  ["granted con sufijo inválido","dtd_cookie_consent=granted-synthetic",null],
  ["denied con sufijo inválido","dtd_cookie_consent=denied-synthetic",null],
  ["valor vacío","dtd_cookie_consent=",null],
  ["ausencia","",null],
  ["espacios separadores","other=synthetic;   dtd_cookie_consent=granted; another=synthetic","granted"],
  ["sin espacios separadores","other=synthetic;dtd_cookie_consent=granted","granted"],
  ["duplicadas contradictorias","dtd_cookie_consent=granted; dtd_cookie_consent=denied",null],
  ["duplicadas concedidas ambiguas","dtd_cookie_consent=granted; dtd_cookie_consent=granted",null],
];

describe("SDD-0581 · consentimiento exacto en parser e init real",()=>{
  it.each(scenarios)("%s",(_name,cookies,expected)=>{
    vi.spyOn(document,"cookie","get").mockReturnValue(cookies);
    expect(readCookieConsent()).toBe(expected);
    const {container}=render(<Analytics/>);const init=container.querySelector("#ga-init")?.textContent;
    expect(init).toBeTruthy();
    const dataLayer:unknown[]=[];
    // Ejecuta el JS emitido de verdad, incluidos sus escapes de template.
    // El loader next/script permanece inerte y no hay peticiones de proveedor.
    new Function("window","document","dataLayer",init!)({dataLayer},{cookie:cookies},dataLayer);
    const commands=dataLayer.map(value=>Array.from(value as ArrayLike<unknown>));
    const consent=commands.find(row=>row[0]==="consent"&&row[1]==="default")?.[2];
    const decision=expected==="granted"?"granted":"denied";
    expect(consent).toEqual({ad_storage:decision,ad_user_data:decision,ad_personalization:decision,analytics_storage:decision,wait_for_update:500});
    expect(commands.findIndex(row=>row[0]==="consent")).toBeLessThan(commands.findIndex(row=>row[0]==="config"));
  });
});
