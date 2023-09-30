
``` bash
[tcpout]
defaultGroup=my_indexers

[tcpout:my_indexers]
server=mysplunk_indexer1:9997, mysplunk_indexer2:9996

[tcpout-server://mysplunk_indexer1:9997]
```

```bash
./splunk set deploy-poll ds1.mycompany.com:8089
```
