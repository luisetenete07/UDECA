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

# --- Lo más gordo del paquete ----------------------------------------------
titulo('Lo más grande que hay dentro (por si falta o sobra algo)')
todo = sorted(
    ((f.stat().st_size, f) for f in app.rglob('*') if f.is_file()),
    reverse=True,
)
for tam, f in todo[:15]:
    print(f'  {humano(tam):>9}  {f.relative_to(app)}')
print(f'\n  {len(todo)} ficheros en total')
