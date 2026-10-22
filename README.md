# Sign In Helper Project

This is an experimental job aid for tracking sign in to activities for groups that use ID cards that have barcodes.

## Using the project:

This solution is based on local HTML and Javascript. It does not rely on any server connections. You can run the code from Github pages at: https://cloudassistprojects.github.io/sign-in/ or you can copy/clone this repository to review the code or to run offline.

You can plug in a barcode scanner. It should be set to convey the barcode input and then provide a carriage return. This is normally the default for cheap USB scanners. If you get a 2-D barcode scanner, then you can scan either the front or the back of the CAP ID card.

There is also a camera mode that reads cards from the webcam. The camera button in the top left corner turns it on and off, and the same switch is under More Options, Camera Mode. Whichever you use, the setting is remembered, so a machine set up to read cards from the webcam comes back up that way after a refresh. A card-shaped target appears in the corner of the screen; the member holds their card against it, facing the screen, and it is read three ways:

- the Code 39 barcode on the back of the card
- the Data Matrix on the front of the card
- the printed number, for temporary cards, which carry no barcode at all - the number on those is printed as `*123456*`, the asterisks being Code 39 start and stop marks that never made it into a barcode font

All of this happens in the browser. No picture is ever uploaded and no outside service is called. Every frame is checked for both barcodes, and the printed number is read alongside them rather than only as a last resort, because a temporary card may have no barcode to find. Whichever gets there first wins, and a barcode usually does.

The dashed outline is captioned **Line Up Card Here (Front or Back)**, and inside it three green boxes mark the places that matter, each labelled with the side it belongs to so that nobody has to know what a Data Matrix is:

- **Barcode (Back)**, low and centre, where the bars on the back of the card land
- **Square Code (Front)**, bottom right, where the little square on the front lands
- **CAPID (Front)**, upper middle, on the number printed under CAPID NUMBER

Each box also holds a faint grey drawing of what it is waiting for - bars, a square, and `000000` - so the card can be turned the right way round without reading anything. The drawings are life-size: each is the size that mark actually is on a card filling the target, so a card lined up properly covers its drawing almost exactly. They are decorative otherwise - not real codes, and not meant to scan.

A card only ever has two of the three, and which two depends on which way round it is held, so all three are shown at once rather than asking the holder to think about it. Lining any one of them up is enough.

The preview shows the card target and a border around it, not the whole camera frame. A phone hands over a tall portrait picture with the card a landscape strip across the middle of it, and a webcam hands over something too wide for the same reason; showing all of either wastes most of the screen on ceiling, floor or wall, and on a phone it takes so much height that the form below is pushed off.

The border is a fixed share of the card - `window.cameraPreviewBorder`, 3% of its width - rather than whatever each frame has going spare. Since the target is always the card's own proportions, a proportional border makes the preview a constant shape too: 4:3, 16:9, a portrait phone and a 2560x1440 webcam all come out at 1.534, so the layout around it never shifts with the camera. 3% is as much as every shape can supply; on a 16:9 camera the frame has only a little more than that above and below the target, and the crop has to stop short of the frame edge where a CSS blur goes transparent.

The camera picture is blurred everywhere except inside those three boxes, which show through sharp. The blur is light enough to line a card up by and heavy enough that the preview is not a usable view of the room; the sharp patches are small, fixed, and between them show a barcode, a square and a six-digit number rather than a face. Turn the blur up with `window.cameraBlurPx` if the room needs it.

Camera mode copes with whatever resolution the camera provides. A small frame is scaled up before decoding, which adds no detail but does let narrow Code 39 bars be resolved, and a large one is scaled down to keep the work the same everywhere. Both barcodes have been read in testing from 1920x1080 down to 480x360, and the printed number of a temporary card down to 640x480.

### Reading temporary cards

Reading printed text needs Tesseract.js. It is committed, in `ocr/`, so a copy of this repository deploys and runs as it stands - on GitHub Pages or anywhere else - with no build step and nothing fetched from outside. It comes to about 8MB, which is most of the repository. Set `window.cameraOcrBase` if you move it.

The language model there is not the stock one. The upstream English model is 2.0MB, of which 1.8MB is a dictionary of English words - useless for reading a six-figure number. With that one component removed it is 368KB and reads the cards in `examples/` identically, down to the confidence score. `NOTICES.md` records the change and how to rebuild it.

The rest is the Tesseract engine itself: two WebAssembly builds of about 3.9MB each, one for processors with SIMD and one without, of which a browser loads whichever it can run. Dropping the non-SIMD build would take the folder from 8MB to 4.3MB at the cost of browsers older than Chrome 91 or Safari 16.4 - roughly, an iPad that cannot reach iPadOS 16.4 - which for a sign-in station may well be a trade worth making.

Because reading text has no check digits and can occasionally invent a figure, a number read this way is only accepted once two readings agree on it, within `cameraOcrAgreeMs` of each other. Barcodes are accepted on the first read.

A number is found on a card three ways, in this order of confidence:

1. `*123456*`, asterisks and all, which is how temporary cards are printed today. The asterisks are stripped; nothing downstream ever sees them.
2. A six or seven figure number sitting just under a `CAPID NUMBER` label, which is how a printed card reads.
3. Failing both, a six or seven figure number if the card shows exactly one - which covers a temporary card printed without the asterisks. If two different candidates appear, nothing is returned rather than the wrong one being guessed at, and runs are counted whole, so the first seven figures of an eight figure date are not mistaken for a CAPID.

### If a card will not read

Open the browser console. Setting `window.cameraDebug = true` makes it report once a second how long each pass is taking, what the text reader is doing, and how long it has been since anything read. Every successful read is logged with which of the three ways found it, as is anything read that did not look like a CAPID.

The settings at the top of `barcode.js` can all be changed from the console. Switch camera mode off and on again to apply the ones that only take effect when the camera opens:

    window.cameraWidth = 1280          // resolution to ask the camera for
    window.cameraWorkWidth = 1000      // width at which decoding is done
    window.cameraBlurPx = 14           // strength of the privacy blur
    window.cameraOcrEnabled = false    // turn off reading printed text altogether
    window.cameraCooldownMs = 2000     // pause after a read, and how long the number shows
    window.cameraSameCardMs = 2000     // how long a card must be gone before it reads again
    window.cameraOcrAfterMs = 0        // quiet time before the text reader joins in
    window.cameraOcrEveryMs = 250      // how often it looks, once the last look has finished
    window.cameraOcrAgreeMs = 1500     // how long two readings have to agree within

The text reader runs in a worker of its own, so it does not hold up the barcodes, but it does want a processor to run on. On an old tablet, raising `cameraOcrEveryMs` or putting `cameraOcrAfterMs` back to a few seconds gives the barcodes the machine to themselves.

The green boxes are the `CARD_ZONES` table near the top of `barcode.js`, as fractions of the target. Each entry carries a `box`, which is the mark plus a margin to aim into, and a `glyph`, which is the mark's own size. All of them were measured off the cards in `examples/`. The square's box sits well inside `DM_CENTRE` and `DM_WINDOW`, the window the decoder genuinely searches, so anything lined up with the box is comfortably found; widen the window rather than the box if cards are being missed. The other two boxes are guidance only, since the barcode and the printed number are searched for across the whole target wherever they land. The CAPID box is placed on the printed card, which is what almost everybody holds up; a temporary card prints its number further left and is read just the same, its number simply not being where the box suggests.

You do not need to click into the CAPID box before scanning. The page watches for keyboard input across the whole document, so a scan is recorded even if something else on the page has focus. You can also keep scanning while a confirmation is still on screen - scans that arrive during the countdown are queued and recorded in order as soon as it clears.

On a successful read the number is shown back across the camera preview in large white figures for two seconds, with the green boxes and their drawings hidden behind it, so a check-in is unmistakable from across a table. The preview returning to normal is the signal that the next person can step up.

Repeats are held off by number rather than by time. A card sits in front of the camera while its holder reads the confirmation and lowers their hand, so a plain timer would read it again and again; instead `cameraSameCardMs` is counted from the last time the card was *seen*, which means it only starts running once the card has gone. Holding a card up therefore reads it once, however long it is held, and a brief wobble out of frame does not count as leaving.

Presenting the same card again after that does read a second time, on purpose. Somebody who is already signed in should be told so rather than met with silence, and they get the ordinary "You have already been checked in." Nothing is recorded twice. A different card is never held up by any of this and can be read `cameraCooldownMs` after the one before.

### On other screens

The sign-in card is a fixed 448px in the middle of the window, so how much room is left beside it for the camera preview is simply (window - 448) / 2. The preview is given exactly that, less margins, capped at 430px - said as a calculation rather than as a set of breakpoint widths, so there is no window width at which it is suddenly sitting on the Sign in button.

The two camera buttons sit stacked in the top left corner at every size, the switch below the on/off toggle, and the switch is only there at all while the camera is running.

Below 900px the card takes the whole width and there is nothing beside it. More Options collapses to a menu icon in the top right, opposite the camera buttons, and the send button tucks underneath it. A tablet held in landscape with the pixels to spare keeps the full layout; stood upright it gets the compact one.

Below 820px - phones, and the smaller tablets upright - the preview stops floating altogether and takes the top of the page in the flow. Floating it cannot be made to work at that size: the card and the preview together are taller than the screen, so anything reserved for one is taken from the other and the Sign in button ends up behind the picture. In the flow nothing overlaps at all, and the preview is where the attention is anyway.

It does not take the full width there, though, because on a near-square window it would take most of the height with it - a 16:9 picture across 780px is 440px tall, and Sign in goes off the bottom. Its limit is what is left of the height once the form has had the room it needs, turned back into a width through the frame's own shape, which camera mode hands to the stylesheet as `--cam-aspect` when the first frame arrives. On a tall phone that figure comes out wider than the screen, so nothing is taken away; on a square one it is what keeps the form on screen.

On a phone the CAPID box is marked `inputmode="none"`, which keeps it focusable but stops the phone throwing its own keyboard over the page, and an on-screen keypad stands in for it. A keyboard offering a whole alphabet is no use for a six-figure number and covers half the screen the moment anybody touches the field. The keypad is only up while the field is being used, and it carries the Sign in button - the one in the card is hidden while it is, rather than offering the same thing twice - so a number can be keyed in and submitted without the layout giving up any room the rest of the time. It falls back to the phone's own keyboard on anything 900px or wider, where a real keyboard is usually at hand.

Held upright it is the shape of a telephone, which needs no explaining. On its side there is only about 390px of height to work with, so it lies down into two rows of five with delete and Sign in stacked in a sixth column - which also keeps delete away from the 9 and 0 where it would be caught by mistake.

    portrait            landscape
    1   2   3           1  2  3  4  5  | del
    4   5   6           6  7  8  9  0  | Sign in
    7   8   9
    del 0   Sign in

Measured on an iPhone 15, 15 Pro and 15 Pro Max, in both orientations and both with and without Safari's chrome: the keypad is 249px upright and 107px on its side, keys never fall below 120x52 and 126x42, and the shortest case still leaves 236px above it for the field.

A paired barcode scanner is unaffected by any of this. `inputmode` governs only the on-screen keyboard; a scanner sends real key events, which arrive as they always did. Keypad taps produce no key events at all, which is why they read as manual entry - correctly, since that is what they are.

A window under 620px tall puts the CAPID box and the Sign in button on one line and shrinks the badge and heading, which is what makes a phone on its side usable.

The arrangement was checked by computing the position of every element against the sign-in card at 40 window sizes, from 1024x768 up to 1920x1080, every iPad from the original to the 12.9in Pro in both orientations, the Fire 7, HD 8 and HD 10, five phones, and eight near-square and half-width windows - each with camera mode on and off, and with the send button shown and hidden. Nothing overlaps, and nothing is pushed off screen, in any of them.

The data is cleared automatically each new day, based on the clock of the machine where it is being run, so it is important that the date, time, and timezone are set correctly.

Important - All data storage is local to the browser. If you do some sort of action that invalidates local storage then you will lose the current cache of data. I would recommend having a backup method for the first few times you use this to collect sign-in information.

Members record their attendance by scanning their ID card upon arrival. There is no capability for tracking sign-out.

At the end of the meeting, or once all members have signed in, you can click the "More Options" and then export the data using the "File", "Clipboard", or "Both" options. Until you have a good system for entering data, I recommend "both" so that the file generated locally on the machine can be used as a backup.

- Clipboard - copies all CAPIDs separated by commas into the system clipboard so they can be pasted into your Attendance Log.
- File - will name a file for the current date and trigger the browser to download of a file with the CAPIDs, comma separated
- Both - does both of the above at the same time.

## Advanced options

### Warn on Manual Entry

Off unless you turn it on, under More Options, Settings, and remembered after that the same way camera mode is.

With it on, a number that was typed in rather than read off a card gets a larger confirmation carrying a line in dark red - "No card scanned. Scanning is faster and avoids mistyped numbers - please bring your CAP ID card to meetings and activities." - and a red and white barber pole border, and the confirmation stays up for four seconds instead of two, so there is time to read it. The check-in itself is recorded exactly as any other; nothing is refused and nothing extra is stored. Somebody who is already checked in gets the same reminder with the usual "already been checked in".

A USB barcode scanner is a keyboard as far as the browser is concerned, so telling the two apart is a matter of how they type. The median gap between digits decides it: scanners run at 1-15ms a digit, and somebody who knows their own number by heart manages perhaps 80ms, so `window.scannerGapMs` at 50ms sits in clear space between them. The median is used rather than the average because a browser busy decoding camera frames can stall a scanner's keystrokes now and then, and an average is dragged a long way by one or two stalls - which would tell somebody off for doing exactly what they were asked, the worse of the two mistakes to make. `window.scannerSpanMs` then caps how long a whole number may take, so a few quick keystrokes spread out with pauses cannot pass as a scan. A Backspace, a held-down key, the on-screen submit button and a number that arrived with no keystrokes at all are each taken as manual outright, and a camera read is never manual whatever the keyboard has been doing.

Set `window.entryDebug = true` to have each entry reported in the console with the figures it was judged on, which is the quickest way to check the thresholds against your own scanner:

    Entry: 6 digits over 72ms, median gap 12ms -> scanned
    Entry: 6 digits over 750ms, median gap 150ms -> manual (too slow for a scanner)

### Webhook function

If a value is configured in the Webhook setting, any time you export data (clipboard/file/both) the browser will also POST a json object to the specified endpoint. I have used a PowerAutomate flow, and an Azure Logic App that receives the POST and sends an email to our commanders and admin staff so that someone can enter attendance without having to log in to eServices on the attendance laptop. Here's an example of what the webhook post sends:

    {
            "meeting_date": "7/18/2023",
            "attendees": [
                "111111",
                "222222"
            ]
    }

#### The pending records button

On by default, and switched off under More Options, Settings, Show Send Button. Sending is also autosend's job, so the button is a way of getting the records away before the machine is shut rather than the only way.

With it on, and records waiting, and a webhook configured, a light green button appears in the lower left corner just above More Options, reading "{N} Pending Records, Click Here to Send Before Closing Laptop". The wording is aimed at whoever is packing up rather than at the members queueing. On a phone or an upright tablet it shortens to "{N} Pending, Tap to Send" - closing a laptop means nothing there - and sizes itself to its own wording so it never wraps; once the preview has taken the top of the page it moves down to the bottom right corner, clear of the picture and under the thumb. Clicking it posts the attendance immediately. A toast reports "Sending {N} Records" and then "{N} Records Sent" once the webhook confirms, at which point the button reads "0 Pending Records" and fades away.

If the send fails the button stays put with its count intact, so you can simply click it again once the network is back. The button also appears on startup when a previous run left records unsent, which lets you send a missed meeting's attendance deliberately instead of waiting for the automatic recovery on the next sign-in. Records collected on an earlier date are labelled `(RECOVERED)` just like the automatic recovery post, so a late send is never filed under the wrong meeting date.

The button is hidden whenever no webhook is configured, since there would be nowhere to send the data, and whenever the setting is off.

More Options sits below it, in the same corner and at the same width, in dark grey rather than the blue of "Sign in" - so that of the two buttons on the screen, the one a member is meant to press is the obvious one.

#### Previewing the data without sending it

If you set the Webhook value to the word `local` instead of a URL, nothing is posted anywhere. Each time you export, the browser shows a modal with the exact JSON that would have been sent, formatted to be readable and scrollable if the list is long. This is useful for checking the payload shape before you build the receiving flow, or for running a meeting on a machine with no network while still seeing what would have gone out.

Local mode counts the data as delivered once the preview has been shown, the same as a successful post, so it clears the pending records. It is a stand-in for a working endpoint, not a dry run on top of one.

#### Confirming that a send worked

The browser can only read the endpoint's reply if the endpoint answers the preflight `OPTIONS` request and returns an `Access-Control-Allow-Origin` header that permits the origin the page is served from. If either is missing, the app cannot tell a delivered post from a failed one: it reports "Not confirmed", leaves the records pending, and the next day's first scan will send the same attendance again labelled `(RECOVERED)`.

If you are using a PowerAutomate flow or a Logic App, add a Response action that returns the header below, and the "Sent" confirmation will start working:

    Access-Control-Allow-Origin: *

If you cannot change the endpoint, either expect an occasional duplicate `(RECOVERED)` post, or click "Clear Data" at the end of the meeting once you have taken a File or Clipboard backup - clearing the data also clears the pending count.

When a send cannot be confirmed the app shows a warning on screen rather than only writing to the browser console. It tells you which of three things happened: the endpoint rejected the data, the machine is offline so nothing was sent, or the reply could not be read and the data may or may not have arrived.

### Autosend function

If a value is configured in this setting, the system will automatically trigger the webhook export at the configured time. This must be entered using 24-hour time like: 21:15 for 9:15PM.

### Recovery of unsent records

The system keeps a count of records that have not yet been successfully sent to the webhook. Each recorded sign-in increases that count - scanning the same ID twice does not, because nothing new is stored. The count is only cleared when a webhook POST comes back with a success (HTTP 2xx) response or when the data is cleared. If the POST fails - the network is down, the endpoint is unreachable, or the server returns an error - the records stay marked as pending, a warning is shown on screen, and details of the failure are written to the browser console.

If records are still pending when the date rolls over, the next scan on the new day will automatically POST the previous day's data to the webhook before clearing it. The recovered post is labeled with the earlier date so that it is easy to spot on the receiving end:

    {
            "meeting_date": "7/18/2023 (RECOVERED)",
            "attendees": [
                "111111",
                "222222"
            ]
    }

This means a meeting where someone forgot to export, or where the webhook failed, can still get its attendance out, but only if the browser is opened again on the same machine and a sign-in is recorded. It is not a substitute for exporting at the end of the meeting, and it does not apply if no webhook is configured.

## Licence and attribution

This project bundles ZXing-JS to read barcodes, which is licensed under the Apache License, Version 2.0. A copy of that licence is in `LICENSE-APACHE-2.0.txt`, and the attribution it requires is in `NOTICES.md`, along with the terms for Tesseract.js if you add the optional text reader. Please keep both files with any copy you distribute.
