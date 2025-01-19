import { chromium } from 'playwright-core';

const DEVICE_TYPES = {
  DESKTOP: 'desktop',
  TABLET: 'tablet',
  MOBILE: 'mobile',
};

const deviceConfigs = {
  desktop: {
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
  },
  tablet: {
    viewport: { width: 1024, height: 768 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  },
  mobile: {
    iphone: {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_4 like Mac OS X)',
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
    },
    android: {
      userAgent: 'Mozilla/5.0 (Linux; Android 12; Pixel 6)',
      viewport: { width: 393, height: 851 },
      deviceScaleFactor: 2.75,
      isMobile: true,
      hasTouch: true,
    },
  },
};

async function randomizeBrowser() {
  // Only use Chromium for Browserbase
  const browserType = chromium;

  // Random device type selection
  const deviceTypes = Object.values(DEVICE_TYPES);
  const randomDeviceType = deviceTypes[Math.floor(Math.random() * deviceTypes.length)];

  let deviceConfig;

  if (randomDeviceType === DEVICE_TYPES.MOBILE) {
    const mobileTypes = ['iphone', 'android'];
    const randomMobileType = mobileTypes[Math.floor(Math.random() * mobileTypes.length)];
    deviceConfig = deviceConfigs.mobile[randomMobileType];
  } else {
    deviceConfig = deviceConfigs[randomDeviceType];
  }

  return {
    browserType: 'chromium',
    deviceType: randomDeviceType,
    deviceConfig,
  };
}

export { randomizeBrowser, DEVICE_TYPES };
