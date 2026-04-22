import os

replacements = {
    "webapp/annotations/annotation.xml": {
        "<!-- ═══════════════════════════════════════════════════ -->": "<!-- =================================================== -->",
        "<!-- ═══════════════════════════════════════════════════════ -->": "<!-- ======================================================= -->",
        "<!-- Khối 2 hộp thông tin nằm ngang -->": "<!-- Horizontal block of 2 information boxes -->",
        "<!-- 🔄 THAY TotalPages -> PaperFormat -->": "<!-- REPLACE TotalPages -> PaperFormat -->"
    },
    "webapp/ext/fragment/SchedulingDialog.fragment.xml": {
        "<!-- Date Picker: Ẩn/Hiện dựa vào checkbox trên -->": "<!-- Date Picker: Show/Hide based on checkbox above -->"
    },
    "webapp/ext/fragment/VariantValueHelp.fragment.xml": {
        "<!-- Định nghĩa các cột -->": "<!-- Define columns -->",
        "<!-- Định nghĩa dòng dữ liệu -->": "<!-- Define data rows -->"
    },
    "webapp/ext/main/CreateJob.controller.js": {
        "// Clear filter cũ mỗi khi mở lại": "// Clear old filter when reopening",
        "// a. Xử lý Date + Time từ DateTimePicker": "// a. Process Date + Time from DateTimePicker",
        "// DateTimePicker có thể trả string, chuyển về Date object": "// DateTimePicker may return a string, convert to Date object",
        "// User is in GMT+7. Must convert local time → SAP server time.": "// User is in GMT+7. Must convert local time -> SAP server time.",
        "// c. Xử lý IsImmediate: Metadata là String(1), KHÔNG PHẢI Boolean": "// c. Process IsImmediate: Metadata is String(1), NOT Boolean",
        "// Quy ước: Chạy ngay = \"X\", Chạy lịch = \"\"": "// Convention: Run immediately = \"X\", Scheduled = \"\"",
        "// 3. TRUYỀN THAM SỐ (Mapping chính xác từng dòng)": "// 3. PASS PARAMETERS (Exact mapping per row)",
        "// Xử lý FrequencyType + FrequencyValue (BẮT BUỘC trong Z_A_JOB_REQ)": "// Process FrequencyType + FrequencyValue (MANDATORY in Z_A_JOB_REQ)",
        "// 5. THỰC THI VÀ CHỜ KẾT QUẢ (Promise)": "// 5. EXECUTE AND AWAIT RESULT (Promise)",
        "// --- THÀNH CÔNG (Backend trả về HTTP 2xx) ---": "// --- SUCCESS (Backend returns HTTP 2xx) ---",
        "// Lưu ý: Nếu muốn lấy message thành công từ Backend gửi lên header sap-messages,": "// Note: To get success messages from Backend sent in sap-messages header,",
        "// OData V4 model thường tự động xử lý và hiện MessageToast nếu configured.": "// OData V4 model usually automatically processes and shows MessageToast if configured.",
        "// Tuy nhiên ta cứ hiện thủ công cho chắc chắn.": "// However, we display it manually to be sure.",
        "// Reset wizard và quay lại": "// Reset wizard and return",
        "// --- THẤT BẠI (Backend trả về HTTP 4xx/5xx hoặc có lỗi trong failed table) ---": "// --- FAILURE (Backend returns HTTP 4xx/5xx or failed table errors) ---",
        "// Trích xuất thông báo lỗi từ OData V4 response": "// Extract error message from OData V4 response"
    },
    "webapp/ext/main/Main.controller.js": {
        "// Lưu Action Name hiện tại để sử dụng trong onConfirmRelease": "// Save current Action Name to use in onConfirmRelease",
        "// Lưu Selected Contexts": "// Save Selected Contexts",
        "// --- 1. LẤY GIÁ TRỊ THÔ TỪ UI ---": "// --- 1. GET RAW VALUES FROM UI ---",
        "// --- 2. ĐỊNH DẠNG CHO CHUẨN ODATA V4 VÀ ĐỔI MÚI GIỜ (GIỐNG CREATE JOB) ---": "// --- 2. FORMAT FOR ODATA V4 AND CONVERT TIMEZONE (LIKE CREATE JOB) ---",
        "oDate = new Date(); // Lấy giờ hiện tại ": "oDate = new Date(); // Get current time ",
        "// Chuyển chuỗi từ UI (local time ghép từ YYYY-MM-DD và HH:mm:ss) sang Date object": "// Convert UI string (local time from YYYY-MM-DD and HH:mm:ss) to Date object",
        "// Convert local time → SAP server time (Europe/Berlin)": "// Convert local time -> SAP server time (Europe/Berlin)",
        "// --- 4. VALIDATE: Nếu không phải Immediate thì phải có Date và Time ---": "// --- 4. VALIDATE: If not Immediate, Date and Time are required ---",
        "// --- DÙNG EXTENSION API VỚI ACTION ĐỘNG TỪ this._sCurrentAction ---": "// --- USE EXTENSION API WITH DYNAMIC ACTION FROM this._sCurrentAction ---",
        "// Bỏ qua lỗi đồng bộ trạng thái action (metadata/cache) để tránh popup lỗi xám.": "// Ignore action state sync errors (metadata/cache) to prevent gray error popups.",
        "// ==================== HELPER: Gọi Bound Action cho nhiều dòng (DỄ HIỂU) ====================": "// ==================== HELPER: Call Bound Action for multiple rows ====================",
        "// --- 0. Dọn dẹp các thông báo lỗi cũ trên giao diện (để không bị hiện thanh thông báo đỏ/vàng) ---": "// --- 0. Clear old error messages ---",
        "// Chạy từng Job một (Tuần tự) để tránh lỗi Batch SAP": "// Run jobs sequentially to avoid SAP Batch errors",
        "await oActionContext.execute(); // Chờ thằng này chạy xong mới qua thằng kế": "await oActionContext.execute(); // Wait for completion before next iteration",
        "// Hiển thị kết quả sau khi chạy xong hết": "// Display result after all executions",
        "MessageBox.error(sLabel + \" thất bại cho \" + aFailed.length + \" job:\\n\\n\" + sErrors);": 'MessageBox.error(this._getText("msgActionFailed", [sLabel, aFailed.length, sErrors]));',
        "// Tên Action đầy đủ (Namespace.Action)": "// Full Action name (Namespace.Action)",
        "// Gọi CopyJob Action - SAP sẽ tự động bật Popup dựa trên Abstract Entity": "// Call CopyJob Action - SAP automatically shows Popup based on Abstract Entity",
        "// để nhập tham số NewJobName": "// to input NewJobName parameter",
        "contexts: [aSelectedContexts[0]] // Truyền Context của dòng được chọn": "contexts: [aSelectedContexts[0]] // Pass Context of selected row",
        "// Thành công": "// Success",
        "// Job mới có thể có StartDate rỗng nên cần bỏ lọc StartDate để không bị ẩn.": "// New Job might have empty StartDate, clear StartDate filter to prevent hiding.",
        "// Nếu user cancel hoặc lỗi": "// If user cancels or error",
        "// ==================== STOP JOB (với Confirmation) ====================": "// ==================== STOP JOB (with Confirmation) ====================",
        "// ==================== DELETE JOB (với Confirmation) ====================": "// ==================== DELETE JOB (with Confirmation) ====================",
        "// 1. Lấy user đang đăng nhập (Trong Fiori Launchpad hoặc Sandbox)": "// 1. Get current logged-in user (in Fiori Launchpad or Sandbox)",
        "// Nếu chạy chay (index.html) không có FLP, đành chịu không biết ai đăng nhập": "// If running standalone (index.html) without FLP, user is unknown",
        "return; // Nếu không biết user là ai thì không filter được": "return; // Cannot filter if user is unknown",
        "// 2. Tìm binding của bảng": "// 2. Find table binding",
        "// 3. Toggle filter: press 1 → filter, press 2 → clear": "// 3. Toggle filter: press 1 -> filter, press 2 -> clear",
        "// --- THÊM HÀM NÀY ĐỂ ĐIỀU HƯỚNG SANG TRANG DETAIL (GIỐNG SM37) ---": "// --- ADD THIS TO NAVIGATE TO DETAIL PAGE (LIKE SM37) ---",
        "// 1. Lấy đường dẫn Context (Path)": "// 1. Get Context Path",
        "// Ví dụ sPath: \"/JobList(JobName='BJSM_TEST',JobCount='000001')\"": "// Example sPath: \"/JobList(JobName='BJSM_TEST',JobCount='000001')\"",
        "// 2. Tách lấy phần Key nằm trong ngoặc đơn": "// 2. Extract Key from parentheses",
        "// 3. Điều hướng sang Object Page đã khai báo trong manifest.json": "// 3. Navigate to Object Page declared in manifest.json",
        "// Tên route \"JobListObjectPage\" và biến \"JobListKey\" phải khớp với manifest": "// Route name \"JobListObjectPage\" and variable \"JobListKey\" must match manifest"
    },
    "webapp/ext/main/Main.view.xml": {
        "<!-- Thêm Menu ẩn (ActionSheet) ở đây, sẽ được gọi lên khi bấm nút Manage -->": "<!-- Add hidden ActionSheet Menu here, triggered by Manage button -->"
    }
}

for filepath, file_replacements in replacements.items():
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    for vi, en in file_replacements.items():
        content = content.replace(vi, en)
        
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

print("Translation completed.")
