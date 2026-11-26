import "server-only";

/**
 * Runs work after the response is sent, so a slow Telegram API never delays the customer's
 * confirmation. On a long-running Node server the promise simply continues after the response.
 */
export async function runInBackground(task: Promise<unknown>): Promise<void> {
  void task.catch((err) => console.error("[background]", err));
}
