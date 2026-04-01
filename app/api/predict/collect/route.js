import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { fetchFromDataGoKr, parseTradeItems, parseRentItems } from '@/lib/apiClient';
import { getLastNMonths, batchProcess } from '@/lib/utils';

export async function POST(request) {
  try {
    const body = await request.json();
    const { type = 'FULL', months = 6, regionScope } = body;

    // 대상 지역 조회
    let regions;
    if (regionScope && Array.isArray(regionScope)) {
      regions = await prisma.region.findMany({ where: { id: { in: regionScope } } });
    } else {
      regions = await prisma.region.findMany();
    }

    const monthList = getLastNMonths(months);
    const collectTrade = type === 'TRADE' || type === 'FULL';
    const collectRent = type === 'RENT' || type === 'FULL';

    // DB에 이미 있는 (regionId, dealYmd) 조합 조회하여 스킵 대상 결정
    const tasks = [];
    let skipped = 0;

    for (const region of regions) {
      for (const month of monthList) {
        if (collectTrade) {
          const existing = await prisma.trade.count({
            where: { regionId: region.id, dealYmd: month },
          });
          if (existing > 0) { skipped++; }
          else { tasks.push({ region, month, type: 'TRADE' }); }
        }
        if (collectRent) {
          const existing = await prisma.rent.count({
            where: { regionId: region.id, dealYmd: month },
          });
          if (existing > 0) { skipped++; }
          else { tasks.push({ region, month, type: 'RENT' }); }
        }
      }
    }

    const totalAll = regions.length * monthList.length * (collectTrade && collectRent ? 2 : 1);
    const job = await prisma.collectionJob.create({
      data: { jobType: type, status: tasks.length > 0 ? 'RUNNING' : 'COMPLETED', totalTasks: tasks.length, startedAt: new Date(), finishedAt: tasks.length === 0 ? new Date() : null },
    });

    if (tasks.length > 0) {
      collectData(job.id, tasks);
    }

    return NextResponse.json({
      jobId: job.id,
      status: tasks.length > 0 ? 'RUNNING' : 'COMPLETED',
      totalTasks: tasks.length,
      skipped,
      message: tasks.length > 0
        ? `${tasks.length}건 API 호출 시작 (${skipped}건 DB 캐시 스킵)`
        : `전체 ${totalAll}건 DB 캐시 존재 — API 호출 없음`,
    });
  } catch (error) {
    console.error('Collection error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function collectData(jobId, tasks) {
  let completed = 0;
  let failed = 0;

  // 월 목록 (통계 계산용)
  const monthSet = new Set(tasks.map(t => t.month));

  // 5개씩 배치 처리
  await batchProcess(tasks, async (task) => {
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
      completed++;
    } catch (err) {
      failed++;
      console.error(`Failed: ${task.region.id} ${task.month} ${task.type}:`, err.message);
    }

    // 진행률 업데이트 (10건마다)
    if ((completed + failed) % 10 === 0) {
      await prisma.collectionJob.update({
        where: { id: jobId },
        data: { completed, failed },
      });
    }
  }, 5, 200);

  // 수집 완료 후 월별 통계 계산
  await computeMonthlyStats([...monthSet]);

  // 작업 완료
  await prisma.collectionJob.update({
    where: { id: jobId },
    data: { status: 'COMPLETED', completed, failed, finishedAt: new Date() },
  });
  console.log(`Collection job ${jobId} completed: ${completed} success, ${failed} failed`);
}

async function computeMonthlyStats(monthList) {
  const regions = await prisma.region.findMany();

  for (const region of regions) {
    for (const month of monthList) {
      const trades = await prisma.trade.findMany({
        where: { regionId: region.id, dealYmd: month },
      });
      const rents = await prisma.rent.findMany({
        where: { regionId: region.id, dealYmd: month, rentType: '전세' },
      });

      if (trades.length === 0 && rents.length === 0) continue;

      const tradeAmounts = trades.map(t => t.dealAmount);
      const rentDeposits = rents.map(r => r.deposit);

      const avgTrade = tradeAmounts.length > 0
        ? Math.round(tradeAmounts.reduce((a, b) => a + b, 0) / tradeAmounts.length) : 0;
      const maxTrade = tradeAmounts.length > 0 ? Math.max(...tradeAmounts) : 0;
      const avgRent = rentDeposits.length > 0
        ? Math.round(rentDeposits.reduce((a, b) => a + b, 0) / rentDeposits.length) : 0;

      const leaseToPrice = (avgTrade > 0 && avgRent > 0) ? avgRent / avgTrade : null;

      await prisma.monthlyRegionStat.upsert({
        where: { regionId_dealYmd: { regionId: region.id, dealYmd: month } },
        update: {
          tradeCount: trades.length,
          avgTradePrice: avgTrade,
          maxTradePrice: maxTrade,
          rentCount: rents.length,
          avgRentDeposit: avgRent,
          leaseToPrice,
        },
        create: {
          regionId: region.id,
          dealYmd: month,
          tradeCount: trades.length,
          avgTradePrice: avgTrade,
          maxTradePrice: maxTrade,
          rentCount: rents.length,
          avgRentDeposit: avgRent,
          leaseToPrice,
        },
      });
    }
  }
}
