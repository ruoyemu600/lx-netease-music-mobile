#!/usr/bin/env bash
# Reuse the verified local ARM64 toolchain. Never installs an app or uploads code.
set -euo pipefail
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKSPACE="$(dirname "$PROJECT_DIR")"
BUILD_HOME="${LX_LOCAL_BUILD_HOME:-$WORKSPACE/lx-n-local-build}"
HERMESC="${LX_HERMESC:-$WORKSPACE/lx-n-hermes-native/build/bin/hermesc}"
OUTPUT_DIR="${LX_APK_OUTPUT_DIR:-/sdcard/Download/DSH-Go/lx-n-local-apk}"
WORKERS="${LX_BUILD_WORKERS:-2}"
[[ "$WORKERS" =~ ^[1-9][0-9]*$ ]] || { printf 'Invalid worker count\n' >&2; exit 2; }
[[ -f "$BUILD_HOME/env.sh" ]] || { printf 'Missing local build environment: %s\n' "$BUILD_HOME/env.sh" >&2; exit 2; }
source "$BUILD_HOME/env.sh"
AAPT2="$ANDROID_HOME/build-tools/35.0.0/aapt2"
APKSIGNER="$ANDROID_HOME/build-tools/35.0.0/apksigner"
ZIPALIGN="$ANDROID_HOME/build-tools/35.0.0/zipalign"
for tool in "$HERMESC" "$AAPT2" "$APKSIGNER" "$ZIPALIGN"; do
  [[ -x "$tool" ]] || { printf 'Missing executable: %s\n' "$tool" >&2; exit 2; }
done
[[ -d "$PROJECT_DIR/node_modules" ]] || { printf 'Install locked dependencies with npm ci first.\n' >&2; exit 2; }
mkdir -p "$BUILD_HOME/logs" "$OUTPUT_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
LOG="$BUILD_HOME/logs/build-$STAMP.log"
cd "$PROJECT_DIR"
printf 'Build log: %s\n' "$LOG"
{
  java -version
  "$AAPT2" version
  "$HERMESC" -version
  npm run build:theme
  npm run check:material
  # AGP's prefab staging does not complete on this ARM64 host; see the patch header.
  node scripts/patch-quick-base64.cjs
  node scripts/patch-listening-stats.cjs
  cd "$PROJECT_DIR/android"
  bash ./gradlew :app:assembleMaterialPreview \
    --no-daemon --max-workers="$WORKERS" \
    '-Dorg.gradle.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=768m -Dfile.encoding=UTF-8' \
    -Dorg.gradle.parallel=false -Dorg.gradle.vfs.watch=false \
    -Pkotlin.compiler.execution.strategy=in-process \
    -PreactNativeArchitectures=arm64-v8a \
    -x lintVitalMaterialPreview -x lintVitalRelease \
    "-PlocalHermesCommand=$HERMESC" "-PmetroMaxWorkers=$WORKERS" \
    "-Pandroid.aapt2FromMavenOverride=$AAPT2" \
    -I "$BUILD_HOME/local-maven.init.gradle" --stacktrace
} 2>&1 | tee "$LOG"
# Read the just-built variant metadata, not a wildcard that may select an older version.
APK="$(python3 - "$PROJECT_DIR" <<'PY'
import json, sys
from pathlib import Path
root = Path(sys.argv[1])
pkg = json.loads((root / 'package.json').read_text())
directory = root / 'android/app/build/outputs/apk/materialPreview'
meta = json.loads((directory / 'output-metadata.json').read_text())
assert meta['applicationId'] == 'com.lxnetease.music.mobile.material'
items = [item for item in meta['elements'] if any(f['filterType'] == 'ABI' and f['value'] == 'arm64-v8a' for f in item['filters'])]
assert len(items) == 1, f'Expected one ARM64 output, got {len(items)}'
item = items[0]
assert item['versionName'] == pkg['version'] + '-material-preview', 'Stale version metadata'
assert item['versionCode'] == pkg['versionCode'] * 1000 + 3, 'Stale version code'
apk = (directory / item['outputFile']).resolve()
assert apk.parent == directory.resolve() and apk.is_file(), 'Missing or invalid APK output'
print(apk)
PY
)"
VERSION="$(node -p 'require(process.argv[1]).version' "$PROJECT_DIR/package.json")"
"$APKSIGNER" verify --verbose "$APK" | tee "$LOG.signature.txt"
"$ZIPALIGN" -c -P 16 4 "$APK" > "$LOG.alignment.txt" 2>&1
"$AAPT2" dump badging "$APK" > "$LOG.badging.txt"
python3 - "$APK" "$LOG.badging.txt" <<'PY'
import sys, zipfile, struct
from pathlib import Path
apk=Path(sys.argv[1]); badging=Path(sys.argv[2]).read_text()
assert "name='com.lxnetease.music.mobile.material'" in badging, 'Unexpected application ID'
assert "application-label:'LX-N Material'" in badging or "label='LX-N Material'" in badging, 'Unexpected app label'
with zipfile.ZipFile(apk) as z:
    assert z.testzip() is None, 'ZIP CRC failure'
    names=set(z.namelist())
    for entry in ['AndroidManifest.xml', 'classes.dex', 'resources.arsc', 'assets/index.android.bundle']:
        assert entry in names, f'Missing APK entry: {entry}'
    for lib in ['libhermes.so','libquickmd5.so','libquickbase64.so']:
        assert f'lib/arm64-v8a/{lib}' in names, f'Missing native library: {lib}'
    bundle=z.read('assets/index.android.bundle')
    magic,version=struct.unpack('<QI',bundle[:12])
    assert magic==0x1F1903C103BC1FC6 and version==96, f'Unexpected Hermes format: {magic:x}/{version}'
    print('PASS application ID, label, ZIP CRC, DEX/resources, ARM64 native libraries, Hermes HBC96')
PY
FINAL="$OUTPUT_DIR/LX-N-Material-v$VERSION-arm64-$STAMP.apk"
[[ ! -e "$FINAL" ]] || { printf 'Output already exists: %s\n' "$FINAL" >&2; exit 3; }
cp -- "$APK" "$FINAL"
sha256sum "$FINAL" | tee "$FINAL.sha256"
printf '\nVerified APK: %s\nSignature/structure checks passed; device launch and playback require separate testing.\n' "$FINAL"
