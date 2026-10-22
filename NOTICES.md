# Third-party notices

This project bundles and uses third-party software. Their licence terms are reproduced or referenced below, as those licences require.

## ZXing-JS (`zxing.libs.js`) — bundled

`zxing.libs.js` is an unmodified copy of the UMD build of [`@zxing/library`](https://github.com/zxing-js/library), the TypeScript port of the ZXing ("Zebra Crossing") barcode library. It reads the Code 39 barcode on the back of a CAP ID card and the Data Matrix on the front.

- Copyright the ZXing authors and the ZXing-JS contributors.
- Licensed under the Apache License, Version 2.0.
- A copy of that licence is included in this repository as `LICENSE-APACHE-2.0.txt`.
- Upstream: <https://github.com/zxing-js/library>

The file is bundled as published, with no changes to its code. The only addition is a comment at the top of the file recording this attribution.

## Tesseract.js — optional, not bundled

Reading the printed number from a temporary card uses [Tesseract.js](https://github.com/naptha/tesseract.js), a JavaScript port of the Tesseract OCR engine, together with its WebAssembly core and English trained data.

These files are **not** included in this repository. The application looks for them in a local `ocr/` folder and simply carries on reading barcodes if they are absent, so nothing is downloaded from a third party at runtime. See the README for how to install them.

If you do add them, they are covered by:

- Tesseract.js — copyright the Tesseract.js contributors, Apache License, Version 2.0.
- Tesseract OCR engine and `tesseract.js-core` — copyright Google Inc. and contributors,
Apache License, Version 2.0.
- The `eng.traineddata` model — Apache License, Version 2.0.

The same `LICENSE-APACHE-2.0.txt` applies to all of them, and they are redistributed here in `ocr/`. Apache 2.0 permits that, so the folder is committed and deploys with the site. Their own notices are kept beside them, in `ocr/tesseract.js-core.LICENSE`, `ocr/tesseract.min.js.LICENSE.txt` and `ocr/worker.min.js.LICENSE.txt`; the last two cover MIT and BSD-3-Clause code bundled into those files (regenerator-runtime, buffer, ieee754 and zlib.js).

Apache 2.0 also asks that modified files be marked as modified. One of them is: `ocr/eng.traineddata.gz` is the upstream `4.0.0_fast` English model with the `lstm_system_dawg` component removed. That component is the English word dictionary, 3.69MB of the 4.11MB file, and is of no use for reading a six-figure number. Nothing else was altered, and the model reads the cards in `examples/` exactly as the unmodified one does - same output, same confidence. The file is 368KB where the original is 2.0MB. To rebuild it, take `eng.traineddata.gz` from `https://tessdata.projectnaptha.com/4.0.0_fast/` and drop entry 19 from the component table.

## Example images

The files in `examples/` are photographs of a CAP ID card and a rendering of a temporary card, with the photograph, name and rank removed and the CAPID and expiry replaced with made-up values. They are test fixtures and are not part of the application; `examples/INDEX.md` describes them.
