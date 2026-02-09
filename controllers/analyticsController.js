const { Session, Event, LandingPageEvent, TrafficFlag } = require('../models/Analytics');
const LandingPage = require('../models/LandingPage');
const requestIp = require('request-ip');
const UAParser = require('ua-parser-js');
const crypto = require('crypto');

// Helper to hash IP for privacy
const hashIp = (ip) => {
  return crypto.createHash('sha256').update(ip).digest('hex');
};

// Helper to get or create session
const getOrCreateSession = async (req, sessionId, moduleType = 'public') => {
  let session = await Session.findOne({ sessionId });
  
  if (!session) {
    const clientIp = requestIp.getClientIp(req);
    const ipHash = hashIp(clientIp);
    const ua = UAParser(req.headers['user-agent']);
    
    session = await Session.create({
      sessionId,
      userId: req.user ? req.user._id : undefined,
      ipHash,
      userAgent: req.headers['user-agent'],
      device: ua.device.type || 'desktop',
      browser: ua.browser.name,
      os: ua.os.name,
      module: moduleType
    });

    // Check for suspicious activity (simple check: multiple sessions from same IP in short time)
    const recentSessions = await Session.countDocuments({
      ipHash,
      startTime: { $gt: new Date(Date.now() - 60 * 60 * 1000) } // Last hour
    });

    if (recentSessions > 20) {
      await TrafficFlag.create({
        ipHash,
        sessionId,
        reason: 'High session frequency (potential bot)',
        severity: 'medium'
      });
      session.isBot = true;
      await session.save();
    }
  } else {
    session.lastActivity = Date.now();
    await session.save();
  }
  
  return session;
};

/**
 * @desc    Track Public Website Event
 * @route   POST /api/analytics/track
 * @access  Public
 */
const trackPublicEvent = async (req, res, next) => {
  try {
    const { sessionId, eventType, url, metadata } = req.body;
    
    if (!sessionId || !eventType) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    await getOrCreateSession(req, sessionId, 'public');

    await Event.create({
      sessionId,
      eventType,
      url,
      metadata
    });

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Analytics Error:', error);
    // Don't block the client if analytics fail
    res.status(200).json({ success: false }); 
  }
};

/**
 * @desc    Track Landing Page Event
 * @route   POST /api/analytics/landing/track
 * @access  Public
 */
const trackLandingEvent = async (req, res, next) => {
  try {
    const { sessionId, landingPageId, eventType, campaign, source, metadata } = req.body;
    
    if (!sessionId || !landingPageId || !eventType) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    await getOrCreateSession(req, sessionId, 'landing');

    await LandingPageEvent.create({
      sessionId,
      landingPageId,
      eventType,
      campaign,
      source,
      metadata
    });

    // Update aggregate stats on LandingPage model for quick access
    if (eventType === 'VISIT') {
      await LandingPage.findByIdAndUpdate(landingPageId, { $inc: { views: 1 } });
    } else if (eventType === 'CONVERSION' || eventType === 'LEAD') {
      await LandingPage.findByIdAndUpdate(landingPageId, { $inc: { conversions: 1 } });
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Landing Analytics Error:', error);
    res.status(200).json({ success: false });
  }
};

/**
 * @desc    Get Public Analytics Dashboard Data
 * @route   GET /api/analytics/public/dashboard
 * @access  Private/Admin
 */
const getPublicDashboard = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    console.log('Public Dashboard Query:', { startDate, endDate });
    
    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter = { $gte: new Date(startDate), $lte: new Date(endDate) };
    } else {
      // Default to last 30 days
      dateFilter = { $gt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) };
    }
    console.log('Date Filter:', dateFilter);
    
    // Find active session IDs from events in this period
    const activeSessionIds = await Event.distinct('sessionId', { 
      timestamp: dateFilter 
    });
    
    const totalSessions = activeSessionIds.length;
    
    // Find unique visitors (IPs) for these active sessions
    const uniqueVisitors = await Session.distinct('ipHash', { 
      sessionId: { $in: activeSessionIds } 
    });

    // Funnel Data
    const views = await Event.countDocuments({ eventType: 'VIEW', timestamp: dateFilter });
    const addToCarts = await Event.countDocuments({ eventType: 'ADD_TO_CART', timestamp: dateFilter });
    const checkouts = await Event.countDocuments({ eventType: 'CHECKOUT_INIT', timestamp: dateFilter });
    const purchases = await Event.countDocuments({ eventType: 'PURCHASE', timestamp: dateFilter });

    res.json({
      success: true,
      stats: {
        totalSessions,
        uniqueVisitors: uniqueVisitors.length,
      },
      funnel: {
        views,
        addToCarts,
        checkouts,
        purchases
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get Landing Page Analytics
 * @route   GET /api/analytics/landing/:id
 * @access  Private/Admin
 */
const getLandingDashboard = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;
    
    const landingPage = await LandingPage.findById(id);
    if (!landingPage) {
      res.status(404);
      throw new Error('Landing Page not found');
    }

    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter = { timestamp: { $gte: new Date(startDate), $lte: new Date(endDate) } };
    }

    const events = await LandingPageEvent.find({ landingPageId: id, ...dateFilter }).sort({ timestamp: -1 });
    
    // Aggregations
    const visits = events.filter(e => e.eventType === 'VISIT').length;
    const clicks = events.filter(e => e.eventType === 'CTA_CLICK').length;
    const leads = events.filter(e => e.eventType === 'LEAD' || e.eventType === 'CONVERSION').length;
    
    // Source breakdown
    const sources = {};
    events.forEach(e => {
      if (e.source) {
        sources[e.source] = (sources[e.source] || 0) + 1;
      }
    });

    res.json({
      success: true,
      landingPage: {
        title: landingPage.title,
        slug: landingPage.slug
      },
      stats: {
        visits,
        clicks,
        leads,
        conversionRate: visits > 0 ? ((leads / visits) * 100).toFixed(2) : 0
      },
      sources
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get Traffic Flags (Suspicious Activity)
 * @route   GET /api/analytics/flags
 * @access  Private/Admin
 */
const getTrafficFlags = async (req, res, next) => {
  try {
    const flags = await TrafficFlag.find({}).sort({ timestamp: -1 }).limit(50);
    res.json({
      success: true,
      count: flags.length,
      data: flags
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  trackPublicEvent,
  trackLandingEvent,
  getPublicDashboard,
  getLandingDashboard,
  getTrafficFlags
};
