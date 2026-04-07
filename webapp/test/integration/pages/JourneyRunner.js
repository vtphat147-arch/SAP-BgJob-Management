sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"project5/test/integration/pages/JobListMain"
], function (JourneyRunner, JobListMain) {
    'use strict';

    var runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('project5') + '/test/flp.html#app-preview',
        pages: {
			onTheJobListMain: JobListMain
        },
        async: true
    });

    return runner;
});

