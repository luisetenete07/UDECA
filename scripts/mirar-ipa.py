#!/usr/bin/env python3
"""
Enseñar qué lleva dentro un .ipa ya descomprimido.

Lo usa .github/workflows/diagnostico-ios.yml. Existe porque la app se cierra
nada más abrirse en el iPhone y llevamos cuatro causas descartadas a base de
compilar y probar, a cuarenta minutos por intento. Esto no adivina: abre el
paquete y lee.

Lo que mira, y por qué cada cosa puede cerrar una app al abrirla:

  - EL PAQUETE DE JAVASCRIPT. Si `main.jsbundle` no está o está vacío, la app
    arranca, no encuentra qué ejecutar y se cierra. Es el fallo que mejor encaja
    con "pantalla negra un instante y fuera".
  - LOS PERMISOS FIRMADOS. Si el binario pide un permiso que el perfil de
    aprovisionamiento no lleva, iOS mata la app al abrirla, sin mensaje.
  - LOS FRAMEWORKS INCRUSTADOS. Un framework que se enlaza pero no viaja dentro
    del paquete revienta en el cargador, antes de que corra nada.
  - EL INFO.PLIST. Un ejecutable que no existe, o una versión mínima de iOS más
    alta que la del teléfono, y la app no llega ni a empezar.

No enseña nada secreto: la clave privada de firma no viaja dentro de un .ipa.

    python3 scripts/mirar-ipa.py <carpeta-descomprimida>
"""
import plistlib
import re
import sys
from pathlib import Path


def titulo(t):
    print(f"\n{'=' * 70}\n{t}\n{'=' * 70}")


def humano(n):
    for u in ('B', 'KB', 'MB'):
        if n < 1024:
            return f'{n:.0f} {u}'
        n /= 1024
    return f'{n:.1f} GB'


raiz = Path(sys.argv[1] if len(sys.argv) > 1 else 'dentro')
apps = list((raiz / 'Payload').glob('*.app'))
if not apps:
    print('✖ No hay ninguna .app dentro del Payload. El .ipa no es lo que parece.')
    sys.exit(1)
app = apps[0]
print(f'App: {app.name}')

# --- Info.plist -------------------------------------------------------------
titulo('Info.plist')
info = {}
try:
    with open(app / 'Info.plist', 'rb') as f:
        info = plistlib.load(f)
    for clave in (
        'CFBundleExecutable', 'CFBundleIdentifier', 'CFBundleShortVersionString',
        'CFBundleVersion', 'MinimumOSVersion', 'UILaunchStoryboardName',
        'UIRequiredDeviceCapabilities', 'CFBundleURLTypes', 'UIBackgroundModes',
    ):
        if clave in info:
            print(f'  {clave}: {info[clave]}')
    permisos = {k: v for k, v in info.items() if k.endswith('UsageDescription')}
    print(f'  textos de permiso: {len(permisos)}')
    for k in sorted(permisos):
        print(f'      {k}')
except Exception as e:  # noqa: BLE001
    print(f'  ✖ no se ha podido leer: {e}')

# --- El ejecutable ----------------------------------------------------------
titulo('El ejecutable')
nombre = info.get('CFBundleExecutable', 'UDECA')
binario = app / nombre
if binario.exists():
    print(f'  ✔ {nombre} — {humano(binario.stat().st_size)}')
else:
    print(f'  ✖ NO EXISTE el ejecutable "{nombre}" que declara el Info.plist')

# --- El paquete de JavaScript ----------------------------------------------
titulo('El paquete de JavaScript (esto es lo que ejecuta la app)')
encontrados = list(app.rglob('main.jsbundle')) + list(app.rglob('*.jsbundle'))
if not encontrados:
    print('  ✖ NO HAY NINGÚN .jsbundle DENTRO DEL PAQUETE.')
    print('    La app arrancaría, no encontraría qué ejecutar y se cerraría.')
else:
    for b in encontrados:
        tam = b.stat().st_size
        marca = '✔' if tam > 100_000 else '✖ SOSPECHOSAMENTE PEQUEÑO'
        print(f'  {marca} {b.relative_to(app)} — {humano(tam)}')

# Los .hbc son el mismo paquete ya compilado por Hermes.
hbc = list(app.rglob('*.hbc'))
for b in hbc:
    print(f'  · {b.relative_to(app)} — {humano(b.stat().st_size)} (Hermes)')

# --- Los frameworks ---------------------------------------------------------
titulo('Frameworks incrustados')
fw = app / 'Frameworks'
if not fw.exists():
    print('  (no hay carpeta Frameworks)')
else:
    for f in sorted(fw.iterdir()):
        interno = f / f.name.replace('.framework', '')
        detalle = ''
        if f.name.endswith('.framework'):
            detalle = ' ✔' if interno.exists() else '  ✖ SIN BINARIO DENTRO'
        print(f'  {f.name}{detalle}')

# --- Los permisos que van firmados -----------------------------------------
titulo('Permisos del perfil de aprovisionamiento')
perfil = app / 'embedded.mobileprovision'
if not perfil.exists():
    print('  (sin perfil incrustado: es una compilación de simulador)')
else:
    crudo = perfil.read_bytes()
    m = re.search(rb'<\?xml.*?</plist>', crudo, re.S)
    if not m:
        print('  ✖ no se ha podido leer el perfil')
    else:
        p = plistlib.loads(m.group(0))
        print(f'  Nombre: {p.get("Name")}')
        print(f'  Equipo: {p.get("TeamName")} {p.get("TeamIdentifier")}')
        print(f'  Caduca: {p.get("ExpirationDate")}')
        ent = p.get('Entitlements', {})
        print('  Permisos que CONCEDE el perfil:')
        for k in sorted(ent):
            if k in ('com.apple.developer.team-identifier', 'application-identifier'):
                continue
            print(f'      {k}: {ent[k]}')

# --- Lo que PIDE el binario, contra lo que concede el perfil ---------------
titulo('Permisos que PIDE el binario')
if binario.exists():
    crudo = binario.read_bytes()
    # Los entitlements van firmados dentro del Mach-O como un plist XML suelto.
    pedidos = {}
    for m in re.finditer(rb'<\?xml[^<]*<!DOCTYPE plist.*?</plist>', crudo, re.S):
        try:
            d = plistlib.loads(m.group(0))
        except Exception:  # noqa: BLE001
            continue
        if isinstance(d, dict) and any(
            k.startswith(('com.apple.', 'application-identifier', 'aps-')) for k in d
        ):
            pedidos.update(d)
    if not pedidos:
        print('  (no se han encontrado permisos legibles en el binario)')
    else:
        for k in sorted(pedidos):
            print(f'      {k}: {pedidos[k]}')
        if perfil.exists() and m:
            faltan = [
                k for k in pedidos
                if k not in ent and k not in ('application-identifier',
                                              'com.apple.developer.team-identifier')
            ]
            print()
            if faltan:
                print('  ✖ EL BINARIO PIDE PERMISOS QUE EL PERFIL NO CONCEDE:')
                for k in faltan:
                    print(f'      {k}')
                print('    iOS cierra la app al abrirla cuando esto pasa.')
            else:
                print('  ✔ Todo lo que pide el binario está en el perfil.')

# --- Lo que el binario ENLAZA, contra lo que de verdad VIAJA dentro --------
#
# Esta es la comprobación que caza el fallo clásico de "se cierra al abrirse":
# el ejecutable declara que necesita un framework, el cargador de iOS lo busca
# al arrancar, no lo encuentra dentro del paquete y mata el proceso. Antes de
# que corra una sola línea de la app, sin mensaje y sin pantalla.
#
# Es exactamente lo que Apple nombró en su aviso ITMS-90863, y lo que ya pasó
# una vez con RNWorklets.framework.
titulo('Frameworks que el binario NECESITA (y si viajan dentro)')


def dylibs_de(ruta):
    """Los frameworks que declara un Mach-O, leyendo sus load commands."""
    import struct
    datos = ruta.read_bytes()
    (magico,) = struct.unpack('<I', datos[:4])
    cabeceras = []
    if magico in (0xCAFEBABE, 0xBEBAFECA):  # binario universal
        (n,) = struct.unpack('>I', datos[4:8])
        for i in range(n):
            off = 8 + i * 20
            (desplaz,) = struct.unpack('>I', datos[off + 8:off + 12])
            cabeceras.append(desplaz)
    else:
        cabeceras.append(0)

    nombres = set()
    for base in cabeceras:
        (mag,) = struct.unpack('<I', datos[base:base + 4])
        if mag != 0xFEEDFACF:  # solo 64 bits
            continue
        ncmds = struct.unpack('<I', datos[base + 16:base + 20])[0]
        pos = base + 32
        for _ in range(ncmds):
            cmd, tam = struct.unpack('<II', datos[pos:pos + 8])
            # LC_LOAD_DYLIB, LC_LOAD_WEAK_DYLIB, LC_REEXPORT_DYLIB, LC_LOAD_UPWARD
            if cmd in (0x0C, 0x18 | 0x80000000, 0x1F, 0x23 | 0x80000000):
                (desplaz,) = struct.unpack('<I', datos[pos + 8:pos + 12])
                crudo = datos[pos + desplaz:pos + tam]
                nombres.add(crudo.split(b'\x00')[0].decode('utf-8', 'replace'))
            pos += tam
    return nombres


if binario.exists():
    try:
        enlazados = dylibs_de(binario)
    except Exception as e:  # noqa: BLE001
        enlazados = set()
        print(f'  (no se ha podido leer el binario: {e})')

    dentro = {f.name for f in fw.iterdir()} if fw.exists() else set()
    faltan = []
    for d in sorted(enlazados):
        if not d.startswith('@rpath/'):
            continue
        pieza = d[len('@rpath/'):].split('/')[0]
        if pieza.endswith('.framework') or pieza.endswith('.dylib'):
            marca = '✔' if pieza in dentro else '✖ NO ESTÁ DENTRO DEL PAQUETE'
            if pieza not in dentro:
                faltan.append(pieza)
            print(f'  {marca}  {pieza}')
    if faltan:
        print()
        print('  ✖✖✖ AQUÍ ESTÁ EL FALLO.')
        print('      El ejecutable necesita estos frameworks y no viajan dentro.')
        print('      iOS los busca al arrancar, no los encuentra y cierra la app,')
        print('      antes de que corra una sola línea. Sin mensaje.')
    elif enlazados:
        print('\n  ✔ Todo lo que el binario necesita viaja dentro del paquete.')

    # Y las carpetas donde el cargador buscará (@rpath).
    print('\n  Sitios donde iOS buscará (LC_RPATH):')
    try:
        import struct as _s
        datos = binario.read_bytes()
        (mag,) = _s.unpack('<I', datos[:4])
        if mag == 0xFEEDFACF:
            ncmds = _s.unpack('<I', datos[16:20])[0]
            pos = 32
            for _ in range(ncmds):
                cmd, tam = _s.unpack('<II', datos[pos:pos + 8])
                if cmd == (0x1C | 0x80000000):
                    (desplaz,) = _s.unpack('<I', datos[pos + 8:pos + 12])
                    crudo = datos[pos + desplaz:pos + tam]
                    print('      ' + crudo.split(b'\x00')[0].decode('utf-8', 'replace'))
                pos += tam
    except Exception:  # noqa: BLE001
        pass

# --- Y AHORA LOS FRAMEWORKS ENTRE SÍ --------------------------------------
#
# El hueco que tenía esta comprobación: miraba lo que necesita el EJECUTABLE,
# pero no lo que se necesitan los frameworks unos a otros. Y un framework puede
# enlazar contra otro que no viaja dentro —por ejemplo, si se quitó del proyecto
# una librería de la que otra seguía dependiendo—. El cargador de iOS resuelve
# esa cadena entera al arrancar: si falta un eslabón CUALQUIERA, mata el
# proceso. Da igual que el ejecutable esté perfecto.
titulo('Y qué necesitan los frameworks unos de otros')
if fw.exists():
    dentro = {f.name for f in fw.iterdir()}
    rotos = []
    for carpeta in sorted(fw.iterdir()):
        if not carpeta.name.endswith('.framework'):
            continue
        binario_fw = carpeta / carpeta.name.replace('.framework', '')
        if not binario_fw.exists():
            continue
        try:
            necesita = dylibs_de(binario_fw)
        except Exception as e:  # noqa: BLE001
            print(f'  {carpeta.name}: no se ha podido leer ({e})')
            continue
        faltan_aqui = []
        for d in sorted(necesita):
            if not d.startswith('@rpath/'):
                continue
            pieza = d[len('@rpath/'):].split('/')[0]
            if not (pieza.endswith('.framework') or pieza.endswith('.dylib')):
                continue
            if pieza == carpeta.name:
                continue
            if pieza not in dentro:
                faltan_aqui.append(pieza)
        if faltan_aqui:
            rotos.append((carpeta.name, faltan_aqui))
            print(f'  ✖ {carpeta.name} necesita: {", ".join(faltan_aqui)}  <== NO ESTÁN')
        else:
            print(f'  ✔ {carpeta.name}')
    if rotos:
        print()
        print('  ✖✖✖ AQUÍ ESTÁ EL FALLO.')
        print('      Estos frameworks necesitan otros que no viajan dentro del')
        print('      paquete. iOS resuelve toda esa cadena al arrancar; si falta')
        print('      un eslabón, cierra la app antes de ejecutar nada.')
    else:
        print()
        print('  ✔ Ningún framework necesita nada que no esté dentro.')

# --- La pantalla de arranque que declara el Info.plist ---------------------
titulo('La pantalla de arranque')
guion = info.get('UILaunchStoryboardName')
if not guion:
    print('  (el Info.plist no declara ninguna)')
else:
    hay_guion = list(app.glob(f'{guion}.storyboardc')) + list(app.glob(f'{guion}.*'))
    if hay_guion:
        for g in hay_guion:
            print(f'  ✔ {guion} → {g.name}')
    else:
        print(f'  ✖ El Info.plist declara "{guion}" y NO ESTÁ en el paquete.')
        print('    iOS no puede montar la pantalla de arranque y cierra la app.')

# --- Todo lo que hay, por si falta algo evidente ---------------------------
titulo('Todos los ficheros del paquete')
for f in sorted(app.rglob('*')):
    if f.is_file():
        print(f'  {f.relative_to(app)}')

# --- Lo más gordo del paquete ----------------------------------------------
titulo('Lo más grande que hay dentro (por si falta o sobra algo)')
todo = sorted(
    ((f.stat().st_size, f) for f in app.rglob('*') if f.is_file()),
    reverse=True,
)
for tam, f in todo[:15]:
    print(f'  {humano(tam):>9}  {f.relative_to(app)}')
print(f'\n  {len(todo)} ficheros en total')
