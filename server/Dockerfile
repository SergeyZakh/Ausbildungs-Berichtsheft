# Berichtsheft-Server: Konten, Abgleich, Ansicht für Ausbilder. Liefert nur Daten und die
# Anmeldung; die Seite selbst kommt aus dem nginx-Container (Dockerfile im Hauptordner).
#
#   docker build -t berichtsheft-server:2.2.0 server
FROM node:22-alpine
LABEL org.opencontainers.image.title="Berichtsheft-Server" \
      org.opencontainers.image.description="Konten und Ausbilder-Ansicht für das Berichtsheft"

WORKDIR /app
ENV NODE_ENV=production PORT=8080

# Einzige Abhängigkeit ist der Postgres-Treiber.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

COPY *.js ./

USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD wget -qO- http://127.0.0.1:8080/gesund >/dev/null || exit 1
CMD ["node", "server.js"]
