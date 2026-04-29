sap.ui.define(
    [
        'sap/fe/core/PageController',
        "sap/m/MessageToast",
        "sap/m/MessageBox",
        "sap/ui/core/Fragment",
        "sap/ui/core/BusyIndicator",
        "sap/ui/model/json/JSONModel"
    ],
    function (PageController, MessageToast, MessageBox, Fragment, BusyIndicator, JSONModel) {
        'use strict';

        return PageController.extend('project5.ext.main.Main', {

            _getI18nBundle: function () {
                var oI18nModel = this.getView() && this.getView().getModel("i18n");
                return oI18nModel && typeof oI18nModel.getResourceBundle === "function"
                    ? oI18nModel.getResourceBundle()
                    : null;
            },

            _t: function (sKey, aArgs) {
                var oBundle = this._getI18nBundle();
                return oBundle ? oBundle.getText(sKey, aArgs || []) : sKey;
            },

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
                    MessageToast.show(this._t("msgSelectJob"));
                    return;
                }

                this._openActionDialog(
                    "com.sap.gateway.srvd.z_sd_job_ovp.v0001.ReleaseJob",
                    this._t("dialogReleaseTitle")
                );
            },

            // ==================== HELPER: Open Action Dialog ====================
            _openActionDialog: function (sActionName, sTitle) {
                var oTable = this.byId("Table");
                var aSelectedContexts = oTable.getSelectedContexts();

                if (aSelectedContexts.length === 0) {
                    MessageToast.show(this._t("msgSelectJob"));
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
                    MessageToast.show(this._t("msgSelectJob"));
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
                        MessageToast.show(this._t("msgEnterStartDateTime"));
                        this._bConfirmInFlight = false;
                        return;
                    }

                    // Validate that the scheduled date/time is not in the past (allow 1 minute tolerance)
                    if (oDate) {
                        var oNow = new Date();
                        oNow.setMinutes(oNow.getMinutes() - 1);
                        if (oDate < oNow) {
                            MessageBox.error(this._t("msgPastStartDateTime"));
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
                }).then(function (oResponse) {
                    BusyIndicator.hide();

                    // --- CHECK BACKEND FAILED RESPONSE & MESSAGES ---
                    var bBackendFailed = false;
                    var sCustomErrorMsg = "";

                    // Kiểm tra data trả về từ HTTP 200 payload nếu action return custom object (vd: failed-joblist + error message)
                    if (oResponse) {
                        // oResponse có thể là context array hoặc instance
                        var oResultTarget = Array.isArray(oResponse) ? oResponse[0] : oResponse;
                        var oResultData = oResultTarget && typeof oResultTarget.getObject === "function" ? oResultTarget.getObject() : oResultTarget;
                        
                        if (oResultData) {
                            if (oResultData.value) { 
                                oResultData = oResultData.value; 
                            }
                            // Tùy theo định dạng trả về của Backend
                            if (oResultData.failed || oResultData.failed === "true" || oResultData.status === "ERROR") {
                                bBackendFailed = true;
                            }
                            if (oResultData.error_message || oResultData.message) {
                                sCustomErrorMsg = oResultData.error_message || oResultData.message;
                            }
                        }
                    }

                    var aNewMessages = fnGetMessages().slice(iMessageCountBefore);
                    var aErrorMessages = aNewMessages.filter(function (oMsg) {
                        return (oMsg && oMsg.type ? oMsg.type : "").toLowerCase() === "error";
                    });
                    var bHasNewError = aErrorMessages.length > 0;

                    var bHasProviderError = aNewMessages.some(function (oMsg) {
                        var sText = oMsg && oMsg.message ? oMsg.message : "";
                        return /unspecified provider error occurred/i.test(sText);
                    });

                    // NẾU CÓ LỖI TỪ Fiori Messages HOẶC Backend payload return fail:
                    if (bHasNewError || bHasProviderError || bBackendFailed) {
                        console.warn("Action returned error messages or failed payload.", aNewMessages, oResponse);
                        that._bConfirmInFlight = false;
                        that._refreshTable();
                        
                        // Hiển thị Error message cho User
                        if (sCustomErrorMsg) {
                            MessageBox.error(sCustomErrorMsg);
                        } else if (aErrorMessages.length > 0) {
                            var sAllErrors = aErrorMessages.map(function(m) { return m.message; }).join("\n");
                            MessageBox.error(sAllErrors);
                        } else {
                            MessageBox.error(that._t("msgExecutionFailed", [that._t("msgTryAgain")]));
                        }
                        
                        return; // NGĂN CHẶN HIỆN SUCCESS TOAST
                    }

                    // Read BE success message from Message Class
                    var aSuccessMsgs = fnGetMessages().slice(iMessageCountBefore).filter(function (m) {
                        return m.type === "Success";
                    });
                    if (aSuccessMsgs.length > 0) {
                        MessageToast.show(aSuccessMsgs.map(function (m) { return m.message; }).join("\n"));
                    } else {
                        var sActionLabel = (sCurrentAction.indexOf("Repeat") !== -1)
                            ? that._t("labelRepeatJob")
                            : that._t("labelReleaseJob");
                        MessageToast.show(that._t("msgActionCompleted", [sActionLabel]));
                    }
                    that._bConfirmInFlight = false;
                    that.onCloseReleaseDialog();
                    that._refreshTable();
                }).catch(function (oError) {
                    BusyIndicator.hide();
                    that._bConfirmInFlight = false;
                    var sErrMsg = oError && oError.message ? oError.message : that._t("msgTryAgain");

                    // Bỏ qua lỗi đồng bộ trạng thái action (metadata/cache) để tránh popup lỗi xám.
                    if (sErrMsg.toLowerCase().includes("enabled")) {
                        console.log("System state was refreshed.");
                        return;
                    }

                    console.error("Action error details:", oError);
                    MessageBox.error(that._t("msgExecutionFailed", [sErrMsg]));
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
            _executeAction: async function (aContexts, sActionName, sLabel, oOptions) {
                var aSuccess = [];
                var aFailed = [];

                // --- 0. Clear old messages ---
                var oMessageManager = sap.ui.getCore().getMessageManager();
                oMessageManager.removeAllMessages();

                // Execute sequentially to avoid SAP batch errors
                for (var oContext of aContexts) {
                    var sJobName = oContext.getProperty("JobName") || this._t("labelUnknownJob");
                    try {
                        var oActionContext = oContext.getModel().bindContext(sActionName + "(...)", oContext);
                        await oActionContext.execute();
                        
                        // --- CHECK BACKEND FAILED RESPONSE ---
                        var oResult = oActionContext.getObject();
                        var bBackendFailed = false;
                        var sCustomErrorMsg = "";
                        
                        if (oResult) {
                            if (oResult.value) oResult = oResult.value;
                            if (oResult.failed || oResult.failed === "true" || oResult.status === "ERROR") {
                                bBackendFailed = true;
                            }
                            if (oResult.error_message || oResult.message) {
                                sCustomErrorMsg = oResult.error_message || oResult.message;
                            }
                        }

                        if (bBackendFailed) {
                            var sErr = sCustomErrorMsg || this._t("labelUnknownError");
                            aFailed.push({ name: sJobName, error: sErr });
                        } else {
                            aSuccess.push(sJobName);
                        }
                    } catch (oError) {
                        var sErr = oError?.error?.message || oError?.message || this._t("labelUnknownError");
                        aFailed.push({ name: sJobName, error: sErr });
                    }
                }

                // --- Read messages returned by BE (from Message Class ZCM_BC_BJSMS_MSG) ---
                var aMessages = oMessageManager.getMessageModel().getData() || [];
                var aSuccessMessages = aMessages.filter(function (m) { return m.type === "Success"; });
                var aErrorMessages = aMessages.filter(function (m) { return m.type === "Error"; });

                // Show BE success messages
                if (aSuccess.length > 1) {
                    var sJobNames = aSuccess.length <= 3 ? ": " + aSuccess.join(", ") : "";
                    MessageToast.show(this._t("msgExecuteCompletedMultiple", [sLabel, aSuccess.length]) + sJobNames);
                } else if (aSuccess.length === 1) {
                    if (aSuccessMessages.length > 0) {
                        var aUniqueMsgs = [];
                        aSuccessMessages.forEach(function (m) {
                            if (aUniqueMsgs.indexOf(m.message) === -1) aUniqueMsgs.push(m.message);
                        });
                        MessageToast.show(aUniqueMsgs.join("\n") + " (" + aSuccess[0] + ")");
                    } else {
                        MessageToast.show(this._t("msgExecuteCompletedFor", [sLabel, aSuccess[0]]));
                    }
                }

                // Show BE error messages
                if (aErrorMessages.length > 0) {
                    var sErrorText = aErrorMessages.map(function (m) { return "• " + m.message; }).join("\n");
                    MessageBox.error(sErrorText);
                } else if (aFailed.length > 0) {
                    // Fallback
                    var sErrors = aFailed.map(function (r) { return "• " + r.name + ": " + r.error; }).join("\n");
                    MessageBox.error(this._t("msgExecuteFailedFor", [sLabel, aFailed.length, sErrors]));
                }

                this._refreshTable();
            },

            // ==================== REPEAT JOB ====================
            onRepeatJob: function () {
                var oTable = this.byId("Table");
                var aSelectedContexts = oTable.getSelectedContexts();

                if (aSelectedContexts.length === 0) {
                    MessageToast.show(this._t("msgSelectAtLeastRepeat"));
                    return;
                }

                this._openActionDialog(
                    "com.sap.gateway.srvd.z_sd_job_ovp.v0001.RepeatWithSchedule",
                    this._t("dialogRepeatTitle")
                );
            },

            // ==================== COPY & RENAME JOB ====================
            onCopyWithRename: function () {
                var aSelectedContexts = this.byId("Table").getSelectedContexts();

                if (aSelectedContexts.length === 0) {
                    MessageToast.show(this._t("msgSelectAtLeastCopy"));
                    return;
                }

                var oSelectedContext = aSelectedContexts[0];
                var sOldJobName = oSelectedContext.getProperty("JobName") || "";
                this._oCopySourceContext = oSelectedContext;

                var that = this;

                if (aSelectedContexts.length > 1) {
                    MessageBox.warning(
                        this._t("msgMultipleJobsSelected", [sOldJobName]),
                        {
                            title: this._t("titleMultipleJobsSelected"),
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
                
                // Job Name: No special chars like * ? " and max 32 chars
                var bFormatValid = /^[a-zA-Z0-9_\- ]+$/.test(sValue);
                var bLengthValid = sValue.length > 0 && sValue.length <= 32;
                var bValid = bFormatValid && bLengthValid;

                if (oInput) {
                    oInput.setValueState(bValid ? "None" : "Error");
                    if (sValue.length === 0) {
                        oInput.setValueStateText(this._t("msgJobNameRequired"));
                    } else if (sValue.length > 32 || !bFormatValid) {
                        oInput.setValueStateText(this._t("createJobInvalidJobName"));
                    }
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

                if (!sNewJobName || sNewJobName.length > 32 || !/^[a-zA-Z0-9_\- ]+$/.test(sNewJobName)) {
                    this._syncCopyDialogState();
                    return;
                }

                if (!oContext) {
                    MessageBox.error(this._t("msgCopyContextNotFound"));
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
                }).then(function (oResponse) {
                    BusyIndicator.hide();
                    
                    // --- CHECK BACKEND FAILED RESPONSE & MESSAGES ---
                    var bBackendFailed = false;
                    var sCustomErrorMsg = "";

                    if (oResponse) {
                        var oResultTarget = Array.isArray(oResponse) ? oResponse[0] : oResponse;
                        var oResultData = oResultTarget && typeof oResultTarget.getObject === "function" ? oResultTarget.getObject() : oResultTarget;
                        
                        if (oResultData) {
                            if (oResultData.value) { 
                                oResultData = oResultData.value; 
                            }
                            if (oResultData.failed || oResultData.failed === "true" || oResultData.status === "ERROR") {
                                bBackendFailed = true;
                            }
                            if (oResultData.error_message || oResultData.message) {
                                sCustomErrorMsg = oResultData.error_message || oResultData.message;
                            }
                        }
                    }

                    var oMsgMgr = sap.ui.getCore().getMessageManager();
                    var aMsgs = oMsgMgr.getMessageModel().getData() || [];
                    var aErrorMessages = aMsgs.filter(function (m) { return m.type === "Error"; });

                    if (aErrorMessages.length > 0 || bBackendFailed) {
                        console.warn("Action returned error messages or failed payload.", aMsgs, oResponse);
                        that.onCloseCopyDialog();
                        that._refreshTable();
                        
                        if (sCustomErrorMsg) {
                            MessageBox.error(sCustomErrorMsg);
                        } else if (aErrorMessages.length > 0) {
                            var sAllErrors = aErrorMessages.map(function(m) { return m.message; }).join("\n");
                            MessageBox.error(sAllErrors);
                        } else {
                            MessageBox.error(that._t("msgCopyFailed", [that._t("msgTryAgain")]));
                        }
                        return;
                    }

                    // Read BE success message from Message Class
                    var aSuccessMsgs = aMsgs.filter(function (m) { return m.type === "Success"; });
                    if (aSuccessMsgs.length > 0) {
                        var aUniqueMsgs = [];
                        aSuccessMsgs.forEach(function (m) {
                            if (aUniqueMsgs.indexOf(m.message) === -1) aUniqueMsgs.push(m.message);
                        });
                        MessageToast.show(aUniqueMsgs.join("\n"));
                    } else {
                        MessageToast.show(that._t("msgCopyRenameSuccess"));
                    }
                    that.onCloseCopyDialog();
                    that._clearStartDateFilter();
                    that._refreshTable();
                }).catch(function (err) {
                    BusyIndicator.hide();
                    console.error("Copy Job error:", err);
                    if (!err || !err.message || err.message.indexOf("cancelled") === -1) {
                        MessageBox.error(that._t("msgCopyFailed", [err.message || that._t("msgTryAgain")]));
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
                    MessageToast.show(this._t("msgSelectAtLeastStop"));
                    return;
                }

                var iCount = aSelectedContexts.length;
                var sMessage = this._t("msgConfirmStopJobs", [iCount]);

                var that = this;
                MessageBox.confirm(sMessage, {
                    title: this._t("titleConfirmStop"),
                    emphasizedAction: MessageBox.Action.OK,
                    onClose: function (sAction) {
                        if (sAction === MessageBox.Action.OK) {
                            that._executeAction(aSelectedContexts, "com.sap.gateway.srvd.z_sd_job_ovp.v0001.StopJob", that._t("labelStop"));
                        }
                    }
                });
            },

            // ==================== DELETE JOB (với Confirmation) ====================
            onDeleteJob: function () {
                var oTable = this.byId("Table");
                var aSelectedContexts = oTable.getSelectedContexts();
                if (aSelectedContexts.length === 0) {
                    MessageToast.show(this._t("msgSelectAtLeastDelete"));
                    return;
                }

                var iCount = aSelectedContexts.length;
                var sMessage = this._t("msgConfirmDeleteJobs", [iCount]);

                var that = this;
                MessageBox.confirm(sMessage, {
                    title: this._t("titleConfirmDelete"),
                    emphasizedAction: MessageBox.Action.OK,
                    onClose: function (sAction) {
                        if (sAction === MessageBox.Action.OK) {
                            that._executeAction(aSelectedContexts, "com.sap.gateway.srvd.z_sd_job_ovp.v0001.DeleteJob", that._t("labelDelete"));
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
                    MessageToast.show(this._t("msgNotInLaunchpad"));
                }

                if (!sCurrentUser) {
                    return; // Nếu không biết user là ai thì không filter được
                }

                // 2. Update FilterBar conditions so FE search/go keeps My Jobs condition.
                var oMacroFilterBar = this.byId("FilterBar");
                if (!oMacroFilterBar || typeof oMacroFilterBar.getContent !== "function") {
                    return;
                }
                var oFilterBar = oMacroFilterBar.getContent();
                if (!oFilterBar) {
                    return;
                }

                this._bFilteringOwnJobs = !this._bFilteringOwnJobs;

                var bUpdated = this._setCreatedByCondition(oFilterBar, this._bFilteringOwnJobs, sCurrentUser);
                if (!bUpdated) {
                    this._bFilteringOwnJobs = !this._bFilteringOwnJobs;
                    return;
                }

                // 3. Trigger search after condition update.
                if (typeof oFilterBar.triggerSearch === "function") {
                    oFilterBar.triggerSearch();
                } else if (typeof oFilterBar.fireSearch === "function") {
                    oFilterBar.fireSearch();
                }

                if (!this._bFilteringOwnJobs) {
                    MessageToast.show(this._t("msgShowingAllJobs"));
                } else {
                    MessageToast.show(this._t("msgFilteringJobsBy", [sCurrentUser]));
                }
            },

            _setCreatedByCondition: function (oFilterBar, bEnable, sCurrentUser) {
                var bUpdated = false;

                if (typeof oFilterBar.getFilterConditions === "function" && typeof oFilterBar.setFilterConditions === "function") {
                    var mConditions = oFilterBar.getFilterConditions() || {};
                    var mUpdatedConditions = Object.assign({}, mConditions);

                    if (bEnable) {
                        mUpdatedConditions.CreatedBy = [{
                            operator: "EQ",
                            values: [sCurrentUser],
                            validated: "Validated"
                        }];
                    } else {
                        delete mUpdatedConditions.CreatedBy;
                    }

                    oFilterBar.setFilterConditions(mUpdatedConditions);
                    bUpdated = true;
                }

                if (!bUpdated && typeof oFilterBar.getConditionModel === "function") {
                    var oConditionModel = oFilterBar.getConditionModel();
                    if (
                        oConditionModel &&
                        typeof oConditionModel.removeAllConditions === "function" &&
                        typeof oConditionModel.addCondition === "function"
                    ) {
                        oConditionModel.removeAllConditions("CreatedBy");
                        if (bEnable) {
                            oConditionModel.addCondition("CreatedBy", {
                                operator: "EQ",
                                values: [sCurrentUser],
                                validated: "Validated"
                            });
                        }
                        bUpdated = true;
                    }
                }

                return bUpdated;
            },

            _hasCreatedByCondition: function (oFilterBar) {
                if (typeof oFilterBar.getFilterConditions === "function") {
                    var mConditions = oFilterBar.getFilterConditions() || {};
                    return !!(mConditions.CreatedBy && mConditions.CreatedBy.length);
                }

                if (typeof oFilterBar.getConditionModel === "function") {
                    var oConditionModel = oFilterBar.getConditionModel();
                    if (oConditionModel && typeof oConditionModel.getConditions === "function") {
                        var aCreatedBy = oConditionModel.getConditions("CreatedBy") || [];
                        return aCreatedBy.length > 0;
                    }
                }

                return false;
            },

            _syncMyJobsCondition: function () {
                if (!this._bFilteringOwnJobs || this._bSyncingMyJobs) {
                    return;
                }

                var sCurrentUser = "";
                if (sap.ushell && sap.ushell.Container) {
                    sCurrentUser = sap.ushell.Container.getService("UserInfo").getId();
                }
                if (!sCurrentUser) {
                    return;
                }

                var oMacroFilterBar = this.byId("FilterBar");
                if (!oMacroFilterBar || typeof oMacroFilterBar.getContent !== "function") {
                    return;
                }
                var oFilterBar = oMacroFilterBar.getContent();
                if (!oFilterBar || this._hasCreatedByCondition(oFilterBar)) {
                    return;
                }

                this._bSyncingMyJobs = true;
                var bUpdated = this._setCreatedByCondition(oFilterBar, true, sCurrentUser);
                if (bUpdated) {
                    if (typeof oFilterBar.triggerSearch === "function") {
                        oFilterBar.triggerSearch();
                    } else if (typeof oFilterBar.fireSearch === "function") {
                        oFilterBar.fireSearch();
                    }
                }
                this._bSyncingMyJobs = false;
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

                        // Keep My Jobs condition when user filters from table toolbar (sort/group/filter/settings).
                        if (typeof oContent.attachStateChange === "function" && !this._bMyJobsStateAttached) {
                            oContent.attachStateChange(this._syncMyJobsCondition, this);
                            this._bMyJobsStateAttached = true;
                        }
                    }
                }

                var oMacroFilterBar = this.byId("FilterBar");
                if (oMacroFilterBar && typeof oMacroFilterBar.getContent === "function") {
                    var oFilterBar = oMacroFilterBar.getContent();
                    if (oFilterBar && typeof oFilterBar.attachSearch === "function" && !this._bMyJobsSearchAttached) {
                        oFilterBar.attachSearch(this._syncMyJobsCondition, this);
                        this._bMyJobsSearchAttached = true;
                    }
                }
            }
        });
    }
);
