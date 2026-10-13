// The kit's actions less `saveScene`, which the modal registers: Save writes to the design's store.

import type CreativeEditorSDK from '@cesdk/cesdk-js';
export function setupActions(cesdk: CreativeEditorSDK): void {
  cesdk.actions.register('exportDesign', async (exportOptions) => {
    const { blobs, options } = await cesdk.utils.export(exportOptions);
    await cesdk.utils.downloadFile(blobs[0], options.mimeType);
  });
  cesdk.actions.register('importScene', async () => {
    const blobURL = await cesdk.utils.loadFile({
      accept: '.imgly,.scene,.zip',
      returnType: 'objectURL'
    });
    try {
      await cesdk.engine.scene.load(blobURL);
    } finally {
      URL.revokeObjectURL(blobURL);
    }
    await cesdk.actions.run('zoom.toPage', { page: 'first' });
  });
  cesdk.actions.register('exportScene', async ({ format = 'scene' }) => {
    await cesdk.utils.downloadFile(
      format === 'archive'
        ? await cesdk.engine.scene.saveToArchive()
        : await cesdk.engine.scene.saveToString(),
      format === 'archive' ? 'application/zip' : 'text/plain;charset=UTF-8'
    );
  });
  cesdk.actions.register('uploadFile', (file, _onProgress, context) => {
    return cesdk.utils.localUpload(file, context);
  });
}
