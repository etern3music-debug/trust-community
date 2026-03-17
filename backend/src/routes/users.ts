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
        status: status || 'pending'
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

module.exports = { createUser, getUserByTelegramId };