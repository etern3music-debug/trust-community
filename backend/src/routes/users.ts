const { supabase } = require('../config/supabase');

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

module.exports = { createUser, getUserByTelegramId, ensureUser, updatePaymentLink };