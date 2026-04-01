"use client";

import { useState, useEffect, useRef } from 'react';
import { apiCategories } from '@/lib/apiList';

const regionCodes = [
  { value: "11110", label: "서울 종로구" },
  { value: "11140", label: "서울 중구" },
  { value: "11170", label: "서울 용산구" },
  { value: "11200", label: "서울 성동구" },
  { value: "11215", label: "서울 광진구" },
  { value: "11230", label: "서울 동대문구" },
  { value: "11260", label: "서울 중랑구" },
  { value: "11290", label: "서울 성북구" },
  { value: "11305", label: "서울 강북구" },
  { value: "11320", label: "서울 도봉구" },
  { value: "11350", label: "서울 노원구" },
  { value: "11380", label: "서울 은평구" },
  { value: "11410", label: "서울 서대문구" },
  { value: "11440", label: "서울 마포구" },
  { value: "11470", label: "서울 양천구" },
  { value: "11500", label: "서울 강서구" },
  { value: "11530", label: "서울 구로구" },
  { value: "11545", label: "서울 금천구" },
  { value: "11560", label: "서울 영등포구" },
  { value: "11590", label: "서울 동작구" },
  { value: "11620", label: "서울 관악구" },
  { value: "11650", label: "서울 서초구" },
  { value: "11680", label: "서울 강남구" },
  { value: "11710", label: "서울 송파구" },
  { value: "11740", label: "서울 강동구" },
  { value: "26110", label: "부산 중구" },
  { value: "26350", label: "부산 해운대구" },
  { value: "27110", label: "대구 중구" },
  { value: "27260", label: "대구 수성구" },
  { value: "28110", label: "인천 중구" },
  { value: "28185", label: "인천 연수구" },
  { value: "29110", label: "광주 동구" },
  { value: "30110", label: "대전 동구" },
  { value: "30170", label: "대전 서구" },
  { value: "30200", label: "대전 유성구" },
  { value: "31110", label: "울산 중구" },
  { value: "31140", label: "울산 남구" },
  { value: "36110", label: "세종특별자치시" },
  { value: "41111", label: "경기 수원장안구" },
  { value: "41135", label: "경기 성남분당구" },
  { value: "41460", label: "경기 용인시" },
  { value: "42110", label: "강원 춘천시" },
  { value: "43111", label: "충북 청주상당구" },
  { value: "44131", label: "충남 천안동남구" },
  { value: "45111", label: "전북 전주완산구" },
  { value: "46110", label: "전남 목포시" },
  { value: "47111", label: "경북 포항남구" },
  { value: "48121", label: "경남 창원의창구" },
  { value: "50110", label: "제주 제주시" },
];

export default function Home() {
  const [selectedApi, setSelectedApi] = useState(null);
  const [params, setParams] = useState({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const handleApiSelect = (api) => {
    setSelectedApi(api);
    const initialParams = {};
    api.params.forEach(p => {
      initialParams[p.name] = p.default || '';
    });
    setParams(initialParams);
    setResult(null);
    setError(null);
    setCurrentPage(1);
    setTotalCount(0);
  };

  const handleParamChange = (name, value) => {
    setParams(prev => ({ ...prev, [name]: value }));
  };

  const handleMultiSelectToggle = (name, value) => {
    setParams(prev => {
      const current = Array.isArray(prev[name]) ? prev[name] : [];
      const next = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value];
      return { ...prev, [name]: next };
    });
  };

  const [openMultiSelect, setOpenMultiSelect] = useState(null);
  const multiSelectRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (multiSelectRef.current && !multiSelectRef.current.contains(e.target)) {
        setOpenMultiSelect(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCallApi = async (page = 1) => {
    setLoading(true);
    setError(null);
    setCurrentPage(page);

    try {
      const q = new URLSearchParams();
      q.append('type', selectedApi.id);

      const isOdcloud = selectedApi.id.includes('apt_lttot') || selectedApi.id.includes('urbty_ofctl') || selectedApi.id.includes('remndr_lttot');
      
      for (const [k, v] of Object.entries(params)) {
        if (Array.isArray(v)) {
          if (v.length === 1) q.append(k, v[0]);
          // 복수 선택 시 서버 필터 생략 → 클라이언트에서 필터링
        } else if (v) {
          q.append(k, v);
        }
      }
      
      // Common pagination
      if (isOdcloud) {
        q.set('page', page);
        q.set('perPage', rowsPerPage);
      } else {
        q.set('pageNo', page);
        q.set('numOfRows', rowsPerPage);
      }
      
      const res = await fetch(`/api/proxy?${q.toString()}`);
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'API Request Failed');
      }
      
      setResult(data);

      let tc = 0;
      if (data?.response?.body?.totalCount !== undefined) {
         tc = parseInt(data.response.body.totalCount, 10);
      } else if (data?.totalCount !== undefined) {
         tc = parseInt(data.totalCount, 10);
      }
      setTotalCount(tc);
      
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderSummaryCards = (items) => {
    if (!items || items.length === 0) return null;

    const parseNum = (str) => {
      if (!str) return 0;
      if (typeof str === 'number') return str;
      return Number(str.replace(/,/g, '').trim());
    };

    const formatPrice = (num, isManwonUnit = true) => {
      const valueInWon = isManwonUnit ? num * 10000 : num;
      const uk = Math.floor(valueInWon / 100000000);
      const man = Math.floor((valueInWon % 100000000) / 10000);
      
      let result = [];
      if (uk > 0) result.push(`${uk}억`);
      if (man > 0) result.push(`${new Intl.NumberFormat('ko-KR').format(man)}만`);
      
      if (result.length === 0) return `${new Intl.NumberFormat('ko-KR').format(Math.round(valueInWon))}원`;
      return result.join(' ') + '원';
    };

    let summary = {
      "총 조회 건수": items.length + "건"
    };

    const hasDealAmount = items.some(i => i.dealAmount !== undefined);
    const hasDeposit = items.some(i => i.deposit !== undefined);
    const hasApprAmt = items.some(i => i.APPR_AMT !== undefined);

    if (hasDealAmount) {
      const amounts = items.map(i => parseNum(i.dealAmount)).filter(i => i > 0);
      if (amounts.length > 0) {
        summary['최고 거래가'] = formatPrice(Math.max(...amounts), true);
        summary['최저 거래가'] = formatPrice(Math.min(...amounts), true);
        summary['평균 거래가'] = formatPrice(amounts.reduce((a,b)=>a+b,0)/amounts.length, true);
      }
    } else if (hasDeposit) {
      const deposits = items.map(i => parseNum(i.deposit)).filter(i => i > 0);
      if (deposits.length > 0) {
        summary['최고 보증금'] = formatPrice(Math.max(...deposits), true);
        summary['평균 보증금'] = formatPrice(deposits.reduce((a,b)=>a+b,0)/deposits.length, true);
      }
    } else if (hasApprAmt) {
      const apprs = items.map(i => parseNum(i.APPR_AMT)).filter(i => i > 0);
      if (apprs.length > 0) {
        summary['최고 감정가'] = formatPrice(Math.max(...apprs), false);
        summary['평균 감정가'] = formatPrice(apprs.reduce((a,b)=>a+b,0)/apprs.length, false);
      }
    }

    return (
      <div className="summary-cards">
        {Object.entries(summary).map(([key, val]) => (
          <div className="summary-card animate-fade-in" key={key}>
            <h4>{key}</h4>
            <p>{val}</p>
          </div>
        ))}
      </div>
    );
  };

  const renderPagination = () => {
    if (!result || totalCount <= 0) return null;
    const totalPages = Math.ceil(totalCount / rowsPerPage);
    if (totalPages <= 1) return null;

    let pages = [];
    const maxPagesToShow = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);

    if (endPage - startPage + 1 < maxPagesToShow) {
      startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(
        <button 
          key={i} 
          className={`page-btn ${currentPage === i ? 'active' : ''}`}
          onClick={() => handleCallApi(i)}
        >
          {i}
        </button>
      );
    }

    return (
      <div className="pagination">
        <button 
          className="page-btn nav-btn" 
          onClick={() => handleCallApi(1)} 
          disabled={currentPage === 1}
        >
          «
        </button>
        <button 
          className="page-btn nav-btn" 
          onClick={() => handleCallApi(currentPage - 1)} 
          disabled={currentPage === 1}
        >
          ‹
        </button>
        {pages}
        <button 
          className="page-btn nav-btn" 
          onClick={() => handleCallApi(currentPage + 1)} 
          disabled={currentPage === totalPages}
        >
          ›
        </button>
        <button 
          className="page-btn nav-btn" 
          onClick={() => handleCallApi(totalPages)} 
          disabled={currentPage === totalPages}
        >
          »
        </button>
        <span className="page-info">
          {currentPage} / {totalPages} (총 {totalCount}건)
        </span>
      </div>
    );
  };

  const renderDataDisplay = (result) => {
    let rawItems = [];
    if (result?.response?.body?.items?.item) {
      rawItems = result.response.body.items.item;
      if (!Array.isArray(rawItems)) rawItems = [rawItems];
    } else if (result?.data) {
      rawItems = result.data;
      if (!Array.isArray(rawItems)) rawItems = [rawItems];
    } else if (result?.response?.body?.items) {
      rawItems = result.response.body.items;
      if (!Array.isArray(rawItems)) rawItems = [rawItems];
    }

    const items = rawItems.map(item => {
      let processed = { ...item };
      // Combine dealYear, dealMonth, dealDay
      if (processed.dealYear && processed.dealMonth) {
        const y = String(processed.dealYear).trim();
        const m = String(processed.dealMonth).trim().padStart(2, '0');
        const d = processed.dealDay ? String(processed.dealDay).trim().padStart(2, '0') : '';
        processed.dealDate = d ? `${y}-${m}-${d}` : `${y}-${m}`;
        delete processed.dealYear;
        delete processed.dealMonth;
        delete processed.dealDay;
      }
      return processed;
    });

    // 멀티셀렉트 클라이언트 필터링
    const multiSelectFilters = selectedApi?.params?.filter(p => p.type === 'multiSelect') || [];
    const fieldNameMap = {
      'cond[SUBSCRPT_AREA_CODE_NM::EQ]': 'SUBSCRPT_AREA_CODE_NM'
    };
    let filteredItems = items;
    for (const f of multiSelectFilters) {
      const selected = params[f.name];
      if (Array.isArray(selected) && selected.length > 1) {
        const fieldKey = fieldNameMap[f.name];
        if (fieldKey) {
          filteredItems = filteredItems.filter(item => selected.includes(item[fieldKey]));
        }
      }
    }

    // 모집공고일 최신순 정렬
    if (filteredItems.some(item => item.RCRIT_PBLANC_DE)) {
      filteredItems.sort((a, b) => (b.RCRIT_PBLANC_DE || '').localeCompare(a.RCRIT_PBLANC_DE || ''));
    }

    if (filteredItems.length > 0) {
      const allKeys = Array.from(new Set(filteredItems.flatMap(item => Object.keys(item || {}))));

      const headerMap = {
        dealDate: "계약일자",
        aptNm: "아파트명", offiNm: "오피스텔명", mhouseNm: "단지명",
        buildYear: "건축년도", dealYear: "계약년도", dealMonth: "계약월", dealDay: "계약일",
        excluUseAr: "전용면적(㎡)", dealAmount: "거래금액(만원)", deposit: "보증금(만원)",
        monthlyRent: "월세(만원)", floor: "층", dong: "동", aptDong: "동", jibun: "지번",
        cdealDay: "계약해제일", cdealType: "계약해제여부", dealingGbn: "거래유형",
        landLeaseholdGbn: "토지임대부구분", slerGbn: "매도자",
        sggCd: "시군구코드", umdNm: "법정동명", buyerGbn: "매수자", sellerGbn: "매도자",
        estateAgentSggNm: "중개사소재지", rgstDate: "등기일자", cxlYmd: "해제사유발생일",
        reqstPdcd: "접수기간", houseTy: "주택유형", houseManageNo: "주택관리번호",
        pblancNo: "공고번호", rcritPblancDe: "모집공고일", przwnerPresnatnDe: "당첨자발표일",
        subscrptAreaCodeNm: "공급지역", competRate: "경쟁률", PBCT_NO: "공고번호",
        PBCT_BEGN_DTM: "공고시작일시", PBCT_CLS_DTM: "공고종료일시",
        PLNM_NO: "물건번호", PBCT_CLTR_STAT_NM: "물건상태",
        DPSL_MTD_NM: "처분방식", BID_MTD_NM: "입찰방식",
        MIN_BID_PRC: "최저입찰가", APPR_AMT: "감정가",
        CLTR_MNMT_NO: "물건관리번호", CLTR_NM: "물건명",
        LCTN_NM: "소재지", USES_NM: "용도명",
        USFR_STAT_NM: "이용상태", GOOD_NM: "재산종류",
        ORG_NM: "기관명", DEPT_NM: "부서명",
        // 청약홈 APT 분양정보
        HOUSE_NM: "주택명", HOUSE_SECD_NM: "주택구분", HOUSE_DTL_SECD_NM: "주택상세구분",
        HOUSE_MANAGE_NO: "주택관리번호", PBLANC_NO: "공고번호",
        BSNS_MBY_NM: "사업주체명", CNSTRCT_ENTRPS_NM: "시공사",
        HSSPLY_ADRES: "공급위치", HSSPLY_ZIP: "우편번호",
        SUBSCRPT_AREA_CODE_NM: "공급지역", SUBSCRPT_AREA_CODE: "공급지역코드",
        TOT_SUPLY_HSHLDCO: "총공급세대수",
        RCRIT_PBLANC_DE: "모집공고일", RCEPT_BGNDE: "접수시작일", RCEPT_ENDDE: "접수종료일",
        SPSPLY_RCEPT_BGNDE: "특별공급접수시작일", SPSPLY_RCEPT_ENDDE: "특별공급접수종료일",
        GNRL_RNK1_CRSPAREA_RCPTDE: "1순위해당지역접수일", GNRL_RNK1_CRSPAREA_ENDDE: "1순위해당지역마감일",
        GNRL_RNK1_ETC_AREA_RCPTDE: "1순위기타지역접수일", GNRL_RNK1_ETC_AREA_ENDDE: "1순위기타지역마감일",
        GNRL_RNK1_ETC_GG_RCPTDE: "1순위기타경기접수일", GNRL_RNK1_ETC_GG_ENDDE: "1순위기타경기마감일",
        GNRL_RNK2_CRSPAREA_RCPTDE: "2순위해당지역접수일", GNRL_RNK2_CRSPAREA_ENDDE: "2순위해당지역마감일",
        GNRL_RNK2_ETC_AREA_RCPTDE: "2순위기타지역접수일", GNRL_RNK2_ETC_AREA_ENDDE: "2순위기타지역마감일",
        GNRL_RNK2_ETC_GG_RCPTDE: "2순위기타경기접수일", GNRL_RNK2_ETC_GG_ENDDE: "2순위기타경기마감일",
        PRZWNER_PRESNATN_DE: "당첨자발표일",
        CNTRCT_CNCLS_BGNDE: "계약시작일", CNTRCT_CNCLS_ENDDE: "계약종료일",
        MVN_PREARNGE_YM: "입주예정월",
        HMPG_ADRES: "홈페이지", PBLANC_URL: "분양정보",
        MDHS_TELNO: "문의처전화번호", NSPRC_NM: "공고매체",
        RENT_SECD_NM: "분양구분", RENT_SECD: "분양구분코드",
        HOUSE_SECD: "주택구분코드", HOUSE_DTL_SECD: "주택상세구분코드",
        SPECLT_RDN_EARTH_AT: "투기과열지구", MDAT_TRGET_AREA_SECD: "조정대상지역",
        LRSCL_BLDLND_AT: "대규모택지개발", PARCPRC_ULS_AT: "분양가상한제",
        IMPRMN_BSNS_AT: "정비사업", PUBLIC_HOUSE_EARTH_AT: "공공택지",
        PUBLIC_HOUSE_SPCLW_APPLC_AT: "공공주택특별법적용",
        NPLN_PRVOPR_PUBLIC_HOUSE_AT: "비규제공공주택",
        // 청약홈 주택형별
        SUPLY_AR: "공급면적(㎡)", SUPLY_HSHLDCO: "공급세대수",
        GP_SPSPLY_HSHLDCO: "일반공급특별공급세대수",
        LTTOT_TOP_AMOUNT: "분양최고금액(만원)",
        EXCLUSE_AR: "전용면적(㎡)", MDL_NM: "주택형"
      };

      const getHeaderName = (key) => headerMap[key] || key;

      // 청약 분양정보 커스텀 테이블
      const isChungyak = filteredItems.some(item => item.HOUSE_NM && item.RCRIT_PBLANC_DE);
      if (isChungyak) {
        // 병합 컬럼 정의: { header, fields: [start, end] }
        const mergedColumns = [
          { key: '_SUBSCRPT_AREA', header: '공급지역', render: (item) => item.SUBSCRPT_AREA_CODE_NM || '' },
          { key: '_HOUSE_NM_SUPPLY', header: '주택명(세대수)', render: (item) => {
            const name = item.HOUSE_NM || '';
            const cnt = item.TOT_SUPLY_HSHLDCO;
            return cnt ? `${name} (${cnt}세대)` : name;
          }},
          { key: '_RCEPT_PERIOD', header: '접수기간', render: (item) => {
            const b = item.RCEPT_BGNDE || '';
            const e = item.RCEPT_ENDDE || '';
            return (b || e) ? `${b} ~ ${e}` : '';
          }},
          { key: '_PRZWNER', header: '당첨자발표일', render: (item) => item.PRZWNER_PRESNATN_DE || '' },
          { key: '_HSSPLY_ADRES', header: '공급위치', render: (item) => item.HSSPLY_ADRES || '' },
          { key: '_RCRIT_PBLANC', header: '모집공고일', render: (item) => item.RCRIT_PBLANC_DE || '' },
          { key: '_SPSPLY_PERIOD', header: '특별공급접수기간', render: (item) => {
            const b = item.SPSPLY_RCEPT_BGNDE || '';
            const e = item.SPSPLY_RCEPT_ENDDE || '';
            return (b || e) ? `${b} ~ ${e}` : '';
          }},
          { key: '_RNK1_CRSPAREA', header: '1순위(해당지역)', render: (item) => {
            const b = item.GNRL_RNK1_CRSPAREA_RCPTDE || '';
            const e = item.GNRL_RNK1_CRSPAREA_ENDDE || '';
            return (b || e) ? `${b} ~ ${e}` : '';
          }},
        ];

        // 병합에 사용된 원본 필드들 (나머지 컬럼에서 제외)
        const mergedSourceFields = new Set([
          'SUBSCRPT_AREA_CODE_NM', 'HOUSE_NM', 'TOT_SUPLY_HSHLDCO',
          'RCEPT_BGNDE', 'RCEPT_ENDDE', 'PRZWNER_PRESNATN_DE',
          'HSSPLY_ADRES', 'RCRIT_PBLANC_DE',
          'SPSPLY_RCEPT_BGNDE', 'SPSPLY_RCEPT_ENDDE',
          'GNRL_RNK1_CRSPAREA_RCPTDE', 'GNRL_RNK1_CRSPAREA_ENDDE',
        ]);

        const remainingKeys = allKeys.filter(k => !mergedSourceFields.has(k));

        return (
          <div className="data-results-container">
            {renderSummaryCards(filteredItems)}
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    {mergedColumns.map(col => <th key={col.key}>{col.header}</th>)}
                    {remainingKeys.map(k => <th key={k}>{getHeaderName(k)}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item, idx) => (
                    <tr key={idx}>
                      {mergedColumns.map(col => <td key={col.key}>{col.render(item)}</td>)}
                      {remainingKeys.map(k => {
                        const val = item[k] !== undefined && item[k] !== null
                          ? (typeof item[k] === 'object' ? JSON.stringify(item[k]) : String(item[k]))
                          : '';
                        // 링크 필드 처리
                        if (k === 'PBLANC_URL' && val) {
                          return <td key={k}><a href={val} target="_blank" rel="noopener noreferrer" className="hogangnono-link">분양정보</a></td>;
                        }
                        if (k === 'HMPG_ADRES' && val) {
                          return <td key={k}><a href={val.startsWith('http') ? val : `https://${val}`} target="_blank" rel="noopener noreferrer" className="hogangnono-link">홈페이지</a></td>;
                        }
                        return <td key={k}>{val}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {renderPagination()}
            <details className="raw-json-details">
              <summary>원본 JSON 보기</summary>
              {renderJson(result)}
            </details>
          </div>
        );
      }

      // 일반 테이블 (실거래가, 온비드 등)
      return (
        <div className="data-results-container">
          {renderSummaryCards(filteredItems)}
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>{allKeys.map(k => <th key={k}>{getHeaderName(k)}</th>)}</tr>
              </thead>
            <tbody>
              {filteredItems.map((item, idx) => (
                <tr key={idx}>
                  {allKeys.map(k => {
                    const val = item[k] !== undefined && item[k] !== null
                      ? (typeof item[k] === 'object' ? JSON.stringify(item[k]) : String(item[k]))
                      : '';

                    if (val && (k === 'aptNm' || k === 'offiNm' || k === 'mhouseNm')) {
                      const searchQuery = item.umdNm ? `${item.umdNm} ${val}` : val;
                      return (
                        <td key={k}>
                          <a
                            href={`https://hogangnono.com/search?q=${encodeURIComponent(searchQuery)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hogangnono-link"
                            title="호갱노노에서 상세정보 보기"
                          >
                            {val}
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginLeft: '4px', opacity: 0.7, verticalAlign: 'baseline'}}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                          </a>
                        </td>
                      );
                    }
                    return <td key={k}>{val}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {renderPagination()}
        <details className="raw-json-details">
          <summary>원본 JSON 보기</summary>
          {renderJson(result)}
        </details>
      </div>
      );
    }
    
    return renderJson(result);
  };

  const renderJson = (obj) => {
    const jsonStr = JSON.stringify(obj, null, 2);
    const escapedStr = jsonStr.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const highlighted = escapedStr.replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
      (match) => {
        let cls = 'json-number';
        if (/^"/.test(match)) {
          if (/:$/.test(match)) cls = 'json-key';
          else cls = 'json-string';
        } else if (/true|false/.test(match)) {
          cls = 'json-boolean';
        } else if (/null/.test(match)) {
          cls = 'json-null';
        }
        return `<span class="${cls}">${match}</span>`;
      }
    );
    return <pre dangerouslySetInnerHTML={{ __html: highlighted }} />;
  };

  return (
    <div className="container">
      <header className="header animate-fade-in" style={{ marginBottom: '2.5rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2.5rem', background: 'linear-gradient(135deg, #ffffff 0%, #94a3b8 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: '0.8rem' }}>🏢 부동산 종합 데이터 플랫폼</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>국토교통부 실거래가 및 대장아파트 트렌드 샌드박스</p>
      </header>
      
      <div className="layout">
        <aside className="sidebar glass-panel animate-fade-in">
          <div className="sidebar-header" style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--panel-border)', paddingBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.4rem' }}>API Explorer</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.3rem' }}>Real Estate Data</p>

        </div>
        <div className="api-list">
          {apiCategories.map((cat, idx) => (
            <div key={idx} className="api-category">
              <h3>{cat.category}</h3>
              {cat.items.map(api => (
                <button 
                  key={api.id}
                  className={`api-btn ${selectedApi?.id === api.id ? 'active' : ''}`}
                  onClick={() => handleApiSelect(api)}
                >
                  {api.name}
                </button>
              ))}
            </div>
          ))}
        </div>
      </aside>

      <main className="content glass-panel animate-fade-in">
        {selectedApi ? (
          <div className="api-detail animate-fade-in">
                <div className="api-header">
                  <h2>{selectedApi.name}</h2>
                  <p>{selectedApi.description}</p>
                </div>

                <div className="params-grid">
                  {selectedApi.params.map(p => (
                    <div key={p.name} className="form-group">
                      <label>
                        {p.label} ({p.name})
                      </label>
                      {p.name === 'LAWD_CD' ? (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <select 
                            onChange={(e) => {
                              if(e.target.value) handleParamChange(p.name, e.target.value)
                            }}
                            value={regionCodes.some(r => r.value === params[p.name]) ? params[p.name] : ''}
                            className="region-select"
                          >
                            <option value="">지역 선택 (직접 입력)</option>
                            {regionCodes.map(r => (
                              <option key={r.value} value={r.value}>{r.label}</option>
                            ))}
                          </select>
                          <input 
                            type="text" 
                            value={params[p.name] !== undefined ? params[p.name] : ''} 
                            onChange={(e) => handleParamChange(p.name, e.target.value)}
                            placeholder={p.placeholder || p.name}
                            style={{ flex: 1 }}
                          />
                        </div>
                      ) : p.type === 'multiSelect' ? (
                        <div className="multi-select-container" ref={openMultiSelect === p.name ? multiSelectRef : null}>
                          <div
                            className="multi-select-trigger"
                            onClick={() => setOpenMultiSelect(openMultiSelect === p.name ? null : p.name)}
                          >
                            {Array.isArray(params[p.name]) && params[p.name].length > 0
                              ? params[p.name].join(', ')
                              : <span className="multi-select-placeholder">{p.placeholder || '선택하세요'}</span>
                            }
                            <span className="multi-select-arrow">{openMultiSelect === p.name ? '▲' : '▼'}</span>
                          </div>
                          {openMultiSelect === p.name && (
                            <div className="multi-select-dropdown">
                              <div className="multi-select-actions">
                                <button type="button" onClick={() => handleParamChange(p.name, [...p.options])}>전체선택</button>
                                <button type="button" onClick={() => handleParamChange(p.name, [])}>초기화</button>
                              </div>
                              {p.options.map(opt => (
                                <label key={opt} className="multi-select-option">
                                  <input
                                    type="checkbox"
                                    checked={Array.isArray(params[p.name]) && params[p.name].includes(opt)}
                                    onChange={() => handleMultiSelectToggle(p.name, opt)}
                                  />
                                  {opt}
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : p.type === 'month' ? (
                        <input 
                          type="month" 
                          value={params[p.name] ? String(params[p.name]).replace(/^(\d{4})(\d{2})$/, '$1-$2') : ''} 
                          onChange={(e) => handleParamChange(p.name, e.target.value.replace('-', ''))}
                          className="date-input"
                        />
                      ) : p.type === 'date' ? (
                        <input 
                          type="date" 
                          value={params[p.name] ? String(params[p.name]).replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3') : ''} 
                          onChange={(e) => handleParamChange(p.name, e.target.value.replace(/-/g, ''))}
                          className="date-input"
                        />
                      ) : (
                        <input 
                          type={p.type} 
                          value={params[p.name] !== undefined ? params[p.name] : ''} 
                          onChange={(e) => handleParamChange(p.name, e.target.value)}
                          placeholder={p.placeholder || p.name}
                        />
                      )}
                    </div>
                  ))}
                </div>

                <div className="actions-row">
                  <button className="btn-primary" onClick={() => handleCallApi(1)} disabled={loading}>
                    {loading ? '호출 중...' : 'API 호출하기'}
                  </button>
                  <div className="rows-selector">
                    <label>목록 수:</label>
                    <select value={rowsPerPage} onChange={(e) => setRowsPerPage(Number(e.target.value))}>
                      <option value="10">10개씩</option>
                      <option value="20">20개씩</option>
                      <option value="50">50개씩</option>
                      <option value="100">100개씩</option>
                    </select>
                  </div>
                </div>
            {(loading || result || error) && (
              <div className="result-viewer glass-panel animate-fade-in">
                <div className="result-header">
                  <h3>호출 결과</h3>
                  {loading && <div className="spinner"></div>}
                </div>
                {!loading && result && (
                  <div className="result-body">
                    {renderDataDisplay(result)}
                  </div>
                )}
                {!loading && error && (
                  <div className="result-body error">
                    <p>❌ 오류: {error}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="empty-state">
            <p>좌측 메뉴에서 API를 선택해 주세요.</p>
          </div>
        )}
      </main>
      </div>
    </div>
  );
}
