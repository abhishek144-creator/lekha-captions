Lekha Captions - launch video v2 (32 s, 1920x1080, 30 fps)

Requirements: Node 18+, Python 3 with numpy, FFmpeg on PATH, internet (Google Fonts).

  cd launch-video-v2
  npm init -y && npm install puppeteer
  python soundtrack-v2.py            # out/soundtrack-v2.wav
  node render.mjs                    # out/lekha-launch-v2-silent.mp4
  node render.mjs --stills 5,17.4    # optional: single frames for review
  ffmpeg -i out/lekha-launch-v2-silent.mp4 -i out/soundtrack-v2.wav -map 0:v -map 1:a -c:v copy -af loudnorm=I=-14:TP=-1:LRA=11 -c:a aac -b:a 256k -shortest -movflags +faststart out/lekha-launch-v2-1080p.mp4

Files
  launch-v2.html    the whole film: every scene, timing and animation (seekable via window.renderAt(t))
  render.mjs        opens the page in headless Chrome, renders every frame, pipes them into FFmpeg
  soundtrack-v2.py  synthesizes the music + sound effects, timed to the film
  assets/editor-screenshot.png  the editor screenshot used as the base
  assets/clip/      the palm clip as 83 frames (ping-pong looped in the page)
  assets/logo-data.js  outlined logo geometry used for the animated logo
  ../brand/svg/lekha-wordmark-dark.svg  logo patched into the editor top bar
