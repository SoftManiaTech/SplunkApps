# This file contains possible attribute/value pairs for the Splunk Supporting Add-on for Active Directory configuration file (ldap.conf).

# IMPORTANT:
#
# This file is for reference only. Use the configuration page in
# Splunk Web to configure the Splunk Supporting Add-on for Active
# Directory in all cases. If you are upgrading from a previous version, 
# the add-on migrates your changes to the new credential store when you
# save your configuration changes from the configuration page.

# To learn more about configuration files (including precedence) please see the documentation located at
# http://docs.splunk.com/Documentation/Splunk/latest/Admin/Aboutconfigurationfiles.

# GLOBAL SETTINGS
# Use the [default] stanza to define the default domain.
#     * You can also define global settings outside of any stanza, at the top of the file.
#     * Each conf file should have at most one default stanza. If there are multiple default
#       stanzas, the add-on combines attributes. In the case of multiple definitions of the same
#       attribute, the last definition in the file takes precedence.
#     * If an attribute is defined at both the global level and in a specific stanza, the
#       stanza value takes precedence.

[<STANZA_NAME>]
    * Each stanza represents an LDAP search domain. By convention, the stanza name is the DNS name of the domain.
    * Set the following attributes/values for the domain. Otherwise, Splunk uses the defaults.

alternatedomain = <string>
    * Alternate domain name of the domain.
    * By convention, this name is the NetBIOS name of the domain. It must be unique in the scope of ldap.conf. You
    * may use either the stanza name or the alternatedomain name to identify the domain in SA-ldapsearch commands. See
    * the domain option.
    * You must specify a value.

basedn = <string>
    * The Distinguished Name of the domain, in LDAP notation.
    * By convention, this name should be unique in the scope of ldap.conf.
    * You must specify a value.

server = <comma-separated strings>
    * A comma-separated list of distributed LDAP server replica host names or IP addresses.
    * When you specify more than one host, the add-on randomly picks a host and services requests in a round-robin
    * fashion with the other servers.
    * You must specify a value.

ssl = <bool>
    * Controls whether or not the add-on uses SSL for its network operations.
    * Set to true to enable SSL. Otherwise, set to false.
    * Defaults to false.

port = <integer>
    * The port number that the add-on should use when connecting to the LDAP server.
    * Defaults to 636, if ssl is enabled; otherwise 389.

binddn = <string>
    * The Distinguished Name for binding to the LDAP directory service, in LDAP notation.
    * The password used for simple authentication should be encrypted and saved to $SPLUNK_HOME/etc/apps/SA-LDAPsearch/local/app.conf
    * using the POST storage/passwords endpoint with name = <STANZA_NAME> and realm = SA-ldapsearch.

password = <string>
    * Deprecated: The password used for simple authentication.
    * A clear-text or Base64 encoded password for simple authentication.
    * Indicate Base64 encoding by prefixing the string with {64}.
    * If a storage password with name = <STANZA_NAME> and realm = SA-ldapsearch also exists, the add-on ignores this setting.
    * See http://docs.splunk.com/Documentation/Splunk/latest/RESTREF/RESTaccess#POST_storage.2Fpasswords_method_detail.

decode = <bool>
    * Controls whether or not the add-on uses Active Directory formatting extensions.
    * Set to true to enable Active Directory formatting extensions; otherwise set to false.
    * Defaults to true.

paged_size = <int>
    * The maximum number of entries to return in a single page of LDAP search results.
    * Defaults to 1000, the default maximum page size permitted by Active Directory. See LDAP policies at
    * http://technet.microsoft.com/en-us/library/cc770976.aspx.
