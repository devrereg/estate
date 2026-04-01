export const apiCategories = [
  {
    category: "아파트(Apartment)",
    items: [
      {
        id: "get_apartment_trades",
        name: "아파트 매매 실거래가",
        description: "국토교통부 아파트 매매 실거래가 데이터를 조회합니다.",
        params: [
          { name: "LAWD_CD", label: "지역코드", type: "text", default: "11110", placeholder: "예: 11110 (종로구)", tooltip: "각 지역별 코드. 행정표준코드관리시스템(www.code.go.kr)의 법정동코드 10자리 중 앞 5자리" },
          { name: "DEAL_YMD", label: "계약월", type: "month", default: "202312", placeholder: "예: 202312", tooltip: "실거래 자료의 계약년월(6자리)" }
        ],
        endpoint: "/api/proxy?type=get_apartment_trades"
      },
      {
        id: "get_apartment_rent",
        name: "아파트 전월세 실거래가",
        description: "국토교통부 아파트 전월세 실거래 데이터를 조회합니다.",
        params: [
          { name: "LAWD_CD", label: "지역코드", type: "text", default: "11110", placeholder: "예: 11110", tooltip: "각 지역별 코드. 행정표준코드관리시스템(www.code.go.kr)의 법정동코드 10자리 중 앞 5자리" },
          { name: "DEAL_YMD", label: "계약월", type: "month", default: "202312", placeholder: "예: 202312", tooltip: "실거래 자료의 계약년월(6자리)" }
        ],
        endpoint: "/api/proxy?type=get_apartment_rent"
      }
    ]
  },
  {
    category: "오피스텔(Officetel)",
    items: [
      {
        id: "get_officetel_trades",
        name: "오피스텔 매매 신고 자료",
        description: "국토교통부 오피스텔 매매 데이터를 조회합니다.",
        params: [
          { name: "LAWD_CD", label: "지역코드", type: "text", default: "11110", placeholder: "예: 11110", tooltip: "각 지역별 코드. 행정표준코드관리시스템(www.code.go.kr)의 법정동코드 10자리 중 앞 5자리" },
          { name: "DEAL_YMD", label: "계약월", type: "month", default: "202312", placeholder: "예: 202312", tooltip: "실거래 자료의 계약년월(6자리)" }
        ],
        endpoint: "/api/proxy?type=get_officetel_trades"
      },
      {
        id: "get_officetel_rent",
        name: "오피스텔 전월세 자료",
        description: "국토교통부 오피스텔 전월세 데이터를 조회합니다.",
        params: [
          { name: "LAWD_CD", label: "지역코드", type: "text", default: "11110", placeholder: "예: 11110", tooltip: "각 지역별 코드. 행정표준코드관리시스템(www.code.go.kr)의 법정동코드 10자리 중 앞 5자리" },
          { name: "DEAL_YMD", label: "계약월", type: "month", default: "202312", placeholder: "예: 202312", tooltip: "실거래 자료의 계약년월(6자리)" }
        ],
        endpoint: "/api/proxy?type=get_officetel_rent"
      }
    ]
  },
  {
    category: "빌라/단독/상업용",
    items: [
      {
        id: "get_villa_trades",
        name: "연립다세대 매매 실거래가",
        description: "빌라, 연립, 다세대 주택의 매매 실거래가 데이터를 조회합니다.",
        params: [
          { name: "LAWD_CD", label: "지역코드", type: "text", default: "11110", tooltip: "각 지역별 코드. 행정표준코드관리시스템(www.code.go.kr)의 법정동코드 10자리 중 앞 5자리" },
          { name: "DEAL_YMD", label: "계약월", type: "month", default: "202312", tooltip: "실거래 자료의 계약년월(6자리)" }
        ],
        endpoint: "/api/proxy?type=get_villa_trades"
      },
      {
        id: "get_single_house_trades",
        name: "단독/다가구 매매 실거래가",
        description: "단독 주택 및 다가구 주택의 매매 실거래가 데이터를 조회합니다.",
        params: [
          { name: "LAWD_CD", label: "지역코드", type: "text", default: "11110", tooltip: "각 지역별 코드. 행정표준코드관리시스템(www.code.go.kr)의 법정동코드 10자리 중 앞 5자리" },
          { name: "DEAL_YMD", label: "계약월", type: "month", default: "202312", tooltip: "실거래 자료의 계약년월(6자리)" }
        ],
        endpoint: "/api/proxy?type=get_single_house_trades"
      },
      {
        id: "get_commercial_trade",
        name: "상업업무용 부동산 실거래가",
        description: "상업업무용 부동산 매매 실거래가 자료를 조회합니다.",
        params: [
          { name: "LAWD_CD", label: "지역코드", type: "text", default: "11110", tooltip: "각 지역별 코드. 행정표준코드관리시스템(www.code.go.kr)의 법정동코드 10자리 중 앞 5자리" },
          { name: "DEAL_YMD", label: "계약월", type: "month", default: "202312", tooltip: "실거래 자료의 계약년월(6자리)" }
        ],
        endpoint: "/api/proxy?type=get_commercial_trade"
      }
    ]
  },
  {
    category: "청약홈 (분양 정보)",
    items: [
      {
        id: "get_apt_lttot_detail",
        name: "APT 분양정보 상세조회",
        description: "청약홈 APT 분양정보(공고, 일정 등) 상세 데이터를 조회합니다.",
        params: [
          { name: "cond[HOUSE_NM::LIKE]", label: "주택명", type: "text", default: "", placeholder: "예: 래미안, 자이", tooltip: "주택명 검색 (부분 일치)" },
          { name: "cond[SUBSCRPT_AREA_CODE_NM::EQ]", label: "공급지역명", type: "multiSelect", default: [], placeholder: "지역 선택", tooltip: "공급지역명 (복수 선택 가능)", options: ["서울","경기","인천","부산","대구","대전","광주","울산","세종","강원","충북","충남","전북","전남","경북","경남","제주"] },
          { name: "cond[HSSPLY_ADRES::LIKE]", label: "공급위치", type: "text", default: "", placeholder: "예: 강남구, 수원시", tooltip: "공급위치 주소 검색 (부분 일치)" },
          { name: "cond[RCRIT_PBLANC_DE::GTE]", label: "모집공고일(이후)", type: "text", default: "", placeholder: "YYYY-MM-DD", tooltip: "모집공고일 시작 범위" },
          { name: "cond[RCRIT_PBLANC_DE::LTE]", label: "모집공고일(이전)", type: "text", default: "", placeholder: "YYYY-MM-DD", tooltip: "모집공고일 종료 범위" },
          { name: "cond[HOUSE_DTL_SECD_NM::EQ]", label: "주택상세구분", type: "text", default: "", placeholder: "예: 민영, 공공", tooltip: "민영 또는 공공 (정확히 일치)" },
          { name: "cond[HOUSE_MANAGE_NO::EQ]", label: "주택관리번호", type: "text", default: "", placeholder: "예: 2026000078", tooltip: "특정 주택관리번호 조회" },
          { name: "cond[PBLANC_NO::EQ]", label: "공고번호", type: "text", default: "", placeholder: "예: 2026000078", tooltip: "특정 공고번호 조회" }
        ],
        endpoint: "/api/proxy?type=get_apt_lttot_detail"
      },
      {
        id: "get_apt_lttot_mdl",
        name: "APT 주택형별 상세조회",
        description: "청약홈 APT 분양정보의 주택형별(면적, 공급세대수 등) 상세 데이터를 조회합니다.",
        params: [
          { name: "cond[HOUSE_MANAGE_NO::EQ]", label: "주택관리번호", type: "text", default: "", placeholder: "예: 2026000078", tooltip: "특정 주택관리번호 조회" },
          { name: "cond[PBLANC_NO::EQ]", label: "공고번호", type: "text", default: "", placeholder: "예: 2026000078", tooltip: "특정 공고번호 조회" }
        ],
        endpoint: "/api/proxy?type=get_apt_lttot_mdl"
      },
      {
        id: "get_urbty_ofctl_detail",
        name: "오피스텔/도시형/민간임대 상세조회",
        description: "오피스텔, 도시형생활주택, 민간임대, 생활숙박시설 분양정보를 조회합니다.",
        params: [
          { name: "cond[HOUSE_NM::LIKE]", label: "주택명", type: "text", default: "", placeholder: "예: 오피스텔명", tooltip: "주택명 검색 (부분 일치)" },
          { name: "cond[SUBSCRPT_AREA_CODE::EQ]", label: "공급지역코드", type: "text", default: "", placeholder: "예: 110", tooltip: "공급지역코드 (정확히 일치)" },
          { name: "cond[HSSPLY_ADRES::LIKE]", label: "공급위치", type: "text", default: "", placeholder: "예: 강남구, 수원시", tooltip: "공급위치 주소 검색 (부분 일치)" },
          { name: "cond[RCRIT_PBLANC_DE::GTE]", label: "모집공고일(이후)", type: "text", default: "", placeholder: "YYYY-MM-DD", tooltip: "모집공고일 시작 범위" },
          { name: "cond[RCRIT_PBLANC_DE::LTE]", label: "모집공고일(이전)", type: "text", default: "", placeholder: "YYYY-MM-DD", tooltip: "모집공고일 종료 범위" },
          { name: "cond[HOUSE_MANAGE_NO::EQ]", label: "주택관리번호", type: "text", default: "", placeholder: "예: 2026000078", tooltip: "특정 주택관리번호 조회" },
          { name: "cond[PBLANC_NO::EQ]", label: "공고번호", type: "text", default: "", placeholder: "예: 2026000078", tooltip: "특정 공고번호 조회" }
        ],
        endpoint: "/api/proxy?type=get_urbty_ofctl_detail"
      },
      {
        id: "get_remndr_lttot_detail",
        name: "APT 잔여세대 분양정보 상세조회",
        description: "APT 잔여세대(무순위/취소후재공급) 분양정보를 조회합니다.",
        params: [
          { name: "cond[HOUSE_NM::LIKE]", label: "주택명", type: "text", default: "", placeholder: "예: 래미안, 자이", tooltip: "주택명 검색 (부분 일치)" },
          { name: "cond[SUBSCRPT_AREA_CODE::EQ]", label: "공급지역코드", type: "text", default: "", placeholder: "예: 110", tooltip: "공급지역코드 (정확히 일치)" },
          { name: "cond[HSSPLY_ADRES::LIKE]", label: "공급위치", type: "text", default: "", placeholder: "예: 강남구, 수원시", tooltip: "공급위치 주소 검색 (부분 일치)" },
          { name: "cond[RCRIT_PBLANC_DE::GTE]", label: "모집공고일(이후)", type: "text", default: "", placeholder: "YYYY-MM-DD", tooltip: "모집공고일 시작 범위" },
          { name: "cond[RCRIT_PBLANC_DE::LTE]", label: "모집공고일(이전)", type: "text", default: "", placeholder: "YYYY-MM-DD", tooltip: "모집공고일 종료 범위" },
          { name: "cond[HOUSE_MANAGE_NO::EQ]", label: "주택관리번호", type: "text", default: "", placeholder: "예: 2026000078", tooltip: "특정 주택관리번호 조회" },
          { name: "cond[PBLANC_NO::EQ]", label: "공고번호", type: "text", default: "", placeholder: "예: 2026000078", tooltip: "특정 공고번호 조회" }
        ],
        endpoint: "/api/proxy?type=get_remndr_lttot_detail"
      }
    ]
  },
  {
    category: "온비드 (부동산 공매)",
    items: [
      {
        id: "get_public_auction_items",
        name: "온비드 통정입찰결과 목록",
        description: "한국자산관리공사(온비드) 물건별 입찰 결과 목록을 조회합니다.",
        params: [
          { name: "PBCT_BEGN_DTM", label: "공고시작일", type: "date", default: "20231201", placeholder: "YYYYMMDD", tooltip: "공고시작일자 (YYYYMMDD 형식)" },
          { name: "PBCT_CLS_DTM", label: "공고종료일", type: "date", default: "20231231", placeholder: "YYYYMMDD", tooltip: "공고종료일자 (YYYYMMDD 형식)" }
        ],
        endpoint: "/api/proxy?type=get_public_auction_items"
      },
      {
        id: "get_onbid_thing_info_list",
        name: "온비드 물건정보 수합 조회",
        description: "진행 중인 부동산 공매 상세 물건 목록을 조회합니다.",
        params: [
          { name: "CTGR_HIRK_ID", label: "물건 1뎁스명 (용도코드)", type: "text", default: "10000" }
        ],
        endpoint: "/api/proxy?type=get_onbid_thing_info_list"
      },
      {
        id: "get_onbid_top_code_info",
        name: "온비드 대분류상세코드 조회",
        description: "물건 검색을 위한 공매 대분류 코드를 조회합니다.",
        params: [],
        endpoint: "/api/proxy?type=get_onbid_top_code_info"
      }
    ]
  }
];
