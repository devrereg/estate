import pkg from '@prisma/client';
const { PrismaClient } = pkg;
import { REGIONS } from '../lib/constants/regionCodes.js';
import { SEOUL_ADJACENCY, CROSS_BOUNDARY } from '../lib/constants/adjacencyGraph.js';
import { BLUE_CHIP_APARTMENTS } from '../lib/constants/blueChipApartments.js';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding regions...');
  for (const r of REGIONS) {
    await prisma.region.upsert({
      where: { id: r.id },
      update: { name: r.name, city: r.city, fullLabel: r.fullLabel, tier: r.tier },
      create: r,
    });
  }
  console.log(`  ${REGIONS.length} regions seeded`);

  console.log('Seeding Seoul adjacency graph...');
  let adjCount = 0;
  for (const [fromId, toIds] of Object.entries(SEOUL_ADJACENCY)) {
    for (const toId of toIds) {
      await prisma.regionAdjacency.upsert({
        where: { fromRegionId_toRegionId: { fromRegionId: fromId, toRegionId: toId } },
        update: { weight: 1.0 },
        create: { fromRegionId: fromId, toRegionId: toId, weight: 1.0 },
      });
      adjCount++;
    }
  }
  console.log(`  ${adjCount} Seoul adjacencies seeded`);

  console.log('Seeding cross-boundary links...');
  let crossCount = 0;
  for (const link of CROSS_BOUNDARY) {
    // 양방향 삽입
    await prisma.regionAdjacency.upsert({
      where: { fromRegionId_toRegionId: { fromRegionId: link.from, toRegionId: link.to } },
      update: { weight: link.weight },
      create: { fromRegionId: link.from, toRegionId: link.to, weight: link.weight },
    });
    await prisma.regionAdjacency.upsert({
      where: { fromRegionId_toRegionId: { fromRegionId: link.to, toRegionId: link.from } },
      update: { weight: link.weight },
      create: { fromRegionId: link.to, toRegionId: link.from, weight: link.weight },
    });
    crossCount += 2;
  }
  console.log(`  ${crossCount} cross-boundary links seeded`);

  console.log('Seeding blue-chip apartments...');
  for (const apt of BLUE_CHIP_APARTMENTS) {
    const existing = await prisma.blueChipApartment.findFirst({
      where: { name: apt.name, regionId: apt.regionId },
    });
    if (!existing) {
      await prisma.blueChipApartment.create({ data: apt });
    }
  }
  console.log(`  ${BLUE_CHIP_APARTMENTS.length} apartments seeded`);

  console.log('Seed completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
