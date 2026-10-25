import { useColorScheme } from 'react-native';

// Palette: cool linen ground, deep navy ink, rose "thread" accent.
const light = {
  bg: '#EEF0F5',
  surface: '#FFFFFF',
  ink: '#1A1E31',
  muted: '#5B6177',
  line: '#D3D7E3',
  fabric: '#C4C9D8',
  accent: '#B4306A',
  accentSoft: '#F7E4EC',
  onAccent: '#FFFFFF',
  bobbin: '#FFFFFF',
  ok: '#2F7A4F',
  warn: '#99590A',
  bad: '#B3261E',
  skip: '#8A8FA3',
};

const dark: typeof light = {
  bg: '#11131C',
  surface: '#1A1D2A',
  ink: '#E8E9F0',
  muted: '#A3A8BB',
  line: '#2F3347',
  fabric: '#3D425B',
  accent: '#E8709F',
  accentSoft: '#3A2131',
  onAccent: '#1C0F16',
  bobbin: '#F5F5F7',
  ok: '#66C48F',
  warn: '#E4A84E',
  bad: '#F2786D',
  skip: '#7D8297',
};

export type Colors = typeof light;

export function useColors(): Colors {
  return useColorScheme() === 'dark' ? dark : light;
}

export const Fonts = {
  display: 'YoungSerif_400Regular',
  body: 'Figtree_400Regular',
  bodySemi: 'Figtree_600SemiBold',
  bodyBold: 'Figtree_700Bold',
  mono: 'IBMPlexMono_500Medium',
};

export const Space = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32 };
export const Radius = { s: 8, m: 12, pill: 999 };
export const MaxWidth = 720;
