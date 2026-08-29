import { Linking } from 'react-native';
import { useSettingsStore, type SidebarApp } from '../stores/settings-store';

/**
 * Sidebar apps the user marked "show on mobile". The drawer (SidebarDrawer)
 * is expected to render these below the folder list; the settings pane only
 * edits them. Mirrors the webmail's navigation-rail filter on `showOnMobile`.
 */
export function useMobileSidebarApps(): SidebarApp[] {
  return useSettingsStore((s) => s.sidebarApps.filter((app) => app.showOnMobile));
}

/**
 * Open a sidebar app. Inline (iframe) apps have no native equivalent yet, so
 * both open modes hand the URL to the system browser.
 */
export async function openSidebarApp(app: SidebarApp): Promise<void> {
  try {
    await Linking.openURL(app.url);
  } catch {
    // unsupported scheme - nothing to do
  }
}
