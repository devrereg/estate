'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { formatPrice } from '@/lib/utils';

const PredictionMap = dynamic(() => import('./components/PredictionMap'), { ssr: false });

export default function PredictPage() {
  const [status, setStatus] = useState(null);
  const [triggers, setTriggers] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [collecting, setCollecting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [collectMsg, setCollectMsg] = useState('');
  const [selectedRegion, setSelectedRegion] = useState(null);

  useEffect(() => {
    fetchStatus();
    fetchResults();
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/predict/status');
      const data = await res.json();
      setStatus(data);
    } catch (e) { console.error(e); }
  };

  const fetchResults = async () => {
    try {
      const res = await fetch('/api/predict/results');
      const data = await res.json();
      setTriggers(data.triggers || []);
      setPredictions(data.predictions || []);
    } catch (e) { console.error(e); }
  };

  const handleCollect = async (months = 6) => {
    setCollecting(true);
    setCollectMsg('데이터 수집 시작...');

    let jobId = null;
    let totalSuccess = 0;
    let totalFailed = 0;
    let prevRemaining = null;

    try {
      while (true) {
        const res = await fetch('/api/predict/collect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'FULL', months, jobId }),
        });
        const data = await res.json();

        if (data.error) {
          setCollectMsg('오류: ' + data.error);
          break;
        }

        jobId = data.jobId;
        totalSuccess += data.success || 0;
        totalFailed += data.failed || 0;

        const done = data.total - data.remaining;
        const pct = data.total > 0 ? Math.round((done / data.total) * 100) : 100;
        setCollectMsg(`${done}/${data.total} (${pct}%) — ${data.message}`);

        fetchStatus();

        if (data.status === 'COMPLETED') {
          setCollectMsg(`수집 완료! 누적 성공 ${totalSuccess}건, 실패 ${totalFailed}건`);
          break;
        }
        if (data.processedThisCall === 0) {
          setCollectMsg('진행 없음 — 중단');
          break;
        }
        // 모든 task가 실패만 한 청크: remaining이 줄지 않으면 외부 API 영구 오류로 간주하고 중단
        if (prevRemaining !== null && data.remaining >= prevRemaining) {
          setCollectMsg(`진전 없음 — 중단 (외부 API 오류 가능, 실패 누적 ${totalFailed}건)`);
          break;
        }
        prevRemaining = data.remaining;
      }
    } catch (e) {
      setCollectMsg('오류: ' + e.message);
    } finally {
      setCollecting(false);
      fetchStatus();
    }
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      const res = await fetch('/api/predict/score');
      const data = await res.json();
      setTriggers(data.triggers || []);
      setPredictions(data.predictions || []);
      fetchStatus();
    } catch (e) {
      console.error(e);
    } finally {
      setAnalyzing(false);
    }
  };

  const scoreColor = (score) => {
    if (score >= 70) return '#ef4444';
    if (score >= 50) return '#f59e0b';
    if (score >= 30) return '#3b82f6';
    return '#94a3b8';
  };

  const scoreBar = (value, max) => (
    <div className="predict-score-bar">
      <div className="predict-score-fill" style={{ width: `${(value / max) * 100}%` }} />
      <span>{value.toFixed(0)}/{max}</span>
    </div>
  );

  return (
    <div className="app-container">
      <main className="content" style={{ width: '100%', maxWidth: '1200px', margin: '0 auto' }}>
        <div className="predict-container animate-fade-in">
          {/* 헤더 */}
          <div className="bluechip-header">
            <h2>📈 Next-Step 다음 상승지 예측</h2>
            <p>대장아파트 상승 신호를 감지하고, 수요 이동 경로를 분석하여 다음 상승 지역을 예측합니다.</p>
          </div>

          {/* 컨트롤 패널 */}
          <div className="predict-controls glass-panel">
            <div className="predict-controls-row">
              <div className="predict-btn-group">
                <button
                  className="btn-primary"
                  onClick={() => handleCollect(6)}
                  disabled={collecting}
                >
                  {collecting ? '수집 중...' : '데이터 수집 (6개월)'}
                </button>
                <button
                  className="btn-primary"
                  onClick={() => handleCollect(36)}
                  disabled={collecting}
                >
                  {collecting ? '수집 중...' : '데이터 수집 (3년)'}
                </button>
                <button
                  className="btn-primary predict-btn-analyze"
                  onClick={handleAnalyze}
                  disabled={analyzing || !status?.counts?.tradeCount}
                >
                  {analyzing ? '분석 중...' : '분석 실행'}
                </button>
              </div>
              <div className="predict-status-info">
                {status && (
                  <>
                    <span>매매 {(status.counts?.tradeCount || 0).toLocaleString()}건</span>
                    <span>전월세 {(status.counts?.rentCount || 0).toLocaleString()}건</span>
                    <span>통계 {(status.counts?.statCount || 0).toLocaleString()}건</span>
                    {status.latestJob && (
                      <span className={`predict-job-status ${status.latestJob.status.toLowerCase()}`}>
                        {status.latestJob.status}
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
            {collectMsg && <p className="predict-msg">{collectMsg}</p>}
          </div>

          {/* Phase 1: 트리거 */}
          {triggers.length > 0 && (
            <div className="predict-section glass-panel animate-fade-in">
              <h3>🔔 상승 신호 감지</h3>
              <div className="predict-trigger-grid">
                {triggers.map((t, i) => (
                  <div key={i} className="predict-trigger-card">
                    <div className="predict-trigger-region">{t.region?.fullLabel || t.regionId}</div>
                    <div className="predict-trigger-apt">{t.apartment?.name || ''}</div>
                    <div className="predict-trigger-signal">
                      {t.triggerType === 'ATH_90'
                        ? `전고점 ${(t.triggerValue * 100).toFixed(0)}% 도달`
                        : `+${(t.triggerValue * 100).toFixed(1)}% 상승`}
                    </div>
                    <div className="predict-trigger-price">
                      {formatPrice(t.currentPrice)} <span className="predict-trigger-ref">← {formatPrice(t.referencePrice)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 지도 시각화 */}
          {(predictions.length > 0 || triggers.length > 0) && (
            <div className="predict-section glass-panel animate-fade-in">
              <h3>🗺️ 예측 지도</h3>
              <PredictionMap predictions={predictions} triggers={triggers} />
            </div>
          )}

          {/* Phase 3: 예측 순위 */}
          {predictions.length > 0 && (
            <div className="predict-section glass-panel animate-fade-in">
              <h3>📊 예측 상승지 순위</h3>
              <div className="table-responsive">
                <table className="data-table predict-table">
                  <thead>
                    <tr>
                      <th>순위</th>
                      <th>지역</th>
                      <th>트리거</th>
                      <th>총점</th>
                      <th>전세가율</th>
                      <th>거래량</th>
                      <th>인접성</th>
                      <th>가격차</th>
                    </tr>
                  </thead>
                  <tbody>
                    {predictions.map((p, i) => (
                      <tr
                        key={i}
                        className={`predict-row ${selectedRegion === p.regionId ? 'active' : ''}`}
                        onClick={() => setSelectedRegion(selectedRegion === p.regionId ? null : p.regionId)}
                      >
                        <td className="predict-rank" style={{ color: scoreColor(p.totalScore) }}>
                          {i + 1}
                        </td>
                        <td className="predict-region-name">{p.region?.fullLabel || p.regionId}</td>
                        <td className="predict-trigger-from">{p.triggerRegion?.name || p.triggerRegionId}</td>
                        <td>
                          <span className="predict-total-score" style={{ color: scoreColor(p.totalScore) }}>
                            {p.totalScore.toFixed(1)}
                          </span>
                        </td>
                        <td>{scoreBar(p.leaseScore, 30)}</td>
                        <td>{scoreBar(p.volumeScore, 30)}</td>
                        <td>{scoreBar(p.proximityScore, 20)}</td>
                        <td>{scoreBar(p.priceGapScore, 20)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Phase 2: 수요 이동 흐름 */}
          {predictions.length > 0 && (
            <div className="predict-section glass-panel animate-fade-in">
              <h3>🔄 수요 이동 흐름</h3>
              <div className="predict-flow-container">
                {[...new Set(predictions.map(p => p.triggerRegionId))].map(trigId => {
                  const trigRegion = predictions.find(p => p.triggerRegionId === trigId)?.triggerRegion;
                  const targets = predictions
                    .filter(p => p.triggerRegionId === trigId)
                    .slice(0, 5);
                  return (
                    <div key={trigId} className="predict-flow-group">
                      <div className="predict-flow-trigger">{trigRegion?.fullLabel || trigId}</div>
                      <div className="predict-flow-arrows">
                        {targets.map((t, i) => (
                          <div key={i} className="predict-flow-target">
                            <span className="predict-flow-arrow">→</span>
                            <span className="predict-flow-name">{t.region?.name || t.regionId}</span>
                            <span className="predict-flow-score" style={{ color: scoreColor(t.totalScore) }}>
                              ({t.totalScore.toFixed(1)}점)
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 빈 상태 */}
          {triggers.length === 0 && predictions.length === 0 && !collecting && !analyzing && (
            <div className="predict-empty glass-panel">
              <p>데이터를 수집한 후 "분석 실행" 버튼을 눌러주세요.</p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                1. "데이터 수집" → 공공데이터 API에서 실거래 데이터를 DB에 저장합니다<br/>
                2. "분석 실행" → 트리거 감지 → 수요 이동 매핑 → 스코어링 파이프라인을 실행합니다
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
