import { EmbedBuilder } from "discord.js";
import botConfig from "../config/bot.js";

// ============================================================
// PDYN-BOT — CRT SERVICE
// ============================================================
//
// Supported CRT timeframes:
// 5M, 15M, 30M, 1H, 4H, 1D
//
// Timezone:
// Asia/Manila
//
// This service currently handles:
// - CRT timeframe calculation
// - Daily CRT timeframe
// - Current CRT status
// - Remaining candle time
// - Automatic Discord CRT timeframe alerts
//
// It does NOT yet detect:
// - High / Low
// - Liquidity sweep
// - Reclaim
// - MSS
// - Entry
//
// Those will be added in the next CRT module.
// ============================================================


// ============================================================
// CONFIGURATION
// ============================================================

const CRT_CONFIG = botConfig.crt || {};

const CRT_TIMEZONE =
  CRT_CONFIG.timezone || "Asia/Manila";

const DEFAULT_TIMEFRAME =
  CRT_CONFIG.timeframe || "15m";

const TIMEFRAMES =
  CRT_CONFIG.timeframes || {
    "5m": 5,
    "15m": 15,
    "30m": 30,
    "1h": 60,
    "4h": 240,
    "1d": 1440,
  };

// ============================================================
// TIMEZONE HELPERS
// ============================================================

/**
 * Get date/time components in the CRT timezone.
 *
 * Example:
 *
 * {
 *   year: 2026,
 *   month: 8,
 *   day: 10,
 *   hour: 14,
 *   minute: 30,
 *   second: 15
 * }
 */
function getZonedParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone: CRT_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }
  );

  const parts = formatter.formatToParts(date);

  const result = {};

  for (const part of parts) {
    if (part.type !== "literal") {
      result[part.type] = Number(part.value);
    }
  }

  return result;
}


/**
 * Get current time in CRT timezone.
 */
export function getCRTNow() {
  return getZonedParts(new Date());
}


// ============================================================
// VALIDATION
// ============================================================

/**
 * Check whether a CRT timeframe exists.
 */
export function isValidCRTTimeframe(timeframe) {
  if (!timeframe) {
    return false;
  }

  return Object.prototype.hasOwnProperty.call(
    TIMEFRAMES,
    timeframe.toLowerCase()
  );
}


/**
 * Get all supported CRT timeframes.
 */
export function getAvailableCRTTimeframes() {
  return Object.keys(TIMEFRAMES);
}


// ============================================================
// DATE HELPERS
// ============================================================

function pad(value) {
  return String(value).padStart(2, "0");
}


/**
 * Format YYYY-MM-DD.
 */
function formatDateParts(parts) {
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}


/**
 * Format HH:MM.
 */
function formatTimeParts(hour, minute) {
  return `${pad(hour)}:${pad(minute)}`;
}


/**
 * Format HH:MM:SS.
 */
function formatTimeSeconds(hour, minute, second) {
  return `${pad(hour)}:${pad(minute)}:${pad(second)}`;
}


/**
 * Convert Manila date/time components to a UTC timestamp.
 *
 * Asia/Manila is UTC+8.
 *
 * Example:
 *
 * Manila 00:00
 * = UTC previous day 16:00
 */
function manilaComponentsToTimestamp(
  year,
  month,
  day,
  hour = 0,
  minute = 0,
  second = 0
) {
  return Date.UTC(
    year,
    month - 1,
    day,
    hour - 8,
    minute,
    second
  );
}


/**
 * Get the next calendar day.
 */
function getNextDay(year, month, day) {
  const date = new Date(
    Date.UTC(
      year,
      month - 1,
      day
    )
  );

  date.setUTCDate(
    date.getUTCDate() + 1
  );

  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}


// ============================================================
// CRT TIMEFRAME CALCULATION
// ============================================================

/**
 * Calculate the current CRT candle.
 *
 * Examples:
 *
 * 15M:
 * 10:00 → 10:15
 * 10:15 → 10:30
 *
 * 1H:
 * 10:00 → 11:00
 *
 * 4H:
 * 08:00 → 12:00
 *
 * 1D:
 * 00:00 → 00:00 next day
 */
export function getCurrentCRT(
  timeframe = DEFAULT_TIMEFRAME
) {
  timeframe = String(timeframe).toLowerCase();

  if (!isValidCRTTimeframe(timeframe)) {
    throw new Error(
      `Invalid CRT timeframe "${timeframe}". ` +
      `Available: ${getAvailableCRTTimeframes().join(", ")}`
    );
  }

  const minutes =
    TIMEFRAMES[timeframe];

  const now =
    getCRTNow();

  // ==========================================================
  // DAILY CRT
  // ==========================================================

  if (timeframe === "1d") {
    const nextDay =
      getNextDay(
        now.year,
        now.month,
        now.day
      );

    const startTimestamp =
      manilaComponentsToTimestamp(
        now.year,
        now.month,
        now.day,
        0,
        0,
        0
      );

    const endTimestamp =
      manilaComponentsToTimestamp(
        nextDay.year,
        nextDay.month,
        nextDay.day,
        0,
        0,
        0
      );

    return {
      timeframe: "1d",
      label: "DAILY",
      date: formatDateParts(now),

      startHour: 0,
      startMinute: 0,

      endHour: 0,
      endMinute: 0,

      startTime: "00:00",
      endTime: "00:00",

      startTimestamp,
      endTimestamp,

      timezone: CRT_TIMEZONE,
    };
  }


  // ==========================================================
  // INTRADAY CRT
  // ==========================================================

  const totalMinutes =
    now.hour * 60 +
    now.minute;

  const candleStartMinutes =
    Math.floor(
      totalMinutes / minutes
    ) * minutes;

  const startHour =
    Math.floor(
      candleStartMinutes / 60
    );

  const startMinute =
    candleStartMinutes % 60;


  const endTotalMinutes =
    candleStartMinutes + minutes;


  const endHour =
    Math.floor(
      endTotalMinutes / 60
    ) % 24;

  const endMinute =
    endTotalMinutes % 60;


  let endYear = now.year;
  let endMonth = now.month;
  let endDay = now.day;


  // Candle crosses midnight.
  if (endTotalMinutes >= 1440) {
    const nextDay =
      getNextDay(
        now.year,
        now.month,
        now.day
      );

    endYear = nextDay.year;
    endMonth = nextDay.month;
    endDay = nextDay.day;
  }


  const startTimestamp =
    manilaComponentsToTimestamp(
      now.year,
      now.month,
      now.day,
      startHour,
      startMinute,
      0
    );


  const endTimestamp =
    manilaComponentsToTimestamp(
      endYear,
      endMonth,
      endDay,
      endHour,
      endMinute,
      0
    );


  return {
    timeframe,

    label:
      timeframe.toUpperCase(),

    date:
      formatDateParts(now),

    startHour,
    startMinute,

    endHour,
    endMinute,

    startTime:
      formatTimeParts(
        startHour,
        startMinute
      ),

    endTime:
      formatTimeParts(
        endHour,
        endMinute
      ),

    startTimestamp,
    endTimestamp,

    timezone: CRT_TIMEZONE,
  };
}


// ============================================================
// REMAINING TIME
// ============================================================

/**
 * Get remaining time before the current CRT candle closes.
 *
 * Returns:
 *
 * HH:MM:SS
 */
export function getRemainingTime(
  timeframe = DEFAULT_TIMEFRAME
) {
  const crt =
    getCurrentCRT(timeframe);

  const now =
    Date.now();

  let remaining =
    crt.endTimestamp - now;

  if (remaining < 0) {
    remaining = 0;
  }

  const totalSeconds =
    Math.floor(
      remaining / 1000
    );

  const hours =
    Math.floor(
      totalSeconds / 3600
    );

  const minutes =
    Math.floor(
      (totalSeconds % 3600) / 60
    );

  const seconds =
    totalSeconds % 60;


  return [
    pad(hours),
    pad(minutes),
    pad(seconds),
  ].join(":");
}


// ============================================================
// CRT STATUS
// ============================================================

/**
 * Get complete CRT status.
 */
export function getCRTStatus(
  timeframe = DEFAULT_TIMEFRAME
) {
  const crt =
    getCurrentCRT(timeframe);

  const now =
    getCRTNow();

  return {
    timeframe: crt.timeframe,

    label: crt.label,

    date: crt.date,

    timezone: crt.timezone,

    currentTime:
      formatTimeSeconds(
        now.hour,
        now.minute,
        now.second
      ),

    start:
      crt.startTime,

    end:
      crt.endTime,

    remaining:
      getRemainingTime(timeframe),

    startTimestamp:
      crt.startTimestamp,

    endTimestamp:
      crt.endTimestamp,
  };
}


// ============================================================
// CRT EMBED
// ============================================================

/**
 * Create a Discord embed showing the current CRT timeframe.
 */
export function createCRTEmbed(
  timeframe = DEFAULT_TIMEFRAME
) {
  const status =
    getCRTStatus(timeframe);


  const embed =
    new EmbedBuilder()

      .setTitle("📊 CRT TIMEFRAME")

      .setDescription(
        `**${status.label} CRT Candle Active**`
      )

      .addFields(
        {
          name: "⏱️ Timeframe",
          value:
            `\`${status.label}\``,
          inline: true,
        },

        {
          name: "🟢 Start",
          value:
            `\`${status.start}\``,
          inline: true,
        },

        {
          name: "🔴 End",
          value:
            `\`${status.end}\``,
          inline: true,
        },

        {
          name: "⏳ Remaining",
          value:
            `\`${status.remaining}\``,
          inline: true,
        },

        {
          name: "🕐 Current Time",
          value:
            `\`${status.currentTime}\``,
          inline: true,
        },

        {
          name: "🌏 Timezone",
          value:
            `\`${status.timezone}\``,
          inline: true,
        },

        {
          name: "📅 Date",
          value:
            `\`${status.date}\``,
          inline: true,
        },

        {
          name: "📡 Status",
          value:
            "`ACTIVE`",
          inline: true,
        }
      )

      .setColor(
        CRT_CONFIG.color ||
        "#5865F2"
      )

      .setFooter({
        text:
          CRT_CONFIG.footer ||
          "CRT • PDYN",
      });

  return embed;
}


// ============================================================
// AUTOMATIC CRT MONITOR
// ============================================================

let crtMonitorStarted = false;


/**
 * Start automatic CRT timeframe monitoring.
 *
 * Sends one Discord message whenever a new CRT candle begins.
 */
export function startCRTMonitor(client) {

  if (crtMonitorStarted) {
    console.warn(
      "[CRT] Monitor is already running."
    );

    return;
  }


  // Check whether CRT is enabled.
  if (CRT_CONFIG.enabled === false) {

    console.log(
      "[CRT] CRT system is disabled."
    );

    return;
  }


  // Check whether automatic alerts are enabled.
  if (CRT_CONFIG.autoAlerts === false) {

    console.log(
      "[CRT] Automatic CRT alerts are disabled."
    );

    return;
  }


  const channelId =
    CRT_CONFIG.channelId;


  if (!channelId) {

    console.warn(
      "[CRT] CRT_CHANNEL_ID is not configured."
    );

    console.warn(
      "[CRT] Automatic CRT alerts will not start."
    );

    return;
  }


  const timeframe =
    DEFAULT_TIMEFRAME;


  const interval =
    Number(
      CRT_CONFIG.checkInterval || 5000
    );


  crtMonitorStarted = true;


  console.log(
    `[CRT] Monitor started.`
  );

  console.log(
    `[CRT] Timeframe: ${timeframe}`
  );

  console.log(
    `[CRT] Timezone: ${CRT_TIMEZONE}`
  );

  console.log(
    `[CRT] Channel: ${channelId}`
  );


  let previousCandleKey = null;


  const checkCRT = async () => {

    try {

      const crt =
        getCurrentCRT(timeframe);


      const candleKey =
        `${crt.date}_${crt.startTime}`;


      // Nothing changed.
      if (
        candleKey ===
        previousCandleKey
      ) {
        return;
      }


      previousCandleKey =
        candleKey;


      const channel =
        await client.channels.fetch(
          channelId
        );


      if (!channel) {

        console.warn(
          `[CRT] Channel ${channelId} not found.`
        );

        return;
      }


      const embed =
        createCRTEmbed(timeframe);


      await channel.send({
        content:
          "🔔 **NEW CRT CANDLE**",

        embeds: [
          embed
        ],
      });


      console.log(
        `[CRT] Alert sent: ${candleKey}`
      );


    } catch (error) {

      console.error(
        "[CRT] Monitor error:",
        error
      );

    }
  };


  // Check immediately.
  checkCRT();


  // Continue checking.
  setInterval(
    checkCRT,
    interval
  );
}


// ============================================================
// DEBUG / TEST
// ============================================================

/**
 * Get all CRT timeframe statuses.
 *
 * Useful for testing.
 */
export function getAllCRTStatuses() {

  const statuses = {};

  for (
    const timeframe
    of Object.keys(TIMEFRAMES)
  ) {

    statuses[timeframe] =
      getCRTStatus(timeframe);
  }

  return statuses;
}


// ============================================================
// STARTUP LOG
// ============================================================

console.log(
  `[CRT] Service loaded.`
);

console.log(
  `[CRT] Timezone: ${CRT_TIMEZONE}`
);

console.log(
  `[CRT] Timeframes: ${
    getAvailableCRTTimeframes().join(", ")
  }`
);
