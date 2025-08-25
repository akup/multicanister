FROM node:alpine3.22

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.8.1 --activate

RUN apk add --no-cache curl gzip

ARG POCKET_IC_VERSION=9.0.3
ADD https://github.com/dfinity/pocketic/releases/download/${POCKET_IC_VERSION}/pocket-ic-x86_64-linux.gz /tmp/pocket-ic.gz
RUN gzip -d /tmp/pocket-ic.gz && \
    mv /tmp/pocket-ic /usr/local/bin/pocket-ic && \
    chmod +x /usr/local/bin/pocket-ic

# Copy pnpm workspace with dependencies
# Copy the entire typescript directory
COPY ./typescript ./typescript
# Copy picjs as it is part of workspace
COPY ./picjs ./picjs
COPY ./pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY ./pnpm-lock.yaml ./pnpm-lock.yaml

# Run pnpm install from pocket-ic-core project
WORKDIR /app/typescript/pocket-ic-core
RUN pnpm install

# Build the TypeScript application
RUN pnpm run esbuild

# Remove dev dependencies to reduce image size
RUN pnpm prune --prod

EXPOSE 8092 4944

ENV POCKET_IC_BIN=/usr/local/bin/pocket-ic
ENV POCKET_IC_STATE_DIR=/app/ic-state

CMD ["node", "dist/index.js"]