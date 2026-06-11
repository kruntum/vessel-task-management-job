const express = require('express');
const router = express.Router();
const prisma = require('../config/db');

// GET /api/auth/users - List all active users to support front-end role switching
router.get('/users', async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      where: { isActive: true },
      orderBy: { id: 'asc' },
    });
    res.json(users);
  } catch (error) {
    next(error);
  }
});

// GET /api/auth/me/:username - Return a specific user info by username
router.get('/me/:username', async (req, res, next) => {
  try {
    const { username } = req.params;
    const user = await prisma.user.findUnique({
      where: { username },
    });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
