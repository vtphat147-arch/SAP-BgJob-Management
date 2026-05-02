sap.ui.define(
    [
        'sap/fe/core/PageController',
        "sap/m/MessageToast",
        "sap/m/MessageBox",
        "sap/ui/model/Filter",
        "sap/ui/model/FilterOperator",
        "sap/ui/core/Fragment",
        "sap/ui/core/BusyIndicator",
        "sap/ui/model/json/JSONModel"
    ],
    function (PageController, MessageToast, MessageBox, Filter, FilterOperator, Fragment, BusyIndicator, JSONModel) {
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
                        this._resetReleaseDialog();
                        if (!oDialog.isOpen()) {
                            oDialog.open();
                        }
                    }.bind(this));
                    return;
                }

                this._pReleaseDialog = Fragment.load({
                    id: this.getView().getId(),
                    name: "project5.ext.fragment.ReleaseDialog",
                    controller: this
                }).then(function (oDialog) {
                    this.getView().addDependent(oDialog);
                    oDialog.setTitle(sTitle);
                    this._resetReleaseDialog();
                    oDialog.open();
                    return oDialog;
                }.bind(this));
            },

            _resetReleaseDialog: function () {
                var oModel = this.getView().getModel("localRelease");
                if (!oModel) {
                    oModel = new sap.ui.model.json.JSONModel({
                        isImmediate: true
                    });
                    this.getView().setModel(oModel, "localRelease");
                } else {
                    oModel.setProperty("/isImmediate", true);
                }

                var oDate = this.byId("idReleaseDate");
                if (oDate) { oDate.setValue(""); oDate.setValueState("None"); }

                var oTime = this.byId("idReleaseTime");
                if (oTime) { oTime.setValue(""); oTime.setValueState("None"); }

                var oTabBar = this.byId("idStartModeTabs");
                if (oTabBar) { oTabBar.setSelectedKey("immediate"); }
            },

            onImmediateChange: function (oEvent) {
                var bSelected = oEvent.getParameter("selected");
                var oModel = this.getView().getModel("localRelease");
                if (oModel) {
                    oModel.setProperty("/isImmediate", bSelected);
                }
            },

            onConfirmRelease: async function () {
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
                if (!bIsImmediate) {
                    if (!sSapDate || !sSapTime) {
                        MessageToast.show("Please enter start date and start time.");
                        this._bConfirmInFlight = false;
                        return;
                    }

                    // Validate that the scheduled date/time is not in the past (allow 1 minute tolerance)
                    if (oDate) {
                        var oNow = new Date();
                        oNow.setMinutes(oNow.getMinutes() - 1);
                        if (oDate < oNow) {
                            MessageBox.error("The scheduled start date and time cannot be in the past.");
                            this._bConfirmInFlight = false;
                            return;
                        }
                    }
                }

                var aParameterValues = [
                    { name: "IsImmediate", value: bIsImmediate },
                    { name: "StartDate", value: sSapDate },
                    { name: "StartTime", value: sSapTime },
                    { name: "AfterJobName", value: this.byId("idAfterJobName") ? this.byId("idAfterJobName").getValue() : "" },
                    { name: "EventID", value: this.byId("idEventID") ? this.byId("idEventID").getValue() : "" },
                    { name: "EventParam", value: this.byId("idEventParam") ? this.byId("idEventParam").getValue() : "" }
                ];

                // Clear old messages before action
                var oMessageManager = sap.ui.getCore().getMessageManager();
                oMessageManager.removeAllMessages();

                BusyIndicator.show(0);

                var sCurrentAction = this._sCurrentAction || "com.sap.gateway.srvd.z_sd_job_ovp.v0001.ReleaseJob";
                var sActionLabel = (sCurrentAction.indexOf("Repeat") !== -1) ? "Repeat Job" : "Release Job";
                var aFailedMessages = [];

                // Execute action directly via OData V4 Model to capture exact execution errors
                try {
                    for (var oContext of aSelectedContexts) {
                        var oActionContext = oContext.getModel().bindContext(sCurrentAction + "(...)", oContext);
                        
                        // Set parameters
                        aParameterValues.forEach(function (oParam) {
                            oActionContext.setParameter(oParam.name, oParam.value);
                        });

                        try {
                            await oActionContext.execute();
                        } catch (oError) {
                            var sErr = oError?.error?.message || oError?.message || "Unknown error";
                            aFailedMessages.push(sErr);
                        }
                    }
                } catch (e) {
                    aFailedMessages.push(e.message || "Execution exception");
                }

                BusyIndicator.hide();
                that._bConfirmInFlight = false;

                var bIsSuccess = that._handleActionMessages(sActionLabel + " completed successfully.", aFailedMessages);

                if (bIsSuccess) {
                    that.onCloseReleaseDialog();
                }
                that._refreshTable();
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

            // ==================== HELPER: Handle Action Response Messages ====================
            _handleActionMessages: function (sFallbackSuccessMessage, aFallbackErrors) {
                var oMessageManager = sap.ui.getCore().getMessageManager();
                var aMessages = oMessageManager.getMessageModel().getData() || [];
                
                var aErrorMessages = (aFallbackErrors || []).slice(); // Add fallback errors from catch blocks
                var aWarningMessages = [];
                var aSuccessMessages = [];

                // Categorize messages correctly by using lowerCase to avoid undefined enum dependencies
                aMessages.forEach(function (oMsg) {
                    var sType = (oMsg && oMsg.type ? oMsg.type : "").toLowerCase();
                    var sMessage = oMsg.message || "Unknown error occurred";

                    // Prevent duplicate errors if the MessageManager already caught the same error
                    if (sType === "error" && !aErrorMessages.includes(sMessage)) {
                        aErrorMessages.push(sMessage);
                    } else if (sType === "warning") {
                        aWarningMessages.push(sMessage);
                    } else if (sType === "success") {
                        aSuccessMessages.push(sMessage);
                    }
                });

                // 1. FULL FAILURE: If only errors occurred (or errors + warnings but no success)
                if (aErrorMessages.length > 0 && aSuccessMessages.length === 0) {
                    // Extract unique error messages to avoid long repeating popups
                    var aUniqueErrors = [...new Set(aErrorMessages)];
                    MessageBox.error(aUniqueErrors.join("\n\n"));
                    return false; // Indicate failure
                }

                // 2. PARTIAL SUCCESS: Both Success and Errors exist
                if (aErrorMessages.length > 0 && aSuccessMessages.length > 0) {
                    var aUniqueErrors = [...new Set(aErrorMessages)];
                    var aUniqueSuccess = [...new Set(aSuccessMessages)];
                    var sPartialMsg = "Warning: Some operations failed.\n\n" + 
                                      "Errors:\n" + aUniqueErrors.map(function(m){ return "• " + m; }).join("\n") + "\n\n" +
                                      "Successes:\n" + aUniqueSuccess.map(function(m){ return "• " + m; }).join("\n");
                    MessageBox.warning(sPartialMsg);
                    return true; 
                }

                // 3. FULL SUCCESS
                if (aSuccessMessages.length > 0) {
                    var aUniqueSuccess = [...new Set(aSuccessMessages)];
                    MessageToast.show(aUniqueSuccess.join("\n"));
                } else {
                    MessageToast.show(sFallbackSuccessMessage);
                }
                
                return true;
            },

            // ==================== HELPER: Gọi Bound Action cho nhiều dòng ====================
            _executeAction: async function (aContexts, sActionName, sLabel, oOptions) {
                var aSuccess = [];
                var aFailed = [];

                // --- 0. Clear old messages ---
                var oMessageManager = sap.ui.getCore().getMessageManager();
                oMessageManager.removeAllMessages();

                // Execute sequentially to avoid SAP batch errors
                for (var oContext of aContexts) {
                    var sJobName = oContext.getProperty("JobName") || "(unknown)";
                    try {
                        var oActionContext = oContext.getModel().bindContext(sActionName + "(...)", oContext);
                        await oActionContext.execute();
                        aSuccess.push(sJobName);
                    } catch (oError) {
                        var sErr = oError?.error?.message || oError?.message || "Unknown error";
                        aFailed.push({ name: sJobName, error: sErr });
                    }
                }

                // --- Read messages returned by BE (from Message Class ZCM_BC_BJSMS_MSG) ---
                var aMessages = oMessageManager.getMessageModel().getData() || [];
                var aSuccessMessages = aMessages.filter(function (m) { return m.type === "Success"; });
                var aErrorMessages = aMessages.filter(function (m) { return m.type === "Error"; });

                // Show BE success messages
                if (aSuccessMessages.length > 0) {
                    var sSuccessText = aSuccessMessages.map(function (m) { return m.message; }).join("\n");
                    MessageToast.show(sSuccessText);
                } else if (aSuccess.length > 0) {
                    // Fallback if BE didn't return specific messages
                    MessageToast.show(sLabel + " completed for: " + aSuccess.join(", "));
                }

                // Show BE error messages
                if (aErrorMessages.length > 0) {
                    var sErrorText = aErrorMessages.map(function (m) { return "• " + m.message; }).join("\n");
                    MessageBox.error(sErrorText);
                } else if (aFailed.length > 0) {
                    // Fallback
                    var sErrors = aFailed.map(function (r) { return "• " + r.name + ": " + r.error; }).join("\n");
                    MessageBox.error(sLabel + " failed for " + aFailed.length + " job(s):\n\n" + sErrors);
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

                var oSelectedContext = aSelectedContexts[0];
                var sOldJobName = oSelectedContext.getProperty("JobName") || "";
                this._oCopySourceContext = oSelectedContext;

                var that = this;

                if (aSelectedContexts.length > 1) {
                    MessageBox.warning(
                        "You have selected multiple jobs. Only the first selected job (" + sOldJobName + ") will be copied.\n\nDo you want to continue?", 
                        {
                            title: "Multiple Jobs Selected",
                            actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
                            onClose: function (sAction) {
                                if (sAction === MessageBox.Action.OK) {
                                    that._openCopyDialog(sOldJobName);
                                }
                            }
                        }
                    );
                    return;
                }

                this._openCopyDialog(sOldJobName);
            },

            _openCopyDialog: function (sOldJobName) {
                var oView = this.getView();
                var oCopyModel = oView.getModel("copyJob");

                if (!oCopyModel) {
                    oCopyModel = new JSONModel({
                        oldJobName: "",
                        newJobName: ""
                    });
                    oView.setModel(oCopyModel, "copyJob");
                }

                oCopyModel.setData({
                    oldJobName: sOldJobName,
                    newJobName: sOldJobName
                });

                if (this._pCopyDialog) {
                    this._pCopyDialog.then(function (oDialog) {
                        oDialog.open();
                        this._syncCopyDialogState();
                    }.bind(this));
                    return;
                }

                this._pCopyDialog = Fragment.load({
                    id: oView.getId(),
                    name: "project5.ext.fragment.CopyJobDialog",
                    controller: this
                }).then(function (oDialog) {
                    oView.addDependent(oDialog);
                    oDialog.open();
                    this._syncCopyDialogState();
                    return oDialog;
                }.bind(this));
            },

            _syncCopyDialogState: function () {
                var oInput = this.byId("copyJobNameInput");
                var oDialog = this.byId("copyJobDialog");
                var sValue = oInput ? (oInput.getValue() || "").trim() : "";
                var bValid = !!sValue;

                if (oInput) {
                    oInput.setValueState(bValid ? "None" : "Error");
                    oInput.setValueStateText("Job name is required.");
                }

                if (oDialog && oDialog.getBeginButton()) {
                    oDialog.getBeginButton().setEnabled(bValid);
                }
            },

            onCopyJobNameLiveChange: function () {
                this._syncCopyDialogState();
            },

            onConfirmCopyJob: async function () {
                var oInput = this.byId("copyJobNameInput");
                var sNewJobName = oInput ? (oInput.getValue() || "").trim() : "";
                var oContext = this._oCopySourceContext;

                if (!sNewJobName) {
                    this._syncCopyDialogState();
                    return;
                }

                if (!oContext) {
                    MessageBox.error("Cannot find the selected job context.");
                    return;
                }

                var that = this;
                var sActionName = "com.sap.gateway.srvd.z_sd_job_ovp.v0001.CopyJob";

                // Clear old messages before action
                var oMessageManager = sap.ui.getCore().getMessageManager();
                oMessageManager.removeAllMessages();

                BusyIndicator.show(0);

                var aFailedMessages = [];

                try {
                    // Try executing native OData V4 Action
                    var oActionContext = oContext.getModel().bindContext(sActionName + "(...)", oContext);
                    oActionContext.setParameter("NewJobName", sNewJobName);

                    await oActionContext.execute();
                } catch (oError) {
                    // HTTP 400 Bad Request execution error will be caught here correctly
                    var sErr = oError?.error?.message || oError?.message || "Unknown error";
                    // Avoid catching user-cancellations (if any)
                    if (sErr.indexOf("cancelled") === -1) {
                        aFailedMessages.push(sErr);
                    }
                }

                BusyIndicator.hide();
                
                var bIsSuccess = that._handleActionMessages("Copy and Rename completed successfully.", aFailedMessages);
                
                if (bIsSuccess) {
                    that.onCloseCopyDialog();
                    that._clearStartDateFilter();
                }
                that._refreshTable();
            },

            onCloseCopyDialog: function () {
                if (!this._pCopyDialog) {
                    return;
                }

                this._pCopyDialog.then(function (oDialog) {
                    if (oDialog && oDialog.isOpen()) {
                        oDialog.close();
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
