/*
 * La entrada de la app: la de expo-router y, en Android, el que pinta el
 * widget "Hoy" de la pantalla del móvil cuando la app está cerrada
 * (lib/widgetTaskHandler.tsx). Se carga solo en Android: en iPhone y en la
 * web no hay widget.
 */
import 'expo-router/entry';
import { Platform } from 'react-native';

if (Platform.OS === 'android') {
  const { registerWidgetTaskHandler } = require('react-native-android-widget');
  const { widgetTaskHandler } = require('./lib/widgetTaskHandler');
  registerWidgetTaskHandler(widgetTaskHandler);
}
