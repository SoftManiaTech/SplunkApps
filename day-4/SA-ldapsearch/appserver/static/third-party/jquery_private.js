define(["/static/app/SA-ldapsearch/swc-ldapsearch/index.js",
        "/static/app/SA-ldapsearch/third-party/jquery-3.5.0.min.js"], function(index) {
    // Update CSRF token value from the cookie with JQuery ajaxPrefilter for CSRF validation
    // Below block of code is required while using jQuery if the js code uses service.post() which requires CSRF validation with POST.
    var HEADER_NAME = 'X-Splunk-Form-Key';
    const SplunkUtil = index.SplunkUtil;
    var FORM_KEY = SplunkUtil.getFormKey();
    if (!FORM_KEY) {
        return;
    }
    if ($) {
        $.ajaxPrefilter(function(options, originalOptions, jqXHR) {
            if (options['type'] && options['type'].toUpperCase() == 'GET') return;
            FORM_KEY = SplunkUtil.getFormKey();
            jqXHR.setRequestHeader(HEADER_NAME, FORM_KEY);
        });
    }
    // Raw jQuery does not return anything, so return it explicitly here.
    return jQuery;
})