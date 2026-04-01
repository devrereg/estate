import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET() {
  try {
    const latestJob = await prisma.collectionJob.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    const regionCount = await prisma.region.count();
    const tradeCount = await prisma.trade.count();
    const rentCount = await prisma.rent.count();
    const statCount = await prisma.monthlyRegionStat.count();
    const triggerCount = await prisma.triggerEvent.count();
    const predictionCount = await prisma.predictionResult.count();

    return NextResponse.json({
      latestJob,
      counts: { regionCount, tradeCount, rentCount, statCount, triggerCount, predictionCount },
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
