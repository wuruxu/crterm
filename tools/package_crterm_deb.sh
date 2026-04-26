#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

APP_NAME="crTerm"
PKG_NAME="crterm"
INSTALL_DIR="/opt/${PKG_NAME}"
ICON_SOURCE="${REPO_ROOT}/chrome/app/theme/chromium/product_logo.svg"
DEFAULT_BUILD_DIR="${REPO_ROOT}/out/debian"
DEFAULT_OUTPUT_DIR="${REPO_ROOT}/out/packages"
DEFAULT_MAINTAINER="${DEBFULLNAME:-${USER:-crterm}} <${DEBEMAIL:-${USER:-crterm}@localhost}>"

usage() {
  cat <<'EOF'
用法:
  tools/package_crterm_deb.sh [--build-dir DIR] [--output-dir DIR] [--version VER]

说明:
  - 只打包已有的 Chromium 构建产物，不会触发编译
  - 默认构建输出目录: out/debian
  - 默认 deb 输出目录: out/packages

示例:
  tools/package_crterm_deb.sh
  tools/package_crterm_deb.sh --build-dir out/debian --version 146.0.0.0
EOF
}

BUILD_DIR="${DEFAULT_BUILD_DIR}"
OUTPUT_DIR="${DEFAULT_OUTPUT_DIR}"
VERSION=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --build-dir)
      BUILD_DIR="$2"
      shift 2
      ;;
    --output-dir)
      OUTPUT_DIR="$2"
      shift 2
      ;;
    --version)
      VERSION="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "未知参数: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

BUILD_DIR="$(cd "${BUILD_DIR}" && pwd)"
OUTPUT_DIR="$(mkdir -p "${OUTPUT_DIR}" && cd "${OUTPUT_DIR}" && pwd)"

require_file() {
  local path="$1"
  if [[ ! -e "${path}" ]]; then
    echo "缺少文件: ${path}" >&2
    exit 1
  fi
}

require_cmd() {
  local cmd="$1"
  if ! command -v "${cmd}" >/dev/null 2>&1; then
    echo "缺少命令: ${cmd}" >&2
    exit 1
  fi
}

require_cmd dpkg-deb
require_cmd install
require_cmd find

require_file "${BUILD_DIR}/chrome"
require_file "${BUILD_DIR}/chrome-wrapper"
require_file "${BUILD_DIR}/resources.pak"
require_file "${BUILD_DIR}/icudtl.dat"
require_file "${ICON_SOURCE}"

if [[ -z "${VERSION}" ]]; then
  if "${BUILD_DIR}/chrome" --product-version >/dev/null 2>&1; then
    VERSION="$("${BUILD_DIR}/chrome" --product-version | tr -d '\n' | tr -cd '0-9A-Za-z.+:~-' )"
  fi
fi

if [[ -z "${VERSION}" ]]; then
  VERSION="146.0.0.0"
fi

if command -v dpkg >/dev/null 2>&1; then
  ARCH="$(dpkg --print-architecture)"
else
  case "$(uname -m)" in
    x86_64) ARCH="amd64" ;;
    aarch64) ARCH="arm64" ;;
    *) ARCH="$(uname -m)" ;;
  esac
fi

STAGING_DIR="$(mktemp -d)"
PKG_ROOT="${STAGING_DIR}/${PKG_NAME}_${VERSION}_${ARCH}"
DEBIAN_DIR="${PKG_ROOT}/DEBIAN"
APP_ROOT="${PKG_ROOT}${INSTALL_DIR}"

cleanup() {
  rm -rf "${STAGING_DIR}"
}
trap cleanup EXIT

mkdir -p "${DEBIAN_DIR}" \
         "${APP_ROOT}" \
         "${PKG_ROOT}/usr/bin" \
         "${PKG_ROOT}/usr/share/applications" \
         "${PKG_ROOT}/usr/share/icons/hicolor/scalable/apps"

copy_if_exists() {
  local src="$1"
  local dst_dir="$2"
  if [[ -e "${src}" ]]; then
    cp -a "${src}" "${dst_dir}/"
  fi
}

copy_top_level_matches() {
  local pattern="$1"
  while IFS= read -r file; do
    cp -a "${file}" "${APP_ROOT}/"
  done < <(find "${BUILD_DIR}" -maxdepth 1 -type f -name "${pattern}" | sort)
}

# 复制 Chromium 运行主文件，不做任何编译。
copy_if_exists "${BUILD_DIR}/chrome" "${APP_ROOT}"
copy_if_exists "${BUILD_DIR}/chrome-wrapper" "${APP_ROOT}"
copy_if_exists "${BUILD_DIR}/chrome_crashpad_handler" "${APP_ROOT}"

copy_top_level_matches "*.pak"
copy_top_level_matches "*.bin"
copy_top_level_matches "*.dat"
copy_top_level_matches "*.so"
copy_top_level_matches "*.json"

for dir_name in \
  locales \
  swiftshader \
  hyphen-data \
  MEIPreload \
  PrivacySandboxAttestationsPreloaded \
  IwaKeyDistribution; do
  copy_if_exists "${BUILD_DIR}/${dir_name}" "${APP_ROOT}"
done

strip --strip-unneeded "${APP_ROOT}/chrome"
strip --strip-unneeded "${APP_ROOT}/chrome_crashpad_handler"
strip --strip-unneeded "${APP_ROOT}/libVkLayer_khronos_validation.so"
strip --strip-unneeded "${APP_ROOT}/libvk_swiftshader.so"
strip --strip-unneeded "${APP_ROOT}/libGLESv2.so"

install -m 0644 "${ICON_SOURCE}" \
  "${PKG_ROOT}/usr/share/icons/hicolor/scalable/apps/${PKG_NAME}.svg"

cat > "${PKG_ROOT}/usr/bin/${PKG_NAME}" <<EOF
#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${INSTALL_DIR}"
export CHROME_WRAPPER="\${APP_DIR}/chrome-wrapper"
export CHROME_DESKTOP="${PKG_NAME}.desktop"
export CHROME_VERSION_EXTRA="custom"
export LD_LIBRARY_PATH="\${APP_DIR}:\${APP_DIR}/lib:\${APP_DIR}/lib.target\${LD_LIBRARY_PATH:+:\${LD_LIBRARY_PATH}}"

exec "\${APP_DIR}/chrome" "\$@"
EOF
chmod 0755 "${PKG_ROOT}/usr/bin/${PKG_NAME}"

cat > "${PKG_ROOT}/usr/share/applications/${PKG_NAME}.desktop" <<EOF
[Desktop Entry]
Version=${VERSION}
Type=Application
Name=${APP_NAME}
Comment=an AI-era terminal app
Exec=${PKG_NAME} %U
Icon=${PKG_NAME}
Terminal=false
StartupNotify=true
StartupWMClass=crTerm
Categories=System;TerminalEmulator;Utility;
EOF

cat > "${DEBIAN_DIR}/control" <<EOF
Package: ${PKG_NAME}
Version: ${VERSION}
Section: utils
Priority: optional
Architecture: ${ARCH}
Maintainer: ${DEFAULT_MAINTAINER}
Depends: libc6, libasound2, libatk-bridge2.0-0, libatk1.0-0, libcairo2, libcups2, libdbus-1-3, libdrm2, libexpat1, libfontconfig1, libgbm1, libglib2.0-0, libgtk-3-0 | libgtk-4-1, libnspr4, libnss3, libpango-1.0-0, libx11-6, libx11-xcb1, libxcb1, libxcomposite1, libxdamage1, libxext6, libxfixes3, libxkbcommon0, libxrandr2, xdg-utils
Description: ${APP_NAME} browser package built from local Chromium output
 This package is assembled from prebuilt files in ${BUILD_DIR}.
 It does not compile Chromium during packaging.
EOF

cat > "${DEBIAN_DIR}/postinst" <<'EOF'
#!/usr/bin/env bash
set -e

if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database /usr/share/applications || true
fi

if command -v gtk-update-icon-cache >/dev/null 2>&1; then
  gtk-update-icon-cache -q /usr/share/icons/hicolor || true
fi
EOF
chmod 0755 "${DEBIAN_DIR}/postinst"

cat > "${DEBIAN_DIR}/postrm" <<'EOF'
#!/usr/bin/env bash
set -e

if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database /usr/share/applications || true
fi

if command -v gtk-update-icon-cache >/dev/null 2>&1; then
  gtk-update-icon-cache -q /usr/share/icons/hicolor || true
fi
EOF
chmod 0755 "${DEBIAN_DIR}/postrm"

if [[ -f "${APP_ROOT}/chrome_sandbox" ]]; then
  chmod 4755 "${APP_ROOT}/chrome_sandbox"
fi

if [[ -f "${APP_ROOT}/chrome-sandbox" ]]; then
  chmod 4755 "${APP_ROOT}/chrome-sandbox"
fi

DEB_PATH="${OUTPUT_DIR}/${PKG_NAME}_${VERSION}_${ARCH}.deb"
dpkg-deb --root-owner-group --build "${PKG_ROOT}" "${DEB_PATH}"

echo "已生成: ${DEB_PATH}"
