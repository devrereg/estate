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

    // 캐시 판정: 시퀀셜 count 루프 대신 일괄 distinct 조회
    const [existingTrades, existingRents] = await Promise.all([
      collectTrade
        ? prisma.trade.findMany({
            where: { regionId: { in: regionIds }, dealYmd: { in: monthList } },
            select: { regionId: true, dealYmd: true },
            distinct: ['regionId', 'dealYmd'],
          })
        : Promise.resolve([]),
      collectRent
        ? prisma.rent.findMany({
            where: { regionId: { in: regionIds }, dealYmd: { in: monthList } },
            select: { regionId: true, dealYmd: true },
            distinct: ['regionId', 'dealYmd'],
          })
        : Promise.resolve([]),
    ]);

    const tradeKey = new Set(existingTrades.map(t => `${t.regionId}_${t.dealYmd}`));
    const rentKey = new Set(existingRents.map(r => `${r.regionId}_${r.dealYmd}`));

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

    // 한 청크만 동기 처리: 응답 안에서 await로 완결시킴
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

    // 이 청크가 건드린 (region, month)만 통계 갱신
    const touchedPairs = new Set(chunk.map(t => `${t.region.id}_${t.month}`));
    await computeStatsForPairs(touchedPairs);

    const remainingAfter = remaining - chunk.length;
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

async function computeStatsForPairs(pairs) {
  for (const pair of pairs) {
    const [regionId, dealYmd] = pair.split('_');
    const trades = await prisma.trade.findMany({
      where: { regionId, dealYmd },
    });
    const rents = await prisma.rent.findMany({
      where: { regionId, dealYmd, rentType: '전세' },
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
      where: { regionId_dealYmd: { regionId, dealYmd } },
      update: {
        tradeCount: trades.length,
        avgTradePrice: avgTrade,
        maxTradePrice: maxTrade,
        rentCount: rents.length,
        avgRentDeposit: avgRent,
        leaseToPrice,
      },
      create: {
        regionId,
        dealYmd,
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
