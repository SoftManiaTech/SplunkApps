#!/usr/bin/env python
# coding=utf-8
#
# Copyright (C) 2009-2021 Splunk Inc. All Rights Reserved.

from __future__ import absolute_import, division, print_function, unicode_literals
import default
import app

from splunklib.searchcommands import dispatch, GeneratingCommand, Configuration, Option, validators
from collections import Iterable
from itertools import chain
from json import JSONEncoder
from ldap3 import Connection, BASE
from ldap3.core.exceptions import LDAPException
from ldapsearch import LdapSearchCommand
from time import time


@Configuration(retainsevents=True)
class LdapTestConnectionCommand(GeneratingCommand):
    """ Tests the connection to the directory service for a domain.

    This command tests the connection to each of the hosts servicing an LDAP directory. It must be placed at the
    beginning of a search pipeline:

        .. code-block:: text
        | ldaptestconnection domain=splunk.com

    """
    domain = Option(
        doc=''' Specifies the name of the configuration stanza representing the LDAP or Active Directory domain
        connection to test.
        ''',
        default='default')

    debug = Option(
        doc=''' True, if the logging_level should be set to DEBUG; otherwise False.
        **Default:** The current value of logging_level.
        ''',
        default=False, validate=validators.Boolean())

    def generate(self):
        """
        :return: `None`.

        """
        self.logger.debug('Command = %s', self)
        configuration = app.Configuration(self)

        encoder = JSONEncoder(ensure_ascii=False, separators=(',', ':'))
        time_stamp = time()
        serial_number = 0

        servers = configuration.server if isinstance(configuration.server, Iterable) else (configuration.server,)
        search_base = configuration.basedn
        search_filter = '(objectClass=*)'
        search_scope = BASE
        attribute_names = 'distinguishedName',

        records = []
        errors = []

        for server in servers:
            self.logger.debug('Testing the connection to %s', server.name)
            try:
                with Connection(
                        server,
                        read_only=True,
                        raise_exceptions=True,
                        user=configuration.credentials.username,
                        password=configuration.credentials.password) as connection:

                    # LDAP Guarantee: There's one and only one response to our query (proof left as an exercise)

                    if connection.search(search_base, search_filter, search_scope, attributes=attribute_names):
                        response = connection.response[0]
                        attributes = app.get_attributes(self, response)
                        records.append(
                            LdapSearchCommand._record(
                                serial_number, time_stamp, server.host, response['dn'], attributes, attribute_names,
                                encoder))
                    else:
                        message = 'The directory serviced at {0} contains no entry for {1}'.format(
                            server.name, search_base)
                        errors.append((server.host, message))
                pass

            except LDAPException as error:
                message = 'Could not access the directory service at {0}: {1}'.format(
                    server.name, app.get_ldap_error_message(error, configuration))
                errors.append((server.host, message))

            serial_number += 1

        if errors:
            message = ' # host: '.join(chain(' ', [
                '{0}: {1}'.format(host, message.replace(u'\x00', '')) for host, message in errors]))
            self.error_exit(ValueError(message), message)

        for record in records:
            yield record

        return


dispatch(LdapTestConnectionCommand, module_name=__name__)
