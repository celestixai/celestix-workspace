/**
 * Jest Setup — runs before each test suite.
 * Provides test helpers and shared fixtures.
 */

import { PrismaClient } from '@prisma/client';

// Test Prisma client
export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'postgresql://celestix_test:testpassword@localhost:5432/celestix_test',
    },
  },
});

// ── Test Fixtures ──
export const TEST_USER = {
  email: 'test@celestix.ai',
  password: 'TestPassword123!',
  firstName: 'Test',
  lastName: 'User',
};

export const TEST_ADMIN = {
  email: 'admin@celestix.ai',
  password: 'AdminPassword123!',
  firstName: 'Admin',
  lastName: 'User',
};

// ── Auth Helper ──
export async function getAuthToken(baseUrl: string, credentials = TEST_USER): Promise<string> {
  const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: credentials.email,
      password: credentials.password,
    }),
  });

  if (!res.ok) {
    throw new Error(`Login failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json() as any;
  return data.token || data.accessToken;
}

// ── Cleanup Helper ──
export async function cleanupTestData() {
  // Delete in reverse dependency order
  const tables = [
    'Notification', 'AuditLog', 'MessageReaction', 'MessageReadReceipt',
    'Message', 'ChatMember', 'Chat', 'Session',
  ];

  for (const table of tables) {
    try {
      await (prisma as any)[table.charAt(0).toLowerCase() + table.slice(1)].deleteMany({
        where: { createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } }, // Last hour only
      });
    } catch {
      // Table might not exist yet — that's fine
    }
  }
}

// Clean up after all tests in this suite
afterAll(async () => {
  await prisma.$disconnect();
});
