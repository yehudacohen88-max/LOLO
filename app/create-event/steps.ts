export const CREATE_STEP_COUNT = 5;

export function createStepLabel(step: number) {
  return `שלב ${step} מתוך ${CREATE_STEP_COUNT}`;
}
