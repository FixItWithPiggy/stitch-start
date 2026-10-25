// Small building blocks shared by every screen.
import { type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Fonts, MaxWidth, Radius, Space, useColors, type Colors } from './theme';

type Variant = 'display' | 'title' | 'heading' | 'body' | 'label' | 'small' | 'mono';

export function T({
  variant = 'body',
  color,
  style,
  children,
  numberOfLines,
}: {
  variant?: Variant;
  color?: keyof Colors;
  style?: StyleProp<TextStyle>;
  children: ReactNode;
  numberOfLines?: number;
}) {
  const c = useColors();
  const v: Record<Variant, TextStyle> = {
    display: { fontFamily: Fonts.display, fontSize: 30, lineHeight: 36 },
    title: { fontFamily: Fonts.display, fontSize: 22, lineHeight: 28 },
    heading: { fontFamily: Fonts.bodyBold, fontSize: 16, lineHeight: 22 },
    body: { fontFamily: Fonts.body, fontSize: 15, lineHeight: 22 },
    label: {
      fontFamily: Fonts.bodyBold,
      fontSize: 11.5,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      lineHeight: 16,
    },
    small: { fontFamily: Fonts.body, fontSize: 13, lineHeight: 19 },
    mono: { fontFamily: Fonts.mono, fontSize: 13, lineHeight: 19 },
  };
  const defaultColor: keyof Colors = variant === 'label' || variant === 'small' ? 'muted' : 'ink';
  return (
    <Text numberOfLines={numberOfLines} style={[v[variant], { color: c[color ?? defaultColor] }, style]}>
      {children}
    </Text>
  );
}

/** Renders text with **bold** segments. */
export function Rich({ text, variant = 'body', color }: { text: string; variant?: Variant; color?: keyof Colors }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return (
    <T variant={variant} color={color}>
      {parts.map((p, i) =>
        p.startsWith('**') ? (
          <Text key={i} style={{ fontFamily: Fonts.bodyBold }}>
            {p.slice(2, -2)}
          </Text>
        ) : (
          p
        ),
      )}
    </T>
  );
}

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const c = useColors();
  const inner = <View style={styles.inner}>{children}</View>;
  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: c.bg }}>
      {scroll ? (
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {inner}
        </ScrollView>
      ) : (
        inner
      )}
    </SafeAreaView>
  );
}

export function Card({ children, style, dashed }: { children: ReactNode; style?: StyleProp<ViewStyle>; dashed?: boolean }) {
  const c = useColors();
  return (
    <View
      style={[
        {
          backgroundColor: c.surface,
          borderColor: dashed ? c.accent : c.line,
          borderWidth: dashed ? 1.5 : 1,
          borderStyle: dashed ? 'dashed' : 'solid',
          borderRadius: Radius.m,
          padding: Space.l,
          gap: Space.m,
        },
        style,
      ]}>
      {children}
    </View>
  );
}

/** A running-stitch divider, the app's recurring motif. */
export function Stitch({ color }: { color?: keyof Colors }) {
  const c = useColors();
  return <View style={{ borderTopWidth: 2, borderStyle: 'dashed', borderColor: c[color ?? 'accent'], marginVertical: Space.xs }} />;
}

export function Button({
  label,
  onPress,
  kind = 'primary',
  loading,
  disabled,
  accessibilityHint,
}: {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'ghost' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  accessibilityHint?: string;
}) {
  const c = useColors();
  const bg = kind === 'primary' ? c.accent : 'transparent';
  const fg = kind === 'primary' ? c.onAccent : kind === 'danger' ? c.bad : c.accent;
  const border = kind === 'danger' ? c.bad : c.accent;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, borderColor: border, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
      ]}>
      {loading ? <ActivityIndicator color={fg} /> : <Text style={[styles.buttonText, { color: fg }]}>{label}</Text>}
    </Pressable>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.chip,
        { backgroundColor: selected ? c.accent : c.bg, borderColor: selected ? c.accent : c.line },
      ]}>
      <Text style={{ fontFamily: selected ? Fonts.bodySemi : Fonts.body, fontSize: 14, color: selected ? c.onAccent : c.ink }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Chips({ children }: { children: ReactNode }) {
  return (
    <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space.s }}>
      {children}
    </View>
  );
}

export function Field({ label, hint, ...props }: TextInputProps & { label: string; hint?: string }) {
  const c = useColors();
  return (
    <View style={{ gap: 6, flex: 1, minWidth: 0 }}>
      <T variant="heading" style={{ fontSize: 14 }}>
        {label}
      </T>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={c.skip}
        {...props}
        style={[
          styles.input,
          { color: c.ink, backgroundColor: c.bg, borderColor: c.line },
          props.multiline && { minHeight: 80, textAlignVertical: 'top' },
          props.style,
        ]}
      />
      {hint ? <T variant="small">{hint}</T> : null}
    </View>
  );
}

export function Note({ children, state = 'warn' }: { children: ReactNode; state?: 'ok' | 'warn' | 'bad' }) {
  const c = useColors();
  return (
    <View style={{ backgroundColor: c.bg, borderLeftWidth: 3, borderLeftColor: c[state], borderRadius: Radius.s, padding: Space.m }}>
      {typeof children === 'string' ? <T variant="small" color="ink">{children}</T> : children}
    </View>
  );
}

export function StepNumber({ n }: { n: number | string }) {
  const c = useColors();
  return (
    <View style={[styles.num, { borderColor: c.accent }]}>
      <Text style={{ fontFamily: Fonts.mono, fontSize: 12, color: c.accent }}>{n}</Text>
    </View>
  );
}

export function Section({ title, step, children, right }: { title: string; step?: number; children: ReactNode; right?: ReactNode }) {
  return (
    <View style={{ gap: Space.m }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.s }}>
        {step ? <StepNumber n={step} /> : null}
        <T variant="title" style={{ flex: 1 }}>
          {title}
        </T>
        {right}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: Space.l, paddingTop: Space.l, paddingBottom: 48 },
  inner: { width: '100%', maxWidth: MaxWidth, alignSelf: 'center', gap: Space.xl },
  button: {
    borderWidth: 1.5,
    borderRadius: Radius.pill,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
  },
  buttonText: { fontFamily: Fonts.bodyBold, fontSize: 15 },
  chip: { borderWidth: 1, borderRadius: Radius.pill, paddingVertical: 8, paddingHorizontal: 14 },
  input: { fontFamily: Fonts.body, fontSize: 16, borderWidth: 1, borderRadius: Radius.s, paddingHorizontal: 12, paddingVertical: 10 },
  num: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
});
