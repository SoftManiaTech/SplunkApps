#!/usr/bin/env python
# coding=utf-8
#
# Copyright (C) 2009-2021 Splunk Inc. All Rights Reserved.

from __future__ import absolute_import, division, print_function, unicode_literals
import default
import app
import ldap3
from base64 import b64encode
import datetime
from app.six import binary_type

from splunklib.searchcommands import dispatch, StreamingCommand, Configuration, Option, validators


@Configuration()
class LdapFilterCommand(StreamingCommand):
    """  Filters and augments events with information from Active Directory.

    This command follows a search or similar command in the pipeline so that you can feed it events:

        .. code-block:: text
        eventtype=msad-successful-user-logons
        | ldapfilter domain=$dest_nt_domain$ search="(objectClass=$src_user$)" attrs="telephoneNumber,displayName"

    """
    # region Command options

    search = Option(
        doc=''' Specifies an RFC 2254 compliant search string.
        ''',
        require=True)

    domain = Option(
        doc=''' Specifies the Active Directory domain to search.
        ''',
        default='default')

    attrs = Option(
        doc=''' Specifies a comma separated list of attributes to return as fields.
        **Default:** '*', specifying that all attributes should be returned as fields.
        ''',
        default=[ldap3.ALL_ATTRIBUTES], validate=validators.List())

    basedn = Option(
        doc=''' Specifies the starting point for the search.
        Default: The value of `basedn` as specified in the configuration stanza for `domain`.
        ''')

    scope = Option(
        doc=''' Specifies the scope of the search to be one of `base`, `one`, or `sub`.
        **Default:** sub.
        ''',
        default='sub', validate=validators.Map(
            base=ldap3.BASE,
            one=ldap3.LEVEL,
            sub=ldap3.SUBTREE
        ))

    decode = Option(
        doc=''' True, if Active Directory formatting rules should be applied to attribute types.
        **Default:** The value of decode as specified in the configuration stanza for domain.
        ''',
        default=True, validate=validators.Boolean())

    limit = Option(
        doc=''' Specifies an upper bound on the number of matching entries returned by the search.
        **Default:** 0, specifying that there is no upper bound on the number of entries returned by the search.
        ''',
        default=0, validate=validators.Integer(minimum=0))

    debug = Option(
        doc=''' True, if the logging_level should be set to DEBUG; otherwise False.
        **Default:** The current value of logging_level.
        ''',
        default=False, validate=validators.Boolean())

    # endregion

    # region Command implementation

    def stream(self, records):
        """
        :param records: An iterable stream of events from the command pipeline.
        :return: `None`.

        """
        option_basedn = self.basedn
        configuration = app.Configuration(self, is_expanded=True)
        expanded_domain = app.ExpandedString(self.domain)
        expanded_search_filter = app.ExpandedString(self.search, converter=app.escape_assertion_value)

        try:
            with configuration.open_connection_pool(self.attrs) as connection_pool:

                for record in records:

                    domain = expanded_domain.get_value(record)

                    if domain is None:
                        continue

                    search_filter = expanded_search_filter.get_value(record)

                    if len(search_filter) == 0:
                        continue

                    connection = connection_pool.select(domain)

                    if not connection:
                        self.logger.warning('search="%s": domain="%s" is not configured', search_filter, domain)
                        continue

                    if not option_basedn:
                        self.basedn = configuration.basedn

                    search_base = app.ExpandedString(self.basedn).get_value(record)  # must be instantiated here

                    entry_generator = connection.extend.standard.paged_search(
                        search_base=search_base, search_filter=search_filter, search_scope=self.scope,
                        attributes=connection_pool.attributes, paged_size=configuration.paged_size)

                    for entry in entry_generator:
                        attributes = app.get_attributes(self, entry)
                        if not attributes:
                            continue
                        for name in connection_pool.attributes:
                            value = attributes.get(name, '')
            
                            if isinstance(value, binary_type):
                                value = b64encode(value).decode('utf-8')
                            elif isinstance(value, datetime.datetime):
                                value = str(value)
                            elif isinstance(value, list):
                                for i in range(len(value)):
                                    if isinstance(value[i], binary_type):
                                        value[i] = b64encode(value[i]).decode('utf-8')
                                    elif isinstance(value[i], datetime.datetime):
                                        value[i] = str(value[i])

                            record[name] = value

                        yield record.copy()

                    pass

        except ldap3.core.exceptions.LDAPException as error:
            self.error_exit(error, app.get_ldap_error_message(error, configuration))

        return

    # endregion

dispatch(LdapFilterCommand, module_name=__name__)
