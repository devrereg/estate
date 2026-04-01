import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET() {
  try {
    // 최신 트리거 이벤트
    const triggers = await prisma.triggerEvent.findMany({
      orderBy: { detectedAt: 'desc' },
      take: 20,
      include: {
        region: true,
        apartment: true,
      },
    });

    // 최신 예측 결과
    const predictions = await prisma.predictionResult.findMany({
      orderBy: { totalScore: 'desc' },
      take: 30,
      include: { region: true },
    });

    // 트리거 지역 정보 부착
    const triggerRegionIds = [...new Set(predictions.map(p => p.triggerRegionId))];
    const triggerRegions = await prisma.region.findMany({
      where: { id: { in: triggerRegionIds } },
    });
    const triggerRegionMap = Object.fromEntries(triggerRegions.map(r => [r.id, r]));

    const enrichedPredictions = predictions.map(p => ({
      ...p,
      triggerRegion: triggerRegionMap[p.triggerRegionId],
    }));

    return NextResponse.json({ triggers, predictions: enrichedPredictions });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
