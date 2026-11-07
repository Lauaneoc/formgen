import { z } from 'zod';
import { allowedFieldTypes } from './field-types.js';

export const fieldSchema = z.object({
  id: z.string(),
  label: z.string(),
  domainType: z.enum(allowedFieldTypes),
  htmlType: z.string(),
  required: z.boolean(),
  helpText: z.string().optional(),
  placeholder: z.string().optional(),
  defaultValue: z.union([z.string(), z.number(), z.boolean()]).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  minLength: z.number().optional(),
  maxLength: z.number().optional(),
  options: z.array(z.string()).optional(),
});

export const formSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  fields: z.array(fieldSchema).min(1),
  submitButton: z.object({
    text: z.string(),
  }),
});

export type FormField = z.infer<typeof fieldSchema>;
export type FormDefinition = z.infer<typeof formSchema>;
