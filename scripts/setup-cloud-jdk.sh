#!/usr/bin/env bash
# Install a verified Debian JDK locally when the cloud image supplies only a JRE.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [ -x "$ROOT/.tools/jdk/usr/lib/jvm/java-21-openjdk-amd64/bin/javac" ]; then exit 0; fi
if command -v javac >/dev/null 2>&1 && javac -version 2>&1 | rg -q '^javac 21\.'; then exit 0; fi
if [ "$(uname -m)" != x86_64 ] || [ ! -f /usr/share/keyrings/debian-archive-keyring.gpg ]; then
  echo 'Install a Java 21 JDK, then rerun setup.' >&2
  exit 1
fi
APT_ROOT="$ROOT/.tools/apt"
mkdir -p "$APT_ROOT/etc/apt.conf.d" "$APT_ROOT/etc/preferences.d" "$APT_ROOT/lists/partial" "$APT_ROOT/cache/archives/partial"
python3 - "$APT_ROOT" <<'PY'
from pathlib import Path
import os,sys
p=Path(sys.argv[1])
(p/'etc/sources.list').write_text('deb [signed-by=/usr/share/keyrings/debian-archive-keyring.gpg] https://deb.debian.org/debian trixie main\n')
config=f'Dir::Etc "{p}/etc";\nDir::Etc::sourcelist "sources.list";\nDir::Etc::sourceparts "sources.list.d";\nDir::State::lists "{p}/lists";\nDir::Cache "{p}/cache";\n'
proxy=os.environ.get('HTTPS_PROXY') or os.environ.get('https_proxy')
if proxy:
    if any(c in proxy for c in ['"','\n','\r']):raise SystemExit('Invalid proxy URL')
    config+=f'Acquire::https::Proxy "{proxy}";\n'
(p/'apt.conf').write_text(config)
(p/'apt.conf').chmod(0o600)
PY
APT_CONFIG="$APT_ROOT/apt.conf" /usr/bin/apt-get update -qq
cd "$ROOT/.tools"
APT_CONFIG="$APT_ROOT/apt.conf" /usr/bin/apt-get download openjdk-21-jdk-headless openjdk-21-jre-headless
mkdir -p jdk
for package in openjdk-21-jdk-headless_*_amd64.deb openjdk-21-jre-headless_*_amd64.deb; do dpkg-deb -x "$package" jdk; done
jdk/usr/lib/jvm/java-21-openjdk-amd64/bin/javac -version
