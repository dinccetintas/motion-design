#!/bin/sh
# scripts/serve.sh [start|stop|restart]  -> dev server in the background, pid in /tmp
PIDF=/tmp/flatbed-server.pid
stop() { [ -f $PIDF ] && kill "$(cat $PIDF)" 2>/dev/null; rm -f $PIDF; }
start() { nohup node server/index.js > /tmp/flatbed-server.log 2>&1 & echo $! > $PIDF; sleep 1.2; curl -s localhost:${PORT:-4100}/api/health; echo; }
case "$1" in stop) stop ;; restart) stop; start ;; *) start ;; esac
