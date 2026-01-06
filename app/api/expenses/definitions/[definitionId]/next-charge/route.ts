import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

interface RouteParams {
  params: Promise<{
    definitionId: string;
  }>;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function addWeeks(date: Date, weeks: number): Date {
  return addDays(date, weeks * 7);
}

function lastDayOfMonth(year: number, monthIndex0: number): number {
  return new Date(year, monthIndex0 + 1, 0).getDate();
}

function addMonthsAnchor(date: Date, months: number, anchorDay?: number | null): Date {
  const d = new Date(date);
  const year = d.getFullYear();
  const month0 = d.getMonth();
  const targetMonth0 = month0 + months;
  const targetYear = year + Math.floor(targetMonth0 / 12);
  const normalizedMonth0 = ((targetMonth0 % 12) + 12) % 12;

  const dayAnchor = anchorDay ?? d.getDate();
  const lastDay = lastDayOfMonth(targetYear, normalizedMonth0);
  const day = Math.min(dayAnchor, lastDay);

  return new Date(targetYear, normalizedMonth0, day, d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds());
}

function addYearsAnchor(date: Date, years: number, anchorDay?: number | null): Date {
  return addMonthsAnchor(date, years * 12, anchorDay);
}

export async function GET(req: Request, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { message: "Nicht authentifiziert." },
      { status: 401 }
    );
  }

  const { definitionId } = await params;
  const definition = await queryOne<{
    userId: string;
    isRecurring: boolean;
    intervalType: string;
    intervalEvery: number;
    startDate: Date;
    anchorDayOfMonth: number | null;
    lastChargedAt: Date | null;
  }>(
    `SELECT "userId", "isRecurring", "intervalType", "intervalEvery", "startDate", "anchorDayOfMonth", "lastChargedAt"
     FROM "ExpenseDefinition"
     WHERE id = $1`,
    [definitionId]
  );

  if (!definition || definition.userId !== user.id) {
    return NextResponse.json(
      { message: "Ausgabedefinition nicht gefunden." },
      { status: 404 }
    );
  }

  if (!definition.isRecurring) {
    return NextResponse.json(
      { hasNextCharge: false, nextChargeDate: null },
      { status: 200 }
    );
  }

  const now = new Date();
  const lastCharged = definition.lastChargedAt ?? definition.startDate;

  let nextDue: Date;
  switch (definition.intervalType) {
    case "TAGE":
      nextDue = addDays(lastCharged, definition.intervalEvery);
      break;
    case "WOCHEN":
      nextDue = addWeeks(lastCharged, definition.intervalEvery);
      break;
    case "MONATE":
      nextDue = addMonthsAnchor(
        lastCharged,
        definition.intervalEvery,
        definition.anchorDayOfMonth ?? new Date(definition.startDate).getDate()
      );
      break;
    case "JAHRE":
      nextDue = addYearsAnchor(
        lastCharged,
        definition.intervalEvery,
        definition.anchorDayOfMonth ?? new Date(definition.startDate).getDate()
      );
      break;
    default:
      return NextResponse.json(
        { hasNextCharge: false, nextChargeDate: null },
        { status: 200 }
      );
  }

  const hasNextCharge = nextDue > now;

  return NextResponse.json(
    {
      hasNextCharge,
      nextChargeDate: hasNextCharge ? nextDue.toISOString() : null,
    },
    { status: 200 }
  );
}
