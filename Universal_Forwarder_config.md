Connect forwarder with Deployment Server:

```bash
/opt/splunkforwarder/bin/splunk set deploy-poll ds1.mycompany.com:8089
```

Connect Forwarder with Indexers:

``` bash
[tcpout]
defaultGroup=my_indexers

[tcpout:my_indexers]
server=mysplunk_indexer1:9997, mysplunk_indexer2:9996

[tcpout-server://mysplunk_indexer1:9997]
```


Indexer Discovery:

In the manager node's: server.conf:
```bash
[indexer_discovery]
pass4SymmKey = my_secret
indexerWeightByDiskCapacity = true
```


In each forwarder's outputs.conf:
```bash
[indexer_discovery:manager1]
pass4SymmKey = my_secret
manager_uri = https://10.152.31.202:8089

[tcpout:group1]
autoLBFrequency = 30
forceTimebasedAutoLB = true
indexerDiscovery = manager1
useACK=true

[tcpout]
defaultGroup = group1
```
