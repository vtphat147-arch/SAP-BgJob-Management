# Flow Xuyên Suốt Thực Tế: Create Job (Schedule Job)

> [!NOTE]
> Flow khái quát: User click Schedule trên SAP Fiori → Mở giao diện Wizard → Điền thông tin Config & Lịch trình → Bấm Schedule → Frontend truyền OData → Gateway chuyển đổi → Hệ thống lớp Backend của RAP (SAP) nhận và tiến hành chèn Job vào DB → Thông báo thành công và Refresh FE.

---

## 1. FRONTEND (Fiori / SAPUI5)

### Bước 1.1: Giao diện Wizard (Màn hình điền thông tin)

📍 File: [`CreateJob.view.xml`](file:///d:/SAPPJ/abap-rap-backgroundjob-m/project5/webapp/ext/main/CreateJob.view.xml#L10-L82) *(Ctrl + Click để mở)*

Giao diện để tạo mới Job không nằm ngay trên bảng danh sách, mà sẽ chuyển hướng (Navigate) sang một trang có gắn Component dạng `Wizard` gồm 2 bước (Step):
- Bước 1 (Template Selection): Các trường cho user nhập `jobName`, gọi bảng F4 để lấy thông tin `programName` thật từ trong DB và cả cấu hình biến `variantName`.
- Bước 2 (Scheduling Options): Lựa chọn ngày/giờ chạy `startDate` và `startImmediately`. Có thể gọi bảng phụ trợ để lên chu kỳ lặp (Pattern).

Lúc này, mọi thứ người dùng nhập vào chưa gửi đi đâu cả, nó chỉ đang được lưu vào bộ nhớ tạm (JSONModel tên `local`). Giống hệt như bạn đang ghi vào nháp.

### Bước 1.2: Bấm nút gửi Yêu cầu tạo Job

📍 File: [`CreateJob.view.xml`](file:///d:/SAPPJ/abap-rap-backgroundjob-m/project5/webapp/ext/main/CreateJob.view.xml#L88) *(Ctrl + Click để mở)*

Khi user đến cuối màn hình và bấm nút Schedule (Nút được đánh dấu lệnh `press=".onWizardCompleted"`), chương trình chính thức chuyển giao sang Controller xử lý.

### Bước 1.3: Thu thập Data và gửi Request (Controller)

📍 File: [`CreateJob.controller.js`](file:///d:/SAPPJ/abap-rap-backgroundjob-m/project5/webapp/ext/main/CreateJob.controller.js#L203-L311) *(Ctrl + Click để mở)*

Javascript lúc này sẽ nhảy vào để thu thập Data đang giữ ở nháp.
1. Xử lý chuẩn giờ: Do Server SAP có thể nằm ở chuẩn giờ chung (VD: Europe/Berlin), code JS dùng thư viện `Intl.DateTimeFormat` gắn TimeZone để đổi múi giờ hiện rại ở trình duyệt (Ví dụ GMT+7 VN) thành múi giờ khớp với hệ thống SAP Cốt lõi.
2. Thiết lập đối tượng OData Action: Định hình Action với path `/JobList/com.sap...ScheduleJob(...)` nhằm nhòm trúng đích hàm Cốt Lõi chuẩn bị kích hoạt.
3. Cài cắm thông số (Parameters): Dùng lệnh `setParameter("...", ...)` lần lượt đẩy mớ dữ liệu thu thập được như JobName, Program Name, Ngày Giờ Hẹn Lên Lịch vào Action.
4. Gọi hàm kích hoạt khởi chạy: Tính năng `.execute()`.

Đến đây, Frontend ngưng việc, chính thức tạo một gói HTTP POST chứa Request bay thẳng xuống trạm Gateway.

---

## 2. ODATA GATEWAY (Cổng Giao Tiếp)

Gói HTTP POST của Frontend vào đến ABAP Gateway sẽ đi ngang qua 2 trạm kiểm soát để chuyển từ "Giao thức Website" thành "Ngôn ngữ SAP":
- Lớp Service Binding: Trạm bảo vệ ngoài cùng xác nhận UI được nối thông với Node hệ thống chuẩn OData V4 Web API.
- Lớp Service Definition: Người gác cổng thứ hai kiểm tra trong bản vẽ thiết kế (Projection layer) xem những Object hay Action nào (như ScheduleJob) được phép phơi bày (Exposed) ra cho Frontend gọi. Nếu chưa khai báo thì văng lỗi ngay.

Hoàn tất xác minh bảo mật, lệnh được đẩy thẳng xuống hệ thống RAP bên dưới.

---

## 3. BACKEND (ABAP RAP - Khối Cốt Lõi)

Bắt đầu đi vào xương sống của lập trình hệ thống SAP. Chuỗi kiến trúc (Architecture) chạy như sau:

### Bước 3.1: CDS Views Pipeline

Hệ thống ráp đối tượng dữ liệu xuyên qua các View kết nối:
- Lớp CDS Projection View (Vùng đệm UI): Giao diện tiếp đón luồng truy cập vào từ Gateway. 
- Lớp CDS Interface View (Vùng lõi DB): Nhận biết được kiến trúc khai báo cho Framework là có một chức năng tên Action `ScheduleJob` được ủy quyền sửa đổi hoặc thực thi DB Background Tab.

### Bước 3.2: Behavior Definition (Trạm thu thập dữ liệu)

Lớp BDEF nhận tín hiệu thực thi, nó kiểm tra các ràng buộc Lock khóa. Sau đó nó tự động lấy các cục `Parameters` (như ngày, giờ, tên Job...) mà Javascript FE đẩy lên nãy giờ ra và nhét gọn gàng chúng vào chung 1 hộp cấu trúc bộ nhớ do Framework cấp phát (Biến là `%param`).

### Bước 3.3: Behavior Implementation (Class xử lý Data thật)

Cuối cùng, Framework đẩy cái hộp `%param` vừa chứa thông tin đó vào thẳng trong đoạn Code thao tác DB.

Tại khâu này, code không dám viết lệnh SQL Insert trực tiếp vào Core DB của SAP vì rất mất an toàn. Nó chọn cách đi vòng bằng chuỗi quy trình chuẩn của SAP với 3 hàm Module (FM) sau:
- JOB_OPEN: Mở tài khoản khai báo với Session "Ê, chuẩn bị cấp cho 1 bộ định danh ID Job nha". SAP sẽ duyệt và nhả về 1 cái Job Count trống.
- JOB_SUBMIT: Gắn tài liệu (Program Name, Variant cấu hình) vào cái ID rỗng vừa được cấp ấy.
- JOB_CLOSE: Hàm then chốt dập thẻ. Nó nhét tiếp cấu hình StartDate/StartTime vào tài liệu của ID lúc nãy và Save lại, kích hoạt Status của Job từ chờ lên Scheduled. (Bắn record chính thức vào bảng DB `TBTCO` của SAP). 

Hoàn tất tạo thành công Job. BDEF Class tự ném về 1 gói tín hiệu `Success` về lại hướng ngược lại cho cổng Gateway.

---

## 4. FRONTEND (Giai đoạn Báo Cáo)

📍 File: [`CreateJob.controller.js`](file:///d:/SAPPJ/abap-rap-backgroundjob-m/project5/webapp/ext/main/CreateJob.controller.js#L278-L304) *(Ctrl + Click để quay lại xem Logic Thành Công)*

Ngay khoảnh khắc hàm `.execute()` bên thiết bị user nhận được tín hiệu hồi đáp thành công (HTTP Resolve / Promise `then`).
- Hệ thống kích hoạt thư viện MessageToast bắn ra câu thông báo xanh lá "Job created successfully!" góc dưới màn hình.
- Chạy lệnh tiếp theo: Gọi hàm `that.onNavBack()` với tác dụng hủy trang Wizard, lùi xe về thẳng giao diện Table List ngoài cùng. Sự kiện lùi trang tự động Refresh cái bảng FE và Job mới cứng xuất hiện trên Data hiển thị cho User.

**Hoàn thành Flow Khép Kín!**
