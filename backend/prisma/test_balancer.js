const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const jobsRoute = require('../src/routes/jobs');
const assignJobCard = jobsRoute.assignJobCard;

async function testBalancer() {
  console.log('--- Starting Auto-Balancer Test ---');

  try {
    // 1. Get or create test users
    const staff1 = await prisma.user.upsert({
      where: { username: 'staff1' },
      update: {},
      create: { username: 'staff1', name: 'Staff Member 1', role: 'STAFF' },
    });
    const staff2 = await prisma.user.upsert({
      where: { username: 'staff2' },
      update: {},
      create: { username: 'staff2', name: 'Staff Member 2', role: 'STAFF' },
    });
    const staff3 = await prisma.user.upsert({
      where: { username: 'staff3' },
      update: {},
      create: { username: 'staff3', name: 'Staff Member 3', role: 'STAFF' },
    });
    const staff4 = await prisma.user.upsert({
      where: { username: 'staff4' },
      update: {},
      create: { username: 'staff4', name: 'Staff Member 4', role: 'STAFF' },
    });

    // Clean existing test jobs/schedules to have a fresh state
    await prisma.jobCardDetail.deleteMany({});
    await prisma.jobCard.deleteMany({});
    await prisma.scheduleUpdateLog.deleteMany({});
    await prisma.masterSchedule.deleteMany({});

    // Create agents, vessels, return places, ports for foreign keys
    const agent = await prisma.agent.create({ data: { agentName: 'TEST_AGENT' } });
    const vessel = await prisma.vessel.create({ data: { vesselName: 'TEST_VESSEL' } });
    const returnPlace = await prisma.returnPlace.create({ data: { placeName: 'TEST_DEPOT' } });
    const pod = await prisma.pod.create({ data: { name: 'TEST_POD' } });
    const pol = await prisma.pol.create({ data: { name: 'TEST_POL' } });

    // 2. Create test schedules
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);

    // Schedule 1 (Today)
    const schedToday1 = await prisma.masterSchedule.create({
      data: {
        agentId: agent.id, vesselId: vessel.id, placeId: returnPlace.id, podId: pod.id, polId: pol.id,
        voyage: 'V100', service: 'S1', weekNo: 1, originalEtd: today, actualDpr: today,
        closingDate: today, closingTime: '12:00'
      }
    });

    // Schedule 2 (Today)
    const schedToday2 = await prisma.masterSchedule.create({
      data: {
        agentId: agent.id, vesselId: vessel.id, placeId: returnPlace.id, podId: pod.id, polId: pol.id,
        voyage: 'V200', service: 'S1', weekNo: 1, originalEtd: today, actualDpr: today,
        closingDate: today, closingTime: '15:00'
      }
    });

    // Schedule 3 (Tomorrow)
    const schedTomorrow = await prisma.masterSchedule.create({
      data: {
        agentId: agent.id, vesselId: vessel.id, placeId: returnPlace.id, podId: pod.id, polId: pol.id,
        voyage: 'V300', service: 'S1', weekNo: 1, originalEtd: tomorrow, actualDpr: tomorrow,
        closingDate: tomorrow, closingTime: '17:00'
      }
    });

    console.log('Test schedules and master data created.');

    // 3. Run Balancer assignments
    console.log('\n--- Assigning Job 1 (Today, 10 Sets) ---');
    const job1 = await assignJobCard(schedToday1.id, 10);
    const u1 = await prisma.user.findUnique({ where: { id: job1.userId } });
    console.log(`Job 1 assigned to: ${u1.name} (${u1.username})`);

    console.log('\n--- Assigning Job 2 (Today, 5 Sets) ---');
    const job2 = await assignJobCard(schedToday2.id, 5);
    const u2 = await prisma.user.findUnique({ where: { id: job2.userId } });
    console.log(`Job 2 assigned to: ${u2.name} (${u2.username})`);

    console.log('\n--- Assigning Job 3 (Today, 8 Sets) ---');
    const job3 = await assignJobCard(schedToday1.id, 8);
    const u3 = await prisma.user.findUnique({ where: { id: job3.userId } });
    console.log(`Job 3 assigned to: ${u3.name} (${u3.username})`);

    console.log('\n--- Assigning Job 4 (Today, 4 Sets) ---');
    const job4 = await assignJobCard(schedToday2.id, 4);
    const u4 = await prisma.user.findUnique({ where: { id: job4.userId } });
    console.log(`Job 4 assigned to: ${u4.name} (${u4.username})`);

    // Workload check on Today:
    // staff1 (job1): 10 sets
    // staff2 (job2): 5 sets
    // staff3 (job3): 8 sets
    // staff4 (job4): 4 sets

    console.log('\n--- Assigning Job 5 (Tomorrow, 7 Sets) ---');
    // For tomorrow, workload on date is 0 for everyone (4-way tie).
    // Tie-breaker: overall sets.
    // Overall sets: staff1 (10), staff2 (5), staff3 (8), staff4 (4).
    // Lowest overall is staff4 (4 sets).
    // Expect Job 5 to be assigned to staff4!
    const job5 = await assignJobCard(schedTomorrow.id, 7);
    const u5 = await prisma.user.findUnique({ where: { id: job5.userId } });
    console.log(`Job 5 assigned to: ${u5.name} (${u5.username})`);
    
    if (u5.username === 'staff4') {
      console.log('SUCCESS: Tie-breaker successfully assigned Job 5 to staff4 (lowest overall workload).');
    } else {
      console.log(`FAIL: Expected Job 5 to be assigned to staff4, but got ${u5.username}`);
    }

    console.log('\n--- Final Workload Overview ---');
    const allStaff = [staff1, staff2, staff3, staff4];
    for (const s of allStaff) {
      const jobs = await prisma.jobCard.findMany({ where: { userId: s.id } });
      const overall = jobs.reduce((sum, j) => sum + j.totalSets, 0);
      console.log(`${s.name} (${s.username}) Overall Workload: ${overall} sets`);
    }

  } catch (error) {
    console.error('Test execution failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testBalancer();
