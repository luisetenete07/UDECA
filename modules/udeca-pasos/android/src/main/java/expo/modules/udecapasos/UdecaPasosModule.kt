package expo.modules.udecapasos

import android.content.Context
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.GoogleApiAvailabilityLight
import com.google.android.gms.fitness.FitnessLocal
import com.google.android.gms.fitness.LocalRecordingClient
import com.google.android.gms.fitness.data.LocalDataType
import com.google.android.gms.fitness.request.LocalDataReadRequest
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.concurrent.TimeUnit

/**
 * Los pasos en Android, con la app cerrada incluida y SIN Health Connect.
 *
 * Health Connect se intentó y la revisión de Google lo tumbó (permiso de datos
 * de salud). Esto es otra cosa: la API de grabación de Google Play guarda los
 * pasos del propio móvil en el dispositivo, en segundo plano y gastando poca
 * batería, con el permiso normal de actividad física. Una vez suscrito, se le
 * pueden preguntar los pasos de cualquier rango de los últimos diez días.
 *
 * Lo que no puede saber es lo andado ANTES de suscribirse: el primer día cuenta
 * desde que se conecta.
 */
class UdecaPasosModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("UdecaPasos")

    // Hace falta Google Play services al día; sin él se sigue con el sensor.
    Function("disponible") {
      GoogleApiAvailabilityLight.getInstance().isGooglePlayServicesAvailable(
        context,
        LocalRecordingClient.LOCAL_RECORDING_CLIENT_MIN_VERSION_CODE
      ) == ConnectionResult.SUCCESS
    }

    // Empezar a grabar. Repetirlo no hace nada: si ya estaba, sigue igual.
    AsyncFunction("suscribir") { promise: Promise ->
      FitnessLocal.getLocalRecordingClient(context)
        .subscribe(LocalDataType.TYPE_STEP_COUNT_DELTA)
        .addOnSuccessListener { promise.resolve(true) }
        .addOnFailureListener { promise.resolve(false) }
    }

    // Pasos entre dos instantes (milisegundos). -1 si la consulta falla.
    AsyncFunction("pasosEntre") { desde: Double, hasta: Double, promise: Promise ->
      val inicio = desde.toLong()
      val fin = maxOf(hasta.toLong(), inicio + 1)
      // Un solo cubo que lo cubra todo: el rango ya llega cortado por días
      // desde la app, con sus medianoches de verdad (también las del cambio
      // de hora, que no duran 24 horas).
      val cubo = minOf(fin - inicio, Int.MAX_VALUE.toLong()).toInt()
      val peticion = LocalDataReadRequest.Builder()
        .aggregate(LocalDataType.TYPE_STEP_COUNT_DELTA)
        .bucketByTime(cubo, TimeUnit.MILLISECONDS)
        .setTimeRange(inicio, fin, TimeUnit.MILLISECONDS)
        .build()
      FitnessLocal.getLocalRecordingClient(context)
        .readData(peticion)
        .addOnSuccessListener { respuesta ->
          var total = 0
          for (bucket in respuesta.buckets) {
            for (datos in bucket.dataSets) {
              for (punto in datos.dataPoints) {
                for (campo in punto.dataType.fields) {
                  total += punto.getValue(campo).asInt()
                }
              }
            }
          }
          promise.resolve(total)
        }
        .addOnFailureListener { promise.resolve(-1) }
    }
  }
}
