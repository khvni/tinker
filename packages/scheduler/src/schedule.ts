import { CronExpressionParser } from 'cron-parser';

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
const ALIAS_SET = new Set(['@yearly', '@annually', '@monthly', '@weekly', '@daily', '@hourly', '@weekdays', '@weekends']);
const EVERY_MINUTE_PATTERN = /^(?:\*\s+\*\s+\*\s+\*\s+\*$|0\s+\*\s+\*\s+\*\s+\*\s+\*$|@minutely)$/u;

type ParsedSchedule = {
  expression: string;
  source: 'natural-language' | 'cron';
  label: string;
};

type ParsedClock = {
  hour: number;
  minute: number;
};

const titleCase = (value: string): string => {
  return value
    .split(/\s+/u)
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ');
};

const formatClockLabel = (clock: ParsedClock): string => {
  const value = new Date(2000, 0, 1, clock.hour, clock.minute);
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(value);
};

const parseClock = (input: string): ParsedClock | null => {
  const match = input.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/iu);
  if (!match) {
    return null;
  }

  const hourRaw = Number.parseInt(match[1] ?? '', 10);
  const minuteRaw = match[2] ? Number.parseInt(match[2], 10) : 0;
  const meridiem = match[3]?.toLowerCase();

  if (Number.isNaN(hourRaw) || Number.isNaN(minuteRaw) || minuteRaw < 0 || minuteRaw > 59) {
    return null;
  }

  if (meridiem) {
    if (hourRaw < 1 || hourRaw > 12) {
      return null;
    }

    const normalizedHour = hourRaw % 12 + (meridiem === 'pm' ? 12 : 0);
    return { hour: normalizedHour, minute: minuteRaw };
  }

  if (hourRaw < 0 || hourRaw > 23) {
    return null;
  }

  return { hour: hourRaw, minute: minuteRaw };
};

const normalizeDayName = (input: string): number | null => {
  const normalized = input.trim().toLowerCase();
  const index = DAY_NAMES.findIndex((day) => day === normalized);
  return index >= 0 ? index : null;
};

const tryParseNaturalLanguage = (input: string): ParsedSchedule | null => {
  const normalized = input.trim().toLowerCase().replace(/\s+/gu, ' ');
  if (normalized.length === 0) {
    return null;
  }

  const weekdayMatch = normalized.match(/^(?:every\s+)?weekdays?\s+at\s+(.+)$/u);
  if (weekdayMatch?.[1]) {
    const clock = parseClock(weekdayMatch[1]);
    if (!clock) {
      return null;
    }

    return {
      expression: `${clock.minute} ${clock.hour} * * 1-5`,
      source: 'natural-language',
      label: `Weekdays at ${formatClockLabel(clock)}`,
    };
  }

  const dailyMatch = normalized.match(/^(?:every\s+day|daily|everyday)\s+at\s+(.+)$/u);
  if (dailyMatch?.[1]) {
    const clock = parseClock(dailyMatch[1]);
    if (!clock) {
      return null;
    }

    return {
      expression: `${clock.minute} ${clock.hour} * * *`,
      source: 'natural-language',
      label: `Daily at ${formatClockLabel(clock)}`,
    };
  }

  const weeklyMatch = normalized.match(/^(?:every\s+week\s+on|weekly\s+on|every\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\s+at\s+(.+)$/u);
  if (weeklyMatch?.[1] && weeklyMatch[2]) {
    const day = normalizeDayName(weeklyMatch[1]);
    const clock = parseClock(weeklyMatch[2]);
    if (day === null || !clock) {
      return null;
    }

    return {
      expression: `${clock.minute} ${clock.hour} * * ${day}`,
      source: 'natural-language',
      label: `${titleCase(weeklyMatch[1])} at ${formatClockLabel(clock)}`,
    };
  }

  return null;
};

const normalizeCronExpression = (input: string): string => {
  return input.trim().replace(/\s+/gu, ' ');
};

const toDate = (value: { toISOString(): string | null }): Date => {
  const iso = value.toISOString();
  if (!iso) {
    throw new Error('Cron parser returned a non-ISO date.');
  }

  return new Date(iso);
};

const getNextRunDate = (expression: string, timezone: string, currentDate: Date): Date => {
  return toDate(
    CronExpressionParser.parse(expression, {
      currentDate,
      tz: timezone,
    }).next(),
  );
};

export const getSchedulePreview = (expression: string, timezone: string, currentDate: Date): string => {
  const nextRun = getNextRunDate(expression, timezone, currentDate);
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone,
  }).format(nextRun);
};

const validateScheduleExpression = (expression: string, timezone: string, currentDate: Date): void => {
  if (EVERY_MINUTE_PATTERN.test(expression)) {
    throw new Error('Every-minute schedules are too aggressive for Tinker. Use five minutes or slower.');
  }

  const interval = CronExpressionParser.parse(expression, {
    currentDate,
    tz: timezone,
  });
  const first = toDate(interval.next());
  const second = toDate(interval.next());

  if (second.getTime() - first.getTime() < 60_000) {
    throw new Error('Every-minute schedules are too aggressive for Tinker. Use five minutes or slower.');
  }
};

export const parseScheduleInput = (input: string, timezone: string, currentDate = new Date()): ParsedSchedule => {
  const naturalLanguage = tryParseNaturalLanguage(input);
  if (naturalLanguage) {
    validateScheduleExpression(naturalLanguage.expression, timezone, currentDate);
    return naturalLanguage;
  }

  const normalized = normalizeCronExpression(input);
  if (normalized.length === 0) {
    throw new Error('Schedule cannot be empty.');
  }

  const expression = ALIAS_SET.has(normalized.toLowerCase()) ? normalized.toLowerCase() : normalized;
  validateScheduleExpression(expression, timezone, currentDate);

  return {
    expression,
    source: 'cron',
    label: expression,
  };
};

export const getFutureRunAfter = (expression: string, timezone: string, afterDate: Date): string => {
  return getNextRunDate(expression, timezone, afterDate).toISOString();
};

export const countSkippedRuns = (
  expression: string,
  timezone: string,
  firstScheduledAt: Date,
  now: Date,
): { skippedCount: number; nextRunAt: string } => {
  const interval = CronExpressionParser.parse(expression, {
    currentDate: firstScheduledAt,
    tz: timezone,
  });

  let skippedCount = 1;
  let nextRun = toDate(interval.next());

  while (nextRun.getTime() <= now.getTime()) {
    skippedCount += 1;
    nextRun = toDate(interval.next());
  }

  return {
    skippedCount,
    nextRunAt: nextRun.toISOString(),
  };
};
