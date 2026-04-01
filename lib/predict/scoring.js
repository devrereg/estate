// Phase 3: 스코어링
// 후보 지역별 100점 만점으로 상승 가능성 점수를 산출한다
import prisma from '@/lib/db';
import { getLastNMonths } from '@/lib/utils';

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

export async function scoreCandidate(candidate) {
  const { regionId, triggerRegionId, distance, weight } = candidate;

  // 데이터가 있는 최근 월 기준 (현재 월에 데이터가 없을 수 있음)
  const last6 = getLastNMonths(6);
  const allMonths = getLastNMonths(36);

  // 최근 거래 데이터가 있는 3개월 분량 찾기
  const recentTrades = await prisma.trade.findMany({
    where: { regionId, dealYmd: { in: last6 } },
    orderBy: { dealYmd: 'desc' },
  });
  const recentRents = await prisma.rent.findMany({
    where: { regionId, dealYmd: { in: last6 }, rentType: '전세' },
    orderBy: { dealYmd: 'desc' },
  });
  // 데이터가 있는 최근 3개월로 제한
  const recentTradeMonths = [...new Set(recentTrades.map(t => t.dealYmd))].slice(0, 3);
  const filteredRecentTrades = recentTrades.filter(t => recentTradeMonths.includes(t.dealYmd));
  const recentRentMonths = [...new Set(recentRents.map(r => r.dealYmd))].slice(0, 3);
  const filteredRecentRents = recentRents.filter(r => recentRentMonths.includes(r.dealYmd));
  const allMonthlyStats = await prisma.monthlyRegionStat.findMany({
    where: { regionId, dealYmd: { in: allMonths } },
    orderBy: { dealYmd: 'desc' },
  });

  const triggerStats = await prisma.monthlyRegionStat.findMany({
    where: { regionId: triggerRegionId, dealYmd: { in: last6 } },
    orderBy: { dealYmd: 'desc' },
    take: 3,
  });

  // ── 1. 전세가율 점수 (max 30) ──
  let leaseScore = 0;
  const recentTradeAmounts = filteredRecentTrades.map(t => t.dealAmount);
  const recentRentDeposits = filteredRecentRents.map(r => r.deposit);
  const avgTrade = recentTradeAmounts.length > 0
    ? recentTradeAmounts.reduce((a, b) => a + b, 0) / recentTradeAmounts.length : 0;
  const avgRent = recentRentDeposits.length > 0
    ? recentRentDeposits.reduce((a, b) => a + b, 0) / recentRentDeposits.length : 0;

  if (avgTrade > 0 && avgRent > 0) {
    const leaseRatio = avgRent / avgTrade;
    // 0.5 → 0점, 0.6 → 15점, 0.7+ → 30점
    leaseScore = clamp(((leaseRatio - 0.5) / 0.2) * 30, 0, 30);

    // 상승 추세 보너스: 6개월 전과 비교
    const months6Ago = getLastNMonths(6).slice(3, 6);
    const pastStats = allMonthlyStats.filter(s => months6Ago.includes(s.dealYmd));
    if (pastStats.length > 0) {
      const pastLeaseAvg = pastStats
        .filter(s => s.leaseToPrice != null)
        .map(s => s.leaseToPrice);
      if (pastLeaseAvg.length > 0) {
        const pastRatio = pastLeaseAvg.reduce((a, b) => a + b, 0) / pastLeaseAvg.length;
        if (leaseRatio > pastRatio) {
          leaseScore = clamp(leaseScore + (leaseRatio - pastRatio) * 50, 0, 30);
        }
      }
    }
  }

  // ── 2. 거래량 점수 (max 30) ──
  let volumeScore = 0;
  const recent3MonthVolume = filteredRecentTrades.length;
  const allTradeStats = allMonthlyStats.map(s => s.tradeCount);
  const avg3YearMonthly = allTradeStats.length > 0
    ? allTradeStats.reduce((a, b) => a + b, 0) / allTradeStats.length : 0;
  const avgFor3Months = avg3YearMonthly * 3;

  if (avgFor3Months > 0) {
    const volumeRatio = recent3MonthVolume / avgFor3Months;
    // 1.0 → 0점, 1.5 → 15점, 2.0+ → 30점
    volumeScore = clamp(((volumeRatio - 1.0) / 1.0) * 30, 0, 30);
  }

  // ── 3. 인접성 점수 (max 20) ──
  let proximityScore = distance === 1 ? 20 : (distance === 2 ? 10 : 5);
  proximityScore *= (weight || 1.0);
  proximityScore = clamp(proximityScore, 0, 20);

  // ── 4. 가격차 점수 (max 20) ──
  let priceGapScore = 0;
  const triggerAvg = triggerStats.length > 0
    ? triggerStats.reduce((a, s) => a + s.avgTradePrice, 0) / triggerStats.length : 0;
  const candidateAvg = avgTrade;

  if (triggerAvg > 0 && candidateAvg > 0) {
    const gap = 1 - (candidateAvg / triggerAvg);
    // gap 0.1 → 5점, 0.3 → 15점, 0.5+ → 20점
    priceGapScore = clamp((gap / 0.5) * 20, 0, 20);
  }

  const totalScore = parseFloat((leaseScore + volumeScore + proximityScore + priceGapScore).toFixed(1));

  return {
    regionId,
    triggerRegionId,
    totalScore,
    leaseScore: parseFloat(leaseScore.toFixed(1)),
    volumeScore: parseFloat(volumeScore.toFixed(1)),
    proximityScore: parseFloat(proximityScore.toFixed(1)),
    priceGapScore: parseFloat(priceGapScore.toFixed(1)),
    reasoning: JSON.stringify({
      avgTrade, avgRent,
      leaseRatio: avgTrade > 0 ? (avgRent / avgTrade).toFixed(3) : null,
      recent3MonthVolume,
      avg3YearMonthly: avg3YearMonthly.toFixed(1),
      triggerAvg,
      candidateAvg,
      distance,
    }),
  };
}

export async function scoreCandidates(candidates) {
  const results = [];
  for (const candidate of candidates) {
    const score = await scoreCandidate(candidate);
    results.push(score);
  }
  // 점수 내림차순 정렬
  results.sort((a, b) => b.totalScore - a.totalScore);
  return results;
}
