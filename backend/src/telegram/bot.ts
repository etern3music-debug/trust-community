const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const token = process.env.TELEGRAM_BOT_TOKEN;

const bot = new TelegramBot(token, { polling: true });

// /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;

  bot.sendMessage(
    chatId,
    'Bot attivo ✅\nComandi disponibili:\n/start\n/profilo\n/richieste\n/mioid\n/crearichiesta'
  );
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

    // 1. trova utente dal telegram_user_id
    const userResponse = await axios.get(
      `http://localhost:3001/api/users/by-telegram/${telegramUserId}`
    );

    const user = userResponse.data;

    // 2. crea la request con user.id interno
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
    await bot.sendMessage(
      chatId,
      'Errore nella creazione della richiesta. Controlla che il tuo profilo sia registrato nel database.'
    );
  }
});

console.log('🤖 Bot Telegram avviato');

module.exports = { bot };