export function startGameLoop({ update, render, onFps } = {}) {
    let frameId = null;
    let running = true;
    let previousTime = performance.now();
    let fpsFrameCount = 0;
    let fpsWindowStart = previousTime;

    function frame(now) {
        if (!running) {
            return;
        }

        const deltaTime = Math.min((now - previousTime) / 1000, 0.1);
        previousTime = now;

        update?.(deltaTime);
        render?.(deltaTime);
        fpsFrameCount += 1;

        if (now - fpsWindowStart >= 1000) {
            onFps?.(Math.round(fpsFrameCount / ((now - fpsWindowStart) / 1000)));
            fpsFrameCount = 0;
            fpsWindowStart = now;
        }

        // TODO: Add frame-drop telemetry if the 60 FPS requirement needs reporting.
        frameId = window.requestAnimationFrame(frame);
    }

    frameId = window.requestAnimationFrame(frame);

    return function stopGameLoop() {
        running = false;
        if (frameId !== null) {
            window.cancelAnimationFrame(frameId);
        }
    };
}
