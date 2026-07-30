import type { EditCounts } from "./contracts.ts";

export function normalizeComparisonV1(value: string) {
  return value
    .normalize("NFC")
    .replace(/\s+/gu, " ")
    .trim()
    .replace(/[A-Z]/g, (letter) => letter.toLowerCase());
}

function editDistance(reference: readonly string[], hypothesis: readonly string[]) {
  const previous = Array.from({ length: hypothesis.length + 1 }, (_, index) => index);
  const operations: Array<Array<[number, number, number]>> = [
    Array.from({ length: hypothesis.length + 1 }, (_, index) => [0, index, 0]),
  ];
  for (let row = 1; row <= reference.length; row += 1) {
    const current = [row];
    const rowOperations: Array<[number, number, number]> = [[0, 0, row]];
    for (let column = 1; column <= hypothesis.length; column += 1) {
      if (reference[row - 1] === hypothesis[column - 1]) {
        current[column] = previous[column - 1];
        rowOperations[column] = operations[row - 1][column - 1];
        continue;
      }
      const candidates = [
        { distance: previous[column - 1] + 1, counts: [operations[row - 1][column - 1][0] + 1, operations[row - 1][column - 1][1], operations[row - 1][column - 1][2]] as [number, number, number] },
        { distance: current[column - 1] + 1, counts: [rowOperations[column - 1][0], rowOperations[column - 1][1] + 1, rowOperations[column - 1][2]] as [number, number, number] },
        { distance: previous[column] + 1, counts: [operations[row - 1][column][0], operations[row - 1][column][1], operations[row - 1][column][2] + 1] as [number, number, number] },
      ].sort((left, right) => left.distance - right.distance);
      current[column] = candidates[0].distance;
      rowOperations[column] = candidates[0].counts;
    }
    previous.splice(0, previous.length, ...current);
    operations.push(rowOperations);
  }
  const [substitutions, insertions, deletions] =
    operations[reference.length][hypothesis.length];
  return { substitutions, deletions, insertions };
}

export function measureEdits(
  referenceText: string,
  hypothesisText: string,
  unit: "word" | "character"
): EditCounts {
  const reference = normalizeComparisonV1(referenceText);
  const hypothesis = normalizeComparisonV1(hypothesisText);
  const referenceUnits = unit === "word"
    ? (reference ? reference.split(" ") : [])
    : [...reference];
  const hypothesisUnits = unit === "word"
    ? (hypothesis ? hypothesis.split(" ") : [])
    : [...hypothesis];
  const counts = editDistance(referenceUnits, hypothesisUnits);
  const edits = counts.substitutions + counts.deletions + counts.insertions;
  return {
    ...counts,
    referenceUnits: referenceUnits.length,
    edits,
    rate: referenceUnits.length ? edits / referenceUnits.length : null,
  };
}

export function nearestRank(values: number[], percentile: number) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.max(1, Math.ceil(percentile * sorted.length));
  return sorted[rank - 1];
}
