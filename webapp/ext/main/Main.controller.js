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

            // ==================== I18N HELPER ====================
            _getText: function (sKey, aArgs) {
                var oModel = this.getView().getModel("i18n");
                if (!oModel) {
                    var oComp = this.getOwnerComponent();
                    if (oComp) { oModel = oComp.getModel("i18n"); }
                }
                return oModel ? oModel.getResourceBundle().getText(sKey, aArgs) : sKey;
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
                    MessageToast.show(this._getText("msgSelectJob"));
                    return;
                }

                this._openActionDialog(
                    "com.sap.gateway.srvd.z_sd_job_ovp.v0001.ReleaseJob",
                    this._getText("titleDefineStartCondition")
                );
            },

            // ==================== HELPER: Open Action Dialog ====================
            _openActionDialog: function (sActionName, sTitle) {
                var oTable = this.byId("Table");
                var aSelectedContexts = oTable.getSelectedContexts();

                if (aSelectedContexts.length === 0) {
                    MessageToast.show(this._getText("msgSelectJob"));
                    return;
                }

                // Save current Action Name to use in onConfirmRelease
                this._sCurrentAction = sActionName;
                // Save Selected Contexts
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
                    MessageToast.show(this._getText("msgSelectJob"));
                    this._bConfirmInFlight = false;
                    return;
                }

                // --- 1. GET RAW VALUES FROM UI ---
                var sRawDate = this.byId("idReleaseDate") ? this.byId("idReleaseDate").getValue() : "";     // "2026-03-18"
                var sRawTime = this.byId("idReleaseTime") ? this.byId("idReleaseTime").getValue() : "";     // "05:00:00"
                var bIsImmediate = this.byId("idImmedCheck") ? this.byId("idImmedCheck").getSelected() : false;

                // --- 2. FORMAT FOR ODATA V4 AND CONVERT TIMEZONE (LIKE CREATE JOB) ---
                var sSapDate = "";
                var sSapTime = "";
                var oDate = null;

                if (bIsImmediate) {
                    oDate = new Date(); // Get current time 
                } else if (sRawDate && sRawTime) {
                    // Convert UI string (local time from YYYY-MM-DD and HH:mm:ss) to Date object
                    oDate = new Date(sRawDate + "T" + sRawTime);
                }

                if (oDate && !isNaN(oDate.getTime())) {
                    // Convert local time -> SAP server time (Europe/Berlin)
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

                // --- 4. VALIDATE: If not Immediate, Date and Time are required ---
                if (!bIsImmediate && (!sSapDate || !sSapTime)) {
                    MessageToast.show(this._getText("msgEnterDateTime"));
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

                // --- USE EXTENSION API WITH DYNAMIC ACTION FROM this._sCurrentAction ---
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
                    var sErrMsg = oError && oError.message ? oError.message : this._getText("msgPleaseTryAgain");

                    // Ignore action state sync errors (metadata/cache) to prevent gray error popups.
                    if (sErrMsg.toLowerCase().includes("enabled")) {
                        console.log("System state was refreshed.");
                        return;
                    }

                    console.error("Action error details:", oError);
                    MessageBox.error(this._getText("msgExecutionFailed", [sErrMsg]));
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

            // ==================== HELPER: Call Bound Action for multiple rows ====================
            _executeAction: async function (aContexts, sActionName, sLabel, oOptions) {
                var aSuccess = [];
                var aFailed = [];

                // --- 0. Clear old error messages ---
                var oMessageManager = sap.ui.getCore().getMessageManager();
                oMessageManager.removeAllMessages();

                // Run jobs sequentially to avoid SAP Batch errors
                for (var oContext of aContexts) {
                    var sJobName = oContext.getProperty("JobName") || "(unknown)";
                    try {
                        var oActionContext = oContext.getModel().bindContext(sActionName + "(...)", oContext);
                        await oActionContext.execute(); // Wait for completion before next iteration
                        aSuccess.push(sJobName);
                    } catch (oError) {
                        var sErr = oError?.error?.message || oError?.message || this._getText("msgUnknownError");
                        aFailed.push({ name: sJobName, error: sErr });
                    }
                }

                // Display result after all executions
                if (aSuccess.length > 0) {
                    MessageToast.show(sLabel + " xong cho: " + aSuccess.join(", "));
                }
                if (aFailed.length > 0) {
                    var sErrors = aFailed.map(function (r) { return "• " + r.name + ": " + r.error; }).join("\n");
                    MessageBox.error(this._getText("msgActionFailed", [sLabel, aFailed.length, sErrors]));
                }

                this._refreshTable();
            },

            // ==================== REPEAT JOB ====================
            onRepeatJob: function () {
                var oTable = this.byId("Table");
                var aSelectedContexts = oTable.getSelectedContexts();

                if (aSelectedContexts.length === 0) {
                    MessageToast.show(this._getText("msgSelectJobRepeat"));
                    return;
                }

                this._openActionDialog(
                    "com.sap.gateway.srvd.z_sd_job_ovp.v0001.RepeatWithSchedule",
                    this._getText("titleDefineStartConditionRepeat")
                );
            },

            // ==================== COPY & RENAME JOB ====================
            onCopyWithRename: function () {
                var aSelectedContexts = this.byId("Table").getSelectedContexts();

                if (aSelectedContexts.length === 0) {
                    MessageToast.show(this._getText("msgSelectJobCopy"));
                    return;
                }

                var that = this;
                var oExtensionAPI = this.getExtensionAPI();

                // Full Action name (Namespace.Action)
                var sActionName = "com.sap.gateway.srvd.z_sd_job_ovp.v0001.CopyJob";

                // Call CopyJob Action - SAP automatically shows Popup based on Abstract Entity
                // to input NewJobName parameter
                oExtensionAPI.editFlow.invokeAction(sActionName, {
                    contexts: [aSelectedContexts[0]] // Pass Context of selected row
                }).then(function () {
                    // Success
                    MessageToast.show(this._getText("msgCopyRenameCompleted"));

                    // New Job might have empty StartDate, clear StartDate filter to prevent hiding.
                    that._clearStartDateFilter();
                    that._refreshTable();
                }).catch(function (err) {
                    // If user cancels or error
                    console.error("Copy Job error:", err);
                    if (err && err.message && err.message.indexOf("cancelled") === -1) {
                        MessageBox.error(this._getText("msgCopyJobFailed", [err.message || this._getText("msgPleaseTryAgain")]));
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

            // ==================== STOP JOB (with Confirmation) ====================
            onStopJob: function () {
                var oTable = this.byId("Table");
                var aSelectedContexts = oTable.getSelectedContexts();

                if (aSelectedContexts.length === 0) {
                    MessageToast.show(this._getText("msgSelectJobStop"));
                    return;
                }

                var iCount = aSelectedContexts.length;
                var sMessage = this._getText("msgConfirmStop", [iCount]);

                var that = this;
                MessageBox.confirm(sMessage, {
                    title: this._getText("titleConfirmStop"),
                    emphasizedAction: MessageBox.Action.OK,
                    onClose: function (sAction) {
                        if (sAction === MessageBox.Action.OK) {
                            that._executeAction(aSelectedContexts, "com.sap.gateway.srvd.z_sd_job_ovp.v0001.StopJob", that._getText("lblStop"));
                        }
                    }
                });
            },

            // ==================== DELETE JOB (with Confirmation) ====================
            onDeleteJob: function () {
                var oTable = this.byId("Table");
                var aSelectedContexts = oTable.getSelectedContexts();
                if (aSelectedContexts.length === 0) {
                    MessageToast.show(this._getText("msgSelectJobDelete"));
                    return;
                }

                var iCount = aSelectedContexts.length;
                var sMessage = this._getText("msgConfirmDelete", [iCount]);

                var that = this;
                MessageBox.confirm(sMessage, {
                    title: this._getText("titleConfirmDelete"),
                    emphasizedAction: MessageBox.Action.OK,
                    onClose: function (sAction) {
                        if (sAction === MessageBox.Action.OK) {
                            that._executeAction(aSelectedContexts, "com.sap.gateway.srvd.z_sd_job_ovp.v0001.DeleteJob", that._getText("lblDelete"));
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

                // 1. Get current logged-in user (in Fiori Launchpad or Sandbox)
                if (sap.ushell && sap.ushell.Container) {
                    sCurrentUser = sap.ushell.Container.getService("UserInfo").getId();
                } else {
                    // If running standalone (index.html) without FLP, user is unknown
                    sCurrentUser = "";
                    MessageToast.show(this._getText("msgWarningNoFLP"));
                }

                if (!sCurrentUser) {
                    return; // Cannot filter if user is unknown
                }

                // 2. Find table binding
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

                // 3. Toggle filter: press 1 -> filter, press 2 -> clear
                if (oBinding) {
                    if (this._bFilteringOwnJobs) {
                        oBinding.filter([], "Application");
                        this._bFilteringOwnJobs = false;
                        MessageToast.show(this._getText("msgShowingAllJobs"));
                    } else {
                        var oFilter = new Filter("CreatedBy", FilterOperator.EQ, sCurrentUser);
                        oBinding.filter(oFilter, "Application");
                        this._bFilteringOwnJobs = true;
                        MessageToast.show(this._getText("msgFilteringBy", [sCurrentUser]));
                    }
                }
            },
            // --- ADD THIS TO NAVIGATE TO DETAIL PAGE (LIKE SM37) ---
            onRowPress: function (oEvent) {
                var oContext = oEvent.getParameters().bindingContext || oEvent.getSource().getBindingContext();
                if (!oContext) {
                    return;
                }

                var oExtensionAPI = this.getExtensionAPI();
                if (oExtensionAPI && oExtensionAPI.routing) {

                    // 1. Get Context Path
                    // Example sPath: "/JobList(JobName='BJSM_TEST',JobCount='000001')"
                    var sPath = oContext.getPath();

                    // 2. Extract Key from parentheses
                    var sKey = sPath.substring(sPath.indexOf("(") + 1, sPath.indexOf(")"));

                    // 3. Navigate to Object Page declared in manifest.json
                    // Route name "JobListObjectPage" and variable "JobListKey" must match manifest
                    oExtensionAPI.routing.navigateToRoute("JobListObjectPage", {
                        "JobListKey": sKey
                    });
                }
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
