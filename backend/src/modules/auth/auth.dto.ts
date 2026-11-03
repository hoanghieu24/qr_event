import { z } from 'zod';

export const LoginSchema = z.object({
  email: z.string().email('Email không đúng định dạng'),
  password: z.string().min(6, 'Mật khẩu tối thiểu 6 ký tự'),
});

export const SendOtpSchema = z.object({
  email: z.string().email('Email không đúng định dạng'),
});

export const VerifyOtpSchema = z.object({
  email: z.string().email('Email không đúng định dạng'),
  otp: z.string().length(6, 'Mã OTP gồm 6 chữ số'),
  name: z.string().optional(),
  phone: z.string().optional(),
});
