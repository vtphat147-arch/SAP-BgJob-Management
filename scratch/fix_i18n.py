import os

def update_file(filepath, replacements):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    for old, new in replacements:
        content = content.replace(old, new)
        
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

js_path = r'e:\SAP\Do_An_2\SAP-BgJob-Management\webapp\ext\main\Main.controller.js'
xml_path = r'e:\SAP\Do_An_2\SAP-BgJob-Management\webapp\ext\main\Main.view.xml'
i18n_path = r'e:\SAP\Do_An_2\SAP-BgJob-Management\webapp\i18n\i18n.properties'

js_replacements = [
    # Add _getText
    ('''            // ==================== REFRESH ====================
            onRefreshTable: function () {
                this._refreshTable();
            },''', 
             '''            // ==================== I18N HELPER ====================
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
            },'''),

    ('MessageToast.show("Please select a job.");', 'MessageToast.show(this._getText("msgSelectJob"));'),
    ('"Define Start Condition"', 'this._getText("titleDefineStartCondition")'),
    ('MessageToast.show("Please enter start date and start time.");', 'MessageToast.show(this._getText("msgEnterDateTime"));'),
    ('MessageBox.error("The scheduled start date and time cannot be in the past.");', 'MessageBox.error(this._getText("msgDateInPast"));'),
    ('var sActionLabel = (sCurrentAction.indexOf("Repeat") !== -1) ? "Repeat Job" : "Release Job";\n                        MessageToast.show(sActionLabel + " completed successfully.");', 'var sActionLabel = (sCurrentAction.indexOf("Repeat") !== -1) ? this._getText("lblRepeatJob") : this._getText("lblReleaseJob");\n                        MessageToast.show(this._getText("msgActionCompleted", [sActionLabel]));'),
    ('var sErrMsg = oError && oError.message ? oError.message : "Please try again.";', 'var sErrMsg = oError && oError.message ? oError.message : this._getText("msgPleaseTryAgain");'),
    ('MessageBox.error("Execution failed: " + sErrMsg);', 'MessageBox.error(this._getText("msgExecutionFailed", [sErrMsg]));'),
    ('var sErr = oError?.error?.message || oError?.message || "Unknown error";', 'var sErr = oError?.error?.message || oError?.message || this._getText("msgUnknownError");'),
    ('MessageToast.show(sLabel + " completed for: " + aSuccess.join(", "));', 'MessageToast.show(this._getText("msgActionSuccess", [sLabel, aSuccess.join(", ")]));'),
    ('MessageBox.error(sLabel + " failed for " + aFailed.length + " job(s):\\n\\n" + sErrors);', 'MessageBox.error(this._getText("msgActionFailed", [sLabel, aFailed.length, sErrors]));'),
    ('MessageToast.show("Please select at least one job to repeat.");', 'MessageToast.show(this._getText("msgSelectJobRepeat"));'),
    ('"Define Start Condition for Repeat Job"', 'this._getText("titleDefineStartConditionRepeat")'),
    ('MessageToast.show("Please select at least one job to copy.");', 'MessageToast.show(this._getText("msgSelectJobCopy"));'),
    ('MessageBox.warning(\n                        "You have selected multiple jobs. Only the first selected job (" + sOldJobName + ") will be copied.\\n\\nDo you want to continue?", \n                        {',
     'MessageBox.warning(\n                        this._getText("msgMultipleJobsCopied", [sOldJobName]), \n                        {'),
    ('title: "Multiple Jobs Selected",', 'title: this._getText("titleMultipleJobs"),'),
    ('oInput.setValueStateText("Job name is required.");', 'oInput.setValueStateText(this._getText("msgJobNameRequired"));'),
    ('MessageBox.error("Cannot find the selected job context.");', 'MessageBox.error(this._getText("msgCannotFindContext"));'),
    ('MessageToast.show("Copy and Rename completed successfully.");', 'MessageToast.show(this._getText("msgCopyRenameCompleted"));'),
    ('MessageBox.error("Copy Job failed: " + (err.message || "Please try again."));', 'MessageBox.error(this._getText("msgCopyJobFailed", [err.message || this._getText("msgPleaseTryAgain")]));'),
    ('MessageToast.show("Please select at least one job to stop.");', 'MessageToast.show(this._getText("msgSelectJobStop"));'),
    ('var sMessage = "Do you want to stop " + iCount + " selected job(s)?";', 'var sMessage = this._getText("msgConfirmStop", [iCount]);'),
    ('title: "Confirm Stop Job",', 'title: this._getText("titleConfirmStop"),'),
    ('that._executeAction(aSelectedContexts, "com.sap.gateway.srvd.z_sd_job_ovp.v0001.StopJob", "Stop");', 'that._executeAction(aSelectedContexts, "com.sap.gateway.srvd.z_sd_job_ovp.v0001.StopJob", that._getText("lblStop"));'),
    ('MessageToast.show("Please select at least one job to delete.");', 'MessageToast.show(this._getText("msgSelectJobDelete"));'),
    ('var sMessage = "Do you want to delete " + iCount + " selected job(s)?";', 'var sMessage = this._getText("msgConfirmDelete", [iCount]);'),
    ('title: "Confirm Delete Job",', 'title: this._getText("titleConfirmDelete"),'),
    ('that._executeAction(aSelectedContexts, "com.sap.gateway.srvd.z_sd_job_ovp.v0001.DeleteJob", "Delete");', 'that._executeAction(aSelectedContexts, "com.sap.gateway.srvd.z_sd_job_ovp.v0001.DeleteJob", that._getText("lblDelete"));'),
    ('MessageToast.show("Warning: Not running in Fiori Launchpad. Cannot detect current user.");', 'MessageToast.show(this._getText("msgWarningNoFLP"));'),
    ('MessageToast.show("Showing all jobs.");', 'MessageToast.show(this._getText("msgShowingAllJobs"));'),
    ('MessageToast.show("Filtering jobs by: " + sCurrentUser);', 'MessageToast.show(this._getText("msgFilteringBy", [sCurrentUser]));')
]

xml_replacements = [
    ('header="Background Jobs"', 'header="{i18n>backgroundJobs}"'),
    ('text="🔄 Refresh"', 'text="{i18n>btnRefresh}" icon="sap-icon://refresh"'),
    ('text="⚙️ Manage"', 'text="{i18n>btnManage}" icon="sap-icon://action"'),
    ('text="👤 My Jobs"', 'text="{i18n>btnMyJobs}" icon="sap-icon://employee"'),
    ('text="📅 Schedule"', 'text="{i18n>btnSchedule}" icon="sap-icon://calendar"'),
    ('text="🔗 Quick Link"', 'text="{i18n>btnQuickLink}" icon="sap-icon://chain-link"'),
    ('text="▶️ Release"', 'text="{i18n>btnRelease}" icon="sap-icon://media-play"'),
    ('text="🔁 Repeat"', 'text="{i18n>btnRepeat}" icon="sap-icon://synchronize"'),
    ('text="📄 Copy"', 'text="{i18n>btnCopy}" icon="sap-icon://copy"'),
    ('text="⏹️ Stop"', 'text="{i18n>btnStop}" icon="sap-icon://stop"'),
    ('text="🗑️ Delete"', 'text="{i18n>btnDelete}" icon="sap-icon://delete"'),
    ('text="📈 Dashboard"', 'text="{i18n>btnDashboard}" icon="sap-icon://barchart"'),
    ('text="🔍 Analyze"', 'text="{i18n>btnAnalyze}" icon="sap-icon://sys-monitor"')
]

i18n_append = """
# Messages -> Main Controller & UI
msgSelectJob=Please select a job.
msgSelectJobCopy=Please select at least one job to copy.
msgSelectJobRepeat=Please select at least one job to repeat.
msgSelectJobStop=Please select at least one job to stop.
msgSelectJobDelete=Please select at least one job to delete.
msgEnterDateTime=Please enter start date and start time.
msgDateInPast=The scheduled start date and time cannot be in the past.
msgActionCompleted={0} completed successfully.
lblRepeatJob=Repeat Job
lblReleaseJob=Release Job
lblStop=Stop
lblDelete=Delete
msgPleaseTryAgain=Please try again.
msgExecutionFailed=Execution failed: {0}
msgUnknownError=Unknown error
msgActionSuccess={0} completed for: {1}
msgActionFailed={0} failed for {1} job(s):\\n\\n{2}
titleDefineStartCondition=Define Start Condition
titleDefineStartConditionRepeat=Define Start Condition for Repeat Job
msgMultipleJobsCopied=You have selected multiple jobs. Only the first selected job ({0}) will be copied.\\n\\nDo you want to continue?
titleMultipleJobs=Multiple Jobs Selected
msgJobNameRequired=Job name is required.
msgCannotFindContext=Cannot find the selected job context.
msgCopyRenameCompleted=Copy and Rename completed successfully.
msgCopyJobFailed=Copy Job failed: {0}
msgConfirmStop=Do you want to stop {0} selected job(s)?
titleConfirmStop=Confirm Stop Job
msgConfirmDelete=Do you want to delete {0} selected job(s)?
titleConfirmDelete=Confirm Delete Job
lblStop=Stop
lblDelete=Delete
msgWarningNoFLP=Warning: Not running in Fiori Launchpad. Cannot detect current user.
msgShowingAllJobs=Showing all jobs.
msgFilteringBy=Filtering jobs by: {0}

btnRefresh=Refresh
btnManage=Manage
btnMyJobs=My Jobs
btnSchedule=Schedule
btnQuickLink=Quick Link
btnRelease=Release
btnRepeat=Repeat
btnCopy=Copy
btnStop=Stop
btnDelete=Delete
btnDashboard=Dashboard
btnAnalyze=Analyze
"""

update_file(js_path, js_replacements)
update_file(xml_path, xml_replacements)

with open(i18n_path, 'a', encoding='utf-8') as f:
    f.write(i18n_append)

print("Replacement complete.")
