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

        onInit: function () {
            var oData = {
                jobName: "",
                programName: "",
                variantName: "",
                touched: false,
                startImmediately: true,
                startDate: new Date(),
                recurrence: "Single Run"
            };
            var oModel = new JSONModel(oData);
            this.getView().setModel(oModel, "local");
        },

        onMarkTouched: function () {
            this.getView().getModel("local").setProperty("/touched", true);
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
        _openValueHelp: async function (sDialogKey, sFragmentName, aInitialFilters) {
            var oView = this.getView();
            // 1. Nếu Dialog chưa được tạo, thì Load nó lên và lưu vào biến
            if (!this[sDialogKey]) {
                this[sDialogKey] = await Fragment.load({
                    id: oView.getId(),
                    name: "project5.ext.fragment." + sFragmentName,
                    controller: this
                });
                oView.addDependent(this[sDialogKey]);  // Cho phép Dialog xài chung dữ liệu với View
            }
            // 2. Lấy cái Dialog ra xài: áp filter và Mở lên
            var oDialog = this[sDialogKey];
            oDialog.getBinding("items").filter(aInitialFilters || []);
            oDialog.open();
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
                this.onMarkTouched();
            }
        },

        onProgramChange: function (oEvent) {
            var sValue = oEvent.getParameter("value");
            if (sValue) {
                var oModel = this.getView().getModel("local");
                oModel.setProperty("/programName", sValue.toUpperCase());
                oModel.setProperty("/variantName", "");
            }
            this.onMarkTouched();
        },

        // ========== VARIANT VALUE HELP ==========
        onVariantValueHelp: function () {
            var sProgramName = this.getView().getModel("local").getProperty("/programName");
            if (!sProgramName) {
                MessageToast.show("Please enter Program Name before selecting a Variant.");
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
            this.onMarkTouched();
        },


        onCheckImmediate: function (oEvent) {
            var bSelected = oEvent.getParameter("selected");
            var oModel = this.getView().getModel("local");

            if (bSelected) {
                oModel.setProperty("/startDate", new Date());
            }
        },

        onWizardCompleted: async function () {
            var oView = this.getView();
            var oLocalData = oView.getModel("local").getData();
            var oODataModel = oView.getModel();

            oView.setBusy(true);

            try {
                // 1. Chuyển đổi Ngày Giờ sang múi giờ Berlin (SAP Server)
                var oDate = oLocalData.startDate ? new Date(oLocalData.startDate) : new Date();
                if (isNaN(oDate.getTime())) oDate = new Date();
                
                var oParts = {};
                new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', hour12: false, 
                    year: 'numeric', month: '2-digit', day: '2-digit', 
                    hour: '2-digit', minute: '2-digit', second: '2-digit'
                }).formatToParts(oDate).forEach(p => oParts[p.type] = p.value);

                // 2. Map Tần suất (Frequency) sang Format Backend
                var mFreqMap = { "Minutes": "MINUTES", "Hourly": "HOURLY", "Daily": "DAILY", "Weekly": "WEEKLY", "Monthly": "MONTHLY" };
                var sFreqType = mFreqMap[oLocalData.recurrence] || "";

                // 3. Chuẩn bị và Gắn tham số cho OData Action
                var oAction = oODataModel.bindContext("/JobList/com.sap.gateway.srvd.z_sd_job_ovp.v0001.ScheduleJob(...)");
                oAction.setParameter("JobName", oLocalData.jobName || "New Job");
                oAction.setParameter("ProgramName", oLocalData.programName);
                oAction.setParameter("VariantName", oLocalData.variantName || "");
                oAction.setParameter("IsImmediate", oLocalData.startImmediately ? "X" : "");
                oAction.setParameter("StartDate", `${oParts.year}-${oParts.month}-${oParts.day}`);
                oAction.setParameter("StartTime", `${oParts.hour}:${oParts.minute}:${oParts.second}`);
                oAction.setParameter("FrequencyType", sFreqType);
                oAction.setParameter("FrequencyValue", sFreqType ? (parseInt(oLocalData.frequency) || 1) : 0);

                // 4. Bắn Action xuống Backend và Đợi
                await oAction.execute(); 

                // 5. Đọc thông báo thành công và Quay về
                var aMessages = sap.ui.getCore().getMessageManager().getMessageModel().getData();
                var oSuccessMsg = aMessages.slice().reverse().find(m => m.type === "Success");
                
                MessageToast.show(oSuccessMsg ? oSuccessMsg.message : "Job created successfully!");
                this.onNavBack();

            } catch (oError) {
                var sMsg = (oError.error && oError.error.message) || oError.message || "Unknown error";
                MessageBox.error("Failed to schedule job.\n\n" + sMsg);
            } finally {
                oView.setBusy(false);
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