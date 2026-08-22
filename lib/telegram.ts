const API_BASE = 'https://api.telegram.org/bot';

export interface TelegramChatOption { id: string; title: string }

async function callTelegram(botToken: string, method: string, body?: Record<string, unknown>) {
  const res = await fetch(`${API_BASE}${botToken}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.ok) {
    throw new Error(json.description || `Telegram ${method} failed (${res.status}).`);
  }
  return json.result;
}

/** Verifies the bot token is valid and returns its @username. */
export async function getBotUsername(botToken: string): Promise<string> {
  const me = await callTelegram(botToken, 'getMe');
  if (!me?.username) throw new Error('Could not read the bot username from Telegram.');
  return me.username as string;
}

/** Sends a plain-text message to a chat — used both for real alerts and the "Test & Save" check. */
export async function sendTelegramMessage(botToken: string, chatId: string, text: string): Promise<void> {
  await callTelegram(botToken, 'sendMessage', { chat_id: chatId, text, disable_web_page_preview: true });
}

/**
 * Scans recent updates for group/supergroup chats the bot has seen (added to
 * a group, mentioned, etc.) so the admin doesn't have to look up the numeric
 * chat ID by hand. Only sees activity since the bot was added and within
 * Telegram's short update-retention window — if nothing shows up, have
 * someone send any message in the target staff group first, then retry.
 * Private (1:1) chats are excluded — alerts are meant for a shared staff group.
 */
export async function detectTelegramChats(botToken: string): Promise<TelegramChatOption[]> {
  const updates = (await callTelegram(botToken, 'getUpdates', { limit: 100 })) as Array<{
    message?: { chat: { id: number; title?: string; type: string } };
    channel_post?: { chat: { id: number; title?: string; type: string } };
    my_chat_member?: { chat: { id: number; title?: string; type: string } };
  }>;
  const chats = new Map<string, string>();
  for (const update of updates ?? []) {
    const chat = update.message?.chat ?? update.channel_post?.chat ?? update.my_chat_member?.chat;
    if (!chat || chat.type === 'private') continue;
    chats.set(String(chat.id), chat.title || String(chat.id));
  }
  return Array.from(chats, ([id, title]) => ({ id, title }));
}

/** Verifies the token + chat ID both work by sending a real test message. */
export async function testTelegramConnection(botToken: string, chatId: string): Promise<{ username: string }> {
  const username = await getBotUsername(botToken);
  await sendTelegramMessage(botToken, chatId, 'Dress Collection: test alert. If you can see this, staff notifications are connected.');
  return { username };
}
