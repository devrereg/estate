import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { fetchFromDataGoKr, parseTradeItems, parseRentItems } from '@/lib/apiClient';
import { getLastNMonths, batchProcess } from '@/lib/utils';

export const maxDuration = 60;

const CHUNK_SIZE = 15;

export async function POST(request) {
  try {
    const body = await request.json();
    const { type = 'FULL', months = 6, regionScope, jobId: incomingJobId } = body;

    const regions = regionScope && Array.isArray(regionScope)
      ? await prisma.region.findMany({ where: { id: { in: regionScope } } })
      : await prisma.region.findMany();

    const monthList = getLastNMonths(months);
    const collectTrade = type === 'TRADE' || type === 'FULL';
    const collectRent = type === 'RENT' || type === 'FULL';
    const regionIds = regions.map(r => r.id);

    // 캐시 판정: MonthlyRegionStat의 처리 완료 마커(tradeProcessed / rentProcessed) 기준
    // 빈 결과(0건)이어도 API 호출한 (regionId, dealYmd)는 마커가 true → 재큐 방지
    const existingStats = await prisma.monthlyRegionStat.findMany({
      where: { regionId: { in: regionIds }, dealYmd: { in: monthList } },
      select: { regionId: true, dealYmd: true, tradeProcessed: true, rentProcessed: true },
    });

    const tradeKey = new Set(
      existingStats.filter(s => s.tradeProcessed).map(s => `${s.regionId}_${s.dealYmd}`)
    );
    const rentKey = new Set(
      existingStats.filter(s => s.rentProcessed).map(s => `${s.regionId}_${s.dealYmd}`)
    );

    const allTasks = [];
    for (const region of regions) {
      for (const month of monthList) {
        const key = `${region.id}_${month}`;
        if (collectTrade && !tradeKey.has(key)) allTasks.push({ region, month, type: 'TRADE' });
        if (collectRent && !rentKey.has(key)) allTasks.push({ region, month, type: 'RENT' });
      }
    }

    const totalAll = regions.length * monthList.length * ((collectTrade && collectRent) ? 2 : 1);
    const remaining = allTasks.length;

    // CollectionJob: 첫 호출 때 생성, 후속 호출은 jobId로 같은 레코드 갱신
    let job = null;
    if (incomingJobId) {
      job = await prisma.collectionJob.findUnique({ where: { id: incomingJobId } });
    }
    if (!job) {
      job = await prisma.collectionJob.create({
        data: {
          jobType: type,
          status: remaining === 0 ? 'COMPLETED' : 'RUNNING',
          totalTasks: totalAll,
          startedAt: new Date(),
          finishedAt: remaining === 0 ? new Date() : null,
        },
      });
    }

    if (remaining === 0) {
      return NextResponse.json({
        jobId: job.id,
        status: 'COMPLETED',
        total: totalAll,
        remaining: 0,
        processedThisCall: 0,
        success: 0,
        failed: 0,
        message: '모든 데이터 캐시 존재',
      });
    }

    // 한 청크만 동기 처리
    const chunk = allTasks.slice(0, CHUNK_SIZE);
    let success = 0;
    let failed = 0;

    await batchProcess(chunk, async (task) => {
      try {
        if (task.type === 'TRADE') {
          const data = await fetchFromDataGoKr('get_apartment_trades', {
            LAWD_CD: task.region.id,
            DEAL_YMD: task.month,
          });
          const items = parseTradeItems(data);
          for (const item of items) {
            await prisma.trade.create({
              data: {
                regionId: task.region.id,
                dealYmd: task.month,
                aptName: item.aptName,
                dealAmount: item.dealAmount,
                excArea: item.excArea,
                floor: item.floor,
                dealDay: item.dealDay,
                buildYear: item.buildYear,
              },
            });
          }
        } else {
          const data = await fetchFromDataGoKr('get_apartment_rent', {
            LAWD_CD: task.region.id,
            DEAL_YMD: task.month,
          });
          const items = parseRentItems(data);
          for (const item of items) {
            await prisma.rent.create({
              data: {
                regionId: task.region.id,
                dealYmd: task.month,
                aptName: item.aptName,
                rentType: item.rentType,
                deposit: item.deposit,
                monthlyRent: item.monthlyRent,
                excArea: item.excArea,
                floor: item.floor,
                dealDay: item.dealDay,
              },
            });
          }
        }
        success++;
      } catch (err) {
        failed++;
        console.error(`Failed: ${task.region.id} ${task.month} ${task.type}:`, err.message);
      }
    }, 5, 200);

    // 이 청크가 건드린 (region, month)에 대해 통계 갱신 + 처리 완료 마커 기록
    // 성공/실패 불문하고 모든 task에 마커를 세팅: failed task도 재큐되지 않음
    // (단, API 오류 task는 failed++ 후 재시도 없이 마킹 — 현재 요구사항대로)
    const touchedByType = new Map(); // key: "regionId_month", value: { trade?, rent? }
    for (const task of chunk) {
      const key = `${task.region.id}_${task.month}`;
      if (!touchedByType.has(key)) touchedByType.set(key, {});
      if (task.type === 'TRADE') touchedByType.get(key).trade = true;
      if (task.type === 'RENT') touchedByType.get(key).rent = true;
    }
    await computeStatsForPairs(touchedByType);

    // remainingAfter: DB 마커 재스캔으로 정확한 실측치 산출 (낙관적 추정 금지)
    const updatedStats = await prisma.monthlyRegionStat.findMany({
      where: { regionId: { in: regionIds }, dealYmd: { in: monthList } },
      select: { regionId: true, dealYmd: true, tradeProcessed: true, rentProcessed: true },
    });
    const updatedTradeKey = new Set(
      updatedStats.filter(s => s.tradeProcessed).map(s => `${s.regionId}_${s.dealYmd}`)
    );
    const updatedRentKey = new Set(
      updatedStats.filter(s => s.rentProcessed).map(s => `${s.regionId}_${s.dealYmd}`)
    );
    let remainingAfter = 0;
    for (const region of regions) {
      for (const month of monthList) {
        const key = `${region.id}_${month}`;
        if (collectTrade && !updatedTradeKey.has(key)) remainingAfter++;
        if (collectRent && !updatedRentKey.has(key)) remainingAfter++;
      }
    }

    const completed = remainingAfter === 0;

    await prisma.collectionJob.update({
      where: { id: job.id },
      data: {
        completed: { increment: success },
        failed: { increment: failed },
        status: completed ? 'COMPLETED' : 'RUNNING',
        finishedAt: completed ? new Date() : null,
      },
    });

    return NextResponse.json({
      jobId: job.id,
      status: completed ? 'COMPLETED' : 'IN_PROGRESS',
      total: totalAll,
      remaining: remainingAfter,
      processedThisCall: chunk.length,
      success,
      failed,
      message: completed
        ? `수집 완료 (이번 청크 ${success}건 성공, ${failed}건 실패)`
        : `${chunk.length}건 처리, ${remainingAfter}건 남음`,
    });
  } catch (error) {
    console.error('Collection error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 처리된 (regionId, month)에 대해 통계 집계 + 처리 완료 마커 upsert
// tradeFlag/rentFlag: 이번 청크에서 해당 타입을 처리했으면 true → 마커를 true로 갱신
async function computeStatsForPairs(touchedByType) {
  for (const [pair, flags] of touchedByType) {
    const [regionId, dealYmd] = pair.split('_');

    const [trades, rents] = await Promise.all([
      prisma.trade.findMany({ where: { regionId, dealYmd } }),
      prisma.rent.findMany({ where: { regionId, dealYmd, rentType: '전세' } }),
    ]);

    const tradeAmounts = trades.map(t => t.dealAmount);
    const rentDeposits = rents.map(r => r.deposit);

    const avgTrade = tradeAmounts.length > 0
      ? Math.round(tradeAmounts.reduce((a, b) => a + b, 0) / tradeAmounts.length) : 0;
    const maxTrade = tradeAmounts.length > 0 ? Math.max(...tradeAmounts) : 0;
    const avgRent = rentDeposits.length > 0
      ? Math.round(rentDeposits.reduce((a, b) => a + b, 0) / rentDeposits.length) : 0;
    const leaseToPrice = (avgTrade > 0 && avgRent > 0) ? avgRent / avgTrade : null;

    // 처리 완료 마커: 이번 청크에서 처리한 타입만 true로 set
    // 기존 row가 있으면 해당 타입 마커만 덮어쓰고, 없으면 전체 create
    const updateData = {
      tradeCount: trades.length,
      avgTradePrice: avgTrade,
      maxTradePrice: maxTrade,
      rentCount: rents.length,
      avgRentDeposit: avgRent,
      leaseToPrice,
      ...(flags.trade && { tradeProcessed: true }),
      ...(flags.rent && { rentProcessed: true }),
    };

    await prisma.monthlyRegionStat.upsert({
      where: { regionId_dealYmd: { regionId, dealYmd } },
      update: updateData,
      create: {
        regionId,
        dealYmd,
        tradeCount: trades.length,
        avgTradePrice: avgTrade,
        maxTradePrice: maxTrade,
        rentCount: rents.length,
        avgRentDeposit: avgRent,
        leaseToPrice,
        tradeProcessed: flags.trade ?? false,
        rentProcessed: flags.rent ?? false,
      },
    });
  }
}
