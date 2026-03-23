const express = require('express');

const { testSupabase } = require('./test');
const {
  createUser,
  getUserByTelegramId,
  ensureUser,
  updatePaymentLink,
  getPendingUsers,
  approveUser,
  banUser
} = require('./users');
const {
  createRequest,
  getRequests,
  getPendingRequests,
  approveRequest,
  rejectRequest,
  deleteRequest
} = require('./requests');
const { createDonation, confirmDonationReceipt, getDonations } = require('./donations');
const {
  getProfile,
  getProfileByTelegramId,
  getMyRequestsByTelegramId,
  getMeByTelegramId,
  getMyDonationsByTelegramId
} = require('./profile');

const router = express.Router();

router.get('/test', testSupabase);

router.post('/users', createUser);
router.get('/users/by-telegram/:telegramId', getUserByTelegramId);
router.post('/users/ensure', ensureUser);
router.post('/users/payment-link', updatePaymentLink);
router.get('/users/pending', getPendingUsers);
router.post('/users/approve', approveUser);
router.post('/users/ban', banUser);

router.post('/requests', createRequest);
router.get('/requests', getRequests);
router.get('/requests/pending', getPendingRequests);
router.post('/requests/approve', approveRequest);
router.post('/requests/reject', rejectRequest);
router.post('/requests/delete', deleteRequest);

router.post('/donations', createDonation);
router.post('/donations/confirm-receipt', confirmDonationReceipt);
router.get('/donations', getDonations);

router.get('/profile/:id', getProfile);
router.get('/profile-by-telegram/:telegramId', getProfileByTelegramId);
router.get('/my-requests-by-telegram/:telegramId', getMyRequestsByTelegramId);
router.get('/me/:telegramId', getMeByTelegramId);
router.get('/my-donations/:telegramId', getMyDonationsByTelegramId);

module.exports = { router };