export type FileBackedDatabaseTransactionInput<T> = {
  writeFiles: () => Promise<void>;
  writeDatabase: () => T;
  rollbackFiles?: () => Promise<void>;
};

export async function runFileBackedDatabaseTransaction<T>(
  input: FileBackedDatabaseTransactionInput<T>,
): Promise<T> {
  await input.writeFiles();

  try {
    return input.writeDatabase();
  } catch (error) {
    await input.rollbackFiles?.();
    throw error;
  }
}
