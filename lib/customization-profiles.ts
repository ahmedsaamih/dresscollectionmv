import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type { CustomizationProfile } from '@/lib/types';

export const customizationProfileInclude = {
  fields: { orderBy: { sortOrder: 'asc' } },
  assignments: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.CustomizationProfileInclude;

export type CustomizationProfileRow = Prisma.CustomizationProfileGetPayload<{
  include: typeof customizationProfileInclude;
}>;

type ProfileInput = {
  name: string;
  description: string;
  active: boolean;
  sortOrder: number;
  fields: Array<{
    label: string;
    type: string;
    required: boolean;
    helpText: string;
    placeholder: string;
    options: string[];
    sortOrder: number;
  }>;
  assignments: Array<{
    scope: 'collection' | 'category' | 'product';
    collectionKey?: string | null;
    categoryId?: string | null;
    productId?: string | null;
  }>;
};

export function serializeCustomizationProfile(row: CustomizationProfileRow): CustomizationProfile {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    active: row.active,
    sortOrder: row.sortOrder,
    fields: row.fields.map((field) => ({
      id: field.id,
      label: field.label,
      type: field.type as CustomizationProfile['fields'][number]['type'],
      required: field.required,
      helpText: field.helpText,
      placeholder: field.placeholder,
      options: field.options,
      sortOrder: field.sortOrder,
    })),
    assignments: row.assignments.map((assignment) => ({
      id: assignment.id,
      profileId: assignment.profileId,
      scope: assignment.scope as CustomizationProfile['assignments'][number]['scope'],
      collectionKey: assignment.collectionKey,
      categoryId: assignment.categoryId,
      productId: assignment.productId,
    })),
  };
}

function normalizedAssignments(assignments: ProfileInput['assignments']) {
  return assignments.map((assignment) => ({
    scope: assignment.scope,
    collectionKey: assignment.scope === 'collection' ? assignment.collectionKey ?? null : null,
    categoryId: assignment.scope === 'category' ? assignment.categoryId ?? null : null,
    productId: assignment.scope === 'product' ? assignment.productId ?? null : null,
  }));
}

function conflictFilters(assignments: ReturnType<typeof normalizedAssignments>) {
  return assignments
    .map((assignment) => {
      if (assignment.scope === 'collection' && assignment.collectionKey) {
        return { scope: 'collection', collectionKey: assignment.collectionKey };
      }
      if (assignment.scope === 'category' && assignment.categoryId) {
        return { scope: 'category', categoryId: assignment.categoryId };
      }
      if (assignment.scope === 'product' && assignment.productId) {
        return { scope: 'product', productId: assignment.productId };
      }
      return null;
    })
    .filter((filter): filter is NonNullable<typeof filter> => Boolean(filter));
}

export async function saveCustomizationProfile(input: ProfileInput, id?: string): Promise<CustomizationProfile> {
  return prisma.$transaction(async (tx) => {
    const profile = id
      ? await tx.customizationProfile.update({
          where: { id },
          data: {
            name: input.name,
            description: input.description,
            active: input.active,
            sortOrder: input.sortOrder,
          },
        })
      : await tx.customizationProfile.create({
          data: {
            name: input.name,
            description: input.description,
            active: input.active,
            sortOrder: input.sortOrder,
          },
        });

    const assignments = normalizedAssignments(input.assignments);
    const conflicts = conflictFilters(assignments);
    if (conflicts.length) {
      await tx.customizationProfileAssignment.deleteMany({
        where: {
          OR: conflicts,
          NOT: { profileId: profile.id },
        },
      });
    }

    await tx.customizationField.deleteMany({ where: { profileId: profile.id } });
    await tx.customizationProfileAssignment.deleteMany({ where: { profileId: profile.id } });

    if (input.fields.length) {
      await tx.customizationField.createMany({
        data: input.fields.map((field, index) => ({
          profileId: profile.id,
          label: field.label,
          type: field.type,
          required: field.required,
          helpText: field.helpText,
          placeholder: field.placeholder,
          options: field.options,
          sortOrder: field.sortOrder || index,
        })),
      });
    }

    if (assignments.length) {
      await tx.customizationProfileAssignment.createMany({
        data: assignments.map((assignment) => ({
          profileId: profile.id,
          ...assignment,
        })),
      });
    }

    const row = await tx.customizationProfile.findUniqueOrThrow({
      where: { id: profile.id },
      include: customizationProfileInclude,
    });
    return serializeCustomizationProfile(row);
  });
}
