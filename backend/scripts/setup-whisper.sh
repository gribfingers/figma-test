#!/usr/bin/env bash
# Builds whisper.cpp and downloads a speech-to-text model for the Messenger's
# voice input, for a backend running directly (npm run dev / npm start),
# not via Docker — the Docker image builds this itself, see
# backend/Dockerfile. Run once on the server (needs cmake, a C++ compiler,
# and ffmpeg — ffmpeg is also used at runtime to decode whatever format the
# browser recorded), then restart the backend so it picks up the built
# server + model. Not run automatically: this downloads ~500MB from Hugging
# Face, which some environments (this repo's own dev sandbox included)
# block by network policy.
set -euo pipefail
cd "$(dirname "$0")/.."

MODEL="${WHISPER_MODEL:-medium}" # medium = best ru/en accuracy this repo defaults to; "small"/"base" are lighter/faster

mkdir -p vendor
cd vendor
if [ -d whisper.cpp ]; then
  echo "vendor/whisper.cpp already exists, pulling latest..."
  git -C whisper.cpp pull --ff-only
else
  git clone --depth 1 https://github.com/ggml-org/whisper.cpp.git
fi
cd whisper.cpp

# -DBUILD_SHARED_LIBS=OFF: statically link libggml/libwhisper into the binary — simpler than
# relying on the dynamic loader finding libggml.so/libwhisper.so next to it.
cmake -B build -DCMAKE_BUILD_TYPE=Release -DBUILD_SHARED_LIBS=OFF
cmake --build build -j"$(nproc)" --target whisper-server

bash ./models/download-ggml-model.sh "$MODEL"

echo
echo "Done. whisper-server binary: vendor/whisper.cpp/build/bin/whisper-server"
echo "Model: vendor/whisper.cpp/models/ggml-${MODEL}.bin"
echo "Restart the backend (npm run dev / npm start) to pick it up."
