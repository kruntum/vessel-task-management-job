const express = require('express');
const router = express.Router();
const prisma = require('../config/db');

// Helper to get active records ordered by name/title
router.get('/agents', async (req, res, next) => {
  try {
    const agents = await prisma.agent.findMany({ where: { isActive: true }, orderBy: { agentName: 'asc' } });
    res.json(agents);
  } catch (error) { next(error); }
});

router.get('/vessels', async (req, res, next) => {
  try {
    const vessels = await prisma.vessel.findMany({ where: { isActive: true }, orderBy: { vesselName: 'asc' } });
    res.json(vessels);
  } catch (error) { next(error); }
});

router.get('/places', async (req, res, next) => {
  try {
    const places = await prisma.returnPlace.findMany({ where: { isActive: true }, orderBy: { placeName: 'asc' } });
    res.json(places);
  } catch (error) { next(error); }
});

router.get('/pods', async (req, res, next) => {
  try {
    const pods = await prisma.pod.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
    res.json(pods);
  } catch (error) { next(error); }
});

router.get('/pols', async (req, res, next) => {
  try {
    const pols = await prisma.pol.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
    res.json(pols);
  } catch (error) { next(error); }
});

module.exports = router;
