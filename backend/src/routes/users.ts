const { supabase } = require('../config/supabase');
const { sendTelegramDirectMessage } = require('../telegram/sendMessage');

async function createUser(req, res) {
  const { telegram_user_id, username, display_name, status } = req.body;

  const { data, error } = await supabase
    .from('users')
    .insert([
      {
        telegram_user_id,
        username,
        display_name,
        status: status || 'pending',
        score: 50,
        level: 1
      }
    ])
    .select();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.json(data);
}

async function getUserByTelegramId(req, res) {
  const telegramUserId = req.params.telegramId;

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('telegram_user_id', telegramUserId)
    .single();

  if (error || !data) {
    return res.status(404).json({ error: 'Utente non trovato' });
  }

  return res.json(data);
}

async function ensureUser(req, res) {
  const { telegram_user_id, username, display_name } = req.body;

  if (!telegram_user_id) {
    return res.status(400).json({ error: 'telegram_user_id obbligatorio' });
  }

  const { data: existingUser } = await supabase
    .from('users')
    .select('*')
    .eq('telegram_user_id', telegram_user_id)
    .single();

  if (existingUser) {
    return res.json(existingUser);
  }

  const { data: newUsers, error: insertError } = await supabase
    .from('users')
    .insert([
      {
        telegram_user_id,
        username: username || null,
        display_name: display_name || 'Nuovo utente',
        status: 'pending',
        score: 50,
        level: 1
      }
    ])
    .select();

  if (insertError) {
    return res.status(500).json({ error: insertError.message });
  }

  return res.json(newUsers[0]);
}

async function updatePaymentLink(req, res) {
  const { telegram_user_id, payment_link } = req.body;

  if (!telegram_user_id) {
    return res.status(400).json({ error: 'telegram_user_id obbligatorio' });
  }

  const { data: user, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('telegram_user_id', telegram_user_id)
    .single();

  if (userError || !user) {
    return res.status(404).json({ error: 'Utente non trovato' });
  }

  const { data, error } = await supabase
    .from('users')
    .update({
      payment_link: payment_link || null
    })
    .eq('telegram_user_id', telegram_user_id)
    .select()
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.json(data);
}

async function getPendingUsers(req, res) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('status', 'pending')
    .order('id', { ascending: true });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.json(data);
}

async function approveUser(req, res) {
  const { user_id } = req.body;

  if (!user_id) {
    return res.status(400).json({ error: 'user_id obbligatorio' });
  }

  const { data, error } = await supabase
    .from('users')
    .update({ status: 'verified' })
    .eq('id', user_id)
    .select()
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  try {
    await sendTelegramDirectMessage(
      data.telegram_user_id,
      `✅ Il tuo account è stato approvato.\n\nOra puoi creare richieste nella piattaforma.`
    );
  } catch (telegramError) {
    console.error(
      'Errore notifica approvazione utente:',
      telegramError.response?.data || telegramError.message
    );
  }

  return res.json(data);
}

async function banUser(req, res) {
  const { user_id } = req.body;

  if (!user_id) {
    return res.status(400).json({ error: 'user_id obbligatorio' });
  }

  const { data, error } = await supabase
    .from('users')
    .update({ status: 'banned' })
    .eq('id', user_id)
    .select()
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  try {
    await sendTelegramDirectMessage(
      data.telegram_user_id,
      `🚫 Il tuo account è stato sospeso o bannato.\n\nSe pensi sia un errore, contatta l’amministrazione.`
    );
  } catch (telegramError) {
    console.error(
      'Errore notifica ban utente:',
      telegramError.response?.data || telegramError.message
    );
  }

  return res.json(data);
}

module.exports = {
  createUser,
  getUserByTelegramId,
  ensureUser,
  updatePaymentLink,
  getPendingUsers,
  approveUser,
  banUser
};