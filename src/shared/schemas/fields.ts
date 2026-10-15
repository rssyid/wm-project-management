import { z } from "zod";

import { isBusinessDateString } from "@/shared/date";
import { isMoneyAmount } from "@/shared/money";

/**
 * Field dasar dipakai beberapa skema F2. Uang dan tanggal tetap string supaya form klien,
 * isi request, dan nilai di database punya satu bentuk yang sama; konversi ke Decimal dan
 * kolom @db.Date terjadi di domain service.
 */
export const nameField = z
  .string()
  .trim()
  .min(1, "Nama wajib diisi.")
  .max(160);

export const optionalTextField = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Maksimal ${max} karakter.`)
    .optional()
    .nullable();

export const moneyField = z
  .string()
  .trim()
  .refine(
    isMoneyAmount,
    "Isi nominal dengan angka tanpa pemisah ribuan dan maksimal dua desimal.",
  );

export const optionalMoneyField = z
  .string()
  .trim()
  .refine(
    (value) => value.length === 0 || isMoneyAmount(value),
    "Isi nominal dengan angka tanpa pemisah ribuan dan maksimal dua desimal.",
  )
  .optional()
  .nullable();

export const businessDateField = z
  .string()
  .trim()
  .refine(isBusinessDateString, "Isi tanggal dengan format YYYY-MM-DD.");

export const optionalBusinessDateField = z
  .string()
  .trim()
  .refine(
    (value) => value.length === 0 || isBusinessDateString(value),
    "Isi tanggal dengan format YYYY-MM-DD.",
  )
  .optional()
  .nullable();

/** Alasan wajib untuk pembatalan, tahan, revisi, dan koreksi (docs/05 §1). */
export const reasonField = z
  .string()
  .trim()
  .min(3, "Alasan wajib diisi.")
  .max(500);

export const idField = z.string().trim().min(1, "Pilih data terlebih dahulu.");