// @vitest-environment node
/** SDD-0379: parsers reales, ZIP hostil sólo en subprocesso propio acotado. */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const rrwebManifest = require.resolve("rrweb/package.json");
const fromRrweb = createRequire(rrwebManifest);
const libraries = [
  ["directo", require.resolve("fflate")],
  ["rrweb transitivo", fromRrweb.resolve("fflate")],
];
const payload = "Replay sintético · español · 中文 · 123";
const rrwebRoot = path.dirname(rrwebManifest);
const packerRoot = path.join(rrwebRoot, "es/rrweb/packages/rrweb/src/packer");

describe("fflate · corrección ZIP64 acotada", () => {
  it("resuelve el backport0.4.9 admitido por rrweb sin mover su versión", () => {
    const rrweb = JSON.parse(readFileSync(rrwebManifest, "utf8"));
    const resolved = JSON.parse(readFileSync(fromRrweb.resolve("fflate/package.json"), "utf8"));
    expect(rrweb.version).toBe("2.0.0-alpha.4");
    expect(rrweb.dependencies.fflate).toBe("^0.4.4");
    expect(resolved.version).toBe("0.4.9");
  });

  for (const [name, modulePath] of libraries) {
    it(name + ": ZIP legítimo conserva nombres, bytes y Unicode", () => {
      const codec = require(modulePath);
      const bytes = codec.strToU8(payload);
      const archive = codec.zipSync({ "replay.json": bytes, "vacío.txt": new Uint8Array() });
      const files = codec.unzipSync(archive);
      expect(Object.keys(files)).toEqual(["replay.json", "vacío.txt"]);
      expect(codec.strFromU8(files["replay.json"])).toBe(payload);
      expect(files["vacío.txt"].length).toBe(0);
    });

    for (const valid of [false, true]) it(name + (valid ? ": admite ZIP64 equivalente con extra válido" : ": rechaza ZIP64 sin extra requerido, sin colgar su proceso"), () => {
      // No hay fichero remoto, archivos grandes, threads huérfanos ni ZIP en disco.
      const source = `
        const codec = require(process.argv[1]);
        const normal = codec.zipSync({ "x": codec.strToU8("fixture") });
        const valid = process.argv[2] === "valid";
        const oldEocd = normal.length - 22;
        const extra = valid ? 28 : 0;
        const eocd = oldEocd + extra;
        const zip = new Uint8Array(normal.length + extra + 76);
        zip.set(normal.subarray(0, oldEocd));
        zip.set(normal.subarray(oldEocd), eocd + 76);
        const data = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
        let central = -1;
        for (let i = 0; i <= zip.length - 46; i++) {
          if (data.getUint32(i, true) === 0x02014b50) { central = i; break; }
        }
        if (central < 0 || data.getUint16(central + 30, true) !== 0) process.exit(2);
        if (valid) {
          // El único archivo lleva un extra ZIP64: tamaño, comprimido y offset.
          data.setUint16(central + 30, 28, true);
          data.setUint16(oldEocd, 1, true);
          data.setUint16(oldEocd + 2, 24, true);
          data.setUint32(oldEocd + 4, data.getUint32(central + 24, true), true);
          data.setUint32(oldEocd + 12, data.getUint32(central + 20, true), true);
          data.setUint32(oldEocd + 20, data.getUint32(central + 42, true), true);
        }
        // ZIP64 EOCD + locator válidos, pero el archivo carece de extra0x0001.
        // La serie0.4 decide ZIP64 por EOCD, no sólo por el tamaño del entry.
        data.setUint32(eocd, 0x06064b50, true);
        data.setUint32(eocd + 4, 44, true);
        data.setUint16(eocd + 12, 45, true);
        data.setUint16(eocd + 14, 45, true);
        data.setUint32(eocd + 24, 1, true);
        data.setUint32(eocd + 32, 1, true);
        data.setUint32(eocd + 40, eocd - central, true);
        data.setUint32(eocd + 48, central, true);
        data.setUint32(eocd + 56, 0x07064b50, true);
        data.setUint32(eocd + 64, eocd, true);
        data.setUint32(eocd + 72, 1, true);
        data.setUint16(eocd + 76 + 8, 65535, true);
        data.setUint16(eocd + 76 + 10, 65535, true);
        data.setUint32(eocd + 76 + 16, 0xffffffff, true);
        data.setUint32(central + 20, 0xffffffff, true);
        data.setUint32(central + 24, 0xffffffff, true);
        data.setUint32(central + 42, 0xffffffff, true);
        try {
          const files = codec.unzipSync(zip);
          if (valid && Object.keys(files).length === 1 && codec.strFromU8(files.x) === "fixture")
            process.stdout.write("ZIP64_VALID");
          else process.exitCode = 3;
        } catch {
          if (valid) process.exitCode = 4;
          else process.stdout.write("ZIP64_REJECTED");
        }
      `;
      const result = spawnSync(process.execPath, ["-e", source, modulePath, valid ? "valid" : "invalid"], {
        encoding: "utf8", timeout: 3000, maxBuffer: 16 * 1024, windowsHide: true,
      });
      expect(result.error?.code, "El parser no debe agotar el plazo del subprocesso").not.toBe("ETIMEDOUT");
      expect(result.error).toBeUndefined();
      expect(result.status).toBe(0);
      expect(result.stdout).toBe(valid ? "ZIP64_VALID" : "ZIP64_REJECTED");
    });
  }
});

describe("contrato compatible de replay", () => {
  it("zlib cruza las dos versiones en ambos sentidos", () => {
    const direct = require(libraries[0][1]);
    const nested = require(libraries[1][1]);
    for (const [writer, reader] of [[direct, nested], [nested, direct]]) {
      expect(reader.strFromU8(reader.unzlibSync(writer.zlibSync(writer.strToU8(payload))))).toBe(payload);
    }
  });

  it("pack/unpack publicados por rrweb preservan evento, Unicode y versión", async () => {
    const { pack } = await import(pathToFileURL(path.join(packerRoot, "pack.js")).href);
    const { unpack } = await import(pathToFileURL(path.join(packerRoot, "unpack.js")).href);
    const { MARK } = await import(pathToFileURL(path.join(packerRoot, "base.js")).href);
    const event = { type: 5, timestamp: 12345, data: { tag: "synthetic", payload } };
    const decoded = unpack(pack(event));
    expect(decoded).toMatchObject(event);
    expect(decoded.v).toBe(MARK);
    expect(MARK).toBe("v1");
    expect(unpack(JSON.stringify(event))).toEqual(event);
    expect(unpack(event)).toBe(event);
  });

  it("declara la copia vendorizada: un override no modifica ese código", () => {
    for (const name of ["pack.js", "unpack.js"]) {
      const source = readFileSync(path.join(packerRoot, name), "utf8");
      expect(source).toContain("ext/fflate/esm/browser.js");
      expect(source).not.toMatch(/\bunzipSync\s*\(/);
    }
  });
});
