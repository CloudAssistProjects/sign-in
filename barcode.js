/* Camera mode - read a CAPID from a card held up to the webcam.

   Three ways in, all producing the same thing, a 6 or 7 digit string:
     1. the Code 39 barcode on the back of the card
     2. the Data Matrix on the front of the card
     3. the printed number, for temporary cards, which carry no barcode at all

   All decoding happens in this page. Nothing is uploaded and no service is called.

   Everything outside the card target stays blurred, and the target itself only sharpens
   once a card is in it, so the preview never works as a view of the room. */

/* ---- Settings, all changeable from the browser console. The ones that only apply when
        the camera opens need camera mode switched off and on again. ---- */
window.cameraWidth = 1280;          // Asked for, not insisted on - see cameraConstraints
window.cameraHeight = 720;
window.cameraWorkWidth = 1000;      // Decode at this width whatever the camera gives
window.cameraUpscaleBelow = 900;    // Frames narrower than this get scaled up to decode
window.cameraBlurPx = 4;            // Strength of the privacy blur, outside the target zones
window.cameraPreviewBorder = 0.03;  // Border shown around the card target, as a share of its width
window.cameraCooldownMs = 2000;     // After a read: how long before the next, and how long
                                    // the number stays on screen. The two are the same thing.
window.cameraSameCardMs = 2000;     // How long a card must be out of sight before it reads again
window.cameraOcrEnabled = true;     // Read the printed number as well as the barcodes
window.cameraOcrAfterMs = 0;        // Quiet time before the text reader joins in, 0 = at once
window.cameraOcrEveryMs = 250;      // How often to look, if the last look has finished
window.cameraOcrAgreeMs = 1500;     // How long two readings have to agree within
window.cameraOcrBase = "ocr/";      // Local folder holding the text reader - never a CDN
window.cameraDebug = false;         // Log a line a second about what the camera can see
window.cameraShowFrameInfo = true;  // TEMPORARY, for debugging: print the frame, crop and
                                    // rendered sizes under the target, where a phone can
                                    // be read without a console

/* Where the Data Matrix sits on the front of the card, as fractions of the card. ZXing's
   JavaScript reader only finds it when handed a tight crop, so we cut a small window at
   this spot rather than searching the whole card. */
var DM_CENTRE = { x: 0.902, y: 0.832 };
var DM_WINDOW = { w: 0.20, h: 0.27 };
var DM_NUDGES = [0, -0.04, 0.04];   // Tried in turn, to absorb imperfect alignment

var CARD_ASPECT = 85.6 / 54;        // ID-1, the standard card shape

/* The three things worth lining up, as fractions of the target, each labelled for someone
   who has never heard of Code 39 or a Data Matrix and should not have to. The square is
   the window the decoder actually looks in, so that box is the literal truth; the other
   two were measured off the cards in examples/ and are there to say which way up to hold
   it. All three are shown at once because a card only ever has two of them, and which two
   depends on a side the holder should not have to think about. */
/* All measured off the cards in examples/, as fractions of the target.

   `box` is where to aim: the feature itself plus a margin, so there is somewhere to land
   without having to be exact. `glyph` is the size the real thing actually is, so that the
   drawing inside is life-size rather than stretched to fill whatever box it sits in - the
   point of the drawing is to say "a mark this shape, about this big, goes here".

   The square's box sits well inside the window the decoder searches (DM_CENTRE and
   DM_WINDOW), so anything lined up with the box is comfortably found. The other two are
   guidance only: the barcode and the printed number are searched for across the whole
   target, wherever they actually land. The CAPID box is placed on the printed card, which
   is what almost everybody holds up. A temporary card prints its number further left and
   is read just the same - the number is simply not where the box suggests. */
var CARD_ZONES = [
    { label: "Barcode (Back)", kind: "bars",
      box: { x: 0.345, y: 0.744, w: 0.325, h: 0.211 }, glyph: { w: 0.285, h: 0.171 } },
    { label: "Square Code (Front)", kind: "square",
      box: { x: 0.816, y: 0.713, w: 0.129, h: 0.192 }, glyph: { w: 0.069, h: 0.112 } },
    { label: "CAPID (Front)", kind: "digits",
      box: { x: 0.615, y: 0.345, w: 0.139, h: 0.072 }, glyph: { w: 0.093, h: 0.036 } }
];

function zoneGlyph(kind) {
    var cells = "", i, x, y, n, seed;
    if (kind === "bars") {
        /* Narrow and wide bars in the proportions Code 39 uses, and about as many as a
           six-digit number makes, without being any particular number. */
        for (i = 0, x = 0, seed = 11; i < 62; i++) {
            seed = (seed * 1103515 + 12345) % 2147483647;
            var width = (seed % 100 < 32) ? 3 : 1;
            if (i % 2 === 0) { cells += '<rect x="' + x + '" y="0" width="' + width + '" height="40"/>'; }
            x += width + 1;
        }
        return '<svg viewBox="0 0 ' + x + ' 40" preserveAspectRatio="none">' + cells + '</svg>';
    }
    if (kind === "square") {
        /* The solid L and the dotted edge opposite it are what make a Data Matrix look
           like one; the middle is filled from a fixed seed so it never flickers. */
        n = 12;
        function cell(cx, cy) { return '<rect x="' + cx + '" y="' + cy + '" width="1" height="1"/>'; }
        for (y = 0; y < n; y++) { cells += cell(0, y); }
        for (x = 0; x < n; x++) { cells += cell(x, n - 1); }
        for (x = 0; x < n; x += 2) { cells += cell(x, 0); }
        for (y = 0; y < n; y += 2) { cells += cell(n - 1, y); }
        for (y = 1, seed = 7; y < n - 1; y++) {
            for (x = 1; x < n - 1; x++) {
                seed = (seed * 1103515 + 12345) % 2147483647;
                if (seed % 100 < 45) { cells += cell(x, y); }
            }
        }
        return '<svg viewBox="0 0 ' + n + ' ' + n + '">' + cells + '</svg>';
    }
    return '<svg viewBox="0 0 108 34" preserveAspectRatio="none"><text x="54" y="27"'
        + ' text-anchor="middle" font-family="ui-monospace, Menlo, Consolas, monospace"'
        + ' font-size="30" font-weight="700">000000</text></svg>';
}

/* ---- State ---- */
window.cameraStarted = false;
window.cameraCooldownUntil = 0;
var cameraVideo = null;
var cameraWork = null, cameraWorkCtx = null;     // Card crop, used both to decode and to display
var cameraTimer = null, cameraGuide = null, cameraZones = null;
var cameraRead = null, readTimer = null;         // The number shown back after a read
var cameraHost = null, cameraShown = false;      // The preview box, and whether it is up yet
var cameraStatus = null;                         // TEMPORARY, for debugging the above
var nativeDetector = null, nativeChecked = false;
var cameraDevices = [], cameraRetried = false;   // The cameras on offer, once they can be named
var zxingReader = null, zxingHints = null;
var dmStep = 0;
var lastReadAt = 0;                              // When the camera opened, or last read a card
var lastCode = "", lastCodeSeenAt = 0;           // The card just read, and when it was last in view
var ocrState = "idle";                           // idle | loading | ready | running | unavailable
var ocrWorker = null, ocrLastRun = 0, ocrLastText = "", ocrLastTextAt = 0;
var reportAfter = 0;

/* ================= Geometry ================= */

/* The card-shaped target, in pixels of the camera frame. Worked out from the frame we
   actually get, so it lands in the same place at 640x480 or at 1920x1080. */
function guideRect(w, h) {
    var gw = w * 0.88;
    var gh = gw / CARD_ASPECT;
    if (gh > h * 0.88) { gh = h * 0.88; gw = gh * CARD_ASPECT; }
    return { x: (w - gw) / 2, y: (h - gh) / 2, w: gw, h: gh };
}

/* ================= Reading barcodes ================= */

/* Code39Reader, not MultiFormatReader. Two reasons, both about the multi-format reader:
   it re-reads its hints on every decode() call, so a call that does not hand them back
   drops to trying every format it knows; and in this build of ZXing a plain "nothing
   found" is not the exception class it expects, so it logs a warning every time a format
   comes up empty - a steady spew of them at several frames a second. Reading the one
   format we want is quieter and much faster. */
function zxing() {
    if (!zxingReader) {
        zxingHints = new Map();
        zxingHints.set(ZXing.DecodeHintType.TRY_HARDER, true);
        zxingHints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [ZXing.BarcodeFormat.CODE_39]);
        zxingReader = new ZXing.Code39Reader();
    }
    return zxingReader;
}

function bitmapFor(sx, sy, sw, sh) {
    var data = cameraWorkCtx.getImageData(sx, sy, sw, sh).data;
    var lum = new Uint8ClampedArray(sw * sh);
    for (var i = 0, p = 0; i < lum.length; i++, p += 4) {
        lum[i] = (data[p] * 306 + data[p + 1] * 601 + data[p + 2] * 117) >> 10;
    }
    return new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(new ZXing.RGBLuminanceSource(lum, sw, sh)));
}

/* The Code 39 on the back of the card, anywhere in the target */
function readCode39() {
    try {
        var r = zxing().decode(bitmapFor(0, 0, cameraWork.width, cameraWork.height), zxingHints);
        return r && r.getText();
    } catch (e) {
        return null;
    } finally {
        zxing().reset();
    }
}

/* The Data Matrix on the front. One candidate window per pass, cycling through the
   nudges, so a slightly misplaced card is still found within a second or so. */
function readDataMatrix() {
    var nx = DM_NUDGES[dmStep % DM_NUDGES.length];
    var ny = DM_NUDGES[Math.floor(dmStep / DM_NUDGES.length) % DM_NUDGES.length];
    dmStep++;
    var w = DM_WINDOW.w * cameraWork.width, h = DM_WINDOW.h * cameraWork.height;
    var sx = Math.round((DM_CENTRE.x + nx) * cameraWork.width - w / 2);
    var sy = Math.round((DM_CENTRE.y + ny) * cameraWork.height - h / 2);
    sx = Math.max(0, Math.min(cameraWork.width - 1, sx));
    sy = Math.max(0, Math.min(cameraWork.height - 1, sy));
    var sw = Math.min(cameraWork.width - sx, Math.round(w));
    var sh = Math.min(cameraWork.height - sy, Math.round(h));
    if (sw < 40 || sh < 40) { return null; }
    try {
        var r = new ZXing.DataMatrixReader().decode(bitmapFor(sx, sy, sw, sh), zxingHints);
        return r && r.getText();
    } catch (e) {
        return null;
    }
}

/* The browser's own decoder, where there is one. Free, fast, and reads both formats.
   It answers on its own schedule, so it reports straight to acceptScannedCode. */
function readNative() {
    if (!nativeDetector) { return; }
    nativeDetector.detect(cameraWork).then(function (found) {
        if (found && found.length) {
            lastReadAt = Date.now();
            acceptScannedCode(found[0].rawValue, "camera/native");
        }
    }).catch(function () { });
}

/* ================= Reading the printed number ================= */

/* Temporary cards carry no barcode at all - the number is printed as *123456*, the
   asterisks being Code 39 start and stop marks that never made it into a barcode font.
   For those this is the only way in, not merely a fallback for a worn card. */
function ensureOcr() {
    if (ocrState !== "idle" || !window.cameraOcrEnabled) { return; }
    ocrState = "loading";
    console.log("Camera: no barcode yet, loading the text reader from " + window.cameraOcrBase);
    var s = document.createElement("script");
    s.src = window.cameraOcrBase + "tesseract.min.js";
    s.onload = function () {
        Tesseract.createWorker("eng", 1, {
            workerPath: window.cameraOcrBase + "worker.min.js",
            corePath: window.cameraOcrBase,
            langPath: window.cameraOcrBase
        }).then(function (w) {
            ocrWorker = w; ocrState = "ready";
            console.log("Camera: text reader ready");
        }).catch(function (e) {
            ocrState = "unavailable";
            console.error("Camera: text reader would not start", e);
            warnIfOpenedAsAFile();
        });
    };
    s.onerror = function () {
        ocrState = "unavailable";
        console.error("Camera: no text reader in " + window.cameraOcrBase
            + " - barcodes still work, but temporary cards cannot be read. See the README.");
    };
    document.head.appendChild(s);
}

/* The text reader runs in a web worker, and a page opened straight off the disk has no
   origin a worker can be started from. Barcodes do not care, so this is only ever worth
   saying once the text reader has already failed. */
function warnIfOpenedAsAFile() {
    if (location.protocol !== "file:") { return; }
    console.error("Camera: this page was opened as a file, which stops the text reader's worker in most"
        + " browsers. Serve the folder instead - 'python3 -m http.server' in it, then open"
        + " http://localhost:8000/ - and temporary cards can be read.");
}

/* Pull a CAPID out of whatever the text reader saw. Handles the *123456* of a temporary
   card and the plain number under "CAPID NUMBER" on a printed one. */
function capidFromText(data) {
    var words = (data && data.words) || [];
    var i, t, b;
    for (i = 0; i < words.length; i++) {        // *123456* is unambiguous, so trust it first
        t = String(words[i].text || "").trim();
        if (/^\*\d{6,7}\*$/.test(t)) { return t.replace(/\*/g, ""); }
    }
    var label = null;
    for (i = 0; i < words.length; i++) {
        if (/^CAPID/i.test(String(words[i].text || "").trim())) { label = words[i]; break; }
    }
    if (label && label.bbox) {
        for (i = 0; i < words.length; i++) {
            t = String(words[i].text || "").trim();
            b = words[i].bbox;
            if (/^\d{6,7}$/.test(t) && b && b.y0 > label.bbox.y0
                && b.y0 - label.bbox.y0 < (label.bbox.y1 - label.bbox.y0) * 4
                && Math.abs(b.x0 - label.bbox.x0) < (label.bbox.x1 - label.bbox.x0)) {
                return t;
            }
        }
    }
    var m = String((data && data.text) || "").match(/\*(\d{6,7})\*/);
    if (m) { return m[1]; }

    /* A temporary card in the corrected format prints a plain number, with neither the
       asterisks nor a CAPID label to recognise it by. Taking any six or seven figure run
       would risk reading an expiry or a phone number, so this only answers when the whole
       card shows exactly one such run and there is therefore nothing to confuse it with.
       Runs are measured whole, so the first seven figures of an eight figure date are not
       mistaken for a CAPID. */
    var runs = (String((data && data.text) || "").match(/\d+/g) || []).filter(function (r) {
        return r.length === 6 || r.length === 7;
    });
    var unique = runs.filter(function (r, i) { return runs.indexOf(r) === i; });
    return unique.length === 1 ? unique[0] : null;
}

function runOcr() {
    if (ocrState !== "ready" || Date.now() - ocrLastRun < window.cameraOcrEveryMs) { return; }
    ocrLastRun = Date.now();
    ocrState = "running";
    ocrWorker.recognize(cameraWork).then(function (res) {
        ocrState = "ready";
        var code = capidFromText(res && res.data);
        if (!code) { return; }
        /* Reading text has no check digits and will occasionally invent a figure, so a
           value is only used once two readings in a row agree on it. */
        /* The two looks have to be near each other in time as well as equal. A first look
           left lying around could otherwise be agreed with minutes later, by a misreading
           of somebody else's card, and be accepted as theirs. */
        if (code === ocrLastText && Date.now() - ocrLastTextAt < window.cameraOcrAgreeMs) {
            acceptScannedCode(code, "camera/text");
        } else {
            console.log("Camera: text reader saw " + JSON.stringify(code) + ", waiting for a second look to agree");
            ocrLastText = code;
            ocrLastTextAt = Date.now();
        }
    }).catch(function (e) {
        ocrState = "ready";
        console.error("Camera: text reading failed", e);
    });
}

/* ================= Accepting a result ================= */

function acceptScannedCode(code, source) {
    if (!window.cameraMode) { return false; }

    var digits = String(code).replace(/[^0-9]/g, "");
    if (digits.length < 6 || digits.length > 7) {
        console.log("Camera ignored " + JSON.stringify(String(code)) + " from " + source + " - not a CAPID");
        return false;
    }

    /* A card sits in front of the camera for as long as it takes somebody to read the
       confirmation and lower their hand, so a plain timer would read it over and over.
       The clock below is pushed back every time the card is seen again, and so only
       starts running once the card has actually gone: holding a card up reads it once,
       however long it is held. Taking it away and presenting it again is a different
       thing, and deliberately does read a second time - that is how somebody who is
       already signed in gets told so, rather than being met with silence. A different
       card is not affected either way and goes straight through. */
    if (digits === lastCode && Date.now() - lastCodeSeenAt < window.cameraSameCardMs) {
        lastCodeSeenAt = Date.now();
        if (window.cameraDebug) {
            console.log("Camera: " + digits + " from " + source + " ignored - the same card is still in view");
        }
        return false;
    }

    if (Date.now() < window.cameraCooldownUntil) {
        if (window.cameraDebug) {
            console.log("Camera: " + digits + " from " + source
                + " ignored - still inside the cooldown from the last read");
        }
        return false;
    }

    console.log("Camera read " + digits + " (" + source + ")");
    lastCode = digits;
    lastCodeSeenAt = Date.now();
    lastReadAt = Date.now();
    showRead(digits);
    window.cameraCooldownUntil = Date.now() + window.cameraCooldownMs;
    if (ocrLastText) {
        console.log("Camera: text reader was still waiting on " + JSON.stringify(ocrLastText)
            + " - dropped, the card was read another way");
    }
    ocrLastText = "";

    document.getElementById("CAPID").value = digits;
    window.entryIsManual = false;   // Read from a card, whatever the keyboard has been doing
    submit();
    document.getElementById("CAPID").value = "";
    return true;
}

/* ================= The preview ================= */

/* TEMPORARY, for debugging. The sizes this reports are the whole question: whether the
   picture is being drawn at the width it was told to be, and whether the box it sits in
   is the shape the crop asked for. A phone has no console worth reading, so it goes on
   the screen, under the target where it covers nothing that matters. */
function showFrameInfo(vw, vh, crop) {
    if (!window.cameraShowFrameInfo || !cameraStatus || !cameraHost || !cameraVideo) { return; }
    var box = cameraHost.getBoundingClientRect();
    var vid = cameraVideo.getBoundingClientRect();
    if (!box.width) { return; }
    cameraStatus.textContent =
        "box " + Math.round(box.width) + "x" + Math.round(box.height)
        + "  vid " + Math.round(vid.width) + "x" + Math.round(vid.height)
        + "  want " + Math.round(box.width * vw / crop.w)
        + "  off want " + Math.round(-crop.x / crop.w * box.width)
        + "," + Math.round(-crop.y / crop.h * box.height)
        + " got " + cameraVideo.offsetLeft + "," + cameraVideo.offsetTop;
}

/* What of the camera frame is worth showing: the card target and a border around it,
   rather than the whole frame. A phone hands over a tall portrait picture with the card a
   landscape strip across the middle; showing all of that wastes most of the screen on
   ceiling and floor, and takes so much height that the form below is pushed off. A webcam
   hands over something too wide for the same reason.

   The border is a fixed share of the card rather than whatever each frame happens to have
   going spare, so the preview is the same shape on every camera. The target is always the
   card's own proportions, so a proportional border makes the crop a constant shape too.
   What a frame cannot supply is all it gives: the crop stops short of the frame edge,
   where a CSS blur goes transparent, and on a 16:9 camera that leaves barely more than
   this - which is what sets the default. */
function previewCrop(rect, vw, vh) {
    var edge = Math.max(4, window.cameraBlurPx * 2);
    var room = Math.min(rect.x, rect.y, vw - rect.x - rect.w, vh - rect.y - rect.h) - edge;
    var margin = Math.max(0, Math.min(rect.w * window.cameraPreviewBorder, room));
    return {
        x: rect.x - margin,
        y: rect.y - margin,
        w: rect.w + margin * 2,
        h: rect.h + margin * 2
    };
}

/* The video is laid out against the crop rather than the host, so the cropped-away part
   hangs outside the host and is clipped by its overflow. Everything else is placed in the
   same terms, which keeps the target boxes over the things they are pointing at.

   The video is placed in pixels worked out from the box's measured size, not in
   percentages of it. A percentage top resolves against the containing block's height, and
   this box has no height of its own - it gets one from aspect-ratio - which left the
   picture correctly sized but showing the wrong part of the frame. The boxes either side
   of this are percentages still, and are fine: they are small positive ones, and they
   were landing correctly throughout. */
function placeOverlay(rect, crop, vw, vh) {
    if (cameraVideo && cameraHost) {
        var box = cameraHost.getBoundingClientRect();
        if (box.width) {
            cameraVideo.style.width = (box.width * vw / crop.w) + "px";
            cameraVideo.style.left = (-crop.x / crop.w * box.width) + "px";
            cameraVideo.style.top = (-crop.y / crop.h * box.height) + "px";
        }
    }
    var parts = [cameraGuide, cameraWork, cameraZones], i;
    for (i = 0; i < parts.length; i++) {
        parts[i].style.left = ((rect.x - crop.x) / crop.w * 100) + "%";
        parts[i].style.top = ((rect.y - crop.y) / crop.h * 100) + "%";
        parts[i].style.width = (rect.w / crop.w * 100) + "%";
        parts[i].style.height = (rect.h / crop.h * 100) + "%";
    }
}

/* ================= The loop ================= */

function cameraPass() {
    cameraTimer = null;
    if (!window.cameraMode) { return; }
    if (!cameraVideo || !cameraVideo.videoWidth) { return schedule(200); }

    var started = Date.now();
    var vw = cameraVideo.videoWidth, vh = cameraVideo.videoHeight;
    var rect = guideRect(vw, vh);

    /* A small frame is scaled UP before decoding. It adds no detail, but it lets the
       binarizer resolve narrow Code 39 bars that fall between pixels - on a 480px frame
       that is the difference between never reading and reading reliably. A large frame is
       scaled down instead, to keep the work the same on any camera. */
    var native = Math.max(160, Math.round(rect.w));
    var workW = native >= window.cameraUpscaleBelow
        ? Math.min(window.cameraWorkWidth, native)
        : Math.min(1500, native * 3);
    var workH = Math.round(workW / CARD_ASPECT);
    if (cameraWork.width !== workW) { cameraWork.width = workW; cameraWork.height = workH; }
    cameraWorkCtx.drawImage(cameraVideo, rect.x, rect.y, rect.w, rect.h, 0, 0, workW, workH);
    var crop = previewCrop(rect, vw, vh);
    placeOverlay(rect, crop, vw, vh);
    showFrameInfo(vw, vh, crop);

    if (!cameraShown && cameraHost) {   // Sized from a real frame now, so it can be seen
        cameraShown = true;
        /* The frame dimensions are fixed for the life of the stream, so pinning the box
           to them here means it is the right shape the moment it appears and never
           changes shape afterwards. */
        cameraHost.style.aspectRatio = crop.w + " / " + crop.h;
        /* Handed to the stylesheet so it can work back from a height it can spare to the
           width that produces it. Only the frame knows the shape; only CSS knows the room. */
        cameraHost.style.setProperty("--cam-aspect", (crop.w / crop.h).toFixed(4));
        cameraHost.style.visibility = "";
        cameraHost.style.opacity = "";
    }

    /* Every pass reads, whatever is in front of the camera. Deciding first whether a card
       was there cost more reads than it ever saved. */
    readNative();
    var code = readCode39() || readDataMatrix();
    if (code) {
        /* Noted even when the read is refused for being inside the cooldown. A barcode
           that still decodes means the text reader has nothing to add, and starting it
           anyway burns a worker on a card that is already being read. */
        lastReadAt = Date.now();
        acceptScannedCode(code, "camera/barcode");
    } else if (window.cameraOcrEnabled && Date.now() - lastReadAt > window.cameraOcrAfterMs) {
        /* The text reader is far slower than either barcode, so it only joins in once the
           barcodes have had a quiet few seconds to fail. */
        ensureOcr();
        runOcr();
    }

    if (window.cameraDebug && Date.now() > reportAfter) {
        reportAfter = Date.now() + 1000;
        console.log("Camera: " + workW + "px pass in " + (Date.now() - started) + "ms, text reader "
            + ocrState + ", " + ((Date.now() - lastReadAt) / 1000).toFixed(1) + "s since a read");
    }

    /* Pace off how long that actually took, so an old tablet runs slower rather than
       seizing up, and a quick machine is not held back. */
    schedule(Math.max(80, Math.min(600, Date.now() - started)));
}

function schedule(ms) {
    if (cameraTimer) { window.clearTimeout(cameraTimer); }
    if (window.cameraMode) { cameraTimer = window.setTimeout(cameraPass, ms); }
}

/* ================= Starting and stopping ================= */

function cameraConstraints() {
    /* "ideal" rather than "min", so an old tablet that cannot manage this still opens at
       whatever it can do. Everything downstream measures the frame it actually returns.

       A phone or tablet has a camera on each side. Whichever was last chosen is asked for
       by name; failing that the front one, since the member is holding their card towards
       the screen and wants to see what the camera sees. */
    var chosen = localStorage.getItem("cameraDeviceId");
    var video = { width: { ideal: window.cameraWidth }, height: { ideal: window.cameraHeight } };
    if (chosen) { video.deviceId = { exact: chosen }; } else { video.facingMode = "user"; }
    return { audio: false, video: video };
}

/* The browser will not name a camera until it has handed one over, so the list is only
   worth taking once a stream is running. One camera means nothing to switch between, and
   no button to do it with. */
function listCameras() {
    if (!navigator.mediaDevices.enumerateDevices) { return; }
    navigator.mediaDevices.enumerateDevices().then(function (devices) {
        cameraDevices = devices.filter(function (d) { return d.kind === "videoinput"; });
        showSwitchButton(cameraDevices.length > 1);
        if (cameraDevices.length > 1) {
            console.log("Camera: " + cameraDevices.length + " cameras on this device");
        }
    }).catch(function () { });
}

function showSwitchButton(on) {
    var button = document.getElementById("camera-switch");
    if (button) { button.style.display = on ? "flex" : "none"; }
}

/* Note which camera was actually opened, so that "the next one" means something the first
   time the button is pressed. */
function rememberCameraInUse(stream) {
    var track = stream.getVideoTracks()[0];
    var settings = track && track.getSettings ? track.getSettings() : null;
    if (settings && settings.deviceId) { localStorage.setItem("cameraDeviceId", settings.deviceId); }
}

/* Move to the next camera and reopen on it. The choice is remembered, so a tablet set up
   to read cards with its back camera comes back up that way. */
function switchCamera() {
    if (cameraDevices.length < 2) { return; }
    var current = localStorage.getItem("cameraDeviceId") || "";
    var at = -1, i;
    for (i = 0; i < cameraDevices.length; i++) {
        if (cameraDevices[i].deviceId === current) { at = i; }
    }
    var next = cameraDevices[(at + 1) % cameraDevices.length];
    localStorage.setItem("cameraDeviceId", next.deviceId);
    console.log("Camera: switching to " + (next.label || "camera " + ((at + 2) % (cameraDevices.length + 1))));
    stopCamera();
    startCamera();
}

function prepareNativeDetector() {
    if (nativeChecked || typeof BarcodeDetector === "undefined") { nativeChecked = true; return; }
    nativeChecked = true;
    BarcodeDetector.getSupportedFormats().then(function (formats) {
        var wanted = ["code_39", "data_matrix"].filter(function (f) { return formats.indexOf(f) !== -1; });
        if (wanted.length) {
            nativeDetector = new BarcodeDetector({ formats: wanted });
            console.log("Camera: the browser has its own decoder for " + wanted.join(", "));
        }
    }).catch(function () { });
}

/* The same rectangles as the green boxes, as a clipping shape for the sharp canvas.
   Fractions of the canvas, so it needs no resizing when the camera resolution changes. */
function zoneClipPath() {
    var NS = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(NS, "svg");
    svg.setAttribute("class", "scanner-defs");
    svg.setAttribute("aria-hidden", "true");
    var clip = document.createElementNS(NS, "clipPath");
    clip.setAttribute("id", "scanner-zone-clip");
    clip.setAttribute("clipPathUnits", "objectBoundingBox");
    for (var i = 0; i < CARD_ZONES.length; i++) {
        var zone = CARD_ZONES[i];
        var rect = document.createElementNS(NS, "rect");
        rect.setAttribute("x", zone.box.x);
        rect.setAttribute("y", zone.box.y);
        rect.setAttribute("width", zone.box.w);
        rect.setAttribute("height", zone.box.h);
        clip.appendChild(rect);
    }
    svg.appendChild(clip);
    return svg;
}

/* An unmistakable confirmation, readable from across a table: the number just read, laid
   across the preview, with the guidance out of its way. It clears itself exactly when the
   cooldown ends, so the screen going back to normal is the signal that the next person
   can step up. */
function showRead(digits) {
    if (!cameraRead || !cameraRead.parentElement) { return; }
    cameraRead.innerHTML = '<svg viewBox="0 0 100 30"><text x="50" y="24" text-anchor="middle"'
        + ' textLength="96" lengthAdjust="spacingAndGlyphs" font-size="28" font-weight="800"'
        + ' font-family="ui-sans-serif, system-ui, -apple-system, sans-serif">'
        + digits + '</text></svg>';
    cameraRead.parentElement.classList.add("scanner-cam--read");
    if (cameraGuide) { cameraGuide.classList.add("scanner-guide--found"); }
    window.clearTimeout(readTimer);
    readTimer = window.setTimeout(clearRead, window.cameraCooldownMs);
}

function clearRead() {
    readTimer = null;
    if (cameraRead) {
        cameraRead.innerHTML = "";
        if (cameraRead.parentElement) { cameraRead.parentElement.classList.remove("scanner-cam--read"); }
    }
    if (cameraGuide) { cameraGuide.classList.remove("scanner-guide--found"); }
}

function buildPreview(host) {
    host.innerHTML = "";
    /* A video element has no size of its own until a stream arrives, so it would stand
       there as a mis-shapen grey box with the target boxes laid out over it at the wrong
       size. Everything stays hidden until the first frame says how big the picture is. */
    cameraHost = host;
    cameraShown = false;
    /* Set on the element rather than left to a class in the stylesheet, so that hiding
       the preview cannot be undone by a stale copy of the CSS sitting in a cache. */
    host.style.visibility = "hidden";
    host.style.opacity = "0";
    cameraVideo = document.createElement("video");
    cameraVideo.setAttribute("playsinline", "");
    cameraVideo.muted = true;
    cameraVideo.style.filter = "blur(" + window.cameraBlurPx + "px)";
    host.appendChild(cameraVideo);

    cameraGuide = document.createElement("div");
    cameraGuide.className = "scanner-guide";
    var guideLabel = document.createElement("span");
    guideLabel.className = "scanner-guide__label";
    guideLabel.textContent = "Line Up Card Here (Front or Back)";
    cameraGuide.appendChild(guideLabel);
    /* TEMPORARY, for debugging: what the camera says the frame is, what that crops to, and
       what the box and the picture inside it actually came out as. */
    cameraStatus = document.createElement("span");
    cameraStatus.className = "scanner-guide__status";
    cameraGuide.appendChild(cameraStatus);
    host.appendChild(cameraGuide);

    /* The whole target is drawn, but only the zones are let through, so the sharp picture
       is three small windows rather than a readable view of whoever is standing there. */
    host.appendChild(zoneClipPath());
    cameraWork = document.createElement("canvas");
    cameraWork.className = "scanner-sharp";
    cameraWork.width = 640; cameraWork.height = 404;
    cameraWork.style.clipPath = "url(#scanner-zone-clip)";
    host.appendChild(cameraWork);
    cameraWorkCtx = cameraWork.getContext("2d", { willReadFrequently: true });

    /* Last, so the boxes sit over the sharpened card rather than under it. */
    cameraZones = document.createElement("div");
    cameraZones.className = "scanner-zones";
    for (var i = 0; i < CARD_ZONES.length; i++) {
        var zone = CARD_ZONES[i];
        var box = document.createElement("div");
        box.className = "scanner-zone";
        box.style.left = (zone.box.x * 100) + "%";
        box.style.top = (zone.box.y * 100) + "%";
        box.style.width = (zone.box.w * 100) + "%";
        box.style.height = (zone.box.h * 100) + "%";
        /* The glyph is a share of its box, worked out so that it comes out the size the
           real mark is on a card filling the target. */
        var glyph = document.createElement("span");
        glyph.className = "scanner-zone__glyph";
        glyph.style.width = (zone.glyph.w / zone.box.w * 100) + "%";
        glyph.style.height = (zone.glyph.h / zone.box.h * 100) + "%";
        glyph.innerHTML = zoneGlyph(zone.kind);
        box.appendChild(glyph);
        var label = document.createElement("span");
        label.className = "scanner-zone__label";
        label.textContent = zone.label;
        box.appendChild(label);
        cameraZones.appendChild(box);
    }
    host.appendChild(cameraZones);

    cameraRead = document.createElement("div");
    cameraRead.className = "scanner-read";
    host.appendChild(cameraRead);
}

/* One way out when the camera does not come up, whether the browser refused, the page is
   not allowed to ask, or the call threw outright. Camera mode is switched back off and
   forgotten, so that a refusal is not re-prompted on every refresh. */
function cameraFailed(err) {
    console.error("Camera mode could not start:", err);
    setCameraMode(false);
    stopCamera();
    alert("Camera mode could not start.\n\n" + (err.message || err));
}

/* A browser hands over a camera only on an origin it trusts: https, or localhost. A LAN
   address, a machine name, and the http://[::]:8000 that `python3 -m http.server` prints
   on startup are all untrusted, and on those navigator.mediaDevices is not merely refused
   but absent, so the call below would throw before there is a promise to catch it. */
function cameraAccessProblem() {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) { return null; }
    if (!window.isSecureContext) {
        return "This page is at " + location.origin + ", which the browser does not trust with a"
            + " camera. Open it as https, or over localhost - http://localhost:" + (location.port || "80")
            + "/ - rather than by IP address or machine name.";
    }
    return "This browser does not offer camera access.";
}

function startCamera() {
    var problem = cameraAccessProblem();
    if (problem) { return cameraFailed(new Error(problem)); }

    buildPreview(document.getElementsByClassName("scanner-cam")[0]);
    prepareNativeDetector();
    lastReadAt = Date.now();

    try {
        navigator.mediaDevices.getUserMedia(cameraConstraints()).then(function (stream) {
            window.cameraStream = stream;
            rememberCameraInUse(stream);
            cameraVideo.srcObject = stream;
            return cameraVideo.play();
        }).then(function () {
            window.cameraStarted = true;
            cameraRetried = false;
            console.log("Camera mode started at " + cameraVideo.videoWidth + "x" + cameraVideo.videoHeight);
            listCameras();
            schedule(100);
        }).catch(function (err) {
            /* The remembered camera belongs to whatever machine it was chosen on. Asked
               for by name somewhere else, it simply is not there - so forget it and open
               whatever this machine does have, rather than refusing to start at all. */
            if (!cameraRetried && localStorage.getItem("cameraDeviceId")
                && (err.name === "OverconstrainedError" || err.name === "NotFoundError")) {
                cameraRetried = true;
                localStorage.removeItem("cameraDeviceId");
                console.log("Camera: the camera last used is not on this device, opening another");
                stopCamera();
                startCamera();
                return;
            }
            cameraFailed(err);
        });
    } catch (err) {
        cameraFailed(err);
    }
}

function stopCamera() {
    if (cameraTimer) { window.clearTimeout(cameraTimer); cameraTimer = null; }
    if (readTimer) { window.clearTimeout(readTimer); readTimer = null; }
    if (window.cameraStream) {
        window.cameraStream.getTracks().forEach(function (t) { t.stop(); });
        window.cameraStream = null;
    }
    window.cameraStarted = false;
    showSwitchButton(false);
    cameraVideo = null; cameraGuide = null; cameraWork = null; cameraWorkCtx = null;
    cameraZones = null; cameraRead = null; cameraStatus = null;
    var host = document.getElementsByClassName("scanner-cam")[0];
    if (host) {
        host.innerHTML = "";
        host.style.visibility = "";
        host.style.opacity = "";
        host.style.aspectRatio = "";
    }
    cameraHost = null; cameraShown = false;
}

function checkCameraState() {
    if (window.cameraMode) {
        if (!window.cameraStarted) { startCamera(); }
    } else if (window.cameraStarted) {
        stopCamera();
    }
}
checkCameraState()
