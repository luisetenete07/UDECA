/**
 * Más memoria para Gradle al compilar Android.
 *
 * EL FALLO QUE ARREGLA
 *
 * El build de Android moría siempre en el mismo sitio, y el mensaje que
 * llegaba a GitHub era inútil ("Gradle build failed with unknown error"). El de
 * verdad, dentro de EAS, era:
 *
 *   Execution failed for task ':expo-modules-core:lintVitalAnalyzeRelease'
 *   > Unexpected failure during lint analysis of Logger.kt
 *     Message: Metaspace
 *     Stack: OutOfMemoryError: ClassLoader.defineClass1...
 *
 * Es decir: la JVM de Gradle se queda sin *metaspace* —la zona donde carga las
 * clases— mientras el análisis de Lint recorre expo-modules-core. No es un
 * error del código de la app: es que el proyecto se genera con
 * `-XX:MaxMetaspaceSize=512m` y ese análisis carga muchas más clases de las que
 * caben ahí.
 *
 * POR QUÉ UN PLUGIN Y NO EDITAR gradle.properties
 *
 * Ese fichero no está en el repositorio: lo genera Expo en cada compilación
 * (proyecto "managed"), así que cualquier cambio a mano se perdería en la
 * siguiente. Esto lo escribe durante la generación, y por eso vale igual en
 * EAS, en GitHub y en el ordenador de quien sea.
 *
 * Los números: 6 GB de heap y 2 GB de metaspace. Las máquinas de EAS y los
 * runners de GitHub tienen 16 GB, así que sobra sitio; y el metaspace es lo que
 * de verdad faltaba.
 */
const { withGradleProperties } = require('expo/config-plugins');

const MEMORIA = '-Xmx6144m -XX:MaxMetaspaceSize=2048m';

module.exports = function withMemoriaDeGradle(config) {
  return withGradleProperties(config, (config) => {
    const propiedades = config.modResults;
    const i = propiedades.findIndex(
      (p) => p.type === 'property' && p.key === 'org.gradle.jvmargs'
    );
    const nueva = { type: 'property', key: 'org.gradle.jvmargs', value: MEMORIA };
    if (i >= 0) propiedades[i] = nueva;
    else propiedades.push(nueva);
    return config;
  });
};
