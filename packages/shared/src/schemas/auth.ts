import * as v from "valibot";
import { LIMITS } from "../constants.js";

export const RegisterSchema = v.object({
  email: v.pipe(v.string(), v.email(), v.maxLength(255)),
  password: v.pipe(v.string(), v.minLength(LIMITS.PASSWORD_MIN_LENGTH)),
  username: v.pipe(
    v.string(),
    v.minLength(LIMITS.USERNAME_MIN_LENGTH),
    v.maxLength(LIMITS.USERNAME_MAX_LENGTH),
    v.regex(/^[a-zA-Z0-9_]+$/, "Username must be alphanumeric or underscore")
  ),
});
export type RegisterInput = v.InferInput<typeof RegisterSchema>;

export const LoginSchema = v.object({
  email: v.pipe(v.string(), v.email()),
  password: v.pipe(v.string(), v.minLength(1)),
});
export type LoginInput = v.InferInput<typeof LoginSchema>;

export const OtpSendSchema = v.object({
  phone: v.pipe(
    v.string(),
    v.regex(/^\+233\d{9}$/, "Phone must be in format +233XXXXXXXXX")
  ),
});
export type OtpSendInput = v.InferInput<typeof OtpSendSchema>;

export const OtpVerifySchema = v.object({
  phone: v.pipe(
    v.string(),
    v.regex(/^\+233\d{9}$/, "Phone must be in format +233XXXXXXXXX")
  ),
  code: v.pipe(v.string(), v.regex(/^\d{6}$/, "Code must be 6 digits")),
});
export type OtpVerifyInput = v.InferInput<typeof OtpVerifySchema>;

export const ExchangeSchema = v.object({
  code: v.pipe(v.string(), v.minLength(1)),
});
export type ExchangeInput = v.InferInput<typeof ExchangeSchema>;

export const ResetRequestSchema = v.object({
  email: v.pipe(v.string(), v.email()),
});
export type ResetRequestInput = v.InferInput<typeof ResetRequestSchema>;

export const ResetConfirmSchema = v.object({
  email: v.pipe(v.string(), v.email()),
  code: v.pipe(v.string(), v.regex(/^\d{6}$/, "Code must be 6 digits")),
  new_password: v.pipe(v.string(), v.minLength(LIMITS.PASSWORD_MIN_LENGTH)),
});
export type ResetConfirmInput = v.InferInput<typeof ResetConfirmSchema>;

export const UpdateProfileSchema = v.object({
  username: v.optional(
    v.pipe(
      v.string(),
      v.minLength(LIMITS.USERNAME_MIN_LENGTH),
      v.maxLength(LIMITS.USERNAME_MAX_LENGTH),
      v.regex(/^[a-zA-Z0-9_]+$/, "Username must be alphanumeric or underscore")
    )
  ),
  display_name: v.optional(v.pipe(v.string(), v.maxLength(100))),
});
export type UpdateProfileInput = v.InferInput<typeof UpdateProfileSchema>;
