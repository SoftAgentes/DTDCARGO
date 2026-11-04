// @vitest-environment node
/**
 * SDD-0588 · paso 3.4 · parte pura del análisis: qué entra en el paquete, qué nunca
 * entra (prueba negativa de secretos y `.env`), cómo se lee la respuesta del motor y
 * el informe sin IA.
 */
import { afterEach, describe, expect, it } from "vitest";

import {
  MAX_PAQUETE,
  MAX_POR_ARCHIVO,
  PIEZAS,
  armarPaquete,
  informeSinIa,
  leerInforme,
  mensajeParaMotor,
  pareceSecreto,
  rutaExcluida,
  textoPlano,
  type ArchivoChatwoot,
  type Paquete,
} from "../analisis";

const SUPERFICIE = [
  { ruta: "infra/chatwoot/rails/zz_dtd_revocar_sesiones.rb", contenido: "module DtdRevocarSesiones\n  VARIABLE = 'DTD_CHATWOOT_SERVICIO_ID'\nend" },
  { ruta: "infra/chatwoot/compose.yml", contenido: "  SECRET_KEY_BASE: ${CHATWOOT_SECRET_KEY_BASE:?falta en .env}\n  POSTGRES_PASSWORD: ${CHATWOOT_POSTGRES_PASSWORD:?falta}" },
];

const cambio = (ruta: string, parche = "@@ -1 +1 @@\n-viejo\n+nuevo"): ArchivoChatwoot => ({ ruta, estado: "modified", parche });

function paquete(cambios: ArchivoChatwoot[] = [cambio("app/channels/room_channel.rb"), cambio("app/javascript/widget.vue")]): Paquete {
  return armarPaquete({ desde: "4.19.1", hasta: "4.20.0", superficie: SUPERFICIE, cambios });
}

describe("rutaExcluida", () => {
  it("deja afuera .env*, secretos, llaves y datos", () => {
    for (const ruta of [
      ".env",
      ".env.example",
      "infra/chatwoot/.env.local",
      "infra/chatwoot/secretos/platform-token",
      "config/credentials.yml.enc",
      "config/master.key",
      "certs/servidor.pem",
      "spec/fixtures/contactos.csv",
      "db/respaldo.dump",
      "log/production.log",
      "x/datos/clientes.json",
    ]) {
      expect(rutaExcluida(ruta), ruta).toBe(true);
    }
  });
  it("deja pasar código", () => {
    for (const ruta of ["app/channels/room_channel.rb", "config/routes.rb", "infra/chatwoot/compose.yml", "Gemfile.lock"]) {
      expect(rutaExcluida(ruta), ruta).toBe(false);
    }
  });
});

describe("pareceSecreto", () => {
  it("reconoce credenciales", () => {
    for (const t of [
      "-----BEGIN RSA PRIVATE KEY-----\nMIIE",
      "SUPABASE_ACCESS_TOKEN=sbp_0123456789abcdefghijABCDEFGHIJ",
      "key: sk-proj-0123456789abcdefghijklmnop",
      "AWS AKIAABCDEFGHIJKLMNOP",
      "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijklmnopqrst",
      "glm 0123456789abcdef0123456789abcdef.AbCdEfGhIjKlMnOp",
      'SECRET_KEY_BASE="abcdefghijklmnopqrstuvwxyz012345"',
    ]) {
      expect(pareceSecreto(t), t).toBe(true);
    }
  });
  it("no confunde referencias a variables ni código común con secretos", () => {
    for (const t of [
      "SECRET_KEY_BASE: ${CHATWOOT_SECRET_KEY_BASE:?falta en .env}",
      "user.update!(pubsub_token: SecureRandom.urlsafe_base64)",
      "headers: { api_access_token: token }",
      "VARIABLE = 'DTD_CHATWOOT_SERVICIO_ID'",
    ]) {
      expect(pareceSecreto(t), t).toBe(false);
    }
  });
});

describe("armarPaquete", () => {
  it("manda la superficie entera y solo el diff de lo que toca alguna pieza", () => {
    const p = paquete();
    expect(p.archivos.map((a) => a.ruta)).toEqual([...SUPERFICIE.map((s) => s.ruta), "app/channels/room_channel.rb"]);
    expect(p.otrosCambios).toEqual(["app/javascript/widget.vue"]);
    expect(p.tocados.revocar_sesiones).toEqual(["app/channels/room_channel.rb"]);
    expect(p.tocados.candado_register).toEqual([]);
  });

  it("un archivo de Chatwoot puede tocar varias piezas", () => {
    const p = paquete([cambio("app/controllers/platform/api/v1/users_controller.rb")]);
    expect(p.tocados.revocar_sesiones).toHaveLength(1);
    expect(p.tocados.integracion_studio).toHaveLength(1);
  });

  it("recorta por archivo y respeta el tope del paquete", () => {
    const grande = "x".repeat(MAX_POR_ARCHIVO + 500);
    const cambios = Array.from({ length: 20 }, (_, i) => cambio(`app/channels/canal_${i}.rb`, grande));
    const p = paquete(cambios);
    expect(p.archivos.every((a) => a.contenido.length <= MAX_POR_ARCHIVO + 20)).toBe(true);
    expect(p.caracteres).toBeLessThanOrEqual(MAX_PAQUETE);
    expect(p.recortado).toBe(true);
    expect(p.excluidos.some((e) => e.motivo === "tope")).toBe(true);
  });

  it("sin parche de GitHub manda el estado, no inventa contenido", () => {
    const p = paquete([{ ruta: "Gemfile.lock", estado: "modified", parche: null }]);
    expect(p.archivos.find((a) => a.ruta === "Gemfile.lock")?.contenido).toMatch(/GitHub no manda el parche/);
  });
});

describe("PRUEBA NEGATIVA · en el paquete no viajan secretos ni .env", () => {
  const ENV = {
    DTD_CHATWOOT_IA_GLM_KEY: "0123456789abcdef0123456789abcdef.LlaveDePruebaGLM",
    CHATWOOT_PLATFORM_TOKEN: "token-de-plataforma-de-prueba-0001",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-de-prueba-0002",
  };
  afterEach(() => {
    for (const k of Object.keys(ENV)) delete process.env[k];
  });

  it("ni archivos .env, ni secretos/, ni contenido con forma de llave, ni valores del entorno", () => {
    Object.assign(process.env, ENV);
    const secreto = "PLATFORM_TOKEN=sbp_0123456789abcdefghijABCDEFGHIJ";
    const p = armarPaquete({
      desde: "4.19.1",
      hasta: "4.20.0",
      superficie: [
        ...SUPERFICIE,
        { ruta: "infra/chatwoot/.env", contenido: `CHATWOOT_PLATFORM_TOKEN=${ENV.CHATWOOT_PLATFORM_TOKEN}` },
        { ruta: "infra/chatwoot/secretos/platform-token", contenido: ENV.CHATWOOT_PLATFORM_TOKEN },
        { ruta: "infra/chatwoot/rails/zz_fuga.rb", contenido: secreto },
      ],
      cambios: [
        cambio(".env.example", "+SECRET_KEY_BASE=replace_with_lengthy_secure_hex"),
        cambio("app/controllers/platform/api/v1/accounts_controller.rb", `+ token = '${ENV.SUPABASE_SERVICE_ROLE_KEY}'\n+ ${secreto}`),
        cambio("config/routes.rb"),
      ],
    });
    const mensaje = mensajeParaMotor(p);

    expect(p.archivos.map((a) => a.ruta)).not.toEqual(expect.arrayContaining([expect.stringMatching(/\.env|secretos|zz_fuga/)]));
    expect(mensaje).not.toMatch(/\.env\.example|secretos\/|zz_fuga/);
    expect(mensaje).not.toContain("sbp_");
    for (const valor of Object.values(ENV)) expect(mensaje).not.toContain(valor);
    expect(p.excluidos).toEqual(
      expect.arrayContaining([
        { ruta: "infra/chatwoot/.env", motivo: "ruta" },
        { ruta: "infra/chatwoot/secretos/platform-token", motivo: "ruta" },
        { ruta: "infra/chatwoot/rails/zz_fuga.rb", motivo: "secreto" },
        { ruta: ".env.example", motivo: "ruta" },
        { ruta: "app/controllers/platform/api/v1/accounts_controller.rb", motivo: "secreto" },
      ]),
    );
    // Lo limpio sí viaja.
    expect(mensaje).toContain("config/routes.rb");
    expect(mensaje).toContain("module DtdRevocarSesiones");
  });
});

describe("mensajeParaMotor", () => {
  it("nombra cada pieza por su id y separa lo de DTD del diff de Chatwoot", () => {
    const m = mensajeParaMotor(paquete());
    for (const pieza of PIEZAS) expect(m).toContain(`id=${pieza.id}`);
    expect(m).toContain("## DTD · infra/chatwoot/compose.yml");
    expect(m).toContain("## Chatwoot (diff) · app/channels/room_channel.rb");
    expect(m).toContain("app/javascript/widget.vue");
  });
});

describe("leerInforme", () => {
  const respuesta = (cuerpo: unknown) => JSON.stringify(cuerpo);
  const todas = (riesgo = "bajo") => PIEZAS.map((p) => ({ id: p.id, riesgo, motivo: "nada", archivos: [] }));

  it("lee la respuesta con la forma pedida, también dentro de un bloque ```json", () => {
    const texto = "```json\n" + respuesta({ recomendacion: "seguro", resumen: "Sin cambios que te afecten.", piezas: todas() }) + "\n```";
    const p = { ...paquete([]), recortado: false };
    const i = leerInforme(texto, p);
    expect(i?.recomendacion).toBe("seguro");
    expect(i?.piezas).toHaveLength(PIEZAS.length);
  });

  it("rechaza lo que no tiene la forma: texto, recomendación inventada, sin resumen", () => {
    const p = paquete();
    expect(leerInforme("todo bien, actualiza", p)).toBeNull();
    expect(leerInforme(respuesta({ recomendacion: "actualizar_ya", resumen: "x", piezas: [] }), p)).toBeNull();
    expect(leerInforme(respuesta({ recomendacion: "seguro", resumen: "", piezas: [] }), p)).toBeNull();
    expect(leerInforme(respuesta({ recomendacion: "seguro", resumen: "x" }), p)).toBeNull();
  });

  it("completa las piezas que el motor no evaluó y no deja «seguro» con riesgo", () => {
    const i = leerInforme(respuesta({ recomendacion: "seguro", resumen: "Bien.", piezas: [{ id: "marca", riesgo: "bajo", motivo: "ok", archivos: [] }] }), paquete());
    expect(i?.piezas.find((p) => p.id === "revocar_sesiones")).toMatchObject({ riesgo: "medio", motivo: "El motor no evaluó esta pieza." });
    expect(i?.recomendacion).toBe("revisar");
  });

  it("ignora piezas inventadas, cita solo archivos del paquete y quita el HTML", () => {
    const i = leerInforme(
      respuesta({
        recomendacion: "no_actualizar",
        resumen: "<b>Rompe</b> la revocación<script>alert(1)</script>",
        piezas: [
          { id: "pieza_falsa", riesgo: "alto", motivo: "x", archivos: [] },
          { id: "revocar_sesiones", riesgo: "alto", motivo: "RoomChannel <i>cambia</i>", archivos: ["app/channels/room_channel.rb", "/etc/passwd"] },
        ],
      }),
      paquete(),
    );
    expect(i?.recomendacion).toBe("no_actualizar");
    expect(i?.resumen).toBe("Rompe la revocaciónalert(1)");
    expect(i?.piezas.map((p) => p.id)).toEqual(PIEZAS.map((p) => p.id));
    expect(i?.piezas.find((p) => p.id === "revocar_sesiones")).toMatchObject({ motivo: "RoomChannel cambia", archivos: ["app/channels/room_channel.rb"] });
  });
});

describe("informeSinIa", () => {
  it("compara archivos: revisar si cambia algo de lo que depende una pieza", () => {
    const i = informeSinIa(paquete(), "motor_apagado");
    expect(i.recomendacion).toBe("revisar");
    expect(i.piezas.find((p) => p.id === "revocar_sesiones")).toMatchObject({ riesgo: "medio", archivos: ["app/channels/room_channel.rb"] });
    expect(i.piezas.find((p) => p.id === "marca")?.riesgo).toBe("bajo");
    expect(i.resumen).toMatch(/no está configurado/);
  });

  it("seguro solo si no cambia nada de lo que usan las piezas", () => {
    expect(informeSinIa(paquete([cambio("app/javascript/widget.vue")]), "motor_no_responde").recomendacion).toBe("seguro");
  });

  it("sin diff no sabe nada: revisar y riesgo medio en todas", () => {
    const i = informeSinIa(null, "diff_no_responde");
    expect(i.recomendacion).toBe("revisar");
    expect(i.piezas.every((p) => p.riesgo === "medio")).toBe(true);
  });

  it("nunca dice no actualizar", () => {
    for (const motivo of ["motor_apagado", "motor_no_responde", "motor_formato", "diff_no_responde", "diff_formato"] as const) {
      expect(informeSinIa(paquete(), motivo).recomendacion).not.toBe("no_actualizar");
    }
  });
});

describe("textoPlano", () => {
  it("quita HTML y controles y recorta", () => {
    expect(textoPlano("<p>hola</p>\u0007 mundo", 100)).toBe("hola mundo");
    expect(textoPlano("abcdef", 3)).toBe("abc…");
    expect(textoPlano(42, 10)).toBe("");
  });
});
