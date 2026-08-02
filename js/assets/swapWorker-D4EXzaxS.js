(function() {
  "use strict";
  const SLOT_BYTES = 256 * 256 * 4;
  let handle = null;
  let fileName = "";
  const freeSlots = [];
  let topSlot = 0;
  async function cleanupOrphans(dir, keep) {
    try {
      const names = [];
      for await (const name of dir.keys()) {
        if (typeof name === "string" && name.startsWith("pentrado-swap-") && name !== keep) names.push(name);
      }
      for (const name of names) {
        try {
          const fh = await dir.getFileHandle(name);
          const h = await fh.createSyncAccessHandle();
          h.close();
          await dir.removeEntry(name);
        } catch {
        }
      }
    } catch {
    }
  }
  async function init() {
    var _a;
    try {
      const storage = (_a = self.navigator) == null ? void 0 : _a.storage;
      if (!(storage == null ? void 0 : storage.getDirectory)) return false;
      const dir = await storage.getDirectory();
      fileName = `pentrado-swap-${Math.random().toString(36).slice(2)}.bin`;
      const fh = await dir.getFileHandle(fileName, { create: true });
      handle = await fh.createSyncAccessHandle();
      handle.truncate(0);
      void cleanupOrphans(dir, fileName);
      return true;
    } catch {
      return false;
    }
  }
  async function dispose() {
    try {
      handle == null ? void 0 : handle.close();
      handle = null;
      const dir = await self.navigator.storage.getDirectory();
      await dir.removeEntry(fileName);
    } catch {
    }
  }
  self.onmessage = async (e) => {
    const msg = e.data;
    if (msg.op === "init") {
      const ok = await init();
      self.postMessage({ reqId: msg.reqId, ok });
      return;
    }
    if (msg.op === "dispose") {
      await dispose();
      self.postMessage({ reqId: msg.reqId, ok: true });
      return;
    }
    if (!handle) {
      self.postMessage({ reqId: msg.reqId, error: "no handle" });
      return;
    }
    try {
      if (msg.op === "write") {
        const bytes = new Uint8Array(msg.bytes);
        if (bytes.byteLength !== SLOT_BYTES) throw new Error(`bad slot size ${bytes.byteLength}`);
        const slot = freeSlots.pop() ?? topSlot++;
        handle.write(bytes, { at: slot * SLOT_BYTES });
        self.postMessage({ reqId: msg.reqId, slot });
      } else if (msg.op === "read") {
        const out = new Uint8Array(SLOT_BYTES);
        handle.read(out, { at: msg.slot * SLOT_BYTES });
        self.postMessage({ reqId: msg.reqId, bytes: out.buffer }, [out.buffer]);
      } else if (msg.op === "free") {
        freeSlots.push(msg.slot);
      }
    } catch (err) {
      self.postMessage({ reqId: msg.reqId, error: String(err) });
    }
  };
})();
//# sourceMappingURL=swapWorker-D4EXzaxS.js.map
