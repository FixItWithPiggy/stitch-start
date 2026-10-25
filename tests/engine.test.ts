// Tests for the recommendation engine. Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildSetupCard, buildAdvicePrompt, fitDesign, estimateLetterWidth, fileKindFromName } from '../supabase/functions/_shared/engine.ts';
import { MACHINES, getMachine, searchMachines } from '../supabase/functions/_shared/machines.ts';

const eoc05 = getMachine('poolin-eoc05')!;
const cs7000x = getMachine('brother-cs7000x')!;

test('every machine has an id, guides for all four tasks, and sources', () => {
  const ids = new Set<string>();
  for (const m of MACHINES) {
    assert.ok(!ids.has(m.id), `duplicate id ${m.id}`);
    ids.add(m.id);
    assert.deepEqual(m.guides.map((g) => g.key).sort(), ['insert', 'needle', 'top', 'wind']);
    assert.ok(m.sources.length > 0);
    if (m.type === 'embroidery') assert.ok(m.hoops && m.hoops.length > 0, `${m.id} needs hoops`);
  }
});

test('search finds machines from loose typing', () => {
  assert.equal(searchMachines('Poolin EOC 05').matches[0]?.id, 'poolin-eoc05');
  assert.equal(searchMachines('eoc05').matches[0]?.id, 'poolin-eoc05');
  assert.equal(searchMachines('brother cs7000x').matches[0]?.id, 'brother-cs7000x');
  assert.equal(searchMachines('janome 999').matches.length, 0);
});

test('embroidery card never offers stitch length as a setting', () => {
  const card = buildSetupCard({ machineId: eoc05.id, projectType: 'lettering', item: 'tote', letterText: 'Kendall', letterHeight: 1 });
  const sl = card.rows.find((r) => r.key === 'stitch-length');
  assert.equal(sl?.state, 'skip');
  assert.ok(!card.rows.some((r) => r.key === 'stitch-width'));
  assert.equal(card.rows.find((r) => r.key === 'hoop')?.state, 'ok');
});

test('sewing card has stitch length and skips the hoop', () => {
  const card = buildSetupCard({ machineId: cs7000x.id, projectType: 'seam', item: 'denim' });
  assert.equal(card.rows.find((r) => r.key === 'stitch-length')?.value, '3 mm');
  assert.equal(card.rows.find((r) => r.key === 'skip-Embroidery hoop')?.state, 'skip');
  assert.ok(!card.preview);
});

test('topstitching lengthens the stitch but never past the machine maximum', () => {
  const card = buildSetupCard({ machineId: cs7000x.id, projectType: 'topstitch', item: 'denim' });
  assert.equal(card.rows.find((r) => r.key === 'stitch-length')?.value, '3.5 mm');
});

test('hoop fitting picks the smallest hoop, turns designs, and flags oversize', () => {
  const hoops = eoc05.hoops!;
  assert.deepEqual(fitDesign(hoops, 3, 3), { fits: true, hoop: hoops[0], tight: false });
  const turned = fitDesign(hoops, 8, 3);
  assert.equal(turned.fits, true);
  assert.equal(turned.hoop.label, '4″ × 9.25″');
  const big = fitDesign(hoops, 10, 6);
  assert.equal(big.fits, false);
  if (!big.fits) assert.ok(Math.abs(big.scale - 4 / 6) < 0.001);
});

test('tiny lettering is flagged; fuzzy fabric warns', () => {
  const tiny = buildSetupCard({ machineId: eoc05.id, projectType: 'lettering', item: 'tote', letterText: 'Hi', letterHeight: 0.2 });
  assert.equal(tiny.rows.find((r) => r.key === 'letters')?.state, 'bad');
  const fuzzy = buildSetupCard({ machineId: eoc05.id, projectType: 'lettering', item: 'towel', letterText: 'Hi', letterHeight: 0.4 });
  assert.equal(fuzzy.rows.find((r) => r.key === 'letters')?.state, 'warn');
});

test('caps are blocked on a flatbed machine', () => {
  const card = buildSetupCard({ machineId: eoc05.id, projectType: 'fill', item: 'cap' });
  assert.equal(card.blocked, true);
});

test('design file check knows the machine formats', () => {
  const ok = buildSetupCard({ machineId: eoc05.id, projectType: 'fill', item: 'tote', width: 3, height: 3, fileKind: 'other', fileExt: 'dst' });
  assert.equal(ok.rows.find((r) => r.key === 'file')?.state, 'ok');
  const convert = buildSetupCard({ machineId: eoc05.id, projectType: 'fill', item: 'tote', width: 3, height: 3, fileKind: 'other', fileExt: 'pes' });
  assert.match(convert.rows.find((r) => r.key === 'file')!.value, /needs converting/);
  assert.deepEqual(fileKindFromName('logo.PNG'), { kind: 'image', ext: 'png' });
});

test('letter width estimate grows with text', () => {
  assert.ok(estimateLetterWidth('Kendall', 1) > estimateLetterWidth('Ken', 1));
});

test('advice prompt names missing settings so Claude never asks about them', () => {
  const prompt = buildAdvicePrompt(eoc05, { machineId: eoc05.id, projectType: 'fill', item: 'hoodie', width: 3, height: 3, notes: 'navy hoodie' }, true);
  assert.match(prompt, /does NOT have.*Stitch length/);
  assert.match(prompt, /navy hoodie/);
  assert.match(prompt, /picture of the design is attached/);
});
