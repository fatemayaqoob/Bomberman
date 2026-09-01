export const HAT_IDS = ["none", "hat", "crown", "frost", "santa"];

export const HAT_DETAILS = {
    none: { label: "NO HAT", asset: null },
    hat: { label: "HAT", asset: "/static/assets/player/hat.png" },
    crown: { label: "CROWN", asset: "/static/assets/player/crown.png" },
    frost: { label: "FROST", asset: "/static/assets/player/frost.png" },
    santa: { label: "SANTA", asset: "/static/assets/player/santa.png" }
};

// Asset-specific sizing/vertical corrections, layered on top of each frame entry below.
const HAT_ASSET_ADJUSTMENTS = {
    hat: { top: "0%", width: "58%" },
    crown: { top: "3%", width: "48%" },
    frost: { top: "-8%", width: "64%" },
    santa: { top: "-2%", width: "66%" }
};

// Each character frame can shift the head a little. Keep cosmetic corrections here,
// separate from the finished player animation renderer.
const DEFAULT_OFFSET = { top: "5%", left: "50%", width: "58%" };
export const HAT_FRAME_OFFSETS = Object.fromEntries(HAT_IDS.map((hat) => [hat, {
    "standing:front:1": DEFAULT_OFFSET,
    "standing:front:2": { top: "4%", left: "50%", width: "58%" },
    "standing:back:1": { top: "4%", left: "50%", width: "56%" },
    "standing:back:2": { top: "3%", left: "50%", width: "56%" },
    "standing:left:1": { top: "5%", left: "48%", width: "56%" },
    "standing:left:2": { top: "4%", left: "48%", width: "56%" },
    "standing:right:1": { top: "5%", left: "52%", width: "56%" },
    "standing:right:2": { top: "4%", left: "52%", width: "56%" },
    "walking:front:1": { top: "4%", left: "50%", width: "58%" },
    "walking:front:2": { top: "2%", left: "50%", width: "58%" },
    "walking:back:1": { top: "3%", left: "50%", width: "56%" },
    "walking:back:2": { top: "1%", left: "50%", width: "56%" },
    "walking:left:1": { top: "4%", left: "48%", width: "56%" },
    "walking:left:2": { top: "2%", left: "48%", width: "56%" },
    "walking:right:1": { top: "4%", left: "52%", width: "56%" },
    "walking:right:2": { top: "2%", left: "52%", width: "56%" }
}])) ;

export function getHatOffset(hat, player) {
    const animation = player.animation === "walking" ? "walking" : "standing";
    const direction = ["front", "back", "left", "right"].includes(player.direction) ? player.direction : "front";
    const frame = player.frame === 2 ? 2 : 1;
    const frameOffset = HAT_FRAME_OFFSETS[hat]?.[`${animation}:${direction}:${frame}`] ?? DEFAULT_OFFSET;
    const assetAdjustment = HAT_ASSET_ADJUSTMENTS[hat] ?? HAT_ASSET_ADJUSTMENTS.hat;
    return {
        ...frameOffset,
        top: `calc(${frameOffset.top} + ${assetAdjustment.top})`,
        width: assetAdjustment.width
    };
}
