// Cap & Doodle — minimal GIF89a encoder (no dependencies).
// Fixed 256-color 3-3-2 palette ("ghetto" quality, small + fast) + LZW.
// Works in a page (window.encodeGif) and in Node (module.exports) for tests.
(function (global) {
  "use strict";

  // --- palette: index = RRRGGGBB, values expanded back to 0..255 ---
  function paletteRGB(i) {
    const r = ((i >> 5) & 7) * 255 / 7;
    const g = ((i >> 2) & 7) * 255 / 7;
    const b = (i & 3) * 255 / 3;
    return [Math.round(r), Math.round(g), Math.round(b)];
  }
  function pixelIndex(r, g, b) {
    return (r & 0xe0) | ((g >> 3) & 0x1c) | (b >> 6);
  }

  // --- byte sink collecting Uint8Array chunks ---
  function Sink() { this.chunks = []; this.len = 0; }
  Sink.prototype.push = function (arr) {
    const u = arr instanceof Uint8Array ? arr : Uint8Array.from(arr);
    this.chunks.push(u); this.len += u.length;
  };
  Sink.prototype.u8 = function (v) { this.push([v & 0xff]); };
  Sink.prototype.u16 = function (v) { this.push([v & 0xff, (v >> 8) & 0xff]); };
  Sink.prototype.str = function (s) {
    const a = []; for (let i = 0; i < s.length; i++) a.push(s.charCodeAt(i) & 0xff);
    this.push(a);
  };
  Sink.prototype.blob = function () { return new Blob(this.chunks, { type: "image/gif" }); };

  // --- LZW compression for one frame's index stream ---
  // Emits: min-code-size byte, then data in <=255-byte sub-blocks, then 0 terminator.
  function lzwEncode(indices, sink) {
    const minCode = 8;
    const clear = 1 << minCode;        // 256
    const eoi = clear + 1;             // 257
    sink.u8(minCode);

    let dict, nextCode, codeSize;
    const out = [];         // pending compressed bytes
    let bitBuf = 0, bitCnt = 0;
    let subBlock = [];

    function resetDict() {
      dict = new Map();
      for (let i = 0; i < clear; i++) dict.set(String.fromCharCode(i), i);
      nextCode = eoi + 1;
      codeSize = minCode + 1;
    }
    function emit(code) {
      bitBuf |= code << bitCnt;
      bitCnt += codeSize;
      while (bitCnt >= 8) {
        subBlock.push(bitBuf & 0xff);
        bitBuf >>= 8; bitCnt -= 8;
        if (subBlock.length === 255) {
          sink.u8(255); sink.push(subBlock); out.push(1); subBlock = [];
        }
      }
    }
    resetDict();
    emit(clear);
    let prefix = String.fromCharCode(indices[0]);
    for (let i = 1; i < indices.length; i++) {
      const k = String.fromCharCode(indices[i]);
      const combined = prefix + k;
      if (dict.has(combined)) {
        prefix = combined;
      } else {
        emit(dict.get(prefix));
        dict.set(combined, nextCode++);
        if (nextCode - 1 === (1 << codeSize) && codeSize < 12) codeSize++;
        if (nextCode > 4095) {
          emit(clear);
          resetDict();
        }
        prefix = k;
      }
    }
    emit(dict.get(prefix));
    emit(eoi);
    if (bitCnt > 0) subBlock.push(bitBuf & 0xff);
    if (subBlock.length) { sink.u8(subBlock.length); sink.push(subBlock); }
    sink.u8(0);
  }

  // frames: array of {data:Uint8ClampedArray|Uint8Array (RGBA), width, height}
  // opts: {delay (ms per frame), repeat (0 = forever), onProgress(frameIdx, total)}
  async function encodeGif(frames, opts) {
    opts = opts || {};
    const delay = Math.round((opts.delay == null ? 100 : opts.delay) / 10); // hundredths
    const repeat = opts.repeat == null ? 0 : opts.repeat;
    const w = frames[0].width, h = frames[0].height;
    const s = new Sink();

    s.str("GIF89a");
    s.u16(w); s.u16(h);
    s.u8(0xf7); // global color table, 256 entries
    s.u8(0);    // background color index
    s.u8(0);    // aspect
    for (let i = 0; i < 256; i++) { const c = paletteRGB(i); s.u8(c[0]); s.u8(c[1]); s.u8(c[2]); }
    // NETSCAPE2.0 looping extension
    s.u8(0x21); s.u8(0xff); s.u8(11); s.str("NETSCAPE2.0");
    s.u8(3); s.u8(1); s.u16(repeat); s.u8(0);

    for (let f = 0; f < frames.length; f++) {
      const fr = frames[f];
      // Graphic Control Extension
      s.u8(0x21); s.u8(0xf9); s.u8(4); s.u8(0); s.u16(delay); s.u8(0); s.u8(0);
      // Image Descriptor
      s.u8(0x2c); s.u16(0); s.u16(0); s.u16(fr.width); s.u16(fr.height); s.u8(0);
      const d = fr.data;
      const idx = new Uint8Array(fr.width * fr.height);
      for (let p = 0, q = 0; p < idx.length; p++, q += 4) {
        idx[p] = pixelIndex(d[q], d[q + 1], d[q + 2]);
      }
      lzwEncode(idx, s);
      if (opts.onProgress) opts.onProgress(f + 1, frames.length);
      // Yield so the recorder window can paint progress.
      if (typeof setTimeout !== "undefined") await new Promise((r) => setTimeout(r, 0));
    }
    s.u8(0x3b);
    if (typeof Blob !== "undefined") return s.blob();
    // Node test path: return raw bytes
    const all = new Uint8Array(s.len);
    let off = 0;
    for (const c of s.chunks) { all.set(c, off); off += c.length; }
    return all;
  }

  global.encodeGif = encodeGif;
  if (typeof module !== "undefined" && module.exports) module.exports = { encodeGif };
})(typeof window !== "undefined" ? window : globalThis);
