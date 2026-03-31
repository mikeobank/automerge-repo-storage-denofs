import { describe } from "@std/testing/bdd";
import { runStorageAdapterTests } from "../@automerge/automerge-repo/helpers/tests/storage-adapter-tests.ts";
import { DenoFSStorageAdapter } from "../src/index.ts";

describe("DenoFSStorageAdapter", () => {
  const setup = async () => {
    const dir = await Deno.makeTempDir({ prefix: "automerge-repo-tests" });
    const teardown = async () => {
      await Deno.remove(dir, { recursive: true });
    };
    const adapter = new DenoFSStorageAdapter(dir);
    return { adapter, teardown };
  };

  runStorageAdapterTests(setup);
});
