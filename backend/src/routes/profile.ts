const { supabase } = require('../config/supabase');

function buildProgressBar(current, target) {
  const safeTarget = target > 0 ? target : 1;
  const percent = Math.min(100, Math.round((current / safeTarget) * 100));
  const filledBlocks = Math.round(percent / 10);
  const emptyBlocks = 10 - filledBlocks;
  const bar = '█'.repeat(filledBlocks) + '░'.repeat(emptyBlocks);

  return {
    percent,
    bar,
  };
}

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

async function getMyRequestsByTelegramId(req, res) {
  const telegramUserId = req.params.telegramId;

  const { data: user, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('telegram_user_id', telegramUserId)
    .single();

  if (userError || !user) {
    return res.status(404).json({ error: 'Utente non trovato' });
  }

  const { data: requests, error: requestsError } = await supabase
    .from('requests')
    .select('*')
    .eq('user_id', user.id)
    .order('id', { ascending: false });

  if (requestsError) {
    return res.status(500).json({ error: requestsError.message });
  }

  const enriched = requests.map((request) => {
    const progress = buildProgressBar(
      request.current_amount || 0,
      request.target_amount || 0
    );

    return {
      ...request,
      progress_percent: progress.percent,
      progress_bar: progress.bar,
    };
  });

  return res.json(enriched);
}

async function getMeByTelegramId(req, res) {
  const telegramUserId = req.params.telegramId;

  const { data: user, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('telegram_user_id', telegramUserId)
    .single();

  if (userError || !user) {
    return res.status(404).json({ error: 'Utente non trovato' });
  }

  const { data: badges, error: badgesError } = await supabase
    .from('badges')
    .select('*')
    .eq('user_id', user.id);

  if (badgesError) {
    return res.status(500).json({ error: badgesError.message });
  }

  const { data: donations, error: donationsError } = await supabase
    .from('donations')
    .select('*')
    .eq('donor_user_id', user.id);

  if (donationsError) {
    return res.status(500).json({ error: donationsError.message });
  }

  const { data: requests, error: requestsError } = await supabase
    .from('requests')
    .select('*')
    .eq('user_id', user.id);

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
    badges
  });
}

async function getMyDonationsByTelegramId(req, res) {
  const telegramUserId = req.params.telegramId;

  const { data: user, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('telegram_user_id', telegramUserId)
    .single();

  if (userError || !user) {
    return res.status(404).json({ error: 'Utente non trovato' });
  }

  const { data: donations, error: donationsError } = await supabase
    .from('donations')
    .select(`
      id,
      amount,
      status,
      created_at,
      request_id,
      requests (
        id,
        title,
        description
      )
    `)
    .eq('donor_user_id', user.id)
    .order('id', { ascending: false });

  if (donationsError) {
    return res.status(500).json({ error: donationsError.message });
  }

  const formatted = donations.map((donation) => ({
    id: donation.id,
    amount: donation.amount,
    status: donation.status,
    created_at: donation.created_at,
    request_id: donation.request_id,
    request_title: donation.requests?.title || 'Richiesta',
    request_description: donation.requests?.description || null
  }));

  return res.json(formatted);
}

module.exports = {
  getProfile,
  getProfileByTelegramId,
  getMyRequestsByTelegramId,
  getMeByTelegramId,
  getMyDonationsByTelegramId
};