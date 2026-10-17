# Burrowly: architecture diagram viewer/editor. No npm dependencies, so the image is just Node + our files.
FROM node:22-alpine

WORKDIR /app
# Copies viewer/, tools/ and model/ if it exists (see .dockerignore). A missing model/ folder is fine:
# compose mounts ./model over /app/model anyway, and an empty model starts with a "Create system.yaml" button.
COPY . ./
RUN mkdir -p model

ENV HOST=0.0.0.0 \
    PORT=4321 \
    MODEL_DIR=/app/model \
    READ_ONLY=0

RUN chown -R node:node /app
USER node
EXPOSE 4321

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/ping" >/dev/null || exit 1

CMD ["node", "tools/serve.mjs"]
