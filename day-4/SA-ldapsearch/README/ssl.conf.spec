########################################################################################################################
# SSL Configuration details
########################################################################################################################

[sslConfig]
    * Configure SSL for communications with Active Directory directory services under this stanza name.
    * Follow this stanza name with any number of the following attribute/value pairs.  
    * If you do not specify an entry for each attribute, SA-ldapsearch will use the value specified under the sslConfig
      stanza name in server.conf.

sslVersions = <versions_list>
    * Comma-separated list of SSL versions to support.
    * The specific versions available are "ssl2", "ssl3", and "tls1.0".
    * The special version "*" selects all supported versions.  The version "tls" selects all versions tls1.0 or newer.
    * If a version is prefixed with "-", it is removed from the list.
    * Defaults to tls.

sslVerifyServerCert = true|false
    * If this is set to true, you should make sure that the Active Directory server that is being connected to is a
      valid one (i.e., authenticated). Both the common name and the alternate name of the server are then checked for
      a match, if they are specified. A certificate is considered verified, if either is matched.
    * Default is false.

caCertFile = <filename>
    * Public key of the signing authority.
    * Default is cacert.pem.

caPath = <path>
    * Path where all these certs are stored.
    * Default is $SPLUNK_HOME/etc/auth.
