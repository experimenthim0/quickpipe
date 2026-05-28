import express from 'express';
import mongoose from 'mongoose';
import Link from '../models/Link.js';
import User from '../models/User.js';

const router = express.Router();

const MAX_CONTENT_LENGTH = 5000;
const MAX_HISTORY_RESULTS = 200; // Cap history results to prevent memory/bandwidth abuse

/**
 * Helper function to register or update an active device for the user.
 */
async function registerDevice(user, req) {
  const deviceId = req.body.deviceId || req.query.deviceId || req.headers['x-device-id'];
  const deviceName = req.body.deviceName || req.query.deviceName || req.headers['x-device-name'];
  const deviceType = req.body.deviceType || req.query.deviceType || req.headers['x-device-type'] || req.body.sourceDevice || req.query.sourceDevice;

  if (!deviceId) return;

  const existingDeviceIndex = user.devices.findIndex(d => d.deviceId === deviceId);
  const now = new Date();

  if (existingDeviceIndex > -1) {
    user.devices[existingDeviceIndex].lastActiveAt = now;
    if (deviceName) user.devices[existingDeviceIndex].deviceName = decodeURIComponent(deviceName);
    if (deviceType) user.devices[existingDeviceIndex].deviceType = deviceType;
  } else {
    user.devices.push({
      deviceId,
      deviceName: deviceName ? decodeURIComponent(deviceName) : (deviceType === 'desktop' ? 'Desktop' : 'Mobile'),
      deviceType: deviceType === 'desktop' ? 'desktop' : 'mobile',
      lastActiveAt: now
    });
  }

  // Remove stale devices inactive for > 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  user.devices = user.devices.filter(d => d.lastActiveAt >= thirtyDaysAgo);
  await user.save();
}

/**
 * @route   POST /api/links/push
 * @desc    Push a new link or text snippet into the sync pipeline
 * @access  Public
 */
router.post('/push', async (req, res) => {
  try {
    const { syncKey, content, sourceDevice } = req.body;

    // Basic request validation
    if (!syncKey || !content || !sourceDevice) {
      return res.status(400).json({ 
        error: 'Missing parameters. syncKey, content, and sourceDevice are required.' 
      });
    }

    if (!['desktop', 'mobile'].includes(sourceDevice)) {
      return res.status(400).json({ 
        error: 'Invalid sourceDevice. Allowed values: desktop, mobile' 
      });
    }

    // Validate content length
    const trimmedContent = content.trim();
    if (trimmedContent.length === 0) {
      return res.status(400).json({ error: 'Content cannot be empty.' });
    }

    if (trimmedContent.length > MAX_CONTENT_LENGTH) {
      return res.status(400).json({ 
        error: `Content exceeds maximum length of ${MAX_CONTENT_LENGTH} characters.` 
      });
    }

    // Verify syncKey belongs to a registered user
    const user = await User.findOne({ syncKey });
    if (!user) {
      return res.status(404).json({ error: 'Invalid or unregistered syncKey' });
    }

    // Update active devices
    await registerDevice(user, req);

    // Create and save the new link record
    const newLink = new Link({
      syncKey,
      content: trimmedContent,
      sourceDevice
    });

    await newLink.save();

    return res.status(201).json({
      message: 'Link synced successfully',
      link: {
        id: newLink._id,
        content: newLink.content,
        sourceDevice: newLink.sourceDevice,
        createdAt: newLink.createdAt
      }
    });
  } catch (error) {
    console.error('[QuickPipe] Error in link-push:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   GET /api/links/history
 * @desc    Fetch reverse-chronological link history with optional text search
 * @access  Public
 */
router.get('/history', async (req, res) => {
  try {
    const { syncKey, search } = req.query;

    if (!syncKey) {
      return res.status(400).json({ error: 'syncKey query parameter is required' });
    }

    // Verify syncKey validity
    const user = await User.findOne({ syncKey });
    if (!user) {
      return res.status(404).json({ error: 'Invalid or unregistered syncKey' });
    }

    // Update active devices
    await registerDevice(user, req);

    // Build DB query
    const filter = { syncKey };
    let links = [];

    if (search && search.trim() !== '') {
      const searchTerm = search.trim();
      
      // First try text index search
      try {
        const textFilter = { ...filter, $text: { $search: searchTerm } };
        links = await Link.find(textFilter)
          .sort({ createdAt: -1 })
          .limit(MAX_HISTORY_RESULTS)
          .lean();
      } catch (textErr) {
        // Text index may not exist yet or query failed — fall through to regex
        console.warn('[QuickPipe] Text search fallback triggered:', textErr.message);
      }

      // Fallback: regex substring match if text search returned no results
      if (links.length === 0) {
        // Escape regex special characters in the search term for safety
        const escapedSearch = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regexFilter = {
          syncKey,
          content: { $regex: escapedSearch, $options: 'i' }
        };
        links = await Link.find(regexFilter)
          .sort({ createdAt: -1 })
          .limit(MAX_HISTORY_RESULTS)
          .lean();
      }
    } else {
      // No search filter — return all recent items
      links = await Link.find(filter)
        .sort({ createdAt: -1 })
        .limit(MAX_HISTORY_RESULTS)
        .lean();
    }

    return res.status(200).json({
      count: links.length,
      links: links.map(link => ({
        id: link._id,
        content: link.content,
        sourceDevice: link.sourceDevice,
        createdAt: link.createdAt
      })),
      devicesCount: user.devices.length,
      devices: user.devices.map(d => ({
        deviceId: d.deviceId,
        deviceName: d.deviceName,
        deviceType: d.deviceType,
        lastActiveAt: d.lastActiveAt
      }))
    });
  } catch (error) {
    console.error('[QuickPipe] Error in link-history:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   DELETE /api/links/:id
 * @desc    Delete a specific link or text snippet by ID
 * @access  Public
 */
router.delete('/:id', async (req, res) => {
  try {
    const { syncKey } = req.query;
    const { id } = req.params;

    if (!syncKey) {
      return res.status(400).json({ error: 'syncKey query parameter is required' });
    }

    // Validate that id is a valid MongoDB ObjectId before querying
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid link ID format' });
    }

    const link = await Link.findOne({ _id: id, syncKey });
    if (!link) {
      return res.status(404).json({ error: 'Link not found or authorization failed' });
    }

    await Link.deleteOne({ _id: id });
    return res.status(200).json({ message: 'Link deleted successfully' });
  } catch (error) {
    console.error('[QuickPipe] Error in link delete:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   DELETE /api/links/devices/:deviceId
 * @desc    Unlink/remove a specific device by its deviceId
 * @access  Public
 */
router.delete('/devices/:deviceId', async (req, res) => {
  try {
    const { syncKey } = req.query;
    const { deviceId } = req.params;

    if (!syncKey) {
      return res.status(400).json({ error: 'syncKey query parameter is required' });
    }

    const user = await User.findOne({ syncKey });
    if (!user) {
      return res.status(404).json({ error: 'User not found or authorization failed' });
    }

    const initialLength = user.devices.length;
    user.devices = user.devices.filter(d => d.deviceId !== deviceId);

    if (user.devices.length === initialLength) {
      return res.status(404).json({ error: 'Device not found' });
    }

    await user.save();
    return res.status(200).json({ message: 'Device unlinked successfully' });
  } catch (error) {
    console.error('[QuickPipe] Error in device delete:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
