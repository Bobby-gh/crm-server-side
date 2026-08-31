import Joi from 'joi';
import { Request, Response, NextFunction } from 'express';

// ── Schemas ───────────────────────────────────────────────────────────────

export const signupSchema = Joi.object({
  username: Joi.string().trim().min(3).max(100).required()
    .messages({
      'string.min': "L'identifiant doit contenir au moins 3 caractères.",
      'any.required': 'Identifiant et mot de passe requis.',
    }),
  email: Joi.string().trim().email().allow('', null).optional(),
  password: Joi.string().min(8).max(128).required()
    .messages({
      'string.min': 'Le mot de passe doit contenir au moins 8 caractères.',
      'any.required': 'Le mot de passe est requis.',
    }),
  organizationName: Joi.string().trim().max(200).allow('', null).optional(),
});

export const loginSchema = Joi.object({
  username: Joi.string().trim().min(1).optional(),
  email: Joi.string().trim().email().optional(),
  password: Joi.string().min(1).required()
    .messages({
      'any.required': 'Identifiant et mot de passe requis.',
    }),
}).or('username', 'email')
  .messages({
    'object.missing': 'Identifiant et mot de passe requis.',
  });

export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().min(1).required()
    .messages({ 'any.required': 'Current password is required.' }),
  newPassword: Joi.string().min(8).max(128).required()
    .messages({
      'string.min': 'The new password must be at least 8 characters long.',
      'any.required': 'New password is required.',
    }),
});

export const createUserSchema = Joi.object({
  username: Joi.string().trim().min(3).max(100).required()
    .messages({
      'string.min': "L'identifiant doit contenir au moins 3 caractères.",
    }),
  email: Joi.string().trim().email().allow('', null).optional(),
});

export const storagePutSchema = Joi.object({
  value: Joi.string().required()
    .messages({ 'any.required': 'Le champ "value" doit être une chaîne de caractères' }),
});

export const storageQuerySchema = Joi.object({
  prefix: Joi.string().trim().allow('').optional(),
  status: Joi.string().trim().valid('New', 'In Progress', 'Processed', 'Rejected').optional(),
  search: Joi.string().trim().allow('').optional(),
});

// ── Middleware factory ─────────────────────────────────────────────────────

export function validate(schema: Joi.ObjectSchema, source: 'body' | 'query' | 'params' = 'body') {
  return (req: Request, res: Response, next: NextFunction) => {
    const dataToValidate = source === 'params' ? req.params
      : source === 'query' ? req.query
      : req.body;

    const { error, value } = schema.validate(dataToValidate, {
      abortEarly: false,
      stripUnknown: true,
      allowUnknown: source === 'params', // params always have extra keys
    });

    if (error) {
      const message = error.details.map((d) => d.message).join('; ');
      res.status(400).json({ error: message });
      return;
    }

    // Replace with validated/sanitized values
    if (source === 'body') req.body = value;
    else if (source === 'query') (req as any).validatedQuery = value;

    next();
  };
}
