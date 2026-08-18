import React from 'react';
import { ScrollView, Text, View } from 'react-native';

/**
 * La última red, la que no puede fallar.
 *
 * POR QUÉ EXISTE, Y POR QUÉ NO SE PARECE AL RESTO DE LA APP
 *
 * La app se cerraba nada más abrirse en el iPhone, siempre, sin decir una
 * palabra. Se descartaron cinco causas a base de compilar y esperar, cuarenta
 * minutos cada intento, y abrir el .ipa demostró que el paquete estaba sano:
 * el JavaScript dentro, los frameworks dentro, los permisos concedidos. O sea
 * que lo que falla, falla YA EJECUTÁNDOSE, en los primeros instantes.
 *
 * Un fallo así no deja rastro visible: React desmonta todo y el usuario ve una
 * pantalla negra y luego nada. Esto lo convierte en un texto que se puede leer
 * y mandar por WhatsApp.
 *
 * Y por eso NO usa nada de la app: ni `components/Texto`, ni los iconos, ni el
 * tema, ni el registro de errores. Solo `View`, `Text` y colores escritos a
 * mano. Una red de seguridad que depende de las mismas piezas que vigila no es
 * una red: si lo que se rompió es el tema o la fuente, el propio aviso se
 * rompería con él y volveríamos a la pantalla negra.
 *
 * Va POR ENCIMA de todo lo demás en app/_layout.tsx —por encima de las fuentes,
 * de la sesión, del gestor de gestos—, porque cualquiera de esas piezas puede
 * ser la que falle.
 *
 * Lo que NO puede atrapar, para que conste: un error al CARGAR un módulo (eso
 * ocurre antes de que React exista; los sitios conocidos van con su propio
 * `try` en lib/firebase, lib/notifications y lib/googleAuth) ni un fallo del
 * código nativo, que mata el proceso entero sin pasar por aquí.
 */

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

export class ArranqueSeguro extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    // A partir de aquí, cuanto menos se use, mejor.
    const mensaje = String(error?.message ?? error ?? 'sin mensaje');
    const pila = String(error?.stack ?? '').split('\n').slice(0, 12).join('\n');

    return (
      <View style={{ flex: 1, backgroundColor: '#000000' }}>
        <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 80 }}>
          <Text style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '700', marginBottom: 10 }}>
            UDECA no ha podido arrancar
          </Text>
          <Text style={{ color: '#ADADAD', fontSize: 15, lineHeight: 21, marginBottom: 22 }}>
            Esto es un fallo nuestro, no de tu móvil ni de tu cuenta. Hazle una
            foto a esta pantalla y mándanosla: con lo que pone aquí abajo se
            arregla.
          </Text>
          <Text style={{ color: '#C9BDB0', fontSize: 13, fontWeight: '600', marginBottom: 6 }}>
            QUÉ HA FALLADO
          </Text>
          <Text
            selectable
            style={{ color: '#FFFFFF', fontSize: 13, lineHeight: 19, marginBottom: 22 }}
          >
            {mensaje}
          </Text>
          {pila ? (
            <>
              <Text
                style={{ color: '#C9BDB0', fontSize: 13, fontWeight: '600', marginBottom: 6 }}
              >
                DÓNDE
              </Text>
              <Text selectable style={{ color: '#888888', fontSize: 11, lineHeight: 16 }}>
                {pila}
              </Text>
            </>
          ) : null}
        </ScrollView>
      </View>
    );
  }
}
