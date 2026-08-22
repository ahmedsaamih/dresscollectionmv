import { prisma } from '@/lib/prisma';
import type { BuilderKind } from '@/lib/validation';

/**
 * Maps a builder-option kind to its Prisma delegate and id prefix.
 * Used by the dynamic /api/admin/builder/[kind] routes.
 */
type Delegate = {
  create: (args: { data: Record<string, unknown> }) => Promise<Record<string, unknown>>;
  update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<Record<string, unknown>>;
  delete: (args: { where: { id: string } }) => Promise<Record<string, unknown>>;
  findUnique: (args: { where: { id: string } }) => Promise<Record<string, unknown> | null>;
};

const MODELS: Record<BuilderKind, { delegate: () => Delegate; prefix: string }> = {
  types: { delegate: () => prisma.builderType as unknown as Delegate, prefix: 't' },
  fabrics: { delegate: () => prisma.builderFabric as unknown as Delegate, prefix: 'f' },
  sleeves: { delegate: () => prisma.builderSleeve as unknown as Delegate, prefix: 's' },
  necks: { delegate: () => prisma.builderNeck as unknown as Delegate, prefix: 'n' },
  colors: { delegate: () => prisma.builderColor as unknown as Delegate, prefix: 'col' },
  sizes: { delegate: () => prisma.builderSize as unknown as Delegate, prefix: 'sz' },
};

export function isBuilderKind(k: string): k is BuilderKind {
  return k in MODELS;
}

export function builderModel(kind: BuilderKind) {
  return MODELS[kind];
}
