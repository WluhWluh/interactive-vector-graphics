export type EditorCommandResult<T> =
  | {
      ok: true;
      value: T;
    }
  | {
      ok: false;
      error: Error;
    };

export function readRequiredInputValue(
  input: HTMLInputElement,
  errorMessage: string,
): EditorCommandResult<string> {
  const value = input.value.trim();

  return value
    ? {
        ok: true,
        value,
      }
    : {
        ok: false,
        error: new Error(errorMessage),
      };
}

export function requireCommandValue<T>(
  value: T | null | undefined,
  errorMessage: string,
): EditorCommandResult<T> {
  return value === null || value === undefined
    ? {
        ok: false,
        error: new Error(errorMessage),
      }
    : {
        ok: true,
        value,
      };
}
