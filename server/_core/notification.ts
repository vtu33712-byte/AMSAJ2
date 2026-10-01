export async function notifyOwner(payload: { title: string; content: string }) {
  console.log(`[Notification] ${payload.title}: ${payload.content}`);
  return true;
}
