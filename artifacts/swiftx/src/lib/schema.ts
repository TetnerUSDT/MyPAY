import { z } from "zod";

export interface User {
  id: number;
  tgId: string;
  tgUsername: string | null;
  google: string | null;
  apiKey: string | null;
  name: string | null;
  img: string | null;
  status: string | null;
  agreement: number | null;
  blocked: boolean | null;
  defaultFiatBalanceId: number | null;
  idRef: number | null;
  codeRef: string | null;
  trust: number | null;
  phone: string | null;
}

const nullableString = z.string().nullable().optional();
const nullableNumber = z.number().int().nullable().optional();

export const insertBalanceSchema = z.object({
  title: z.string().min(1),
  network: nullableString,
  currency: z.string().min(1),
  rate: nullableString,
  balanceType: z.string().default("fiat"),
  status: z.string().default("active"),
  targetBalanceId: nullableNumber,
  pattern: nullableString,
  qrColor: z
    .union([
      z.object({ type: z.literal("single"), color: z.string() }),
      z.object({
        type: z.literal("gradient"),
        colors: z.tuple([z.string(), z.string()]),
      }),
    ])
    .nullable()
    .optional(),
  qrStyle: z
    .enum(["square", "dots", "rounded", "extra-rounded", "classy", "classy-rounded"])
    .nullable()
    .optional(),
});

export const insertUsersBalancesSchema = z.object({
  idBalance: z.number().int().positive(),
  idUser: z.number().int().positive(),
  sum: z.string(),
  status: nullableString,
  accountNumber: nullableString,
});