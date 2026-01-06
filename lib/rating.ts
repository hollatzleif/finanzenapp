export type RatingInput =
  | { lifesaving: true }
  | {
      lifesaving?: false;
      q1Happy: number;
      q2Value: number;
      q3RepeatNow: boolean;
      q4NeedElsewhere: boolean;
      q5Planned: "DURCHDACHT" | "AFFEKTIV";
    };

export function computeRating(input: RatingInput): number {
  if ("lifesaving" in input && input.lifesaving) {
    return 11.0;
  }

  const { q1Happy, q2Value, q3RepeatNow, q4NeedElsewhere, q5Planned } = input;

  if (
    q1Happy < 0 ||
    q1Happy > 10 ||
    q2Value < 0 ||
    q2Value > 10
  ) {
    throw new Error("Bewertungswerte müssen zwischen 0 und 10 liegen.");
  }

  const q3Mapped = q3RepeatNow ? 24 : 6;
  const q5Mapped = q5Planned === "DURCHDACHT" ? 15 : 4.5;

  const bewertungOhne4 =
    (q1Happy * 2 + q2Value * 2.5 + q3Mapped + q5Mapped) / 9;

  let bewertungFinal: number;

  if (q4NeedElsewhere) {
    if (bewertungOhne4 < 7) {
      bewertungFinal = bewertungOhne4 / 2;
    } else {
      bewertungFinal = bewertungOhne4 * 0.8;
    }
  } else {
    bewertungFinal = bewertungOhne4;
  }

  const rounded = Math.round(bewertungFinal * 100) / 100;
  return rounded;
}
