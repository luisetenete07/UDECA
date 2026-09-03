/**
 * Encender R8 en las compilaciones de release de Android.
 *
 * QUÉ AVISA GOOGLE PLAY
 *
 *   "La optimización de la aplicación está por debajo de nuestro umbral.
 *    Ofuscación (1 %). Los porcentajes inferiores al 25 % pueden afectar a tu
 *    visibilidad y a tus capacidades de publicación en Google Play."
 *
 * Ese 1 % no es un defecto del código: es que la app se estaba empaquetando SIN
 * minificar. El proyecto que genera Expo trae los dos interruptores apagados:
 *
 *   android/app/build.gradle
 *     def enableMinifyInReleaseBuilds =
 *       (findProperty('android.enableMinifyInReleaseBuilds') ?: false).toBoolean()
 *     def enableShrinkResources =
 *       findProperty('android.enableShrinkResourcesInReleaseBuilds') ?: 'false'
 *
 * Así que basta con encenderlos. Esto lo hace, y de paso deja las reglas que
 * hacen falta para que lo que se ofusca siga funcionando.
 *
 * POR QUÉ UN PLUGIN Y NO EDITAR gradle.properties
 *
 * Por lo mismo que `memoria-de-gradle.js`: ese fichero no está en el
 * repositorio, lo regenera Expo en cada compilación, y cualquier cambio a mano
 * se perdería en la siguiente.
 *
 * QUÉ SE OFUSCA Y QUÉ NO
 *
 * Casi toda la app es JavaScript, y el bundle de JS no lo toca R8: R8 solo
 * trabaja sobre el Java y el Kotlin, o sea React Native, los módulos de Expo y
 * las librerías nativas. Por eso el riesgo es acotado —y por eso el porcentaje
 * subirá bastante pero no al 100 %.
 *
 * EL RIESGO, DICHO CLARO
 *
 * Minificar renombra clases. Lo que se busca por reflexión (por su nombre en
 * texto) deja de encontrarse, y eso NO se ve al compilar: revienta en el móvil,
 * en release, y a veces solo en la pantalla que usa esa librería.
 *
 * Las librerías serias traen sus propias reglas y se aplican solas: aquí las
 * traen react-native, expo, expo-modules-core, expo-notifications y
 * react-native-svg. Lo de abajo es lo que NO viene de nadie.
 *
 * Por eso esta versión hay que probarla en un móvil de verdad —canal de pruebas
 * internas— antes de mandarla a producción. No es una formalidad: es la única
 * manera de enterarse.
 */
const { withDangerousMod, withGradleProperties } = require('expo/config-plugins');
const { promises: fs } = require('fs');
const path = require('path');

const PROPIEDADES = [
  // Minificar y ofuscar: esto es lo que sube el porcentaje que mira Play.
  ['android.enableMinifyInReleaseBuilds', 'true'],
  // Y quitar los recursos que no usa nadie ("Porcentaje de reducción" en Play).
  // Solo funciona con lo anterior encendido.
  ['android.enableShrinkResourcesInReleaseBuilds', 'true'],
];

const REGLAS = `
# --- UDECA: reglas para compilar con R8 (ver plugins/optimizar-android.js) ---

# Que los informes de fallo se sigan pudiendo leer.
#
# Sin esto, una traza de producción llega con los nombres cambiados y números
# de línea inventados, y deja de servir para arreglar nada. Guardar el fichero
# y la línea no descubre el código: solo dice DÓNDE se rompió.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# Las anotaciones que React Native lee en tiempo de ejecución para enganchar
# los módulos nativos. Si se borran, los módulos existen pero nadie los
# encuentra.
-keepattributes *Annotation*, InnerClasses, Signature, Exceptions

# El puente con C++ y el motor de JavaScript. Se llaman desde código nativo
# por su nombre, así que R8 no puede ver que están en uso.
-keep class com.facebook.jni.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.react.bridge.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# expo-video usa Media3 (ExoPlayer), que carga sus piezas por reflexión.
-keep class androidx.media3.** { *; }
-dontwarn androidx.media3.**

# Los avisos de dependencias que solo existen al compilar y no acaban en el
# .aab. Sin esto, R8 corta la compilación por algo que no puede fallar.
-dontwarn javax.annotation.**
-dontwarn org.slf4j.**
`;

/**
 * Deja la lista de propiedades de Gradle con las nuestras puestas.
 *
 * Sustituye la que hubiera en vez de añadir otra igual: dos veces la misma
 * clave en `gradle.properties` gana la última, así que duplicar es una forma
 * silenciosa de que mande la que no es.
 *
 * Está aparte del plugin para poder probarla sin montar medio Expo alrededor.
 */
function conPropiedades(lista) {
  const salida = [...lista];
  for (const [key, value] of PROPIEDADES) {
    const i = salida.findIndex((p) => p.type === 'property' && p.key === key);
    const nueva = { type: 'property', key, value };
    if (i >= 0) salida[i] = nueva;
    else salida.push(nueva);
  }
  return salida;
}

module.exports = function withOptimizarAndroid(config) {
  config = withGradleProperties(config, (config) => {
    config.modResults = conPropiedades(config.modResults);
    return config;
  });

  return withDangerousMod(config, [
    'android',
    async (config) => {
      const ruta = path.join(
        config.modRequest.platformProjectRoot,
        'app',
        'proguard-rules.pro'
      );
      const actual = await fs.readFile(ruta, 'utf8');
      // Idempotente: `prebuild` sin `--clean` vuelve a pasar por aquí sobre un
      // fichero que ya las tiene, y duplicarlas no rompe pero ensucia.
      if (!actual.includes('UDECA: reglas para compilar con R8')) {
        await fs.writeFile(ruta, `${actual}${REGLAS}`);
      }
      return config;
    },
  ]);
};

// Para los guardianes: las piezas que se pueden probar sin arrancar Expo.
module.exports.PROPIEDADES = PROPIEDADES;
module.exports.REGLAS = REGLAS;
module.exports.conPropiedades = conPropiedades;
