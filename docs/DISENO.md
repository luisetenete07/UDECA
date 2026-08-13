# Diseño

Cómo se ve y cómo se comporta UDECA, y por qué. Esto no es una guía de estilo
decorativa: son las decisiones que hay que respetar para que una pantalla nueva
no desentone con las que ya están.

---

## 1 · A qué aspira

Élite, prestigio, rendimiento, disciplina, tecnología. Una herramienta que un
entrenador abre veinte veces al día y que no le hace perder ni un segundo.

Tres reglas mandan sobre todas las demás:

1. **El entrenador es la prioridad.** Al abrir el panel tiene que saber en menos
   de tres segundos quién ha entrenado, quién no, qué pagos faltan, quién lleva
   días parado, quién mejora y quién empeora.
2. **Poco texto.** Si algo se puede decir con una forma, un color o una cifra,
   no se dice con una frase.
3. **Todo lo que se toca, responde.** Sin respuesta al tacto, cada pulsación
   deja medio segundo de duda, y esa duda se recuerda como "va lenta".

Y una prohibición: **nada de emojis**, en ningún sitio del producto.

---

## 2 · Color

Fondo negro de verdad (`#000000`), superficies casi negras y **un solo color de
marca**: el oro apagado. El resto son señales, y se usan con cuentagotas.

| Token | Para qué |
| --- | --- |
| `background` `#000000` | El fondo. Negro real, no gris oscuro |
| `surface` `#0D0D0D` | Tarjetas |
| `surfaceAlt` `#181818` | Campos, pastillas, huecos |
| `primary` `#A2968B` | La marca. Lo que manda en la pantalla |
| `primaryBright` `#C9BDB0` | El mismo oro cuando tiene que cantar |
| `border` `rgba(255,255,255,0.07)` | Bordes casi invisibles: se intuyen |
| `borderStrong` `#2A2A2A` | Cuando el borde sí tiene que verse |
| `scrim` `rgba(0,0,0,0.7)` | El velo detrás de todo lo que se abre encima |
| `danger` / `warning` / `success` | Señales. Nunca decoración |

Las señales van **en relleno apagado con borde de color**, no en bloques de
color liso. En una pantalla de negros reales, un verde saturado se lleva la
vista entera y tapa lo que de verdad importa.

---

## 3 · Tipografía

Dos familias, y cada una en lo suyo:

- **Sora** (`fonts.display`) para los títulos grandes. Es la voz de la marca.
- **Inter** (`fonts.body` / `medium` / `semiBold` / `heading`) para todo lo
  demás: se lee bien pequeña y no compite.

El interletrado se aprieta según crece el tamaño (`hero` −1, `h1` −0,7,
`h2` −0,4, `h3` −0,2). Una tipografía de titular con el espaciado por defecto
se lee suelta y barata.

`typography.label` es la excepción: va en mayúsculas y con +1,4 de espaciado,
porque una etiqueta corta en mayúsculas sin aire se lee apelmazada.

**Las fechas se escriben en español.** `textTransform: 'capitalize'` deja
"Agosto De 2026"; se usa `lib/fechas.ts` (`mesLargo`, `diaLargo`,
`mayusculaInicial`), que pone mayúscula solo en la primera letra.

---

## 4 · Piezas que ya existen

Antes de montar una nueva, mirar si ya está:

| Componente | Qué resuelve |
| --- | --- |
| `Segmented` | Selector de 2-3 opciones. La pastilla **se desliza** |
| `ScreenHeader` | Rótulo, título, subtítulo y acciones. El título manda sobre los botones |
| `SessionHeader` | Cabecera de la sesión de entreno: anillo, día y menú |
| `ProgressRing` | Anillo que se cierra. Un hueco pide cerrarse; una barra no pide nada |
| `CountUp` | Una cifra que sube al entrar en pantalla |
| `PressableScale` | Se hunde al pulsar y vuelve con muelle |
| `QuickSheet` | Acciones rápidas al mantener pulsado |
| `CollapsibleCard` | Tarjeta que se pliega y recuerda cómo la dejaste |
| `MacroSum` | Lo que suman unos macros, mientras se escriben |
| `DashboardSkeleton` | La forma de lo que viene, mientras carga |
| `TextField` | Campo de texto. El borde **entra** al enfocar |
| `ProgressCard` | El carné: foco, identidad dentro y una cifra cada vez |
| `PRBurst` / `Confetti` | La celebración de un récord |

---

## 5 · Movimiento

Las animaciones no son adorno; cada una hace un trabajo:

- **Entrada escalonada** (`FadeIn` con `delay`) en las pantallas de inicio: la
  pantalla se cuenta sola de arriba abajo en vez de aparecer de golpe.
- **Deslizar, no encender.** La pastilla de `Segmented` se mueve; si apareciera
  en la opción nueva serían dos botones encendiéndose, no una cosa que cambia.
- **Esqueletos, no ruletas.** Un spinner dice "espera"; un esqueleto ya tiene la
  forma de lo que viene, así que al llegar los datos no se mueve nada de sitio.
- **Optimista primero.** Marcar una tarea o guardar una semana se pinta al
  instante y se deshace con aviso si el servidor dice que no.
- **Objetos, no pantallas.** La tarjeta se inclina en 3D al arrastrarla y el
  foco de luz barre su cara. No sirve para nada y es el motivo: algo que
  responde al tacto se siente objeto, y a un carné que quieres enseñar eso le
  importa más que cualquier dato de más.
- **Un gesto no puede robarle el suyo a otro.** Lo que vive dentro de una
  pantalla que se desplaza solo se queda los arrastres de su eje: la tarjeta
  gira en horizontal y deja el vertical para el scroll. Y si hay texto por
  medio, `userSelect: 'none'` — arrastrar sobre texto inicia una selección y el
  navegador se lleva el gesto sin avisar.
- **Sin native driver donde no se puede.** Color de borde y `strokeDashoffset`
  se animan en JS (`useNativeDriver: false`); posición y escala, en nativo.

---

## 6 · Reglas de escritura

- Se habla **de tú**, en español de España, y sin jerga de producto.
- Los plurales se escriben: "6 ejercicios" / "1 ejercicio", nunca
  "6 ejercicio(s)".
- Lo que hace un botón se dice **debajo del botón**, no entre paréntesis en el
  rótulo: un paréntesis largo parte el texto en dos líneas y se lee peor.
- Lo que se toca una vez al mes vive **detrás de un menú**, no ocupando una fila
  encima de lo que se usa a diario.
- Nada de emojis.

---

## 7 · Cómo se comprueba

El diseño se revisa mirándolo, no imaginándolo. El ciclo completo:

```bash
npx tsc --noEmit
node scripts/check-native-deps.mjs
# emulador con datos de prueba
firebase emulators:start --only auth,firestore --project udeca-demo
node scripts/seed-emulator.mjs
# build web apuntando al emulador
EXPO_PUBLIC_FIREBASE_PROJECT_ID=udeca-demo \
EXPO_PUBLIC_FIREBASE_EMULATOR=1 \
  npx expo export --platform web --output-dir dist-emu
npx http-server dist-emu -p 4599
```

Con eso se puede abrir cualquier pantalla con datos reales y hacerle una
captura. Hay un guion de barrido que busca textos cortados y elementos que se
salen de la pantalla: es lo que encontró "Bibliot / eca".
