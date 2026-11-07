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
  for v in ANTHROPIC_API_KEY ANTHROPIC_AUTH_TOKEN OPENAI_API_KEY CLAUDE_CODE_OAUTH_TOKEN HERMES_EPHEMERAL_SYSTEM_PROMPT; do
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

    def correr(self, script, args, env_extra=None, cwd=None):
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
            cwd=cwd,
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
        # La carpeta que escriben los GLM, y el cwd que Paperclip le da al motor.
        self.trabajo_glm = self.tmp / "trabajo"
        (self.trabajo_glm / "ceo").mkdir(parents=True)
        # La carpeta donde trabaja el motor (la fija dtd-agente-run), hermana de la de los GLM.
        self.motores = self.tmp / "motores"
        for perfil in ("ceo", "auxiliar"):
            (self.motores / perfil).mkdir(parents=True)
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
            "TRABAJO=/srv/oficina/trabajo": f"TRABAJO={_barra(self.trabajo_glm)}",
            "MOTORES=/srv/oficina/motores": f"MOTORES={_barra(self.motores)}",
        }
        for viejo, nuevo in reemplazos.items():
            self.assertIn(viejo, texto, f"falta la constante {viejo!r} en dtd-motor")
            texto = texto.replace(viejo, nuevo)
        self.script = self.tmp / "dtd-motor"
        self.script.write_text(texto, newline="\n")

    def motor(self, herramienta, perfil, args):
        env = {} if perfil is None else {"DTD_PERFIL": perfil}
        return self.correr(self.script, [herramienta, *args], env)

    # Rutas con la forma real de Paperclip 2026.1012.0 (medidas el 2026-11-07).
    def instrucciones(self, texto="Eres ALFRED.\n", nombre="AGENTS.md"):
        f = self.protegido / ".paperclip/instances/default/companies/co1/agents/ag1/instructions" / nombre
        f.parent.mkdir(parents=True, exist_ok=True)
        f.write_text(texto)
        return f

    def paquete(self, nombre="abc123"):
        d = self.protegido / ".paperclip/instances/default/companies/co1/claude-prompt-cache" / nombre
        d.mkdir(parents=True, exist_ok=True)
        return d

    def skill_instalada(self, nombre="paperclip"):
        d = self.protegido / ".paperclip/cli/installs/npm/2026.1012.0/node_modules/@paperclipai/server/skills" / nombre
        d.mkdir(parents=True, exist_ok=True)
        (d / "SKILL.md").write_text(nombre)
        return d

    def secreto(self):
        f = self.protegido / ".paperclip/instances/default/secrets/master.key"
        f.parent.mkdir(parents=True, exist_ok=True)
        f.write_text("NO-COPIAR")
        return f

    def rechazada(self, args):
        r = self.motor("claude", "ceo", args)
        self.assertEqual(r.returncode, 66, r.stderr)
        self.assertIsNone(self.leer(), "no debe llegar a dtd-agente-run")
        copias = [p for p in self.staging.rglob("*") if p.is_file()]
        self.assertEqual(copias, [], "no debe copiar nada")

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
        instrucciones = self.instrucciones()
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
        origen = self.paquete()
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
        real = self.skill_instalada()
        skills = self.paquete() / ".claude" / "skills"
        skills.mkdir(parents=True)
        os.symlink(real, skills / "paperclip")
        r = self.motor("claude", "ceo", ["--add-dir", _barra(self.paquete())])
        self.assertEqual(r.returncode, 0, r.stderr)
        args, _, _ = self.leer()
        copia = Path(args[2]) / ".claude" / "skills" / "paperclip"
        self.assertFalse(copia.is_symlink(), "la copia no debe seguir siendo un enlace")
        self.assertEqual((copia / "SKILL.md").read_text(), "paperclip")

    def test_mcp_config_se_quita_y_strict_se_conserva(self):
        mcp = self.paquete() / "mcp.json"
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
        a = self.paquete("a") / "AGENTS.md"
        b = self.paquete("b") / "AGENTS.md"
        a.write_text("A")
        b.write_text("B")
        r = self.motor("claude", "ceo", [_barra(a), _barra(b)])
        self.assertEqual(r.returncode, 0, r.stderr)
        args, _, _ = self.leer()
        self.assertNotEqual(args[1], args[2])
        self.assertEqual(Path(args[1]).read_text(), "A")
        self.assertEqual(Path(args[2]).read_text(), "B")

    def test_permisos_de_la_copia(self):
        if not POSIX:
            self.skipTest("los permisos se prueban en Linux (CI)")
        f = self.instrucciones("x")
        f.chmod(0o600)
        r = self.motor("claude", "ceo", [_barra(f)])
        self.assertEqual(r.returncode, 0, r.stderr)
        args, _, _ = self.leer()
        copia = Path(args[1])
        self.assertEqual(copia.stat().st_mode & 0o777, 0o640)
        # Sin setgid: en el VPS agentes no es del grupo del motor y Linux lo quita (medido: 0750).
        self.assertEqual(copia.parent.stat().st_mode & 0o7777, 0o750)

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
                f = self.instrucciones("x", f"{perfil}.md")
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

    # Revisión del DG (2026-11-07): solo se copian las subrutas que Paperclip usa, ya resueltas.
    def test_ruta_protegida_fuera_de_la_lista_no_se_copia(self):
        self.rechazada(["--append-system-prompt-file", _barra(self.secreto()), "-p", "x"])

    def test_opcion_con_igual_fuera_de_la_lista_no_se_copia(self):
        self.rechazada([f"--add-dir={_barra(self.secreto().parent)}"])

    def test_home_de_agentes_sola_no_se_copia(self):
        self.secreto()
        self.rechazada([_barra(self.protegido) + "/"])
        self.rechazada([_barra(self.protegido)])

    def test_puntos_que_salen_de_la_lista_no_se_copian(self):
        self.secreto()
        self.instrucciones()
        # instructions → ag1 → agents → co1 → companies → default: secrets/master.key sí existe.
        escape = _barra(self.instrucciones().parent) + "/../../../../../secrets/master.key"
        self.assertTrue(Path(escape).exists(), escape)
        self.rechazada(["--append-system-prompt-file", escape])

    def test_enlace_dentro_del_paquete_hacia_un_secreto_no_se_copia(self):
        if not POSIX:
            self.skipTest("los enlaces simbólicos se prueban en Linux")
        paquete = self.paquete()
        os.symlink(self.secreto(), paquete / "llave")
        self.rechazada(["--add-dir", _barra(paquete)])

    def test_enlace_hacia_fuera_de_home_no_se_copia(self):
        if not POSIX:
            self.skipTest("los enlaces simbólicos se prueban en Linux")
        afuera = self.tmp / "afuera.txt"
        afuera.write_text("x")
        paquete = self.paquete()
        os.symlink(afuera, paquete / "afuera")
        self.rechazada(["--add-dir", _barra(paquete)])

    def test_argumento_que_es_enlace_a_un_secreto_no_se_copia(self):
        if not POSIX:
            self.skipTest("los enlaces simbólicos se prueban en Linux")
        enlace = self.instrucciones().parent / "AGENTS-enlace.md"
        os.symlink(self.secreto(), enlace)
        self.rechazada(["--append-system-prompt-file", _barra(enlace)])

    # Decisión del DG (2026-11-07): ningún argumento puede apuntar a /srv/oficina/trabajo, que
    # escriben los GLM; Claude cargaría de ahí hooks, settings o skills y se reabriría la ALTA.
    def glm(self, rel="ceo/.claude/settings.json"):
        f = self.trabajo_glm / rel
        f.parent.mkdir(parents=True, exist_ok=True)
        f.write_text("{}")
        return f

    def test_argumento_bajo_la_carpeta_de_los_glm_no_corre(self):
        f = self.glm()
        for args in (
            ["--settings", _barra(f)],
            [f"--settings={_barra(f)}"],
            ["--add-dir", _barra(f.parent)],
            [f"--plugin-dir={_barra(self.trabajo_glm / 'ceo')}"],
            [_barra(self.trabajo_glm)],
        ):
            with self.subTest(args=args):
                self.rechazada(args)

    def test_puntos_hacia_la_carpeta_de_los_glm_no_corren(self):
        self.glm()
        self.rechazada(["--add-dir", _barra(self.staging / "ceo") + "/../../trabajo/ceo/.claude"])

    def test_enlace_hacia_la_carpeta_de_los_glm_no_corre(self):
        if not POSIX:
            self.skipTest("los enlaces simbólicos se prueban en Linux")
        enlace = self.tmp / "parece-inocente"
        os.symlink(self.glm().parent, enlace)
        self.rechazada(["--add-dir", _barra(enlace)])

    def test_rutas_relativas_no_se_leen_desde_la_carpeta_de_los_glm(self):
        # Paperclip arranca el motor con cwd en trabajo/ceo: un GLM podría crear ahí un archivo
        # llamado como un argumento («high») y bloquear a ALFRED. Las relativas no se ven desde ahí.
        self.glm("ceo/high")
        r = self.correr(self.script, ["claude", "--effort", "high"], {"DTD_PERFIL": "ceo"},
                        cwd=str(self.trabajo_glm / "ceo"))
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(self.leer()[0], ["claude", "--effort", "high"])

    # Tercera vuelta del DG (H1, ALTA): el motor arranca en motores/<perfil>, así que una relativa
    # se abre desde ahí. ../../trabajo/... llega a la carpeta de los GLM aunque desde / no exista.
    def test_relativa_que_sale_de_la_carpeta_del_motor_hacia_los_glm_no_corre(self):
        self.glm()
        for perfil, herramienta in (("ceo", "claude"), ("auxiliar", "codex")):
            for args in (
                ["--settings", "../../trabajo/ceo/.claude/settings.json"],
                ["--settings=../../trabajo/ceo/.claude/settings.json"],
                ["--add-dir", "../../trabajo"],
                ["--add-dir", "./../../trabajo/ceo"],
            ):
                with self.subTest(perfil=perfil, args=args):
                    r = self.motor(herramienta, perfil, args)
                    self.assertEqual(r.returncode, 66, r.stderr)
                    self.assertIsNone(self.leer())

    def test_relativa_dentro_de_la_carpeta_del_motor_si_corre(self):
        r = self.motor("claude", "ceo", ["--add-dir", "notas", "--settings", "./.claude/settings.json"])
        self.assertEqual(r.returncode, 0, r.stderr)

    # Tercera vuelta del DG (H2, MEDIA): una ruta bajo trabajo/ que todavía no existe también cuenta.
    def test_ruta_de_los_glm_que_aun_no_existe_no_corre(self):
        futura = self.trabajo_glm / "ceo" / ".claude" / "settings.json"
        self.assertFalse(futura.exists())
        self.rechazada(["--settings", _barra(futura)])
        self.rechazada([f"--plugin-dir={_barra(self.trabajo_glm / 'nueva')}"])

    # Riesgos BAJOS de la aprobación de la #407 (2026-11-07). Riesgo 2: el motor puede expandir ~
    # a la casa de su usuario; dtd-motor la leería como una relativa dentro de su carpeta.
    def test_ruta_que_empieza_por_virgulilla_no_corre(self):
        for herramienta, perfil in (("claude", "ceo"), ("codex", "auxiliar")):
            for args in (
                ["--add-dir", "~/../../srv/oficina/trabajo"],
                ["--settings=~/../../srv/oficina/trabajo/ceo/.claude/settings.json"],
                ["--add-dir", "~agentes-run/x"],
                # En Windows, MSYS expande una ~ suelta antes de que llegue a bash.
                *([["~"]] if POSIX else []),
            ):
                with self.subTest(herramienta=herramienta, args=args):
                    self.salida.unlink(missing_ok=True)
                    r = self.motor(herramienta, perfil, args)
                    self.assertEqual(r.returncode, 66, r.stderr)
                    self.assertIsNone(self.leer(), "no debe llegar a dtd-agente-run")

    def test_virgulilla_que_no_va_al_inicio_si_corre(self):
        r = self.motor("claude", "ceo", ["--add-dir", "notas/~viejo", "-p", "hola ~"])
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(self.leer()[0], ["claude", "--add-dir", "notas/~viejo", "-p", "hola ~"])

    # Riesgo 3: Codex 0.163.0 resuelve -C/--cd desde su cwd, lo vuelve la raíz del proyecto y
    # resuelve desde ahí las --add-dir relativas. dtd-agente-run solo revisa motores/<perfil>.
    def test_codex_no_acepta_cambiar_de_carpeta(self):
        for args in (
            ["-C", "notas"],
            ["-C/tmp/x"],
            ["-C=/tmp/x"],
            ["--cd", "/tmp/x"],
            ["--cd=/tmp/x"],
            ["exec", "--json", "-C", "notas", "--add-dir", "../../../trabajo"],
        ):
            with self.subTest(args=args):
                self.salida.unlink(missing_ok=True)
                r = self.motor("codex", "auxiliar", args)
                self.assertEqual(r.returncode, 66, r.stderr)
                self.assertIsNone(self.leer(), "no debe llegar a dtd-agente-run")

    def test_codex_sin_cambio_de_carpeta_si_corre(self):
        args = ["exec", "--json", "-c", "model_reasoning_effort=high", "--add-dir", "notas", "-"]
        r = self.motor("codex", "auxiliar", args)
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(self.leer()[0], ["codex", *args])

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
        # Las carpetas de los motores van aparte de /srv/oficina/trabajo, que escribe agentes-run.
        self.trabajo = self.tmp / "motores"
        for d in ("ceo", "auxiliar"):
            (self.trabajo / d).mkdir(parents=True)
            if POSIX:
                (self.trabajo / d).chmod(0o700)
        if POSIX:
            self.trabajo.chmod(0o755)
            self.tmp.chmod(0o755)
        # La carpeta que escriben los GLM (/srv/oficina/trabajo), aparte de la de los motores.
        # Con la ruta larga: en Windows, bash resuelve las relativas con ella y no con la 8.3.
        (self.tmp / "trabajo-glm" / "ceo" / ".claude").mkdir(parents=True)
        self.glm = Path(os.path.realpath(self.tmp / "trabajo-glm"))
        (self.glm / "ceo" / ".claude" / "settings.json").write_text("{}")
        for nombre in ("claude", "codex", "opencode", "hermes"):
            self.falso(nombre)
        texto = (RAIZ / "dtd-agente-run").read_text()
        for viejo, nuevo in {
            "/opt/agentes-cli/bin": _barra(self.bin),
            "/opt/hermes/bin/hermes": _barra(self.bin / "hermes"),
            'casa="/home/$yo"': f'casa="{_barra(self.home)}/$yo"',
            "/home/agentes-run": _barra(self.home / "agentes-run"),
            "MOTORES=/srv/oficina/motores": f"MOTORES={_barra(self.trabajo)}",
            "TRABAJO=/srv/oficina/trabajo": f'TRABAJO="{_barra(self.glm)}"',
            "TOPE=/": f"TOPE={_barra(self.tmp)}",
            "DUENO_SEGURO=0": "DUENO_SEGURO=$(id -u)",
            '"$(id -un)"': '"$USUARIO_FALSO"',
        }.items():
            self.assertIn(viejo, texto, f"falta {viejo!r} en dtd-agente-run")
            texto = texto.replace(viejo, nuevo)
        self.script = self.tmp / "dtd-agente-run"
        self.script.write_text(texto, newline="\n")

    def run_(self, herramienta, perfil, usuario, args=("--version",)):
        env = {"DTD_PERFIL": perfil} if perfil is not None else {}
        env.update(
            {
                "USUARIO_FALSO": usuario,
                "ANTHROPIC_API_KEY": "x",
                "ANTHROPIC_AUTH_TOKEN": "x",
                "OPENAI_API_KEY": "x",
                "CLAUDE_CODE_OAUTH_TOKEN": "x",
                "HERMES_EPHEMERAL_SYSTEM_PROMPT": "x",
            }
        )
        self.salida.unlink(missing_ok=True)
        return self.correr(self.script, [herramienta, *args], env)

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
        self.assertEqual(puestas, {"HERMES_EPHEMERAL_SYSTEM_PROMPT"}, "Hermes recibe sus instrucciones y nada más")
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

    # Revisión del DG (2026-11-07, ALTA): un agente GLM podía escribir en la carpeta de ALFRED un
    # .claude/settings.json con hooks o un .mcp.json; Claude los carga con -p y correrían con el
    # token de Sam. El motor no arranca si su carpeta, lo que carga de ella o un padre los puede
    # escribir alguien más.
    def insegura(self, herramienta, perfil, usuario):
        r = self.run_(herramienta, perfil, usuario)
        self.assertEqual(r.returncode, 66, f"{herramienta}: {r.stderr}")
        self.assertIsNone(self.leer(), "no debe arrancar el motor")

    MOTORES = (("claude", "ceo", "agentes-alfred"), ("codex", "auxiliar", "agentes-auxiliar"))

    def test_carpeta_del_motor_no_es_la_de_los_glm(self):
        texto = (RAIZ / "dtd-agente-run").read_text()
        self.assertNotIn("cd /srv/oficina/trabajo", texto)

    def test_carpeta_escribible_por_grupo_u_otros_no_arranca(self):
        if not POSIX:
            self.skipTest("los permisos se prueban en Linux")
        for herramienta, perfil, usuario in self.MOTORES:
            for modo in (0o770, 0o2770, 0o707, 0o777):
                with self.subTest(herramienta=herramienta, modo=oct(modo)):
                    (self.trabajo / perfil).chmod(modo)
                    self.insegura(herramienta, perfil, usuario)
            (self.trabajo / perfil).chmod(0o700)

    def test_configuracion_del_proyecto_escribible_por_otros_no_arranca(self):
        if not POSIX:
            self.skipTest("los permisos se prueban en Linux")
        casos = {
            "ceo": [".claude/settings.json", ".claude/settings.local.json", ".mcp.json", "CLAUDE.md"],
            "auxiliar": ["AGENTS.md", ".codex/config.toml"],
        }
        for herramienta, perfil, usuario in self.MOTORES:
            for rel in casos[perfil]:
                with self.subTest(herramienta=herramienta, archivo=rel):
                    f = self.trabajo / perfil / rel
                    f.parent.mkdir(parents=True, exist_ok=True)
                    f.write_text("{}")
                    f.chmod(0o666)
                    self.insegura(herramienta, perfil, usuario)
                    f.chmod(0o644)
                    if f.parent != self.trabajo / perfil:
                        f.parent.chmod(0o777)
                        self.insegura(herramienta, perfil, usuario)
                        f.parent.chmod(0o755)
                    r = self.run_(herramienta, perfil, usuario)
                    self.assertEqual(r.returncode, 0, r.stderr)

    def test_configuracion_del_proyecto_como_enlace_no_arranca(self):
        if not POSIX:
            self.skipTest("los enlaces se prueban en Linux")
        afuera = self.tmp / "hooks.json"
        afuera.write_text("{}")
        for herramienta, perfil, usuario in self.MOTORES:
            nombre = ".mcp.json" if perfil == "ceo" else "AGENTS.md"
            enlace = self.trabajo / perfil / nombre
            with self.subTest(herramienta=herramienta):
                os.symlink(afuera, enlace)
                self.insegura(herramienta, perfil, usuario)
                enlace.unlink()

    def test_carpeta_que_es_enlace_no_arranca(self):
        if not POSIX:
            self.skipTest("los enlaces se prueban en Linux")
        real = self.tmp / "real-ceo"
        real.mkdir(mode=0o700)
        shutil.rmtree(self.trabajo / "ceo")
        os.symlink(real, self.trabajo / "ceo")
        self.insegura("claude", "ceo", "agentes-alfred")

    def test_padre_escribible_no_arranca(self):
        if not POSIX:
            self.skipTest("los permisos se prueban en Linux")
        self.trabajo.chmod(0o777)
        for herramienta, perfil, usuario in self.MOTORES:
            with self.subTest(herramienta=herramienta):
                self.insegura(herramienta, perfil, usuario)
        self.trabajo.chmod(0o755)

    def test_carpeta_inexistente_no_arranca(self):
        shutil.rmtree(self.trabajo / "ceo")
        self.insegura("claude", "ceo", "agentes-alfred")

    # Riesgo BAJO 1 de la aprobación de la #407 (2026-11-07): dtd-motor corre como agentes y no ve
    # los enlaces dentro de motores/<perfil> (700 del usuario del motor). Un enlace notas ->
    # trabajo/ceo, creado por el motor, le pasaría. dtd-agente-run lo revisa como ese usuario.
    def con_args(self, herramienta, perfil, usuario, args):
        r = self.run_(herramienta, perfil, usuario, args)
        self.assertEqual(r.returncode, 66, f"{herramienta} {args}: {r.stderr}")
        self.assertIsNone(self.leer(), "no debe arrancar el motor")

    def test_enlace_dentro_de_la_carpeta_del_motor_hacia_los_glm_no_arranca(self):
        if not POSIX:
            self.skipTest("los enlaces se prueban en Linux")
        for herramienta, perfil, usuario in self.MOTORES:
            os.symlink(self.glm / "ceo", self.trabajo / perfil / "notas")
            for args in (
                ["--add-dir", "notas"],
                ["--settings", "notas/.claude/settings.json"],
                ["--settings=./notas/.claude/settings.json"],
                ["--add-dir", "notas/nueva"],
            ):
                with self.subTest(herramienta=herramienta, args=args):
                    self.con_args(herramienta, perfil, usuario, args)

    def test_ruta_hacia_los_glm_no_arranca_aunque_no_pase_por_dtd_motor(self):
        for herramienta, perfil, usuario in self.MOTORES:
            for args in (
                ["--add-dir", _barra(self.glm)],
                [f"--settings={_barra(self.glm / 'ceo' / '.claude' / 'settings.json')}"],
                # En Windows bash resuelve el cwd con la ruta 8.3; la relativa se prueba en Linux.
                *([["--add-dir", "../../trabajo-glm/ceo"]] if POSIX else []),
            ):
                with self.subTest(herramienta=herramienta, args=args):
                    self.con_args(herramienta, perfil, usuario, args)

    def test_argumentos_comunes_si_arrancan(self):
        if POSIX:
            (self.trabajo / "ceo" / "notas").mkdir()
        args = ["-p", "hola", "--effort", "high", "--add-dir", "notas", "--settings=./x.json", ""]
        for herramienta, perfil, usuario in self.MOTORES:
            with self.subTest(herramienta=herramienta):
                r = self.run_(herramienta, perfil, usuario, args)
                self.assertEqual(r.returncode, 0, r.stderr)
                self.assertEqual(self.leer()[0], args)

    def test_hermes_si_trabaja_en_la_carpeta_de_los_glm(self):
        args = ["--cwd", _barra(self.glm / "ceo")]
        r = self.run_("hermes", "ceo", "agentes-run", args)
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(self.leer()[0], args)


class Archivos(unittest.TestCase):
    """Lo que no se ejecuta en las pruebas pero sí se instala."""

    # Las variables PAPERCLIP_* que usan los agentes (skills de Paperclip y adaptador de Hermes,
    # medido en 2026.1012.0 el 2026-11-07). El servidor tiene además PAPERCLIP_AGENT_JWT_SECRET y
    # PAPERCLIP_TOOL_ACTION_SIGNING_SECRET, que con un comodín llegaban a todos los agentes.
    PAPERCLIP = [
        "PAPERCLIP_API_URL", "PAPERCLIP_API_BASE", "PAPERCLIP_API_KEY", "PAPERCLIP_AGENT_ID",
        "PAPERCLIP_COMPANY_ID", "PAPERCLIP_RUN_ID", "PAPERCLIP_TASK_ID", "PAPERCLIP_WAKE_REASON",
        "PAPERCLIP_WAKE_COMMENT_ID", "PAPERCLIP_WAKE_PAYLOAD_JSON", "PAPERCLIP_APPROVAL_ID",
        "PAPERCLIP_APPROVAL_STATUS", "PAPERCLIP_LINKED_ISSUE_IDS", "PAPERCLIP_HELPER_STATE_DIR",
    ]
    LINEAS = [
        "Defaults!/usr/local/libexec/dtd-agente-run env_reset",
        "Defaults!/usr/local/libexec/dtd-agente-run env_keep = \""
        + " ".join(PAPERCLIP + ["HERMES_EPHEMERAL_SYSTEM_PROMPT", "DTD_PERFIL", "CLAUDE_CODE_OAUTH_TOKEN", "TERM", "LANG", "LC_ALL", "LC_CTYPE"])
        + "\"",
        "Defaults!/usr/local/libexec/dtd-agente-run !log_allowed",
        "agentes ALL=(agentes-run, agentes-alfred, agentes-auxiliar) NOPASSWD: /usr/local/libexec/dtd-agente-run",
    ]

    def test_sudoers_es_exactamente_lo_esperado(self):
        texto = (RAIZ / "91-agentes-run").read_text()
        reglas = [l for l in texto.splitlines() if l.strip() and not l.lstrip().startswith("#")]
        self.assertEqual(reglas, self.LINEAS, "ni una línea de más ni de menos")

    def test_sudoers_deja_pasar_las_instrucciones_de_hermes(self):
        # Paperclip 1023+ manda las instrucciones de los GLM en esta variable (PR #409, §2.5).
        # Sin ella, sudo la borra y los agentes de Hermes corren sin su puesto ni la API.
        keep = [l for l in (RAIZ / "91-agentes-run").read_text().splitlines() if "env_keep" in l]
        self.assertIn("HERMES_EPHEMERAL_SYSTEM_PROMPT", keep[0].split('"')[1].split())

    def test_sudoers_sin_comodines_ni_secretos(self):
        keep = [l for l in (RAIZ / "91-agentes-run").read_text().splitlines() if "env_keep" in l]
        self.assertEqual(len(keep), 1)
        variables = keep[0].split('"')[1].split()
        for v in variables:
            with self.subTest(variable=v):
                self.assertNotIn("*", v)
                self.assertNotRegex(v, "SECRET|JWT|SIGNING|PASSWORD")
        self.assertEqual(len(variables), len(set(variables)))

    def test_sudoers_pasa_visudo(self):
        visudo = shutil.which("visudo") or ("/usr/sbin/visudo" if os.path.exists("/usr/sbin/visudo") else None)
        if not visudo:
            self.skipTest("visudo no está en esta máquina")
        r = subprocess.run([visudo, "-c", "-q", "-f", str(RAIZ / "91-agentes-run")], capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)

    def test_no_se_promete_ocultar_procesos(self):
        # Sin hidepid en /proc, cualquier usuario ve los procesos y sus argumentos.
        # La spec se busca desde estas pruebas (los mutantes copian solo los envoltorios).
        spec = AQUI.parents[3] / "docs/specs/0615-oficina-motores-claude-codex/spec.md"
        self.assertTrue(spec.exists(), spec)
        for ruta in (RAIZ / "dtd-motor", RAIZ / "README.md", spec):
            with self.subTest(ruta=ruta.name):
                texto = ruta.read_text(encoding="utf-8")
                self.assertNotRegex(texto, r"(?i)ni (ver )?(sus|los) procesos")
                self.assertNotRegex(texto, r"(?i)no (puede|pueden) ver (sus|los) procesos")

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
