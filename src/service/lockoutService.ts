import prisma from '../lib/prisma';
import { MESSAGES } from '../constants/messages';

const MAX_ATTEMPTS   = 5;
const BLOCK_ATTEMPTS = 10;
const LOCK_MINUTES   = 15;

function localNow(): Date {
  return new Date(
    new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Vientiane' }).replace(' ', 'T') + 'Z'
  );
}

export class LockoutService {

  static async getStatus(usercode: string) {
    const record = await prisma.tb_login_attempts.findUnique({ where: { usercode } });
    if (!record) {
      return { usercode, status: 'normal', attempts: 0, block_count: 0, locked_until: null, last_attempt: null };
    }
    const now = localNow();
    const status = record.is_blocked ? 'blocked'
      : record.locked_until && record.locked_until > now ? 'locked'
      : 'normal';
    return {
      usercode,
      status,
      attempts:     record.attempts,
      block_count:  record.block_count,
      locked_until: record.locked_until,
      last_attempt: record.last_attempt,
      unlocked_by:  record.unlocked_by,
      unlocked_at:  record.unlocked_at,
    };
  }

  static async getList() {
    const records = await prisma.tb_login_attempts.findMany({
      orderBy: { last_attempt: 'desc' },
    });
    const now = localNow();
    return records.map((r: (typeof records)[number]) => ({
      ...r,
      status: r.is_blocked ? 'blocked'
        : r.locked_until && r.locked_until > now ? 'locked'
        : 'normal',
    }));
  }

  static async recordAttempt(usercode: string) {
    const now     = localNow();
    const record  = await prisma.tb_login_attempts.findUnique({ where: { usercode } });
    const current = (record?.attempts ?? 0) + 1;

    // ผิดครั้งที่ 10 → block ถาวร
    if (current >= BLOCK_ATTEMPTS) {
      await prisma.tb_login_attempts.upsert({
        where:  { usercode },
        create: { usercode, attempts: current, is_blocked: true, block_count: 1, last_attempt: now },
        update: { attempts: current, is_blocked: true, block_count: { increment: 1 }, locked_until: null, last_attempt: now },
      });
      return { status: 'blocked' as const };
    }

    // ผิดครั้งที่ 5 → lock ชั่วคราว
    if (current === MAX_ATTEMPTS) {
      const lockedUntil = new Date(now.getTime() + LOCK_MINUTES * 60 * 1000);
      await prisma.tb_login_attempts.upsert({
        where:  { usercode },
        create: { usercode, attempts: current, locked_until: lockedUntil, last_attempt: now },
        update: { attempts: current, locked_until: lockedUntil, last_attempt: now },
      });
      return { status: 'locked' as const, minutes: LOCK_MINUTES };
    }

    // ผิด 1-4 หรือ 6-9 → นับ +1
    await prisma.tb_login_attempts.upsert({
      where:  { usercode },
      create: { usercode, attempts: current, last_attempt: now },
      update: { attempts: current, locked_until: null, last_attempt: now },
    });
    const remaining = current < MAX_ATTEMPTS
      ? MAX_ATTEMPTS   - current
      : BLOCK_ATTEMPTS - current;
    return { status: 'remaining' as const, remaining };
  }

  static async recordSuccess(usercode: string) {
    await prisma.tb_login_attempts.updateMany({
      where: { usercode },
      data:  { attempts: 0, locked_until: null, is_blocked: false },
    });
  }

  static async unlock(usercode: string, unlockedBy: string) {
    const record = await prisma.tb_login_attempts.findUnique({ where: { usercode } });
    if (!record) return null;

    await prisma.tb_login_attempts.update({
      where: { usercode },
      data:  {
        is_blocked:   false,
        locked_until: null,
        attempts:     0,
        unlocked_by:  unlockedBy,
        unlocked_at:  new Date(),
      },
    });

    return {
      message:      MESSAGES.unlockSuccess(usercode),
      block_count:  record.block_count,
      last_attempt: record.last_attempt,
    };
  }
}
