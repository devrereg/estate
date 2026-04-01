// 서버사이드 API 호출 클라이언트 (proxy route.js 로직 추출)
import { XMLParser } from 'fast-xml-parser';

const API_ENDPOINTS = {
  get_apartment_trades: "https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade",
  get_apartment_rent: "https://apis.data.go.kr/1613000/RTMSDataSvcAptRent/getRTMSDataSvcAptRent",
};

export async function fetchFromDataGoKr(type, params = {}) {
  const serviceKey = process.env.DATA_GO_KR_API_KEY;
  const endpoint = API_ENDPOINTS[type];
  if (!endpoint) throw new Error(`Unknown API type: ${type}`);

  let url = `${endpoint}?serviceKey=${encodeURIComponent(serviceKey)}`;
  for (const [k, v] of Object.entries(params)) {
    url += `&${k}=${encodeURIComponent(v)}`;
  }
  if (!url.includes('numOfRows')) url += '&numOfRows=9999';
  if (!url.includes('pageNo')) url += '&pageNo=1';

  const response = await fetch(url);
  const text = await response.text();

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    const parser = new XMLParser();
    data = parser.parse(text);
  }
  return data;
}

// 매매 실거래 데이터를 파싱하여 [{aptName, dealAmount, excArea, floor, dealDay, buildYear}] 반환
export function parseTradeItems(apiData) {
  let items = [];
  if (apiData?.response?.body?.items?.item) {
    items = apiData.response.body.items.item;
    if (!Array.isArray(items)) items = [items];
  }
  return items.map(i => ({
    aptName: String(i.aptNm || '').trim(),
    dealAmount: Number(String(i.dealAmount || '0').replace(/,/g, '')),
    excArea: parseFloat(i.excluUseAr) || 0,
    floor: parseInt(i.floor) || null,
    dealDay: parseInt(i.dealDay) || null,
    buildYear: parseInt(i.buildYear) || null,
  })).filter(i => i.aptName && i.dealAmount > 0);
}

// 전월세 실거래 데이터를 파싱
export function parseRentItems(apiData) {
  let items = [];
  if (apiData?.response?.body?.items?.item) {
    items = apiData.response.body.items.item;
    if (!Array.isArray(items)) items = [items];
  }
  return items.map(i => ({
    aptName: String(i.aptNm || '').trim(),
    deposit: Number(String(i.deposit || '0').replace(/,/g, '')),
    monthlyRent: Number(String(i.monthlyRent || '0').replace(/,/g, '')),
    excArea: parseFloat(i.excluUseAr) || 0,
    floor: parseInt(i.floor) || null,
    dealDay: parseInt(i.dealDay) || null,
    rentType: Number(String(i.monthlyRent || '0').replace(/,/g, '')) > 0 ? '월세' : '전세',
  })).filter(i => i.aptName && i.deposit > 0);
}
