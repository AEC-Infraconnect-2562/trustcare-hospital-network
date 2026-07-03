import { getDb } from './server/db.ts';
import { users, walletCards } from './drizzle/schema.ts';
import { eq } from 'drizzle-orm';

async function check() {
  const db = await getDb();
  if (!db) { console.error('No DB'); process.exit(1); }
  
  const allUsers = await db.select({ id: users.id, name: users.name, systemRole: users.systemRole, openId: users.openId }).from(users);
  const identityCards = await db.select({ userId: walletCards.userId, cardType: walletCards.cardType }).from(walletCards).where(eq(walletCards.cardType, 'identity'));
  
  const usersWithCards = new Set(identityCards.map(c => c.userId));
  
  console.log('=== Users WITHOUT identity cards ===');
  for (const u of allUsers) {
    if (usersWithCards.has(u.id) === false) {
      console.log(u.id, u.openId, u.systemRole, u.name);
    }
  }
  console.log('\n=== Users WITH identity cards ===');
  for (const u of allUsers) {
    if (usersWithCards.has(u.id)) {
      console.log(u.id, u.openId, u.systemRole, u.name);
    }
  }
  process.exit(0);
}
check();
