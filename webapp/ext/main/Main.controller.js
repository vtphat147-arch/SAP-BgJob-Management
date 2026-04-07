sap.ui.define(
    [
        'sap/fe/core/PageController',
        "sap/m/MessageToast",
        "sap/m/MessageBox",
        "sap/ui/model/Filter",
        "sap/ui/model/FilterOperator",
        "sap/ui/core/Fragment"
    ],
    function (PageController, MessageToast, MessageBox, Filter, FilterOperator, Fragment) {
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

                // --- 2. ĐỊNH DẠNG LẠI CHO CHUẨN SAP (YYYYMMDD và HHMMSS) ---
                // Xóa bỏ các dấu ngăn cách (- và :)
                var sSapDate = sRawDate ? sRawDate.replace(/-/g, "") : "";
                var sSapTime = sRawTime ? sRawTime.replace(/:/g, "") : "";

                // --- 3. NẾU LÀ IMMEDIATE THÌ ÉP NGÀY GIỜ LÀ HÔM NAY + HIỆN TẠI ---
                if (bIsImmediate) {
                    var oNow = new Date();
                    // Lấy ngày hôm nay: YYYYMMDD
                    var iYear = oNow.getFullYear();
                    var iMonth = String(oNow.getMonth() + 1).padStart(2, "0");
                    var iDay = String(oNow.getDate()).padStart(2, "0");
                    sSapDate = iYear + iMonth + iDay;

                    // Lấy giờ hiện tại: HHMMSS
                    var iHour = String(oNow.getHours()).padStart(2, "0");
                    var iMin = String(oNow.getMinutes()).padStart(2, "0");
                    var iSec = String(oNow.getSeconds()).padStart(2, "0");
                    sSapTime = iHour + iMin + iSec;
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

                sap.ui.core.BusyIndicator.show(0);

                // --- DÙNG EXTENSION API VỚI ACTION ĐỘNG TỪ this._sCurrentAction ---
                var oExtensionAPI = this.getExtensionAPI();
                var sCurrentAction = this._sCurrentAction || "com.sap.gateway.srvd.z_sd_job_ovp.v0001.ReleaseJob";

                oExtensionAPI.editFlow.invokeAction(sCurrentAction, {
                    contexts: aSelectedContexts,
                    parameterValues: aParameterValues,
                    skipParameterDialog: true
                }).then(function () {
                    sap.ui.core.BusyIndicator.hide();

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
                    sap.ui.core.BusyIndicator.hide();
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

            // ==================== HELPER: Gọi Bound Action cho nhiều dòng ====================
            _executeAction: function (aContexts, sActionName, sLabel, oOptions) {
                var that = this;
                var aPromises = aContexts.map(function (oContext) {
                    var oActionContext = oContext.getModel().bindContext(
                        sActionName + "(...)", oContext
                    );
                    return oActionContext.execute().then(function () {
                        return { success: true, name: oContext.getProperty("JobName") };
                    }).catch(function (oError) {
                        return { success: false, name: oContext.getProperty("JobName"), error: oError.message };
                    });
                });

                Promise.all(aPromises).then(function (aResults) {
                    var aSuccess = aResults.filter(function (r) { return r.success; });
                    var aFailed = aResults.filter(function (r) { return !r.success; });

                    if (aSuccess.length > 0) {
                        MessageToast.show(sLabel + " completed for " + aSuccess.length + " job(s).");
                    }
                    if (aFailed.length > 0) {
                        var sErrors = aFailed.map(function (r) { return r.name + ": " + r.error; }).join("\n");
                        MessageBox.error(sLabel + " failed:\n" + sErrors);
                    }

                    // Với action tạo mới bản ghi (vd Repeat), bỏ lọc StartDate để không ẩn dòng mới.
                    if (aSuccess.length > 0 && oOptions && oOptions.clearStartDateFilter) {
                        that._clearStartDateFilter();
                    }

                    // Refresh bảng sau khi thực hiện
                    that._refreshTable();
                });
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
                var sCurrentUser;

                // 1. Lấy user đang đăng nhập
                if (sap.ushell && sap.ushell.Container) {
                    sCurrentUser = sap.ushell.Container.getService("UserInfo").getId();
                } else {
                    sCurrentUser = "DEV-244";
                    console.warn("Running locally with mock user: " + sCurrentUser);
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

            onShowJobLog: function () {
                var oTable = this.byId("Table");
                var aSelectedContexts = oTable.getSelectedContexts();

                if (aSelectedContexts.length === 0) {
                    MessageToast.show("Please select a job.");
                    return;
                }

                var oContext = aSelectedContexts[0];
                var sJobName = oContext.getProperty("JobName");
                var sJobCount = oContext.getProperty("JobCount");

                // FIX: Ensure JobCount is 8 digits. Backend requires '09444500' not '9444500'.
                if (sJobCount) {
                    sJobCount = String(sJobCount).padStart(8, "0");
                }

                if (!this._pJobLogDialog) {
                    this._pJobLogDialog = Fragment.load({
                        id: this.getView().getId(),
                        name: "project5.ext.fragment.JobLog",
                        controller: this
                    }).then(function (oDialog) {
                        this.getView().addDependent(oDialog);
                        return oDialog;
                    }.bind(this));
                }

                this._pJobLogDialog.then(function (oDialog) {
                    var oLogTable = this.byId("jobLogTable");

                    // Fix lỗi template trắng trơn
                    if (!this._oLogTemplate) {
                        this._oLogTemplate = oLogTable.getBindingInfo("items").template;
                    }
                    oLogTable.unbindItems();

                    // Gửi Filter xuống ABAP
                    var aFilters = [
                        new Filter("JobName", FilterOperator.EQ, sJobName),
                        new Filter("JobCount", FilterOperator.EQ, sJobCount)
                    ];

                    oLogTable.bindItems({
                        path: "/JobLog",
                        template: this._oLogTemplate,
                        filters: aFilters
                    });

                    oDialog.setTitle("Job Log: " + sJobName + " / " + sJobCount);
                    oDialog.open();
                }.bind(this));
            },

            onCloseJobLog: function () {
                this._pJobLogDialog.then(function (oDialog) {
                    oDialog.close();
                });
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
