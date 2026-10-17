import { createRequestLogger } from 'evlog';

import type { PrismaClient } from 'src/lib/prisma/generated/client';

export const SIGNUP_CREDITS_KEY = 'signupCredits';
export const SIGNUP_GRANT_REASON = 'signup grant';
export const DEFAULT_SIGNUP_CREDITS = 100;

export type CreditAudience = 'user' | 'team' | 'organization';

export function parseCreditAmount(
  value: unknown,
  fallback = DEFAULT_SIGNUP_CREDITS,
): number {
  const raw =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value.trim())
        : NaN;
  if (!Number.isInteger(raw) || raw < 0) {
    return fallback;
  }
  return raw;
}

export function parseRewardAmount(value: unknown): number | null {
  const amount = parseCreditAmount(value, Number.NaN);
  if (!Number.isInteger(amount) || amount < 1) {
    return null;
  }
  return amount;
}

export function parseCreditAudience(value: unknown): CreditAudience | null {
  if (typeof value !== 'string') {
    return null;
  }
  const raw = value.trim().toLowerCase();
  if (raw === 'user' || raw === 'team') {
    return raw;
  }
  if (raw === 'organization' || raw === 'organisation') {
    return 'organization';
  }
  return null;
}

export async function getSignupCredits(db: PrismaClient): Promise<number> {
  const setting = await db.platformSetting.findUnique({
    where: { key: SIGNUP_CREDITS_KEY },
    select: { value: true },
  });
  return parseCreditAmount(setting?.value);
}

export async function setSignupCredits(
  db: PrismaClient,
  amount: number,
): Promise<number> {
  const value = String(parseCreditAmount(amount));
  await db.platformSetting.upsert({
    where: { key: SIGNUP_CREDITS_KEY },
    create: { key: SIGNUP_CREDITS_KEY, value },
    update: { value },
  });
  return Number(value);
}

export async function grantSignupCredits(
  db: PrismaClient,
  userId: string,
): Promise<void> {
  const amount = await getSignupCredits(db);
  try {
    await db.$transaction(async (tx) => {
      const existing = await tx.creditLedger.findFirst({
        where: {
          audience: 'user',
          targetId: userId,
          reason: SIGNUP_GRANT_REASON,
        },
        select: { id: true },
      });
      if (existing) {
        return;
      }

      await tx.user.update({
        where: { id: userId },
        data: { creditBalance: amount },
      });
      await tx.creditLedger.create({
        data: {
          audience: 'user',
          targetId: userId,
          amount,
          reason: SIGNUP_GRANT_REASON,
        },
      });
    });
  } catch (error) {
    if (isSignupGrantUniqueViolation(error)) {
      return;
    }
    throw error;
  }
}

function isSignupGrantUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  );
}

/** Grants signup credits once the user's email is verified; success is silent. */
export async function grantSignupCreditsIfEligible(
  db: PrismaClient,
  userId: string,
): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { emailVerified: true },
  });
  if (!user?.emailVerified) {
    return false;
  }

  try {
    await grantSignupCredits(db, userId);
    return true;
  } catch (error) {
    const log = createRequestLogger();
    log.set({ credits: { action: 'signup-grant' }, status: 500 });
    log.error(error instanceof Error ? error : new Error(String(error)));
    log.emit();
    return false;
  }
}

/** @deprecated Use {@link grantSignupCreditsIfEligible} */
export async function grantSignupCreditsSafe(
  db: PrismaClient,
  userId: string,
): Promise<void> {
  await grantSignupCreditsIfEligible(db, userId);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

export function extractAuthUserId(payload: unknown): string | null {
  const record = asRecord(payload);
  if (!record) {
    return null;
  }
  const nested = asRecord(record.user);
  const id = nested?.id ?? record.id;
  return typeof id === 'string' && id.length > 0 ? id : null;
}

export function applyCreditBalanceToAuthPayload(
  payload: unknown,
  creditBalance: number,
): unknown {
  const record = asRecord(payload);
  if (!record) {
    return payload;
  }
  const nested = asRecord(record.user);
  if (nested) {
    return { ...record, user: { ...nested, creditBalance } };
  }
  if (typeof record.id === 'string') {
    return { ...record, creditBalance };
  }
  return payload;
}

/** Grants signup credits if eligible, then copies the stored balance onto the auth payload. */
export async function grantAndAttachSignupCredits(
  db: PrismaClient,
  payload: unknown,
): Promise<unknown> {
  const userId = extractAuthUserId(payload);
  if (!userId) {
    return payload;
  }

  await grantSignupCreditsIfEligible(db, userId);
  const row = await db.user.findUnique({
    where: { id: userId },
    select: { creditBalance: true },
  });
  if (typeof row?.creditBalance !== 'number') {
    return payload;
  }
  return applyCreditBalanceToAuthPayload(payload, row.creditBalance);
}

export function mapCreditRewardError(
  error: unknown,
): { status: number; message: string } | null {
  if (!(error instanceof Error)) {
    return null;
  }
  if (error.message === 'Invalid reward amount') {
    return { status: 400, message: 'Invalid reward amount' };
  }
  if (error.message === 'USER_MISSING') {
    return { status: 404, message: 'Account missing' };
  }
  if (error.message === 'TEAM_MISSING') {
    return { status: 404, message: 'Team missing' };
  }
  if (error.message === 'ORGANIZATION_MISSING') {
    return { status: 404, message: 'Organisation missing' };
  }
  return null;
}

export async function rewardCredits(
  db: PrismaClient,
  input: {
    audience: CreditAudience;
    targetId: string;
    amount: number;
    reason?: string;
    actorId?: string;
  },
): Promise<{
  audience: CreditAudience;
  targetId: string;
  amount: number;
  balance: number;
}> {
  const amount = parseRewardAmount(input.amount);
  if (amount === null) {
    throw new Error('Invalid reward amount');
  }

  return db.$transaction(async (tx) => {
    let balance: number | undefined;
    if (input.audience === 'user') {
      const existing = await tx.user.findUnique({
        where: { id: input.targetId },
        select: { id: true },
      });
      if (!existing) {
        throw new Error('USER_MISSING');
      }
      const updated = await tx.user.update({
        where: { id: input.targetId },
        data: { creditBalance: { increment: amount } },
        select: { creditBalance: true },
      });
      balance = updated.creditBalance;
    } else if (input.audience === 'team') {
      const existing = await tx.team.findUnique({
        where: { id: input.targetId },
        select: { id: true },
      });
      if (!existing) {
        throw new Error('TEAM_MISSING');
      }
      const updated = await tx.team.update({
        where: { id: input.targetId },
        data: { creditBalance: { increment: amount } },
        select: { creditBalance: true },
      });
      balance = updated.creditBalance;
    } else {
      const existing = await tx.organization.findUnique({
        where: { id: input.targetId },
        select: { id: true },
      });
      if (!existing) {
        throw new Error('ORGANIZATION_MISSING');
      }
      const updated = await tx.organization.update({
        where: { id: input.targetId },
        data: { creditBalance: { increment: amount } },
        select: { creditBalance: true },
      });
      balance = updated.creditBalance;
    }

    await tx.creditLedger.create({
      data: {
        audience: input.audience,
        targetId: input.targetId,
        amount,
        reason: input.reason?.trim() || 'admin reward',
        actorId: input.actorId,
      },
    });

    return {
      audience: input.audience,
      targetId: input.targetId,
      amount,
      balance: balance ?? 0,
    };
  });
}
