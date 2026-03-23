const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });
const BACKEND_URL = 'http://localhost:3001';
const ADMIN_TELEGRAM_ID = 5311155297;

function isAdmin(msg: any) {
  return msg.from?.id === ADMIN_TELEGRAM_ID;
}

// /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;

  bot.sendMessage(
    chatId,
    'Bot attivo ✅\nUsa /help per vedere tutti i comandi.'
  );
});

// /help
bot.onText(/\/help/, async (msg) => {
  const chatId = msg.chat.id;

  const text =
`📘 Comandi disponibili

/start → avvia il bot
/help → mostra questo elenco
/mioid → mostra il tuo Telegram user ID
/profilo → mostra il tuo profilo
/richieste → mostra le richieste attive
/mie_richieste → mostra le richieste create da te
/pending_requests → lista richieste da approvare
/approve_request ID → approva richiesta
/reject_request ID → rifiuta richiesta

/crearichiesta titolo | descrizione | importo
Esempio:
/crearichiesta Aiuto urgente | Mi servono 25 euro | 25

/dona request_id importo
Esempio:
/dona 3 5`;

  await bot.sendMessage(chatId, text);
});

// /profilo
bot.onText(/\/profilo/, async (msg) => {
  const chatId = msg.chat.id;
  const telegramUserId = msg.from.id;

  try {
    const response = await axios.get(
      `http://localhost:3001/api/profile-by-telegram/${telegramUserId}`
    );

    const profile = response.data;
    const badgeNames =
      profile.badges.map((b) => b.badge).join(', ') || 'Nessuno';

    const text =
`👤 Profilo utente

🆔 ID interno: ${profile.user.id}
📛 Nome: ${profile.user.display_name}
💬 Username: ${profile.user.username || 'N/A'}
⭐ Score: ${profile.user.score}
🏆 Livello: ${profile.user.level}

📊 Statistiche:
- Badge: ${profile.stats.total_badges}
- Donazioni fatte: ${profile.stats.total_donations}
- Totale donato: ${profile.stats.total_donated_amount}€
- Richieste create: ${profile.stats.total_requests}

🎖 Badge:
${badgeNames}`;

    await bot.sendMessage(chatId, text);
  } catch (error) {
    await bot.sendMessage(
      chatId,
      'Profilo non trovato. Il tuo telegram_user_id non è ancora associato a un utente nel database.'
    );
  }
});

// /richieste
bot.onText(/\/richieste/, async (msg) => {
  const chatId = msg.chat.id;

  try {
    const response = await axios.get('http://localhost:3001/api/requests');
    const requests = response.data;

    if (!requests || requests.length === 0) {
      await bot.sendMessage(chatId, 'Non ci sono richieste attive.');
      return;
    }

    const topRequests = requests.slice(0, 5);

    const text = topRequests.map((request) => {
      return `📢 Richiesta #${request.id}
📝 ${request.title}
💰 ${request.current_amount}€ / ${request.target_amount}€
📊 ${request.progress_percent}%
${request.progress_bar}`;
    }).join('\n\n');

    await bot.sendMessage(chatId, text);
  } catch (error) {
    await bot.sendMessage(chatId, 'Errore nel recupero delle richieste.');
  }
});

// /mie_richieste
bot.onText(/\/mie_richieste/, async (msg) => {
  const chatId = msg.chat.id;
  const telegramUserId = msg.from.id;

  try {
    const response = await axios.get(
      `http://localhost:3001/api/my-requests-by-telegram/${telegramUserId}`
    );

    const requests = response.data;

    if (!requests || requests.length === 0) {
      await bot.sendMessage(chatId, 'Non hai ancora creato richieste.');
      return;
    }

    const text = requests.slice(0, 10).map((request) => {
      return `🧾 Mia richiesta #${request.id}
📝 ${request.title}
💰 ${request.current_amount}€ / ${request.target_amount}€
📊 ${request.progress_percent}%
${request.progress_bar}`;
    }).join('\n\n');

    await bot.sendMessage(chatId, text);
  } catch (error) {
    await bot.sendMessage(chatId, 'Errore nel recupero delle tue richieste.');
  }
});

// /mioid
bot.onText(/\/mioid/, async (msg) => {
  const chatId = msg.chat.id;
  const telegramUserId = msg.from.id;

  await bot.sendMessage(
    chatId,
    `Il tuo Telegram user ID è: ${telegramUserId}`
  );
});

// /crearichiesta automatico
bot.onText(/\/crearichiesta (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const telegramUserId = msg.from.id;

  try {
    const input = match[1];
    const parts = input.split('|').map((p) => p.trim());

    if (parts.length < 3) {
      await bot.sendMessage(
        chatId,
        'Formato sbagliato.\nUsa:\n/crearichiesta titolo | descrizione | importo'
      );
      return;
    }

    const title = parts[0];
    const description = parts[1];
    const target_amount = Number(parts[2]);

    if (!title || !description || !target_amount) {
      await bot.sendMessage(
        chatId,
        'Dati non validi. Controlla titolo, descrizione e importo.'
      );
      return;
    }

    const userResponse = await axios.get(
      `http://localhost:3001/api/users/by-telegram/${telegramUserId}`
    );

    const user = userResponse.data;

    const response = await axios.post('http://localhost:3001/api/requests', {
      user_id: user.id,
      title,
      description,
      target_amount
    });

    const created = response.data[0];

    await bot.sendMessage(
      chatId,
      `✅ Richiesta creata con successo

ID: ${created.id}
Titolo: ${created.title}
Target: ${created.target_amount}€`
    );
  } catch (error) {
    const backendMessage =
      error.response?.data?.error || 'Errore nella creazione della richiesta. Controlla il tuo profilo.';

    await bot.sendMessage(chatId, `❌ ${backendMessage}`);
  }
});

// /dona
bot.onText(/\/dona (\d+) (\d+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const telegramUserId = msg.from.id;

  try {
    const request_id = Number(match[1]);
    const amount = Number(match[2]);

    if (!request_id || !amount) {
      await bot.sendMessage(
        chatId,
        'Formato non valido.\nUsa: /dona request_id importo'
      );
      return;
    }

    const userResponse = await axios.get(
      `http://localhost:3001/api/users/by-telegram/${telegramUserId}`
    );

    const user = userResponse.data;

    const donationResponse = await axios.post(
      'http://localhost:3001/api/donations',
      {
        request_id,
        donor_user_id: user.id,
        amount
      }
    );

    const result = donationResponse.data;

    await bot.sendMessage(
      chatId,
      `💸 Donazione completata!

Hai donato: ${result.actual_donated_amount}€
Nuovo score: ${result.donor_new_score}
Livello: ${result.donor_new_level}`
    );
  } catch (error) {
    const backendMessage =
      error.response?.data?.error || 'Errore nella donazione. Controlla request_id o profilo.';

    await bot.sendMessage(chatId, `❌ ${backendMessage}`);
  }
});

// /pending_users
bot.onText(/\/pending_users/, async (msg) => {
  const chatId = msg.chat.id;

  if (!isAdmin(msg)) {
    await bot.sendMessage(chatId, '❌ Non autorizzato');
    return;
  }

  try {
    const res = await axios.get(`${BACKEND_URL}/api/users/pending`);
    const users = res.data;

    if (!users || users.length === 0) {
      await bot.sendMessage(chatId, 'Nessun utente pending.');
      return;
    }

    const text = users.map((u: any) => {
      return `🕒 Pending user
ID interno: ${u.id}
Telegram ID: ${u.telegram_user_id}
Nome: ${u.display_name}
Username: ${u.username || 'N/A'}
Stato: ${u.status}`;
    }).join('\n\n');

    await bot.sendMessage(chatId, text);
  } catch (error) {
    await bot.sendMessage(chatId, 'Errore nel recupero utenti pending.');
  }
});

// /approve_user
bot.onText(/\/approve_user (\d+)/, async (msg, match) => {
  const chatId = msg.chat.id;

  if (!isAdmin(msg)) {
    await bot.sendMessage(chatId, '❌ Non autorizzato');
    return;
  }

  try {
    const userId = Number(match[1]);

    const res = await axios.post(`${BACKEND_URL}/api/users/approve`, {
      user_id: userId
    });

    const user = res.data;

    await bot.sendMessage(
      chatId,
      `✅ Utente approvato

ID: ${user.id}
Nome: ${user.display_name}
Stato: ${user.status}`
    );
  } catch (error) {
    const backendMessage =
      error.response?.data?.error || 'Errore nell’approvazione utente';

    await bot.sendMessage(chatId, `❌ ${backendMessage}`);
  }
});

// /ban_user
bot.onText(/\/ban_user (\d+)/, async (msg, match) => {
  const chatId = msg.chat.id;

  if (!isAdmin(msg)) {
    await bot.sendMessage(chatId, '❌ Non autorizzato');
    return;
  }

  try {
    const userId = Number(match[1]);

    const res = await axios.post(`${BACKEND_URL}/api/users/ban`, {
      user_id: userId
    });

    const user = res.data;

    await bot.sendMessage(
      chatId,
      `🚫 Utente bannato

ID: ${user.id}
Nome: ${user.display_name}
Stato: ${user.status}`
    );
  } catch (error) {
    const backendMessage =
      error.response?.data?.error || 'Errore nel ban utente';

    await bot.sendMessage(chatId, `❌ ${backendMessage}`);
  }
});

// /pending_requests
bot.onText(/\/pending_requests/, async (msg) => {
  const chatId = msg.chat.id;

  if (!isAdmin(msg)) {
    await bot.sendMessage(chatId, '❌ Non autorizzato');
    return;
  }

  try {
    const res = await axios.get(`${BACKEND_URL}/api/requests/pending`);
    const requests = res.data;

    if (!requests || requests.length === 0) {
      await bot.sendMessage(chatId, 'Nessuna richiesta pending.');
      return;
    }

    const text = requests.map((r: any) => {
      return `🕒 Richiesta pending
ID: ${r.id}
Utente: ${r.users?.display_name || 'Utente'}
Titolo: ${r.title}
Descrizione: ${r.description || 'Nessuna descrizione'}
Target: ${r.target_amount}€
Stato: ${r.status}`;
    }).join('\n\n');

    await bot.sendMessage(chatId, text);
  } catch (error) {
    await bot.sendMessage(chatId, 'Errore nel recupero richieste pending.');
  }
});

// /approve_request
bot.onText(/\/approve_request (\d+)/, async (msg, match) => {
  const chatId = msg.chat.id;

  if (!isAdmin(msg)) {
    await bot.sendMessage(chatId, '❌ Non autorizzato');
    return;
  }

  try {
    const requestId = Number(match[1]);

    const res = await axios.post(`${BACKEND_URL}/api/requests/approve`, {
      request_id: requestId
    });

    const request = res.data;

    await bot.sendMessage(
      chatId,
      `✅ Richiesta approvata

ID: ${request.id}
Titolo: ${request.title}
Stato: ${request.status}`
    );
  } catch (error: any) {
    const backendMessage =
      error.response?.data?.error || 'Errore nell’approvazione richiesta';

    await bot.sendMessage(chatId, `❌ ${backendMessage}`);
  }
});

// /reject_request
bot.onText(/\/reject_request (\d+)/, async (msg, match) => {
  const chatId = msg.chat.id;

  if (!isAdmin(msg)) {
    await bot.sendMessage(chatId, '❌ Non autorizzato');
    return;
  }

  try {
    const requestId = Number(match[1]);

    const res = await axios.post(`${BACKEND_URL}/api/requests/reject`, {
      request_id: requestId
    });

    const request = res.data;

    await bot.sendMessage(
      chatId,
      `🚫 Richiesta rifiutata

ID: ${request.id}
Titolo: ${request.title}
Stato: ${request.status}`
    );
  } catch (error: any) {
    const backendMessage =
      error.response?.data?.error || 'Errore nel rifiuto richiesta';

    await bot.sendMessage(chatId, `❌ ${backendMessage}`);
  }
});

// /confirm_receipt
bot.onText(/\/confirm_receipt (\d+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const telegramUserId = msg.from.id;

  try {
    const donationId = Number(match[1]);

    const res = await axios.post(`${BACKEND_URL}/api/donations/confirm-receipt`, {
      donation_id: donationId,
      receiver_telegram_user_id: telegramUserId
    });

    const result = res.data;

    await bot.sendMessage(
      chatId,
      `✅ Ricezione confermata

Donation ID: ${result.donation_id}
Importo: ${result.confirmed_amount}€
Nuovo totale richiesta: ${result.updated_current_amount}€`
    );
  } catch (error) {
    const backendMessage =
      error.response?.data?.error || 'Errore nella conferma ricezione';

    await bot.sendMessage(chatId, `❌ ${backendMessage}`);
  }
});

console.log('🤖 Bot Telegram avviato');

module.exports = { bot };