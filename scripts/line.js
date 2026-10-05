// Broadcast messages to every friend of the LINE Official Account (Messaging API)
async function broadcast(...messages) {
  const token = (process.env.LINE_CHANNEL_ACCESS_TOKEN || '').trim(); // copy-paste often adds spaces/newlines
  if (!token) throw new Error('LINE_CHANNEL_ACCESS_TOKEN is not set');
  const r = await fetch('https://api.line.me/v2/bot/message/broadcast', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ messages }),
  });
  if (!r.ok) throw new Error(`LINE ${r.status}: ${await r.text()}`);
}

module.exports = { broadcast };
