# 🧪 Tra Cứu Thủ Tục Hóa Chất – Deploy Guide

## Cấu trúc thư mục

```
hoa-chat-tool/
├── backend/
│   ├── server.js        ← Backend Express.js (proxy Anthropic API)
│   └── package.json
├── frontend/
│   └── index.html       ← Giao diện web hoàn chỉnh
├── render.yaml          ← Cấu hình deploy Render.com
└── README.md
```

---

## 🚀 HƯỚNG DẪN DEPLOY (15 phút)

### BƯỚC 1 – Upload code lên GitHub

1. Vào **github.com** → New repository → Đặt tên: `hoa-chat-tool`
2. Upload toàn bộ thư mục này lên repo

Hoặc dùng terminal:
```bash
cd hoa-chat-tool
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/TEN-BAN/hoa-chat-tool.git
git push -u origin main
```

---

### BƯỚC 2 – Deploy Backend lên Render.com (FREE)

1. Vào **render.com** → Sign up bằng GitHub
2. Click **New** → **Web Service**
3. Connect GitHub repo `hoa-chat-tool`
4. Cấu hình:
   - **Name**: `hoa-chat-legal-tool` (hoặc tên bất kỳ)
   - **Region**: `Singapore` (gần VN nhất)
   - **Branch**: `main`
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Plan**: `Free`

5. Click **Advanced** → **Add Environment Variable**:
   - Key: `ANTHROPIC_API_KEY`
   - Value: `sk-ant-api03-...` (API key của bạn)

6. Click **Create Web Service** → Đợi ~3 phút deploy xong

7. Copy URL backend: `https://hoa-chat-legal-tool.onrender.com`

---

### BƯỚC 3 – Cập nhật Frontend

Mở file `frontend/index.html`, tìm dòng:
```javascript
const BACKEND_URL = "https://YOUR-APP-NAME.onrender.com";
```

Thay bằng URL thực từ Bước 2:
```javascript
const BACKEND_URL = "https://hoa-chat-legal-tool.onrender.com";
```

---

### BƯỚC 4 – Deploy Frontend lên GitHub Pages (FREE)

1. Trong GitHub repo → **Settings** → **Pages**
2. Source: `Deploy from a branch`
3. Branch: `main` / Folder: `/frontend`
4. Save → Đợi 2 phút

URL frontend sẽ là:
`https://TEN-BAN.github.io/hoa-chat-tool/`

---

## ✅ KIỂM TRA

Mở URL frontend → Nhập thông tin hóa chất → Click tra cứu

Nếu lỗi CORS: Kiểm tra `BACKEND_URL` trong `index.html` đúng chưa.

---

## 📋 LẤY API KEY ANTHROPIC

1. Vào **console.anthropic.com**
2. API Keys → Create Key
3. Copy key bắt đầu bằng `sk-ant-api03-...`
4. Paste vào Environment Variable của Render

---

## 💡 LƯU Ý

- **Free tier Render**: Server sleep sau 15 phút không dùng → lần đầu gọi có thể chậm 30-60 giây (cold start)
- **Upgrade lên Starter $7/tháng**: Server chạy 24/7, không sleep
- **Bảo mật**: API key chỉ lưu trên Render, không expose ra frontend

## 📞 HỖ TRỢ

Nếu gặp lỗi, kiểm tra:
1. Render Logs: Dashboard → Service → Logs
2. Browser Console (F12): Xem lỗi network
