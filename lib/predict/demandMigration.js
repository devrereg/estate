// Phase 2: 수요 이동 경로 매핑
// 트리거 발생 지역에서 인접 지역으로 수요가 이동할 후보를 선별한다
import prisma from '@/lib/db';
import { getLastNMonths } from '@/lib/utils';

export async function mapMigrationTargets(triggerEvents) {
  if (!triggerEvents || triggerEvents.length === 0) return [];

  // 트리거 발생 지역 ID 수집
  const triggerRegionIds = [...new Set(triggerEvents.map(t => t.regionId))];

  // 인접 그래프 로드
  const adjacencies = await prisma.regionAdjacency.findMany({
    where: { fromRegionId: { in: triggerRegionIds } },
  });

  // 최근 월별 통계 조회 (데이터가 있는 최신 월을 찾아서 사용)
  const recentMonths = getLastNMonths(3); // 최근 3개월 중 데이터가 있는 월 사용
  const stats6MonthsAgo = getLastNMonths(12).slice(6, 12); // 6~12개월 전

  const allStats = await prisma.monthlyRegionStat.findMany({
    where: { dealYmd: { in: [...recentMonths, ...stats6MonthsAgo] } },
  });

  const statsByRegionMonth = {};
  for (const s of allStats) {
    statsByRegionMonth[`${s.regionId}_${s.dealYmd}`] = s;
  }

  // 데이터가 있는 가장 최근 월의 통계를 반환
  const getRecentStat = (regionId) => {
    for (const m of recentMonths) {
      const stat = statsByRegionMonth[`${regionId}_${m}`];
      if (stat && stat.avgTradePrice > 0) return stat;
    }
    return null;
  };
  const getPreRiseAvg = (regionId) => {
    const vals = stats6MonthsAgo
      .map(m => statsByRegionMonth[`${regionId}_${m}`]?.avgTradePrice)
      .filter(v => v && v > 0);
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  };

  const candidates = [];
  const seen = new Set();

  for (const triggerRegionId of triggerRegionIds) {
    const triggerStat = getRecentStat(triggerRegionId);
    const triggerPreRise = getPreRiseAvg(triggerRegionId);

    // 1차 인접 지역
    const directNeighbors = adjacencies
      .filter(a => a.fromRegionId === triggerRegionId)
      .map(a => ({ regionId: a.toRegionId, weight: a.weight }));

    for (const neighbor of directNeighbors) {
      const nStat = getRecentStat(neighbor.regionId);
      if (!nStat || !triggerStat) continue;

      // 필터: 트리거 지역보다 낮은 평균가
      if (nStat.avgTradePrice >= triggerStat.avgTradePrice) continue;

      // 유사성: 트리거 지역의 상승 전 가격 대비 50~120% 범위
      if (triggerPreRise > 0) {
        const ratio = nStat.avgTradePrice / triggerPreRise;
        if (ratio < 0.3 || ratio > 1.5) continue;
      }

      const key = `${neighbor.regionId}_${triggerRegionId}`;
      if (!seen.has(key)) {
        seen.add(key);
        candidates.push({
          regionId: neighbor.regionId,
          triggerRegionId,
          distance: 1,
          weight: neighbor.weight,
        });
      }
    }

    // 2차 인접 지역 (인접의 인접)
    const neighborIds = directNeighbors.map(n => n.regionId);
    const secondaryAdj = await prisma.regionAdjacency.findMany({
      where: {
        fromRegionId: { in: neighborIds },
        toRegionId: { notIn: [triggerRegionId, ...neighborIds] },
      },
    });

    for (const adj of secondaryAdj) {
      const nStat = getRecentStat(adj.toRegionId);
      if (!nStat || !triggerStat) continue;
      if (nStat.avgTradePrice >= triggerStat.avgTradePrice) continue;

      const key = `${adj.toRegionId}_${triggerRegionId}`;
      if (!seen.has(key)) {
        seen.add(key);
        candidates.push({
          regionId: adj.toRegionId,
          triggerRegionId,
          distance: 2,
          weight: adj.weight * 0.5,
        });
      }
    }
  }

  return candidates;
}
