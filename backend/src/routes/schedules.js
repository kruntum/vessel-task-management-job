const express = require('express');
const router = express.Router();
const prisma = require('../config/db');

// GET /api/schedules - Fetch all master schedules with nested logistics data
router.get('/', async (req, res, next) => {
  try {
    const schedules = await prisma.masterSchedule.findMany({
      include: {
        agent: true,
        vessel: true,
        returnPlace: true,
        pod: true,
        pol: true,
        jobCards: {
          include: {
            user: true,
          },
        },
      },
      orderBy: { originalEtd: 'asc' },
    });
    res.json(schedules);
  } catch (error) {
    next(error);
  }
});

// GET /api/schedules/logs/all - Fetch all schedule update logs across the entire system
router.get('/logs/all', async (req, res, next) => {
  try {
    const logs = await prisma.scheduleUpdateLog.findMany({
      include: {
        user: true,
        schedule: {
          include: {
            vessel: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });
    res.json(logs);
  } catch (error) {
    next(error);
  }
});

// GET /api/schedules/:id - Fetch single master schedule
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const schedule = await prisma.masterSchedule.findUnique({
      where: { id: parseInt(id) },
      include: {
        agent: true,
        vessel: true,
        returnPlace: true,
        pod: true,
        pol: true,
        jobCards: {
          include: {
            user: true,
          },
        },
      },
    });
    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    res.json(schedule);
  } catch (error) {
    next(error);
  }
});

// POST /api/schedules - Create a new master schedule
router.post('/', async (req, res, next) => {
  try {
    const {
      agentId,
      vesselId,
      placeId,
      podId,
      polId,
      voyage,
      service,
      weekNo,
      originalEtd,
      actualDpr,
      closingDate,
      closingTime,
      openGate,
      freeTimeStart,
      note,
    } = req.body;

    const schedule = await prisma.masterSchedule.create({
      data: {
        agentId: parseInt(agentId),
        vesselId: parseInt(vesselId),
        placeId: parseInt(placeId),
        podId: parseInt(podId),
        polId: parseInt(polId),
        voyage,
        service,
        weekNo: parseInt(weekNo),
        originalEtd: new Date(originalEtd),
        actualDpr: actualDpr ? new Date(actualDpr) : null,
        closingDate: new Date(closingDate),
        closingTime,
        openGate: openGate ? new Date(openGate) : null,
        freeTimeStart: freeTimeStart ? new Date(freeTimeStart) : null,
        note,
      },
    });
    res.status(201).json(schedule);
  } catch (error) {
    next(error);
  }
});

// PUT /api/schedules/:id - Update a master schedule and log changes to actualDpr
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      agentId,
      vesselId,
      placeId,
      podId,
      polId,
      voyage,
      service,
      weekNo,
      originalEtd,
      actualDpr,
      delayDays,
      closingDate,
      closingTime,
      openGate,
      freeTimeStart,
      note,
      userId, // Required if actualDpr is modified to log who updated it
      reason, // Required if actualDpr is modified
    } = req.body;

    const scheduleId = parseInt(id);

    // Get current schedule status to detect date changes
    const current = await prisma.masterSchedule.findUnique({
      where: { id: scheduleId },
    });

    if (!current) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    const updatedData = {
      agentId: agentId ? parseInt(agentId) : current.agentId,
      vesselId: vesselId ? parseInt(vesselId) : current.vesselId,
      placeId: placeId ? parseInt(placeId) : current.placeId,
      podId: podId ? parseInt(podId) : current.podId,
      polId: polId ? parseInt(polId) : current.polId,
      voyage: voyage !== undefined ? voyage : current.voyage,
      service: service !== undefined ? service : current.service,
      weekNo: weekNo !== undefined ? parseInt(weekNo) : current.weekNo,
      originalEtd: originalEtd ? new Date(originalEtd) : current.originalEtd,
      actualDpr: actualDpr !== undefined ? (actualDpr ? new Date(actualDpr) : null) : current.actualDpr,
      delayDays: delayDays !== undefined ? parseInt(delayDays) : current.delayDays,
      closingDate: closingDate ? new Date(closingDate) : current.closingDate,
      closingTime: closingTime !== undefined ? closingTime : current.closingTime,
      openGate: openGate !== undefined ? (openGate ? new Date(openGate) : null) : current.openGate,
      freeTimeStart: freeTimeStart !== undefined ? (freeTimeStart ? new Date(freeTimeStart) : null) : current.freeTimeStart,
      note: note !== undefined ? note : current.note,
    };

    // Detect actualDpr changes
    const currentDprTime = current.actualDpr ? new Date(current.actualDpr).getTime() : null;
    const newDprTime = updatedData.actualDpr ? new Date(updatedData.actualDpr).getTime() : null;

    const isDprChanged = currentDprTime !== newDprTime;

    // Use Prisma transaction to ensure updates and logs succeed together
    const result = await prisma.$transaction(async (tx) => {
      const schedule = await tx.masterSchedule.update({
        where: { id: scheduleId },
        data: updatedData,
      });

      if (isDprChanged) {
        if (!userId) {
          throw new Error('userId is required to log date changes.');
        }
        await tx.scheduleUpdateLog.create({
          data: {
            scheduleId,
            userId: parseInt(userId),
            oldActualDpr: current.actualDpr,
            newActualDpr: updatedData.actualDpr,
            reason: reason || 'Date updated by staff',
          },
        });
      }

      return schedule;
    });

    res.json(result);
  } catch (error) {
    if (error.message.includes('userId is required')) {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
});

// DELETE /api/schedules/:id - Delete a master schedule
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    await prisma.masterSchedule.delete({
      where: { id: parseInt(id) },
    });
    res.json({ message: 'Schedule deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// GET /api/schedules/:id/logs - Fetch all update logs for a master schedule
router.get('/:id/logs', async (req, res, next) => {
  try {
    const { id } = req.params;
    const logs = await prisma.scheduleUpdateLog.findMany({
      where: { scheduleId: parseInt(id) },
      include: {
        user: true,
      },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(logs);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
