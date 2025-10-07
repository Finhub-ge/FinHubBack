import * as dayjs from "dayjs";
import * as utc from "dayjs/plugin/utc";
import * as timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

const TIMEZONE = process.env.APP_TIMEZONE || 'UTC';

export const getStartOfDay = (date: Date | string): Date => {
  return dayjs(date).tz(TIMEZONE).startOf('day').toDate();
}

export const getTodayAtMidnight = (): Date => {
  return dayjs().tz(TIMEZONE).startOf('day').toDate();
}

export const subtractDays = (date: Date | string, days: number): Date => {
  return dayjs(date).tz(TIMEZONE).startOf('day').subtract(days, 'day').toDate();
}

export const addDays = (date: Date | string, days: number): Date => {
  return dayjs(date).tz(TIMEZONE).startOf('day').add(days, 'day').toDate();
}

export const getDateOnlyString = (date: Date | string): string => {
  return dayjs(date).tz(TIMEZONE).format('YYYY-MM-DD');
}

export const getTodayString = (): string => {
  return dayjs().tz(TIMEZONE).format('YYYY-MM-DD');
}

export const daysBetween = (date1: Date | string, date2: Date | string): number => {
  const d1 = dayjs(date1).tz(TIMEZONE).startOf('day');
  const d2 = dayjs(date2).tz(TIMEZONE).startOf('day');
  return d2.diff(d1, 'day');
}

export const isSameDay = (date1: Date | string, date2: Date | string): boolean => {
  return getDateOnlyString(date1) === getDateOnlyString(date2);
}

export const isBeforeDay = (date1: Date | string, date2: Date | string): boolean => {
  return dayjs(date1).tz(TIMEZONE).startOf('day')
    .isBefore(dayjs(date2).tz(TIMEZONE).startOf('day'));
}

export const isAfterDay = (date1: Date | string, date2: Date | string): boolean => {
  return dayjs(date1).tz(TIMEZONE).startOf('day')
    .isAfter(dayjs(date2).tz(TIMEZONE).startOf('day'));
}


export const formatDate = (date: Date | string, format: string = 'YYYY-MM-DD HH:mm:ss'): string => {
  return dayjs(date).tz(TIMEZONE).format(format);
}

export const formatDateTime = (date: Date | string): string => {
  return dayjs(date).tz(TIMEZONE).format('YYYY-MM-DD HH:mm:ss');
}

export const getTimezone = (): string => {
  return TIMEZONE;
}