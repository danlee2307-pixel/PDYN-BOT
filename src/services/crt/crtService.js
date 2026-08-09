import { EmbedBuilder } from "discord.js";
import botConfig from "../../config/bot.js";

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
// Features:
// - CRT timeframe calculation
// - Daily CRT timeframe
// - Current CRT status
// - Remaining candle time
// - Automatic Discord alerts
// - Separate Discord channel for each timeframe
//
// IMPORTANT:
// The monitor waits for a NEW candle before sending an alert.
// Restarting Railway will NOT send an alert for the currently
// active candle.
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

const CHANNELS =
  CRT_CONFIG.channels || {};


// ============================================================
// TIMEZONE HELPERS
// ============================================================

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

  const parts =
    formatter.formatToParts(date);

  const result = {};

  for (const part of parts) {
    if (part.type !== "literal") {
      result[part.type] =
        Number(part.value);
    }
  }

  return result;
}


// ============================================================
// CURRENT TIME
// ============================================================

export function getCRTNow() {
  return getZonedParts(new Date());
}


// ============================================================
// VALIDATION
// ============================================================

export function isValidCRTTimeframe(timeframe) {
  if (!timeframe) {
    return false;
  }

  return Object.prototype.hasOwnProperty.call(
    TIMEFRAMES,
    String(timeframe).toLowerCase()
  );
}


export function getAvailableCRTTimeframes() {
  return Object.keys(TIMEFRAMES);
}


// ============================================================
// DATE HELPERS
// ============================================================

function pad(value) {
  return String(value).padStart(2, "0");
}


function formatDateParts(parts) {
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}


function formatTimeParts(hour, minute) {
  return `${pad(hour)}:${pad(minute)}`;
}


function formatTimeSeconds(
  hour,
  minute,
  second
) {
  return `${pad(hour)}:${pad(minute)}:${pad(second)}`;
}


// ============================================================
// MANILA → UTC
// ============================================================

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


// ============================================================
// NEXT DAY
// ============================================================

function getNextDay(
  year,
  month,
  day
) {
  const date =
    new Date(
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
    year:
      date.getUTCFullYear(),

    month:
      date.getUTCMonth() + 1,

    day:
      date.getUTCDate(),
  };
}


// ============================================================
// CURRENT CRT CANDLE
// ============================================================

export function getCurrentCRT(
  timeframe = DEFAULT_TIMEFRAME
) {
  timeframe =
    String(timeframe).toLowerCase();

  if (!isValidCRTTimeframe(timeframe)) {
    throw new Error(
      `Invalid CRT timeframe "${timeframe}". ` +
      `Available: ${
        getAvailableCRTTimeframes().join(", ")
      }`
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

      date:
        formatDateParts(now),

      startHour: 0,
      startMinute: 0,

      endHour: 0,
      endMinute: 0,

      startTime: "00:00",
      endTime: "00:00",

      startTimestamp,
      endTimestamp,

      timezone:
        CRT_TIMEZONE,
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

  let endYear =
    now.year;

  let endMonth =
    now.month;

  let endDay =
    now.day;


  if (endTotalMinutes >= 1440) {
    const nextDay =
      getNextDay(
        now.year,
        now.month,
        now.day
      );

    endYear =
      nextDay.year;

    endMonth =
      nextDay.month;

    endDay =
      nextDay.day;
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

    timezone:
      CRT_TIMEZONE,
  };
}


// ============================================================
// REMAINING TIME
// ============================================================

export function getRemainingTime(
  timeframe = DEFAULT_TIMEFRAME
) {
  const crt =
    getCurrentCRT(timeframe);

  let remaining =
    crt.endTimestamp -
    Date.now();

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

export function getCRTStatus(
  timeframe = DEFAULT_TIMEFRAME
) {
  const crt =
    getCurrentCRT(timeframe);

  const now =
    getCRTNow();

  return {
    timeframe:
      crt.timeframe,

    label:
      crt.label,

    date:
      crt.date,

    timezone:
      crt.timezone,

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

export function createCRTEmbed(
  timeframe = DEFAULT_TIMEFRAME
) {
  const status =
    getCRTStatus(timeframe);

  return new EmbedBuilder()

    .setTitle(
      "📊 CRT TIMEFRAME"
    )

    .setDescription(
      `**${status.label} CRT Candle Started**`
    )

    .addFields(
      {
        name:
          "⏱️ Timeframe",

        value:
          `\`${status.label}\``,

        inline: true,
      },

      {
        name:
          "🟢 Start",

        value:
          `\`${status.start}\``,

        inline: true,
      },

      {
        name:
          "🔴 End",

        value:
          `\`${status.end}\``,

        inline: true,
      },

      {
        name:
          "⏳ Remaining",

        value:
          `\`${status.remaining}\``,

        inline: true,
      },

      {
        name:
          "🕐 Current Time",

        value:
          `\`${status.currentTime}\``,

        inline: true,
      },

      {
        name:
          "🌏 Timezone",

        value:
          `\`${status.timezone}\``,

        inline: true,
      },

      {
        name:
          "📅 Date",

        value:
          `\`${status.date}\``,

        inline: true,
      },

      {
        name:
          "📡 Status",

        value:
          "`NEW CANDLE`",

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
    })

    .setTimestamp();
}


// ============================================================
// TIMEFRAME LABEL
// ============================================================

function getTimeframeLabel(
  timeframe
) {
  const labels = {
    "5m": "5 MINUTES",
    "15m": "15 MINUTES",
    "30m": "30 MINUTES",
    "1h": "1 HOUR",
    "4h": "4 HOURS",
    "1d": "DAILY",
  };

  return (
    labels[timeframe] ||
    timeframe.toUpperCase()
  );
}


// ============================================================
// SEND CRT ALERT
// ============================================================

async function sendCRTAlert(
  client,
  timeframe
) {
  try {

    const channelId =
      CHANNELS[timeframe];


    if (!channelId) {
      console.warn(
        `[CRT] No channel configured for ${timeframe}.`
      );

      return;
    }


    const channel =
      await client.channels.fetch(
        channelId
      );


    if (!channel) {
      console.warn(
        `[CRT] Channel not found for ${timeframe}: ${channelId}`
      );

      return;
    }


    const embed =
      createCRTEmbed(timeframe);


    await channel.send({
      content:
        `🔔 **NEW ${getTimeframeLabel(
          timeframe
        )} CRT CANDLE**`,

      embeds: [
        embed
      ],
    });


    console.log(
      `[CRT] ${timeframe} alert sent to channel ${channelId}`
    );

  } catch (error) {

    console.error(
      `[CRT] Failed to send ${timeframe} alert:`,
      error
    );
  }
}


// ============================================================
// AUTOMATIC CRT MONITOR
// ============================================================

let crtMonitorStarted =
  false;


export function startCRTMonitor(
  client
) {

  if (crtMonitorStarted) {
    console.warn(
      "[CRT] Monitor is already running."
    );

    return;
  }


  if (
    CRT_CONFIG.enabled === false
  ) {
    console.log(
      "[CRT] CRT system is disabled."
    );

    return;
  }


  if (
    CRT_CONFIG.autoAlerts === false
  ) {
    console.log(
      "[CRT] Automatic CRT alerts are disabled."
    );

    return;
  }


  const interval =
    Number(
      CRT_CONFIG.checkInterval ||
      5000
    );


  const timeframes =
    Object.keys(TIMEFRAMES);


  crtMonitorStarted =
    true;


  console.log(
    "[CRT] Monitor started."
  );

  console.log(
    `[CRT] Timezone: ${CRT_TIMEZONE}`
  );

  console.log(
    `[CRT] Timeframes: ${
      timeframes.join(", ")
    }`
  );


  // ==========================================================
  // SHOW CHANNEL CONFIGURATION
  // ==========================================================

  for (
    const timeframe
    of timeframes
  ) {

    const channelId =
      CHANNELS[timeframe];

    console.log(
      `[CRT] ${timeframe} → ${
        channelId ||
        "NOT CONFIGURED"
      }`
    );
  }


  // ==========================================================
  // TRACK LAST CANDLE
  // ==========================================================

  const previousCandleKeys =
    new Map();


  // ==========================================================
  // IMPORTANT:
  //
  // On startup we establish the CURRENT candle as the
  // baseline.
  //
  // We DO NOT send an alert for it.
  //
  // This prevents Railway restarts from creating duplicate
  // alerts.
  // ==========================================================

  for (
    const timeframe
    of timeframes
  ) {

    try {

      const current =
        getCurrentCRT(
          timeframe
        );

      const candleKey =
        `${timeframe}_${current.startTimestamp}`;

      previousCandleKeys.set(
        timeframe,
        candleKey
      );

      console.log(
        `[CRT] ${timeframe} current candle registered: ${candleKey}`
      );

    } catch (error) {

      console.error(
        `[CRT] Failed to initialize ${timeframe}:`,
        error
      );
    }
  }


  // ==========================================================
  // CHECK ALL TIMEFRAMES
  // ==========================================================

  const checkCRT =
    async () => {

      for (
        const timeframe
        of timeframes
      ) {

        try {

          const crt =
            getCurrentCRT(
              timeframe
            );


          const candleKey =
            `${timeframe}_${crt.startTimestamp}`;


          const previous =
            previousCandleKeys.get(
              timeframe
            );


          // ====================================================
          // SAME CANDLE
          // ====================================================

          if (
            previous ===
            candleKey
          ) {
            continue;
          }


          // ====================================================
          // NEW CANDLE
          // ====================================================

          previousCandleKeys.set(
            timeframe,
            candleKey
          );


          console.log(
            `[CRT] NEW ${timeframe} CANDLE DETECTED`
          );


          await sendCRTAlert(
            client,
            timeframe
          );


        } catch (error) {

          console.error(
            `[CRT] Error checking ${timeframe}:`,
            error
          );
        }
      }
    };


  // ==========================================================
  // CONTINUE MONITORING
  // ==========================================================

  setInterval(
    checkCRT,
    interval
  );
}


// ============================================================
// ALL CRT STATUSES
// ============================================================

export function getAllCRTStatuses() {

  const statuses = {};

  for (
    const timeframe
    of Object.keys(TIMEFRAMES)
  ) {

    statuses[timeframe] =
      getCRTStatus(
        timeframe
      );
  }

  return statuses;
}


// ============================================================
// STARTUP LOG
// ============================================================

console.log(
  "[CRT] Service loaded."
);

console.log(
  `[CRT] Timezone: ${CRT_TIMEZONE}`
);

console.log(
  `[CRT] Timeframes: ${
    getAvailableCRTTimeframes().join(", ")
  }`
);