import type { Locator } from "@playwright/test";

type ChannelRange = {
  min?: number;
  max?: number;
};

type PixelRange = {
  red?: ChannelRange;
  green?: ChannelRange;
  blue?: ChannelRange;
  alpha?: ChannelRange;
};

export async function countPixelsInRange(
  vectorCanvas: Locator,
  ranges: PixelRange,
): Promise<number> {
  return vectorCanvas.evaluate((canvas, rangeInput) => {
    const target = canvas as HTMLCanvasElement;
    const context = target.getContext("2d");

    if (!context) {
      return 0;
    }

    const { data } = context.getImageData(0, 0, target.width, target.height);
    let matchingPixels = 0;
    const isInRange = (value: number, range?: ChannelRange): boolean =>
      (!range || range.min === undefined || value > range.min) &&
      (!range || range.max === undefined || value < range.max);

    for (let index = 0; index < data.length; index += 4) {
      const red = data[index] ?? 0;
      const green = data[index + 1] ?? 0;
      const blue = data[index + 2] ?? 0;
      const alpha = data[index + 3] ?? 0;

      if (
        isInRange(red, rangeInput.red) &&
        isInRange(green, rangeInput.green) &&
        isInRange(blue, rangeInput.blue) &&
        isInRange(alpha, rangeInput.alpha)
      ) {
        matchingPixels += 1;
      }
    }

    return matchingPixels;
  }, ranges);
}

export async function countWarmYellowPixels(vectorCanvas: Locator): Promise<number> {
  return countPixelsInRange(vectorCanvas, {
    red: { min: 220 },
    green: { min: 150, max: 235 },
    blue: { max: 120 },
    alpha: { min: 180 },
  });
}

export async function countTealPixels(vectorCanvas: Locator): Promise<number> {
  return countPixelsInRange(vectorCanvas, {
    red: { min: 60, max: 130 },
    green: { min: 160 },
    blue: { min: 160 },
    alpha: { min: 120 },
  });
}
