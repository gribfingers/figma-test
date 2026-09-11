# ---- build ----
FROM node:20-bookworm-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- whisper.cpp build (Messenger voice input) ----
# A separate stage so its ~500MB model download is its own Docker layer: it's
# only re-run when WHISPER_MODEL changes, not on every backend code change.
# GGML_NATIVE=OFF trades a bit of speed for a binary that isn't tied to the
# exact CPU of whichever machine happened to build the image.
FROM node:20-bookworm-slim AS whisper
WORKDIR /whisper
RUN apt-get update && apt-get install -y --no-install-recommends git cmake build-essential ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*
ARG WHISPER_MODEL=medium
# -DBUILD_SHARED_LIBS=OFF: statically link libggml/libwhisper into the binary — the runtime stage
# below only copies the whisper-server executable itself, not any .so files.
RUN git clone --depth 1 https://github.com/ggml-org/whisper.cpp.git . \
    && cmake -B build -DCMAKE_BUILD_TYPE=Release -DGGML_NATIVE=OFF -DBUILD_SHARED_LIBS=OFF \
    && cmake --build build -j"$(nproc)" --target whisper-server \
    && bash ./models/download-ggml-model.sh "${WHISPER_MODEL}"

# ---- runtime ----
FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
# Re-declared so it can carry the same value into ENV below — build ARGs don't cross stages on
# their own, and whisper.ts needs to know at runtime which model file name to actually look for.
ARG WHISPER_MODEL=medium
ENV WHISPER_MODEL=${WHISPER_MODEL}
# ffmpeg backs whisper-server's --convert (decodes whatever format the browser recorded);
# libgomp1 is whisper-server's OpenMP runtime — g++ doesn't pull it in on its own.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ ffmpeg libgomp1 \
    && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY scripts ./scripts
COPY --from=whisper /whisper/build/bin/whisper-server ./vendor/whisper.cpp/build/bin/whisper-server
COPY --from=whisper /whisper/models/ggml-*.bin ./vendor/whisper.cpp/models/

ENV DB_PATH=/app/data/data.sqlite3
VOLUME ["/app/data"]
EXPOSE 4000
CMD ["node", "dist/index.js"]
