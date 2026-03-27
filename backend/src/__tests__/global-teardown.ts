/**
 * Jest Global Teardown
 * Runs ONCE after all test suites complete.
 */

export default async function globalTeardown() {
  console.log('\n🧹 Cleaning up test environment...');
  // Add cleanup logic here if needed (drop test DB, close connections)
  console.log('  ✓ Cleanup complete\n');
}
