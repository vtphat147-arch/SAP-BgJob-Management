sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/Fragment",
    "sap/m/MessageToast",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageBox"
], function (Controller, JSONModel, Fragment, MessageToast, Filter, FilterOperator, MessageBox) {
    "use strict";

    return Controller.extend("project5.ext.main.CreateJob", {

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

        onInit: function () {
            var oData = {
                jobName: "",
                programName: "",
                variantName: "",
                showStep1Errors: false,
                startImmediately: true,
                startDate: new Date(),
                recurrence: "Single Run"
            };
            var oModel = new JSONModel(oData);
            this.getView().setModel(oModel, "local");
        },

        onCheckStep1: function () {
            var oModel = this.getView().getModel("local");
            var sJob = (oModel.getProperty("/jobName") || "").trim();
            var sProg = (oModel.getProperty("/programName") || "").trim();
            var sVariant = (oModel.getProperty("/variantName") || "").trim();

            // Show Step 1 error states only after user starts interacting.
            var bHasInteraction = sJob.length > 0 || sProg.length > 0 || sVariant.length > 0;
            oModel.setProperty("/showStep1Errors", bHasInteraction);

            // Variant is optional (SM36 behavior). Only Job Name + Program Name are required.
            var bValid = sJob.length > 0 && sProg.length > 0;
            this.byId("Step1").setValidated(bValid);
        },

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

            this._oBackupData = JSON.parse(JSON.stringify(oView.getModel("local").getData()));

            this._pDialog.then(function (oDialog) {
                oDialog.open();
            });
        },

        onCloseScheduleDialog: function () {
            var oModel = this.getView().getModel("local");
            var sRecurrence = oModel.getProperty("/recurrence");

            if (sRecurrence !== "Single Run") {
                var sFrequency = String(oModel.getProperty("/frequency") || "").trim();
                var iFreq = Number(sFrequency);
                
                if (!/^[1-9]\d*$/.test(sFrequency) || !Number.isInteger(iFreq) || iFreq <= 0) {
                    MessageBox.error(this._t("msgInvalidFrequency"));
                    return;
                }
            }

            this.byId("CreateJobWizard").validateStep(this.byId("Step2"));
            this._pDialog.then(function (oDialog) {
                oDialog.close();
            });
        },

        onCancelScheduleDialog: function () {
            if (this._oBackupData) {
                this.getView().getModel("local").setData(this._oBackupData);
            }
            this._pDialog.then(function (oDialog) {
                oDialog.close();
            });
        },

        onResetSchedule: function () {
            var oModel = this.getView().getModel("local");
            oModel.setProperty("/startImmediately", true);
            oModel.setProperty("/startDate", new Date());
            oModel.setProperty("/recurrence", "Single Run");
        },

        // ========== HELPER: Mở Value Help Dialog (Dùng chung cho Program & Variant) ==========
        _openValueHelp: function (sDialogKey, sFragmentName, aInitialFilters) {
            var oView = this.getView();

            if (!this["_p" + sDialogKey]) {
                this["_p" + sDialogKey] = Fragment.load({
                    id: oView.getId(),
                    name: "project5.ext.fragment." + sFragmentName,
                    controller: this
                }).then(function (oDialog) {
                    oView.addDependent(oDialog);
                    return oDialog;
                });
            }

            this["_p" + sDialogKey].then(function (oDialog) {
                oDialog.getBinding("items").filter(aInitialFilters || []);
                oDialog.open();
            });
        },

        // ========== PROGRAM VALUE HELP ==========
        onProgramValueHelp: function () {
            this._openValueHelp("ProgramDialog", "ProgramValueHelp", []);
        },

        onProgramSearch: function (oEvent) {
            var sValue = oEvent.getParameter("value");
            var aFilters = [];
            if (sValue) {
                aFilters.push(new Filter({
                    filters: [
                        new Filter("ProgramName", FilterOperator.Contains, sValue),
                        new Filter("Description", FilterOperator.Contains, sValue)
                    ],
                    and: false
                }));
            }
            oEvent.getSource().getBinding("items").filter(aFilters);
        },

        onProgramConfirm: function (oEvent) {
            var oSelectedItem = oEvent.getParameter("selectedItem");
            if (oSelectedItem) {
                var oModel = this.getView().getModel("local");
                oModel.setProperty("/programName", oSelectedItem.getCells()[0].getText());
                oModel.setProperty("/variantName", "");
                this.onCheckStep1();
            }
        },

        onProgramChange: function (oEvent) {
            var sValue = oEvent.getParameter("value");
            if (sValue) {
                var oModel = this.getView().getModel("local");
                oModel.setProperty("/programName", sValue.toUpperCase());
                oModel.setProperty("/variantName", "");
            }
            this.onCheckStep1();
        },

        // ========== VARIANT VALUE HELP ==========
        onVariantValueHelp: function () {
            var sProgramName = this.getView().getModel("local").getProperty("/programName");
            if (!sProgramName) {
                MessageToast.show(this._t("msgEnterProgramBeforeVariant"));
                return;
            }
            this._openValueHelp("VariantDialog", "VariantValueHelp", [
                new Filter("ProgramName", FilterOperator.EQ, sProgramName)
            ]);
        },

        onVariantSearch: function (oEvent) {
            var sValue = oEvent.getParameter("value");
            var sProgramName = this.getView().getModel("local").getProperty("/programName");
            var aFilters = [new Filter("ProgramName", FilterOperator.EQ, sProgramName)];
            if (sValue) {
                aFilters.push(new Filter("VariantName", FilterOperator.Contains, sValue));
            }
            oEvent.getSource().getBinding("items").filter(aFilters);
        },

        onVariantConfirm: function (oEvent) {
            var oSelectedItem = oEvent.getParameter("selectedItem");
            if (!oSelectedItem) { return; }
            this.getView().getModel("local").setProperty("/variantName", oSelectedItem.getCells()[0].getText());
            this.onCheckStep1();
        },


        onCheckImmediate: function (oEvent) {
            var bSelected = oEvent.getParameter("selected");
            var oModel = this.getView().getModel("local");

            if (bSelected) {
                oModel.setProperty("/startDate", new Date());
            }
        },

        onWizardCompleted: function () {
            var oView = this.getView();
            var oLocalData = oView.getModel("local").getData();
            var oODataModel = oView.getModel();
            var that = this;

            oView.setBusy(true);

            try {
                // 1. Convert date → SAP server timezone (Europe/Berlin, auto DST)
                var oDate = oLocalData.startDate ? new Date(oLocalData.startDate) : new Date();
                if (isNaN(oDate.getTime())) { oDate = new Date(); }

                var oParts = {};
                new Intl.DateTimeFormat('en-CA', {
                    timeZone: 'Europe/Berlin',
                    year: 'numeric', month: '2-digit', day: '2-digit',
                    hour: '2-digit', minute: '2-digit', second: '2-digit',
                    hour12: false
                }).formatToParts(oDate).forEach(function (p) { oParts[p.type] = p.value; });

                var sStartDate = oParts.year + "-" + oParts.month + "-" + oParts.day;
                var sStartTime = oParts.hour + ":" + oParts.minute + ":" + oParts.second;

                // 2. Frequency mapping (recurrence → SAP FrequencyType)
                var mFreqMap = { "Minutes": "MINUTES", "Hourly": "HOURLY", "Daily": "DAILY", "Weekly": "WEEKLY", "Monthly": "MONTHLY" };
                var sRecurrence = oLocalData.recurrence || "Single Run";
                var sFreqType = mFreqMap[sRecurrence] || "";
                
                var iFreqValue = 0;
                if (sFreqType) {
                    var sFreqRaw = String(oLocalData.frequency || "").trim();
                    var iFreq = Number(sFreqRaw);
                    
                    if (!/^[1-9]\d*$/.test(sFreqRaw) || !Number.isInteger(iFreq) || iFreq <= 0) {
                        MessageBox.error(this._t("msgInvalidFrequency"));
                        oView.setBusy(false);
                        return;
                    }
                    iFreqValue = iFreq;
                }

                // 3. Build & execute OData action
                var oAction = oODataModel.bindContext(
                    "/JobList/com.sap.gateway.srvd.z_sd_job_ovp.v0001.ScheduleJob(...)"
                );

                oAction.setParameter("JobName", oLocalData.jobName || this._t("defaultNewJobName"));
                oAction.setParameter("ProgramName", oLocalData.programName);
                oAction.setParameter("VariantName", oLocalData.variantName || "");
                oAction.setParameter("IsImmediate", oLocalData.startImmediately ? "X" : "");
                oAction.setParameter("StartDate", sStartDate);
                oAction.setParameter("StartTime", sStartTime);
                oAction.setParameter("FrequencyType", sFreqType);
                oAction.setParameter("FrequencyValue", iFreqValue);

                oAction.execute().then(function () {
                    MessageToast.show(that._t("msgJobCreatedSuccess"));
                    that.onNavBack();

                }).catch(function (oError) {
                    console.error("Job Creation Failed:", oError);
                    var sMsg = (oError.error && oError.error.message) || oError.message || that._t("labelUnknownError");
                    MessageBox.error(that._t("msgFailedScheduleJob", [sMsg]));

                }).finally(function () {
                    oView.setBusy(false);
                });

            } catch (oEx) {
                console.error("Client Error:", oEx);
                oView.setBusy(false);
                MessageBox.error(this._t("msgClientError", [oEx.message]));
            }
        },



        onNavBack: function () {
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.navTo("JobListMain");

            this.onInit();
            var oWizard = this.byId("CreateJobWizard");
            if (oWizard) {
                var oStep1 = this.byId("Step1");
                oWizard.discardProgress(oStep1);
            }
        }
    });
});