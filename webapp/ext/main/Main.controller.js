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
                        isImmediate: false
                    });
                    this.getView().setModel(oModel, "localRelease");
                } else {
                    oModel.setProperty("/isImmediate", false);
                }

                var oDate = this.byId("idReleaseDate");
                if (oDate) { oDate.setValue(""); oDate.setValueState("None"); }

                var oTime = this.byId("idReleaseTime");
                if (oTime) { oTime.setValue(""); oTime.setValueState("None"); }

                var oTabBar = this.byId("idStartModeTabs");
                if (oTabBar) { oTabBar.setSelectedKey("scheduled"); }
            },

            onImmediateChange: function (oEvent) {
                var bSelected = oEvent.getParameter("selected");
                var oModel = this.getView().getModel("localRelease");
                if (oModel) {
                    oModel.setProperty("/isImmediate", bSelected);
                }
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

                    // Read BE success message from Message Class
                    var aSuccessMsgs = fnGetMessages().slice(iMessageCountBefore).filter(function (m) {
                        return m.type === "Success";
                    });
                    if (aSuccessMsgs.length > 0) {
                        MessageToast.show(aSuccessMsgs.map(function (m) { return m.message; }).join("\n"));
                    } else {
                        var sActionLabel = (sCurrentAction.indexOf("Repeat") !== -1) ? "Repeat Job" : "Release Job";
                        MessageToast.show(sActionLabel + " completed successfully.");
                    }
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

            // ==================== HELPER: Gọi Bound Action cho nhiều dòng ====================
            _executeAction: async function (aContexts, sActionName, sLabel) {
                sap.ui.getCore().getMessageManager().removeAllMessages();

                const results = await Promise.allSettled(
                    aContexts.map(ctx => ctx.getModel().bindContext(sActionName + "(...)", ctx).execute())
                );

                const aFailed = [];
                results.forEach((r, i) => {
                    if (r.status !== "fulfilled") {
                        const sName = aContexts[i].getProperty("JobName") || "(unknown)";
                        aFailed.push(`• ${sName}: ${r.reason?.error?.message || r.reason?.message || "Unknown error"}`);
                    }
                });

                // Read success messages from BE (via MessageManager, e.g. msg 012/015 from ZCM_BC_BJSMS_MSG)
                const aAllMsgs = sap.ui.getCore().getMessageManager().getMessageModel().getData();
                const aSuccessMsgs = aAllMsgs.filter(m => m.type === "Success").map(m => m.message);

                if (aSuccessMsgs.length) {
                    MessageToast.show(aSuccessMsgs.join(" | "));
                } else if (!aFailed.length) {
                    MessageToast.show(sLabel + " completed.");
                }
                if (aFailed.length) MessageBox.error(aFailed.join("\n"));

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

            onConfirmCopyJob: function () {
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
                var oExtensionAPI = this.getExtensionAPI();
                var sActionName = "com.sap.gateway.srvd.z_sd_job_ovp.v0001.CopyJob";

                BusyIndicator.show(0);

                oExtensionAPI.editFlow.invokeAction(sActionName, {
                    contexts: [oContext],
                    parameterValues: [
                        { name: "NewJobName", value: sNewJobName }
                    ],
                    skipParameterDialog: true
                }).then(function () {
                    BusyIndicator.hide();
                    // Read BE success message from Message Class
                    var oMsgMgr = sap.ui.getCore().getMessageManager();
                    var aMsgs = (oMsgMgr.getMessageModel().getData() || []).filter(function (m) { return m.type === "Success"; });
                    if (aMsgs.length > 0) {
                        MessageToast.show(aMsgs.map(function (m) { return m.message; }).join("\n"));
                    } else {
                        MessageToast.show("Copy and Rename completed successfully.");
                    }
                    that.onCloseCopyDialog();
                    that._clearStartDateFilter();
                    that._refreshTable();
                }).catch(function (err) {
                    BusyIndicator.hide();
                    console.error("Copy Job error:", err);
                    if (!err || !err.message || err.message.indexOf("cancelled") === -1) {
                        MessageBox.error("Copy Job failed: " + (err.message || "Please try again."));
                    }
                });
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
                var sCurrentUser = sap.ushell?.Container
                    ? sap.ushell.Container.getService("UserInfo").getId()
                    : "DEV-119";

                if (!sCurrentUser) return;

                var oFilterBar = this.byId("FilterBar")?.getContent();
                if (!oFilterBar?.getFilterConditions) return;

                var mConditions = Object.assign({}, oFilterBar.getFilterConditions());

                if (this._bFilteringOwnJobs) {
                    delete mConditions.CreatedBy;
                    MessageToast.show("Showing all jobs.");
                } else {
                    mConditions.CreatedBy = [{ operator: "EQ", values: [sCurrentUser], validated: "Validated" }];
                    MessageToast.show("Filtering jobs by: " + sCurrentUser);
                }

                oFilterBar.setFilterConditions(mConditions);
                oFilterBar.triggerSearch?.();
                this._bFilteringOwnJobs = !this._bFilteringOwnJobs;
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
            onOpenAnalyticsMenu: function (e) { this.byId("analyticsActionSheet").openBy(e.getSource()); },
            onOpenDashboard: function () {
                window.open("https://s40lp1.ucc.cit.tum.de/sap/bc/ui2/flp?sap-client=324&sap-language=EN#ZSO_JOB_F0703-display", "_self");
            },
            onOpenAnalytics: function () {
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
