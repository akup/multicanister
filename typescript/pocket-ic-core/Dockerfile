FROM node:22-slim

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.8.1 --activate

RUN apt-get update && apt-get install -y curl gzip

ARG POCKET_IC_VERSION=9.0.3
ADD https://github.com/dfinity/pocketic/releases/download/${POCKET_IC_VERSION}/pocket-ic-x86_64-linux.gz /tmp/pocket-ic.gz
RUN gzip -d /tmp/pocket-ic.gz && \
    mv /tmp/pocket-ic /usr/local/bin/pocket-ic && \
    chmod +x /usr/local/bin/pocket-ic

ENV POCKET_IC_BIN=/usr/local/bin/pocket-ic
ENV POCKET_IC_STATE_DIR=/app/ic-state

COPY . .

RUN pnpm install --ignore-scripts

EXPOSE 8092 4944

CMD ["pnpm", "run", "dev-pocket-ic-core"]