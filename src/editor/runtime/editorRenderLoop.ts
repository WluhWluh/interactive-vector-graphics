export type EditorRenderLoopCallbacks = {
  updateTimelinePlayback: (deltaSeconds: number) => void;
  renderPreviewFrame: () => void;
};

export type EditorRenderLoop = {
  start: () => void;
};

export function createEditorRenderLoop(
  callbacks: EditorRenderLoopCallbacks,
): EditorRenderLoop {
  let lastFrameTime = performance.now();

  const tick = (now: DOMHighResTimeStamp): void => {
    const deltaSeconds = Math.min((now - lastFrameTime) / 1000, 0.05);
    lastFrameTime = now;

    callbacks.updateTimelinePlayback(deltaSeconds);
    callbacks.renderPreviewFrame();
    requestAnimationFrame(tick);
  };

  return {
    start: () => {
      requestAnimationFrame(tick);
    },
  };
}
