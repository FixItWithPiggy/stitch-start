// Shared types for Stitch Start.
// This folder (src/core) has no React Native code, so the same files run in the
// app and on the server (copied to supabase/functions/_shared by `npm run sync-core`).

export type MachineType = 'embroidery' | 'sewing';

export interface Source {
  label: string;
  url?: string;
}

export interface Hoop {
  label: string;
  /** Width of the stitch field in inches. */
  w: number;
  /** Height of the stitch field in inches. */
  h: number;
}

/** A step is plain text (use **double asterisks** for bold), or a group heading. */
export type GuideStep = string | { group: string };

export type GuideKey = 'top' | 'wind' | 'insert' | 'needle';

export interface Guide {
  key: GuideKey;
  tab: string;
  title: string;
  steps: GuideStep[];
  tips: string[];
  sources: Source[];
}

export interface Machine {
  /** Stable id saved in the database, e.g. "poolin-eoc05". Never change it once used. */
  id: string;
  brand: string;
  model: string;
  /** Other ways people type the model, lowercase letters and digits only. */
  aliases?: string[];
  type: MachineType;
  typeLabel: string;
  /** Settings the user will actually adjust on this machine. */
  has: string[];
  /** Settings this machine does not have. The app never asks about these. */
  hasNot: string[];
  hasNotWhy: string;
  specs: [string, string][];
  tensionRange: string;
  tensionDefault?: string;
  hoops?: Hoop[];
  /** Lowercase file extensions the machine reads, e.g. ["dst"]. */
  formats?: string[];
  /** True for flatbed embroidery machines that cannot stitch caps. */
  flatbedOnly?: boolean;
  maxThicknessMm?: number;
  maxSpeedSpm?: number;
  stitchLengthMaxMm?: number;
  stitchWidthMaxMm?: number;
  /** "checked" = verified against manufacturer material; "sample" = needs checking. */
  status: 'checked' | 'sample';
  checkedNote: string;
  sources: Source[];
  guides: Guide[];
}

export interface Option {
  id: string;
  label: string;
}

export interface ProjectInput {
  machineId: string;
  projectType: string;
  item: string;
  letterText?: string | null;
  letterHeight?: number | null;
  width?: number | null;
  height?: number | null;
  notes?: string | null;
  /** What kind of file the user attached, if any. */
  fileKind?: 'image' | 'other' | null;
  /** Lowercase extension of the attached file, without the dot. */
  fileExt?: string | null;
}

export type RowState = 'ok' | 'warn' | 'bad' | 'skip';

export interface CardRow {
  key: string;
  label: string;
  value: string;
  detail?: string;
  state: RowState;
  checklist?: string[];
}

export interface HoopPreview {
  hoop: Hoop;
  width: number;
  height: number;
  fits: boolean;
  text?: string;
}

export interface SetupCard {
  title: string;
  subtitle: string;
  rows: CardRow[];
  preview?: HoopPreview;
  /** True when this machine cannot do the project at all. */
  blocked?: boolean;
}
