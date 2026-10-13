import type CreativeEditorSDK from '@cesdk/cesdk-js';

export function setupPanels(cesdk: CreativeEditorSDK): void {
  cesdk.ui.setPanelPosition('//ly.img.panel/inspector', 'left');
  cesdk.ui.setPanelFloating('//ly.img.panel/inspector', false);

  cesdk.ui.setPanelPosition('//ly.img.panel/assetLibrary', 'left');
  cesdk.ui.setPanelFloating('//ly.img.panel/assetLibrary', false);
}

export function setupNavigationBar(cesdk: CreativeEditorSDK): void {
  cesdk.ui.setComponentOrder({ in: 'ly.img.navigation.bar' }, [
    'ly.img.documentSettings.navigationBar',
    'ly.img.undoRedo.navigationBar',
    'ly.img.spacer',
    'ly.img.title.navigationBar',
    'ly.img.spacer',
    'ly.img.zoom.navigationBar',
    'ly.img.preview.navigationBar',
    {
      id: 'ly.img.actions.navigationBar',
      children: [
        'ly.img.exportImage.navigationBar',
        'ly.img.exportPDF.navigationBar'
      ]
    }
  ]);
}

export function setupCanvas(cesdk: CreativeEditorSDK): void {
  cesdk.ui.setComponentOrder({ in: 'ly.img.canvas.bar', at: 'bottom' }, [
    'ly.img.settings.canvasBar',
    'ly.img.spacer',
    'ly.img.page.add.canvasBar',
    'ly.img.spacer'
  ]);

  cesdk.ui.setComponentOrder(
    { in: 'ly.img.canvas.menu', when: { editMode: 'Transform' } },
    [
      'ly.img.group.enter.canvasMenu',
      'ly.img.group.select.canvasMenu',
      'ly.img.page.moveUp.canvasMenu',
      'ly.img.page.moveDown.canvasMenu',
      'ly.img.separator',
      'ly.img.text.edit.canvasMenu',
      'ly.img.text.styles.canvasMenu',
      'ly.img.replace.canvasMenu',
      'ly.img.separator',
      'ly.img.bringForward.canvasMenu',
      'ly.img.sendBackward.canvasMenu',
      'ly.img.separator',
      'ly.img.duplicate.canvasMenu',
      'ly.img.delete.canvasMenu',
      'ly.img.separator',
      'ly.img.options.canvasMenu'
    ]
  );

  cesdk.ui.setComponentOrder(
    { in: 'ly.img.canvas.menu', when: { editMode: 'Vector' } },
    []
  );

  cesdk.ui.setComponentOrder(
    { in: 'ly.img.canvas.menu', when: { editMode: 'Text' } },
    [
      'ly.img.text.color.canvasMenu',
      'ly.img.separator',
      'ly.img.text.bold.canvasMenu',
      'ly.img.text.italic.canvasMenu',
      'ly.img.text.underline.canvasMenu',
      'ly.img.text.strikethrough.canvasMenu',
      'ly.img.separator',
      'ly.img.text.list.unordered.canvasMenu',
      'ly.img.text.list.ordered.canvasMenu',
      'ly.img.separator',
      'ly.img.text.variables.canvasMenu'
    ]
  );
}

export function setupInspectorBar(cesdk: CreativeEditorSDK): void {
  cesdk.ui.setComponentOrder(
    { in: 'ly.img.inspector.bar', when: { editMode: 'Transform' } },
    [
      'ly.img.spacer',

      'ly.img.pageResize.inspectorBar',
      'ly.img.separator',
      'ly.img.video.caption.inspectorBar',
      'ly.img.shape.options.inspectorBar',
      'ly.img.cutout.type.inspectorBar',
      'ly.img.cutout.offset.inspectorBar',
      'ly.img.cutout.smoothing.inspectorBar',
      'ly.img.group.create.inspectorBar',
      'ly.img.group.ungroup.inspectorBar',
      'ly.img.audio.replace.inspectorBar',
      'ly.img.separator',
      'ly.img.text.typeFace.inspectorBar',
      'ly.img.text.bold.inspectorBar',
      'ly.img.text.italic.inspectorBar',
      'ly.img.text.fontSize.inspectorBar',
      'ly.img.text.alignHorizontal.inspectorBar',
      'ly.img.text.advanced.inspectorBar',
      'ly.img.combine.inspectorBar',
      'ly.img.separator',
      'ly.img.fill.inspectorBar',
      'ly.img.trim.inspectorBar',
      'ly.img.volume.inspectorBar',
      'ly.img.crop.inspectorBar',
      'ly.img.separator',
      'ly.img.stroke.inspectorBar',
      'ly.img.separator',
      'ly.img.text.background.inspectorBar',
      'ly.img.separator',
      'ly.img.text.path.inspectorBar',
      'ly.img.separator',

      {
        id: 'ly.img.appearance.inspectorBar',
        children: [
          'ly.img.adjustment.inspectorBar',
          'ly.img.filter.inspectorBar',
          'ly.img.effect.inspectorBar',
          'ly.img.blur.inspectorBar',
          'ly.img.separator',
          'ly.img.shadow.inspectorBar'
        ]
      },
      'ly.img.separator',
      'ly.img.opacityOptions.inspectorBar',
      'ly.img.separator',
      'ly.img.position.inspectorBar',
      'ly.img.spacer',
      'ly.img.separator',
      'ly.img.inspectorToggle.inspectorBar'
    ]
  );

  cesdk.ui.setComponentOrder(
    { in: 'ly.img.inspector.bar', when: { editMode: 'Trim' } },
    ['ly.img.trimControls.inspectorBar']
  );

  cesdk.ui.setComponentOrder(
    { in: 'ly.img.inspector.bar', when: { editMode: 'Crop' } },
    ['ly.img.cropControls.inspectorBar']
  );

  cesdk.ui.setComponentOrder(
    { in: 'ly.img.inspector.bar', when: { editMode: 'Vector' } },
    [
      'ly.img.vectorEdit.moveMode.inspectorBar',
      'ly.img.vectorEdit.addMode.inspectorBar',
      'ly.img.vectorEdit.deleteMode.inspectorBar',
      'ly.img.separator',
      'ly.img.vectorEdit.bendMode.inspectorBar',
      'ly.img.vectorEdit.mirrorMode.inspectorBar',
      'ly.img.separator',
      'ly.img.vectorEdit.done.inspectorBar'
    ]
  );
}

export function setupDock(cesdk: CreativeEditorSDK): void {
  cesdk.engine.editor.setSetting('dock/hideLabels', false);
  cesdk.engine.editor.setSetting('dock/iconSize', 'large');

  cesdk.ui.setComponentOrder({ in: 'ly.img.dock' }, [
    {
      id: 'ly.img.assetLibrary.dock',
      key: 'ly.img.elements',
      icon: '@imgly/Library',
      label: 'component.library.elements',
      entries: [
        'ly.img.image',
        'ly.img.text',
        'ly.img.vector.shape',
        'ly.img.sticker'
      ]
    },
    {
      id: 'ly.img.assetLibrary.dock',
      key: 'ly.img.upload',
      icon: '@imgly/Upload',
      label: 'libraries.ly.img.upload.label',
      entries: ['ly.img.upload']
    },
    {
      id: 'ly.img.assetLibrary.dock',
      key: 'ly.img.image',
      icon: '@imgly/Image',
      label: 'libraries.ly.img.image.label',
      entries: ['ly.img.image', 'ly.img.image.upload']
    },
    {
      id: 'ly.img.assetLibrary.dock',
      key: 'ly.img.text',
      icon: '@imgly/Text',
      label: 'libraries.ly.img.text.label',
      entries: ['ly.img.text']
    },
    {
      id: 'ly.img.assetLibrary.dock',
      key: 'ly.img.vector.shape',
      icon: '@imgly/Shapes',
      label: 'libraries.ly.img.vector.shape.label',
      entries: ['ly.img.vector.shape']
    },
    {
      id: 'ly.img.assetLibrary.dock',
      key: 'ly.img.sticker',
      icon: '@imgly/Sticker',
      label: 'libraries.ly.img.sticker.label',
      entries: ['ly.img.sticker']
    },
    {
      id: 'ly.img.spacer',
      key: 'ly.img.spacer'
    },
    {
      id: 'ly.img.separator',
      key: 'ly.img.separator.layers'
    },
    {
      id: 'ly.img.assetLibrary.dock',
      key: 'ly.img.layerList',
      icon: '@imgly/Layers',
      label: 'component.layerList',
      entries: [],
      isSelected: () => cesdk.ui.isPanelOpen('//ly.img.panel/layers'),
      onClick: () => {
        if (cesdk.ui.isPanelOpen('//ly.img.panel/layers')) {
          cesdk.ui.closePanel('//ly.img.panel/layers');
        } else {
          cesdk.ui.openPanel('//ly.img.panel/layers');
        }
      }
    }
  ]);
}

export function setupUI(cesdk: CreativeEditorSDK): void {
  setupPanels(cesdk);
  setupNavigationBar(cesdk);
  setupCanvas(cesdk);
  setupInspectorBar(cesdk);
  setupDock(cesdk);
}
