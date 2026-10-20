package expo.modules.calicotienda

import android.content.Context
import com.google.android.play.core.appupdate.AppUpdateManagerFactory
import com.google.android.play.core.install.model.UpdateAvailability
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * ¿Hay en Google Play una versión más nueva que la instalada?
 *
 * Play no tiene una búsqueda pública como la de la App Store; quien lo sabe es
 * la app de Play del propio móvil, y además sabe si a ESTE móvil le toca: por
 * modelo, por versión de Android y por lanzamiento escalonado. Si no le toca,
 * contesta que no hay nada, y así no se le pide a nadie lo que no puede bajar.
 *
 * Solo funciona con la app instalada desde Google Play. Instalada de otra
 * forma, o sin Play, contesta null y la app sigue sin aviso.
 */
class CalicoTiendaModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("CalicoTienda")

    // { hay, dias }: si hay versión nueva y cuántos días hace que Play la
    // conoce (0 si no lo sabe). null si Play no contesta.
    AsyncFunction("versionNueva") { promise: Promise ->
      try {
        AppUpdateManagerFactory.create(context).appUpdateInfo
          .addOnSuccessListener { info ->
            val estado = info.updateAvailability()
            val hay = estado == UpdateAvailability.UPDATE_AVAILABLE ||
              estado == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS
            val dias: Int = info.clientVersionStalenessDays() ?: 0
            promise.resolve(mapOf("hay" to hay, "dias" to dias))
          }
          .addOnFailureListener { promise.resolve(null) }
      } catch (e: Exception) {
        promise.resolve(null)
      }
    }
  }
}
