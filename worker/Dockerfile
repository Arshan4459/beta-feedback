# Transcription worker image: Node (worker runtime) + Python + faster-whisper.
FROM node:22-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-pip ffmpeg ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY worker/requirements.txt ./worker/requirements.txt
RUN pip3 install --no-cache-dir --break-system-packages -r worker/requirements.txt

# The worker only needs these two Node packages.
RUN npm install --no-save pg@8 @aws-sdk/client-s3@3

COPY worker ./worker

CMD ["node", "worker/transcribe.mjs"]
