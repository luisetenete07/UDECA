import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

/**
 * Imprime (o comparte) un informe en HTML.
 *
 * En móvil lo hace `expo-print`: genera el PDF y lo pasa al menú de compartir.
 *
 * En NAVEGADOR no se puede usar `Print.printAsync({ html })`: la versión web de
 * expo-print ignora el HTML y llama a `window.print()` a secas, así que lo que
 * salía impreso era la propia pantalla de la app, no el informe. Por eso aquí se
 * monta el documento en un iframe oculto y se imprime ese iframe. Se hace con un
 * iframe y no con `window.open` porque una ventana nueva la bloquean los
 * navegadores en cuanto la apertura no es instantánea, y este informe tarda un
 * momento en construirse.
 */
export async function printReportHtml(html: string, fileName = 'informe'): Promise<void> {
  if (Platform.OS !== 'web') {
    const { uri } = await Print.printToFileAsync({ html });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: fileName });
    }
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const marco = document.createElement('iframe');
    // Fuera de la vista pero SIN `display:none`: los navegadores no imprimen lo
    // que no se maqueta.
    marco.setAttribute('aria-hidden', 'true');
    marco.style.cssText =
      'position:fixed;right:0;bottom:0;width:1px;height:1px;opacity:0;border:0;';

    let terminado = false;
    const limpiar = () => {
      if (terminado) return;
      terminado = true;
      // Un respiro antes de quitarlo: Safari cancela la impresión si el iframe
      // desaparece mientras el diálogo sigue abierto.
      setTimeout(() => marco.remove(), 1000);
      resolve();
    };

    marco.onload = () => {
      try {
        const ventana = marco.contentWindow;
        if (!ventana) throw new Error('sin documento');
        // El diálogo de impresión es bloqueante; al cerrarse vuelve aquí.
        ventana.focus();
        ventana.print();
        limpiar();
      } catch (e) {
        marco.remove();
        reject(e);
      }
    };
    marco.onerror = () => {
      marco.remove();
      reject(new Error('No se pudo preparar el informe'));
    };

    document.body.appendChild(marco);
    marco.srcdoc = html;
  });
}
