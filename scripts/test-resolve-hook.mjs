import path from "node:path";

const root = new URL("../", import.meta.url);

function withTypeScriptExtension(specifier, parentHref) {
  const base = parentHref ? new URL(parentHref) : root;
  return new URL(`${specifier}.ts`, base).href;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") {
    return {
      shortCircuit: true,
      url: new URL("./server-only-stub.mjs", import.meta.url).href,
    };
  }

  if (specifier === "next/headers") {
    return {
      shortCircuit: true,
      url: new URL("./next-headers-stub.mjs", import.meta.url).href,
    };
  }

  if (specifier.startsWith("@/")) {
    return nextResolve(withTypeScriptExtension(specifier.slice(2), root.href), context);
  }

  if (
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    !path.extname(specifier)
  ) {
    return nextResolve(
      withTypeScriptExtension(specifier, context.parentURL),
      context,
    );
  }

  return nextResolve(specifier, context);
}
