// CE.SDK's design-editor config, copied from IMG.LY's AI editor starter kit (MIT, ./LICENSE) less its comments.
import type { EditorPlugin, EditorPluginContext } from '@cesdk/cesdk-js';
import CreativeEditorSDK from '@cesdk/cesdk-js';

import { setupActions } from './actions.js';
import { setupFeatures } from './features.js';
import { usAnsiCatalog } from './keyboard.js';
import { setupSettings } from './settings.js';
import { setupUI } from './ui.js';

export class DesignEditorConfig implements EditorPlugin {
  name = 'cesdk-design-editor';
  version = CreativeEditorSDK.version;

  async initialize({ cesdk, engine }: EditorPluginContext) {
    if (cesdk) {
      cesdk.resetEditor();
      cesdk.setEditorCompatibilityVersion(CreativeEditorSDK.version);
      setupFeatures(cesdk);
      setupUI(cesdk);
      setupActions(cesdk);
      cesdk.shortcuts.set(usAnsiCatalog);
      setupSettings(engine);
      cesdk.reapplyLegacyUserConfiguration();
    }
  }
}
