# Example images

Test fixtures for camera mode. They are not part of the application and nothing in the page loads them; they exist so that changes to the decoding path can be checked against a real card without one being to hand.

All three carry the made-up CAPID `100001`. The photograph, name and rank are removed, and the CAPID and expiry are replaced, so none of them show real member data. See `NOTICES.md` for the licensing position.

## The files

| File | What it is | What reads it |
| --- | --- | --- |
| `card-back.png` | Photograph of the back of a CAP ID card | Code 39, anywhere in the target |
| `card-front.png` | Photograph of the front of the same card | Data Matrix, from the window at `DM_CENTRE` |
| `tempcard.png` | Rendering of a temporary card, which carries no barcode at all | Neither - it falls through to the printed number, via OCR |

## How they are framed

Each is 1280x720, the resolution camera mode asks for, with the card centred and filling about 95% of the card-shaped target. That is what the camera sees when someone holds their card up to the target properly, so a fixture can be fed to the decoding path exactly as a video frame is: crop `guideRect`, scale to the work canvas, decode.

This framing matters for the Data Matrix. `DM_CENTRE` and `DM_WINDOW` in `barcode.js` locate the symbol as fractions of the target, not of the card, so a photograph of a card sitting small in the frame puts the symbol outside the window and never reads. The originals these were cut from were framed that way and the front would not decode at all.

`tempcard.png` is a rendering rather than a photograph, so it is clean in a way a real frame never is - no camera noise, no blur, evenly lit. Treat a pass on it as the easy case.

## Headroom

The fixtures were scaled down until they stopped decoding, running the real pipeline at each size:

| Frame | `card-back.png` (Code 39) | `card-front.png` (Data Matrix) |
| --- | --- | --- |
| 1280x720 | reads | reads |
| 1024x576 | reads | reads |
| 960x540 | fails | reads |
| 800x450 | fails | reads |
| 640x360 | fails | reads |
| 480x270 | fails | reads |

So the Code 39 has about one step of margin at this size and the Data Matrix has a great deal. Scaling these files down further would cost the Code 39 fixture its only margin; keep 1280x720 as the floor. These figures are the limits of the *fixtures*, not of camera mode - a real camera frame at 960 wide holds detail that survives a resample from 4032 only down to about 1024.

## Where they came from

Cut from two 4032x3024 phone photographs and a letter-size PDF rendering of a temporary card, which are not kept in the repository. The crops were reframed and resampled rather than merely scaled, so they cannot be re-derived from what is here; they are the originals now.
