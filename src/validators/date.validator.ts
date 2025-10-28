import { registerDecorator, ValidationArguments, ValidationOptions } from "class-validator";
import * as dayjs from "dayjs";
import * as utc from "dayjs/plugin/utc";
import * as timezone from "dayjs/plugin/timezone";
import * as isSameOrBefore from "dayjs/plugin/isSameOrBefore";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isSameOrBefore);

export function IsNotFutureDate(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isNotFutureDate',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          if (!value) return true;

          try {
            // Parse the transformed UTC ISO string (already normalized to 08:00 UTC / 12:00 Tbilisi)
            const paymentDate = dayjs.utc(value);

            // Normalize current time to same format: Tbilisi time at 12:00, converted to UTC (08:00)
            const nowNormalized = dayjs()
              .tz('Asia/Tbilisi')
              .hour(12)
              .minute(0)
              .second(0)
              .utc();

            return paymentDate.isBefore(nowNormalized) || paymentDate.isSame(nowNormalized);
          } catch {
            return false;
          }
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} cannot be in the future`;
        },
      },
    });
  };
}

export function IsWithinOneMonth(validationOptions?: ValidationOptions) {
  return function (object: any, propertyName: string) {
    registerDecorator({
      name: 'isWithinOneMonth',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          const date = dayjs.utc(value);
          const oneMonthLater = dayjs().add(1, 'month');
          return date.isBefore(oneMonthLater); // true if date <= one month from now
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be within one month from today`;
        },
      },
    });
  };
}