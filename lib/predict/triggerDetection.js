// Phase 1: 트리거 감지
// 대장 아파트의 상승 신호를 감지한다
import prisma from '@/lib/db';
import { getLastNMonths } from '@/lib/utils';

export async function detectTriggers() {
  const apartments = await prisma.blueChipApartment.findMany();
  const triggers = [];

  for (const apt of apartments) {
    // 해당 아파트의 모든 거래 내역 조회
    const allTrades = await prisma.trade.findMany({
      where: {
        regionId: apt.regionId,
        aptName: { contains: apt.name.replace(/\s/g, '') },
      },
      orderBy: [{ dealYmd: 'desc' }, { dealDay: 'desc' }],
    });

    // 이름 매칭 보정 (공백 제거 후 비교)
    const filtered = allTrades.filter(t => {
      const target = apt.name.replace(/\s/g, '');
      const actual = t.aptName.replace(/\s/g, '');
      return actual.includes(target) || target.includes(actual);
    });

    if (filtered.length < 2) continue;

    const allAmounts = filtered.map(t => t.dealAmount);
    const allTimeHigh = Math.max(...allAmounts);

    // 조건 A: 최근 3개월 최고가 ≥ 전고점의 90%
    const recent3Months = getLastNMonths(3);
    const recentTrades = filtered.filter(t => recent3Months.includes(t.dealYmd));

    if (recentTrades.length > 0) {
      const recentMax = Math.max(...recentTrades.map(t => t.dealAmount));
      const ratio = recentMax / allTimeHigh;

      if (ratio >= 0.90) {
        triggers.push({
          regionId: apt.regionId,
          apartmentId: apt.id,
          triggerType: 'ATH_90',
          triggerValue: parseFloat(ratio.toFixed(4)),
          referencePrice: allTimeHigh,
          currentPrice: recentMax,
        });
      }
    }

    // 조건 B: 직전 거래 대비 5%+ 상승
    if (filtered.length >= 2) {
      const latest = filtered[0].dealAmount;
      const previous = filtered[1].dealAmount;
      if (previous > 0) {
        const changeRate = (latest - previous) / previous;
        if (changeRate >= 0.05) {
          triggers.push({
            regionId: apt.regionId,
            apartmentId: apt.id,
            triggerType: 'PRICE_JUMP_5PCT',
            triggerValue: parseFloat(changeRate.toFixed(4)),
            referencePrice: previous,
            currentPrice: latest,
          });
        }
      }
    }
  }

  // 지역별 중복 제거 (가장 강한 신호만 유지)
  const byRegion = {};
  for (const t of triggers) {
    const key = `${t.regionId}_${t.apartmentId}`;
    if (!byRegion[key] || t.triggerValue > byRegion[key].triggerValue) {
      byRegion[key] = t;
    }
  }

  // DB 저장
  const deduplicated = Object.values(byRegion);
  for (const t of deduplicated) {
    await prisma.triggerEvent.create({ data: t });
  }

  return deduplicated;
}
