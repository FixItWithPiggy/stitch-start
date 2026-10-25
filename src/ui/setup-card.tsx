import { View } from 'react-native';

import type { CardRow, SetupCard } from '@/core/types';

import { HoopPreview } from './diagrams';
import { T } from './kit';
import { Fonts, Radius, Space, useColors } from './theme';

function Row({ row, last }: { row: CardRow; last: boolean }) {
  const c = useColors();
  const dot =
    row.state === 'skip'
      ? { borderWidth: 1.5, borderColor: c.skip }
      : { backgroundColor: row.state === 'ok' ? c.ok : row.state === 'warn' ? c.warn : c.bad };
  const stateWord = { ok: '', warn: 'Check this. ', bad: 'Problem. ', skip: 'Not needed. ' }[row.state];
  return (
    <View
      accessible
      accessibilityLabel={`${row.label}. ${stateWord}${row.value}. ${row.detail ?? ''} ${row.checklist?.join('. ') ?? ''}`}
      style={{
        paddingHorizontal: Space.l,
        paddingVertical: 14,
        borderBottomWidth: last ? 0 : 1,
        borderColor: c.line,
        gap: 4,
      }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.s }}>
        <View style={[{ width: 8, height: 8, borderRadius: 4 }, dot]} />
        <T variant="label">{row.label}</T>
      </View>
      <T
        style={{ fontFamily: row.state === 'skip' ? Fonts.body : Fonts.bodySemi }}
        color={row.state === 'skip' ? 'skip' : 'ink'}>
        {row.value}
      </T>
      {row.detail ? <T variant="small">{row.detail}</T> : null}
      {row.checklist ? (
        <View style={{ gap: 4, marginTop: 2 }}>
          {row.checklist.map((item, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: Space.s }}>
              <T variant="mono" color="accent">
                {i + 1}.
              </T>
              <T style={{ flex: 1 }}>{item}</T>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function SetupCardView({ card, imageUri }: { card: SetupCard; imageUri?: string | null }) {
  const c = useColors();
  return (
    <View style={{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: Radius.m, overflow: 'hidden' }}>
      <View style={{ padding: Space.l, gap: 4, borderBottomWidth: 2, borderStyle: 'dashed', borderColor: c.accent }}>
        <T variant="title">{card.title}</T>
        <T variant="small">{card.subtitle}</T>
      </View>
      {card.preview ? (
        <View style={{ padding: Space.l, borderBottomWidth: 1, borderColor: c.line, gap: 6 }}>
          <HoopPreview preview={card.preview} imageUri={imageUri} />
          <T variant="small" style={{ textAlign: 'center' }}>
            {`${card.preview.text != null ? 'About ' : ''}${card.preview.width}″ × ${card.preview.height}″ shown to scale in the ${card.preview.hoop.label} hoop`}
          </T>
        </View>
      ) : null}
      {card.rows.map((r, i) => (
        <Row key={r.key} row={r} last={i === card.rows.length - 1} />
      ))}
    </View>
  );
}
