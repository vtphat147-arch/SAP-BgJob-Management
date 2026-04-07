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
                startImmediately: true,
                startDate: new Date(),
                recurrence: "Single Run"
            };
            var oModel = new JSONModel(oData);
            this.getView().setModel(oModel, "local");
        },

        onCheckStep1: function () {
            var oModel = this.getView().getModel("local");
            var sJob = oModel.getProperty("/jobName");
            var sProg = oModel.getProperty("/programName");
            var sVariant = oModel.getProperty("/variantName");

            var bValid = sJob.length > 0 && sProg.length > 0 && sVariant.length > 0;
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

        onProgramValueHelp: function (oEvent) {
            var oView = this.getView();

            if (!this._pProgramDialog) {
                this._pProgramDialog = Fragment.load({
                    id: oView.getId(),
                    name: "project5.ext.fragment.ProgramValueHelp",
                    controller: this
                }).then(function (oDialog) {
                    oView.addDependent(oDialog);
                    return oDialog;
                });
            }

            this._pProgramDialog.then(function (oDialog) {
                // Clear filter cũ mỗi khi mở lại
                oDialog.getBinding("items").filter([]);
                oDialog.open();
            });
        },

        onProgramSearch: function (oEvent) {
            var sValue = oEvent.getParameter("value");
            var aFilters = [];

            if (sValue) {
                var oFilterName = new Filter("ProgramName", FilterOperator.Contains, sValue);
                var oFilterDesc = new Filter("Description", FilterOperator.Contains, sValue);
                aFilters.push(new Filter({ filters: [oFilterName, oFilterDesc], and: false }));
            }

            var oBinding = oEvent.getSource().getBinding("items");
            oBinding.filter(aFilters);
        },

        onProgramConfirm: function (oEvent) {
            var oSelectedItem = oEvent.getParameter("selectedItem");
            if (oSelectedItem) {
                var sProgram = oSelectedItem.getCells()[0].getText();
                var oModel = this.getView().getModel("local");
                oModel.setProperty("/programName", sProgram);
                oModel.setProperty("/variantName", "");
                this.onCheckStep1();
            }
        },

        onProgramChange: function (oEvent) {
            var sValue = oEvent.getParameter("value");
            if (sValue) {
                this.getView().getModel("local").setProperty("/programName", sValue.toUpperCase());
                this.getView().getModel("local").setProperty("/variantName", "");
            }
            this.onCheckStep1();
        },

        onVariantValueHelp: function (oEvent) {
            var oView = this.getView();
            var sProgramName = oView.getModel("local").getProperty("/programName");

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
                var oFilter = new Filter("ProgramName", FilterOperator.EQ, sProgramName);

                var oBinding = oDialog.getBinding("items");

                oBinding.filter([oFilter]);

                oDialog.open();
            });
        },

        onVariantSearch: function (oEvent) {
            var sValue = oEvent.getParameter("value");
            var sProgramName = this.getView().getModel("local").getProperty("/programName");

            var aFilters = [];
            aFilters.push(new Filter("ProgramName", FilterOperator.EQ, sProgramName));

            if (sValue) {
                aFilters.push(new Filter("VariantName", FilterOperator.Contains, sValue));
            }

            var oBinding = oEvent.getSource().getBinding("items");
            oBinding.filter(aFilters);
        },

        onVariantConfirm: function (oEvent) {
            var oSelectedItem = oEvent.getParameter("selectedItem");
            if (!oSelectedItem) {
                return;
            }
            var sVariant = oSelectedItem.getCells()[0].getText();
            this.getView().getModel("local").setProperty("/variantName", sVariant);
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

            oView.setBusy(true);
            var that = this;

            try {
                // a. Xử lý Date + Time từ DateTimePicker
                var oDate = oLocalData.startDate || new Date();

                // DateTimePicker có thể trả string, chuyển về Date object
                if (typeof oDate === "string") {
                    oDate = new Date(oDate);
                }
                if (!(oDate instanceof Date) || isNaN(oDate.getTime())) {
                    oDate = new Date();
                }

                // SAP server runs on Europe/Berlin timezone (CET in winter, CEST in summer)
                // User is in GMT+7. Must convert local time → SAP server time.
                // Using Intl API to auto-handle DST (CET=UTC+1 / CEST=UTC+2)
                var oFormatter = new Intl.DateTimeFormat('en-CA', {
                    timeZone: 'Europe/Berlin',
                    year: 'numeric', month: '2-digit', day: '2-digit',
                    hour: '2-digit', minute: '2-digit', second: '2-digit',
                    hour12: false
                });
                var aParts = oFormatter.formatToParts(oDate);
                var oParts = {};
                aParts.forEach(function (p) { oParts[p.type] = p.value; });

                var sStartDate = oParts.year + "-" + oParts.month + "-" + oParts.day;
                var sStartTime = oParts.hour + ":" + oParts.minute + ":" + oParts.second;



                // c. Xử lý IsImmediate: Metadata là String(1), KHÔNG PHẢI Boolean
                // Quy ước: Chạy ngay = "X", Chạy lịch = ""
                var sIsImmediate = oLocalData.startImmediately ? "X" : "";

                var sActionPath = "/JobList/com.sap.gateway.srvd.z_sd_job_ovp.v0001.ScheduleJob(...)";
                var oActionContext = oODataModel.bindContext(sActionPath);

                // 3. TRUYỀN THAM SỐ (Mapping chính xác từng dòng)
                oActionContext.setParameter("JobName", oLocalData.jobName || "New Job");
                oActionContext.setParameter("ProgramName", oLocalData.programName);
                oActionContext.setParameter("VariantName", oLocalData.variantName || "");

                oActionContext.setParameter("IsImmediate", sIsImmediate);

                oActionContext.setParameter("StartDate", sStartDate);
                oActionContext.setParameter("StartTime", sStartTime);

                // Xử lý FrequencyType + FrequencyValue (BẮT BUỘC trong Z_A_JOB_REQ)
                var sRecurrence = oLocalData.recurrence || "Single Run";
                var sFreqType = "";
                var iFreqValue = 0;

                switch (sRecurrence) {
                    case "Every Minute":  sFreqType = "MINUTES"; iFreqValue = 1; break;
                    case "Hourly":        sFreqType = "HOURLY";  iFreqValue = 1; break;
                    case "Daily":         sFreqType = "DAILY";   iFreqValue = 1; break;
                    case "Weekly":        sFreqType = "WEEKLY";  iFreqValue = 1; break;
                    case "Monthly":       sFreqType = "MONTHLY"; iFreqValue = 1; break;
                    default:              sFreqType = "";        iFreqValue = 0; break;
                }

                oActionContext.setParameter("FrequencyType", sFreqType);
                oActionContext.setParameter("FrequencyValue", iFreqValue);



                // 5. THỰC THI VÀ CHỜ KẾT QUẢ (Promise)
                oActionContext.execute().then(function () {
                    // --- THÀNH CÔNG (Backend trả về HTTP 2xx) ---
                    // Lưu ý: Nếu muốn lấy message thành công từ Backend gửi lên header sap-messages,
                    // OData V4 model thường tự động xử lý và hiện MessageToast nếu configured.
                    // Tuy nhiên ta cứ hiện thủ công cho chắc chắn.
                    MessageToast.show("Job created successfully!");

                    // Reset wizard và quay lại
                    that.onNavBack();

                }).catch(function (oError) {
                    // --- THẤT BẠI (Backend trả về HTTP 4xx/5xx hoặc có lỗi trong failed table) ---
                    console.error("Job Creation Failed:", oError);

                    // Trích xuất thông báo lỗi từ OData V4 response
                    var sErrorMsg = "Unknown error occurred.";
                    if (oError.error && oError.error.message) {
                        sErrorMsg = oError.error.message;
                    } else if (oError.message) {
                        sErrorMsg = oError.message;
                    }

                    MessageBox.error("Failed to schedule job.\n\n" + sErrorMsg);

                }).finally(function () {
                    oView.setBusy(false);
                });

            } catch (oEx) {
                console.error("Client Error:", oEx);
                oView.setBusy(false);
                MessageBox.error("Client error: " + oEx.message);
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