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

        // long tab-switch pauses so a later update cannot simulate a huge jump
        const deltaTime = Math.min((now - previousTime) / 1000, 0.1);
        previousTime = now;

        update?.(deltaTime);
        render?.(deltaTime);

        fpsFrameCount += 1;

        if (now - fpsWindowStart >= 1000) {
            const elapsedSeconds = (now - fpsWindowStart) / 1000;
            onFps?.(Math.round(fpsFrameCount / elapsedSeconds));

            fpsFrameCount = 0;
            fpsWindowStart = now;
        }

        // TODO: add telemetry here for no frame drops needs performance reporting.
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