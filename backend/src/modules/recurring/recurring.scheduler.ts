import { processRecurringTasks } from './recurring.service';

let intervalId: NodeJS.Timeout | null = null;

export function startRecurringScheduler(intervalMinutes = 60) {
  // Process immediately on start
  processRecurringTasks().catch((err) =>
    console.error('Recurring task processing error:', err),
  );

  // Then every N minutes
  intervalId = setInterval(() => {
    processRecurringTasks().catch((err) =>
      console.error('Recurring task processing error:', err),
    );
  }, intervalMinutes * 60 * 1000);

  console.log(`Recurring task scheduler started (every ${intervalMinutes} minutes)`);
}

export function stopRecurringScheduler() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
