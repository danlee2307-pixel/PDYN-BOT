// ==========================================
// PDYN CRT SERVICE
// ==========================================

// Philippine Time
const CRT_TIMEZONE = "Asia/Manila";

// Supported CRT timeframes
export const CRT_TIMEFRAMES = {
  "5m": 5,
  "15m": 15,
  "30m": 30,
  "1h": 60,
  "4h": 240,
  "1d": 1440, // Daily CRT
};

// Default CRT timeframe
export const DEFAULT_CRT_TIMEFRAME = "15m";

/**
 * Get the current time in the CRT timezone.
 */
export function getCRTNow() {
  return new Date(
    new Date().toLocaleString("en-US", {
      timeZone: CRT_TIMEZONE,
    })
  );
}

/**
 * Get the current CRT candle.
 *
 * Example 15M:
 *
 * 10:00 → 10:15
 * 10:15 → 10:30
 * 10:30 → 10:45
 *
 * Daily:
 *
 * 00:00 → 00:00 next day
 */
export function getCurrentCRT(timeframe = DEFAULT_CRT_TIMEFRAME) {
  const minutes = CRT_TIMEFRAMES[timeframe];

  if (!minutes) {
    throw new Error(
      `Invalid CRT timeframe: ${timeframe}`
    );
  }

  const now = getCRTNow();

  // ==========================================
  // DAILY CRT
  // ==========================================

  if (timeframe === "1d") {
    const start = new Date(now);

    start.setHours(0, 0, 0, 0);

    const end = new Date(start);

    end.setDate(end.getDate() + 1);

    return {
      timeframe: "1d",
      label: "DAILY",
      start,
      end,
      startTime: formatTime(start),
      endTime: formatTime(end),
      date: formatDate(start),
      timezone: CRT_TIMEZONE,
    };
  }

  // ==========================================
  // INTRADAY CRT
  // ==========================================

  const totalMinutes =
    now.getHours() * 60 +
    now.getMinutes();

  const candleStartMinutes =
    Math.floor(totalMinutes / minutes) * minutes;

  const start = new Date(now);

  start.setHours(
    Math.floor(candleStartMinutes / 60),
    candleStartMinutes % 60,
    0,
    0
  );

  const end = new Date(start);

  end.setMinutes(
    end.getMinutes() + minutes
  );

  return {
    timeframe,
    label: timeframe.toUpperCase(),
    start,
    end,
    startTime: formatTime(start),
    endTime: formatTime(end),
    date: formatDate(start),
    timezone: CRT_TIMEZONE,
  };
}

/**
 * Format time as HH:MM.
 */
export function formatTime(date) {
  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/**
 * Format date as YYYY-MM-DD.
 */
export function formatDate(date) {
  return date.toLocaleDateString("en-CA");
}

/**
 * Get remaining time in the current CRT candle.
 */
export function getRemainingTime(timeframe = DEFAULT_CRT_TIMEFRAME) {
  const crt = getCurrentCRT(timeframe);

  const now = getCRTNow();

  const remaining =
    crt.end.getTime() - now.getTime();

  if (remaining <= 0) {
    return "00:00:00";
  }

  const totalSeconds =
    Math.floor(remaining / 1000);

  const hours =
    Math.floor(totalSeconds / 3600);

  const minutes =
    Math.floor(
      (totalSeconds % 3600) / 60
    );

  const seconds =
    totalSeconds % 60;

  return [
    String(hours).padStart(2, "0"),
    String(minutes).padStart(2, "0"),
    String(seconds).padStart(2, "0"),
  ].join(":");
}

/**
 * Get a complete CRT status.
 */
export function getCRTStatus(
  timeframe = DEFAULT_CRT_TIMEFRAME
) {
  const crt =
    getCurrentCRT(timeframe);

  return {
    timeframe: crt.timeframe,
    label: crt.label,
    date: crt.date,
    start: crt.startTime,
    end: crt.endTime,
    remaining:
      getRemainingTime(timeframe),
    timezone: crt.timezone,
  };
}

/**
 * Check if a timeframe is supported.
 */
export function isValidCRTTimeframe(timeframe) {
  return Boolean(
    CRT_TIMEFRAMES[timeframe]
  );
}

/**
 * Get all available CRT timeframes.
 */
export function getAvailableCRTTimeframes() {
  return Object.keys(
    CRT_TIMEFRAMES
  );
}
