sap.ui.define(
    [
        'sap/fe/core/PageController',
        "sap/m/MessageToast",
        "sap/m/MessageBox",
        "sap/ui/model/Filter",
        "sap/ui/model/FilterOperator",
        "sap/ui/core/Fragment",
        "sap/ui/core/BusyIndicator"
    ],
    function (PageController, MessageToast, MessageBox, Filter, FilterOperator, Fragment, BusyIndicator) {
        'use strict';

        return PageController.extend('project5.ext.main.Main', {

            // ==================== REFRESH ====================
            onRefreshTable: function () {
                this._refreshTable();
            },

            // ==================== MANAGE MENU ====================
            onOpenManageMenu: function (oEvent) {
                var oButton = oEvent.getSource();
                var oActionSheet = this.byId("manageActionSheet");
                oActionSheet.openBy(oButton);
            },

            // ==================== RELEASE JOB ====================
            onReleaseJob: function () {
                var oTable = this.byId("Table");
                var aSelectedContexts = oTable.getSelectedContexts();

                if (aSelectedContexts.length === 0) {
                    MessageToast.show("Please select a job.");
                    return;
                }

                this._openActionDialog(
                    "com.sap.gateway.srvd.z_sd_job_ovp.v0001.ReleaseJob",
                    "Define Start Condition"
                );
            },

            // ==================== HELPER: Open Action Dialog ====================
            _openActionDialog: function (sActionName, sTitle) {
                var oTable = this.byId("Table");
                var aSelectedContexts = oTable.getSelectedContexts();

                if (aSelectedContexts.length === 0) {
                    MessageToast.show("Please select a job.");
                    return;
                }

                // Lưu Action Name hiện tại để sử dụng trong onConfirmRelease
                this._sCurrentAction = sActionName;
                // Lưu Selected Contexts
                this._selectedContexts = aSelectedContexts;

                if (this._pReleaseDialog) {
                    this._pReleaseDialog.then(function (oDialog) {
                        oDialog.setTitle(sTitle);
                        if (!oDialog.isOpen()) {
                            oDialog.open();
                        }
                    });
                    return;
                }

                this._pReleaseDialog = Fragment.load({
                    id: this.getView().getId(),
                    name: "project5.ext.fragment.ReleaseDialog",
                    controller: this
                }).then(function (oDialog) {
                    this.getView().addDependent(oDialog);
                    oDialog.setTitle(sTitle);
                    oDialog.open();
                    return oDialog;
                }.bind(this));
            },

            onConfirmRelease: function () {
                var that = this;

                if (this._bConfirmInFlight) {
                    return;
                }
                this._bConfirmInFlight = true;

                var aSelectedContexts = this._selectedContexts || [];

                if (!aSelectedContexts.length) {
                    MessageToast.show("Please select a job.");
                    this._bConfirmInFlight = false;
                    return;
                }

                // --- 1. LẤY GIÁ TRỊ THÔ TỪ UI ---
                var sRawDate = this.byId("idReleaseDate") ? this.byId("idReleaseDate").getValue() : "";     // "2026-03-18"
                var sRawTime = this.byId("idReleaseTime") ? this.byId("idReleaseTime").getValue() : "";     // "05:00:00"
                var bIsImmediate = this.byId("idImmedCheck") ? this.byId("idImmedCheck").getSelected() : false;

                // --- 2. ĐỊNH DẠNG CHO CHUẨN ODATA V4 VÀ ĐỔI MÚI GIỜ (GIỐNG CREATE JOB) ---
                var sSapDate = "";
                var sSapTime = "";
                var oDate = null;

                if (bIsImmediate) {
                    oDate = new Date(); // Lấy giờ hiện tại 
                } else if (sRawDate && sRawTime) {
                    // Chuyển chuỗi từ UI (local time ghép từ YYYY-MM-DD và HH:mm:ss) sang Date object
                    oDate = new Date(sRawDate + "T" + sRawTime);
                }

                if (oDate && !isNaN(oDate.getTime())) {
                    // Convert local time → SAP server time (Europe/Berlin)
                    var oFormatter = new Intl.DateTimeFormat('en-CA', {
                        timeZone: 'Europe/Berlin',
                        year: 'numeric', month: '2-digit', day: '2-digit',
                        hour: '2-digit', minute: '2-digit', second: '2-digit',
                        hour12: false
                    });
                    var aParts = oFormatter.formatToParts(oDate);
                    var oParts = {};
                    aParts.forEach(function (p) { oParts[p.type] = p.value; });

                    sSapDate = oParts.year + "-" + oParts.month + "-" + oParts.day;
                    sSapTime = oParts.hour + ":" + oParts.minute + ":" + oParts.second;
                }

                // --- 4. VALIDATE: Nếu không phải Immediate thì phải có Date và Time ---
                if (!bIsImmediate && (!sSapDate || !sSapTime)) {
                    MessageToast.show("Please enter start date and start time.");
                    this._bConfirmInFlight = false;
                    return;
                }

                var aParameterValues = [
                    { name: "IsImmediate", value: bIsImmediate },
                    { name: "StartDate", value: sSapDate },
                    { name: "StartTime", value: sSapTime },
                    { name: "AfterJobName", value: this.byId("idAfterJobName") ? this.byId("idAfterJobName").getValue() : "" },
                    { name: "EventID", value: this.byId("idEventID") ? this.byId("idEventID").getValue() : "" },
                    { name: "EventParam", value: this.byId("idEventParam") ? this.byId("idEventParam").getValue() : "" }
                ];

                var oMessageModel = sap.ui.getCore().getMessageManager().getMessageModel();
                var fnGetMessages = function () {
                    if (!oMessageModel || typeof oMessageModel.getData !== "function") {
                        return [];
                    }
                    var aMessages = oMessageModel.getData();
                    return Array.isArray(aMessages) ? aMessages : [];
                };
                var iMessageCountBefore = fnGetMessages().length;

                BusyIndicator.show(0);

                // --- DÙNG EXTENSION API VỚI ACTION ĐỘNG TỪ this._sCurrentAction ---
                var oExtensionAPI = this.getExtensionAPI();
                var sCurrentAction = this._sCurrentAction || "com.sap.gateway.srvd.z_sd_job_ovp.v0001.ReleaseJob";

                oExtensionAPI.editFlow.invokeAction(sCurrentAction, {
                    contexts: aSelectedContexts,
                    parameterValues: aParameterValues,
                    skipParameterDialog: true
                }).then(function () {
                    BusyIndicator.hide();

                    var aNewMessages = fnGetMessages().slice(iMessageCountBefore);
                    var bHasNewError = aNewMessages.some(function (oMsg) {
                        var sType = (oMsg && oMsg.type ? oMsg.type : "").toLowerCase();
                        return sType === "error";
                    });

                    var bHasProviderError = aNewMessages.some(function (oMsg) {
                        var sText = oMsg && oMsg.message ? oMsg.message : "";
                        return /unspecified provider error occurred/i.test(sText);
                    });

                    if (bHasNewError || bHasProviderError) {
                        console.warn("Action returned error messages, success toast suppressed.", aNewMessages);
                        that._bConfirmInFlight = false;
                        that._refreshTable();
                        return;
                    }

                    var sActionLabel = (sCurrentAction.indexOf("Repeat") !== -1) ? "Repeat Job" : "Release Job";
                    MessageToast.show(sActionLabel + " completed successfully.");
                    that._bConfirmInFlight = false;
                    that.onCloseReleaseDialog();
                    that._refreshTable();
                }).catch(function (oError) {
                    BusyIndicator.hide();
                    that._bConfirmInFlight = false;
                    var sErrMsg = oError && oError.message ? oError.message : "Please try again.";

                    // Bỏ qua lỗi đồng bộ trạng thái action (metadata/cache) để tránh popup lỗi xám.
                    if (sErrMsg.toLowerCase().includes("enabled")) {
                        console.log("System state was refreshed.");
                        return;
                    }

                    console.error("Action error details:", oError);
                    MessageBox.error("Execution failed: " + sErrMsg);
                });
            },

            onCloseReleaseDialog: function () {
                if (!this._pReleaseDialog) {
                    return;
                }

                this._pReleaseDialog.then(function (oDialog) {
                    if (oDialog && oDialog.isOpen()) {
                        oDialog.close();
                    }
                }.bind(this));
            },

            // ==================== HELPER: Gọi Bound Action cho nhiều dòng (DỄ HIỂU) ====================
            _executeAction: async function (aContexts, sActionName, sLabel, oOptions) {
                var aSuccess = [];
                var aFailed = [];

                // --- 0. Dọn dẹp các thông báo lỗi cũ trên giao diện (để không bị hiện thanh thông báo đỏ/vàng) ---
                var oMessageManager = sap.ui.getCore().getMessageManager();
                oMessageManager.removeAllMessages();

                // Chạy từng Job một (Tuần tự) để tránh lỗi Batch SAP
                for (var oContext of aContexts) {
                    var sJobName = oContext.getProperty("JobName") || "(unknown)";
                    try {
                        var oActionContext = oContext.getModel().bindContext(sActionName + "(...)", oContext);
                        await oActionContext.execute(); // Chờ thằng này chạy xong mới qua thằng kế
                        aSuccess.push(sJobName);
                    } catch (oError) {
                        var sErr = oError?.error?.message || oError?.message || "Unknown error";
                        aFailed.push({ name: sJobName, error: sErr });
                    }
                }

                // Hiển thị kết quả sau khi chạy xong hết
                if (aSuccess.length > 0) {
                    MessageToast.show(sLabel + " xong cho: " + aSuccess.join(", "));
                }
                if (aFailed.length > 0) {
                    var sErrors = aFailed.map(function (r) { return "• " + r.name + ": " + r.error; }).join("\n");
                    MessageBox.error(sLabel + " thất bại cho " + aFailed.length + " job:\n\n" + sErrors);
                }

                this._refreshTable();
            },

            // ==================== REPEAT JOB ====================
            onRepeatJob: function () {
                var oTable = this.byId("Table");
                var aSelectedContexts = oTable.getSelectedContexts();

                if (aSelectedContexts.length === 0) {
                    MessageToast.show("Please select at least one job to repeat.");
                    return;
                }

                this._openActionDialog(
                    "com.sap.gateway.srvd.z_sd_job_ovp.v0001.RepeatWithSchedule",
                    "Define Start Condition for Repeat Job"
                );
            },

            // ==================== COPY & RENAME JOB ====================
            onCopyWithRename: function () {
                var aSelectedContexts = this.byId("Table").getSelectedContexts();

                if (aSelectedContexts.length === 0) {
                    MessageToast.show("Please select at least one job to copy.");
                    return;
                }

                var that = this;
                var oExtensionAPI = this.getExtensionAPI();

                // Tên Action đầy đủ (Namespace.Action)
                var sActionName = "com.sap.gateway.srvd.z_sd_job_ovp.v0001.CopyJob";

                // Gọi CopyJob Action - SAP sẽ tự động bật Popup dựa trên Abstract Entity
                // để nhập tham số NewJobName
                oExtensionAPI.editFlow.invokeAction(sActionName, {
                    contexts: [aSelectedContexts[0]] // Truyền Context của dòng được chọn
                }).then(function () {
                    // Thành công
                    MessageToast.show("Copy and Rename completed successfully.");

                    // Job mới có thể có StartDate rỗng nên cần bỏ lọc StartDate để không bị ẩn.
                    that._clearStartDateFilter();
                    that._refreshTable();
                }).catch(function (err) {
                    // Nếu user cancel hoặc lỗi
                    console.error("Copy Job error:", err);
                    if (err && err.message && err.message.indexOf("cancelled") === -1) {
                        MessageBox.error("Copy Job failed: " + (err.message || "Please try again."));
                    }
                });
            },

            _clearStartDateFilter: function () {
                var oMacroFilterBar = this.byId("FilterBar");
                if (!oMacroFilterBar || typeof oMacroFilterBar.getContent !== "function") {
                    return false;
                }

                var oFilterBar = oMacroFilterBar.getContent();
                if (!oFilterBar) {
                    return false;
                }

                var bChanged = false;

                // sap.ui.mdc.FilterBar API
                if (typeof oFilterBar.getFilterConditions === "function" && typeof oFilterBar.setFilterConditions === "function") {
                    var mConditions = oFilterBar.getFilterConditions() || {};
                    if (mConditions.StartDate && mConditions.StartDate.length) {
                        var mUpdatedConditions = Object.assign({}, mConditions);
                        delete mUpdatedConditions.StartDate;
                        oFilterBar.setFilterConditions(mUpdatedConditions);
                        bChanged = true;
                    }
                }

                // Fallback cho ConditionModel
                if (!bChanged && typeof oFilterBar.getConditionModel === "function") {
                    var oConditionModel = oFilterBar.getConditionModel();
                    if (
                        oConditionModel &&
                        typeof oConditionModel.getConditions === "function" &&
                        typeof oConditionModel.removeAllConditions === "function"
                    ) {
                        var aStartDateConditions = oConditionModel.getConditions("StartDate");
                        if (aStartDateConditions && aStartDateConditions.length) {
                            oConditionModel.removeAllConditions("StartDate");
                            bChanged = true;
                        }
                    }
                }

                return bChanged;
            },

            // ==================== HELPER: Refresh Table ====================
            _refreshTable: function () {
                var oTable = this.byId("Table");
                if (oTable) {
                    var oContent = oTable.getContent();
                    if (oContent) {
                        var oBinding = oContent.getBinding("rows") || oContent.getBinding("items");
                        if (!oBinding && typeof oContent.getRowBinding === "function") {
                            oBinding = oContent.getRowBinding();
                        }
                        if (oBinding) {
                            oBinding.refresh();
                        }
                    }
                }
            },

            // ==================== STOP JOB (với Confirmation) ====================
            onStopJob: function () {
                var oTable = this.byId("Table");
                var aSelectedContexts = oTable.getSelectedContexts();

                if (aSelectedContexts.length === 0) {
                    MessageToast.show("Please select at least one job to stop.");
                    return;
                }

                var iCount = aSelectedContexts.length;
                var sMessage = "Do you want to stop " + iCount + " selected job(s)?";

                var that = this;
                MessageBox.confirm(sMessage, {
                    title: "Confirm Stop Job",
                    emphasizedAction: MessageBox.Action.OK,
                    onClose: function (sAction) {
                        if (sAction === MessageBox.Action.OK) {
                            that._executeAction(aSelectedContexts, "com.sap.gateway.srvd.z_sd_job_ovp.v0001.StopJob", "Stop");
                        }
                    }
                });
            },

            // ==================== DELETE JOB (với Confirmation) ====================
            onDeleteJob: function () {
                var oTable = this.byId("Table");
                var aSelectedContexts = oTable.getSelectedContexts();
                if (aSelectedContexts.length === 0) {
                    MessageToast.show("Please select at least one job to delete.");
                    return;
                }

                var iCount = aSelectedContexts.length;
                var sMessage = "Do you want to delete " + iCount + " selected job(s)?";

                var that = this;
                MessageBox.confirm(sMessage, {
                    title: "Confirm Delete Job",
                    emphasizedAction: MessageBox.Action.OK,
                    onClose: function (sAction) {
                        if (sAction === MessageBox.Action.OK) {
                            that._executeAction(aSelectedContexts, "com.sap.gateway.srvd.z_sd_job_ovp.v0001.DeleteJob", "Delete");
                        }
                    }
                });
            },


            onCreateJob: function (oEvent) {

                var oExtensionAPI = this.getExtensionAPI();

                if (oExtensionAPI && oExtensionAPI.routing) {
                    oExtensionAPI.routing.navigateToRoute("CreateJobRoute");
                } else {
                    console.error("ExtensionAPI routing is not available.");
                }
            },

            onFilterOwnJobs: function () {
                var sCurrentUser = "";

                // 1. Lấy user đang đăng nhập (Trong Fiori Launchpad hoặc Sandbox)
                if (sap.ushell && sap.ushell.Container) {
                    sCurrentUser = sap.ushell.Container.getService("UserInfo").getId();
                } else {
                    // Nếu chạy chay (index.html) không có FLP, đành chịu không biết ai đăng nhập
                    sCurrentUser = "";
                    MessageToast.show("Warning: Not running in Fiori Launchpad. Cannot detect current user.");
                }

                if (!sCurrentUser) {
                    return; // Nếu không biết user là ai thì không filter được
                }

                // 2. Tìm binding của bảng
                var oMacroTable = this.byId("Table");
                if (!oMacroTable) { return; }

                var oInnerTable = oMacroTable.getContent();
                var oBinding = null;
                if (oInnerTable) {
                    oBinding = oInnerTable.getBinding("rows") || oInnerTable.getBinding("items");
                }
                if (!oBinding && oInnerTable && typeof oInnerTable.getRowBinding === "function") {
                    oBinding = oInnerTable.getRowBinding();
                }

                // 3. Toggle filter: press 1 → filter, press 2 → clear
                if (oBinding) {
                    if (this._bFilteringOwnJobs) {
                        oBinding.filter([], "Application");
                        this._bFilteringOwnJobs = false;
                        MessageToast.show("Showing all jobs.");
                    } else {
                        var oFilter = new Filter("CreatedBy", FilterOperator.EQ, sCurrentUser);
                        oBinding.filter(oFilter, "Application");
                        this._bFilteringOwnJobs = true;
                        MessageToast.show("Filtering jobs by: " + sCurrentUser);
                    }
                }
            },
            // --- THÊM HÀM NÀY ĐỂ ĐIỀU HƯỚNG SANG TRANG DETAIL (GIỐNG SM37) ---
            onRowPress: function (oEvent) {
                var oContext = oEvent.getParameters().bindingContext || oEvent.getSource().getBindingContext();
                if (!oContext) {
                    return;
                }

                var oExtensionAPI = this.getExtensionAPI();
                if (oExtensionAPI && oExtensionAPI.routing) {

                    // 1. Lấy đường dẫn Context (Path)
                    // Ví dụ sPath: "/JobList(JobName='BJSM_TEST',JobCount='000001')"
                    var sPath = oContext.getPath();

                    // 2. Tách lấy phần Key nằm trong ngoặc đơn
                    var sKey = sPath.substring(sPath.indexOf("(") + 1, sPath.indexOf(")"));

                    // 3. Điều hướng sang Object Page đã khai báo trong manifest.json
                    // Tên route "JobListObjectPage" và biến "JobListKey" phải khớp với manifest
                    oExtensionAPI.routing.navigateToRoute("JobListObjectPage", {
                        "JobListKey": sKey
                    });
                }
            },

            // ==================== OPEN ANALYTICS MENU ====================
            onOpenAnalyticsMenu: function(e) { this.byId("analyticsActionSheet").openBy(e.getSource()); },
            onOpenDashboard: function() {
                window.open("https://s40lp1.ucc.cit.tum.de/sap/bc/ui2/flp?sap-client=324&sap-language=EN#ZSO_JOB_F0703-display", "_self");
            },
            onOpenAnalytics: function() {
                window.open("/sap/bc/ui5_ui5/sap/zui_j_analytics/?sap-client=324&sap-language=EN#/?sap-iapp-state--history=1", "_self");
            },

            onAfterRendering: function () {
                var oMacroTable = this.byId("Table");
                if (oMacroTable) {
                    // Try to wait for the macro content (which is an MDC table)
                    var oContent = oMacroTable.getContent();
                    if (oContent) {
                        // Check if it is an MDC Table and has setSelectionMode
                        if (typeof oContent.setSelectionMode === 'function') {
                            oContent.setSelectionMode("Multi");
                        }
                    }
                }
            }
        });
    }
);
