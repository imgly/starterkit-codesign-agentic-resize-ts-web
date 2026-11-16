// The kit's actions: its video export downloads the file, unbilled as in the kit; the modal registers `saveScene`.

import type CreativeEditorSDK from '@cesdk/cesdk-js';
export function setupActions(cesdk: CreativeEditorSDK): void {
  cesdk.actions.register('exportDesign', async (exportOptions) => {
    const { blobs, options } = await cesdk.utils.export({
      videoBitrate: 'Auto',
      ...exportOptions
    });
    await cesdk.utils.downloadFile(blobs[0], options.mimeType);
  });
}
