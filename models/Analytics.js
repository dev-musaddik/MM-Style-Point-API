const mongoose = require('mongoose');

/**
 * Session Schema
 * Tracks user sessions across public and landing pages
 */
const sessionSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  ipHash: {
    type: String,
    required: true
  },
  userAgent: String,
  device: {
    type: String, // mobile, tablet, desktop
    default: 'desktop'
  },
  browser: String,
  os: String,
  startTime: {
    type: Date,
    default: Date.now
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  isBot: {
    type: Boolean,
    default: false
  },
  module: {
    type: String,
    enum: ['public', 'landing'],
    default: 'public'
  }
});

/**
 * Event Schema (Public Website)
 * Generic events like page views, clicks, cart actions
 */
const eventSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    index: true
  },
  eventType: {
    type: String,
    required: true,
    enum: ['VIEW', 'CLICK', 'SCROLL', 'ADD_TO_CART', 'CHECKOUT_INIT', 'PURCHASE', 'SEARCH']
  },
  url: String,
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

/**
 * Landing Page Event Schema
 * Specific tracking for hidden landing pages
 */
const landingPageEventSchema = new mongoose.Schema({
  landingPageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LandingPage',
    required: true,
    index: true
  },
  sessionId: {
    type: String,
    required: true,
    index: true
  },
  eventType: {
    type: String,
    required: true,
    enum: ['VISIT', 'SCROLL', 'CTA_CLICK', 'FORM_START', 'LEAD', 'CONVERSION']
  },
  campaign: String,
  source: String, // UTM source
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

/**
 * Traffic Flag Schema
 * Stores suspicious IP/Session data for fraud analysis
 */
const trafficFlagSchema = new mongoose.Schema({
  ipHash: {
    type: String,
    required: true,
    index: true
  },
  sessionId: String,
  reason: {
    type: String,
    required: true
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'low'
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const Session = mongoose.model('Session', sessionSchema);
const Event = mongoose.model('Event', eventSchema);
const LandingPageEvent = mongoose.model('LandingPageEvent', landingPageEventSchema);
const TrafficFlag = mongoose.model('TrafficFlag', trafficFlagSchema);

module.exports = {
  Session,
  Event,
  LandingPageEvent,
  TrafficFlag
};
