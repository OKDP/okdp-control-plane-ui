# syntax=docker/dockerfile:1
# Devcontainer image for okdp-control-plane-ui (React / Vite).

FROM node:22-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates git sudo procps \
    && rm -rf /var/lib/apt/lists/* \
    && echo "node ALL=(root) NOPASSWD:ALL" > /etc/sudoers.d/node \
    && chmod 0440 /etc/sudoers.d/node

USER node

WORKDIR /workspace
