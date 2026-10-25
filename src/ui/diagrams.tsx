// Drawings: the hoop preview and the tension guide.
import { View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, Image as SvgImage, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import type { HoopPreview as Preview, MachineType } from '@/core/types';

import { Card, T } from './kit';
import { Fonts, Space, useColors } from './theme';

/** Draws the design to scale inside the hoop. */
export function HoopPreview({ preview, imageUri }: { preview: Preview; imageUri?: string | null }) {
  const c = useColors();
  const S = 34;
  const pad = 22;
  const { hoop, width: w, height: h, fits, text } = preview;
  // Show the hoop lying down (long side across) so it fits phone screens.
  const HW = Math.max(hoop.w, hoop.h) * S;
  const HH = Math.min(hoop.w, hoop.h) * S;
  let dw = w * S;
  let dh = h * S;
  if (!(dw <= HW && dh <= HH) && dh <= HW && dw <= HH) [dw, dh] = [dh, dw];
  const VW = Math.max(HW, dw) + pad * 2 + 16;
  const VH = Math.max(HH, dh) + pad * 2 + 16;
  const cx = VW / 2;
  const cy = VH / 2;
  const col = fits ? c.accent : c.bad;
  const tick = (x1: number, y1: number, x2: number, y2: number) => (
    <Line x1={x1} y1={y1} x2={x2} y2={y2} stroke={c.muted} strokeWidth={1.5} />
  );
  return (
    <View
      accessible
      accessibilityLabel={`Your ${w} by ${h} inch design shown to scale in the ${hoop.label} hoop${fits ? '' : '. It does not fit.'}`}
      style={{ width: '100%', aspectRatio: VW / VH, maxHeight: 300 }}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${VW} ${VH}`}>
        <Rect x={cx - HW / 2 - 8} y={cy - HH / 2 - 8} width={HW + 16} height={HH + 16} rx={16} fill="none" stroke={c.muted} strokeWidth={5} opacity={0.55} />
        <Rect x={cx - HW / 2} y={cy - HH / 2} width={HW} height={HH} rx={6} fill={c.bg} stroke={c.line} strokeWidth={1.5} strokeDasharray="5 4" />
        {tick(cx, cy - HH / 2, cx, cy - HH / 2 + 8)}
        {tick(cx, cy + HH / 2, cx, cy + HH / 2 - 8)}
        {tick(cx - HW / 2, cy, cx - HW / 2 + 8, cy)}
        {tick(cx + HW / 2, cy, cx + HW / 2 - 8, cy)}
        <Rect x={cx - dw / 2} y={cy - dh / 2} width={dw} height={dh} fill={c.accentSoft} stroke={col} strokeWidth={1.5} strokeDasharray={fits ? undefined : '6 4'} />
        {imageUri ? (
          <SvgImage href={{ uri: imageUri }} x={cx - dw / 2} y={cy - dh / 2} width={dw} height={dh} preserveAspectRatio="xMidYMid meet" />
        ) : text ? (
          <SvgText x={cx} y={cy + dh * 0.28} textAnchor="middle" fontFamily={Fonts.display} fontSize={Math.min(dh * 0.8, (dw * 1.4) / Math.max(text.length, 1))} fill={col}>
            {text}
          </SvgText>
        ) : (
          <SvgText x={cx} y={cy + 5} textAnchor="middle" fontFamily={Fonts.body} fontSize={13} fill={col}>
            your design
          </SvgText>
        )}
      </Svg>
    </View>
  );
}

type TensionState = 'right' | 'tight' | 'loose';

function SatinBack({ state, id }: { state: TensionState; id: string }) {
  const c = useColors();
  const xs: number[] = [];
  for (let x = 8; x < 292; x += 5) xs.push(x);
  const lines = (stroke: string) => xs.map((x) => <Line key={x} x1={x} y1={18} x2={x + 7} y2={72} stroke={stroke} strokeWidth={3.4} />);
  const band = state === 'right' ? [36, 18] : state === 'tight' ? [22, 46] : null;
  return (
    <Svg width="100%" height="100%" viewBox="0 0 300 96">
      <Rect x={0} y={0} width={300} height={96} fill={c.fabric} opacity={0.55} />
      <G>{lines(c.accent)}</G>
      {band ? (
        <>
          <Defs>
            <ClipPath id={id}>
              <Rect x={0} y={band[0]} width={300} height={band[1]} />
            </ClipPath>
          </Defs>
          <G clipPath={`url(#${id})`}>{lines(c.bobbin)}</G>
        </>
      ) : null}
      {state === 'loose'
        ? [24, 58, 92, 126, 160, 194, 228, 262].map((x) => <Path key={x} d={`M${x} 72 c-6 16 14 16 8 0`} fill="none" stroke={c.accent} strokeWidth={2} />)
        : null}
    </Svg>
  );
}

function SeamSide({ state }: { state: TensionState }) {
  const c = useColors();
  const lock = state === 'right' ? 46 : state === 'tight' ? 31 : 62;
  const pts = [40, 88, 136, 184, 232, 280];
  let top = 'M8 31';
  let bottom = 'M8 61';
  for (const x of pts) {
    top += ` H${x - 6} L${x} ${lock} L${x + 6} 31`;
    bottom += ` H${x - 6} L${x} ${lock} L${x + 6} 61`;
  }
  top += ' H292';
  bottom += ' H292';
  return (
    <Svg width="100%" height="100%" viewBox="0 0 300 96">
      <Rect x={8} y={34} width={284} height={11} rx={2} fill={c.fabric} />
      <Rect x={8} y={47} width={284} height={11} rx={2} fill={c.fabric} />
      {state === 'tight' ? (
        <Path d="M8 34 q12 -5 24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0" fill="none" stroke={c.warn} strokeWidth={1.5} strokeDasharray="3 3" />
      ) : null}
      <Path d={top} fill="none" stroke={c.accent} strokeWidth={2.4} />
      <Path d={bottom} fill="none" stroke={c.muted} strokeWidth={2.4} />
      {state === 'loose'
        ? pts.map((x) => <Path key={x} d={`M${x - 4} 64 c-8 18 16 18 8 0`} fill="none" stroke={c.accent} strokeWidth={2} />)
        : null}
      {pts.map((x) => (
        <Circle key={x} cx={x} cy={lock} r={3.2} fill={c.ink} />
      ))}
      <SvgText x={292} y={22} textAnchor="end" fontSize={11} fontFamily={Fonts.body} fill={c.muted}>
        top thread
      </SvgText>
      <SvgText x={292} y={88} textAnchor="end" fontSize={11} fontFamily={Fonts.body} fill={c.muted}>
        bobbin thread
      </SvgText>
    </Svg>
  );
}

const EMB_TILES: [TensionState, string, string, string][] = [
  ['right', 'Just right', 'Top color on both edges and a stripe of white bobbin thread about one-third wide down the middle.', 'Nothing to change.'],
  ['tight', 'Top thread too tight', 'Mostly white on the back. You may see white specks on the front, puckering, or broken thread.', 'Lower the top tension one step and test again.'],
  ['loose', 'Top thread too loose', 'No white on the back, only top color, often with loops or a tangled "bird\'s nest".', 'Rethread the top thread first. If it still loops, raise the top tension one step.'],
];
const SEW_TILES: [TensionState, string, string, string][] = [
  ['right', 'Just right', 'The threads lock between the two layers. Stitches look the same on top and bottom.', 'Nothing to change.'],
  ['tight', 'Top thread too tight', 'Bobbin thread is pulled up and shows as dots on top. The fabric puckers.', 'Turn the dial to a lower number.'],
  ['loose', 'Top thread too loose', 'Top thread is pulled underneath and makes loops on the bottom.', 'Rethread with the presser foot up. If it still loops, turn the dial higher.'],
];

export function TensionGuide({ type }: { type: MachineType }) {
  const c = useColors();
  const emb = type === 'embroidery';
  const tiles = emb ? EMB_TILES : SEW_TILES;
  return (
    <View style={{ gap: Space.m }}>
      <T variant="small">
        {emb
          ? 'Flip your test piece over and look at the back of a wide column of stitches. Top thread is shown in pink, bobbin thread in white. Change one thing at a time and test again.'
          : 'Seen from the side: two layers of fabric, top thread in pink, bobbin thread in grey. The dots are where the two threads lock together. Change one thing at a time and test again.'}
      </T>
      {tiles.map(([s, title, see, fix], i) => (
        <Card key={s} style={{ gap: Space.s }}>
          <View style={{ width: '100%', aspectRatio: 300 / 96, borderRadius: 8, overflow: 'hidden', backgroundColor: c.bg }}>
            {emb ? <SatinBack state={s} id={`clip${i}`} /> : <SeamSide state={s} />}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.s }}>
            <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: s === 'right' ? c.ok : c.bad }} />
            <T variant="heading">{title}</T>
          </View>
          <T>{see}</T>
          <T variant="small">{fix}</T>
        </Card>
      ))}
    </View>
  );
}
