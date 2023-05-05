/** Copyright (C) 2009-2021 Splunk Inc. All Rights Reserved. **/

/**
 * The window.onload function hides the Splunk dashboard header so that the dashboard editor is not presented
 * on the SA-ldapsearch configuration editing page.
 */
window.onload = function () {
    var dashboardHeaders = document.getElementsByClassName('dashboard-header');
    if (dashboardHeaders.length == 1) {
        dashboardHeaders[0].setAttribute('style', 'visibility: hidden; margin: 0 0 0 0; padding: 0 0 0 0; height: 0;');
    }
};

require.config({paths: {'SA-ldapsearch': '/static/app/SA-ldapsearch'}});

require([
        '/static/app/SA-ldapsearch/third-party/jquery_private.js',
        'splunkjs/mvc',
        '/static/app/SA-ldapsearch/swc-ldapsearch/index.js',
        'splunkjs/mvc/searchmanager',
        'splunkjs/mvc/simplesplunkview',
        '/static/app/SA-ldapsearch/third-party/bootstrap_def.js',
        'splunkjs/mvc/simplexml/ready!',

    ],
    function ($,mvc,index, SearchManager, SimpleView) {
      
       const Messages = index.MVCMessages;
       var TestConnectionView = SimpleView.extend({

            output_mode: "json",

            createView: function () {
                return true;
            },

            displayMessage: function (info) {

                if (this._isJobDone && this.manager.job != null) {
                    this._completeDialog();
                }

                this._viz = null;
                Messages.render(info, this.$el);

                return this;
            },

            updateView: function (visualization, data) {
                this._completeDialog();
                $(this.$el).text('distinguishedName: ' + data[0].distinguishedName);
            },

            _completeDialog: function () {

                var self = configurationEditor;

                var messages = this.manager.job.properties().messages;

                var header = $('#testConnectionDialog_header').text('Connection test for ' + $('#configured_domain').val());
                var connectionStatus;

                if (messages.length == 0) {
                    connectionStatus = {type: 'info', text: 'Test succeeded'};
                    header.text(header.text() + ' succeeded');
                }
                else {
                    connectionStatus = {type: 'error', text: 'Test failed'};

                    var messagePart = messages[0].text.split('\n');
                    var messageText;

                    try {
                        messageText = messagePart[2]
                            .replace(/""/g, '"')
                            .replace(/ # host: /g, '<p style="margin-bottom: 0; margin-top: 3px;">');
                    }
                    catch (error) {
                        messageText = messagePart.join('\n');
                    }

                    var message = $('#testConnectionDialog_message');

                    message.empty().append('<h4>Error</h4><div>' + messageText + '</div>');
                    message.css({display: ''});

                    header.text(header.text() + ' failed');
                }

                self._updateConnectionStatus(connectionStatus);

                $('#domains').children(':selected').data("connection.status", connectionStatus);
                $('#testConnectionDialog_close').text('Close');

                this.manager.job = null;
            }
        });

        /**
         * The `configurationEditor` object implements the actions behind the SA-ldapsearch configuration editing page.
         */
        var configurationEditor = {

            initialize: function (service) {

                var self = configurationEditor;

                //// Initialize Splunk service objects

                self._searchManager = new SearchManager({
                    id: 'TestConnectionSearchManager.f7d52d1a-2a21-11e4-b1fe-10ddb1b57bc3',
                    autostart: false});

                self._service = new splunkjs.Service(service.http, {
                    scheme: service.scheme,
                    host: service.host,
                    port: service.port,
                    username: service.username,
                    password: service.password,
                    owner: 'nobody',
                    app: service.app,
                    sessionKey: service.sessionKey,
                    autologin: service.autologin,
                    version: service.version
                });

                var namespace = {app: self._service.app};
                var storagePasswords = self._service.storagePasswords(namespace);

                var defaultConfigurationStanza = new splunkjs.Service.Endpoint(self._service, "properties/ldap/default");
                var defaultStoragePassword = storagePasswords.instantiateEntity({name: 'SA-ldapsearch:default:', acl: namespace});
                var configuration = self._service.configurations(namespace).instantiateEntity({name: 'ldap', acl: namespace});

                self._storagePasswords = storagePasswords;
                self._configuration = configuration;

                splunkjs.Async.parallel(
                    [
                        function (done) { // Get default stanza

                            defaultConfigurationStanza.get(undefined, {}, function (err, response) {

                                if (err != null) {
                                    return done(err, response);
                                }

                                var settings = {};

                                response.data.entry.forEach(function (entry) {
                                    settings[entry.name] = entry.content;
                                });

                                return done(null, settings);
                            });
                        },
                        function (done) { // Get default storage password

                            defaultStoragePassword.fetch({}, function (err, response) {

                                if (err == null) {
                                    return done(null, null);
                                }

                                if (err.status == 404) {
                                    return done(null, undefined);
                                }

                                return done(err, undefined);
                            });
                        },
                        function (done) { // Get the full list of additional stanza names

                            configuration.fetch({count: 0}, function (err, response) {

                                if (err) {
                                    return done(err, undefined);
                                }

                                var entries = response.properties().entry;
                                var count = entries.length;

                                var configurationStanzas = {};

                                for (var i = 0; i < count; i++) {
                                    configurationStanzas[entries[i].name] = entries[i].content.alternatedomain;
                                }

                                return done(null, configurationStanzas);
                            });
                        }
                    ],
                    function (err, defaultSettings, defaultPassword, configurationStanzas) {

                        if (err) {
                            self._alert('error', 'Initialization failed', err);
                            return;
                        }

                        var domains = $('#domains');

                        //// Transfer settings and set the current selection to the default stanza

                        var connectionStatus = {type: 'alert alert-warning', text: 'Untested'};
                        var defaultDomain = domains.children().first();

                        defaultDomain
                            .data('alternatedomain', defaultSettings.alternatedomain)
                            .data('connection.status', connectionStatus)
                            .data('password', defaultStoragePassword)
                            .data('stanza', defaultConfigurationStanza);

                        self._transferSettings(defaultSettings);
                        self._setSelection(defaultDomain);
                        self._isDirty(false);

                        //// Create the list of domains

                        for (var name in configurationStanzas) {
                            if (configurationStanzas.hasOwnProperty(name)) {
                                var option = $(document.createElement('option'))
                                    .attr('value', name)
                                    .text(name)
                                    .val(name)
                                    .data('alternatedomain', configurationStanzas[name])
                                    .data('connection.status', connectionStatus)
                                    .data('password', storagePasswords.instantiateEntity(
                                        {name: self._toStoragePasswordName(name), acl: namespace}))
                                    .data('stanza', configuration.instantiateEntity({name: name, acl: namespace}));
                                domains.append(option);
                            }
                        }

                        var nameMap = {};

                        domains.children('option').each(function (index, option) {

                            var alternatedomain = $(option).data('alternatedomain');

                            if (nameMap[alternatedomain] == undefined) {  // First guy in wins; forget the others
                                nameMap[alternatedomain] = option;
                            }

                            nameMap[$(option).val()] = option;  // Splunk guarantees that stanza names are unique
                        });

                        domains.data('name.map', nameMap);
                        self._bindEventHandlers();
                    });
            },

            add: function () {

                var self = configurationEditor;

                if (self._isDirty()) {
                    self.save().done(self._add());
                }
                else {
                    self._add();
                }
            },

            read: function () {

                var self = configurationEditor;
                var domain = $('#domains').children(':selected');

                if (domain.index() == 0) {
                    self._readDefaults();
                    return;
                }

                var configurationStanza = domain.data('stanza');
                var storagePassword = domain.data('password');

                splunkjs.Async.parallel(
                    [
                        function (done) { // Read configuration stanza
                            configurationStanza.fetch({count: 0}, function (err, resource) {
                                return done(null, {err: err, value: err == null ? resource.properties() : {}});
                            });
                        },
                        function (done) { // Read storage password

                            storagePassword.fetch({}, function (err, resource) {

                                if (err == null) {
                                    return done(null, {err: null, value: null});
                                }

                                if (err.status != 404) {
                                    return done(null, {err: err, value: undefined});
                                }

                                storagePassword = $('#domains').children().first().data('password');

                                storagePassword.fetch({}, function (err, resource) {

                                    if (err == null) {
                                        return done(null, {err: null, value: null});
                                    }

                                    if (err.status != 404) {
                                        return done(null, {err: err, value: undefined});
                                    }

                                    return done(null, {err: null, value: undefined});
                                });
                            });
                        }
                    ],
                    function (err, settings, password) { // Transfer settings

                        self._transferSettings(settings.value);
                        self._isDirty(false);

                        if (password.err || settings.err) {
                            self._alert('error', 'Error reading configuration for ' + $('#domains').val(), settings.err, password.err)
                        }
                    });
            },

            remove: function () {

                var self = configurationEditor;
                var domains = $('#domains');
                var currentSelection = domains.children(':selected');

                if (currentSelection.index() == 0) {
                    // Silently ignore the request to remove the default domain configuration
                    return;
                }

                var nextSelection = currentSelection.next();

                if (nextSelection.length == 0) {
                    nextSelection = currentSelection.prev();
                }

                self._remove(currentSelection, function (cserr, sperr) {

                    if (cserr || sperr) {
                        self._alert('error', 'Failed to remove the configuration for ' + currentSelection.val(), cserr, sperr);
                        return;
                    }
                    
                    var currentAlternateDomainName = currentSelection.data('alternatedomain');
                    var currentDomainName = currentSelection.val();
                    var nameMap = domains.data('name.map');

                    if (currentAlternateDomainName !== undefined) {
                        delete nameMap[currentAlternateDomainName];
                    }

                    delete nameMap[currentDomainName];

                    self._setSelection(nextSelection);
                    self.read(domains.val());

                    currentSelection.remove();
                });
            },

            save: function () {

                var self = configurationEditor;

                //// Check for configuration errors

                $('#configured_domain,#alternatedomain,#basedn,#server').each(function (index, target) {
                    self._validateRequiredInputElement(target);
                });

                $('#configured_domain,#alternatedomain').each(function (index, target) {
                    self._validateDomainName(target);
                });
				
				$('#alternatedomain').each(function (index, target) {
                    self._validateUpperCase(target);
                });

                var input = $('#configured_domain,#alternatedomain,#basedn,#server,#port,#ssl,#binddn,#password').parent();

                if (input.hasClass('error')) {

                    var deferred = $.Deferred();

                    modal = self._alert('error', 'LDAP Configuration errors', 'Please correct them in order to proceed.');

                    modal.on('hidden.bs.modal', function () {
                        deferred.reject();
                    });

                    return deferred;
                }

                //// Rename the domain, if its name has changed; otherwise simply save it

                var domain = $('#domains').children('[selected="selected"]');
                var name = $('#configured_domain').val();

                return domain.val() !== name ? self._renameAndSave(domain, name) : self._save(domain);
            },

            select: function () {

                var self = configurationEditor;
                var deferred = $.Deferred();
                var domains = $('#domains');
                var selected = domains.children('[selected]');

                if ($('#domainError').val()) {

                    /// Don't let the user change the selection until the domain name is corrected

                    modal = self._alert('error', 'Duplicate domain name', 'You cannot change the selection until you ' +
                        'correct the domain name.');

                    modal.on('hidden.bs.modal', function () {
                        $('#configured_domain').select().focus();
                        domains.val(selected.val());
                        deferred.reject();
                    });
                }
                else if (self._isDirty()) {

                    //// Prompt the user to discard or save changes

                    var question = 'Do you want to save changes to "' + selected.text() + '" before editing "' +
                        domains.children(':selected').text() + '"?';

                    var dialog = self._confirm('warning', 'Save changes', question,
                        [
                            { text: 'Cancel', action: function () {
                                self._setSelection(selected);
                                deferred.resolve();
                            }},
                            { text: 'Discard changes', action: function () {
                                self._changeSelection();
                                deferred.resolve();
                            }},
                            { text: 'Save changes', primary: true, action: function () {
                                self.save()
                                    .done(function () {
                                        self._changeSelection();
                                        deferred.resolve();
                                    })
                                    .fail(function () {
                                        self._setSelection(selected);
                                        deferred.reject();
                                    });
                            }}
                        ]
                    );
                }
                else {
                    self._changeSelection();
                    deferred.resolve();
                }

                return deferred.promise();
            },

            test: function () {

                var self = configurationEditor;

                self.save().done(function () {
                    

                    var domainName = $('#configured_domain').val().trim();
                    var command = '| ldaptestconnection domain=' + JSON.stringify(domainName);
                    var result = $('#testConnectionDialog_result');
                    var message = $('#testConnectionDialog_message');

                    result.val('');
                    message.text('');
                    message.css({display: 'none'});

                    $('#testConnectionDialog_header').text('Testing connection to ' + domainName);
                    $('#testConnectionDialog_command').text(command);
                    $('#testConnectionDialog_close').text('Cancel');
		            jQuery.noConflict();
                    window.$('#testConnectionDialog').modal('show');

                    var searchManager = self._searchManager;
                    searchManager.settings.set('search', command);
                    searchManager.startSearch();

                    var view = new TestConnectionView({el: result, managerid: searchManager.id});
                });
            },

            //// Privates

            _alertHeaders: {info: 'Information', warning: 'Warning', error: 'Error'},
            _configuration: null,
            _service: null,
            _searchManager: null,
            _storagePasswords: null,

            _alert: function (type, title, message) {

                var self = configurationEditor;

                var header = $('#alertDialog_header');
                var body = $('#alertDialog_body');

                header.text(title ? title : self._alertHeaders[type]);
                body.attr('class', 'alert alert-' + type);

                var text = '';

                for (var i = 2; i < arguments.length; i++) {

                    message = arguments[i];

                    if (message == null) {
                        continue;
                    }

                    if (typeof message === 'object') {
                        var messages = message.data.messages;
                        messages.forEach(function (item) {
                            text += item.type + ': ' + item.text.trim() + '<br/>';
                        });
                    }
                    else {
                        text += message;
                    }
                }

                body.html('<i class="icon-alert"></i>' + text);
                jQuery.noConflict();
                return window.$('#alertDialog').modal('show');
            },

            _confirm: function (type, title, message, commands) {

                $('#confirmDialog_header')
                    .text(title ? title : self._alertHeaders[type]);

                $('#confirmDialog_body')
                    .attr('class', 'alert alert-' + type)
                    .html('<i class="icon-alert"></i>' + message);

                var footer = $('#confirmDialog_footer');
                var cancel = null;
                footer.empty();

                commands.forEach(function (command) {

                    if (command.text === 'Cancel') {
                        cancel = command.action;
                    }

                    var button = document.createElement('a');

                    button.setAttribute('class', command.primary ? 'btn btn-primary' : 'btn');
                    button.setAttribute('data-dismiss', 'modal');
                    button.setAttribute('href', '#');
                    button.appendChild(document.createTextNode(command.text));

                    footer.append(button);
                    footer.children(':last-child').click(command.action);
                });
                jQuery.noConflict();
                var dialog = window.$('#confirmDialog').modal({'show': true, 'backdrop': 'static'});

                if (cancel != null) {
                    $('#confirmDialog_cross').click(cancel);
                }

                return dialog;
            },


            _add: function () {

                var self = configurationEditor;

                var domains = $('#domains');
                var configuration = self._configuration;
                var storagePasswords = self._storagePasswords;

                var nameMap = domains.data('name.map');
                var base = 'untitled domain';
                var name = base;

                for (var i = 2; name in nameMap; i++) {
                    name = base + ' ' + i;
                }

                var currentSelection = domains.children(':selected');
                var namespace = configuration.namespace;

                var nextSelection = currentSelection.after('<option/>').next()
                    .attr('selected', 'selected')
                    .attr('value', name)
                    .data('connection.status', {type: 'warning', text: 'Untested'})
                    .data('password', storagePasswords.instantiateEntity(
                        {name: self._toStoragePasswordName(name), acl: namespace}))
                    .data('stanza', configuration.instantiateEntity({name: name, acl: namespace}))
                    .text(name)
                    .val(name);

                currentSelection.removeAttr('selected');
                self._setSelection(nextSelection);
                nameMap[name] = nextSelection[0];

                self._readDefaults().done(function () {
                    self._save(nextSelection).done(function () {
                        $('#configured_domain').focus().select();
                    });
                });
            },

            _bindEventHandlers: function () {

                var self = configurationEditor;

                //// ...for Actions
                $('#domains').on('change', function(){self.select(); });
                $('#add').click(self.add);
                $('#config_remove').click(self.remove);
                $('#save').click(self.save);
                $('#test').click(self.test);

                //// ...for Inputs

                $('#configured_domain,#alternatedomain,#basedn,#server,#port,#ssl,#binddn,#password').on('change', function () {
                    self._isDirty(true);
                });

                $('#configured_domain,#alternatedomain,#basedn,#server').on('change', function (event) {
			        self._validateRequiredInputElement(event.target);
                });

                $('#configured_domain,#alternatedomain').on('change', function (event) {
                    self._validateDomainName(event.target);
                });
				
		        $('#alternatedomain').on('change', function (event) {
                    self._validateUpperCase(event.target);
                });

                //// ...for Dialogs

                $('#testConnectionDialog_close').click(function () {

                    var searchManager = self._searchManager;

                    if (!searchManager.job) {
                        $('#testConnectionDialog').modal('hide');
                    }
                    else {
                        searchManager.cancel();
                        $('#testConnectionDialog_close').text('Close');
                    }
                });
            },

            _changeSelection: function () {
                var self = configurationEditor;

                var domains = $('#domains');
                var priorSelection = domains.children('[selected]');

                self._setSelection(domains.children(':selected'));
                priorSelection.removeAttr('selected');
                self.read();
            },

            _clearInputError: function (inputElement) {

                var errorElement = $('#' + inputElement.id + 'Error');

                $(inputElement).parent().toggleClass('error', false);
                errorElement.css('display', 'none');
                errorElement.text('');
                errorElement.val(false);
            },

            _finalizeSave: function (deferred, settings) {

                var self = configurationEditor;

                var domains = $('#domains');
                var nameMap = domains.data('name.map');
                var option = domains.children('[selected=selected]');
                var presentAlternateDomainName = settings['alternatedomain'];
                var formerAlternateDomainName = option.data('alternatedomain');

                if (formerAlternateDomainName === undefined) {
                    if (!(presentAlternateDomainName in nameMap)) {
                        nameMap[presentAlternateDomainName] = option[0];
                    }
                }
                else if (formerAlternateDomainName != presentAlternateDomainName) {
                    delete nameMap[formerAlternateDomainName];
                    nameMap[presentAlternateDomainName] = option[0];
                }

                var apps = self._service.apps();

                apps.fetch(function(err, apps) {
                    var app = apps.item('SA-ldapsearch');
                    app.update({configured: true}, function (err) {
                        if (err) {
                            self._alert('error', 'Save failed', err);
                            deferred.reject();
                            return;
                        }
                        self._isDirty(false);
                        deferred.resolve();
                    });
                });
            },

            _isDirty: function (value) {

                var self = configurationEditor;
                var configuration = $('#configuration');

                if (value === undefined) {
                    value = configuration.data('isDirty');
                    return value;
                }

                if (value) {

                    var connectionStatus = {type: 'alert alert-warning', text: 'Untested'};

                    $('#domains').children(':selected').data("connection.status", connectionStatus);
                    self._updateConnectionStatus(connectionStatus);
                    configuration.data('isDirty', true);

                    return true;
                }

                configuration.data('isDirty', false);
            },

            _readDefaults: function () {

                var self = configurationEditor;
                var domain = $('#domains').children().first();
                var storagePassword = domain.data('password');
                var configurationStanza = domain.data('stanza');

                var deferred = $.Deferred();

                splunkjs.Async.parallel(
                    [
                        function (done) { // Read configuration stanza

                            configurationStanza.get(undefined, {}, function (err, response) {

                                var settings = {};

                                if (err == null) {
                                    response.data.entry.forEach(function (entry) {
                                        settings[entry.name] = entry.content;
                                    });
                                }

                                return done(null, {err: err, value: settings});
                            });
                        },
                        function (done) { // Read storage password

                            storagePassword.fetch({}, function (err, resource) {

                                if (err == null) {
                                    return done(null, {err: null, value: null});
                                }

                                if (err.status == 404) {
                                    return done(null, {err: null, value: undefined});
                                }

                                return done(null, {err: err, value: undefined});
                            });
                        }
                    ],
                    function (err, settings, password) { // Transfer settings to form

                        self._transferSettings(settings.value);
                        self._isDirty(false);

                        if (password.err || settings.err) {
                            self._alert('error', 'Error reading configuration for ' + $('#domains').val(),
                                settings.err, password.err);
                            deferred.reject();
                            return;
                        }

                        deferred.resolve();
                    });

                return deferred.promise();
            },

            _remove: function (option, followup) {

                var configurationStanza = option.data('stanza');
                var storagePassword = option.data('password');

                splunkjs.Async.parallel(
                    [
                        function (done) { // Remove configuration stanza
                            configurationStanza.remove(function (err) {
                                return err == null || err.status == 404 ? done(null, null) : done(null, err);
                            });
                        },
                        function (done) { // Remove storage password
                            storagePassword.remove(function (err) {
                                return err == null || err.status == 404 ? done(null, null) : done(null, err)
                            })
                        }
                    ],
                    function (err, cserr, sperr) {
                        followup(cserr, sperr)
                    });
            },

            _renameAndSave: function (domain, newName) {

                var self = configurationEditor;
                var name = domain.val();
                var deferred = $.Deferred();

                self._remove(domain, function (cserr, sperr) {

                    if (cserr || sperr) {
                        self._alert('error', 'Failed to rename ' + name + ' as ' + newName, cserr, sperr);
                        domain.val(name);
                        domain.focus().select();
                        deferred.fail();
                        return;
                    }

                    var domains = domain.parent();
                    var formerName = domain.val();

                    //// Update domain name map

                    var nameMap = domains.data('name.map');
                    var option = nameMap[formerName];
                    delete nameMap[formerName];
                    nameMap[newName] = option;

                    //// Update domain data

                    var storagePasswords = self._storagePasswords;
                    var configuration = self._configuration;
                    var namespace = configuration.namespace;

                    domain
                        .attr('value', newName).text(newName).val(newName)
                        .data('password', storagePasswords.instantiateEntity({name: self._toStoragePasswordName(newName), acl: namespace}))
                        .data('stanza', configuration.instantiateEntity({name: newName, acl: namespace}));

                    //// Save domain configuration

                    self._save(domain)
                        .done(deferred.resolve)
                        .fail(deferred.reject);
                });

                return deferred.promise();
            },

            _save: function (domain) {

                var self = configurationEditor;

                //// Get configuration settings from form fields

                var settings = {};
                var password = '';

                $('#alternatedomain,#basedn,#server,#port,#ssl,#binddn,#password').each(function (index, inputElement) {

                    var selector = $(inputElement);
                    var value;

                    if (selector.is(':checkbox')) {
                        value = selector.prop('checked') ? selector.val() : '0';
                    }
                    else if (selector.is(':password')) {
                        password = selector.val();
                        value = '';
                    }
                    else {
                        value = selector.val();
                    }

                    settings[inputElement.id] = value;
                });

                //// Save configuration settings

                var configurationStanza = domain.data('stanza');
                var storagePassword = domain.data('password');
                var deferred = $.Deferred();

                if (domain.index() == 0) {

                    //// Save default domain definition

                    splunkjs.Async.parallel(
                        [
                            function (done) { // Update configuration stanza

                                configurationStanza.post(undefined, settings, function (err) {
                                    return done(null, err);
                                });
                            },
                            function (done) { // Update storage password

                                if (password == '') {
                                    storagePassword.remove(function (err) {
                                        return err == null || err.status == 404 ? done(null, null) : done(null, err);
                                    });
                                }
                                else {
                                    storagePassword.update({password: password}, function (err) {

                                        if (err == null || err.status != 404) {
                                            return done(null, err);
                                        }

                                        var parameters = {realm: 'SA-ldapsearch', name: 'default', password: password};

                                        self._storagePasswords.create(parameters, function (err) {
                                            return done(null, err);
                                        });
                                    });
                                }
                            }
                        ],
                        function (err, settingsError, passwordError) {

                            if (settingsError || passwordError) {
                                var title = 'Failed to save the configuration for ' + domainName;
                                self._alert('error', title, settingsError, passwordError);
                                deferred.reject();
                                return;
                            }

                            self._finalizeSave(deferred, settings);
                        }
                    );
                }
                else {

                    //// Save non-default domain definition

                    var domainName = domain.attr('value');
                    var defaultPassword = null;

                    splunkjs.Async.series(
                        [
                            function (done) { // Get default password for comparison

                                var defaultDomain = $('#domains').children().first();
                                var storagePassword = defaultDomain.data('password');

                                storagePassword.fetch({}, function (err, resource) {

                                    if (err == null) {
                                        defaultPassword = resource.properties().clear_password;
                                        return done(null);
                                    }

                                    if (err.status != 404) {
                                        return done(err);
                                    }

                                    var endpoint = new splunkjs.Service.Endpoint(self._service,
                                        "properties/ldap/default/password"
                                    );

                                    endpoint.get(null, {}, function (err, response) {

                                        if (err == null) {
                                            defaultPassword = response.data; // guaranteed to be a string
                                            return done(null);
                                        }

                                        if (err.status == 404) {
                                            defaultPassword = '';
                                            return done(null);
                                        }

                                        return done(err);
                                    });
                                });
                            },
                            function (done) { // Save settings

                                splunkjs.Async.parallel(
                                    [
                                        function (done) { // Update configuration settings

                                            configurationStanza.update(settings, function (err) {

                                                if (err == null || err.status != 404) {
                                                    return done(null, err);
                                                }

                                                var stanzaName = configurationStanza.name;

                                                self._configuration.create(stanzaName, settings, function (err) {
                                                    return done(null, err);
                                                });
                                            });
                                        },
                                        function (done) { // Update storage password

                                            //// We can't save blank passwords and don't save passwords that match the
                                            //// default

                                            if (password.length == 0 || password === defaultPassword) {
                                                storagePassword.remove(function (err) {
                                                    return err == null || err.status == 404
                                                        ? done(null, null)
                                                        : done(null, err);
                                                });
                                            }
                                            else {
                                                storagePassword.update({password: password}, function (err) {

                                                    if (err == null || err.status != 404) {
                                                        return done(null, err);
                                                    }

                                                    var parameters = {
                                                        realm: 'SA-ldapsearch', name: domainName, password: password
                                                    };

                                                    self._storagePasswords.create(parameters, function (err) {
                                                        return done(null, err);
                                                    });
                                                });
                                            }
                                        }
                                    ],
                                    function (err, settingsError, passwordError) {

                                        if (settingsError || passwordError) {

                                            err = new Error('Failed to save the configuration for ' + domainName);
                                            err.data = { messages: []};

                                            if (settingsError) {
                                                err.data.push(settingsError.data.messages);
                                            }
                                            if (passwordError) {
                                                err.data.push(settingsError.data.messages);
                                            }
                                        }
                                        return done(err);
                                    }
                                );
                            }
                        ],
                        function (err) {

                            if (err != null) {
                                self._alert('error', 'Failed to save the configuration for ' + domainName, err)
                                deferred.reject(false);
                                return;
                            }

                            self._finalizeSave(deferred, settings);
                        }
                    )
                }

                return deferred.promise();
            },

            _setSelection: function (option) {

                var self =configurationEditor;
                var domainName = option.val();

                $('#configured_domain')
                    .attr('readonly', option.index() == 0)
                    .attr('value', domainName)
                    .val(domainName);

                option.attr('selected', 'selected');
                option.parent().val(domainName);

                var connectionStatus = option.data('connection.status');
                self._updateConnectionStatus(connectionStatus);
            },

            _showInputError: function (inputElement, message) {
                var errorElement = $('#' + inputElement.id + 'Error');
                $(inputElement).parent().toggleClass('error', true);
                errorElement.text(message);
                errorElement.css('display', 'inline-block');
                errorElement.val(true);
            },

            _toStoragePasswordName: function (name) {
                return 'SA-ldapsearch:' + name.replace(/([:\\])/g, '\\$1') + ':';
            },

            _transferSettings: function (settings) {

                var self = configurationEditor;

                

                $('#alternatedomain,#basedn,#server,#port,#ssl,#binddn,#password').each(function (index, inputElement) {

                    var value = settings[inputElement.id];
                    var selector = $(inputElement);

                    if (selector.is(':checkbox')) {
                        selector.prop('checked', (value === undefined ? selector.prop('checked') : parseInt(value)));
                    }
					else if (selector.is(':password')) {
                        $('#password').val('');
                    }
                    else {
                        selector.val(value);
                    }

                    self._clearInputError(inputElement);
                });
            },

            _updateConnectionStatus: function (connectionStatus) {
                $('#connectionStatus_alert').attr('class', 'alert alert-' + connectionStatus.type);
                $('#connectionStatus_text').val(connectionStatus.text);
            },

            _validateDomainName: function (target) {

                var self = configurationEditor;

                var newName = target.value.trim();

                if (newName.length == 0) {
                    return true;
                }

                var domains = $('#domains');
                var nameMap = domains.data('name.map');

                var option = nameMap[newName];

                if (option === undefined) {  // Name is unique in the scope of ldap.conf
                    self._clearInputError(target);
                    return true;
                }

                var message;

                if (option === nameMap[domains.children('[selected=selected]').val()]) {
                    if ($('#configured_domain').val() != $('#alternatedomain').val()) {
                        self._clearInputError(target);
                        return true;
                    }

                    message = 'Domain and alternatedomain names must be different'
                }
                else {
                    message = 'This name is in use by ' + option.text;
                }

                self._showInputError(target, message);
                return true;
            },
			
			_validateUpperCase: function (target) {

                var self = configurationEditor;

                var newName = target.value.trim();
                if(newName != newName.toUpperCase()){
                    self._showInputError(target,"Please enter the Alternate domain name in capital letters");
                }
            },

            _validateRequiredInputElement: function (target) {

                var self = configurationEditor;
                var value = target.value.trim();

                if (value.length == 0) {
                    self._showInputError(target, 'A value is required');
                }
                else {
                    self._clearInputError(target);
                }

                return true;
            }
        };

       configurationEditor.initialize(mvc.createService());
    });
