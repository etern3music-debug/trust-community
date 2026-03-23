const express = require('express');

const { testSupabase } = require('./test');
const { createUser, getUserByTelegramId, ensureUser, updatePaymentLink } = require('./users');
const { createRequest, getRequests } = require('./requests');
const { createDonation, getDonations } = require('./donations');
const {
  getProfile,
  getProfileByTelegramId,
  getMyRequestsByTelegramId,
  getMeByTelegramId
} = require('./profile');

const router = express.Router();

router.get('/test', testSupabase);

router.post('/users', createUser);
router.get('/users/by-telegram/:telegramId', getUserByTelegramId);
router.post('/users/ensure', ensureUser);
router.post('/users/payment-link', updatePaymentLink);

router.post('/requests', createRequest);
router.get('/requests', getRequests);

router.post('/donations', createDonation);
router.get('/donations', getDonations);

router.get('/profile/:id', getProfile);
router.get('/profile-by-telegram/:telegramId', getProfileByTelegramId);
router.get('/my-requests-by-telegram/:telegramId', getMyRequestsByTelegramId);
router.get('/me/:telegramId', getMeByTelegramId);

module.exports = { router };