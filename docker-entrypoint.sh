#!/bin/sh
# Write the runtime configuration the bundle reads before it starts.
#
# The image is built once and runs against any cluster, whose OIDC issuer is
# not known at build time. index.html loads /config.js before the bundle, and
# src/config/environment.ts reads window.__OKDP_CONFIG__ from it.
set -eu

# rolesClaim and adminRole travel the same way: which claim carries the roles,
# and which role grants administration, are properties of the realm the cluster
# authenticates against, not of this image. The defaults match Keycloak.
# Values reach this script from the chart, so a stray quote or backslash in one
# of them would produce a config.js the browser cannot parse, and the console
# would render nothing at all.
js_string() {
  printf '%s' "$1" | tr -d '\n\r' | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'
}

cat > /usr/share/nginx/html/config.js <<EOF
window.__OKDP_CONFIG__ = {
  authority: "$(js_string "${OIDC_AUTHORITY:-}")",
  clientId: "$(js_string "${OIDC_CLIENT_ID:-}")",
  rolesClaim: "$(js_string "${OIDC_ROLES_CLAIM:-groups}")",
  adminRole: "$(js_string "${OIDC_ADMIN_ROLE:-platform_admin}")"
};
EOF

exec "$@"
