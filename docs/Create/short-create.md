# Flow FE → BE → FE: Create Job — Chi tiết đầy đủ

> [!NOTE]
> Flow tổng quan: User bấm nút **📅 Schedule** trên bảng Job List → Navigate sang trang **Wizard 2 bước**:
> Bước 1 nhập tên Job / Program (F4 popup) / Variant (F4 popup).
> Bước 2 chọn ngày giờ chạy + chu kỳ lặp (qua dialog phụ SchedulingDialog).
> Bấm **Schedule** → FE thu thập dữ liệu, convert múi giờ → gửi HTTP POST OData Unbound Action `ScheduleJob` → ABAP RAP gọi `JOB_OPEN` → `JOB_SUBMIT` → `JOB_CLOSE` → Ghi record vào bảng `TBTCO` của SAP → Thông báo thành công → Quay về danh sách.

---

## 1. FRONTEND (Fiori / SAPUI5)

---

### 1.1 UI: Nút kích hoạt "📅 Schedule"

📍 File: [`Main.view.xml`](file:///d:/SAPPJ/abap-rap-backgroundjob-m/project5/webapp/ext/main/Main.view.xml#L22) *(Ctrl + Click)*

Nút Schedule nằm thẳng trên thanh Toolbar của bảng Job List, màu xanh lá `type="Success"`:

```xml
<Button text="📅 Schedule" type="Success" press="onCreateJob"/>
```

* `press="onCreateJob"`: Khi bấm sẽ kích hoạt hàm `onCreateJob` trong `Main.controller.js`.

---

### 1.2 Controller: Điều hướng sang trang Wizard (`onCreateJob`)

📍 File: [`Main.controller.js`](file:///d:/SAPPJ/abap-rap-backgroundjob-m/project5/webapp/ext/main/Main.controller.js#L410-L419) *(Ctrl + Click)*

```javascript
onCreateJob: function (oEvent) {
    var oExtensionAPI = this.getExtensionAPI();

    if (oExtensionAPI && oExtensionAPI.routing) {
        // Điều hướng sang route "CreateJobRoute" khai báo trong manifest.json
        oExtensionAPI.routing.navigateToRoute("CreateJobRoute");
    } else {
        console.error("ExtensionAPI routing is not available.");
    }
}
```

**Giải thích từng dòng:**
- `getExtensionAPI()`: Lấy API điều hướng chuyên dụng của Fiori Elements (khác với SAP UI5 Router thông thường, cái này dành riêng cho ứng dụng extension của Fiori).
- `navigateToRoute("CreateJobRoute")`: Gọi route tên `CreateJobRoute`, định nghĩa trong `manifest.json`. SAP Router sẽ load trang `CreateJob.view.xml` lên thay thế màn hình hiện tại.
- Hàm này **không cần user chọn Job** trên bảng — khác với Stop/Delete.

---

### 1.3 UI: Trang Wizard — `CreateJob.view.xml`

📍 File: [`CreateJob.view.xml`](file:///d:/SAPPJ/abap-rap-backgroundjob-m/project5/webapp/ext/main/CreateJob.view.xml) *(Ctrl + Click)*

Toàn bộ trang là một `Page` bao ngoài một `Wizard`. Wizard có 2 bước:

```xml
<Page id="wizardPage" title="New Background Job" showNavButton="true" navButtonPress=".onNavBack">
    <content>
        <Wizard id="CreateJobWizard" complete="onWizardCompleted">
            <!-- BƯỚC 1 -->
            <WizardStep id="Step1" title="Template Selection" validated="false" activate="onStep1Activate">
            ...
            </WizardStep>

            <!-- BƯỚC 2 -->
            <WizardStep id="Step2" title="Scheduling Options" validated="true">
            ...
            </WizardStep>
        </Wizard>
    </content>
    <footer>
        ...nút Schedule + Cancel...
    </footer>
</Page>
```

* `showNavButton="true" navButtonPress=".onNavBack"`: Nút mũi tên quay lại trên thanh tiêu đề — gọi `onNavBack()`.
* `validated="false"` trên Step1: Mặc định Wizard **chặn** không cho sang bước 2. Chỉ mở khoá khi cả 3 ô nhập có giá trị (xem `onCheckStep1`).
* `validated="true"` trên Step2: Bước 2 mặc định đã hợp lệ (không cần validate thêm).

---

### 1.4 UI: Bước 1 — Template Selection (Nhập Job / Program / Variant)

📍 File: [`CreateJob.view.xml`](file:///d:/SAPPJ/abap-rap-backgroundjob-m/project5/webapp/ext/main/CreateJob.view.xml#L12-L42) *(Ctrl + Click)*

```xml
<WizardStep id="Step1" title="Template Selection" validated="false" activate="onStep1Activate">
    <f:SimpleForm editable="true" layout="ResponsiveGridLayout">
        <f:content>

            <!-- Ô 1: Job Name -->
            <Label text="Job Name" required="true"/>
            <Input value="{local>/jobName}"
                   liveChange="onCheckStep1"
                   placeholder="Enter job name..."/>

            <!-- Ô 2: Program Name — hỗ trợ F4 popup + gợi ý -->
            <Label text="Program Name" required="true"/>
            <Input id="inpProgram"
                   value="{local>/programName}"
                   placeholder="Enter program name..."
                   showValueHelp="true"
                   valueHelpRequest=".onProgramValueHelp"
                   change=".onProgramChange"
                   showSuggestion="true"
                   suggestionItems="{/Z_I_ProgramVH}">
                <suggestionItems>
                    <core:ListItem text="{ProgramName}" additionalText="{Description}"/>
                </suggestionItems>
            </Input>

            <!-- Ô 3: Variant Name — hỗ trợ F4 popup -->
            <Label text="Variant Name"/>
            <Input value="{local>/variantName}"
                   placeholder="Select variant"
                   showValueHelp="true"
                   required="true"
                   valueHelpRequest=".onVariantValueHelp"/>

        </f:content>
    </f:SimpleForm>
</WizardStep>
```

**Giải thích từng control:**

| Control | Binding | Sự kiện | Ghi chú |
|:---|:---|:---|:---|
| `Input` Job Name | `{local>/jobName}` | `liveChange="onCheckStep1"` | Gõ ký tự nào là kiểm tra ngay có cho sang Step 2 không |
| `Input` Program Name | `{local>/programName}` | `valueHelpRequest=".onProgramValueHelp"` | Bấm icon 🔍 → mở popup F4 tìm Program |
| `Input` Program Name | - | `change=".onProgramChange"` | Gõ trực tiếp → tự động UPPERCASE + reset Variant rỗng |
| `Input` Program Name | - | `showSuggestion="true"` + `suggestionItems="{/Z_I_ProgramVH}"` | Gõ → dropdown gợi ý tên Program từ CDS Backend |
| `Input` Variant Name | `{local>/variantName}` | `valueHelpRequest=".onVariantValueHelp"` | Bấm icon 🔍 → mở popup F4 tìm Variant theo Program đã chọn |

> [!IMPORTANT]
> Tất cả 3 ô đều binding vào `JSONModel` tên **`local`** — Model tạm thời chỉ tồn tại trong trình duyệt, chưa ghi gì xuống Backend.

---

### 1.5 Controller: Khởi tạo JSONModel `local` (`onInit`)

📍 File: [`CreateJob.controller.js`](file:///d:/SAPPJ/abap-rap-backgroundjob-m/project5/webapp/ext/main/CreateJob.controller.js#L14-L25) *(Ctrl + Click)*

```javascript
onInit: function () {
    var oData = {
        jobName:         "",          // → trường Job Name Wizard
        programName:     "",          // → trường Program Name Wizard
        variantName:     "",          // → trường Variant Name Wizard
        startImmediately: true,       // → checkbox Step 2 (mặc định bật)
        startDate:       new Date(),  // → DateTimePicker Step 2 (mặc định giờ hiện tại)
        recurrence:      "Single Run" // → dropdown chu kỳ trong SchedulingDialog
    };
    var oModel = new JSONModel(oData);
    this.getView().setModel(oModel, "local");
}
```

* Hàm này chạy ngay khi trang `CreateJob.view.xml` được load lần đầu.
* `JSONModel` là Model client-side thuần JS, lưu ở RAM trình duyệt, không có kết nối mạng.
* Tên `"local"` là định danh để XML dùng binding `{local>/jobName}` tìm đúng model này.

---

### 1.6 Controller: Validate Step 1 (`onCheckStep1`)

📍 File: [`CreateJob.controller.js`](file:///d:/SAPPJ/abap-rap-backgroundjob-m/project5/webapp/ext/main/CreateJob.controller.js#L27-L35) *(Ctrl + Click)*

```javascript
onCheckStep1: function () {
    var oModel = this.getView().getModel("local");
    var sJob     = oModel.getProperty("/jobName");     // Đọc giá trị ô Job Name
    var sProg    = oModel.getProperty("/programName"); // Đọc giá trị ô Program Name
    var sVariant = oModel.getProperty("/variantName"); // Đọc giá trị ô Variant Name

    // Chỉ cho qua khi CẢ 3 ô đều không rỗng
    var bValid = sJob.length > 0 && sProg.length > 0 && sVariant.length > 0;

    // Mở khoá / khoá nút Next của Wizard
    this.byId("Step1").setValidated(bValid);
}
```

* Được gọi sau mỗi lần user gõ vào ô Job Name (`liveChange`).
* Cũng được gọi sau khi user chọn Program hoặc Variant qua F4 popup.
* `setValidated(false)` → Nút "Next" của Wizard bị vô hiệu hoá (grayed out).
* `setValidated(true)` → Nút "Next" sáng lên, user có thể sang Bước 2.

---

### 1.7 Fragment F4: Program Value Help

📍 File: [`ProgramValueHelp.fragment.xml`](file:///d:/SAPPJ/abap-rap-backgroundjob-m/project5/webapp/ext/fragment/ProgramValueHelp.fragment.xml) *(Ctrl + Click)*

```xml
<TableSelectDialog title="Select Program" contentWidth="800px"
    items="{path: '/Z_I_ProgramVH', sorter: { path: 'ProgramName' }}"
    search=".onProgramSearch"
    confirm=".onProgramConfirm"
    cancel=".onProgramCancel">

    <columns>
        <Column width="40%"><header><Text text="Program Name"/></header></Column>
        <Column width="60%"><header><Text text="Description"/></header></Column>
    </columns>

    <ColumnListItem type="Active">
        <cells>
            <Text text="{ProgramName}"/>
            <Text text="{Description}"/>
        </cells>
    </ColumnListItem>
</TableSelectDialog>
```

* `items="{path: '/Z_I_ProgramVH'}"`: Đọc dữ liệu từ CDS View `Z_I_ProgramVH` trên Backend — trả về danh sách tên Program + Mô tả.
* Popup hiển thị bảng 2 cột: **Program Name** | **Description**.
* User search bằng ô tìm kiếm, bấm chọn 1 dòng → confirm.

**Controller — load và mở popup:**

📍 File: [`CreateJob.controller.js`](file:///d:/SAPPJ/abap-rap-backgroundjob-m/project5/webapp/ext/main/CreateJob.controller.js#L82-L101) *(Ctrl + Click)*

```javascript
onProgramValueHelp: function () {
    var oView = this.getView();

    // Chỉ load Fragment 1 lần duy nhất, lần sau dùng lại instance cũ
    if (!this._pProgramDialog) {
        this._pProgramDialog = Fragment.load({
            id: oView.getId(),
            name: "project5.ext.fragment.ProgramValueHelp",
            controller: this
        }).then(function (oDialog) {
            oView.addDependent(oDialog); // Gắn dialog vào View để quản lý lifecycle
            return oDialog;
        });
    }

    this._pProgramDialog.then(function (oDialog) {
        oDialog.getBinding("items").filter([]); // Xóa filter cũ mỗi lần mở
        oDialog.open();
    });
}
```

**Controller — tìm kiếm trong popup:**

📍 File: [`CreateJob.controller.js`](file:///d:/SAPPJ/abap-rap-backgroundjob-m/project5/webapp/ext/main/CreateJob.controller.js#L103-L115) *(Ctrl + Click)*

```javascript
onProgramSearch: function (oEvent) {
    var sValue = oEvent.getParameter("value"); // Chuỗi user gõ vào ô search
    var aFilters = [];

    if (sValue) {
        // Tìm theo TÊN Program HOẶC MÔ TẢ (OR condition)
        var oFilterName = new Filter("ProgramName", FilterOperator.Contains, sValue);
        var oFilterDesc = new Filter("Description",  FilterOperator.Contains, sValue);
        aFilters.push(new Filter({ filters: [oFilterName, oFilterDesc], and: false }));
    }

    oEvent.getSource().getBinding("items").filter(aFilters);
}
```

**Controller — user chọn xong:**

📍 File: [`CreateJob.controller.js`](file:///d:/SAPPJ/abap-rap-backgroundjob-m/project5/webapp/ext/main/CreateJob.controller.js#L117-L126) *(Ctrl + Click)*

```javascript
onProgramConfirm: function (oEvent) {
    var oSelectedItem = oEvent.getParameter("selectedItem");
    if (oSelectedItem) {
        // Lấy text của cột đầu tiên (Program Name)
        var sProgram = oSelectedItem.getCells()[0].getText();

        var oModel = this.getView().getModel("local");
        oModel.setProperty("/programName", sProgram); // Ghi vào nháp
        oModel.setProperty("/variantName", "");       // Reset Variant vì Program thay đổi

        this.onCheckStep1(); // Kiểm tra lại Step 1 có hợp lệ không
    }
}
```

**Controller — nhập tay Program Name (không dùng F4):**

📍 File: [`CreateJob.controller.js`](file:///d:/SAPPJ/abap-rap-backgroundjob-m/project5/webapp/ext/main/CreateJob.controller.js#L128-L135) *(Ctrl + Click)*

```javascript
onProgramChange: function (oEvent) {
    var sValue = oEvent.getParameter("value");
    if (sValue) {
        // Tự động UPPERCASE vì tên Program trong SAP luôn viết hoa
        this.getView().getModel("local").setProperty("/programName", sValue.toUpperCase());
        // Reset Variant vì Program đã thay đổi
        this.getView().getModel("local").setProperty("/variantName", "");
    }
    this.onCheckStep1();
}
```

---

### 1.8 Fragment F4: Variant Value Help

📍 File: [`VariantValueHelp.fragment.xml`](file:///d:/SAPPJ/abap-rap-backgroundjob-m/project5/webapp/ext/fragment/VariantValueHelp.fragment.xml) *(Ctrl + Click)*

```xml
<TableSelectDialog title="Select Variant" contentWidth="600px"
    items="{path: '/Z_I_VariantVH', sorter: { path: 'VariantName' }}"
    search=".onVariantSearch"
    confirm=".onVariantConfirm"
    cancel=".onVariantCancel">

    <columns>
        <Column width="40%"><header><Text text="Variant Name"/></header></Column>
        <Column width="60%"><header><Text text="Created By"/></header></Column>
    </columns>

    <ColumnListItem type="Active">
        <cells>
            <Text text="{VariantName}"/>
            <Text text="{CreatedBy}"/>
        </cells>
    </ColumnListItem>
</TableSelectDialog>
```

* `items="{path: '/Z_I_VariantVH'}"`: Đọc Variant từ CDS View Backend, **lọc sẵn theo Program đang chọn**.
* Bảng 2 cột: **Variant Name** | **Created By**.

**Controller — load và mở popup Variant:**

📍 File: [`CreateJob.controller.js`](file:///d:/SAPPJ/abap-rap-backgroundjob-m/project5/webapp/ext/main/CreateJob.controller.js#L137-L165) *(Ctrl + Click)*

```javascript
onVariantValueHelp: function () {
    var oView = this.getView();
    var sProgramName = oView.getModel("local").getProperty("/programName");

    // Bắt buộc phải có Program trước mới cho chọn Variant
    if (!sProgramName) {
        sap.m.MessageToast.show("Please enter Program Name before selecting a Variant.");
        return;
    }

    if (!this._pVariantDialog) {
        this._pVariantDialog = Fragment.load({
            id: oView.getId(),
            name: "project5.ext.fragment.VariantValueHelp",
            controller: this
        }).then(function (oDialog) {
            oView.addDependent(oDialog);
            return oDialog;
        });
    }

    this._pVariantDialog.then(function (oDialog) {
        // Lọc danh sách Variant theo Program đang chọn
        var oFilter = new Filter("ProgramName", FilterOperator.EQ, sProgramName);
        oDialog.getBinding("items").filter([oFilter]);
        oDialog.open();
    });
}
```

**Controller — tìm kiếm trong popup Variant:**

📍 File: [`CreateJob.controller.js`](file:///d:/SAPPJ/abap-rap-backgroundjob-m/project5/webapp/ext/main/CreateJob.controller.js#L168-L181) *(Ctrl + Click)*

```javascript
onVariantSearch: function (oEvent) {
    var sValue = oEvent.getParameter("value");
    var sProgramName = this.getView().getModel("local").getProperty("/programName");

    var aFilters = [];
    // Luôn giữ filter Program Name để không hiện Variant của Program khác
    aFilters.push(new Filter("ProgramName", FilterOperator.EQ, sProgramName));

    if (sValue) {
        aFilters.push(new Filter("VariantName", FilterOperator.Contains, sValue));
    }

    oEvent.getSource().getBinding("items").filter(aFilters);
}
```

**Controller — user chọn Variant xong:**

📍 File: [`CreateJob.controller.js`](file:///d:/SAPPJ/abap-rap-backgroundjob-m/project5/webapp/ext/main/CreateJob.controller.js#L183-L191) *(Ctrl + Click)*

```javascript
onVariantConfirm: function (oEvent) {
    var oSelectedItem = oEvent.getParameter("selectedItem");
    if (!oSelectedItem) { return; }

    var sVariant = oSelectedItem.getCells()[0].getText(); // Lấy text cột đầu tiên
    this.getView().getModel("local").setProperty("/variantName", sVariant);
    this.onCheckStep1(); // Validate lại Step 1
}
```

---

### 1.9 UI: Bước 2 — Scheduling Options

📍 File: [`CreateJob.view.xml`](file:///d:/SAPPJ/abap-rap-backgroundjob-m/project5/webapp/ext/main/CreateJob.view.xml#L44-L80) *(Ctrl + Click)*

```xml
<WizardStep id="Step2" title="Scheduling Options" validated="true">

    <!-- Nút mở SchedulingDialog popup -->
    <Toolbar>
        <ToolbarSpacer/>
        <Button text="Define Recurrence Pattern" press=".onOpenScheduleDialog" type="Ghost"/>
    </Toolbar>

    <f:SimpleForm editable="true" layout="ResponsiveGridLayout" columnsXL="2" columnsL="2" columnsM="2">
        <f:content>

            <!-- Dòng 1: Start Immediately -->
            <Label text="Start Immediately"/>
            <CheckBox selected="{local>/startImmediately}" select="onCheckImmediate"/>

            <!-- Dòng 2: Label hiển thị thời gian khi tick Start Immediately -->
            <Label text="Job Start (Local Time)"/>
            <Text text="{path:'local>/startDate', type:'sap.ui.model.type.DateTime', formatOptions:{style:'medium'}}"
                  visible="{= ${local>/startImmediately}}"/>

            <!-- Dòng 3: DateTimePicker — chỉ hiện khi BỎ tick Start Immediately -->
            <Label text="Start"/>
            <DateTimePicker dateValue="{local>/startDate}"
                            displayFormat="dd.MM.yyyy, HH:mm:ss"
                            enabled="{= !${local>/startImmediately}}"
                            visible="{= !${local>/startImmediately}}"/>

            <!-- Dòng 4: Hiển thị chu kỳ lặp đã chọn -->
            <Label text="Recurrence Pattern"/>
            <Text text="{local>/recurrence}"/>

        </f:content>
    </f:SimpleForm>
</WizardStep>
```

**Logic hiển thị Bước 2:**
- Khi **Start Immediately = bật**: Chỉ hiện dòng text "Job Start (Local Time)" với giờ hiện tại. DateTimePicker bị ẩn.
- Khi **Start Immediately = tắt**: DateTimePicker hiện ra để user chọn ngày giờ cụ thể.
- Dòng "Recurrence Pattern" hiển thị kết quả đã chọn trong SchedulingDialog (mặc định "Single Run").

---

### 1.10 Controller: Xử lý Checkbox Start Immediately

📍 File: [`CreateJob.controller.js`](file:///d:/SAPPJ/abap-rap-backgroundjob-m/project5/webapp/ext/main/CreateJob.controller.js#L194-L201) *(Ctrl + Click)*

```javascript
onCheckImmediate: function (oEvent) {
    var bSelected = oEvent.getParameter("selected"); // true/false
    var oModel = this.getView().getModel("local");

    // Khi bật "chạy ngay" → reset ngày giờ về thời điểm hiện tại
    if (bSelected) {
        oModel.setProperty("/startDate", new Date());
    }
}
```

---

### 1.11 Fragment: SchedulingDialog (Cài chu kỳ lặp)

📍 File: [`SchedulingDialog.fragment.xml`](file:///d:/SAPPJ/abap-rap-backgroundjob-m/project5/webapp/ext/fragment/SchedulingDialog.fragment.xml) *(Ctrl + Click)*

```xml
<Dialog title="Scheduling Information" contentWidth="600px">
    <content>
        <f:SimpleForm editable="true" layout="ResponsiveGridLayout">
            <f:content>

                <!-- Checkbox Start Immediately (đồng bộ với Step 2) -->
                <Label text="Start Immediately"/>
                <CheckBox selected="{local>/startImmediately}" select=".onCheckImmediate"/>

                <!-- DateTimePicker chọn giờ -->
                <Label text="Job Start (Local Time)"/>
                <DateTimePicker dateValue="{local>/startDate}"
                                enabled="{= !${local>/startImmediately}}"
                                displayFormat="dd.MM.yyyy, HH:mm:ss"/>

                <!-- Dropdown chọn chu kỳ lặp -->
                <Label text="Recurrence Pattern"/>
                <Select selectedKey="{local>/recurrence}">
                    <items>
                        <core:Item key="Single Run" text="Single Run"/>
                        <core:Item key="Minutes"    text="Minutes"/>
                        <core:Item key="Hourly"     text="Hourly"/>
                        <core:Item key="Daily"      text="Daily"/>
                        <core:Item key="Weekly"     text="Weekly"/>
                        <core:Item key="Monthly"    text="Monthly"/>
                    </items>
                </Select>

                <!-- Ô nhập số lần lặp — chỉ hiện khi KHÔNG phải Single Run -->
                <Label text="Every" visible="{= ${local>/recurrence} !== 'Single Run'}"/>
                <HBox visible="{= ${local>/recurrence} !== 'Single Run'}" alignItems="Center">
                    <Input value="{local>/frequency}" type="Number" width="4rem"/>
                    <!-- Text đơn vị thay đổi theo dropdown -->
                    <Text text="{= ${local>/recurrence} === 'Minutes' ? 'Minute(s)' :
                                   ${local>/recurrence} === 'Hourly'  ? 'Hour(s)'   :
                                   ${local>/recurrence} === 'Daily'   ? 'Day(s)'    :
                                   ${local>/recurrence} === 'Weekly'  ? 'Week(s)'   : 'Month(s)'}"/>
                </HBox>

            </f:content>
        </f:SimpleForm>
    </content>
    <buttons>
        <Button text="OK"                      type="Emphasized" press=".onCloseScheduleDialog"/>
        <Button text="Reset Scheduling Options"                   press=".onResetSchedule"/>
        <Button text="Cancel"                                     press=".onCancelScheduleDialog"/>
    </buttons>
</Dialog>
```

**Giải thích các control trong dialog:**

| Control | Binding | Ghi chú |
|:---|:---|:---|
| CheckBox Start Immediately | `{local>/startImmediately}` | Đồng bộ hai chiều với Step 2 (cùng model `local`) |
| DateTimePicker | `{local>/startDate}` | Bị disable khi Start Immediately bật |
| Select (dropdown) | `{local>/recurrence}` | Options: Single Run / Minutes / Hourly / Daily / Weekly / Monthly |
| Input số lần | `{local>/frequency}` | Chỉ hiện khi recurrence ≠ "Single Run" |
| Text đơn vị | Expression binding | Tự đổi giữa Minute(s)/Hour(s)/Day(s)/Week(s)/Month(s) |

**Controller — mở dialog và backup dữ liệu:**

📍 File: [`CreateJob.controller.js`](file:///d:/SAPPJ/abap-rap-backgroundjob-m/project5/webapp/ext/main/CreateJob.controller.js#L37-L57) *(Ctrl + Click)*

```javascript
onOpenScheduleDialog: function () {
    var oView = this.getView();

    if (!this._pDialog) {
        this._pDialog = Fragment.load({
            id: oView.getId(),
            name: "project5.ext.fragment.SchedulingDialog",
            controller: this
        }).then(function (oDialog) {
            oView.addDependent(oDialog);
            return oDialog;
        });
    }

    // Backup dữ liệu hiện tại — phòng khi user bấm Cancel
    this._oBackupData = JSON.parse(JSON.stringify(oView.getModel("local").getData()));

    this._pDialog.then(function (oDialog) { oDialog.open(); });
}
```

**Controller — bấm OK:**

📍 File: [`CreateJob.controller.js`](file:///d:/SAPPJ/abap-rap-backgroundjob-m/project5/webapp/ext/main/CreateJob.controller.js#L59-L63) *(Ctrl + Click)*

```javascript
onCloseScheduleDialog: function () {
    // Validate lại Step 2 của Wizard (đánh dấu Step 2 đã đủ điều kiện)
    this.byId("CreateJobWizard").validateStep(this.byId("Step2"));
    this._pDialog.then(function (oDialog) { oDialog.close(); });
}
```

**Controller — bấm Cancel (hủy, khôi phục dữ liệu cũ):**

📍 File: [`CreateJob.controller.js`](file:///d:/SAPPJ/abap-rap-backgroundjob-m/project5/webapp/ext/main/CreateJob.controller.js#L66-L73) *(Ctrl + Click)*

```javascript
onCancelScheduleDialog: function () {
    // Khôi phục dữ liệu đã backup trước khi mở dialog
    if (this._oBackupData) {
        this.getView().getModel("local").setData(this._oBackupData);
    }
    this._pDialog.then(function (oDialog) { oDialog.close(); });
}
```

**Controller — bấm Reset (đặt lại về mặc định):**

📍 File: [`CreateJob.controller.js`](file:///d:/SAPPJ/abap-rap-backgroundjob-m/project5/webapp/ext/main/CreateJob.controller.js#L75-L80) *(Ctrl + Click)*

```javascript
onResetSchedule: function () {
    var oModel = this.getView().getModel("local");
    oModel.setProperty("/startImmediately", true);
    oModel.setProperty("/startDate",        new Date());
    oModel.setProperty("/recurrence",       "Single Run");
}
```

---

### 1.12 UI: Footer — Nút Schedule và Cancel

📍 File: [`CreateJob.view.xml`](file:///d:/SAPPJ/abap-rap-backgroundjob-m/project5/webapp/ext/main/CreateJob.view.xml#L85-L90) *(Ctrl + Click)*

```xml
<footer>
    <OverflowToolbar>
        <ToolbarSpacer/>
        <Button text="Schedule" type="Emphasized" press=".onWizardCompleted"/>
        <Button text="Cancel"                     press=".onNavBack"/>
    </OverflowToolbar>
</footer>
```

* Nút **Schedule** (xanh dương đậm) → gọi `onWizardCompleted` — hàm thu thập và gửi dữ liệu.
* Nút **Cancel** → gọi `onNavBack` — quay về danh sách, huỷ mọi dữ liệu nháp.

---

### 1.13 Controller: Bấm Schedule — Thu thập & gửi Request (`onWizardCompleted`)

📍 File: [`CreateJob.controller.js`](file:///d:/SAPPJ/abap-rap-backgroundjob-m/project5/webapp/ext/main/CreateJob.controller.js#L203-L311) *(Ctrl + Click)*

Đây là hàm quan trọng nhất. Chia làm 5 giai đoạn:

**a. Đọc dữ liệu nháp từ JSONModel `local`:**
```javascript
var oLocalData = oView.getModel("local").getData();
// oLocalData = {
//   jobName: "MY_JOB",
//   programName: "ZREPORT_001",
//   variantName: "VAR_01",
//   startImmediately: false,
//   startDate: Date object (ví dụ 2026-04-10 10:30:00 giờ Việt Nam),
//   recurrence: "Daily",
//   frequency: 1
// }
```

**b. Xử lý Date object — đảm bảo hợp lệ:**
```javascript
var oDate = oLocalData.startDate || new Date();
// DateTimePicker đôi khi trả string thay vì Date object
if (typeof oDate === "string") { oDate = new Date(oDate); }
if (!(oDate instanceof Date) || isNaN(oDate.getTime())) { oDate = new Date(); }
```

**c. Convert múi giờ VN (GMT+7) → SAP Server (Europe/Berlin):**

> [!IMPORTANT]
> SAP ABAP Server chạy múi giờ CET (UTC+1 mùa đông / UTC+2 mùa hè). Nếu không convert, Job sẽ bị lên lịch lệch 6-8 tiếng so với ý muốn của user!

```javascript
var oFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',   // Múi giờ của SAP server
    year:'numeric', month:'2-digit', day:'2-digit',
    hour:'2-digit', minute:'2-digit', second:'2-digit',
    hour12: false
});
var aParts = oFormatter.formatToParts(oDate);
var oParts = {};
aParts.forEach(function (p) { oParts[p.type] = p.value; });

var sStartDate = oParts.year + "-" + oParts.month + "-" + oParts.day; // "2026-04-10"
var sStartTime = oParts.hour + ":" + oParts.minute + ":" + oParts.second; // "05:30:00"
// Ví dụ: User chọn 10:30 (VN, GMT+7) → Convert thành 05:30 (Berlin, CET+2)
```

**d. Xử lý IsImmediate và FrequencyType:**
```javascript
// IsImmediate: Metadata Backend khai báo String(1), không dùng Boolean
var sIsImmediate = oLocalData.startImmediately ? "X" : "";
// "X" = chạy ngay, "" = chạy theo lịch

// Mapping Recurrence → FrequencyType + FrequencyValue
var sRecurrence = oLocalData.recurrence || "Single Run";
var sFreqType = "";
var iFreqValue = 0;
switch (sRecurrence) {
    case "Every Minute": sFreqType = "MINUTES"; iFreqValue = 1; break;
    case "Hourly":       sFreqType = "HOURLY";  iFreqValue = 1; break;
    case "Daily":        sFreqType = "DAILY";   iFreqValue = 1; break;
    case "Weekly":       sFreqType = "WEEKLY";  iFreqValue = 1; break;
    case "Monthly":      sFreqType = "MONTHLY"; iFreqValue = 1; break;
    default:             sFreqType = "";         iFreqValue = 0; break; // Single Run
}
```

**e. Tạo OData Action Context và nhét tham số:**
```javascript
// Path của Unbound Action — "/JobList/..." là namespace đầy đủ
var sActionPath = "/JobList/com.sap.gateway.srvd.z_sd_job_ovp.v0001.ScheduleJob(...)";
var oActionContext = oODataModel.bindContext(sActionPath);

oActionContext.setParameter("JobName",       oLocalData.jobName || "New Job");
oActionContext.setParameter("ProgramName",   oLocalData.programName);
oActionContext.setParameter("VariantName",   oLocalData.variantName || "");
oActionContext.setParameter("IsImmediate",   sIsImmediate);    // "X" hoặc ""
oActionContext.setParameter("StartDate",     sStartDate);      // "2026-04-10"
oActionContext.setParameter("StartTime",     sStartTime);      // "05:30:00"
oActionContext.setParameter("FrequencyType", sFreqType);       // "" / "DAILY" / "WEEKLY" ...
oActionContext.setParameter("FrequencyValue", iFreqValue);     // 0, 1 ...
```

**f. Gọi execute và xử lý kết quả:**
```javascript
oView.setBusy(true); // Hiện spinner loading toàn trang

oActionContext.execute()
    .then(function () {
        // ✅ THÀNH CÔNG
        MessageToast.show("Job created successfully!");
        that.onNavBack(); // Quay về trang danh sách
    })
    .catch(function (oError) {
        // ❌ THẤT BẠI
        console.error("Job Creation Failed:", oError);
        var sErrorMsg = "Unknown error occurred.";
        if (oError.error && oError.error.message) {
            sErrorMsg = oError.error.message;
        } else if (oError.message) {
            sErrorMsg = oError.message;
        }
        MessageBox.error("Failed to schedule job.\n\n" + sErrorMsg);
    })
    .finally(function () {
        oView.setBusy(false); // Tắt spinner dù thành công hay thất bại
    });
```

---

### 1.14 Controller: Quay về danh sách (`onNavBack`)

📍 File: [`CreateJob.controller.js`](file:///d:/SAPPJ/abap-rap-backgroundjob-m/project5/webapp/ext/main/CreateJob.controller.js#L315-L325) *(Ctrl + Click)*

```javascript
onNavBack: function () {
    // 1. Điều hướng Router về trang danh sách
    var oRouter = this.getOwnerComponent().getRouter();
    oRouter.navTo("JobListMain");

    // 2. Xóa sạch dữ liệu nháp (gọi lại onInit)
    this.onInit();

    // 3. Reset trạng thái Wizard về Bước 1
    var oWizard = this.byId("CreateJobWizard");
    if (oWizard) {
        var oStep1 = this.byId("Step1");
        oWizard.discardProgress(oStep1); // Đưa Wizard về Step1, xóa progress
    }
}
```

---

## 2. ODATA GATEWAY (Cổng Giao Tiếp)

HTTP POST `ScheduleJob(...)` đi qua chuỗi các lớp kiểm soát theo thứ tự:

| Lớp | Object | Công dụng |
|:---|:---|:---|
| Service Binding | `ZUI_JOB_MANAGE01_O4` | Endpoint OData V4 công khai ra bên ngoài — xác nhận URL + phương thức HTTP hợp lệ |
| Service Definition | `Z_SD_JOB_OVP` | Khai báo những thực thể và Action nào được phép expose (gồm `JobList` và `ScheduleJob`) |
| CDS Projection | `Z_C_JOB_OVP_LIST` | Vùng đệm UI layer — expose action `ScheduleJob` qua `use action` |
| Behavior Definition | `Z_C_JOB_OVP_LIST` (BDEF) | Khai báo `use action ScheduleJob` chuyển tiếp lên Interface layer |
| Interface BDEF | `Z_I_BACKGROUNDJOB` | Định nghĩa `action ScheduleJob parameter Z_A_JOB_REQ;` — Parameter Type là cấu trúc `Z_A_JOB_REQ` |

Hoàn tất xác minh tại Gateway, request được route vào Implementation Class ABAP.

---

## 3. BACKEND (ABAP RAP — Khối Cốt Lõi)

### 3.1 Behavior Implementation: Logic ScheduleJob — `ZBP_I_BACKGROUNDJOB`

Tham số nhận vào tự động từ RAP Framework:
- `keys`: Mảng key của entity — ở đây không dùng vì ScheduleJob là **Unbound Action** (không cần chọn Job trước).
- `%param`: Cấu trúc kiểu `Z_A_JOB_REQ` nhận tất cả tham số FE đẩy lên.

```abap
METHOD ScheduleJob.
  DATA(ls_param) = keys[ 1 ]-%param.
  " ls_param chứa:
  "   ls_param-JobName       = "MY_JOB"
  "   ls_param-ProgramName   = "ZREPORT_001"
  "   ls_param-VariantName   = "VAR_01"
  "   ls_param-IsImmediate   = "X" hoặc ""
  "   ls_param-StartDate     = "2026-04-10" (giờ Berlin)
  "   ls_param-StartTime     = "053000"
  "   ls_param-FrequencyType = "DAILY" / "" ...
  "   ls_param-FrequencyValue = 1 / 0 ...

  DATA: lv_jobcount  TYPE btcjobcnt,
        lv_startdate TYPE btcsdate,
        lv_starttime TYPE btcstime,
        lv_immediate TYPE btcimmed VALUE space.

  " ── 1. JOB_OPEN: Đăng ký Job, SAP cấp phát JobCount mới ──
  CALL FUNCTION 'JOB_OPEN'
    EXPORTING
      jobname  = ls_param-JobName
    IMPORTING
      jobcount = lv_jobcount    " SAP trả về ID mới, ví dụ '09444500'
    EXCEPTIONS
      OTHERS   = 1.

  IF sy-subrc <> 0.
    " Báo lỗi về RAP Framework
    APPEND VALUE #( %tky = keys[1]-%tky ) TO failed-joblist.
    RETURN.
  ENDIF.

  " ── 2. JOB_SUBMIT: Gắn Program + Variant vào JobCount ──
  CALL FUNCTION 'JOB_SUBMIT'
    EXPORTING
      jobname    = ls_param-JobName
      jobcount   = lv_jobcount
      report     = ls_param-ProgramName   " Tên ABAP Program
      variant    = ls_param-VariantName   " Tên Variant
    EXCEPTIONS
      OTHERS     = 1.

  IF sy-subrc <> 0.
    APPEND VALUE #( %tky = keys[1]-%tky ) TO failed-joblist.
    RETURN.
  ENDIF.

  " ── 3. JOB_CLOSE: Set lịch chạy → Status 'S' (Scheduled) ──
  IF ls_param-IsImmediate = 'X'.
    lv_immediate = 'X'.  " Chạy ngay lập tức
  ELSE.
    " Convert StartDate/StartTime từ String → ABAP Date/Time type
    lv_startdate = ls_param-StartDate.
    lv_starttime = ls_param-StartTime.
  ENDIF.

  CALL FUNCTION 'JOB_CLOSE'
    EXPORTING
      jobname   = ls_param-JobName
      jobcount  = lv_jobcount
      strtimmed = lv_immediate   " Chạy ngay: 'X'
      sdlstrtdt = lv_startdate   " Ngày hẹn (nếu không chạy ngay)
      sdlstrttm = lv_starttime   " Giờ hẹn (nếu không chạy ngay)
    EXCEPTIONS
      OTHERS    = 1.

  IF sy-subrc <> 0.
    APPEND VALUE #( %tky = keys[1]-%tky ) TO failed-joblist.
    RETURN.
  ENDIF.

  " ── 4. Xử lý lặp (Recurrence) nếu có ──
  IF ls_param-FrequencyType IS NOT INITIAL.
    " Tuỳ FrequencyType: set prddays / prdhours / prdmins / prdweeks / prdmonths
    " Ghi thêm vào TBTCO record vừa tạo bằng lệnh UPDATE
    UPDATE tbtco
      SET prddays  = CASE ls_param-FrequencyType WHEN 'DAILY'   THEN ls_param-FrequencyValue ELSE 0 END
          prdhours = CASE ls_param-FrequencyType WHEN 'HOURLY'  THEN ls_param-FrequencyValue ELSE 0 END
          periodic = 'X'  " Đánh dấu là Job lặp
      WHERE jobname  = ls_param-JobName
        AND jobcount = lv_jobcount.
  ENDIF.

  " ── 5. Báo thành công về RAP Framework ──
  APPEND VALUE #(
      %tky   = keys[1]-%tky
      %param = VALUE #( JobName  = ls_param-JobName
                        JobCount = lv_jobcount )
  ) TO result.

ENDMETHOD.
```

### 3.2 Bảng DB được ghi khi Create Job

| Bảng SAP | FM ghi vào | Nội dung được ghi |
|:---|:---|:---|
| `TBTCO` | `JOB_OPEN` + `JOB_CLOSE` | Record Job chính: JobName, JobCount, Status (`S`), StartDate, StartTime, Creator |
| `TBTCP` | `JOB_SUBMIT` | Chi tiết Job Step: ProgramName, VariantName, StepCount |

### 3.3 Function Module SAP chuẩn được dùng

| Function Module | Package SAP | Công dụng |
|:---|:---|:---|
| `JOB_OPEN` | `BCJOB` | Mở phiên làm việc — SAP allocate một `JobCount` ID trống mới |
| `JOB_SUBMIT` | `BCJOB` | Gắn Program Name + Variant vào Job ID đã tạo, ghi vào `TBTCP` |
| `JOB_CLOSE` | `BCJOB` | Finalize Job — set StartDate/StartTime, đổi Status thành `S`, ghi record vào `TBTCO` |

---

## 4. FRONTEND (Giai đoạn Nhận Kết Quả)

📍 File: [`CreateJob.controller.js`](file:///d:/SAPPJ/abap-rap-backgroundjob-m/project5/webapp/ext/main/CreateJob.controller.js#L278-L325) *(Ctrl + Click)*

Khi `.execute()` nhận phản hồi thành công (HTTP 2xx):

1. **`MessageToast.show("Job created successfully!")`** — Thông báo xanh lá xuất hiện góc dưới màn hình trong 3 giây.
2. **`onNavBack()`** được gọi ngay sau:
   - `oRouter.navTo("JobListMain")` → Quay về trang danh sách.
   - `onInit()` → Xóa sạch dữ liệu nháp trong JSONModel `local` (reset về rỗng để lần tới mở lại sạch).
   - `oWizard.discardProgress(oStep1)` → Đưa Wizard về Bước 1, xóa progress.
3. Trang danh sách tự **Refresh** vì navigate về sẽ trigger reload OData binding → Job mới xuất hiện trong bảng với Status `S (Released)`.

---

## 5. TÓM LƯỢC QUÁ TRÌNH

| Bước | Luồng đi | Nơi thực thi | Kết quả |
|:---|:---|:---|:---|
| 1 | Bấm nút Schedule | `Main.view.xml` | Kích hoạt `onCreateJob` |
| 2 | Navigate | `Main.controller.js` | Router chuyển sang `CreateJob.view.xml` |
| 3 | `onInit` tự chạy | `CreateJob.controller.js` | Tạo JSONModel `local` với dữ liệu mặc định |
| 4 | Nhập Job Name | `CreateJob.view.xml` Step1 | Lưu vào `local>/jobName`, `onCheckStep1` validate |
| 5 | F4 chọn Program | `ProgramValueHelp.fragment.xml` | Gọi CDS `Z_I_ProgramVH`, user chọn → ghi `local>/programName` |
| 6 | F4 chọn Variant | `VariantValueHelp.fragment.xml` | Gọi CDS `Z_I_VariantVH` (lọc theo Program), user chọn → ghi `local>/variantName` |
| 7 | Step1 valid → Next | Wizard | `setValidated(true)` mở khoá nút Next |
| 8 | Cài lịch (tuỳ chọn) | `SchedulingDialog.fragment.xml` | Chọn StartDate + Recurrence → ghi `local>/startDate`, `local>/recurrence` |
| 9 | Bấm Schedule | `CreateJob.controller.js` | Đọc `local`, convert múi giờ, tạo OData Action |
| 10 | HTTP POST | OData Gateway | Routing qua Service Binding → BDEF → Implementation |
| 11 | Gọi FM chuẩn SAP | `ZBP_I_BACKGROUNDJOB` | `JOB_OPEN` → `JOB_SUBMIT` → `JOB_CLOSE` → ghi `TBTCO`/`TBTCP` |
| 12 | Trả HTTP 2xx | ABAP RAP → Gateway → FE | Response thành công |
| 13 | Nhận kết quả | `CreateJob.controller.js` | MessageToast "Job created successfully!" |
| 14 | Quay về | `CreateJob.controller.js` | `onNavBack()` → danh sách refresh → Job mới hiện Status `S` |
