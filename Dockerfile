FROM cgr.dev/chainguard/nginx:latest

COPY index.html /usr/share/nginx/html/
COPY style.css /usr/share/nginx/html/
COPY script.js /usr/share/nginx/html/
COPY chess-engine.js /usr/share/nginx/html/
COPY chess-ai.js /usr/share/nginx/html/
COPY chess-multiplayer.js /usr/share/nginx/html/
COPY firebase-config.js /usr/share/nginx/html/
COPY firebase-init.js /usr/share/nginx/html/

EXPOSE 8080
