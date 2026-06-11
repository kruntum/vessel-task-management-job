const express = require('express');
const router = express.Router();
const prisma = require('../config/db');

// GET /api/jobs - List all job cards. Supports filtering by userId (for specific staff's Kanban) and status
router.get('/', async (req, res, next) => {
  try {
    const { userId, status } = req.query;
    
    const filter = {};
    if (userId) filter.userId = parseInt(userId);
    if (status) filter.status = status;

    const jobs = await prisma.jobCard.findMany({
      where: filter,
      include: {
        schedule: {
          include: {
            agent: true,
            vessel: true,
            returnPlace: true,
            pod: true,
            pol: true,
          },
        },
        user: true,
        details: {
          include: {
            agent: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(jobs);
  } catch (error) {
    next(error);
  }
});

// GET /api/jobs/:id - Get a specific job card detail
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const job = await prisma.jobCard.findUnique({
      where: { id: parseInt(id) },
      include: {
        schedule: {
          include: {
            agent: true,
            vessel: true,
            returnPlace: true,
            pod: true,
            pol: true,
          },
        },
        user: true,
        details: {
          include: {
            agent: true,
          },
        },
      },
    });
    if (!job) {
      return res.status(404).json({ error: 'Job Card not found' });
    }
    res.json(job);
  } catch (error) {
    next(error);
  }
});

// Service function for Auto-Balancer workload assignment and Job Card creation
async function assignJobCard(scheduleId, totalSets, tx = prisma) {
  // 1. Get the target Master Schedule to determine Actual_DPR date
  const schedule = await tx.masterSchedule.findUnique({
    where: { id: parseInt(scheduleId) },
  });

  if (!schedule) {
    throw new Error('Master Schedule not found');
  }

  const targetDpr = schedule.actualDpr;

  // Helper to check if two actualDpr dates are on the same calendar day (ignoring time) or both null
  const isSameDay = (d1, d2) => {
    if (!d1 && !d2) return true;
    if (!d1 || !d2) return false;
    const date1 = new Date(d1);
    const date2 = new Date(d2);
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  };

  // 2. Find all active Staff members
  const staffMembers = await tx.user.findMany({
    where: { role: 'STAFF', isActive: true },
  });

  if (staffMembers.length === 0) {
    throw new Error('No active staff members available for auto-assignment');
  }

  // 3. Calculate workloads
  const staffWorkloads = await Promise.all(
    staffMembers.map(async (staff) => {
      // Get all job cards assigned to this staff member, including their schedules
      const jobs = await tx.jobCard.findMany({
        where: { userId: staff.id },
        include: { schedule: true },
      });

      // Workload on the same Actual_DPR date
      const jobsOnDate = jobs.filter((job) => isSameDay(job.schedule.actualDpr, targetDpr));
      const workloadOnDate = jobsOnDate.reduce((sum, job) => sum + job.totalSets, 0);

      // Overall workload across all dates
      const overallWorkload = jobs.reduce((sum, job) => sum + job.totalSets, 0);

      return {
        staff,
        workloadOnDate,
        overallWorkload,
      };
    })
  );

  // 4. Sort staff using workload on date (primary) and overall workload (secondary/tie-breaker)
  staffWorkloads.sort((a, b) => {
    if (a.workloadOnDate !== b.workloadOnDate) {
      return a.workloadOnDate - b.workloadOnDate;
    }
    return a.overallWorkload - b.overallWorkload;
  });

  const assignedStaff = staffWorkloads[0].staff;

  // 5. Create the Job Card
  const jobCard = await tx.jobCard.create({
    data: {
      scheduleId: parseInt(scheduleId),
      userId: assignedStaff.id,
      totalSets: parseInt(totalSets),
      status: 'PAYMENT',
      statusBill: false,
    },
  });

  return jobCard;
}

// POST /api/jobs - Create a Job Card and use Auto-Balancer to assign to staff with lowest workload
router.post('/', async (req, res, next) => {
  try {
    const { scheduleId, details } = req.body; // details is an array of checklist items

    if (!scheduleId || !Array.isArray(details) || details.length === 0) {
      return res.status(400).json({ error: 'scheduleId and a non-empty details array are required' });
    }

    // Calculate total sets from requested checklist details
    const totalSets = details.reduce((sum, item) => sum + parseInt(item.setsCount || 0), 0);

    // Run inside a Prisma transaction
    const newJob = await prisma.$transaction(async (tx) => {
      // 1. Call assignJobCard to run the Auto-Balancer and create the Job Card
      const job = await assignJobCard(parseInt(scheduleId), totalSets, tx);

      // 2. Insert checklist details
      const detailPromises = details.map((item) =>
        tx.jobCardDetail.create({
          data: {
            jobId: job.id,
            agentId: parseInt(item.agentId),
            customerName: item.customerName,
            bookingNo: item.bookingNo,
            setsCount: parseInt(item.setsCount),
            isChecked: false,
          },
        })
      );

      await Promise.all(detailPromises);

      // 3. Return the complete created job card with details
      return tx.jobCard.findUnique({
        where: { id: job.id },
        include: {
          schedule: true,
          user: true,
          details: {
            include: {
              agent: true,
            },
          },
        },
      });
    });

    res.status(201).json(newJob);
  } catch (error) {
    next(error);
  }
});

// PUT /api/jobs/:id/status - Move Job Card to a different status (Kanban move)
router.put('/:id/status', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['PAYMENT', 'SURRENDER_ING', 'FINAL_BL', 'COMPLETE'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    const currentJob = await prisma.jobCard.findUnique({ where: { id: parseInt(id) } });
    if (!currentJob) {
      return res.status(404).json({ error: 'Job Card not found' });
    }

    const completedAt = status === 'COMPLETE' ? new Date() : null;

    const updatedJob = await prisma.jobCard.update({
      where: { id: parseInt(id) },
      data: {
        status,
        completedAt,
      },
      include: {
        schedule: true,
        user: true,
        details: true,
      },
    });

    res.json(updatedJob);
  } catch (error) {
    next(error);
  }
});

// PUT /api/jobs/:id/billing - Toggle billing status
router.put('/:id/billing', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { statusBill } = req.body;

    if (typeof statusBill !== 'boolean') {
      return res.status(400).json({ error: 'statusBill must be a boolean' });
    }

    const updatedJob = await prisma.jobCard.update({
      where: { id: parseInt(id) },
      data: {
        statusBill,
      },
    });

    res.json(updatedJob);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/jobs/details/:detailId - Toggle checkbox on sub-tasks
router.patch('/details/:detailId', async (req, res, next) => {
  try {
    const { detailId } = req.params;
    const { isChecked } = req.body;

    if (typeof isChecked !== 'boolean') {
      return res.status(400).json({ error: 'isChecked must be a boolean' });
    }

    const updatedDetail = await prisma.jobCardDetail.update({
      where: { id: parseInt(detailId) },
      data: {
        isChecked,
      },
    });

    res.json(updatedDetail);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/jobs/:id - Delete a Job Card
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    await prisma.jobCard.delete({
      where: { id: parseInt(id) },
    });
    res.json({ message: 'Job Card deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// PUT /api/jobs/:id/reassign - Reassign Job Card to a different staff member (manual override)
router.put('/:id/reassign', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const currentJob = await prisma.jobCard.findUnique({ where: { id: parseInt(id) } });
    if (!currentJob) {
      return res.status(404).json({ error: 'Job Card not found' });
    }

    const updatedJob = await prisma.jobCard.update({
      where: { id: parseInt(id) },
      data: {
        userId: parseInt(userId),
      },
      include: {
        schedule: true,
        user: true,
        details: true,
      },
    });

    res.json(updatedJob);
  } catch (error) {
    next(error);
  }
});

router.assignJobCard = assignJobCard;
module.exports = router;
