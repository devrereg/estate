// 공유 유틸리티 (BlueChipTrends.js에서 추출 + 범용화)

export const formatPrice = (num) => {
  const valueInWon = num * 10000;
  const uk = Math.floor(valueInWon / 100000000);
  const man = Math.floor((valueInWon % 100000000) / 10000);

  let result = [];
  if (uk > 0) result.push(`${uk}억`);
  if (man > 0) result.push(`${new Intl.NumberFormat('ko-KR').format(man)}만`);

  if (result.length === 0) return `${new Intl.NumberFormat('ko-KR').format(Math.round(valueInWon))}원`;
  return result.join(' ') + '원';
};

export const getLastNMonths = (n) => {
  const result = [];
  const d = new Date();
  for (let i = 0; i < n; i++) {
    const dObj = new Date(d.getFullYear(), d.getMonth() - i, 1);
    const y = dObj.getFullYear();
    const m = String(dObj.getMonth() + 1).padStart(2, '0');
    result.push(`${y}${m}`);
  }
  return result;
};

// 배치 처리: items를 batchSize씩 나눠서 fn을 실행, 배치 간 delay(ms) 대기
export const batchProcess = async (items, fn, batchSize = 5, delay = 200) => {
  const results = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
    if (i + batchSize < items.length && delay > 0) {
      await new Promise(r => setTimeout(r, delay));
    }
  }
  return results;
};
