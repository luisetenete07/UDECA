# Obligar a actualizar

Cómo se consigue que todo el mundo pase a una versión nueva, y —más importante—
cómo no dejar a nadie fuera por error.

---

## 0 · Lo normal: no hay que hacer nada

Desde la **1.2.0**, la app pregunta sola a la tienda cada vez que se entra (al
abrirla, o al volver tras más de media hora fuera). Si la App Store o Google
Play tienen una versión más nueva que la instalada:

| Días desde que salió | Qué ve la persona |
| --- | --- |
| Menos de 3 | Aviso "Hay una versión nueva", con **Actualizar** y **Ahora no**. "Ahora no" vale hasta la siguiente entrada. |
| 3 o más | El muro: solo se puede ir a la tienda. |

Publicar en las tiendas es todo lo que hay que hacer. Los días de margen son
para que la versión esté de verdad en todas las fichas antes del muro: la
búsqueda de Apple a veces la anuncia horas antes de que se pueda bajar.

- **iPhone:** búsqueda pública de la App Store por el id de la ficha. Si la
  versión nueva pide un iOS que el móvil no tiene, no se le avisa.
- **Android:** Google Play desde el propio móvil (`modules/calico-tienda`).
  Solo avisa si a ese móvil le toca (modelo, Android, lanzamiento escalonado).
- **Revisores:** instalan la versión que revisan, más nueva que la publicada,
  así que no ven nada.

Las versiones **anteriores a la 1.2.0** no saben preguntar a la tienda: a esas
solo les llega la mínima del servidor (abajo).

---

## 1 · La mínima del servidor: el muro inmediato

Cuando la versión instalada es **anterior** a la mínima que dice el servidor, la
app se tapa entera con un muro que no se puede cerrar y que solo ofrece ir a la
tienda. Ni se puede entrenar, ni entrar, ni ver nada.

En la **web** funciona distinto y no hace falta tocar nada: cuando hay un
despliegue nuevo, el aviso tapa la pantalla y el único botón recarga. Ahí
actualizar cuesta un segundo.

---

## 2 · Cómo se activa

Lo más cómodo: **Actions → "Versión mínima" → Run workflow**, con la versión y
"escribir" marcado. Antes de escribir pregunta a la App Store qué hay publicado
y se niega si es anterior a la mínima pedida. Google Play no se puede consultar
desde ahí: márcalo solo con la versión ya publicada en las dos tiendas. Sin
"escribir", solo comprueba.

A mano: en la consola de Firebase, colección `config`, documento **`version`**:

| Campo | Tipo | Para qué |
| --- | --- | --- |
| `minima` | string | La versión más antigua que puede seguir usándose. Ej. `1.1.0` |

Se compara con el campo `version` de `app.json`. Hace efecto en cuanto alguien
abre la app o vuelve a ella desde el segundo plano; no hay que publicar nada.

**Ejemplo.** La versión publicada es la 1.1.0 y quieres que nadie siga con la
1.0.x: pon `minima: "1.1.0"`.

---

## 3 · Las tres reglas que no se saltan

### No subas la mínima por encima de lo que hay PUBLICADO

Si pones `minima: "1.2.0"` cuando en la tienda todavía está la 1.1.0, dejas a
**todos** fuera: el muro les manda a la tienda, y en la tienda no hay ninguna
versión que valga. La app queda inservible para todo el mundo a la vez, y se
arregla volviendo a bajar el campo — pero mientras tanto no la usa nadie.

Primero se publica, se espera a que esté disponible de verdad, y **después** se
sube la mínima.

### Cuidado con las revisiones de Apple y Google

Quien revisa la app instala la versión que está revisando. Si la mínima está por
encima de esa versión, el revisor se encuentra un muro en vez de la app: no
puede probar nada y **rechaza**.

Mientras haya una versión en revisión, la mínima tiene que ser igual o menor que
ella.

### La versión se sube a mano

`version` en `app.json` no cambia sola. El número de compilación sí —lo sube EAS
en cada build—, pero **eso no es lo que se compara** a propósito: gatillar con el
número de compilación obligaría a actualizar a todo el mundo cada vez que se
compila algo, incluida una prueba que nunca se publica.

Para forzar una actualización hay que subir `version` (1.0.0 → 1.1.0) antes de
compilar.

---

## 4 · Qué pasa si algo falla

Nada. Es la decisión de diseño más importante de esta función: **ante cualquier
duda no se bloquea a nadie.**

- Sin red → no hay muro.
- Documento que no existe → no hay muro.
- `minima` vacía, mal escrita, un número, una lista → no hay muro.
- La app no sabe qué versión lleva → no hay muro.

Un muro que aparece por un fallo de red dejaría sin app a todos los usuarios a
la vez, y encima justo cuando el servidor va mal. Entre no obligar a alguien que
debería actualizar y dejar fuera a todos por un error, no hay duda.

`scripts/check-actualizar.mjs` comprueba uno por uno esos casos.

---

## 5 · Quién puede tocarlo

Solo desde la **consola de Firebase**. Las reglas dejan LEER `config/version` a
cualquiera —sin ella el muro no aparecería nunca— pero **prohíben escribirlo**
desde la app. Si se pudiera escribir, cualquiera dejaría fuera a todo el mundo
poniendo una versión altísima. Está comprobado en `scripts/check-rules.mjs`.

---

## 6 · Cómo se apaga

Borra el documento `config/version`, o pon `minima` en una versión antigua
(`0.0.0`). El muro desaparece en cuanto la app vuelve a preguntar, que es al
abrirla o al volver a ella.
