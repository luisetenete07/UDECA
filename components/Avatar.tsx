import React from 'react';
import { Image, StyleSheet, View, type ImageStyle, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from './Texto';
import { colors, fonts } from '../lib/theme';

interface AvatarProps {
  name?: string;
  photoURL?: string | null;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

export function Avatar({ name, photoURL, size = 48, style }: AvatarProps) {
  const dimension = { width: size, height: size, borderRadius: size / 2 };
  const initial = (name ?? '?').charAt(0).toUpperCase();

  if (photoURL) {
    return (
      <Image
        source={{ uri: photoURL }}
        style={[styles.image, dimension, style as StyleProp<ImageStyle>]}
        resizeMode="cover"
      />
    );
  }

  return (
    <View style={[styles.fallback, dimension, style]}>
      <Text style={[styles.initial, { fontSize: size * 0.42 }]}>{initial}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  fallback: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    fontFamily: fonts.display,
    color: colors.primary,
  },
});
