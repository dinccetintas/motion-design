#!/bin/sh
# scripts/serve.sh [start|stop|restart]  -> dev server in the background, pid in /tmp
PIDF=/tmp/flatbed-server.pid
stop() { [ -f $PIDF ] && kill "$(cat $PIDF)" 2>/dev/null; rm -f $PIDF; fuser -k ${PORT:-4100}/tcp >/dev/null 2>&1; sleep 0.3; }
start() { nohup node server/index.js > /tmp/flatbed-server.log 2>&1 & echo $! > $PIDF; sleep 1.2; curl -s localhost:${PORT:-4100}/api/health; echo; }
case "$1" in stop) stop ;; restart) stop; start ;; *) start ;; esac
