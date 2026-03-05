import { z } from 'zod';

export const itemTypeSchema = z.enum(['link', 'file', 'note']);

const baseItemSchema = {
  description: z.string().max(500),
  title: z.string().max(200).optional().nullable(),
  priority: z.number().int().min(1).max(20).optional().nullable(),
  url: z.string().url().optional().nullable(),
  mime_type: z.string().max(200).optional().nullable(),
};

export const createItemSchema = z
  .object({
    type: itemTypeSchema,
    ...baseItemSchema,
    inbox: z.boolean().optional(),
  })
  .refine(
    (data) => {
      if (data.type === 'link') return !!data.url?.trim();
      return true;
    },
    { message: 'URL is required for link items', path: ['url'] },
  )
  .refine(
    (data) => {
      const desc = data.description?.trim() ?? '';
      // Non-inbox items must have 12–500 chars; inbox items may be shorter/empty
      if (data.inbox === true) return desc.length <= 500;
      return desc.length >= 12 && desc.length <= 500;
    },
    { message: 'Description must be 12–500 characters', path: ['description'] },
  );

export const updateItemSchema = z
  .object({
    title: z.string().max(200).optional().nullable(),
    description: z.string().min(12).max(500).optional(),
    priority: z.number().int().min(1).max(20).optional().nullable(),
    url: z.string().url().optional().nullable(),
    inbox: z.boolean().optional(),
  })
  .refine((data) => data.description === undefined || data.description.length >= 12, {
    message: 'Description must be at least 12 characters',
    path: ['description'],
  });

export type CreateItemInput = z.infer<typeof createItemSchema>;
export type UpdateItemInput = z.infer<typeof updateItemSchema>;
