const express = require('express');

const { testSupabase } = require('./test');
const { createUser, getUserByTelegramId, ensureUser } = require('./users');
const { createRequest, getRequests } = require('./requests');
const { createDonation, getDonations } = require('./donations');
const {
  getProfile,
  getProfileByTelegramId,
  getMyRequestsByTelegramId
} = require('./profile');

const router = express.Router();

router.get('/test', testSupabase);

router.post('/users', createUser);
router.get('/users/by-telegram/:telegramId', getUserByTelegramId);
router.post('/users/ensure', ensureUser);

router.post('/requests', createRequest);
router.get('/requests', getRequests);

router.post('/donations', createDonation);
router.get('/donations', getDonations);

router.get('/profile/:id', getProfile);
router.get('/profile-by-telegram/:telegramId', getProfileByTelegramId);
router.get('/my-requests-by-telegram/:telegramId', getMyRequestsByTelegramId);

module.exports = { router };