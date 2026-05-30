const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================
// CORS – cho phép frontend gọi vào (thay domain của bạn sau)
// ============================================================
app.use(cors({
  origin: "*", // production: thay bằng domain thực của bạn
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"],
}));

app.use(express.json({ limit: "2mb" }));

// ============================================================
// Health check
// ============================================================
app.get("/", (req, res) => {
  res.json({ status: "ok", service: "Hóa Chất Legal Tool API", version: "1.0.0" });
});

// ============================================================
// System prompt – toàn bộ kiến thức pháp lý nhúng ở đây
// ============================================================
const SYSTEM_PROMPT = `Bạn là chuyên gia pháp lý hóa chất Việt Nam. Tư vấn dựa trên:
1. Luật Hóa chất 69/2025/QH15 (hiệu lực 01/01/2026)
2. NĐ 24/2026/NĐ-CP (17/01/2026) - Phụ lục III (tiền chất), Phụ lục IV (ngưỡng khối lượng kế hoạch phòng ngừa)
3. NĐ 25/2026/NĐ-CP (17/01/2026) - Điều kiện kinh doanh, chứng chỉ tư vấn hạng A1/A2/A3
4. TT 01/2026/TT-BCT - Nhập khẩu, xuất khẩu hóa chất
5. TT 02/2026/TT-BCT - Kinh doanh có điều kiện

PHÂN LOẠI KIỂM SOÁT:
- Nhóm 1: Thông thường → tự do thương mại, cần SDS+nhãn GHS
- Nhóm 2: Nguy hiểm → khai báo hải quan, SDS tiếng Việt bắt buộc
- Nhóm 3: Hạn chế → cần Giấy phép Bộ Công Thương (Cục Hóa chất)
- Nhóm 4: Tiền chất ma túy/vũ khí → thủ tục đặc biệt (Bộ CA + BCT)
- Nhóm 5: Cấm → không được phép

TIỀN CHẤT CÔNG NGHIỆP (Phụ lục III NĐ 24):
Phenylacetone P2P (103-79-7), Acetic anhydride (108-24-7), Methanol (67-56-1),
Anthranilic acid (118-92-3), Benzaldehyde (100-52-7), Benzyl cyanide (140-29-4),
Butane-1,4-diol BDO (110-63-4), Isosafrole (120-58-1), Piperidin (110-89-4)...

HÓA CHẤT PHẢI LẬP KẾ HOẠCH PHÒNG NGỪA (PL IV NĐ 24):
Acrolein≥5.000kg, Acrylonitrile≥50.000kg, Ammonia khan≥50.000kg,
LPG≥50.000kg, Chlorine≥10.000kg, H2SO4 (đặc)≥..., HCN≥5.000kg...

QUY TRÌNH NHẬP KHẨU THÔNG THƯỜNG:
1.Ký HĐ thương mại → 2.Khai VNACCS (hải quan điện tử) → 3.Nộp hồ sơ tại Chi cục HQ
→ 4.Kiểm tra chuyên ngành (nếu thuộc danh mục) → 5.Thông quan → 6.Lưu hồ sơ 5 năm

QUY TRÌNH CẤP PHÉP HC HẠN CHẾ (Bộ Công Thương):
Hồ sơ → Cục Hóa chất (Bộ BCT) → Thẩm định 15 ngày làm việc → Cấp phép → Nhập trong thời hạn → Báo cáo sử dụng

BỘ HỒ SƠ CHUẨN NHẬP KHẨU THÔNG THƯỜNG:
- Commercial Invoice (Hóa đơn thương mại): bản gốc + 2 bản sao
- Packing List (Phiếu đóng gói): chi tiết trọng lượng, số kiện
- Bill of Lading / Airway Bill (Vận đơn): bản gốc telex release
- Certificate of Origin (C/O): nếu hưởng ưu đãi thuế FTA
- SDS tiếng Việt (16 mục GHS): bắt buộc, do nhà sản xuất cung cấp
- Nhãn hàng hóa theo chuẩn GHS: picto + H/P statements
- Tờ khai hải quan điện tử VNACCS
Bổ sung nếu HC hạn chế: Giấy phép nhập khẩu do Bộ BCT cấp

CƠ QUAN THẨM QUYỀN:
- Bộ Công Thương / Cục Hóa chất: Cấp phép nhập/xuất khẩu, kinh doanh HC
- Tổng cục Hải quan: Thông quan, kiểm tra chuyên ngành
- Cảnh sát PCCC / UBND tỉnh: Điều kiện kho bãi, phòng cháy
- Bộ Công An (C05): Tiền chất ma túy
- Bộ KHCN: Kiểm định tiêu chuẩn hóa chất

LUÔN trích dẫn điều khoản cụ thể. Nếu không chắc → ghi rõ "Cần xác nhận tại cơ quan có thẩm quyền".
Trả lời bằng tiếng Việt chuẩn, chuyên nghiệp, rõ ràng.`;

// ============================================================
// POST /api/lookup – tra cứu hóa chất
// ============================================================
app.post("/api/lookup", async (req, res) => {
  const { tradeName, chemName, casNumber, hsCode, quantity, endUse, origin, extra, mode } = req.body;

  // Validate
  if (!tradeName || !chemName || !casNumber || !hsCode) {
    return res.status(400).json({ error: "Thiếu thông tin bắt buộc: tradeName, chemName, casNumber, hsCode" });
  }

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: "Server chưa cấu hình ANTHROPIC_API_KEY" });
  }

  const modeMap = {
    import: "Nhập khẩu vào Việt Nam",
    export: "Xuất khẩu từ Việt Nam",
    business: "Kinh doanh có điều kiện",
    storage: "Lưu trữ & Sản xuất",
    quick: "Tra cứu nhanh phân loại",
  };

  const useMap = {
    sanxuat: "Sản xuất / Gia công",
    nghiencuu: "Nghiên cứu & phát triển",
    banlai: "Kinh doanh / Bán lại",
    taixuat: "Tái xuất khẩu",
    congnghe: "Xử lý / Công nghệ môi trường",
    khac: "Khác",
  };

  const userMessage = `HOẠT ĐỘNG: ${modeMap[mode] || mode}
TÊN THƯƠNG MẠI: ${tradeName}
TÊN HÓA HỌC: ${chemName}
MÃ CAS: ${casNumber}
HS CODE: ${hsCode}
KHỐI LƯỢNG: ${quantity || "Chưa xác định"}
MỤC ĐÍCH: ${useMap[endUse] || "Chưa xác định"}
XUẤT XỨ: ${origin || "Chưa xác định"}
THÔNG TIN THÊM: ${extra || "Không có"}

TRẢ LỜI THEO 4 PHẦN, phân cách bằng dấu ===:

===OVERVIEW===
[XÁC ĐỊNH & PHÂN LOẠI]
- Phân loại theo GHS (nhóm nguy hiểm, mã H/P statements nếu biết)
- Mức kiểm soát: Nhóm mấy? Có cần Giấy phép đặc biệt không?
- Có thuộc danh mục tiền chất (PL III NĐ 24) không?
- Có phải lập Kế hoạch phòng ngừa sự cố (PL IV NĐ 24) không?
- Cơ quan thẩm quyền chính
- Trích dẫn điều khoản áp dụng

===PROCEDURE===
[QUY TRÌNH TỪNG BƯỚC]
STEP 1: [Tên bước]
→ Nơi thực hiện: [...]
→ Thời gian: [...]
→ Chi tiết: [...]
STEP 2: ...

===DOCS===
[HỒ SƠ, CHỨNG TỪ]
NHÓM A - HỒ SƠ THƯƠNG MẠI:
- [tên chứng từ]: [ghi chú]

NHÓM B - HỒ SƠ HÓA CHẤT:
- SDS tiếng Việt 16 mục GHS: [ghi chú]

NHÓM C - GIẤY PHÉP ĐẶC BIỆT (nếu cần):
- [...]

===RISKS===
[RỦI RO & LỖI PHỔ BIẾN]
- Lỗi 1: [...]
- Mức xử phạt: [...]
- Khuyến nghị: [...]`;

  try {
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 2500,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!anthropicRes.ok) {
      const errData = await anthropicRes.json().catch(() => ({}));
      throw new Error(errData.error?.message || `Anthropic API lỗi: ${anthropicRes.status}`);
    }

    const data = await anthropicRes.json();
    const text = data.content?.map((b) => b.text || "").join("") || "";

    return res.json({ result: text });
  } catch (err) {
    console.error("API error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Hóa Chất Legal Tool API chạy tại port ${PORT}`);
});
