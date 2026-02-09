const express = require('express');
const router = express.Router();
const {
  trackPublicEvent,
  trackLandingEvent,
  getPublicDashboard,
  getLandingDashboard,
  getTrafficFlags
} = require('../controllers/analyticsController');
const { protect, admin } = require('../middleware/authMiddleware');

// Public tracking endpoints
router.post('/track', trackPublicEvent);
router.post('/landing/track', trackLandingEvent);

// Admin analytics endpoints
router.get('/public/dashboard', protect, admin, getPublicDashboard);
router.get('/landing/:id', protect, admin, getLandingDashboard);
router.get('/flags', protect, admin, getTrafficFlags);

module.exports = router;
