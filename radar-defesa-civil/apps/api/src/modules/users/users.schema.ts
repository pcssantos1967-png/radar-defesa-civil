import { z } from 'zod';

export const createUserSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  role: z.enum(['admin', 'operator', 'manager', 'viewer', 'api_user']),
  consortiumId: z.string().uuid().optional(),
  municipalityIds: z.array(z.string().uuid()).optional(),
  phone: z.string().optional(),
  notificationPreferences: z.object({
    email: z.boolean().optional(),
    sms: z.boolean().optional(),
    whatsapp: z.boolean().optional(),
    push: z.boolean().optional(),
    severities: z.array(z.string()).optional(),
  }).optional(),
});

export const updateUserSchema = createUserSchema.partial().omit({ password: true });

export const queryUsersSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  role: z.enum(['admin', 'operator', 'manager', 'viewer', 'api_user']).optional(),
  consortiumId: z.string().uuid().optional(),
  isActive: z.coerce.boolean().optional(),
  search: z.string().optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type QueryUsersInput = z.infer<typeof queryUsersSchema>;
