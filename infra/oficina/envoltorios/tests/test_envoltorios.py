"""Pruebas de los envoltorios de la oficina (SDD-0615).

Corren copias de los scripts con las rutas fijas reemplazadas por carpetas temporales y con
binarios falsos que solo anotan sus argumentos y el entorno que reciben. No usan sudo ni red.
"""

import os
import shutil
import subprocess
import tempfile
import time
import unittest
from pathlib import Path

AQUI = Path(__file__).resolve().parent
RAIZ = Path(os.environ.get("ENVOLTORIOS_RAIZ") or AQUI.parent)


def _bash():
    if os.name == "nt":
        for candidato in (
            r"C:\Program Files\Git\bin\bash.exe",
            r"C:\Program Files (x86)\Git\bin\bash.exe",
        ):
            if os.path.exists(candidato):
                return candidato
    return shutil.which("bash")


BASH = _bash()
POSIX = os.name != "nt"


def _barra(p):
    return str(p).replace("\\", "/")


FALSO = """#!/bin/bash
out="$SALIDA_FALSA"
{
  echo "BIN=$0"
  for a in "$@"; do echo "ARG=$a"; done
  if pwd -W >/dev/null 2>&1; then echo "ENV PWD=$(pwd -W)"; else echo "ENV PWD=$(pwd)"; fi
  for v in DTD_PERFIL CLAUDE_CONFIG_DIR CODEX_HOME HERMES_HOME HOME; do
    if [ -n "${!v+x}" ]; then echo "ENV $v=${!v}"; fi
  done
  for v in ANTHROPIC_API_KEY ANTHROPIC_AUTH_TOKEN OPENAI_API_KEY CLAUDE_CODE_OAUTH_TOKEN; do
    if [ -n "${!v+x}" ]; then echo "SET $v"; fi
  done
} > "$out"
"""


class Base(unittest.TestCase):
    def setUp(self):
        if not BASH:
            self.fail("hace falta bash para probar los envoltorios")
        # Sin resolve(): en Windows la ruta corta 8.3 no tiene espacios; la carpeta de trabajo
        # se compara con samefile, porque bash la informa con la ruta larga.
        self.tmp = Path(tempfile.mkdtemp(prefix="envoltorios-"))
        self.salida = self.tmp / "salida.txt"
        self.bin = self.tmp / "bin"
        self.bin.mkdir()

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def falso(self, nombre):
        p = self.bin / nombre
        p.write_text(FALSO, newline="\n")
        p.chmod(0o755)
        return p

    def leer(self):
        if not self.salida.exists():
            return None
        lineas = self.salida.read_text().splitlines()
        args = [l[4:] for l in lineas if l.startswith("ARG=")]
        env = dict(l[4:].split("=", 1) for l in lineas if l.startswith("ENV "))
        puestas = {l[4:] for l in lineas if l.startswith("SET ")}
        return args, env, puestas

    def correr(self, script, args, env_extra=None):
        env = {
            "PATH": os.environ.get("PATH", ""),
            "SALIDA_FALSA": _barra(self.salida),
            "SYSTEMROOT": os.environ.get("SYSTEMROOT", ""),
        }
        env.update(env_extra or {})
        return subprocess.run(
            [BASH, _barra(script), *args],
            env=env,
            capture_output=True,
            text=True,
            timeout=60,
        )


class Motor(Base):
    """dtd-motor: lista cerrada, copia de rutas protegidas y cambio de usuario."""

    def setUp(self):
        super().setUp()
        self.protegido = self.tmp / "home-agentes"
        self.protegido.mkdir()
        self.staging = self.tmp / "staging"
        for perfil in ("ceo", "auxiliar"):
            (self.staging / perfil).mkdir(parents=True)
        self.usuario = self.tmp / "usuario.txt"
        self.sudo = self.bin / "sudo-falso"
        self.sudo.write_text(
            '#!/bin/bash\necho "$1" > "' + _barra(self.usuario) + '"\nshift\nexec "$@"\n', newline="\n"
        )
        self.sudo.chmod(0o755)
        self.acl_log = self.tmp / "acl.txt"
        self.acl = self.bin / "setfacl-falso"
        self.acl.write_text(
            '#!/bin/bash\nprintf "%s\\n" "$*" >> "' + _barra(self.acl_log) + '"\n', newline="\n"
        )
        self.acl.chmod(0o755)
        agente_run = self.falso("dtd-agente-run")
        texto = (RAIZ / "dtd-motor").read_text()
        reemplazos = {
            "RAIZ_STAGING=/srv/oficina/staging": f"RAIZ_STAGING={_barra(self.staging)}",
            "PROTEGIDO=/home/agentes/": f"PROTEGIDO={_barra(self.protegido)}/",
            "AGENTE_RUN=/usr/local/libexec/dtd-agente-run": f"AGENTE_RUN={_barra(agente_run)}",
            "SUDO=(sudo -n -u)": f"SUDO=({_barra(self.sudo)})",
            "ACL=(setfacl)": f"ACL=({_barra(self.acl)})",
        }
        for viejo, nuevo in reemplazos.items():
            self.assertIn(viejo, texto, f"falta la constante {viejo!r} en dtd-motor")
            texto = texto.replace(viejo, nuevo)
        self.script = self.tmp / "dtd-motor"
        self.script.write_text(texto, newline="\n")

    def motor(self, herramienta, perfil, args):
        env = {} if perfil is None else {"DTD_PERFIL": perfil}
        return self.correr(self.script, [herramienta, *args], env)

    def test_perfil_no_permitido_se_rechaza(self):
        for herramienta, perfil in [
            ("claude", "gabinete"),
            ("claude", "auxiliar"),
            ("codex", "ceo"),
            ("claude", None),
            ("claude", ""),
            ("hermes", "ceo"),
            ("opencode", "ceo"),
            ("", "ceo"),
        ]:
            with self.subTest(herramienta=herramienta, perfil=perfil):
                r = self.motor(herramienta, perfil, ["-p", "hola"])
                self.assertEqual(r.returncode, 64, r.stderr)
                self.assertIsNone(self.leer(), "no debe llegar a dtd-agente-run")

    def test_perfiles_permitidos_llegan_al_agente_run_con_su_usuario(self):
        for herramienta, perfil, usuario in [
            ("claude", "ceo", "agentes-alfred"),
            ("codex", "auxiliar", "agentes-auxiliar"),
        ]:
            with self.subTest(herramienta=herramienta):
                r = self.motor(herramienta, perfil, ["exec", "hola mundo"])
                self.assertEqual(r.returncode, 0, r.stderr)
                args, env, _ = self.leer()
                self.assertEqual(args, [herramienta, "exec", "hola mundo"])
                self.assertEqual(env.get("DTD_PERFIL"), perfil)
                self.assertEqual(self.usuario.read_text().strip(), usuario)

    def test_sin_carpeta_de_staging_no_corre(self):
        shutil.rmtree(self.staging / "ceo")
        r = self.motor("claude", "ceo", ["-p", "x"])
        self.assertEqual(r.returncode, 65, r.stderr)
        self.assertIsNone(self.leer())

    def test_archivo_protegido_se_copia_y_la_ruta_cambia(self):
        instrucciones = self.protegido / "instructions" / "AGENTS.md"
        instrucciones.parent.mkdir()
        instrucciones.write_text("Eres ALFRED.\n")
        r = self.motor("claude", "ceo", ["--append-system-prompt-file", _barra(instrucciones), "-p", "x"])
        self.assertEqual(r.returncode, 0, r.stderr)
        args, _, _ = self.leer()
        self.assertEqual(args[0:2], ["claude", "--append-system-prompt-file"])
        nueva = args[2]
        self.assertNotEqual(nueva, _barra(instrucciones))
        self.assertTrue(nueva.startswith(_barra(self.staging / "ceo") + "/run."), nueva)
        self.assertEqual(Path(nueva).read_text(), "Eres ALFRED.\n")
        self.assertEqual(args[3:], ["-p", "x"])

    def test_opcion_con_igual_tambien_se_reescribe(self):
        origen = self.protegido / "skills"
        origen.mkdir()
        (origen / "SKILL.md").write_text("paperclip")
        r = self.motor("claude", "ceo", [f"--add-dir={_barra(origen)}"])
        self.assertEqual(r.returncode, 0, r.stderr)
        args, _, _ = self.leer()
        clave, valor = args[1].split("=", 1)
        self.assertEqual(clave, "--add-dir")
        self.assertTrue(valor.startswith(_barra(self.staging)), valor)
        self.assertEqual((Path(valor) / "SKILL.md").read_text(), "paperclip")

    def test_carpeta_con_enlace_se_copia_con_el_contenido_real(self):
        if not POSIX:
            self.skipTest("los enlaces simbólicos se prueban en Linux (CI)")
        real = self.protegido / "instalacion" / "paperclip"
        real.mkdir(parents=True)
        (real / "SKILL.md").write_text("real")
        skills = self.protegido / "skills"
        skills.mkdir()
        os.symlink(real, skills / "paperclip")
        r = self.motor("claude", "ceo", ["--add-dir", _barra(skills)])
        self.assertEqual(r.returncode, 0, r.stderr)
        args, _, _ = self.leer()
        copia = Path(args[2]) / "paperclip"
        self.assertFalse(copia.is_symlink(), "la copia no debe seguir siendo un enlace")
        self.assertEqual((copia / "SKILL.md").read_text(), "real")

    def test_mcp_config_se_quita_y_strict_se_conserva(self):
        mcp = self.protegido / "mcp.json"
        mcp.write_text("{}")
        r = self.motor(
            "claude",
            "ceo",
            ["--mcp-config", _barra(mcp), "--strict-mcp-config", f"--mcp-config={_barra(mcp)}", "-p", "x"],
        )
        self.assertEqual(r.returncode, 0, r.stderr)
        args, _, _ = self.leer()
        self.assertEqual(args, ["claude", "--strict-mcp-config", "-p", "x"])

    def test_mcp_config_al_final_sin_valor_no_rompe(self):
        r = self.motor("claude", "ceo", ["-p", "x", "--mcp-config"])
        self.assertEqual(r.returncode, 0, r.stderr)
        args, _, _ = self.leer()
        self.assertEqual(args, ["claude", "-p", "x"])

    def test_rutas_no_protegidas_o_inexistentes_no_se_tocan(self):
        afuera = self.tmp / "afuera.md"
        afuera.write_text("x")
        inexistente = _barra(self.protegido / "no-existe.md")
        parecida = _barra(self.tmp / "home-agentes-otra" / "a.md")
        r = self.motor("codex", "auxiliar", [_barra(afuera), inexistente, parecida, "--model=gpt-6-astra"])
        self.assertEqual(r.returncode, 0, r.stderr)
        args, _, _ = self.leer()
        self.assertEqual(args, ["codex", _barra(afuera), inexistente, parecida, "--model=gpt-6-astra"])

    def test_cada_copia_tiene_nombre_propio(self):
        a = self.protegido / "a"
        b = self.protegido / "b"
        a.mkdir()
        b.mkdir()
        (a / "AGENTS.md").write_text("A")
        (b / "AGENTS.md").write_text("B")
        r = self.motor("claude", "ceo", [_barra(a / "AGENTS.md"), _barra(b / "AGENTS.md")])
        self.assertEqual(r.returncode, 0, r.stderr)
        args, _, _ = self.leer()
        self.assertNotEqual(args[1], args[2])
        self.assertEqual(Path(args[1]).read_text(), "A")
        self.assertEqual(Path(args[2]).read_text(), "B")

    def test_permisos_de_la_copia(self):
        if not POSIX:
            self.skipTest("los permisos se prueban en Linux (CI)")
        f = self.protegido / "AGENTS.md"
        f.write_text("x")
        f.chmod(0o600)
        r = self.motor("claude", "ceo", [_barra(f)])
        self.assertEqual(r.returncode, 0, r.stderr)
        args, _, _ = self.leer()
        copia = Path(args[1])
        self.assertEqual(copia.stat().st_mode & 0o777, 0o640)
        self.assertEqual(copia.parent.stat().st_mode & 0o7777, 0o2750)

    def test_el_usuario_del_motor_recibe_lectura_por_acl(self):
        # 2026-11-07: sin ACL, agentes-alfred no podía leer las instrucciones copiadas (EACCES),
        # porque agentes no es miembro de su grupo y la corrida pierde el setgid.
        for herramienta, perfil, usuario in [
            ("claude", "ceo", "agentes-alfred"),
            ("codex", "auxiliar", "agentes-auxiliar"),
        ]:
            with self.subTest(herramienta=herramienta):
                if self.acl_log.exists():
                    self.acl_log.unlink()
                f = self.protegido / f"{perfil}.md"
                f.write_text("x")
                r = self.motor(herramienta, perfil, ["--append-system-prompt-file", _barra(f)])
                self.assertEqual(r.returncode, 0, r.stderr)
                args, _, _ = self.leer()
                copia = args[2]
                corrida = copia.rsplit("/", 1)[0]
                llamadas = self.acl_log.read_text().splitlines()
                self.assertEqual(
                    llamadas,
                    [f"-m u:{usuario}:rX -- {corrida}", f"-R -m u:{usuario}:rX -- {copia}"],
                )

    def test_corridas_viejas_se_borran_y_las_nuevas_no(self):
        base = self.staging / "ceo"
        vieja = base / "run.viejo0001"
        nueva = base / "run.nuevo0001"
        ajena = base / "otra-cosa"
        for d in (vieja, nueva, ajena):
            d.mkdir(parents=True)
        hace = time.time() - 4 * 3600
        os.utime(vieja, (hace, hace))
        os.utime(ajena, (hace, hace))
        r = self.motor("claude", "ceo", ["-p", "x"])
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertFalse(vieja.exists(), "la corrida de hace 4 h debía borrarse")
        self.assertTrue(nueva.exists(), "una corrida reciente no se borra")
        self.assertTrue(ajena.exists(), "solo se borran carpetas run.*")


class AgenteRun(Base):
    """dtd-agente-run: cada motor con su perfil, su usuario, su carpeta y sin llaves de API."""

    def setUp(self):
        super().setUp()
        self.home = self.tmp / "home"
        self.trabajo = self.tmp / "trabajo"
        for d in ("ceo", "auxiliar"):
            (self.trabajo / d).mkdir(parents=True)
        for nombre in ("claude", "codex", "opencode", "hermes"):
            self.falso(nombre)
        texto = (RAIZ / "dtd-agente-run").read_text()
        for viejo, nuevo in {
            "/opt/agentes-cli/bin": _barra(self.bin),
            "/opt/hermes/bin/hermes": _barra(self.bin / "hermes"),
            'casa="/home/$yo"': f'casa="{_barra(self.home)}/$yo"',
            "/home/agentes-run": _barra(self.home / "agentes-run"),
            "/srv/oficina/trabajo": _barra(self.trabajo),
            '"$(id -un)"': '"$USUARIO_FALSO"',
        }.items():
            self.assertIn(viejo, texto, f"falta {viejo!r} en dtd-agente-run")
            texto = texto.replace(viejo, nuevo)
        self.script = self.tmp / "dtd-agente-run"
        self.script.write_text(texto, newline="\n")

    def run_(self, herramienta, perfil, usuario):
        env = {"DTD_PERFIL": perfil} if perfil is not None else {}
        env.update(
            {
                "USUARIO_FALSO": usuario,
                "ANTHROPIC_API_KEY": "x",
                "ANTHROPIC_AUTH_TOKEN": "x",
                "OPENAI_API_KEY": "x",
                "CLAUDE_CODE_OAUTH_TOKEN": "x",
            }
        )
        self.salida.unlink(missing_ok=True)
        return self.correr(self.script, [herramienta, "--version"], env)

    def rechazado(self, herramienta, perfil, usuario):
        r = self.run_(herramienta, perfil, usuario)
        self.assertEqual(r.returncode, 64, f"{herramienta} {perfil} {usuario}: {r.stderr}")
        self.assertIsNone(self.leer())

    def test_claude_solo_ceo_como_agentes_alfred(self):
        r = self.run_("claude", "ceo", "agentes-alfred")
        self.assertEqual(r.returncode, 0, r.stderr)
        args, env, puestas = self.leer()
        self.assertEqual(args, ["--version"])
        casa = _barra(self.home / "agentes-alfred")
        self.assertEqual(env["HOME"], casa)
        self.assertEqual(env["CLAUDE_CONFIG_DIR"], casa + "/.claude")
        self.assertTrue(os.path.samefile(env["PWD"], self.trabajo / "ceo"), env["PWD"])
        self.assertEqual(puestas, {"CLAUDE_CODE_OAUTH_TOKEN"}, "solo pasa el token de la suscripción")
        for perfil, usuario in [
            ("ceo", "agentes-run"),
            ("ceo", "agentes-auxiliar"),
            ("auxiliar", "agentes-alfred"),
            ("", "agentes-alfred"),
            (None, "agentes-alfred"),
        ]:
            with self.subTest(perfil=perfil, usuario=usuario):
                self.rechazado("claude", perfil, usuario)

    def test_codex_solo_auxiliar_como_agentes_auxiliar_y_sin_llaves(self):
        r = self.run_("codex", "auxiliar", "agentes-auxiliar")
        self.assertEqual(r.returncode, 0, r.stderr)
        _, env, puestas = self.leer()
        casa = _barra(self.home / "agentes-auxiliar")
        self.assertEqual(env["HOME"], casa)
        self.assertEqual(env["CODEX_HOME"], casa + "/.codex")
        self.assertTrue(os.path.samefile(env["PWD"], self.trabajo / "auxiliar"), env["PWD"])
        self.assertEqual(puestas, set(), "Codex no recibe ninguna llave ni el token de Claude")
        for perfil, usuario in [
            ("auxiliar", "agentes-run"),
            ("auxiliar", "agentes-alfred"),
            ("ceo", "agentes-auxiliar"),
            (None, "agentes-auxiliar"),
        ]:
            with self.subTest(perfil=perfil, usuario=usuario):
                self.rechazado("codex", perfil, usuario)

    def test_hermes_solo_como_agentes_run_con_su_lista_y_sin_tokens(self):
        r = self.run_("hermes", "seo", "agentes-run")
        self.assertEqual(r.returncode, 0, r.stderr)
        _, env, puestas = self.leer()
        self.assertEqual(env["HERMES_HOME"], _barra(self.home / "agentes-run" / ".hermes" / "profiles" / "seo"))
        self.assertEqual(env["HOME"], _barra(self.home / "agentes-run"))
        self.assertEqual(puestas, set())
        for perfil, usuario in [
            ("seo", "agentes-alfred"),
            ("auxiliar", "agentes-run"),
            ("otro", "agentes-run"),
            ("", "agentes-run"),
        ]:
            with self.subTest(perfil=perfil, usuario=usuario):
                self.rechazado("hermes", perfil, usuario)

    def test_opencode_solo_como_agentes_run_y_sin_tokens(self):
        r = self.run_("opencode", None, "agentes-run")
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(self.leer()[2], set())
        self.rechazado("opencode", None, "agentes-alfred")

    def test_herramienta_desconocida(self):
        for usuario in ("agentes-run", "agentes-alfred", "agentes-auxiliar"):
            with self.subTest(usuario=usuario):
                self.rechazado("bash", "ceo", usuario)


class Archivos(unittest.TestCase):
    """Lo que no se ejecuta en las pruebas pero sí se instala."""

    def test_sudoers_deja_pasar_solo_lo_necesario(self):
        texto = (RAIZ / "91-agentes-run").read_text()
        keep = [l for l in texto.splitlines() if "env_keep" in l]
        self.assertEqual(len(keep), 1)
        variables = keep[0].split('"')[1].split()
        self.assertEqual(
            sorted(variables),
            sorted(["PAPERCLIP_*", "DTD_PERFIL", "CLAUDE_CODE_OAUTH_TOKEN", "TERM", "LANG", "LC_ALL", "LC_CTYPE"]),
        )
        self.assertIn("Defaults!/usr/local/libexec/dtd-agente-run env_reset", texto)
        self.assertIn("Defaults!/usr/local/libexec/dtd-agente-run !log_allowed", texto)
        self.assertIn(
            "agentes ALL=(agentes-run, agentes-alfred, agentes-auxiliar) NOPASSWD: /usr/local/libexec/dtd-agente-run",
            texto,
        )
        self.assertEqual(len([l for l in texto.splitlines() if "NOPASSWD" in l]), 1)

    def test_dtd_claude_y_dtd_codex_solo_llaman_al_motor(self):
        for nombre, herramienta in (("dtd-claude", "claude"), ("dtd-codex", "codex")):
            with self.subTest(nombre=nombre):
                lineas = [
                    l for l in (RAIZ / nombre).read_text().splitlines() if l and not l.startswith("#")
                ]
                self.assertEqual(lineas, [f'exec /usr/local/libexec/dtd-motor {herramienta} "$@"'])

    def test_finales_de_linea_unix(self):
        for nombre in ("dtd-motor", "dtd-claude", "dtd-codex", "dtd-agente-run", "91-agentes-run"):
            with self.subTest(nombre=nombre):
                self.assertNotIn(b"\r", (RAIZ / nombre).read_bytes())


if __name__ == "__main__":
    unittest.main()
