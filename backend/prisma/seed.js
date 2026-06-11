const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding...');

  // 1. Seed Users
  const users = [
    { username: 'admin', name: 'System Admin', role: 'ADMIN' },
    { username: 'supervisor', name: 'Operations Supervisor', role: 'SUPERVISOR' },
    { username: 'staff1', name: 'Staff Member 1', role: 'STAFF' },
    { username: 'staff2', name: 'Staff Member 2', role: 'STAFF' },
    { username: 'staff3', name: 'Staff Member 3', role: 'STAFF' },
    { username: 'staff4', name: 'Staff Member 4', role: 'STAFF' },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { username: u.username },
      update: { name: u.name, role: u.role, isActive: true },
      create: { username: u.username, name: u.name, role: u.role, isActive: true },
    });
  }
  console.log('Seeded users successfully.');

  // 2. Seed Agents
  const agents = ['MSK', 'MSC', 'CMA', 'COSCO', 'ONE', 'OOCL', 'HMM'];
  for (const a of agents) {
    const existing = await prisma.agent.findFirst({ where: { agentName: a } });
    if (!existing) {
      await prisma.agent.create({ data: { agentName: a, isActive: true } });
    }
  }
  console.log('Seeded agents successfully.');

  // 3. Seed Vessels
  const vessels = ['Vessel A', 'Vessel B', 'Vessel C', 'Vessel D'];
  for (const v of vessels) {
    const existing = await prisma.vessel.findFirst({ where: { vesselName: v } });
    if (!existing) {
      await prisma.vessel.create({ data: { vesselName: v, isActive: true } });
    }
  }
  console.log('Seeded vessels successfully.');

  // 4. Seed Return Places
  const places = ['Depo 1', 'Depo 2', 'Port A'];
  for (const p of places) {
    const existing = await prisma.returnPlace.findFirst({ where: { placeName: p } });
    if (!existing) {
      await prisma.returnPlace.create({ data: { placeName: p, isActive: true } });
    }
  }
  console.log('Seeded return places successfully.');

  // 5. Seed PODs (Port of Discharge)
  const pods = ['POD Bangkok', 'POD Singapore', 'POD Hong Kong', 'POD Busan'];
  for (const pod of pods) {
    const existing = await prisma.pod.findFirst({ where: { name: pod } });
    if (!existing) {
      await prisma.pod.create({ data: { name: pod, isActive: true } });
    }
  }
  console.log('Seeded PODs successfully.');

  // 6. Seed POLs (Port of Loading)
  const pols = ['POL Laem Chabang', 'POL Bangkok', 'POL Singapore', 'POL Shanghai'];
  for (const pol of pols) {
    const existing = await prisma.pol.findFirst({ where: { name: pol } });
    if (!existing) {
      await prisma.pol.create({ data: { name: pol, isActive: true } });
    }
  }
  console.log('Seeded POLs successfully.');

  // 7. Seed Master Schedules (only if none exist)
  const existingScheds = await prisma.masterSchedule.findMany();
  if (existingScheds.length === 0) {
    const dbAgents = await prisma.agent.findMany();
    const dbVessels = await prisma.vessel.findMany();
    const dbPlaces = await prisma.returnPlace.findMany();
    const dbPods = await prisma.pod.findMany();
    const dbPols = await prisma.pol.findMany();

    const today = new Date();
    
    const schedsToCreate = [
      {
        agentId: dbAgents.find(a => a.agentName === 'MSK').id,
        vesselId: dbVessels.find(v => v.vesselName === 'Vessel A').id,
        placeId: dbPlaces.find(p => p.placeName === 'Depo 1').id,
        podId: dbPods.find(p => p.name === 'POD Singapore').id,
        polId: dbPols.find(p => p.name === 'POL Laem Chabang').id,
        voyage: 'V001',
        service: 'USX',
        weekNo: 23,
        originalEtd: new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000), // Today + 2 days
        actualDpr: new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000), // On time
        delayDays: 0,
        closingDate: new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000),
        closingTime: '17:00',
        note: 'Normal service'
      },
      {
        agentId: dbAgents.find(a => a.agentName === 'CMA').id,
        vesselId: dbVessels.find(v => v.vesselName === 'Vessel B').id,
        placeId: dbPlaces.find(p => p.placeName === 'Depo 2').id,
        podId: dbPods.find(p => p.name === 'POD Hong Kong').id,
        polId: dbPols.find(p => p.name === 'POL Bangkok').id,
        voyage: 'V002',
        service: 'AAS',
        weekNo: 24,
        originalEtd: new Date(today.getTime() + 4 * 24 * 60 * 60 * 1000), // Today + 4 days
        actualDpr: new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000), // Delayed +1 day
        delayDays: 1,
        closingDate: new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000),
        closingTime: '12:00',
        note: 'Delayed due to port congestion'
      },
      {
        agentId: dbAgents.find(a => a.agentName === 'COSCO').id,
        vesselId: dbVessels.find(v => v.vesselName === 'Vessel C').id,
        placeId: dbPlaces.find(p => p.placeName === 'Port A').id,
        podId: dbPods.find(p => p.name === 'POD Busan').id,
        polId: dbPols.find(p => p.name === 'POL Singapore').id,
        voyage: 'V003',
        service: 'EMS',
        weekNo: 24,
        originalEtd: new Date(today.getTime() + 6 * 24 * 60 * 60 * 1000), // Today + 6 days
        actualDpr: new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000), // Early -1 day
        delayDays: -1,
        closingDate: new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000),
        closingTime: '22:00',
        note: 'Early departure expected'
      }
    ];

    for (const s of schedsToCreate) {
      await prisma.masterSchedule.create({ data: s });
    }
    console.log('Seeded master schedules successfully.');
  }

  console.log('Seeding finished successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
