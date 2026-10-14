#!/usr/bin/env bash
# tools/finish_reel.sh  ->  out/reel_16x9.mp4, out/reel_9x16.mp4 + review sheets
# Joins the render chunks, adds the -14 LUFS score, and builds contact/strip/phone sheets.
set -euo pipefail
cd "$(dirname "$0")/.."
for c in L V; do
  printf "file 'reel_%s_a.mp4'\nfile 'reel_%s_b.mp4'\n" "$c" "$c" > out/concat_$c.txt
  ffmpeg -loglevel error -y -f concat -safe 0 -i out/concat_$c.txt -c copy out/reel_${c}_silent.mp4
done
ffmpeg -loglevel error -y -i out/reel_L_silent.mp4 -i audio/reel_14lufs.wav -c:v copy -c:a aac -b:a 256k -shortest -movflags +faststart out/reel_16x9.mp4
ffmpeg -loglevel error -y -i out/reel_V_silent.mp4 -i audio/reel_14lufs.wav -c:v copy -c:a aac -b:a 256k -shortest -movflags +faststart out/reel_9x16.mp4
ffmpeg -loglevel error -y -i out/reel_16x9.mp4 -vf "fps=1,scale=384:-1,tile=6x10" -frames:v 1 out/reel_contact.png
ffmpeg -loglevel error -y -i out/reel_9x16.mp4 -vf "fps=1,scale=180:-1,tile=12x5" -frames:v 1 out/reel_9x16_contact.png
ffmpeg -loglevel error -y -ss 16.3 -i out/reel_16x9.mp4 -vf "scale=320:-1,tile=12x1" -frames:v 1 out/reel_strip_handoff.png
ffmpeg -loglevel error -y -ss 58.5 -i out/reel_16x9.mp4 -frames:v 1 out/reel_poster.png
for f in out/reel_16x9.mp4 out/reel_9x16.mp4; do ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate,nb_frames -show_entries format=duration -of compact "$f"; done
