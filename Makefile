all:
	cp ~/dev/chromium/src/chrome/browser/resources/crterm/*  chrome/browser/resources/crterm/
	cp ~/dev/chromium/src/components/resources/default_100_percent/crterm_ui/crterm-favicon.png components/resources/default_100_percent/crterm_ui/
	cp ~/dev/chromium/src/components/resources/default_200_percent/crterm_ui/crterm-favicon.png components/resources/default_200_percent/crterm_ui/
	cp ~/dev/chromium/src/components/resources/default_300_percent/crterm_ui/crterm-favicon.png components/resources/default_300_percent/crterm_ui/
	cp ~/dev/chromium/src/components/webui/crterm/resources/* components/webui/crterm/resources/
	cp ~/dev/chromium/src/components/resources/crterm_ui_resources.grdp components/resources/
	cp ~/dev/chromium/src/components/resources/crterm_ui_scaled_resources.grdp components/resources/
	cp ~/dev/chromium/src/chrome/app/vector_icons/crterm.icon chrome/app/vector_icons/
	cp ~/dev/chromium/src/tools/package_crterm_deb.sh tools/package_crterm_deb.sh
	cp ~/dev/chromium/src/chrome/app/theme/chromium/product_logo* chrome/app/theme/chromium/
	cp ~/dev/chromium/src/chrome/browser/resources/newterm/* chrome/browser/resources/newterm/
	cp ~/dev/chromium/src/chrome/browser/ui/webui/crterm/crterm.mojom chrome/browser/ui/webui/crterm/crterm.mojom
	cp ~/dev/chromium/src/chrome/app/newterm_strings.grdp chrome/app/newterm_strings.grdp
	cp ~/dev/chromium/src/chrome/browser/resources/settings/crterm_page/* chrome/browser/resources/settings/crterm_page/
