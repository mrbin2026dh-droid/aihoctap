#!/bin/sh
# Sao lưu lịch sử học tập mỗi ngày, giữ 30 bản gần nhất. Chạy bằng cron của người dùng brain.
set -eu
mkdir -p /var/lib/brain/backup
sqlite3 /var/lib/brain/brain.sqlite3 ".backup '/var/lib/brain/backup/brain-$(date +%F).sqlite3'"
ls -1t /var/lib/brain/backup/brain-*.sqlite3 | tail -n +31 | xargs -r rm -f
