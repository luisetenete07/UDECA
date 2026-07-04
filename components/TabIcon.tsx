import React from 'react';
import type { ColorValue } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export function TabIcon({
  focused,
  color,
  outline,
  filled,
}: {
  focused: boolean;
  color: ColorValue;
  outline: keyof typeof Ionicons.glyphMap;
  filled: keyof typeof Ionicons.glyphMap;
}) {
  return <Ionicons name={focused ? filled : outline} size={22} color={color} />;
}
