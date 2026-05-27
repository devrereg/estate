import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { fetchFromDataGoKr, parseTradeItems, parseRentItems } from '@/lib/apiClient';
import { getLastNMonths, batchProcess } from '@/lib/utils';

export const maxDuration = 60;

const CHUNK_SIZE = 8;

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
          // FR: createMany로 네트워크 왕복을 items 건수 → 1회로 축소
          if (items.length > 0) {
            await prisma.trade.createMany({
              data: items.map(item => ({
                regionId: task.region.id,
                dealYmd: task.month,
                aptName: item.aptName,
                dealAmount: item.dealAmount,
                excArea: item.excArea,
                floor: item.floor,
                dealDay: item.dealDay,
                buildYear: item.buildYear,
              })),
            });
          }
        } else {
          const data = await fetchFromDataGoKr('get_apartment_rent', {
            LAWD_CD: task.region.id,
            DEAL_YMD: task.month,
          });
          const items = parseRentItems(data);
          // FR: createMany로 네트워크 왕복을 items 건수 → 1회로 축소
          if (items.length > 0) {
            await prisma.rent.createMany({
              data: items.map(item => ({
                regionId: task.region.id,
                dealYmd: task.month,
                aptName: item.aptName,
                rentType: item.rentType,
                deposit: item.deposit,
                monthlyRent: item.monthlyRent,
                excArea: item.excArea,
                floor: item.floor,
                dealDay: item.dealDay,
              })),
            });
          }
        }
        // FR: task 단위 즉시 마커 기록 — createMany 성공 직후 upsert
        // 중간 타임아웃 시에도 완료된 task는 큐에서 제외됨
        await upsertStatForTask(task);
        success++;
      } catch (err) {
        failed++;
        console.error(`Failed: ${task.region.id} ${task.month} ${task.type}:`, err.message);
      }
    }, 5, 0);

    // 보정 패스: batchProcess가 끝난 뒤 이번 청크의 모든 (regionId, dealYmd) 페어를
    // 한 번에 읽어 leaseToPrice만 재계산한다.
    // upsertStatForTask 내부의 leaseToPrice 계산은 같은 파도에서 경합 시 stale 값을
    // 읽을 수 있으나, 이 보정 패스는 두 task가 모두 커밋된 이후 순차 실행되므로
    // 경합이 없어 정확한 값을 확정한다.
    const chunkPairs = [
      ...new Map(chunk.map(t => [`${t.region.id}_${t.month}`, { regionId: t.region.id, dealYmd: t.month }])).values(),
    ];
    if (chunkPairs.length > 0) {
      const pairStats = await prisma.monthlyRegionStat.findMany({
        where: {
          OR: chunkPairs.map(p => ({ regionId: p.regionId, dealYmd: p.dealYmd })),
        },
        select: { regionId: true, dealYmd: true, avgTradePrice: true, avgRentDeposit: true },
      });
      for (const stat of pairStats) {
        if (stat.avgTradePrice > 0 && stat.avgRentDeposit > 0) {
          await prisma.monthlyRegionStat.update({
            where: { regionId_dealYmd: { regionId: stat.regionId, dealYmd: stat.dealYmd } },
            data: { leaseToPrice: stat.avgRentDeposit / stat.avgTradePrice },
          });
        }
      }
    }

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

// task 단위 즉시 마커 upsert: createMany 성공 직후 호출
// TRADE task → 매매 통계 필드 + tradeProcessed 갱신, rentProcessed는 건드리지 않음
// RENT task  → 전세 통계 필드 + rentProcessed 갱신, tradeProcessed는 건드리지 않음
// MonthlyRegionStat은 (regionId, dealYmd) 유니크라 두 타입이 같은 row를 공유.
// leaseToPrice는 양쪽 타입 모두 존재할 때만 의미 있으므로 두 타입 처리 후 재계산.
async function upsertStatForTask(task) {
  const { region, month: dealYmd, type } = task;
  const regionId = region.id;

  if (type === 'TRADE') {
    const trades = await prisma.trade.findMany({ where: { regionId, dealYmd } });
    const amounts = trades.map(t => t.dealAmount);
    const avgTrade = amounts.length > 0
      ? Math.round(amounts.reduce((a, b) => a + b, 0) / amounts.length) : 0;
    const maxTrade = amounts.length > 0 ? Math.max(...amounts) : 0;

    // leaseToPrice 재계산: 기존 rentProcessed가 true면 rent도 이미 있을 수 있음
    const existing = await prisma.monthlyRegionStat.findUnique({
      where: { regionId_dealYmd: { regionId, dealYmd } },
      select: { avgRentDeposit: true, rentProcessed: true },
    });
    const avgRent = existing?.avgRentDeposit ?? 0;
    const leaseToPrice = (avgTrade > 0 && avgRent > 0) ? avgRent / avgTrade : null;

    await prisma.monthlyRegionStat.upsert({
      where: { regionId_dealYmd: { regionId, dealYmd } },
      update: { tradeCount: trades.length, avgTradePrice: avgTrade, maxTradePrice: maxTrade, leaseToPrice, tradeProcessed: true },
      create: { regionId, dealYmd, tradeCount: trades.length, avgTradePrice: avgTrade, maxTradePrice: maxTrade, rentCount: 0, avgRentDeposit: 0, leaseToPrice: null, tradeProcessed: true, rentProcessed: false },
    });
  } else {
    const rents = await prisma.rent.findMany({ where: { regionId, dealYmd, rentType: '전세' } });
    const deposits = rents.map(r => r.deposit);
    const avgRent = deposits.length > 0
      ? Math.round(deposits.reduce((a, b) => a + b, 0) / deposits.length) : 0;

    // leaseToPrice 재계산: 기존 tradeProcessed가 true면 trade도 이미 있을 수 있음
    const existing = await prisma.monthlyRegionStat.findUnique({
      where: { regionId_dealYmd: { regionId, dealYmd } },
      select: { avgTradePrice: true, maxTradePrice: true, tradeProcessed: true },
    });
    const avgTrade = existing?.avgTradePrice ?? 0;
    const leaseToPrice = (avgTrade > 0 && avgRent > 0) ? avgRent / avgTrade : null;

    await prisma.monthlyRegionStat.upsert({
      where: { regionId_dealYmd: { regionId, dealYmd } },
      update: { rentCount: rents.length, avgRentDeposit: avgRent, leaseToPrice, rentProcessed: true },
      create: { regionId, dealYmd, tradeCount: 0, avgTradePrice: 0, maxTradePrice: 0, rentCount: rents.length, avgRentDeposit: avgRent, leaseToPrice: null, tradeProcessed: false, rentProcessed: true },
    });
  }
}
