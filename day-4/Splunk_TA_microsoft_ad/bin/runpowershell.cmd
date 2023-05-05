@ECHO OFF

:: ######################################################
:: #
:: # Splunk for Microsoft Active Directory
:: # 
:: # Copyright (C) 2016 Splunk, Inc.
:: # All Rights Reserved
:: #
:: ######################################################

set SplunkApp=Splunk_TA_microsoft_ad

%SystemRoot%\system32\WindowsPowerShell\v1.0\powershell.exe -executionPolicy RemoteSigned -command ". '%SPLUNK_HOME%\etc\apps\%SplunkApp%\bin\powershell\%1'"
