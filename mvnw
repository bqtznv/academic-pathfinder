#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
TOOLS="$ROOT/.tools"
VERSION=3.9.11
if [ -x "$TOOLS/jdk/usr/lib/jvm/java-21-openjdk-amd64/bin/javac" ]; then
  export JAVA_HOME="$TOOLS/jdk/usr/lib/jvm/java-21-openjdk-amd64"
fi
mkdir -p "$TOOLS"
PROXY_ARGS=()
if [ -n "${HTTPS_PROXY:-${https_proxy:-}}" ]; then
  python3 - "$TOOLS/maven-settings.xml" <<'PY'
import os,sys,urllib.parse,xml.sax.saxutils
p=urllib.parse.urlparse(os.environ.get('HTTPS_PROXY') or os.environ['https_proxy'])
if p.username or p.password:
    raise SystemExit('Configure authenticated Maven proxy securely in your Maven settings.')
host=xml.sax.saxutils.escape(p.hostname)
with open(sys.argv[1],'w') as f:
    f.write(f'<settings><proxies><proxy><id>environment</id><active>true</active><protocol>http</protocol><host>{host}</host><port>{p.port or 80}</port><nonProxyHosts>localhost|127.0.0.1</nonProxyHosts></proxy></proxies></settings>')
PY
  PROXY_ARGS=(-s "$TOOLS/maven-settings.xml")
fi
if command -v mvn >/dev/null 2>&1; then
  exec mvn "${PROXY_ARGS[@]}" -Dmaven.repo.local="$ROOT/.cache/maven" "$@"
fi
if [ ! -x "$TOOLS/apache-maven-$VERSION/bin/mvn" ]; then
  mkdir -p "$TOOLS"
  URL="https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/$VERSION/apache-maven-$VERSION-bin.tar.gz"
  curl --fail --silent --show-error --location "$URL" -o "$TOOLS/maven.tar.gz"
  curl --fail --silent --show-error --location "$URL.sha512" -o "$TOOLS/maven.sha512"
  EXPECTED="$(awk '{print $1}' "$TOOLS/maven.sha512")"
  printf '%s  %s\n' "$EXPECTED" "$TOOLS/maven.tar.gz" | sha512sum --check --status
  tar -xzf "$TOOLS/maven.tar.gz" -C "$TOOLS"
fi
exec "$TOOLS/apache-maven-$VERSION/bin/mvn" "${PROXY_ARGS[@]}" -Dmaven.repo.local="$ROOT/.cache/maven" "$@"
