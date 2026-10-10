import ExpoModulesCore
import HealthKit

/**
 * Los pasos desde Salud (HealthKit).
 *
 * El contador del propio iPhone (CoreMotion, lo que lee expo-sensors) solo sabe
 * lo que ha andado el iPhone. Quien lleva Apple Watch y sale sin el móvil
 * aparecía con la mitad de sus pasos. Salud junta los dos —y quita los que
 * cuentan los dos a la vez—, así que la cifra es la misma que ve en su app de
 * Salud.
 *
 * Solo lee pasos. No escribe nada.
 */
public class UdecaPasosModule: Module {
  private let store = HKHealthStore()

  public func definition() -> ModuleDefinition {
    Name("UdecaPasos")

    Function("disponible") { () -> Bool in
      return HKHealthStore.isHealthDataAvailable()
    }

    // Apple no dice si se concedió la lectura (por privacidad): `true` solo
    // significa que se ha mostrado la pregunta. Si dijo que no, las consultas
    // devuelven cero, y la app se queda con lo que diga el propio iPhone.
    AsyncFunction("pedirPermiso") { (promise: Promise) in
      guard HKHealthStore.isHealthDataAvailable(),
            let pasos = HKObjectType.quantityType(forIdentifier: .stepCount) else {
        promise.resolve(false)
        return
      }
      self.store.requestAuthorization(toShare: nil, read: [pasos]) { ok, _ in
        promise.resolve(ok)
      }
    }

    // Pasos entre dos instantes (milisegundos). -1 si la consulta falla.
    AsyncFunction("pasosEntre") { (desde: Double, hasta: Double, promise: Promise) in
      guard let pasos = HKQuantityType.quantityType(forIdentifier: .stepCount) else {
        promise.resolve(-1)
        return
      }
      let inicio = Date(timeIntervalSince1970: desde / 1000.0)
      let fin = Date(timeIntervalSince1970: hasta / 1000.0)
      let filtro = HKQuery.predicateForSamples(withStart: inicio, end: fin, options: [])
      let consulta = HKStatisticsQuery(
        quantityType: pasos,
        quantitySamplePredicate: filtro,
        options: .cumulativeSum
      ) { _, resultado, error in
        if let error = error as NSError? {
          // Sin datos en ese rango no es un fallo: es un día sin pasos.
          if error.domain == HKErrorDomain && error.code == HKError.Code.errorNoData.rawValue {
            promise.resolve(0)
          } else {
            promise.resolve(-1)
          }
          return
        }
        let total = resultado?.sumQuantity()?.doubleValue(for: HKUnit.count()) ?? 0
        promise.resolve(Int(total.rounded()))
      }
      self.store.execute(consulta)
    }
  }
}
