# syntax=docker/dockerfile:1
#
# Devcontainer image for okdp-control-plane-ui (Angular 20 / Node / npm).
# Node is installed from the official tarball and verified against the
# upstream SHASUMS256 checksums, mirroring the kubocd devcontainer pattern.
# The container runs as a non-root user (vscode) — no Kind, no Kubernetes.

FROM debian:bookworm-slim

ARG NODE_VERSION=22.15.0
ARG ANGULAR_CLI_VERSION=20
ARG USERNAME=vscode
ARG USER_UID=1000
ARG USER_GID=$USER_UID

ENV DEBIAN_FRONTEND=noninteractive

# --- Base tooling ----------------------------------------------------------
RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        git \
        gnupg \
        xz-utils \
        sudo \
        procps \
    && rm -rf /var/lib/apt/lists/*

# --- Node.js (with checksum verification) ----------------------------------
RUN set -eux; \
    arch="$(dpkg --print-architecture)"; \
    case "$arch" in \
        amd64) node_arch='x64' ;; \
        arm64) node_arch='arm64' ;; \
        *) echo "unsupported architecture: $arch" >&2; exit 1 ;; \
    esac; \
    tarball="node-v${NODE_VERSION}-linux-${node_arch}.tar.xz"; \
    base="https://nodejs.org/dist/v${NODE_VERSION}"; \
    curl -fsSLO "${base}/${tarball}"; \
    curl -fsSLO "${base}/SHASUMS256.txt"; \
    grep " ${tarball}\$" SHASUMS256.txt | sha256sum -c -; \
    tar -xJf "$tarball" -C /usr/local --strip-components=1 --no-same-owner; \
    rm "$tarball" SHASUMS256.txt; \
    node --version; \
    npm --version

# --- Non-root user ---------------------------------------------------------
RUN groupadd --gid "$USER_GID" "$USERNAME" \
    && useradd --uid "$USER_UID" --gid "$USER_GID" -m -s /bin/bash "$USERNAME" \
    && echo "$USERNAME ALL=(root) NOPASSWD:ALL" > "/etc/sudoers.d/$USERNAME" \
    && chmod 0440 "/etc/sudoers.d/$USERNAME"

# Global npm packages go into the user's home so we never need root for installs.
ENV NPM_CONFIG_PREFIX=/home/$USERNAME/.npm-global
ENV PATH=/home/$USERNAME/.npm-global/bin:$PATH

USER $USERNAME

RUN mkdir -p "/home/$USERNAME/.npm-global" \
    && npm install -g "@angular/cli@${ANGULAR_CLI_VERSION}"

WORKDIR /workspaces/okdp-control-plane-ui
