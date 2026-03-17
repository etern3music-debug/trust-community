const { supabase } = require('../config/supabase');

async function buildProfileByInternalUserId(userId, res) {
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (userError) {
    return res.status(500).json({ error: userError.message });
  }

  const { data: badges, error: badgesError } = await supabase
    .from('badges')
    .select('*')
    .eq('user_id', userId);

  if (badgesError) {
    return res.status(500).json({ error: badgesError.message });
  }

  const { data: donations, error: donationsError } = await supabase
    .from('donations')
    .select('*')
    .eq('donor_user_id', userId);

  if (donationsError) {
    return res.status(500).json({ error: donationsError.message });
  }

  const { data: requests, error: requestsError } = await supabase
    .from('requests')
    .select('*')
    .eq('user_id', userId);

  if (requestsError) {
    return res.status(500).json({ error: requestsError.message });
  }

  const totalDonated = donations.reduce((sum, donation) => {
    return sum + (donation.amount || 0);
  }, 0);

  return res.json({
    user,
    stats: {
      total_badges: badges.length,
      total_donations: donations.length,
      total_donated_amount: totalDonated,
      total_requests: requests.length
    },
    badges,
    donations,
    requests
  });
}

async function getProfile(req, res) {
  const userId = req.params.id;
  return buildProfileByInternalUserId(userId, res);
}

async function getProfileByTelegramId(req, res) {
  const telegramUserId = req.params.telegramId;

  const { data: user, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('telegram_user_id', telegramUserId)
    .single();

  if (userError || !user) {
    return res.status(404).json({ error: 'Utente non trovato' });
  }

  return buildProfileByInternalUserId(user.id, res);
}

module.exports = { getProfile, getProfileByTelegramId };