import { db } from './index.ts';
import { users, wallets } from './schema.ts';
import { eq } from 'drizzle-orm';

export async function getOrCreateUser(uid: string, email: string, username?: string) {
  try {
    const defaultUsername = username || email.split('@')[0] || `player_${uid.slice(0, 6)}`;
    
    // Upsert user
    const result = await db
      .insert(users)
      .values({
        uid,
        email,
        username: defaultUsername,
        operatorId: 'CASINO_ROYAL_01',
        currency: 'USD',
        status: 'ACTIVE',
        countryCode: 'US',
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
          updatedAt: new Date(),
        },
      })
      .returning();

    const user = result[0];

    // Ensure user has a default USD wallet
    const existingWallets = await db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, user.id));

    if (existingWallets.length === 0) {
      await db.insert(wallets).values({
        userId: user.id,
        currency: 'USD',
        realBalance: '1000.0000',
        bonusBalance: '50.0000',
        lockedBalance: '0.0000',
        balanceMinor: '10000000',
        version: 1,
        status: 'ACTIVE',
      });
    }

    return user;
  } catch (error) {
    console.error('Failed to get or create user:', error);
    throw new Error('Database user sync failed.', { cause: error });
  }
}

export async function getUsers() {
  try {
    return await db.select().from(users);
  } catch (error) {
    console.error('Database query failed for getUsers:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function getWalletsByUserId(userId: number) {
  try {
    return await db.select().from(wallets).where(eq(wallets.userId, userId));
  } catch (error) {
    console.error('Database query failed for getWalletsByUserId:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}
