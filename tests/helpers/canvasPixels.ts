import type { Locator } from "@playwright/test";

export async function countWarmYellowPixels(vectorCanvas: Locator): Promise<number> {
  return vectorCanvas.evaluate((canvas) => {
    const target = canvas as HTMLCanvasElement;
    const context = target.getContext("2d");

    if (!context) {
      return 0;
    }

    const { data } = context.getImageData(0, 0, target.width, target.height);
    let matchingPixels = 0;

    for (let index = 0; index < data.length; index += 4) {
      const red = data[index] ?? 0;
      const green = data[index + 1] ?? 0;
      const blue = data[index + 2] ?? 0;
      const alpha = data[index + 3] ?? 0;

      if (red > 220 && green > 150 && green < 235 && blue < 120 && alpha > 180) {
        matchingPixels += 1;
      }
    }

    return matchingPixels;
  });
}



export async function countTealPixels(vectorCanvas: Locator): Promise<number> {
  return vectorCanvas.evaluate((canvas) => {
    const target = canvas as HTMLCanvasElement;
    const context = target.getContext("2d");

    if (!context) {
      return 0;
    }

    const { data } = context.getImageData(0, 0, target.width, target.height);
    let matchingPixels = 0;

    for (let index = 0; index < data.length; index += 4) {
      const red = data[index] ?? 0;
      const green = data[index + 1] ?? 0;
      const blue = data[index + 2] ?? 0;
      const alpha = data[index + 3] ?? 0;

      if (red > 60 && red < 130 && green > 160 && blue > 160 && alpha > 120) {
        matchingPixels += 1;
      }
    }

    return matchingPixels;
  });
}
