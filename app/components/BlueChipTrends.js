import { useState } from 'react';
import { ResponsiveContainer, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, Line } from 'recharts';

const aptList = [
  { name: '래미안원베일리', lawdCd: '11650', district: '서초구 반포동' },
  { name: '트리마제', lawdCd: '11200', district: '성동구 성수동' },
  { name: '래미안대치팰리스', lawdCd: '11680', district: '강남구 대치동' },
  { name: '잠실래미안아이파크', lawdCd: '11710', district: '송파구 잠실동' },
  { name: '리센츠', lawdCd: '11710', district: '송파구 잠실동' },
  { name: '시범', lawdCd: '11560', district: '영등포구 여의도동' },
  { name: '방배그랑자이', lawdCd: '11650', district: '서초구 방배동' },
  { name: '올림픽파크포레온', lawdCd: '11740', district: '강동구 둔촌동' },
  { name: '래미안옥수리버젠', lawdCd: '11200', district: '성동구 옥수동' },
  { name: '마포프레스티지자이', lawdCd: '11440', district: '마포구 아현동' },
  { name: '아크로리버하임', lawdCd: '11590', district: '동작구 흑석동' },
  { name: '경희궁자이', lawdCd: '11110', district: '종로구 홍파동' },
  { name: '서울숲리버뷰자이', lawdCd: '11200', district: '성동구 행당동' },
  { name: '고덕그라시움', lawdCd: '11740', district: '강동구 고덕동' },
  { name: '광장힐스테이트', lawdCd: '11215', district: '광진구 광장동' },
  { name: '센트라스', lawdCd: '11200', district: '성동구 하왕십리동' },
  { name: '롯데캐슬리버파크시그니처', lawdCd: '11215', district: '광진구 자양동' },
  { name: '목동힐스테이트', lawdCd: '11470', district: '양천구 신정동' },
  { name: 'e편한세상상도노빌리티', lawdCd: '11590', district: '동작구 상도동' },
  { name: '래미안위례', lawdCd: '11710', district: '송파구 장지동' },
  { name: '마곡엠밸리7단지', lawdCd: '11500', district: '강서구 마곡동' },
  { name: '보라매SK뷰', lawdCd: '11560', district: '영등포구 신길동' }
];

const periodOptions = [
  { value: 6, label: '최근 6개월' },
  { value: 12, label: '최근 1년' },
  { value: 24, label: '최근 2년' },
  { value: 36, label: '최근 3년' },
];

const getPeriodLabel = (months) => {
  if (months <= 6) return '6개월';
  if (months <= 12) return '1년';
  if (months <= 24) return '2년';
  return '3년';
};

const getLastNMonths = (n) => {
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

const formatPrice = (num) => {
  const valueInWon = num * 10000;
  const uk = Math.floor(valueInWon / 100000000);
  const man = Math.floor((valueInWon % 100000000) / 10000);
  
  let result = [];
  if (uk > 0) result.push(`${uk}억`);
  if (man > 0) result.push(`${new Intl.NumberFormat('ko-KR').format(man)}만`);
  
  if (result.length === 0) return `${new Intl.NumberFormat('ko-KR').format(Math.round(valueInWon))}원`;
  return result.join(' ') + '원';
};

export default function BlueChipTrends() {
  const [selectedApt, setSelectedApt] = useState(null);
  const [loading, setLoading] = useState(false);
  const [trendData, setTrendData] = useState(null);
  const [viewMode, setViewMode] = useState('table');
  const [period, setPeriod] = useState(6);

  const handlePeriodChange = (newPeriod) => {
    setPeriod(newPeriod);
    if (selectedApt) {
      fetchTrendData(selectedApt, newPeriod);
    }
  };

  const fetchTrendData = async (apt, monthCount = period) => {
    setSelectedApt(apt);
    setLoading(true);
    setTrendData(null);
    setViewMode('table');

    const months = getLastNMonths(monthCount);

    try {
      const fetchMonth = async (m) => {
        const res = await fetch(`/api/proxy?type=get_apartment_trades&LAWD_CD=${apt.lawdCd}&DEAL_YMD=${m}`);
        const data = await res.json();

        let items = [];
        if (data?.response?.body?.items?.item) {
          items = data.response.body.items.item;
          if (!Array.isArray(items)) items = [items];
        }

        const filtered = items.filter(i => {
           if(!i.aptNm) return false;
           const target = apt.name.replace(/\s/g, '');
           const actual = String(i.aptNm).replace(/\s/g, '');
           return actual.includes(target);
        });

        let max = 0, min = 0, avg = 0;
        if(filtered.length > 0) {
           const amounts = filtered.map(i => Number(String(i.dealAmount).replace(/,/g,''))).filter(i => i > 0);
           if(amounts.length > 0) {
              max = Math.max(...amounts);
              min = Math.min(...amounts);
              avg = amounts.reduce((a,b)=>a+b,0) / amounts.length;
           }
        }

        return {
          monthFormatted: `${m.substring(0, 4)}년 ${m.substring(4)}월`,
          tradesCount: filtered.length,
          max, min, avg,
          rawTrades: filtered
        };
      };

      // 5개씩 배치 호출 (API 속도 제한 대응)
      const batchSize = 5;
      const results = [];
      for (let i = 0; i < months.length; i += batchSize) {
        const batch = months.slice(i, i + batchSize);
        const batchResults = await Promise.all(batch.map(fetchMonth));
        results.push(...batchResults);
      }
      setTrendData(results);
    } catch (err) {
      console.error("Fetch trend error", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bluechip-container animate-fade-in">
      <div className="bluechip-header">
        <h2>🔥 서울 대장아파트 {getPeriodLabel(period)} 시세 트렌드</h2>
        <p>서울 주요 22개 대장 단지의 최신 실거래 변화를 추적합니다. 단지를 클릭해보세요.</p>
      </div>

      <div className="bc-period-selector">
        <label>조회 기간:</label>
        <select value={period} onChange={(e) => handlePeriodChange(Number(e.target.value))}>
          {periodOptions.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div className="bluechip-grid">
        {aptList.map((apt) => (
          <button 
            key={apt.name} 
            className={`bc-card ${selectedApt?.name === apt.name ? 'active' : ''}`}
            onClick={() => fetchTrendData(apt)}
          >
            <span className="bc-district">{apt.district}</span>
            <span className="bc-name">{apt.name}</span>
          </button>
        ))}
      </div>

      {loading && (
        <div className="loading-state" style={{ marginTop: '3rem' }}>
          <div className="spinner"></div>
          <p>국토교통부 실거래가 {getPeriodLabel(period)} 데이터를 조회중입니다...</p>
        </div>
      )}

      {trendData && selectedApt && !loading && (
        <div className="bc-trend-view animate-fade-in">
          <h3>{selectedApt.district} <strong>{selectedApt.name}</strong> 실거래 현황</h3>

          <div className="bc-view-toggle">
            <button
              className={`bc-toggle-btn ${viewMode === 'table' ? 'active' : ''}`}
              onClick={() => setViewMode('table')}
            >
              목록으로 보기
            </button>
            <button
              className={`bc-toggle-btn ${viewMode === 'chart' ? 'active' : ''}`}
              onClick={() => setViewMode('chart')}
            >
              차트로 보기
            </button>
          </div>

          {viewMode === 'table' ? (
            <div className="bc-trend-list">
              {trendData.map((data) => (
                <div className="bc-month-row" key={data.monthFormatted}>
                  <div className="bc-month">
                    {data.monthFormatted}
                    <span className="bc-count">({data.tradesCount}건)</span>
                  </div>
                  {data.tradesCount > 0 ? (
                    <div className="bc-stats">
                      <div className="bc-stat-item">
                        <label>최고가</label>
                        <span className="bc-val max">{formatPrice(data.max)}</span>
                      </div>
                      <div className="bc-stat-item">
                        <label>최저가</label>
                        <span className="bc-val">{formatPrice(data.min)}</span>
                      </div>
                      <div className="bc-stat-item">
                        <label>평균가</label>
                        <span className="bc-val avg">{formatPrice(data.avg)}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="bc-no-data">거래 내역 없음</div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="bc-chart-wrapper">
              {(() => {
                const chartData = [...trendData]
                  .reverse()
                  .filter(d => d.tradesCount > 0)
                  .map(d => ({
                    month: d.monthFormatted,
                    max: Math.round(d.max),
                    min: Math.round(d.min),
                    avg: Math.round(d.avg),
                  }));

                if (chartData.length === 0) {
                  return <div className="bc-no-data" style={{ textAlign: 'center', padding: '3rem' }}>거래 내역이 없어 차트를 표시할 수 없습니다.</div>;
                }

                const ChartTooltip = ({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div className="bc-chart-tooltip">
                      <p className="bc-tooltip-label">{label}</p>
                      {payload.map((entry) => (
                        <p key={entry.name} style={{ color: entry.color }}>
                          {entry.name}: {formatPrice(entry.value)}
                        </p>
                      ))}
                    </div>
                  );
                };

                const shortPrice = (v) => {
                  const uk = Math.floor((v * 10000) / 100000000);
                  const man = Math.floor(((v * 10000) % 100000000) / 10000);
                  if (uk > 0 && man > 0) return `${uk}억 ${Math.round(man / 1000) * 1000 > 0 ? (man / 10000).toFixed(1).replace(/\.0$/, '') + '천만' : ''}`;
                  if (uk > 0) return `${uk}억`;
                  return `${new Intl.NumberFormat('ko-KR').format(man)}만`;
                };

                return (
                  <ResponsiveContainer width="100%" height={380}>
                    <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis
                        dataKey="month"
                        tick={{ fill: '#94a3b8', fontSize: period > 12 ? 11 : 13, angle: period > 12 ? -45 : 0, textAnchor: period > 12 ? 'end' : 'middle' }}
                        axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                        tickLine={false}
                        interval={period > 24 ? 2 : period > 12 ? 1 : 0}
                        height={period > 12 ? 60 : 30}
                      />
                      <YAxis
                        tick={{ fill: '#94a3b8', fontSize: 12 }}
                        axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                        tickLine={false}
                        tickFormatter={(v) => shortPrice(v)}
                        width={90}
                        domain={['auto', 'auto']}
                      />
                      <Tooltip content={<ChartTooltip />} />
                      <Line
                        type="monotone" dataKey="max" name="최고가"
                        stroke="#f87171" strokeWidth={1.5} strokeOpacity={0.4}
                        dot={{ r: 6, fill: '#f87171', strokeWidth: 0 }}
                        activeDot={{ r: 8 }}
                      />
                      <Line
                        type="monotone" dataKey="min" name="최저가"
                        stroke="#94a3b8" strokeWidth={1.5} strokeOpacity={0.4}
                        dot={{ r: 6, fill: '#94a3b8', strokeWidth: 0 }}
                        activeDot={{ r: 8 }}
                      />
                      <Line
                        type="monotone" dataKey="avg" name="평균가"
                        stroke="#60a5fa" strokeWidth={1.5} strokeOpacity={0.4}
                        dot={{ r: 6, fill: '#60a5fa', strokeWidth: 0 }}
                        activeDot={{ r: 8 }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                );
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
