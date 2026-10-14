#!/usr/bin/env bash
# tools/finish_showcase.sh  ->  out/matter_16x9.mp4, out/matter_9x16.mp4 + review sheets
# Muxes the -14 LUFS score onto the silent renders and builds contact / phone / poster sheets.
set -euo pipefail
cd "$(dirname "$0")/.."
ffmpeg -loglevel error -y -i audio/showcase_track.wav -af loudnorm=I=-14:TP=-1:LRA=11 -ar 48000 audio/showcase_14lufs.wav
for v in 16x9 9x16; do
  [ -f out/matter_${v}_silent.mp4 ] || continue
  ffmpeg -loglevel error -y -i out/matter_${v}_silent.mp4 -i audio/showcase_14lufs.wav -c:v copy -c:a aac -b:a 256k -shortest -movflags +faststart out/matter_${v}.mp4
done
ffmpeg -loglevel error -y -i out/matter_16x9.mp4 -vf "fps=1,scale=384:-1,tile=8x6" -frames:v 1 out/matter_contact.png
ffmpeg -loglevel error -y -i out/matter_16x9.mp4 -vf "fps=1,scale=360:-1,tile=6x8" -frames:v 1 out/matter_phone.png
ffmpeg -loglevel error -y -ss 44.5 -i out/matter_16x9.mp4 -frames:v 1 out/matter_poster.png
[ -f out/matter_9x16.mp4 ] && ffmpeg -loglevel error -y -i out/matter_9x16.mp4 -vf "fps=1,scale=180:-1,tile=12x4" -frames:v 1 out/matter_9x16_contact.png
for f in out/matter_16x9.mp4 out/matter_9x16.mp4; do [ -f "$f" ] && ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate,nb_frames -show_entries format=duration -of compact "$f"; done
ffmpeg -i out/matter_16x9.mp4 -af loudnorm=print_format=summary -f null - 2>&1 | grep -E "Input Integrated|Input True"
