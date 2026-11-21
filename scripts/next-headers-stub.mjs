let jar = null;

export function __setTestCookies(record) {
  jar = record;
}

export function __clearTestCookies() {
  jar = null;
}

export async function cookies() {
  if (!jar) {
    throw new Error("cookies() is not used by the session separation test");
  }
  return {
    get(name) {
      const value = jar[name];
      return typeof value === "string" ? { name, value } : undefined;
    },
  };
}
