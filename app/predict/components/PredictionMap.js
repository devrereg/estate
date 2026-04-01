'use client';

import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, GeoJSON, CircleMarker, Polyline, Popup, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { REGION_COORDS } from '@/lib/constants/regionCoordinates';

const SEOUL_CENTER = [37.5665, 126.9780];
const DEFAULT_ZOOM = 11;

function scoreColor(score) {
  if (score >= 70) return '#ef4444';
  if (score >= 50) return '#f59e0b';
  if (score >= 30) return '#3b82f6';
  return '#64748b';
}

function scoreToFillColor(score) {
  if (score >= 70) return '#ef4444';
  if (score >= 50) return '#f59e0b';
  if (score >= 30) return '#3b82f6';
  if (score > 0) return '#475569';
  return 'transparent';
}

// 화살표 중간점 계산 (곡선 효과)
function getMidPoint(from, to, offset = 0.008) {
  const mid = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
  const dx = to[1] - from[1];
  const dy = to[0] - from[0];
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return mid;
  return [mid[0] + (dx / len) * offset, mid[1] - (dy / len) * offset];
}

function FlowArrows({ predictions, triggers }) {
  const lines = [];
  const triggerRegionIds = new Set(triggers.map(t => t.regionId));

  for (const p of predictions) {
    const fromCoords = REGION_COORDS[p.triggerRegionId];
    const toCoords = REGION_COORDS[p.regionId];
    if (!fromCoords || !toCoords) continue;

    const mid = getMidPoint(fromCoords, toCoords);
    lines.push({
      positions: [fromCoords, mid, toCoords],
      color: scoreColor(p.totalScore),
      weight: Math.max(1.5, p.totalScore / 20),
      opacity: Math.min(0.8, 0.3 + p.totalScore / 100),
      regionName: p.region?.fullLabel || p.regionId,
      score: p.totalScore,
    });
  }

  return lines.map((line, i) => (
    <Polyline
      key={i}
      positions={line.positions}
      pathOptions={{
        color: line.color,
        weight: line.weight,
        opacity: line.opacity,
        dashArray: '6 4',
      }}
    >
      <Tooltip sticky>{line.regionName}: {line.score.toFixed(1)}점</Tooltip>
    </Polyline>
  ));
}

function RegionMarkers({ predictions, triggers }) {
  const markers = [];

  // 예측 대상 지역 마커
  const predByRegion = {};
  for (const p of predictions) {
    if (!predByRegion[p.regionId] || p.totalScore > predByRegion[p.regionId].totalScore) {
      predByRegion[p.regionId] = p;
    }
  }

  for (const p of Object.values(predByRegion)) {
    const coords = REGION_COORDS[p.regionId];
    if (!coords) continue;
    markers.push(
      <CircleMarker
        key={`pred-${p.regionId}`}
        center={coords}
        radius={Math.max(8, p.totalScore / 5)}
        pathOptions={{
          color: scoreColor(p.totalScore),
          fillColor: scoreColor(p.totalScore),
          fillOpacity: 0.8,
          weight: 2,
        }}
      >
        <Tooltip direction="top" offset={[0, -8]} permanent={p.totalScore >= 50}>
          <span style={{ fontWeight: 600 }}>{p.region?.name || p.regionId}</span>
          <br />{p.totalScore.toFixed(1)}점
        </Tooltip>
        <Popup>
          <div style={{ fontSize: '13px', lineHeight: 1.6 }}>
            <strong>{p.region?.fullLabel}</strong>
            <br />총점: <strong style={{ color: scoreColor(p.totalScore) }}>{p.totalScore.toFixed(1)}점</strong>
            <br />← {p.triggerRegion?.fullLabel || p.triggerRegionId}
            <hr style={{ margin: '4px 0', opacity: 0.3 }} />
            전세가율: {p.leaseScore.toFixed(1)}/30
            <br />거래량: {p.volumeScore.toFixed(1)}/30
            <br />인접성: {p.proximityScore.toFixed(1)}/20
            <br />가격차: {p.priceGapScore.toFixed(1)}/20
          </div>
        </Popup>
      </CircleMarker>
    );
  }

  // 트리거 지역 마커 (별 모양 강조)
  const triggerSet = new Set();
  for (const t of triggers) {
    if (triggerSet.has(t.regionId)) continue;
    triggerSet.add(t.regionId);
    const coords = REGION_COORDS[t.regionId];
    if (!coords) continue;
    markers.push(
      <CircleMarker
        key={`trig-${t.regionId}`}
        center={coords}
        radius={12}
        pathOptions={{
          color: '#ef4444',
          fillColor: '#ef4444',
          fillOpacity: 0.3,
          weight: 3,
          dashArray: '4 2',
        }}
      >
        <Tooltip direction="top" offset={[0, -12]}>
          🔔 {t.region?.fullLabel || t.regionId}
        </Tooltip>
      </CircleMarker>
    );
  }

  return markers;
}

export default function PredictionMap({ predictions = [], triggers = [] }) {
  const [geoData, setGeoData] = useState(null);

  useEffect(() => {
    fetch('/data/seoul-gu.geojson')
      .then(res => res.json())
      .then(setGeoData)
      .catch(console.error);
  }, []);

  // 지역별 최고 점수 매핑
  const scoreByRegion = {};
  for (const p of predictions) {
    if (!scoreByRegion[p.regionId] || p.totalScore > scoreByRegion[p.regionId]) {
      scoreByRegion[p.regionId] = p.totalScore;
    }
  }
  const triggerRegionIds = new Set(triggers.map(t => t.regionId));

  const geoStyle = (feature) => {
    const lawdCd = feature.properties.LAWD_CD;
    const score = scoreByRegion[lawdCd] || 0;
    const isTrigger = triggerRegionIds.has(lawdCd);

    return {
      fillColor: isTrigger ? '#ef4444' : scoreToFillColor(score),
      fillOpacity: isTrigger ? 0.25 : (score > 0 ? Math.min(0.5, 0.15 + score / 150) : 0.05),
      color: isTrigger ? '#ef4444' : (score > 0 ? scoreColor(score) : 'rgba(255,255,255,0.15)'),
      weight: isTrigger ? 2 : (score > 0 ? 1.5 : 0.5),
    };
  };

  const onEachFeature = (feature, layer) => {
    const lawdCd = feature.properties.LAWD_CD;
    const name = feature.properties.name;
    const score = scoreByRegion[lawdCd];
    const isTrigger = triggerRegionIds.has(lawdCd);

    let label = name;
    if (isTrigger) label += ' 🔔';
    if (score) label += ` (${score.toFixed(1)}점)`;

    layer.bindTooltip(label, { sticky: true, className: 'map-tooltip-dark' });
  };

  const hasData = predictions.length > 0 || triggers.length > 0;

  return (
    <div className="predict-map-container">
      <MapContainer
        center={SEOUL_CENTER}
        zoom={DEFAULT_ZOOM}
        style={{ height: '500px', width: '100%', borderRadius: '12px' }}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        />
        {geoData && (
          <GeoJSON
            key={JSON.stringify(scoreByRegion)}
            data={geoData}
            style={geoStyle}
            onEachFeature={onEachFeature}
          />
        )}
        {hasData && (
          <>
            <FlowArrows predictions={predictions.slice(0, 15)} triggers={triggers} />
            <RegionMarkers predictions={predictions} triggers={triggers} />
          </>
        )}
      </MapContainer>
      {hasData && (
        <div className="predict-map-legend">
          <span><i style={{ background: '#ef4444' }} /> 트리거 / 고위험 (70+)</span>
          <span><i style={{ background: '#f59e0b' }} /> 주의 (50~70)</span>
          <span><i style={{ background: '#3b82f6' }} /> 관심 (30~50)</span>
          <span><i style={{ background: '#64748b' }} /> 낮음 (&lt;30)</span>
          <div className="predict-help-wrap">
            <span className="predict-help-icon">?</span>
            <div className="predict-help-tooltip">
              <strong>등급 기준 (100점 만점)</strong>
              <p><i style={{ background: '#ef4444' }} /> <b>트리거/고위험 (70+)</b>: 대장아파트 상승 신호 발생 지역이거나 수요 전이 가능성이 매우 높은 후보</p>
              <p><i style={{ background: '#f59e0b' }} /> <b>주의 (50~70)</b>: 4개 지표 중 2~3개가 강하게 작용. 모니터링 필요</p>
              <p><i style={{ background: '#3b82f6' }} /> <b>관심 (30~50)</b>: 수요 전이 징후 일부 보임. 특정 지표만 높거나 2차 인접 지역</p>
              <p><i style={{ background: '#64748b' }} /> <b>낮음 (&lt;30)</b>: 현재 수요 전이 가능성 낮음</p>
              <hr />
              <strong>점수 구성 (4개 지표)</strong>
              <p>전세가율 (30점): 전세/매매 비율 60~70%↑ = 매매 전환 수요 신호</p>
              <p>거래량 (30점): 최근 3개월이 3년 평균의 1.5~2배↑ = 수요 폭발</p>
              <p>인접성 (20점): 트리거 지역과 직접 인접=20점, 2차 인접=10점</p>
              <p>가격차 (20점): 트리거 대비 40%+ 저평가 = 갭메우기 상승 여력</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
