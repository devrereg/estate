import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { detectTriggers } from '@/lib/predict/triggerDetection';
import { mapMigrationTargets } from '@/lib/predict/demandMigration';
import { scoreCandidates } from '@/lib/predict/scoring';

export async function GET() {
  try {
    // Phase 1: 트리거 감지
    const triggers = await detectTriggers();
    if (triggers.length === 0) {
      return NextResponse.json({
        message: '현재 상승 신호가 감지된 지역이 없습니다.',
        triggers: [],
        predictions: [],
      });
    }

    // Phase 2: 수요 이동 경로 매핑
    const candidates = await mapMigrationTargets(triggers);

    // Phase 3: 스코어링
    const scores = await scoreCandidates(candidates);

    // DB 저장
    for (const score of scores) {
      await prisma.predictionResult.create({ data: score });
    }

    // 지역 정보 부착
    const regionIds = [...new Set(scores.map(s => s.regionId))];
    const triggerRegionIds = [...new Set(triggers.map(t => t.regionId))];
    const regions = await prisma.region.findMany({
      where: { id: { in: [...regionIds, ...triggerRegionIds] } },
    });
    const regionMap = Object.fromEntries(regions.map(r => [r.id, r]));

    const enrichedTriggers = triggers.map(t => ({
      ...t,
      region: regionMap[t.regionId],
    }));
    const enrichedScores = scores.map(s => ({
      ...s,
      region: regionMap[s.regionId],
      triggerRegion: regionMap[s.triggerRegionId],
    }));

    return NextResponse.json({
      triggers: enrichedTriggers,
      predictions: enrichedScores,
      summary: {
        triggersFound: triggers.length,
        candidatesEvaluated: candidates.length,
        predictionsGenerated: scores.length,
      },
    });
  } catch (error) {
    console.error('Score pipeline error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
