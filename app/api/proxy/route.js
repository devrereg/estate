import { NextResponse } from 'next/server';
import { XMLParser } from 'fast-xml-parser';

const API_ENDPOINTS = {
  get_apartment_trades: "https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade",
  get_apartment_rent: "https://apis.data.go.kr/1613000/RTMSDataSvcAptRent/getRTMSDataSvcAptRent",
  get_officetel_trades: "https://apis.data.go.kr/1613000/RTMSDataSvcOffiTrade/getRTMSDataSvcOffiTrade",
  get_officetel_rent: "https://apis.data.go.kr/1613000/RTMSDataSvcOffiRent/getRTMSDataSvcOffiRent",
  get_villa_trades: "https://apis.data.go.kr/1613000/RTMSDataSvcRHTrade/getRTMSDataSvcRHTrade",
  get_villa_rent: "https://apis.data.go.kr/1613000/RTMSDataSvcRHRent/getRTMSDataSvcRHRent",
  get_single_house_trades: "https://apis.data.go.kr/1613000/RTMSDataSvcSHTrade/getRTMSDataSvcSHTrade",
  get_single_house_rent: "https://apis.data.go.kr/1613000/RTMSDataSvcSHRent/getRTMSDataSvcSHRent",
  get_commercial_trade: "https://apis.data.go.kr/1613000/RTMSDataSvcNrgTrade/getRTMSDataSvcNrgTrade",
  
  // 청약홈 APIs (ApplyhomeInfoDetailSvc)
  get_apt_lttot_detail: "https://api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1/getAPTLttotPblancDetail",
  get_urbty_ofctl_detail: "https://api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1/getUrbtyOfctlLttotPblancDetail",
  get_remndr_lttot_detail: "https://api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1/getRemndrLttotPblancDetail",
  get_apt_lttot_mdl: "https://api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1/getAPTLttotPblancMdl",
  get_urbty_ofctl_mdl: "https://api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1/getUrbtyOfctlLttotPblancMdl",
  get_remndr_lttot_mdl: "https://api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1/getRemndrLttotPblancMdl",

  // 온비드 APIs
  get_public_auction_items: "https://apis.data.go.kr/B010003/OnbidCltrBidRsltListSrvc/getCltrBidRsltList",
  get_public_auction_item_detail: "https://apis.data.go.kr/B010003/OnbidCltrBidRsltDtlSrvc/getCltrBidRsltDtl",
  get_onbid_thing_info_list: "http://openapi.onbid.co.kr/openapi/services/ThingInfoInquireSvc/getUnifyUsageCltr",
  get_onbid_top_code_info: "http://openapi.onbid.co.kr/openapi/services/OnbidCodeInfoInquireSvc/getOnbidTopCodeInfo",
  get_onbid_middle_code_info: "http://openapi.onbid.co.kr/openapi/services/OnbidCodeInfoInquireSvc/getOnbidMiddleCodeInfo",
  get_onbid_bottom_code_info: "http://openapi.onbid.co.kr/openapi/services/OnbidCodeInfoInquireSvc/getOnbidBottomCodeInfo",
  get_onbid_addr1_info: "http://openapi.onbid.co.kr/openapi/services/OnbidCodeInfoInquireSvc/getOnbidAddr1Info",
  get_onbid_addr2_info: "http://openapi.onbid.co.kr/openapi/services/OnbidCodeInfoInquireSvc/getOnbidAddr2Info",
  get_onbid_addr3_info: "http://openapi.onbid.co.kr/openapi/services/OnbidCodeInfoInquireSvc/getOnbidAddr3Info",
  get_onbid_dtl_addr_info: "http://openapi.onbid.co.kr/openapi/services/OnbidCodeInfoInquireSvc/getOnbidDtlAddrInfo"
};

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const serviceKey = process.env.DATA_GO_KR_API_KEY;

  if (!type || !API_ENDPOINTS[type]) {
    return NextResponse.json({ error: "유효하지 않은 API 타입입니다." }, { status: 400 });
  }

  if (!serviceKey || serviceKey.includes('여기에_')) {
    return NextResponse.json({ error: "서버의 .env.local 환경변수에 DATA_GO_KR_API_KEY가 설정되지 않았습니다." }, { status: 500 });
  }

  let finalUrl = `${API_ENDPOINTS[type]}?serviceKey=${encodeURIComponent(serviceKey)}`;
  
  searchParams.forEach((value, key) => {
    if (key !== 'type' && key !== 'serviceKey') {
      finalUrl += `&${key}=${encodeURIComponent(value)}`;
    }
  });

  if (!finalUrl.includes('numOfRows') && !finalUrl.includes('perPage')) {
    finalUrl += "&numOfRows=10";
  }
  if (!finalUrl.includes('pageNo') && !finalUrl.includes('page=')) {
    finalUrl += "&pageNo=1";
  }

  try {
    console.log("Request URL:", finalUrl);
    const response = await fetch(finalUrl);
    const text = await response.text();
    console.log("Raw API Response:", text.substring(0, 1000));

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      // API typically defaults to XML
      const parser = new XMLParser();
      data = parser.parse(text);
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error("Proxy Error:", error);
    return NextResponse.json({ error: "API 요청 실패", details: error.message }, { status: 500 });
  }
}
