const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: "*", methods: ["GET","POST"], allowedHeaders: ["Content-Type"] }));
app.use(express.json({ limit: "4mb" }));

app.get("/", (req, res) => res.json({ status:"ok", service:"BRXNK – Hóa Chất Legal Tool API", version:"2.0.0" }));

const SYSTEM_PROMPT = `Bạn là chuyên gia pháp lý hóa chất Việt Nam. Tư vấn dựa trên:
1. Luật Hóa chất 69/2025/QH15 (hiệu lực 01/01/2026)
2. NĐ 24/2026/NĐ-CP (17/01/2026) - Phụ lục III (tiền chất), Phụ lục IV (ngưỡng khối lượng)
3. NĐ 25/2026/NĐ-CP (17/01/2026) - Điều kiện kinh doanh
4. TT 01/2026/TT-BCT - Nhập khẩu, xuất khẩu hóa chất
5. TT 02/2026/TT-BCT - Kinh doanh có điều kiện

PHÂN LOẠI: Nhóm 1(thông thường), 2(nguy hiểm/khai báo), 3(hạn chế/cần GP), 4(tiền chất đặc biệt), 5(cấm)
TIỀN CHẤT (PL III NĐ 24): P2P(103-79-7), Acetic anhydride(108-24-7), Methanol(67-56-1), Anthranilic acid(118-92-3)...
KẾ HOẠCH PHÒNG NGỪA (PL IV NĐ 24): Acrolein≥5t, Ammonia≥50t, LPG≥50t, Chlorine≥10t...

LUÔN trả lời tiếng Việt, trích dẫn điều khoản cụ thể.`;

// ===== ENDPOINT 1: Lookup thủ tục =====
app.post("/api/lookup", async (req, res) => {
  const { tradeName, chemName, casNumber, hsCode, quantity, endUse, origin, extra, mode } = req.body;
  if (!tradeName || !chemName || !casNumber || !hsCode)
    return res.status(400).json({ error: "Thiếu thông tin bắt buộc" });

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) return res.status(500).json({ error: "Chưa cấu hình API key" });

  const modeMap = { import:"Nhập khẩu vào VN", export:"Xuất khẩu từ VN", business:"Kinh doanh có điều kiện", storage:"Lưu trữ & Sản xuất", quick:"Tra cứu nhanh" };
  const useMap = { sanxuat:"Sản xuất/Gia công", nghiencuu:"Nghiên cứu", banlai:"Kinh doanh/Bán lại", taixuat:"Tái xuất", congnghe:"Xử lý môi trường", khac:"Khác" };

  const userMessage = `HOẠT ĐỘNG: ${modeMap[mode]||mode}
TÊN THƯƠNG MẠI: ${tradeName}
TÊN HÓA HỌC: ${chemName}
MÃ CAS: ${casNumber}
HS CODE: ${hsCode}
KHỐI LƯỢNG: ${quantity||"Chưa xác định"}
MỤC ĐÍCH: ${useMap[endUse]||"Chưa xác định"}
XUẤT XỨ: ${origin||"Chưa xác định"}
THÔNG TIN THÊM: ${extra||"Không có"}

TRẢ LỜI THEO 5 PHẦN, phân cách bằng ===:

===FULLNAME===
[TÊN HÀNG KHAI BÁO ĐỀ XUẤT]
Viết tên hàng đầy đủ theo đúng tinh thần khai báo hải quan Việt Nam, bao gồm: tên hóa học (tên thương mại), dạng (lỏng/rắn/khí), nồng độ/hàm lượng nếu có, mục đích sử dụng, xuất xứ. Ví dụ: "Acetone (Propan-2-one), dạng lỏng, nồng độ ≥99%, dùng làm dung môi công nghiệp, xuất xứ Trung Quốc"
Ghi chú ngắn về cơ sở pháp lý tên hàng này.

===OVERVIEW===
[XÁC ĐỊNH & PHÂN LOẠI]

PHÂN LOẠI GHS: [nhóm nguy hiểm, mã H statements]

MỨC KIỂM SOÁT: Nhóm [số] - [mô tả]

CẦN GIẤY PHÉP ĐẶC BIỆT: [KHÔNG / CÓ] - [lý do rõ ràng]
Lưu ý: Dầu nhớt, nhiên liệu, dung môi thông thường, hóa chất công nghiệp phổ biến THƯỜNG không cần GP đặc biệt. Chỉ kết luận CÓ nếu thuộc danh mục hạn chế (PL I, II NĐ 24/2026).

TIỀN CHẤT KIỂM SOÁT: [KHÔNG / CÓ] - CAS [số] [không nằm / nằm] trong Phụ lục III NĐ 24/2026

KHAI BÁO HÓA CHẤT HẢI QUAN: [CÓ / KHÔNG] - [lý do: thuộc/không thuộc nhóm HC nguy hiểm phải khai báo]

KẾ HOẠCH PHÒNG NGỪA (PL IV): [KHÔNG BẮT BUỘC / BẮT BUỘC] - [ngưỡng và lý do]

CƠ QUAN THẨM QUYỀN: [liệt kê]

ĐIỀU KHOẢN: [trích dẫn cụ thể]

===PROCEDURE===
STEP 1: [Tên bước]
→ Nơi thực hiện: [...]
→ Thời gian: [...]
→ Chi tiết: [...]
STEP 2: ...

===DOCS===
NHÓM A - HỒ SƠ THƯƠNG MẠI:
- [...]
NHÓM B - HỒ SƠ HÓA CHẤT:
- [...]
NHÓM C - GIẤY PHÉP ĐẶC BIỆT (nếu cần):
- [...]

===RISKS===
- Lỗi 1: [...]
- Mức xử phạt: [...]
- Khuyến nghị: [...]`;

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method:"POST",
      headers:{ "Content-Type":"application/json", "x-api-key":ANTHROPIC_API_KEY, "anthropic-version":"2023-06-01" },
      body: JSON.stringify({ model:"claude-sonnet-4-5", max_tokens:3000, system:SYSTEM_PROMPT, messages:[{role:"user",content:userMessage}] })
    });
    if (!r.ok) { const e = await r.json().catch(()=>({})); throw new Error(e.error?.message||`API ${r.status}`); }
    const data = await r.json();
    res.json({ result: data.content?.map(b=>b.text||"").join("") || "" });
  } catch(e) {
    console.error(e.message);
    res.status(500).json({ error: e.message });
  }
});

// ===== ENDPOINT 2: Extract SDS info =====
app.post("/api/extract-sds", async (req, res) => {
  const { text, filename } = req.body;
  if (!text) return res.status(400).json({ error: "Thiếu nội dung SDS" });

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) return res.status(500).json({ error: "Chưa cấu hình API key" });

  const prompt = `Đây là nội dung SDS/MSDS của một hóa chất. Hãy trích xuất các thông tin sau và trả lời CHỈ bằng JSON hợp lệ, không có text nào khác:

{
  "tradeName": "tên thương mại sản phẩm",
  "chemName": "tên hóa học IUPAC",
  "casNumber": "mã CAS (chỉ số, dạng XXX-XX-X)",
  "quantity": "",
  "hsSuggestion": "HS code gợi ý 8-10 số (dạng XXXX.XX.XX)",
  "hsDescription": "mô tả ngắn HS code này"
}

Nếu không tìm thấy thông tin nào, để chuỗi rỗng "".
Chỉ trả về JSON, không giải thích thêm.

NỘI DUNG SDS:
${text.slice(0, 6000)}`;

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method:"POST",
      headers:{ "Content-Type":"application/json", "x-api-key":ANTHROPIC_API_KEY, "anthropic-version":"2023-06-01" },
      body: JSON.stringify({ model:"claude-haiku-4-5-20251001", max_tokens:500, messages:[{role:"user",content:prompt}] })
    });
    if (!r.ok) throw new Error(`API ${r.status}`);
    const data = await r.json();
    const rawText = data.content?.map(b=>b.text||"").join("") || "{}";
    const clean = rawText.replace(/```json|```/g,"").trim();
    const info = JSON.parse(clean);
    res.json({ info });
  } catch(e) {
    console.error("SDS extract error:", e.message);
    res.json({ info: {} }); // graceful fallback
  }
});

app.listen(PORT, () => console.log(`✅ BRXNK Hóa Chất Legal Tool API v2.0 – port ${PORT}`));
